#!/usr/bin/env bash
set -euo pipefail
umask 077

operation=${1:?Specify apply or destroy}
shift
case "$operation" in
  apply|destroy) ;;
  *) printf 'Expected apply or destroy\n' >&2; exit 2 ;;
esac

: "${GITHUB_OUTPUT:?}"
events=$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/opentofu-events.XXXXXX")
trap 'rm -f "$events"' EXIT

status=0
tofu "$operation" -json-into="$events" "$@" || status=$?

# Only publish resource types, names, known actions and counts. Provider IDs,
# instance keys, diagnostic text and output values can contain sensitive data.
if ! excerpt=$(jq -r '
  def identifier: type == "string" and test("^[A-Za-z0-9_-]{1,80}$");
  if .type == "change_summary" then
    .changes
    | select(.operation | IN("apply", "destroy"))
    | select([.add, .change, .remove] | all(type == "number"))
    | "Resources: \(.add) added, \(.change) changed, \(.remove) destroyed."
  elif (.type | IN("apply_start", "apply_complete", "apply_errored")) then
    (.type | ltrimstr("apply_")) as $event
    | .hook
    | select(.resource.resource_type | identifier)
    | select(.resource.resource_name | identifier)
    | select(.action | IN("noop", "create", "read", "update", "replace", "delete"))
    | "\(.resource.resource_type).\(.resource.resource_name): \(.action) \($event)"
  else empty
  end
' "$events" 2>/dev/null | tail -n 80); then
  excerpt='Operation events unavailable. See the Actions log.'
fi

{
  printf 'log<<TOFU_LOG\n'
  printf 'tofu %s\n' "$operation"
  if [[ -n "$excerpt" ]]; then printf '%s\n' "$excerpt"; fi
  printf 'Exit status: %d\nTOFU_LOG\n' "$status"
} >> "$GITHUB_OUTPUT"
exit "$status"
