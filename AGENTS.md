# OctopBot — Agent Instructions

Official mobile client for [TencentCloud/Octop](https://github.com/TencentCloud/Octop), a self-hosted AI assistant platform. It replaces the earlier separate client project; this repo is the product's mobile app. Built with Expo SDK 58 + React Native + TypeScript (strict) + expo-router, with every native/platform capability isolated behind wrapper modules so each target (Android, iOS, HarmonyOS) plugs in through per-module implementations.

## Platform strategy

- **Cross-platform comes first.** Android, iOS and HarmonyOS are all targets of this one JS codebase, and every decision has to work on all three: prefer the solution that runs everywhere over one that is better on a single platform. A WeChat mini program is an undecided nice-to-have; it cannot run React Native screens, so the only thing it could reuse is the pure-TypeScript core — one more reason to keep logic out of components.
- **Platform-specific polish lives behind `src/platform/` only.** A capability that exists on one platform (Liquid Glass, haptics, …) is exposed through a wrapper interface with a working equivalent or a graceful fallback on every other target. No screen or feature may depend on a single-platform API.
- **HarmonyOS plan (same JS codebase):** use the community [expo-harmony](https://github.com/renbaoshuo/expo-harmony) toolkit — it ports Expo modules (including expo-router) to RNOH, with autolinking, CNG, and a debug→HAP toolchain. It pins an (Expo SDK ↔ RNOH) version pair that lags the latest SDK (SDK 55 + RNOH 0.84 today, SDK 57 + RNOH 0.86 pending), so when HarmonyOS work starts: check its supported pair and align the app's Expo SDK to it. Expo has no official HarmonyOS support; this toolkit is the path.
- **Wrapper hygiene:** Expo/native capabilities (secure storage, image, splash, glass effect, haptics, linking, …) are accessed through interfaces in `src/platform/` rather than imported directly in screens/components, so each target supplies its own implementation mechanically.
- **Library choice:** prefer RN-core APIs (e.g. WebSocket), pure-JS libraries, and libraries with `@react-native-ohos/*` ports. A library with no HarmonyOS path is added only behind a `src/platform/` wrapper with its fallback stated there.
- Business core (API clients, chat WebSocket, state, i18n, utils) stays pure TypeScript — no `react-native` imports.
- **expo-router on HarmonyOS:** a port exists in expo-harmony, so routing should carry over; if the port lags our SDK at integration time, fall back to re-expressing routes in react-navigation. Keep route files thin (exports + wiring) either way.

**Status: design UI live, API wiring next.** Done: strict toolchain (all gates green), pure-TS core (`src/core/`), API contract pinned in `docs/api-contract.md`, and the design UI built from the Ardot file — chat home, thread view, drawer, 4-tab bar, semantic light/dark tokens + accent palettes (`src/theme/`), i18n zh/en, SVG icon pipeline (`assets/icons/`, currentColor). Verified on the Android emulator: `maestro test .maestro/smoke.yaml` 15/15 (twice). Next: wire the chat WebSocket to the thread screen, auth flow, drawer task tree from the API. iOS simulator E2E stays blocked on the upstream AX bug (see Testing).

## Layout & commands

- `src/core/` — pure TypeScript (no `react-native` imports): `api/` (http client, contract types, auth/agents/threads/knowledge/cron/usage modules), `chat/` (ChatSocket with heartbeat + reconnect). `src/platform/` — capability interfaces (secure storage). `src/app/` — expo-router file routes; `src/components/` for shared UI; `assets/` for images/fonts.
- Scripts: `npm start` / `npm run ios` / `npm run android` / `npm run web`, `npm run lint` (eslint, strict), `npm run typecheck`, `npm test` (jest), `npm run format` (prettier), `npm run reset-project` (template helper — never run casually).
- Import aliases (tsconfig paths): `@/*` → `src/*`, `@/assets/*` → `assets/*`. Use them; no deep relative imports.

## Design source of truth

- Design file (Ardot): https://ardot.tencent.com/file/745886345003849 — read via the `ardot` MCP server.
- Screen scope follows the design file. Colors, layout and component anatomy come from the Ardot file, not ad-hoc values. The file covers four frames (chat home, thread, drawer ×2) and defines no shared styles or variables; Me, Experts, Automation and Login are undesigned and follow the same tokens.
- **Metrics follow Apple's Human Interface Guidelines where they differ from the Ardot values** (deliberate divergence): the type ramp in `src/theme/tokens.ts` is the iOS text-style ramp (body 17pt, minimum 11pt) instead of the design's 14–16pt sizes, every touch target is at least 44pt (small glyphs reach it through `hitSlop`), rounded shapes use continuous corners, and settings use the inset-grouped list anatomy. Text sizes come from `typeScale`, never inline numbers.
- Interaction feedback is one system: `PressableScale` / `IconButton` for press states, `src/platform/haptics.ts` for haptics (one per user action, never the only feedback), and Reduce Motion is honored by every animation.

## Hard requirements

1. **iOS bottom navigation uses Apple's Liquid Glass style** (iOS 26 design language). Use `expo-glass-effect` on iOS 26+; fall back to an expo-blur-based approximation on older iOS. Android keeps standard Material bottom navigation per the design.
2. **Strict linting is a gate, not a suggestion.** typescript-eslint (strict-type-checked) + `eslint-config-expo` + prettier. `npm run lint` and `npx tsc --noEmit` must pass before any work is considered done.
3. **No information leakage — guarantee, not guideline.** Nothing user- or machine-identifying may land in any artifact: document, spec, code, comment, commit message, README, config, log line, test fixture, screenshot, or design export. This covers:
   - **Secrets**: API keys, tokens, passwords, credentials, connection strings, private keys — never hardcoded, never in commits, never echoed into logs or error messages. Use environment variables or a git-ignored local config (e.g. `.env.local`); reference secrets by name, not value. Test fixtures and docs use placeholders (`<token>`, `sk-…`). If a secret ever reaches a commit: rotate it first, then purge history.
   - **Absolute paths**: no `/Users/…`, `/home/…`, `C:\…`, machine names, or internal URLs. Use repo-relative paths, `~`/`$HOME`, or placeholders (`<repo-root>`).
   - **Personal data**: names, emails, handles, hardware/OS details, personal workflows, and any user-uploaded content that could identify a person.
   - The app itself follows the same rule at runtime: server base URL and credentials are user-entered and stored in secure storage — never hardcoded, never logged.

## API target

The contract is pinned in `docs/api-contract.md` (Octop **1.0.3b4**, upstream `develop` branch) and mirrored by the types in `src/core/api/types.ts`. When the server releases a new version, re-derive from upstream and update both. The server base URL is user-configured at runtime (self-hosted); never hardcode one.

## Conventions

- TypeScript strict everywhere; no `any` unless justified in a comment explaining why.
- File-based routing via expo-router under `src/app/`.
- i18n: zh + en, no hardcoded UI strings.
- **Charts are drawn with `react-native-svg`, not a chart library**: geometry (scales, ticks, bar rects) is pure TypeScript in `src/utils/bar-chart.ts` with tests, and `src/components/BarChart.tsx` only draws it. ECharts and Swift Charts were considered and rejected (look, and iOS-only respectively). New chart types follow the same split.
- Unit tests (Jest) for parsers/formatters/API clients; E2E via Maestro — see the Testing section. Features are not done until their E2E flow passes.
- **Commits follow Conventional Commits**, enforced by the commit-msg hook (commitlint + `@commitlint/config-conventional`). Author interactive commits with `npm run commit` (commitizen); `pre-commit` runs lint-staged (eslint --fix + prettier on staged files). Hooks are installed by husky via the `prepare` script — they self-heal on every `npm install`.

## Testing

- **Unit (Jest)**: parsers, formatters, API clients, chat socket, i18n, date/encoding edge cases. Every new pure-TS module in `src/core/` ships with tests in a co-located `__tests__/` directory; `npm test` stays green.
- **E2E (Maestro, [docs.maestro.dev](https://docs.maestro.dev/))**: flows live in `.maestro/` as YAML, one file per user journey, named after it (`login.yaml`, `chat-smoke.yaml`, `knowledge-browse.yaml`). Run with `maestro test .maestro/`. E2E is the proof of correctness — drive the real app on an iOS simulator and an Android emulator against a real Octop instance; unit tests only pin what E2E can't reach cheaply.
- **E2E runs against the dev client** (`dev.octop.octopbot`), built with `npx expo run:ios` / `run:android` — not Expo Go (deep links into Expo Go are unreliable for automation).
- **iOS 27 simulator AX bug:** React Native content is missing from the XCUITest accessibility tree (upstream [react-native#57282](https://github.com/facebook/react-native/issues/57282)), so Maestro assertions fail on installed iOS 27.x runtimes even though the app renders. **Android is the E2E baseline** until the upstream fix lands; re-check iOS when RN/Xcode updates arrive.
- On machines where `xcode-select` points at Command Line Tools, export `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` before `simctl`, `xcodebuild`, or `maestro` (Xcode 26's Device Hub manages simulators in the UI; the CLI path is unchanged).
- Minimum flow set before any release: first-launch + login, chat round-trip (send → stream → render → stop), thread management, knowledge browsing, settings + locale switch.
- Maestro targets iOS/Android only. When HarmonyOS lands, its E2E needs an RNOH-side tool — do not assume `.maestro/` flows transfer.
- Maestro CLI (v2.10+) is a machine prerequisite: `brew install maestro` or the official install script if missing.

## Gotchas

- The `ardot` MCP server (design access) requires Tencent SSO on first use; it only connects at session start.
- Reanimated 4 + React Compiler are enabled — animation code must follow worklet rules; don't disable the compiler to work around errors.
