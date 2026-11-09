import { $ } from 'bun';
import { appendFile } from 'node:fs/promises';
import { z } from 'zod';

import { commitSha, getPullRequest, prNumber, repository, requireEnv } from './github';
import { listPreviewStates, removePreviewState, runPreviewTofu } from './state';

const project = z.literal('kcvlb4').parse(Bun.env.PREVIEW_GCP_PROJECT_ID);
const tagId = z.string().regex(/^tagValues\/\d+$/);
const tags = z.object({ tagBindings: z.array(z.object({ tagValue: z.string() })).default([]) });

async function assertOpen(pr: string, sha: string) {
  const info = await getPullRequest(pr);
  if (info.state !== 'open' || info.sha !== sha || info.headRepository !== repository) {
    throw new Error('Pull request is closed, changed, or from another repository');
  }
  return true;
}

function tagParent({
  project,
  region,
  service,
}: {
  project: string;
  region: string;
  service: string;
}) {
  return `//run.googleapis.com/projects/${project}/locations/${region}/services/${service}`;
}

async function hasTag(region: string, parent: string, tag: string) {
  const token = (await $`gcloud auth print-access-token`.text()).trim();
  const url = new URL(`https://${region}-cloudresourcemanager.googleapis.com/v3/tagBindings`);
  url.searchParams.set('parent', parent);
  url.searchParams.set('pageSize', '100');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  // The publisher can only see tagged services.
  if (response.status === 403 || response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Could not list preview tag bindings: HTTP ${response.status}`);
  }
  return tags.parse(await response.json()).tagBindings.some((binding) => binding.tagValue === tag);
}

async function inspect(pr: string, sha: string) {
  await assertOpen(pr, sha);
  const existing = (await listPreviewStates(project, pr)).has(pr);
  const preview = existing ? await runPreviewTofu(project, pr, 'inspect') : undefined;
  const tag = tagId.parse(Bun.env.PREVIEW_RUN_TAG_VALUE);
  const tagged = preview && (await hasTag(preview.target.region, tagParent(preview.target), tag));
  await appendFile(
    requireEnv('GITHUB_OUTPUT'),
    `environment=${tagged ? 'preview' : 'preview-create'}\n`,
  );
}

async function apply(pr: string, sha: string) {
  await assertOpen(pr, sha);
  const result = await runPreviewTofu(project, pr, 'apply', () => assertOpen(pr, sha));
  if (!result?.origin) {
    throw new Error('Missing applied preview origin');
  }
  const { region, service, image_bucket: imageBucket } = result.target;
  if (Bun.env.PREVIEW_CLOUD_ENVIRONMENT === 'preview-create') {
    const parent = tagParent(result.target);
    const tag = tagId.parse(Bun.env.PREVIEW_RUN_TAG_VALUE);
    const created = await $`gcloud resource-manager tags bindings create \
      --parent=${parent} --tag-value=${tag} --location=${region} --quiet`.nothrow();
    if (created.exitCode !== 0 && !created.stderr.toString().includes('ALREADY_EXISTS')) {
      throw new Error('Could not attach the preview tag');
    }
    for (let attempt = 0; !(await hasTag(region, parent, tag)); attempt += 1) {
      if (attempt >= 11) {
        throw new Error('The preview tag binding is not visible yet');
      }
      await Bun.sleep(5000);
    }
  }
  await appendFile(
    requireEnv('GITHUB_OUTPUT'),
    `service=${service}\nregion=${region}\nimage_bucket=${imageBucket}\norigin=${result.origin}\n`,
  );
}

async function closed(pr: string) {
  const info = await getPullRequest(pr);
  return info.state === 'closed' && info.headRepository === repository;
}

async function cleanup(pr?: string) {
  for (const number of [...(await listPreviewStates(project, pr))].sort()) {
    try {
      if (
        (await closed(number)) &&
        (await runPreviewTofu(project, number, 'destroy', () => closed(number)))
      ) {
        await removePreviewState(project, number);
      }
    } catch (error) {
      console.error(`Could not clean up preview #${number}`, error);
      process.exitCode = 1;
    }
  }
}

requireEnv('GH_TOKEN');
const [operation, pr, sha] = Bun.argv.slice(2);
switch (operation) {
  case 'inspect':
    await inspect(prNumber.parse(pr), commitSha.parse(sha));
    break;
  case 'apply':
    await apply(prNumber.parse(pr), commitSha.parse(sha));
    break;
  case 'cleanup':
    await cleanup(Bun.env.GITHUB_EVENT_NAME === 'schedule' ? undefined : prNumber.parse(pr));
    break;
  default:
    throw new Error('Expected preview inspect, apply or cleanup');
}
