---
name: publish
description: >-
  发版 OctopBot 移动客户端（单分支 + chore PR）：从 develop 切 chore/release-x.y.z，升级 app.json 与 package.json 版本、
  过质量门，开一个 chore 的 PR 合回 develop，合入后在 develop tip 打 v* tag 并推送，最后用 EAS production 构建
  （提交商店仅在用户明确要求时）。在用户说「发版」「发布」「release」「bump version」「切版本」「打个 tag」「上传构建」时使用。
disable-model-invocation: true
---

# Publish / 发版

`develop` 既是集成分支也是发版分支——没有 `main`，也不切长命 release 分支。
版本改动本身走一个 **chore 分支 + PR 合回 develop**（让 CI 跑在 PR 上、改动可追溯），合入后 tag 打在 `develop` tip。

```
chore/release-A.B.C  ──PR(squash)──▶  develop  ──tag vA.B.C──▶  EAS production build
```

**开始时宣告：** "正在使用 publish 技能发布版本 {VERSION}。"

## 配置项

| 配置项                   | 默认值                    | 说明                                                        |
| ------------------------ | ------------------------- | ----------------------------------------------------------- |
| `VERSION_FILE`           | `app.json`                | 版本唯一真源：`expo.version`                                |
| `SECONDARY_VERSION_FILE` | `package.json`            | 必须与 `expo.version` 相等                                  |
| `LOCK_FILE`              | `package-lock.json`       | 根 `version` 需与上面一致（当前是脏的 `1.0.0`，顺手对齐）   |
| `LICENSES_FILE`          | `src/legal/licenses.json` | 依赖变更时用 `npm run licenses` 重建                        |
| `VERSION_GUARD`          | `npm run check:version`   | CI 门：两个版本号必须相等                                   |
| `TAG_PREFIX`             | `v`                       | 生成 `v1.0.0-alpha.2` 风格标签                              |
| `REMOTE`                 | `origin`                  | Git 远程仓库名                                              |
| `BRANCH`                 | `develop`                 | 唯一的集成分支，也是发版分支（PR 的目标、tag 的落点）       |
| `WORK_BRANCH_PREFIX`     | `chore/release-`          | 版本 PR 用的短命分支，命名沿用仓库 `chore/...` 习惯         |
| `MERGE_METHOD`           | `squash`                  | 与仓库既有 PR 一致：squash 后 develop 只多一条 release 提交 |
| `EAS_PROFILE`            | `production`              | `eas.json` 中构建号自增、面向商店的 profile                 |

## 调用方式

```
/publish 1.0.0-alpha.2
```

版本号可省略：按当前版本推断（`1.0.0-alpha.N` → `1.0.0-alpha.N+1`），在步骤 1 一并确认。

## 发布流程

### 步骤 1 — 预检与版本确认（只读）

1. 仓库根目录：`git rev-parse --show-toplevel`
2. 当前分支必须是 `{BRANCH}`：
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```
   不是 → 中止："发版从 develop 起，先 `git checkout develop`。"
3. 同步远程：
   ```bash
   git fetch {REMOTE} --tags --prune
   git status -sb | head -1        # 必须无 ahead / behind
   ```
   落后 → `git pull --ff-only`；**领先或分叉 → 中止**，先让用户处理本地提交。
4. 工作树必须干净：
   ```bash
   git status --short
   ```
   非空 → 中止，提示先提交或 stash。
5. 读当前版本并核对一致：
   ```bash
   grep -n '^\s*"version"' app.json        # 期望仅 1 行命中（expo.version）
   grep -n '^\s*"version"' package.json
   ```
   两者不等 → 中止："先修 `npm run check:version`。"
6. 上次发布 tag：`git tag --sort=-creatordate | head -1`
7. 目标版本自检：
   - ≤ 当前版本 → 中止："新版本必须大于 `{current}`。"
   - `{TAG_PREFIX}{目标版本}` 已存在 → 中止："这个号已经发过了，换一个。"（`v1.0.0-alpha.1` 已占用）
   - 远端已存在同名 `{WORK_BRANCH_PREFIX}{version}` → 中止，给删除指令
8. 展示确认块：

```
当前版本 (app.json @ develop):  X.Y.Z
目标版本:                        A.B.C
上次发布 tag:                    vX.Y.Z (YYYY-MM-DD)
发版分支:                        chore/release-A.B.C → PR → develop（squash）
本次发布提交数:                   N（{last_tag}..HEAD）
构建:                            eas build --profile production --platform all
开源许可清单:                     依赖有变更则需 npm run licenses

确认发布 X.Y.Z → A.B.C？[y/N]
```

用户未输入 `y` 立即中止。

### 步骤 2 — 切出 chore 分支

```bash
git checkout -b {WORK_BRANCH_PREFIX}{version} {REMOTE}/{BRANCH}
```

### 步骤 3 — 升级版本号

**旧号 `X.Y.Z` 一律换成 `A.B.C`。** 用 Edit 工具精确替换，不用 `sed -i`，不做全库盲替换。

1. `app.json` — `expo.version`（用户和商店看到的唯一真源）
2. `package.json` — 顶层 `version`
3. `package-lock.json` — 根版本（当前是 `1.0.0`，与 `1.0.0-alpha.1` 不一致，一并对齐）：
   ```bash
   npm install --package-lock-only --ignore-scripts
   git diff --stat package-lock.json     # 只允许根 version 相关行
   ```
   diff 远超根版本行（依赖漂移）→ `git checkout -- package-lock.json`，改回手工只动 `version` 与 `packages[""].version` 两处。

**扫尾：**

```bash
git grep -n --fixed-strings "X.Y.Z"
```

| 命中位置                                                 | 处理                           |
| -------------------------------------------------------- | ------------------------------ |
| `app.json` / `package.json` / `package-lock.json` 根版本 | 换成 `A.B.C`                   |
| `ios/`、`android/` 下的生成产物（已 gitignore）          | 忽略，由 prebuild / EAS 重生成 |
| `src/legal/licenses.json` 里的包版本                     | 保留（依赖版本，非应用版本）   |
| 测试夹具里的旧号比较 / 解析示例                          | 保留                           |
| 文档里描述历史版本的句子                                 | 保留                           |

提交前断言（任一命中都要补改）：

```bash
git grep -n --fixed-strings "X.Y.Z" -- app.json package.json
```

**依赖变更连带的许可清单：**

```bash
git diff --name-only {last_tag}..HEAD -- package.json package-lock.json
```

非空 → `npm run licenses`，若 `{LICENSES_FILE}` 有变化则随本次 PR 一起提交。

**不要手改原生构建号。** `CFBundleVersion` / `versionCode` 由 EAS 远程自增（`eas.json` → `appVersionSource: "remote"`、`production.autoIncrement: true`）；也不要新增 `runtimeVersion` / OTA channel。

### 步骤 4 — 本地质量门（不通过就中止）

按顺序跑，任一步失败即中止（此时还没提交，改完重跑本技能即可）：

```bash
npm run check:version
npm run lint
npm run typecheck
npm test -- --ci --coverage=false
```

E2E 可选，不跑要如实记录：

```
Maestro 需要模拟器 + 真实 Octop 实例（Android 是基线）。
现在跑 .maestro/smoke.yaml + .maestro/chat-round-trip.yaml？[y/N]
```

- `y` → `maestro test .maestro/smoke.yaml .maestro/chat-round-trip.yaml`，失败即中止。
- `n` → 在最终汇报里写明"本次未跑 E2E"。

### 步骤 5 — 提交、推送、开 chore PR

1. 提交（本 PR 只应包含版本与许可清单改动）：
   ```bash
   git status --short
   git add -A
   git commit -m "chore(release): {version}"
   ```
   **不要 `--no-verify`**：commitlint 与 lint-staged 必须通过。
2. 推送：
   ```bash
   git push -u {REMOTE} {WORK_BRANCH_PREFIX}{version}
   ```
   失败即中止，给出手动命令，不要强推。
3. 开 PR（目标就是 `{BRANCH}`）：
   ```bash
   gh pr create \
     --base {BRANCH} \
     --head {WORK_BRANCH_PREFIX}{version} \
     --title "chore(release): {version}" \
     --body "$(cat <<'EOF'
   ```

版本 X.Y.Z → A.B.C。

## 本次包含

- `app.json` → `expo.version`
- `package.json` → `version`
- `package-lock.json` → 根 version（对齐）
  （若动过依赖：`src/legal/licenses.json` 已重建）

## 合并后

- [ ] 在 develop tip 打 `v{version}` tag
- [ ] `eas build --profile production`
- [ ] 构建号由 EAS 自增，Settings → About 应显示 `{version} (build)`
      EOF
      )"
  ```
  成功则展示 PR URL。
  ```

4. 等 PR 的 CI 绿：
   ```bash
   gh pr checks {number} --watch        # 或 gh pr view {number} --json statusCheckRollup
   ```
   `Lint, typecheck, test` 必须 pass；失败 → **中止**，不要合也不要在红的树上打 tag。

### 步骤 6 — 合入 develop（squash）

1. 合入需要用户确认——这是唯一会改动 `develop` 的动作：
   ```
   PR #{number} 的 CI 已绿。用 squash 合入 develop？[y/N]
   ```
   未确认则停下，告知 PR 链接与"确认后我再合、再打 tag"。
2. 合入：
   ```bash
   gh pr merge {number} --squash --subject "chore(release): {version}"
   ```
   - 不用 `--delete-branch` 顺手删远端分支的默认行为前先确认；删分支在步骤 8 做。
   - 若被分支保护拦住 → 中止，让用户手动合，不要绕过保护。
3. 同步本地并确认落点：
   ```bash
   git checkout {BRANCH}
   git pull --ff-only {REMOTE} {BRANCH}
   git log --oneline -1
   ```

### 步骤 7 — 在 develop tip 打 tag

1. 确认 HEAD 与远端一致：
   ```bash
   git rev-parse HEAD {REMOTE}/{BRANCH}
   ```
   不等 → 中止，先同步。
2. 打 tag 前校验版本（硬门）：
   ```bash
   git show HEAD:app.json | grep -E '^\s*"version"'
   git show HEAD:package.json | grep -E '^\s*"version"'
   ```
   任一处 != `A.B.C` → **中止**，不打 tag（大概率 squash 前的分支不是基于最新 develop）。
3. 创建并推送 annotated tag：
   ```bash
   git tag -a {TAG_PREFIX}{version} HEAD -m "{TAG_PREFIX}{version}"
   git push {REMOTE} {TAG_PREFIX}{version}
   ```
   tag 已存在 → 中止，给出：
   ```bash
   git push {REMOTE} --delete {TAG_PREFIX}{version}
   git tag -d {TAG_PREFIX}{version}
   ```
4. 可选发布说明（问用户，默认 `y`——这是唯一可追溯的发版记录）：
   ```bash
   gh release create {TAG_PREFIX}{version} --title "{TAG_PREFIX}{version}" --generate-notes
   ```
   要中文时改 `--notes`：按 `feat:` → 新增、`fix:` → 修复、`refactor:`/`perf:` → 变更、`!:` → **Breaking** 归段，忽略 `chore:` / `ci:` / `test:`。

### 步骤 8 — 清理分支、EAS 构建

1. 删除 chore 分支（PR 已合，可安全删）：
   ```bash
   git branch -D {WORK_BRANCH_PREFIX}{version}
   git push {REMOTE} --delete {WORK_BRANCH_PREFIX}{version}
   ```
   失败仅警告（非致命），给出手动命令。
2. 登录检查（仓库没有全局 `eas`，用 `npx eas-cli`）：
   ```bash
   npx eas-cli@latest whoami
   ```
   未登录 → 提示 `npx eas-cli login`，**结束本步骤**（tag 已发，此步失败非致命），不要代为登录。
3. 构建：
   ```bash
   npx eas-cli@latest build --profile {EAS_PROFILE} --platform all
   ```
   - 构建号由 EAS 自增，本地不要碰。
   - 本次动过 `app.json` 的 plugins / permissions → 提醒：这是完整原生构建，本地调试的 dev client 也要重建。
4. 记录结果：
   ```bash
   npx eas-cli@latest build:list --limit 1 --json
   ```
5. 分发前校验制品：
   ```bash
   apksigner verify --print-certs path/to/app.apk
   ```
   CN 为 `Android Debug` 或别名 `androiddebugkey` → 拒绝分发。
6. **提交商店只在用户明确要求时**：
   ```bash
   npx eas-cli@latest submit --profile {EAS_PROFILE} --platform android|ios
   ```
   没说要 submit 就只交付构建链接。

### 步骤 9 — 收尾汇报

留在 `{BRANCH}`（步骤 6 已切回），汇报：

- 版本 `X.Y.Z → A.B.C`、PR 链接、squash 后的 commit、tag、GitHub Release 链接
- EAS 构建 id / 平台 / 构建号，以及"装完去 `Me → Settings → About` 确认显示 `{version} ({build})`"
- 未做的项（E2E / submit / Release notes）明确列出，不要默认它们做过

## 错误处理参考

| 场景                                           | 行为                                        |
| ---------------------------------------------- | ------------------------------------------- |
| 当前不在 `develop`                             | 中止，提示切分支                            |
| 本地落后 / 领先 / 分叉                         | 落后可 `pull --ff-only`；领先或分叉一律中止 |
| 工作树不干净                                   | 中止：先提交或 stash                        |
| `app.json` 与 `package.json` 版本不一致        | 中止：先修 `check:version`                  |
| 目标版本 ≤ 当前版本，或 tag 已存在             | 中止：换一个更大的版本号                    |
| `app.json` 里 `"version"` 命中多于 1 行        | 中止并展示命中行                            |
| 依赖有变更但许可清单未更新                     | 中止：`npm run licenses` 后一并提交         |
| `check:version` / lint / typecheck / test 失败 | 中止（尚未提交）                            |
| Maestro 失败                                   | 中止（尚未提交）                            |
| 推送 chore 分支失败                            | 中止并给出手动命令，禁止强推                |
| PR 目标分支被错写成别的分支                    | 中止，重建 PR（必须 base `develop`）        |
| PR 的 CI 红                                    | 中止：不合入、不打 tag                      |
| 分支保护拦住 squash merge                      | 中止，让用户手动合，不绕过保护              |
| 合入后 develop tip 版本号不是目标版本          | 中止：不打 tag，先排查 squash 前的基线      |
| tag 已存在                                     | 中止并给删除指令                            |
| tag 推送后 EAS 登录 / 构建失败                 | 非致命：给出手动命令与 `build:list` 查法    |
| APK 是 debug 签名                              | 拒绝分发                                    |

## 红线规则

**绝不：**

- 直接 `git commit` 到 `develop` 改版本号——版本改动必须走 chore 分支 + PR
- 在版本号未升到目标值的 commit 上打 tag
- 手改 `CFBundleVersion` / `versionCode`，或引入 `runtimeVersion` / OTA channel
- 质量门或 PR checks 未过就合入、就打 tag
- `--no-verify` 绕过钩子、`--force` 推分支、绕过分支保护
- 未经用户明确要求就 `eas submit`，或代为登录 / 操作凭证
- 分发 debug 签名 APK 或本地 `prebuild` 出的 release APK
- 跳过步骤 1 的版本确认、步骤 6 的合入确认
- 任何步骤失败后继续往下（清理与 EAS 的非致命失败除外）
- 在 `develop` 之外的 commit 上打发版 tag

**始终：**

- 版本 PR 的 base 是 `{BRANCH}`、head 是 `{WORK_BRANCH_PREFIX}{version}`，标题 `chore(release): {version}`，squash 合入
- 一次提交里同时升级 `app.json`、`package.json`、`package-lock.json` 根版本，`check:version` 必过
- 依赖有变动就重建 `src/legal/licenses.json`
- 合入后先复核 `develop` tip 的版本号，再打 tag，再构建
- 构建号交给 EAS；发完删掉 chore 分支
- 汇报如实写明省略项

## 配置

需要覆盖默认值时在此追加（其余走内置默认）：

```yaml
# 示例
# EAS_PROFILE: preview       # 内测分发改用 preview（APK）
# MERGE_METHOD: merge        # 若想保留分支历史，改成 merge commit
# WORK_BRANCH_PREFIX: chore/release-
```
