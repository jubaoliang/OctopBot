---
name: publish
description: >-
  发版 OctopBot 移动客户端（单分支 + chore PR + Actions 构建）：从 develop 切 chore/release-x.y.z，升级 app.json 与
  package.json 版本、过质量门，开一个 chore 的 PR 合回 develop，合入后在 develop tip 打 v* tag 并推送，
  由 .github/workflows/release.yml 跑 EAS production 构建并回填构建链接（提交商店仅在用户明确要求时）。
  在用户说「发版」「发布」「release」「bump version」「切版本」「打个 tag」「上传构建」时使用。
disable-model-invocation: true
---

# Publish / 发版

`develop` 既是集成分支也是发版分支——没有 `main`，也不切长命 release 分支。
版本改动走 **chore 分支 + PR 合回 develop**；合入后 tag 打在 `develop` tip，**构建交给 GitHub Actions**，本地不跑 EAS。

```
chore/release-A.B.C ──PR(squash)──▶ develop ──tag vA.B.C──▶ Release workflow ──▶ EAS production build
```

**开始时宣告：** "正在使用 publish 技能发布版本 {VERSION}。"

## 配置项

| 配置项                   | 默认值                          | 说明                                                        |
| ------------------------ | ------------------------------- | ----------------------------------------------------------- |
| `VERSION_FILE`           | `app.json`                      | 版本唯一真源：`expo.version`                                |
| `SECONDARY_VERSION_FILE` | `package.json`                  | 必须与 `expo.version` 相等                                  |
| `LOCK_FILE`              | `package-lock.json`             | 根 `version` 需与上面一致（当前是脏的 `1.0.0`，顺手对齐）   |
| `LICENSES_FILE`          | `src/legal/licenses.json`       | 依赖变更时用 `npm run licenses` 重建                        |
| `VERSION_GUARD`          | `npm run check:version`         | CI 门：两个版本号必须相等                                   |
| `TAG_PREFIX`             | `v`                             | 生成 `v1.0.0-alpha.2` 风格标签                              |
| `REMOTE`                 | `origin`                        | Git 远程仓库名                                              |
| `BRANCH`                 | `develop`                       | 唯一的集成分支，也是发版分支（PR 的目标、tag 的落点）       |
| `WORK_BRANCH_PREFIX`     | `chore/release-`                | 版本 PR 用的短命分支，命名沿用仓库 `chore/...` 习惯         |
| `MERGE_METHOD`           | `squash`                        | 与仓库既有 PR 一致：squash 后 develop 只多一条 release 提交 |
| `WORKFLOW_FILE`          | `.github/workflows/release.yml` | tag 推上去后由它构建；技能不本地跑 EAS                      |
| `WORKFLOW_NAME`          | `Release`                       | `gh run list --workflow Release` 用的名字                   |
| `EAS_PROFILE`            | `production`                    | 构建 profile，固定在 `release.yml` 里；改这里也要同步它     |

**一次性接入（首次发版前必须就位，否则 workflow 会在 build job 明确报错）：**

- 仓库 secret `EXPO_TOKEN`（https://expo.dev/settings/access-tokens）
- `app.json` → `expo.extra.eas.projectId`（`npx eas-cli init` 一次并提交）

```bash
gh secret list --json name --jq '.[].name' | grep -qx EXPO_TOKEN && echo "secret ok"
node -p 'require("./app.json").expo.extra?.eas?.projectId ?? "MISSING projectId"'
```

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
8. 接入前置检查（缺了就中止，否则 tag 推上去也会在 build job 失败）：

   ```bash
   base=https://api.github.com/repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)
   gh api "${base}/actions/secrets" --jq '.secrets[].name' | grep -qx EXPO_TOKEN && echo "EXPO_TOKEN ok"
   node -p 'require("./app.json").expo.extra?.eas?.projectId ?? "MISSING projectId — 先跑 npx eas-cli init"'
   gh workflow view {WORKFLOW_NAME} >/dev/null 2>&1 || echo "MISSING {WORKFLOW_FILE}"
   ```

   `EXPO_TOKEN` 缺失或 `projectId` 仍是 `MISSING` → 中止，说明这一步只需做一次。

9. 展示确认块：

```
当前版本 (app.json @ develop):  X.Y.Z
目标版本:                        A.B.C
上次发布 tag:                    vX.Y.Z (YYYY-MM-DD)
发版分支:                        chore/release-A.B.C → PR → develop（squash）
本次发布提交数:                   N（{last_tag}..HEAD）
构建:                            push tag → Release workflow（EAS production，双平台）
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
4. **推 tag 就是发版指令**：`{WORKFLOW_FILE}` 已监听 `v*`，tag 一推上去就开始跑。
   Release notes 不在这里手写——workflow 会用 GitHub 自动生成的 notes 建/更新 Release，并把构建链接贴进去。

### 步骤 8 — 等 Release workflow 构建

1. 找到这次 tag 触发的运行，并盯住它：
   ```bash
   gh run list --workflow {WORKFLOW_NAME} --limit 3 \
     --json databaseId,headBranch,status,conclusion,displayTitle
   gh run watch {id} --exit-status      # 两个 job 都必须 success
   ```
   期望顺序：`Tag matches version, gates pass` → `EAS production build`。
2. 失败处理，按原因分两类：
   - **基础设施类**（`EXPO_TOKEN` / `projectId` / EAS 服务 / 网络）→ 补齐前置后对同一次运行重跑：
     ```bash
     gh run rerun {id} --failed
     ```
   - **代码类**（verify job 的 lint / typecheck / test / 版本门失败）→ **不要**重跑，也不要删 tag 重推；
     修完按新版本号走一遍完整流程（tag 已发出，那个号作废）。
   ```bash
   gh run view {id} --log-failed | tail -50   # 先看失败原因再决定
   ```
3. 取构建链接（workflow 已写进 Release 和 job summary）：
   ```bash
   gh release view {TAG_PREFIX}{version} --json body -q .body
   gh run view {id} --log --job $(gh run view {id} --json jobs -q '.jobs[] | select(.name=="EAS production build") | .databaseId') | grep -i expo.dev/builds
   ```
   汇报 Android / iOS 两个构建页链接；构建号由 EAS 自增，`eas.json` 的 `production.autoIncrement` 负责，本地不要碰。
4. 提醒：本次动过 `app.json` 的 plugins / permissions → 这是完整原生构建，本地调试的 dev client 也要重建。
5. 分发前校验制品（从 Release / EAS 页面下载 APK 后）：
   ```bash
   apksigner verify --print-certs path/to/app.apk
   ```
   CN 为 `Android Debug` 或别名 `androiddebugkey` → 拒绝分发。
6. **提交商店只在用户明确要求时**，且仍走本地 CLI（workflow 只构建、不 submit）：
   ```bash
   npx eas-cli@latest submit --profile {EAS_PROFILE} --platform android|ios
   ```
   没说要 submit 就只交付构建链接。

### 步骤 9 — 收尾汇报

1. 删除 chore 分支（PR 已合，可安全删）：
   ```bash
   git branch -D {WORK_BRANCH_PREFIX}{version}
   git push {REMOTE} --delete {WORK_BRANCH_PREFIX}{version}
   ```
   失败仅警告（非致命），给出手动命令。
2. 留在 `{BRANCH}`（步骤 6 已切回），汇报：

- 版本 `X.Y.Z → A.B.C`、PR 链接、squash 后的 commit、tag、GitHub Release 链接
- Release workflow 的 run 链接、两个 job 的结论、Android / iOS 构建页链接与构建号
- "装完去 `Me → Settings → About` 确认显示 `{version} ({build})`"
- 未做的项（E2E / submit）明确列出，不要默认它们做过

## 错误处理参考

| 场景                                           | 行为                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| 当前不在 `develop`                             | 中止，提示切分支                                                  |
| 本地落后 / 领先 / 分叉                         | 落后可 `pull --ff-only`；领先或分叉一律中止                       |
| 工作树不干净                                   | 中止：先提交或 stash                                              |
| `app.json` 与 `package.json` 版本不一致        | 中止：先修 `check:version`                                        |
| 目标版本 ≤ 当前版本，或 tag 已存在             | 中止：换一个更大的版本号                                          |
| `app.json` 里 `"version"` 命中多于 1 行        | 中止并展示命中行                                                  |
| 依赖有变更但许可清单未更新                     | 中止：`npm run licenses` 后一并提交                               |
| `check:version` / lint / typecheck / test 失败 | 中止（尚未提交）                                                  |
| Maestro 失败                                   | 中止（尚未提交）                                                  |
| 推送 chore 分支失败                            | 中止并给出手动命令，禁止强推                                      |
| PR 目标分支被错写成别的分支                    | 中止，重建 PR（必须 base `develop`）                              |
| PR 的 CI 红                                    | 中止：不合入、不打 tag                                            |
| 分支保护拦住 squash merge                      | 中止，让用户手动合，不绕过保护                                    |
| 合入后 develop tip 版本号不是目标版本          | 中止：不打 tag，先排查 squash 前的基线                            |
| tag 已存在                                     | 中止并给删除指令                                                  |
| `EXPO_TOKEN` / `projectId` 缺失                | 中止（步骤 1 的前置检查），补齐后重来                             |
| tag 推了但 workflow 没跑                       | `gh workflow list` 检查 `{WORKFLOW_NAME}` 是否存在、tag 是否 `v*` |
| workflow 的 verify job 失败（代码 / 版本门）   | 不重跑、不删 tag；修完换新版本号重走流程                          |
| workflow 的 build job 失败（凭证 / EAS 侧）    | `gh run rerun {id} --failed`                                      |
| APK 是 debug 签名                              | 拒绝分发                                                          |

## 红线规则

**绝不：**

- 直接 `git commit` 到 `develop` 改版本号——版本改动必须走 chore 分支 + PR
- 在版本号未升到目标值的 commit 上打 tag
- 手改 `CFBundleVersion` / `versionCode`，或引入 `runtimeVersion` / OTA channel
- 质量门或 PR checks 未过就合入、就打 tag
- `--no-verify` 绕过钩子、`--force` 推分支、绕过分支保护
- 未经用户明确要求就 `eas submit`，或代为登录 / 操作凭证
- 本地跑 `eas build` 绕开 `{WORKFLOW_FILE}`——构建只有 Actions 一条路（本地只留 `whoami` / `submit`）
- 删掉 tag 重推同一个版本号来"重试"；代码类失败一律换新号
- 分发 debug 签名 APK 或本地 `prebuild` 出的 release APK
- 跳过步骤 1 的版本确认、步骤 6 的合入确认
- 任何步骤失败后继续往下（分支清理与 workflow 失败处理除外）
- 在 `develop` 之外的 commit 上打发版 tag

**始终：**

- 版本 PR 的 base 是 `{BRANCH}`、head 是 `{WORK_BRANCH_PREFIX}{version}`，标题 `chore(release): {version}`，squash 合入
- 一次提交里同时升级 `app.json`、`package.json`、`package-lock.json` 根版本，`check:version` 必过
- 依赖有变动就重建 `src/legal/licenses.json`
- 合入后先复核 `develop` tip 的版本号，再打 tag，再等 workflow
- 构建号交给 EAS 自增；发完删掉 chore 分支
- 汇报如实写明 run 结论与省略项

## 配置

需要覆盖默认值时在此追加（其余走内置默认）：

```yaml
# 示例
# EAS_PROFILE: preview       # 内测分发改用 preview（APK）
# MERGE_METHOD: merge        # 若想保留分支历史，改成 merge commit
# WORK_BRANCH_PREFIX: chore/release-
```
