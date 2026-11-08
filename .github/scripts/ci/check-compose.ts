import { $ } from 'bun';

await $`sh scripts/worktree-init.sh`;
await $`docker compose config --quiet`;
await $`docker compose --profile editor --profile tunnel config --quiet`;
await $`docker compose -f compose.yaml -f compose.go.yaml config --quiet`;
await $`docker compose -f compose.yaml -f compose.devices.yaml config --quiet`;
