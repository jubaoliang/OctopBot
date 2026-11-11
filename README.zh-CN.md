<div align="center">

<img src="docs/design/screenshots/chat-home.png" alt="OctopBot 聊天首页" width="220" />

# OctopBot

**[Octop](https://github.com/TencentCloud/Octop) 官方移动客户端** —— 自托管的多用户 AI 助手平台。

[English](README.md) | 简体中文

</div>

---

## 功能特性

- **流式对话** —— WebSocket 实时流式回复，Markdown 实时渲染（加粗、列表、代码块），工具调用摘要，流式光标在残缺 Markdown 中依然稳定。
- **多专家名册** —— 展示服务器上的每一个专家，带各自的图标与品牌色；一键开启对话。
- **会话历史** —— 按专家分组的线程树收纳在侧边抽屉；打开任意历史会话即可原位回放。
- **自动化** —— 按专家管理 cron 任务，开关即时生效。
- **原生平台质感** —— iOS 26+ 液态玻璃（Liquid Glass）底部导航，Android 标准 Material 导航，全面适配安全区。
- **主题系统** —— 亮/暗模式与多套强调色；默认遵循设计语言：纯黑白墨色。
- **双语界面** —— 完整的中文与英文。

## 平台状态

| 平台      | 状态                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| iOS       | ✅ 积极开发中                                                                                                        |
| Android   | ✅ 积极开发中                                                                                                        |
| HarmonyOS | 🔜 计划通过 [expo-harmony](https://github.com/renbaoshuo/expo-harmony)（社区 RNOH 工具链）在同一份 JS 代码上快速跟进 |

## 快速开始

环境要求：Node 20+、npm，以及 Xcode（iOS 模拟器）或 Android Studio（模拟器）。

```bash
git clone https://github.com/jubaoliang/OctopBot.git
cd OctopBot
npm install

# 构建并运行开发客户端（首次运行会编译原生工程）
npm run ios        # 或：npm run android
```

应用连接**你自己的 Octop 服务器**：在登录页输入服务器地址（例如 `https://octop.example.com`）与用户名、密码。不内置任何地址与凭据 —— 服务器地址与会话令牌只保存在设备安全存储中。

## 常用脚本

| 命令                              | 用途                     |
| --------------------------------- | ------------------------ |
| `npm start`                       | 启动 Metro               |
| `npm run ios` / `npm run android` | 构建 + 启动开发客户端    |
| `npm run lint`                    | ESLint（严格、类型感知） |
| `npm run typecheck`               | TypeScript 检查          |
| `npm test`                        | Jest 单元测试            |
| `npm run format`                  | Prettier 格式化          |

## 测试

- **单元测试**（`npm test`）：解析器、格式化器、API 客户端、聊天 Socket 契约 —— 48+ 用例。
- **集成测试**（可选）：多专家 × 多会话场景，用应用自身的 API/WebSocket 客户端直连真实 Octop 服务器：

  ```bash
  OCTOP_E2E_URL=https://octop.example.com \
  OCTOP_E2E_USER=alice \
  OCTOP_E2E_PW=secret \
  npx jest integration.scenario
  ```

- **端到端**（[Maestro](https://docs.maestro.dev/)）：用例位于 `.maestro/`，`maestro test .maestro/` 针对开发客户端运行。

## 项目结构

```
src/
  app/          # expo-router 页面
  components/   # 共享 UI（标签栏、抽屉、Markdown 气泡、头像）
  core/         # 纯 TypeScript：API 客户端、聊天 WebSocket、类型
  features/     # 认证、应用外壳
  platform/     # 平台能力封装（玻璃效果、安全存储）
  i18n/         # 中英文案
  theme/        # 设计令牌、色板、主题提供者
  utils/        # 流式 Markdown 平衡器等工具
```

`src/core` 不包含任何 `react-native` 导入 —— 业务核心可移植到任意 JS 运行时，这也是未来 HarmonyOS 外壳的通路。

## 参与贡献

遵循 Conventional Commits；`lint`、`typecheck`、`test` 三道门禁必须全部通过；每个 PR 只做一件事。交互式提交：`npm run commit`。

## 许可证

[MIT](LICENSE)
