#!/bin/sh
set -eu

unset WORKTREE_ROOT WORKTREE_GIT_COMMON_DIR
export PORTLESS_HTTPS=1 PORTLESS_PORT=443

compose() {
  portless compose --profile '*' "$@"
}

compose_environment=$(compose config --environment)
project=$(printf '%s\n' "$compose_environment" | sed -n 's/^COMPOSE_PROJECT_NAME=//p')
if [ -z "$project" ]; then
  echo 'Compose did not report its project name' >&2
  exit 1
fi

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
