# nuri 作業の入口

- 最初に[アプリ概要](docs/overview.md)を読み、技術候補と検証済みの事実を区別する。
- このリポジトリは[Expo + Hono + OpenTofu starter](https://github.com/ReoHakase/expo-hono-opentofu-starter)を取り込んだもの。アプリのコードはまだスターターのSNSサンプルで、nuriの画面へ順に置き換える。
- 画面のデザインはFigmaの「Plan A」を正とする。色・文字はFigmaのFoundationsに従う。
- 最初の技術検証はP1（端末上の顔追跡）とP2（顔に合う範囲の重ね表示）を優先する。
- 顔の映像をサーバーへ送らない。写真の送信は利用者が保存・投稿を明示的に選んだ場合に限る。
- SNS取り込みの取得方法と権利条件を未決事項として扱い、確認前に自動取得を完成扱いにしない。
- 変更後は関連する検査を実行し、実測結果・未検証項目・残るリスクを分けて報告する。
- 以下のスターター由来の規約とnuriの方針が食い違うとき（製品の説明、ブランド色など）は、nuriの方針を優先する。

# スターター由来の規約

## Product and platform contract

- This is a Japanese consumer SNS sample named expo-hono-opentofu-starter, backed by an independently deployed Hono API. There is no organization feature.
- **主にiOS向けにUXを最適化するが、Androidでも全機能が動作する必要がある。** iOSの典型的なアプリとして、Native Tabs、Stack、標準の戻る操作、シート、設定フォーム、Dynamic Type、ダークモードを優先する。Androidでは同じ機能をMaterialのネイティブUIと戻る操作で提供する。
- Use universal `@expo/ui` first for settings and platform controls. Main social features use an X-style custom timeline/composer with React Native Reusables and Uniwind; navigation stays native. Isolate iOS-only imports in platform files and provide working Android equivalents. Every icon needs an Android source. Every enabled control must perform its advertised behavior.
- For intentionally custom UI, use the local React Native Reusables components with Uniwind; follow [docs/ui.md](docs/ui.md). Native controls keep their OS appearance. Custom UI uses the neutral light/dark tokens in `apps/mobile/global.css`; do not copy these tokens into a second JS palette.
- The sample must work without Google Cloud credentials using local PostgreSQL and Vercel Emulate. Posts and likes are server data; appearance and haptic preferences are device-local. Seed is development-only, idempotent and must preserve user-created data.
- Use functional Japanese labels without punctuation in headings. Do not invent a brand or accent color. Use official Apple/Google login artwork, native symbols with Android sources, scalable text and minimum 48pt/dp custom touch targets. Separate account information from navigation/actions.
- Inspect the actual native screen after UI changes. Keep safe-area and keyboard insets in loading/error/empty states too. Like mutations use TanStack Query optimistic cache updates scoped to the post, with rollback and stable references for unchanged rows; never refetch the whole feed or disable all rows for one like. Profile is a user object with its own summary/actions and post collection. Mutations must not enable pull-to-refresh; only a user pull controls that animation. Sheets start at a content-appropriate detent.
- Decision history: [Expo技術選定検討](chatgpt-conversation://6aec01ec-6938-83e8-94df-24f41ae3ad55). Record implementation decisions and differences in [docs/architecture.md](docs/architecture.md).

## Boundaries

- `apps/mobile/src/app`: Expo Router routes/layouts only. No Expo API Routes. Keep UI and hooks outside `app`.
- `apps/api`: Hono, Better Auth, Drizzle and Google Cloud. Node.js runtime; Bun package manager and server tests.
- `packages/shared`: Zod schemas and pure functions. No native modules, DB clients, secrets or server environment access.
- Mobile may import **only the type** `AppType` from `@starter/api/contract`. Use Hono RPC; never import server runtime code or duplicate API response types.
- Validate external input with Zod. Better Auth authenticates; protected Hono routes authorize. Store sessions with `expo-secure-store` through `@better-auth/expo`.
- Strict TypeScript: no `any`, unsafe casts or unhandled promises. Reuse library features and existing boundaries; no speculative services or wrappers.

## Issue → branch → PR

- Start every implementation, fix, or documentation/harness change with a GitHub Issue. Read-only investigation may come first; creating the working branch, editing files, and installing dependencies must follow Issue creation or confirmation of an existing Issue.
- Read `github-issue-pr-ops`, check existing Issues/PRs to avoid duplicates, record the goal, acceptance criteria and validation plan, and assign yourself before implementation. Incorporate scope changes into that Issue before continuing dependent work.
- Use **1 implementation Issue → 1 `codex/<issue>-<topic>` branch → 1 PR**. Link the branch to the Issue with `gh issue develop` and reference that Issue in commits and the PR. Keep unrelated work separate.
- An implementation request includes completing this workflow: implement, validate, commit, push and create or update a Draft PR. Do not stop at local edits or ask again whether to create the Issue/PR.
- Keep the PR description aligned with the final diff and latest tested SHA, include evidence and remaining blockers, and use `Closes #<issue>` for the corresponding implementation Issue. Report the Issue and PR links when handing back the work.
- Mark ready or merge only within the user's authorization, after required checks pass. Respect branch protection, and confirm the PR/Issue state after merging; creating a PR is not evidence that it has merged.

## Skills and harness

- Read `.agents/skills/expo-overview/SKILL.md` first for Expo work, then the relevant `expo-ui`, `expo-router`, `expo-native-ui`, `expo-data-fetching`, `eas-workflows` or `eas-update` skill.
- Use `minimum-impl` for code changes, `github-issue-pr-ops` for Issue/PR work and `conventional-commit` for commits. Repository commitlint requires Conventional Commits, with no mandatory Gitmoji or Issue number.
- Verify APIs against installed SDK 58 types and versioned Expo docs. Install native dependencies with `bunx expo install` from `apps/mobile`.
- Add Reusables components from the **Uniwind** registry through the existing `components.json`. Keep source under `apps/mobile/src/components/ui`; preserve its upstream license and adapt it to strict types, scalable text and 48pt/dp native touch targets. Add only dependencies used by the selected components.
- `.codex/config.toml` configures Expo MCP; authenticate with `codex mcp login expo`. Never commit credentials or machine-specific settings.
- Preserve vendored `.agents/skills` and `skills-lock.json`; do not modify them incidentally.

## Development and validation

- Follow [docs/setup.md](docs/setup.md). Local servers require Docker Compose and host Portless 0.16.0 (Node.js 24+). The Linux Dev Container is an optional editor/check environment. Mac/Xcode/Android Studio are optional; use Expo Go or EAS builds for iPhone checks.
- Run `sh scripts/worktree-init.sh` before Compose; `setup` creates missing app env files without overwriting values. Host `bun run dev` wraps `portless compose up --build api metro`. Compose installs dependencies and migrates the isolated DB before API startup; Metro can start alone. Use the shared HTTPS/443 proxy and trust its local CA on the host. Internal API/Metro ports are 8080/8081, Portless assigns loopback host ports, and PostgreSQL stays unpublished. Use `portless compose --profile '*' down` / `services:down` to remove routes and retain volumes. Do not recreate API/Metro with plain `docker compose up`.
- Dev Container starts only the `workspace` editor and its setup/DB dependencies. Run Portless commands on the host; no Docker socket is mounted in the editor. Initial hook installation must be serialized across worktrees because Git hooks are shared; automatic Compose installs skip lifecycle scripts.
- `bun run check`: formatting, type-aware lint, strict typecheck, Bun/Jest tests and Fallow. `bun run test:integration` requires a migrated PostgreSQL database.
- `bun run doctor` and `bun run export:mobile` check Expo dependencies and bundle iOS/Android.
- After changing Uniwind configuration, run `bun run --cwd apps/mobile styles:generate` and commit `uniwind-types.d.ts` with the configuration. Do not edit or format this generated file. The persisted appearance setting drives `Uniwind.setTheme`; do not add a second theme store or competing `Appearance.setColorScheme` calls.
- `tofu fmt -check -recursive infra`, `tofu -chdir=infra init -backend=false`, `tofu -chdir=infra validate`, `tflint --chdir=infra`: credential-free IaC checks. Also validate `infra/bootstrap`.
- Use the lowest sufficient test layer: Bun for server/pure logic, Jest + jest-expo + Testing Library for mobile, Maestro for final native flows. No Vitest or Storybook.
- Exercise loading/error/empty/content states, failure recovery, keyboard access, large text, dark mode, back and sheet dismissal. Bundling is not proof of native runtime behavior; report device checks that could not run.
- Before finishing, run relevant checks, inspect the diff for secrets/generated files, update operational docs and report tested results plus remaining blockers.

## Delivery

- Regular CI needs no GCP or Expo secrets. Deployments are gated until account setup in `docs/setup.md` is complete.
- GCP uses ADC locally and Workload Identity Federation in CI, never long-lived service-account JSON keys. OpenTofu owns resources; Drizzle owns DB schema; CI owns app revisions.
- Keep migrations compatible with the running API. Migrate before switching traffic; publish production Expo Update only after API readiness succeeds.
- Native dependency/config changes require a compatible new build. Use fingerprint runtime versions; never force incompatible OTA updates.
- Do not apply infrastructure, delete persistent data, submit to stores or change production traffic merely to make a check pass.
