#!/usr/bin/env bash
set -euo pipefail

: "${PREVIEW_ORIGIN:?Set the HTTPS origin of this preview}"
: "${GCS_BUCKET:?Set the image bucket of this preview}"
[[ "$PREVIEW_ORIGIN" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]]
pgdata=$(mktemp -d)
api_pid=''
metro_pid=''
ready_pid=''
proxy_pid=''
stop() {
  for child in "$proxy_pid" "$ready_pid" "$metro_pid" "$api_pid"; do
    if [[ -n "$child" ]]; then
      kill "$child" 2>/dev/null || true
    fi
  done
  pg_ctl -D "$pgdata" -m fast -w stop >/dev/null 2>&1 || true
}
trap stop EXIT
trap 'exit 0' TERM INT

initdb -D "$pgdata" -U nuri_preview --auth=trust --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$pgdata" -l /tmp/nuri-postgres.log -o '-h 127.0.0.1 -k /tmp' -w start >/dev/null
createdb -h 127.0.0.1 -U nuri_preview nuri_preview
export DATABASE_URL=postgresql://nuri_preview@127.0.0.1/nuri_preview
export BETTER_AUTH_URL="$PREVIEW_ORIGIN"
BETTER_AUTH_SECRET=$(node -p 'require("node:crypto").randomBytes(32).toString("hex")')
export BETTER_AUTH_SECRET
(
  cd apps/api
  node dist/db/migrate.js
  NODE_ENV=development AUTH_EMULATE=true GOOGLE_EMULATOR_URL=http://127.0.0.1:4002 \
    APPLE_EMULATOR_URL=http://127.0.0.1:4004 RESEND_API_URL=http://127.0.0.1:4005 \
    node dist/seed.js
)

qrencode -t SVG -o /tmp/nuri-preview-qr.svg "exps://${PREVIEW_ORIGIN#https://}"
(
  cd apps/api
  NODE_ENV=production PORT=8081 EXPO_WEB_ROOT=/app/apps/mobile/dist exec node dist/index.js
) &
api_pid=$!
(
  cd apps/mobile
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_METRO_LAZY=1 EXPO_PUBLIC_API_URL="$PREVIEW_ORIGIN" \
    EXPO_PACKAGER_PROXY_URL="$PREVIEW_ORIGIN" \
    exec node /app/node_modules/expo/bin/cli start --go --offline --port 8082 --no-dev --minify --max-workers 2
) &
metro_pid=$!

# Cloud Run のスタートアッププローブには、Hono と Metro の準備後に応答する。
node /app/scripts/preview-ready.ts &
ready_pid=$!
if ! wait -n -p exited "$ready_pid" "$api_pid" "$metro_pid" || [[ "$exited" != "$ready_pid" ]]; then
  echo 'Preview dependencies did not start' >&2
  exit 1
fi
ready_pid=''

nginx -c /app/scripts/preview-nginx.conf -g 'daemon off;' &
proxy_pid=$!
wait -n "$api_pid" "$metro_pid" "$proxy_pid"
