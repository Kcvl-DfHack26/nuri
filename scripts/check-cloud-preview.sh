#!/usr/bin/env bash
set -euo pipefail

endpoint="${1%/}"
public_origin="${2:-$endpoint}"
curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 3 --max-time 20 "$endpoint/ready" >/dev/null
bash scripts/check-expo-web.sh "$endpoint"
curl --fail --silent --show-error "$endpoint/api/recipes?offset=0" | jq -e '.items | length > 0' >/dev/null
curl --fail --silent --show-error "$endpoint/expo-go/qr.svg" | rg '<svg' >/dev/null
for platform in ios android; do
  curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 3 --max-time 20 \
    -H "Expo-Platform: $platform" -H 'Accept: application/expo+json' "$endpoint/" |
    jq -e --arg origin "$public_origin/" '.launchAsset.url | startswith($origin)' >/dev/null
done
