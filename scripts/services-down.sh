#!/bin/sh
set -eu

unset WORKTREE_ROOT WORKTREE_GIT_COMMON_DIR
export PORTLESS_HTTPS=1 PORTLESS_PORT=443

compose() {
  portless compose --profile '*' "$@"
}

config=$(compose config --format json)
project=$(printf '%s\n' "$config" | node --input-type=module --eval '
  import { readFileSync } from "node:fs";
  const { name } = JSON.parse(readFileSync(0, "utf8"));
  if (typeof name !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
    throw new Error("Invalid Compose project name");
  }
  console.log(name);
')

compose stop

# Floci 0.12.0 can shut down its Docker executor before removing the SQL sidecar.
# Stop and remove only containers owned by this project's emulator. Keep the data volumes.
sidecars=$(docker ps -aq \
  --filter 'label=floci_emulator=floci-gcp' \
  --filter "label=floci_namespace=$project" \
  --filter "label=io.floci.project=$project" \
  --filter 'label=io.floci.service=cloudsql')
for sidecar in $sidecars; do
  docker stop "$sidecar"
  docker rm "$sidecar"
done

compose down
