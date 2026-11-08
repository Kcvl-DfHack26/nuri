#!/usr/bin/env bash
set -euo pipefail

# Restrict all mutations to the dedicated preview resources and credential.
: "${GITHUB_REPOSITORY:?}" "${GH_TOKEN:?}"
export CLOUDSDK_CORE_PROJECT=kcvlb4 CLOUDSDK_RUN_REGION=asia-northeast1
service=nuri-preview
region=$CLOUDSDK_RUN_REGION
registry="$region-docker.pkg.dev/$CLOUDSDK_CORE_PROJECT/$service"

check_pr_number() { [[ "$1" =~ ^[1-9][0-9]{0,8}$ ]]; }
pr_info() { gh api "repos/$GITHUB_REPOSITORY/pulls/$1"; }

delete_unused() {
  local pr=$1 keep_revision=$2 keep_digest=$3 revision digest revisions digests
  revisions=$(gcloud run revisions list --service="$service" --format='value(metadata.name)')
  while IFS= read -r revision; do
    if [[ "$revision" == "$service-pr-$pr-"* && "$revision" != "$keep_revision" ]]; then
      gcloud run revisions delete "$revision" --quiet
    fi
  done <<< "$revisions"
  digests=$(gcloud artifacts docker images list "$registry/pr-$pr" --format='value(version)')
  while IFS= read -r digest; do
    if [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ && "$digest" != "$keep_digest" ]]; then
      gcloud artifacts docker images delete "$registry/pr-$pr@$digest" --delete-tags --quiet
    fi
  done <<< "$digests"
}

cleanup() {
  local pr=$1 info tags
  check_pr_number "$pr"
  info=$(pr_info "$pr")
  if ! jq -e '.state == "closed"' >/dev/null <<< "$info"; then return; fi
  tags=$(gcloud run services describe "$service" --format=json |
    jq -r --arg tag "pr-$pr" --arg candidate "candidate-pr-$pr" '[.status.traffic[]?.tag | select(. == $tag or . == $candidate)] | join(",")')
  if [[ -n "$tags" ]]; then
    gcloud run services update-traffic "$service" --remove-tags="$tags" --quiet
  fi
  delete_unused "$pr" '' ''
}

publish() {
  local pr=$1 sha=$2 source=$3 info service_url tag candidate origin revision image digest candidate_url current created_at
  check_pr_number "$pr"
  [[ "$sha" =~ ^[a-f0-9]{40}$ ]]
  info=$(pr_info "$pr")
  jq -e --arg sha "$sha" --arg repo "$GITHUB_REPOSITORY" \
    '.state == "open" and .head.sha == $sha and .head.repo.full_name == $repo' >/dev/null <<< "$info"
  service_url=$(gcloud run services describe "$service" --format='value(status.url)')
  [[ "$service_url" =~ ^https://[a-z0-9.-]+\.run\.app$ ]]
  tag="pr-$pr"
  candidate="candidate-$tag"
  origin="https://$tag---${service_url#https://}"
  revision="$service-$tag-${sha:0:12}"
  image="$registry/$tag:$sha"

  current=$(gcloud run services describe "$service" --format=json |
    jq -r --arg tag "$tag" '.status.traffic[]? | select(.tag == $tag) | .revisionName')
  if [[ "$current" == "$revision" ]]; then
    digest=$(gcloud run revisions describe "$revision" --format='value(spec.containers[0].image)')
    digest=${digest##*@}
  else
    digest=$(gcloud artifacts docker images describe "$image" --format='value(image_summary.digest)' 2>/dev/null || true)
    if [[ ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
      gcloud auth configure-docker "$region-docker.pkg.dev" --quiet
      docker build --target preview -f "$source/apps/api/Dockerfile" -t "$image" "$source"
      docker push "$image"
      digest=$(gcloud artifacts docker images describe "$image" --format='value(image_summary.digest)')
    fi
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
    if ! gcloud run revisions describe "$revision" --format='value(metadata.name)' >/dev/null 2>&1; then
      gcloud run deploy "$service" --image="$registry/$tag@$digest" --revision-suffix="$tag-${sha:0:12}" \
        --no-traffic --port=8080 --min-instances=0 --max-instances=1 --cpu=1 --memory=2Gi --cpu-throttling \
        --timeout=180 --set-env-vars="PREVIEW_ORIGIN=$origin" --quiet
    fi
    gcloud run services update-traffic "$service" --update-tags="$candidate=$revision" --quiet
    trap 'gcloud run services update-traffic "$service" --remove-tags="$candidate" --quiet || true' EXIT
    candidate_url=$(gcloud run services describe "$service" --format=json |
      jq -er --arg tag "$candidate" '.status.traffic[] | select(.tag == $tag) | .url')
    bash scripts/check-cloud-preview.sh "$candidate_url" "$origin"
    info=$(pr_info "$pr")
    jq -e --arg sha "$sha" '.state == "open" and .head.sha == $sha' >/dev/null <<< "$info"
    gcloud run services update-traffic "$service" --update-tags="$tag=$revision" --remove-tags="$candidate" --quiet
    trap - EXIT
  fi
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
  current=$(gcloud run services describe "$service" --format=json |
    jq -er --arg tag "$tag" --arg revision "$revision" '.status.traffic[] | select(.tag == $tag and .revisionName == $revision) | .url')
  [[ "$current" == "$origin" ]]
  delete_unused "$pr" "$revision" "$digest"
  created_at=$(gcloud run revisions describe "$revision" --format='value(metadata.creationTimestamp)')
  [[ "$created_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$ ]]
  printf 'origin=%s\ndeployed_at=%s\n' "$origin" "$created_at" >> "$GITHUB_OUTPUT"
}

case "${1:?}" in
  publish) publish "$2" "$3" "$4" ;;
  cleanup) cleanup "$2" ;;
  sweep)
    # Also catches PRs that closed while targeting a stacked branch.
    revisions=$(gcloud run revisions list --service="$service" --format='value(metadata.name)')
    packages=$(gcloud artifacts packages list --repository="$service" --location="$region" --format='value(name)')
    prs=$({
      sed -nE "s/^$service-pr-([1-9][0-9]{0,8})-[a-f0-9]{12}$/\1/p" <<< "$revisions"
      sed -nE 's|.*/packages/pr-([1-9][0-9]{0,8})$|\1|p' <<< "$packages"
    } | sort -u)
    while IFS= read -r pr; do
      if [[ -n "$pr" ]]; then cleanup "$pr"; fi
    done <<< "$prs"
    ;;
  *) exit 2 ;;
esac
