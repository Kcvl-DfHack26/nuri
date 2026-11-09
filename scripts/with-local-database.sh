#!/bin/sh
set -eu

if [ "${1:-}" = --init ]; then
  shift
  DATABASE_URL=$(bun apps/api/src/db/local-cloud-sql.ts --init)
else
  DATABASE_URL=$(bun apps/api/src/db/local-cloud-sql.ts)
fi
export DATABASE_URL
exec "$@"
