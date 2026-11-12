<div align="center">

<img src="docs/design/screenshots/chat-home.png" alt="Chat home" width="200" />
<img src="docs/design/screenshots/main-chat.png" alt="Streaming chat" width="200" />
<img src="docs/design/screenshots/sidebar-1.png" alt="Task tree drawer" width="200" />

# OctopBot

**The official mobile client for [Octop](https://github.com/TencentCloud/Octop)** — a smarter, self-hosted AI assistant: multi-user, multi-agent.

English | [简体中文](README.zh-CN.md)

_Preview images are design frames; real-app screenshots land as the UI passes final polish._

</div>

---

## ✨ Highlights

- **Chat-first companion** for your self-hosted Octop server: streaming conversations with every expert you run, wherever the server is.
- **Contract-first** — the app speaks the server's documented HTTP + WebSocket API (pinned in [`docs/api-contract.md`](docs/api-contract.md)); no scraping, no private endpoints.
- **Portable core** — all business logic (API clients, chat socket, state) is pure TypeScript with zero `react-native` imports, ready for additional platforms.
- **Self-hosted only** — no cloud backend, no telemetry, no bundled credentials: your server URL and session live in the device secure store.

## 🤔 Features

| Area       | What you get                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chat       | Real-time streaming over WebSocket, live Markdown rendering (code blocks, lists, quotes), tool-call summaries, mid-turn stop |
| Experts    | Full roster with per-expert icon & brand color; start any conversation in one tap                                            |
| History    | Threads grouped per expert in the drawer; opening one replays it in place                                                    |
| Automation | Cron jobs per expert with instant enable/disable toggles                                                                     |
| Theming    | Light/dark + accent palettes; the default is the design language: monochrome ink                                             |
| Platform   | Liquid Glass tab bar on iOS 26+, Material navigation on Android, safe-area aware everywhere                                  |
| i18n       | Full Chinese and English UI                                                                                                  |

## 🧭 Roadmap

- ✅ Shipped: streaming chat, expert roster, thread history, cron automation, bilingual UI, theming
- 🔨 In progress: message actions (copy / regenerate), knowledge-base browsing, Release builds
- 🔜 Planned: push notifications (proactive care), expert hub install, HarmonyOS via [expo-harmony](https://github.com/renbaoshuo/expo-harmony) on the same JS codebase

## 🚀 Quick start

**1. Run an Octop server** (if you don't have one yet) — see the [Octop quick start](https://github.com/TencentCloud/Octop#-quick-start): install, `octop init`, `octop run`.

**2. Build and launch the app** (Node 20+, Xcode or Android Studio):

```bash
git clone https://github.com/jubaoliang/OctopBot.git
cd OctopBot
npm install
npm run ios        # or: npm run android — first run compiles the native project
```

**3. Sign in** — enter your server URL (for example `https://octop.example.com`), username, and password. LAN HTTP servers are supported with a one-time warning; certificate validation is never bypassed.

## 🏗️ Tech stack

| Layer            | Technology                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Framework        | Expo SDK 58, React Native 0.88, expo-router                                              |
| Language         | TypeScript 6 (strict), React Compiler                                                    |
| Motion           | Reanimated 4 + worklets, Gesture Handler                                                 |
| Native surface   | expo-glass-effect (iOS 26 Liquid Glass), expo-blur fallback, expo-secure-store           |
| Backend contract | REST + WebSocket per [`docs/api-contract.md`](docs/api-contract.md) (server Octop 1.0.x) |
| Tests            | Jest + jest-expo, Maestro E2E                                                            |
| Quality gates    | ESLint (strict, type-checked), Prettier, commitlint + Conventional Commits               |

## 🧪 Testing

- **Unit** (`npm test`) — parsers, formatters, API clients, chat-socket handshake contract.
- **Integration** (opt-in) — multi-expert × multi-thread scenario against a real server, exercising the app's own clients end to end:

  ```bash
  OCTOP_E2E_URL=https://octop.example.com \
  OCTOP_E2E_USER=alice OCTOP_E2E_PW=secret \
  npx jest integration.scenario
  ```

- **E2E** ([Maestro](https://docs.maestro.dev/)) — user-journey flows in `.maestro/`: `maestro test .maestro/`.

## 📦 Release builds

Store releases use [EAS Build](https://docs.expo.dev/build/introduction/) profiles in [`eas.json`](eas.json) (`development` / `preview` / `production`). Credentials stay on EAS or in CI secrets — never commit keystores or passwords. Before any Play upload, verify the artifact is **not** debug-signed:

```bash
apksigner verify --print-certs path/to/app.apk
# Reject if the certificate CN is Android Debug or the alias is androiddebugkey.
```

Local `android/` trees from `expo prebuild` may still default release to the debug keystore; do not distribute those APKs.

## 📁 Project layout

```
src/
  app/          # expo-router screens
  components/   # shared UI (glass tab bar, drawer, markdown turns, avatars)
  core/         # pure TS: API clients, chat WebSocket, contract types
  features/     # auth, app shell
  platform/     # per-platform capability wrappers (glass, secure storage)
  i18n/ theme/  # zh/en strings; design tokens, palettes
docs/           # pinned API contract + design snapshots
.maestro/       # E2E flows
```

## 🔒 Security & privacy

The app is a thin client to **your** server: no telemetry, no analytics, no third-party network calls. The session token and server URL are stored in the OS secure store (Keychain / Keystore), requests never log credentials, and sliding token renewal is transparent. The same policy applies to this repository: no secrets, personal data, or machine-identifying content in code, docs, or commits.

## 🤝 Contributing

Conventional Commits; `lint`, `typecheck`, and `test` gates must pass; one logical change per PR. Interactive commit authoring: `npm run commit`. For server-side feature discussions, join the [Octop community](https://github.com/TencentCloud/Octop#-community).

## 📄 License

[MIT](LICENSE)
