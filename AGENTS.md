# Working in this repository

## Product and platform contract

- This is an Expo UI showcase named expo-hono-opentofu-starter, backed by an independently deployed Hono API.
- **主にiOS向けにUXを最適化するが、Androidでも全機能が動作する必要がある。** iOSの典型的なアプリとして、Native Tabs、Stack、標準の戻る操作、シート、設定フォーム、Dynamic Type、ダークモードを優先する。Androidでは同じ機能をMaterialのネイティブUIと戻る操作で提供する。
- Use universal `@expo/ui` first. Isolate iOS-only imports in platform files and provide working Android equivalents. Every icon needs an Android source. Every enabled control must perform its advertised behavior.
- The showcase must work without Google Cloud credentials. Favorites, completion and preferences are device-local; do not imply account synchronization.
- Decision history: [Expo技術選定検討](chatgpt-conversation://6aec01ec-6938-83e8-94df-24f41ae3ad55). Record implementation decisions and differences in [docs/architecture.md](docs/architecture.md).

## Boundaries

- `apps/mobile/src/app`: Expo Router routes/layouts only. No Expo API Routes. Keep UI and hooks outside `app`.
- `apps/api`: Hono, Better Auth, Drizzle and Google Cloud. Node.js runtime; Bun package manager and server tests.
- `packages/shared`: Zod schemas and pure functions. No native modules, DB clients, secrets or server environment access.
- Mobile may import **only the type** `AppType` from `@starter/api/contract`. Use Hono RPC; never import server runtime code or duplicate API response types.
- Validate external input with Zod. Better Auth authenticates; protected Hono routes authorize. Store sessions with `expo-secure-store` through `@better-auth/expo`.
- Strict TypeScript: no `any`, unsafe casts or unhandled promises. Reuse library features and existing boundaries; no speculative services or wrappers.

## Skills and harness

- Read `.agents/skills/expo-overview/SKILL.md` first for Expo work, then the relevant `expo-ui`, `expo-router`, `expo-native-ui`, `expo-data-fetching`, `eas-workflows` or `eas-update` skill.
- Use `minimum-impl` for code changes, `github-issue-pr-ops` for Issue/PR work and `conventional-commit` for commits. Repository commitlint requires Conventional Commits, with no mandatory Gitmoji or Issue number.
- Verify APIs against installed SDK 58 types and versioned Expo docs. Install native dependencies with `bunx expo install` from `apps/mobile`.
- `.codex/config.toml` configures Expo MCP; authenticate with `codex mcp login expo`. Never commit credentials or machine-specific settings.
- Preserve vendored `.agents/skills` and `skills-lock.json`; do not modify them incidentally.

## Development and validation

- Follow [docs/setup.md](docs/setup.md). Local servers require Docker Compose and host Portless 0.16.0 (Node.js 24+). The Linux Dev Container is an optional editor/check environment. Mac/Xcode/Android Studio are optional; use Expo Go or EAS builds for iPhone checks.
- Run `sh scripts/worktree-init.sh` before Compose; `setup` creates missing app env files without overwriting values. Host `bun run dev` wraps `portless compose up --build api metro`. Compose installs dependencies and migrates the isolated DB before API startup; Metro can start alone. Use the shared HTTPS/443 proxy and trust its local CA on the host. Internal API/Metro ports are 8080/8081, Portless assigns loopback host ports, and PostgreSQL stays unpublished. Use `portless compose --profile '*' down` / `services:down` to remove routes and retain volumes. Do not recreate API/Metro with plain `docker compose up`.
- Dev Container starts only the `workspace` editor and its setup/DB dependencies. Run Portless commands on the host; no Docker socket is mounted in the editor. Initial hook installation must be serialized across worktrees because Git hooks are shared; automatic Compose installs skip lifecycle scripts.
- `bun run check`: formatting, type-aware lint, strict typecheck, Bun/Jest tests and Fallow. `bun run test:integration` requires a migrated PostgreSQL database.
- `bun run doctor` and `bun run export:mobile` check Expo dependencies and bundle iOS/Android.
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
