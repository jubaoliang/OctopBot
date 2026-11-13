# Contributing to OctopBot

Thanks for helping improve the official mobile client for [Octop](https://github.com/TencentCloud/Octop). This document is the onboarding path for humans and agents; product rules live in [`AGENTS.md`](AGENTS.md).

## Before you start

1. Read [`AGENTS.md`](AGENTS.md) — platform strategy, HIG-first design, `src/platform/` wrappers, no-leakage, and testing gates.
2. Skim [`docs/api-contract.md`](docs/api-contract.md) before touching networking or chat.
3. Prefer cross-platform fixes. Do not add `Platform.OS` outside `src/platform/`.

## Setup

```bash
npm install
npm run ios        # or: npm run android — first run compiles the native project
npm run lint
npm run typecheck
npm test
```

Native modules (speech, audio, image picker, glass, …) require a **dev client rebuild** after plugin / `app.json` changes (`npx expo run:ios` / `run:android`). Expo Go is not the E2E target.

## Workflow

1. One logical change per branch / PR.
2. Keep route files in `src/app/` thin; put screens and helpers in `src/features/`.
3. Pure TypeScript in `src/core/` — no `react-native` imports.
4. UI strings go through i18n (`zh` + `en`); no hardcoded copy.
5. Colors and type sizes come from theme tokens — no inline hex / magic pt sizes in screens.
6. Run `npm run lint`, `npm run typecheck`, and `npm test` before you push. Features that change user journeys also need a Maestro flow under `.maestro/` (Android is the E2E baseline; see Testing in `AGENTS.md`).

## Commits

Conventional Commits only (commitlint + husky). Prefer interactive authoring:

```bash
npm run commit
```

`pre-commit` runs lint-staged (eslint --fix + prettier on staged files). Do not use `--no-verify`.

## App versioning

Keep the marketing version in sync — one number, two files:

| Field          | File           | Role                                           |
| -------------- | -------------- | ---------------------------------------------- |
| `expo.version` | `app.json`     | Source of truth shown to users / store listing |
| `version`      | `package.json` | Must equal `expo.version`                      |

Native build numbers (iOS `CFBundleVersion` / Android `versionCode`) are **not** hand-edited in the repo. EAS production uses `appVersionSource: "remote"` and `autoIncrement: true` in `eas.json`.

Before a store-facing release:

1. Bump `app.json` → `expo.version` and matching `package.json` `version` in the same commit.
2. Run `npm run check:version` (also a CI gate).
3. Confirm Settings → About → Version shows the new marketing number after a rebuild.

Do not add `runtimeVersion` / OTA channels until `expo-updates` is intentionally enabled.

## Acknowledgements / open-source licenses

Every **production** npm dependency must appear on the in-app Acknowledgements screen (`Me → Settings → Acknowledgements`, backed by `src/legal/licenses.json`).

- Adding, removing, or upgrading a package in `dependencies` (or anything that ships in the app binary) requires regenerating the license inventory:

  ```bash
  npm run licenses
  ```

- Commit the updated `src/legal/licenses.json` in the same PR as the dependency change.
- Dev-only tools (`devDependencies`) do **not** need an Acknowledgements row unless they are somehow bundled into the release artifact.
- Do not hand-edit `licenses.json` to invent entries; always regenerate. The generator strips author / email / URL metadata so personal data never lands in the artifact.

## Security & privacy

No secrets, absolute machine paths, personal data, or identifying logs in code, docs, fixtures, screenshots, or commit messages. Server URL and credentials are user-entered at runtime and live in secure storage — never hardcode them.

## Design

Authority order: Apple HIG → Ardot design file → existing tokens. When in doubt, match Messages / Settings inset-grouped patterns already in the app rather than inventing a third chrome.

## Questions

Server-side behavior and API changes belong in the [Octop](https://github.com/TencentCloud/Octop) repo. Client UX, Expo, and Maestro issues belong here.
