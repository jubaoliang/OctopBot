---
name: publish
description: >-
  发版 OctopBot 移动客户端（单分支 + chore PR + Actions 构建）：从 develop 切 chore/release-x.y.z，升级 app.json 与
  package.json 版本、过质量门，开一个 chore 的 PR 合回 develop，合入后在 develop tip 打 v* tag 并推送，
  由 .github/workflows/release.yml 用 Gradle 构建签名 APK 并挂到 GitHub Release（iOS 暂不构建，提交商店仅在用户明确要求时）。
  在用户说「发版」「发布」「release」「bump version」「切版本」「打个 tag」「上传构建」时使用。
disable-model-invocation: true
---

# Publish / 发版

`develop` 既是集成分支也是发版分支——没有 `main`，也不切长命 release 分支。
版本改动走 **chore 分支 + PR 合回 develop**；合入后 tag 打在 `develop` tip，**Android 构建交给 GitHub Actions 的 Gradle**——不用 EAS，也不需要 Expo 账号。

```
chore/release-A.B.C ──PR(squash)──▶ develop ──tag vA.B.C──▶ Release workflow ──▶ 签名 APK ▸ GitHub Release
```

**开始时宣告：** "正在使用 publish 技能发布版本 {VERSION}。"

## 配置项

| 配置项                   | 默认值                          | 说明                                                         |
| ------------------------ | ------------------------------- | ------------------------------------------------------------ |
| `VERSION_FILE`           | `app.json`                      | 版本唯一真源：`expo.version`                                 |
| `SECONDARY_VERSION_FILE` | `package.json`                  | 必须与 `expo.version` 相等                                   |
| `LOCK_FILE`              | `pnpm-lock.yaml`                | 不记录根包版本，升号不需要动它                               |
| `LICENSES_FILE`          | `src/legal/licenses.json`       | 依赖变更时用 `pnpm run licenses` 重建                        |
| `VERSION_GUARD`          | `pnpm run check:version`        | CI 门：两个版本号必须相等                                    |
| `TAG_PREFIX`             | `v`                             | 生成 `v1.0.0-alpha.2` 风格标签                               |
| `REMOTE`                 | `origin`                        | Git 远程仓库名                                               |
| `BRANCH`                 | `develop`                       | 唯一的集成分支，也是发版分支（PR 的目标、tag 的落点）        |
| `WORK_BRANCH_PREFIX`     | `chore/release-`                | 版本 PR 用的短命分支，命名沿用仓库 `chore/...` 习惯          |
| `MERGE_METHOD`           | `squash`                        | 与仓库既有 PR 一致：squash 后 develop 只多一条 release 提交  |
| `WORKFLOW_FILE`          | `.github/workflows/release.yml` | tag 推上去后由它用 Gradle 构建；技能不本地打包               |
| `WORKFLOW_NAME`          | `Release`                       | `gh run list --workflow Release` 用的名字                    |
| `VERSION_CODE_BASE`      | `0`                             | versionCode = 基数 + `github.run_number`，定义在 release.yml |

**一次性接入（首次发版前必须就位，否则 workflow 会在 build job 明确报错）：**

四个仓库 secret，缺一不可——签名必须是真 keystore，debug 签名的包不能分发：

- `ANDROID_KEYSTORE_BASE64` — release keystore 的 base64
- `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`

```bash
for s in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  gh secret list --json name --jq '.[].name' | grep -qx "$s" && echo "$s ok" || echo "$s MISSING"
done
```

签名身份是 **一对 PEM 文本文件**（`release-key.pem` + `release-cert.pem`），`.keystore` 只是容器，随时可用 `scripts/keystore-from-pem.sh` 重建，不必留二进制。**必须备份 PEM 对**：丢了就再也没法用同一个包名更新这个应用。命令写在 `{WORKFLOW_FILE}` 头部注释里。

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
3. 同步远程并判断历史关系：
   ```bash
   git fetch {REMOTE} --tags --prune
   git status -sb | head -1
   git merge-base --is-ancestor {REMOTE}/{BRANCH} HEAD && echo "ok：远端的提交都在本地历史里"
   ```
   - **落后**（远端有本地没有的提交）→ `git pull --ff-only`，再判一次；
   - **分叉**（上面那句失败，且本地也有远端没有的提交）→ **中止**，先解决分叉。被 squash 合并过的历史最容易产生这种"假分叉"：同一份改动在本地是几十条提交、在远端是一条 squash 提交，SHA 对不上但内容重合；
   - **领先**（本地有未推提交）→ **允许**，但确认块里必须列出这些提交标题，用户要知道它们会随本次一起推上去。
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
   两者不等 → 中止："先修 `pnpm run check:version`。"
6. 上次发布 tag：`git tag --sort=-creatordate | head -1`
7. 目标版本自检：
   - ≤ 当前版本 → 中止："新版本必须大于 `{current}`。"
   - `{TAG_PREFIX}{目标版本}` 已存在 → 中止："这个号已经发过了，换一个。"（`v1.0.0-alpha.1` 已占用）
   - 远端已存在同名 `{WORK_BRANCH_PREFIX}{version}` → 中止，给删除指令
8. 接入前置检查（缺了就中止，否则 tag 推上去也会在 build job 失败）：

   ```bash
   for s in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
     gh secret list --json name --jq '.[].name' | grep -qx "$s" && echo "$s ok" || echo "$s MISSING"
   done
   gh workflow view {WORKFLOW_NAME} >/dev/null 2>&1 || echo "MISSING {WORKFLOW_FILE}"
   ```

   任一 secret 缺失 → 中止，给出生成 keystore 与 `gh secret set` 的命令（只需做一次）。workflow 未注册 → 先把 `{WORKFLOW_FILE}` 合进 `develop`。

9. 展示确认块：

```
当前版本 (app.json @ develop):  X.Y.Z
目标版本:                        A.B.C
上次发布 tag:                    vX.Y.Z (YYYY-MM-DD)
发版分支:                        chore/release-A.B.C → PR → develop（squash）
本地未推提交:                     N 条（会随本次一起推，逐条列出标题）
构建:                            push tag → Release workflow（Gradle 签名 APK → GitHub Release；iOS 不构建）
开源许可清单:                     依赖有变更则需 pnpm run licenses

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

`pnpm-lock.yaml` **不记录根包版本**，所以升号不碰 lockfile，也没有"根版本与 package.json 不一致"这个问题（旧 npm 方案里 `package-lock.json` 根版本漂移的坑在这里不存在）。改完照常 `pnpm install --frozen-lockfile` 应该零差异。

**扫尾：**

```bash
git grep -n --fixed-strings "X.Y.Z"
```

| 命中位置                                        | 处理                         |
| ----------------------------------------------- | ---------------------------- |
| `app.json` / `package.json` 的版本号            | 换成 `A.B.C`                 |
| `ios/`、`android/` 下的生成产物（已 gitignore） | 忽略，由 prebuild 重生成     |
| `src/legal/licenses.json` 里的包版本            | 保留（依赖版本，非应用版本） |
| 测试夹具里的旧号比较 / 解析示例                 | 保留                         |
| 文档里描述历史版本的句子                        | 保留                         |

提交前断言（任一命中都要补改）：

```bash
git grep -n --fixed-strings "X.Y.Z" -- app.json package.json
```

**依赖变更连带的许可清单：**

```bash
git diff --name-only {last_tag}..HEAD -- package.json pnpm-lock.yaml
```

非空 → `pnpm run licenses`，若 `{LICENSES_FILE}` 有变化则随本次 PR 一起提交。

**不要手改原生构建号。** `versionCode` 由 workflow 按 `VERSION_CODE_BASE + github.run_number` 注入（见 `{WORKFLOW_FILE}`），所以 `app.json` 里不要写死 `android.versionCode`；`eas.json` 的 `appVersionSource: remote` / `autoIncrement` 现在不起作用，也不用管。不要新增 `runtimeVersion` / OTA channel。

### 步骤 4 — 本地质量门（不通过就中止）

按顺序跑，任一步失败即中止（此时还没提交，改完重跑本技能即可）：

```bash
pnpm run check:version
pnpm run lint
pnpm run typecheck
pnpm test --ci --coverage=false
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
  （若动过依赖：`src/legal/licenses.json` 已重建）

## 合并后

- [ ] 在 develop tip 打 `v{version}` tag
- [ ] Release workflow 用 Gradle 构建签名 APK 并挂到 GitHub Release（iOS 暂不构建）
- [ ] 装完在 Me → Settings → About 确认显示 `{version} (versionCode)`
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
   期望顺序：`Tag matches version, gates pass` → `Android release APK`。首次构建要下 NDK 与依赖，20~40 分钟属正常（job 上限 60 分钟）。
2. 失败处理，按原因分两类：
   - **环境 / 凭证类**（keystore secret 缺失或密码错、Gradle / NDK 下载失败、网络）→ 补齐后重跑同一次运行：
     ```bash
     gh run rerun {id} --failed
     ```
   - **代码类**（verify 的 lint / typecheck / test / 版本门，或 Gradle 编译报错）→ **不要**重跑，也不要删 tag 重推；
     修完按新版本号走一遍完整流程（tag 已发出，那个号作废）。
   ```bash
   gh run view {id} --log-failed | tail -50   # 先看失败原因再决定
   ```
3. 取产物（workflow 已把 APK 挂到 Release，同时在 run artifact 里留 30 天）：
   ```bash
   gh release view {TAG_PREFIX}{version} --json body -q .body   # 含 versionCode 与 SHA-256
   gh release download {TAG_PREFIX}{version} --pattern '*.apk'
   shasum -a 256 *.apk                                         # 必须与 notes 里的值一致
   ```
4. 分发前校验签名：
   ```bash
   apksigner verify --print-certs octopbot-{version}-android.apk
   ```
   CN 为 `Android Debug` 或别名 `androiddebugkey` → 拒绝分发（正常情况下 workflow 已经拦过一次）。
5. 交付与说明：`adb install -r octopbot-{version}-android.apk`；包内只有 `arm64-v8a` + `armeabi-v7a`，x86 模拟器装不上。
6. **iOS 本次不构建**：除模拟器外，任何 iOS 用途都需要 Apple Developer 账号（$99/年）。用户明确要上 iOS 时，再定走 EAS（省证书管理）还是本地 Xcode archive。
7. **提交商店只在用户明确要求时**，且 workflow 不做 submit——Android 需自行用 Play Console 上传，iOS 同理（前提是先有 Apple 账号）。

### 步骤 9 — 收尾汇报

1. 删除 chore 分支（PR 已合，可安全删）：
   ```bash
   git branch -D {WORK_BRANCH_PREFIX}{version}
   git push {REMOTE} --delete {WORK_BRANCH_PREFIX}{version}
   ```
   失败仅警告（非致命），给出手动命令。
2. 留在 `{BRANCH}`（步骤 6 已切回），汇报：

- 版本 `X.Y.Z → A.B.C`、PR 链接、squash 后的 commit、tag、GitHub Release 链接
- Release workflow 的 run 链接、两个 job 的结论、APK 附件、`versionCode`、SHA-256
- "装完去 `Me → Settings → About` 确认显示 `{version} ({versionCode})`"
- 未做的项（E2E / iOS / submit）明确列出，不要默认它们做过

## 错误处理参考

| 场景                                           | 行为                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| 当前不在 `develop`                             | 中止，提示切分支                                                  |
| 本地落后                                       | `git pull --ff-only` 后重判                                       |
| 本地与远端分叉（squash 造成的假分叉最常见）    | 中止：先解决分叉，不要在分叉点发版                                |
| 本地领先（有未推提交）                         | 允许，但确认块里必须公示这些提交                                  |
| 工作树不干净                                   | 中止：先提交或 stash                                              |
| `app.json` 与 `package.json` 版本不一致        | 中止：先修 `check:version`                                        |
| 目标版本 ≤ 当前版本，或 tag 已存在             | 中止：换一个更大的版本号                                          |
| `app.json` 里 `"version"` 命中多于 1 行        | 中止并展示命中行                                                  |
| 依赖有变更但许可清单未更新                     | 中止：`pnpm run licenses` 后一并提交                              |
| `check:version` / lint / typecheck / test 失败 | 中止（尚未提交）                                                  |
| Maestro 失败                                   | 中止（尚未提交）                                                  |
| 推送 chore 分支失败                            | 中止并给出手动命令，禁止强推                                      |
| PR 目标分支被错写成别的分支                    | 中止，重建 PR（必须 base `develop`）                              |
| PR 的 CI 红                                    | 中止：不合入、不打 tag                                            |
| 分支保护拦住 squash merge                      | 中止，让用户手动合，不绕过保护                                    |
| 合入后 develop tip 版本号不是目标版本          | 中止：不打 tag，先排查 squash 前的基线                            |
| tag 已存在                                     | 中止并给删除指令                                                  |
| `ANDROID_KEYSTORE_*` secret 缺失或密码错       | 中止（步骤 1 的前置检查），补齐后重来                             |
| tag 推了但 workflow 没跑                       | `gh workflow list` 检查 `{WORKFLOW_NAME}` 是否存在、tag 是否 `v*` |
| workflow 的 verify job 失败（代码 / 版本门）   | 不重跑、不删 tag；修完换新版本号重走流程                          |
| workflow 的 build job 失败（凭证 / Gradle 侧） | 环境类才 `gh run rerun {id} --failed`；编译错按代码类处理         |
| APK 没挂到 Release                             | 看 build job 末尾的 `gh release upload` 步骤日志                  |
| APK 是 debug 签名                              | 拒绝分发                                                          |

## 红线规则

**绝不：**

- 直接 `git commit` 到 `develop` 改版本号——版本改动必须走 chore 分支 + PR
- 在版本号未升到目标值的 commit 上打 tag
- 手改 `versionCode`，或在 `app.json` 里写死它、引入 `runtimeVersion` / OTA channel
- 把 keystore、密码或它的 base64 提交进仓库、写进 workflow 文件或日志
- 质量门或 PR checks 未过就合入、就打 tag
- `--no-verify` 绕过钩子、`--force` 推分支、绕过分支保护
- 未经用户明确要求就提交商店，或代为登录 / 操作凭证
- 本地跑 Gradle 或 `eas build` 打正式包绕开 `{WORKFLOW_FILE}`——构建只有 Actions 一条路
- 删掉 tag 重推同一个版本号来"重试"；代码类失败一律换新号
- 分发 debug 签名 APK 或本地 `prebuild` 出来的包
- 跳过步骤 1 的版本确认、步骤 6 的合入确认
- 任何步骤失败后继续往下（分支清理与 workflow 失败处理除外）
- 在 `develop` 之外的 commit 上打发版 tag

**始终：**

- 版本 PR 的 base 是 `{BRANCH}`、head 是 `{WORK_BRANCH_PREFIX}{version}`，标题 `chore(release): {version}`，squash 合入
- 一次提交里同时升级 `app.json` 和 `package.json` 的版本号，`check:version` 必过（`pnpm-lock.yaml` 不记录根版本，不用动）
- 依赖有变动就重建 `src/legal/licenses.json`
- 合入后先复核 `develop` tip 的版本号，再打 tag，再等 workflow
- `versionCode` 交给 workflow 注入；发完删掉 chore 分支
- 汇报如实写明 run 结论、APK 位置与省略项（iOS / submit / E2E）

## 配置

需要覆盖默认值时在此追加（其余走内置默认）：

```yaml
# 示例
# VERSION_CODE_BASE: 100     # 换仓库 / 重建 workflow 后，抬高基数避免 versionCode 回退
# MERGE_METHOD: merge        # 若想保留分支历史，改成 merge commit
# WORK_BRANCH_PREFIX: chore/release-
```
