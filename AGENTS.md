# OctopBot — Agent Instructions

Official mobile client for [TencentCloud/Octop](https://github.com/TencentCloud/Octop), a self-hosted AI assistant platform. It replaces the earlier separate client project; this repo is the product's mobile app. Built with Expo SDK 58 + React Native + TypeScript (strict) + expo-router, with every native/platform capability isolated behind wrapper modules so each target (Android, iOS, HarmonyOS) plugs in through per-module implementations.

## Platform strategy

- **One JS codebase, three targets.** Android, iOS and HarmonyOS share this codebase. Prefer solutions that run everywhere over ones that are better on a single platform. A WeChat mini program is an undecided nice-to-have; it cannot run React Native screens, so the only thing it could reuse is the pure-TypeScript core — one more reason to keep logic out of components.
- **Design language is HIG-first; implementation is cross-platform.** Apple's Human Interface Guidelines set the shared interaction and layout baseline for all targets (see Design source of truth). Do not fork screens into iOS / Android / HarmonyOS variants. Encode HIG metrics and patterns in shared tokens and components; each platform supplies native polish or a graceful fallback only through `src/platform/`.
- **No sticky or hardcoded platform specifics in product UI.** Screens and feature components must not branch on `Platform.OS`, import iOS-/Android-only modules, or hardcode Liquid Glass / Material / Harmony APIs. Platform capabilities (glass, haptics, blur, secure storage, speech, linking, keyboard quirks, …) live behind wrapper interfaces in `src/platform/` with a working equivalent or graceful fallback on every other target. No screen or feature may depend on a single-platform API.
- **`Platform.OS` is allowed only to close real platform gaps — and only inside `src/platform/`.** Tricky OS differences (keyboard avoiding, status-bar/safe-area edge cases, font metrics, nested-scroll bugs, speech/permission APIs, glass availability, …) are legitimate reasons to branch. Put the branch behind a capability interface so screens call one API and get the right behavior or fallback. Do not sprinkle `Platform.OS` through routes, feature screens, or shared UI components; if a gap appears there, extract a wrapper first.
- **HarmonyOS plan (same JS codebase):** use the community [expo-harmony](https://github.com/renbaoshuo/expo-harmony) toolkit — it ports Expo modules (including expo-router) to RNOH, with autolinking, CNG, and a debug→HAP toolchain. It pins an (Expo SDK ↔ RNOH) version pair that lags the latest SDK (SDK 55 + RNOH 0.84 today, SDK 57 + RNOH 0.86 pending), so when HarmonyOS work starts: check its supported pair and align the app's Expo SDK to it. Expo has no official HarmonyOS support; this toolkit is the path.
- **Wrapper hygiene:** Expo/native capabilities (secure storage, image, splash, glass effect, haptics, linking, …) are accessed through interfaces in `src/platform/` rather than imported directly in screens/components, so each target supplies its own implementation mechanically.
- **Library choice:** prefer RN-core APIs (e.g. WebSocket), pure-JS libraries, and libraries with `@react-native-ohos/*` ports. A library with no HarmonyOS path is added only behind a `src/platform/` wrapper with its fallback stated there.
- Business core (API clients, chat WebSocket, state, i18n, utils) stays pure TypeScript — no `react-native` imports.
- **expo-router on HarmonyOS:** a port exists in expo-harmony, so routing should carry over; if the port lags our SDK at integration time, fall back to re-expressing routes in react-navigation. Keep route files thin (exports + wiring) either way.

**Status: chat + hybrid STT wired on Android; polish and E2E next.** Done: strict toolchain, pure-TS core (`src/core/`), API contract in `docs/api-contract.md`, design UI (chat home, thread, drawer, tabs, tokens, i18n, icons), auth + chat WebSocket on the thread screen, markdown (fences with theme-aware highlighting, inline chips, horizontally scrollable tables), hybrid voice input (system speech by default; cloud STT upload when `active.stt` is set; Me chooser when providers exist). **HarmonyOS is postponed** — keep the cross-platform/`src/platform/` rules, but do not start the expo-harmony SDK pin or HAP toolchain until called for. Next: ocr-guarded commits of the in-flight batches, keep Android Maestro green (smoke + chat round-trip), then attachments / FlatList virtualization. iOS simulator E2E stays blocked on the upstream AX bug (see Testing). Store/CI/signing stay separate pipeline work. Native rebuild required after adding `expo-speech-recognition` / `expo-audio` plugins.

## Layout & commands

- `src/core/` — pure TypeScript (no `react-native` imports): `api/` (http client, contract types, auth/agents/threads/knowledge/cron/usage modules), `chat/` (ChatSocket with heartbeat + reconnect). `src/platform/` — capability interfaces (secure storage). `src/app/` — expo-router file routes (**thin wiring only** — screens/helpers live in `src/features/`; never import `@/app/…` from outside `src/app/`, ESLint-enforced); `src/components/` for shared UI; `assets/` for images/fonts. React contexts that providers own (`AppShellContext`, etc.) stay in a tiny dedicated module so Fast Refresh of provider logic cannot recreate the context object.
- Scripts: `npm start` / `npm run ios` / `npm run android` / `npm run web`, `npm run lint` (eslint, strict), `npm run typecheck`, `npm test` (jest), `npm run format` (prettier), `npm run licenses` (regenerate Acknowledgements), `npm run check:version` (package.json ↔ app.json), `npm run reset-project` (template helper — never run casually).
- Import aliases (tsconfig paths): `@/*` → `src/*`, `@/assets/*` → `assets/*`. Use them; no deep relative imports.
- Contributor onboarding: [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Marketing version:** `app.json` → `expo.version` is the source of truth; `package.json` `version` must match (CI: `npm run check:version`). Native build numbers are EAS remote auto-increment (`eas.json`); Settings shows them via `src/platform/app-version.ts`.

## Design source of truth

Authority order (highest first):

1. **Apple Human Interface Guidelines — first institution.** Start from [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios) and the broader HIG. Interaction patterns, ergonomics (thumb reach, gesture back, short sessions), accessibility (Dynamic Type, Reduce Motion, contrast), touch targets (≥44pt), type ramp, navigation chrome, and system-consistent feedback follow HIG even when a mock differs. Apply these as **shared** product rules across Android and HarmonyOS too — not as an iOS-only skin.
2. **Ardot design file** (screen scope / brand anatomy): https://ardot.tencent.com/file/745886345003849 — read via the `ardot` MCP server. Colors, layout and component anatomy for the covered frames come from Ardot, not ad-hoc values. The file covers four frames (chat home, thread, drawer ×2) and defines no shared styles or variables; Me, Experts, Automation and Login are undesigned and follow the same tokens.
3. When Ardot and HIG conflict on metrics or interaction, **HIG wins**. Concrete divergences already encoded: `src/theme/tokens.ts` uses the iOS text-style ramp (body 17pt, minimum 11pt) instead of the design's 14–16pt sizes; every touch target is at least 44pt (small glyphs reach it through `hitSlop`); rounded shapes use continuous corners; settings use inset-grouped list anatomy. Text sizes come from `typeScale`, never inline numbers.

Cross-platform measures (do not hardcode platform APIs in UI):

- Prefer one shared composition that satisfies HIG on every target. Platform-native effects (e.g. Liquid Glass on supported iOS) are opt-in polish behind `src/platform/`, with blur/opaque or equivalent fallbacks elsewhere — never `Platform.OS === 'ios'` (or similar) in screens; confine OS branches to `src/platform/` when a gap has no shared fix.
- Interaction feedback is one system: `PressableScale` / `IconButton` for press states, `src/platform/haptics.ts` for haptics (one per user action, never the only feedback), and Reduce Motion is honored by every animation.
- **Scroll indicators are off by default.** Every `ScrollView` / `FlatList` / `KeyboardAwareScrollView` sets `showsVerticalScrollIndicator={false}` and `showsHorizontalScrollIndicator={false}`. Do not show scrollbars unless a screen or component explicitly needs them — today that exception is markdown tables (`MarkdownTable`): enable horizontal scrolling only when the grid overflows the reading width, wrap cell text (no ellipsis), and allow the horizontal indicator only while scrolling (never persistent).

Color & layout (responsive, token-only):

- **No hardcoded colors.** Screens and components use semantic theme tokens (`useTheme()` / `ThemeTokens` / palette-driven accents). Do not inline hex/rgb/`rgba(...)` (or named CSS colors) in UI code. New colors belong in `src/theme/` first, then consumed by name. Syntax highlighting and other derived palettes resolve from tokens (with documented fallbacks only inside theme modules).
- **No fixed screen guesses.** Do not layout against an assumed device (e.g. iPhone 15 / Pixel frame widths from mocks), freeze absolute positions for a single viewport, or bake in magic numbers that only work at one size. Prefer flex, percentage/`flexGrow`/`flexShrink`, content-driven sizing, safe-area insets, and measured layout (`onLayout` / `useWindowDimensions`) when a breakpoint is truly needed.
- **Responsive by default.** UI must adapt to phones, foldables, tablets, and landscape as far as the shared composition allows: wrap or scroll overflowing content, respect Dynamic Type / text scaling, keep touch targets ≥44pt after scale, and avoid clipped or unreachable controls when the window shrinks or grows.

## Hard requirements

1. **Bottom navigation follows HIG chrome via the platform wrapper.** On iOS 26+, use Liquid Glass (`expo-glass-effect`) through `src/platform/`; older iOS and other targets use the shared blur/opaque fallback from that same wrapper. Do not hardcode Material- or iOS-only tab bars in screens.
2. **Colors and layout are tokenized and responsive.** No hardcoded colors in screens/components; no fixed-screen layout assumptions; compositions must adapt to available size (see Color & layout above).
3. **Strict linting is a gate, not a suggestion.** typescript-eslint (strict-type-checked) + `eslint-config-expo` + prettier. `npm run lint` and `npx tsc --noEmit` must pass before any work is considered done.
4. **No information leakage — guarantee, not guideline.** Nothing user- or machine-identifying may land in any artifact: document, spec, code, comment, commit message, README, config, log line, test fixture, screenshot, or design export. This covers:
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
- **Acknowledgements stay in sync with production dependencies.** The in-app Acknowledgments screen (`src/features/LicensesScreen.tsx`) reads `src/legal/licenses.json`. After any add / remove / upgrade under `dependencies` (or any package that ships in the release binary), run `npm run licenses` and commit the regenerated file in the same change. DevDependencies are excluded unless they are somehow bundled. Never hand-edit the JSON to invent rows; the generator strips personal metadata on purpose.

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
