#!/usr/bin/env bash
set -euo pipefail

origin="${1%/}"
html=$(curl --fail --silent --show-error "$origin/")
asset=$(sed -nE 's|.*src="(/_expo/static/[^"]+\.js)".*|\1|p' <<< "$html" | tail -n 1)
test -n "$asset" || { echo 'Expo JavaScript asset is missing from the home page'; exit 1; }
test "$(curl --fail --silent --show-error "$origin/recipes/fox/steps")" = "$html"

content_type=$(curl --fail --silent --show-error -o /dev/null -w '%{content_type}' "$origin$asset")
case "$content_type" in
  *javascript*) ;;
  *) echo "Unexpected Expo JavaScript content type: $content_type"; exit 1 ;;
esac
curl --fail --silent --show-error "$origin/api/auth-capabilities" | jq -e 'type == "object"' >/dev/null

for missing in /api/nonexistent-web-probe /_expo/static/missing.js /about/; do
  test "$(curl --silent --show-error -o /dev/null -w '%{http_code}' "$origin$missing")" = 404
done
echo "Expo Web routes and assets available at $origin"
