import { $ } from 'bun';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { checkCloudPreview } from './check';
import {
  hasPreviewService,
  listPreviewStates,
  previewImageBucket,
  removePreviewState,
  runPreviewTofu,
} from './state';

const region = 'asia-northeast1';
const registryHost = `${region}-docker.pkg.dev`;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const runOriginPattern = /^https:\/\/[a-z0-9.-]+\.run\.app$/;

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pullRequestNumber(value: string | undefined): string {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) {
    throw new Error('Invalid pull request number');
  }
  return value;
}

function reportError(error: unknown) {
  console.error(
    error instanceof $.ShellError ? error.stderr.toString().trim() || error.message : error,
  );
}

const repository = required(Bun.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
required(Bun.env.GH_TOKEN, 'GH_TOKEN');
const project = required(Bun.env.PREVIEW_GCP_PROJECT_ID, 'PREVIEW_GCP_PROJECT_ID');
if (project !== 'kcvlb4') {
  throw new Error('Expected the kcvlb4 Google Cloud project');
}
const registry = `${registryHost}/${project}/nuri-preview`;
// kcvlb4 内で、プレビュー用のサービスとレジストリを対象にする。
const shell = $.env({
  ...Bun.env,
  CLOUDSDK_CORE_PROJECT: project,
  CLOUDSDK_RUN_REGION: region,
});

async function pullRequest(pr: string) {
  const fields = '{state, sha: .head.sha, repository: .head.repo.full_name}';
  const result: unknown = await shell`gh api repos/${repository}/pulls/${pr} --jq ${fields}`.json();
  if (!isRecord(result) || (result.state !== 'open' && result.state !== 'closed')) {
    throw new Error(`Unable to read pull request #${pr}`);
  }
  return result;
}

async function serviceStatus(service: string) {
  const result: unknown = await shell`gcloud run services describe ${service} --format=json`.json();
  if (!isRecord(result) || !isRecord(result.status)) {
    throw new Error('Missing Cloud Run status');
  }
  return result.status;
}

function traffic(status: Record<string, unknown>) {
  const trafficEntries: unknown[] = Array.isArray(status.traffic) ? status.traffic : [];
  return trafficEntries.filter(isRecord);
}

function servingRevision(status: Record<string, unknown>) {
  return traffic(status).find((entry) => entry.percent === 100)?.revisionName;
}

type Progress = (line: string) => void;

async function cloudText(command: $.ShellPromise, onFailure: string, progress?: Progress) {
  try {
    return (await command.text()).trim();
  } catch (error) {
    progress?.(onFailure);
    throw error;
  }
}

async function deleteImages(pr: string, keepDigest?: string, progress?: Progress) {
  const images = `${registry}/pr-${pr}`;
  const digests = await cloudText(
    shell`gcloud artifacts docker images list ${images} --filter=${`package=${images}`} --format='value(version)'`,
    'Failed to list Artifact Registry images.',
    progress,
  );
  for (const digest of digests.split('\n')) {
    if (!digestPattern.test(digest) || digest === keepDigest) {
      continue;
    }
    progress?.(`Deleting Artifact Registry image pr-${pr}@${digest}`);
    await shell`gcloud artifacts docker images delete ${`${images}@${digest}`} --delete-tags --quiet`;
  }
}

async function isClosedOwnPullRequest(pr: string) {
  const info = await pullRequest(pr);
  return info.state === 'closed' && info.repository === repository;
}

async function cleanup(pr: string, stateDiscovered = false) {
  if (!(await isClosedOwnPullRequest(pr))) {
    return 0;
  }
  if (!stateDiscovered && !(await listPreviewStates(project, pr)).has(pr)) {
    return 0;
  }

  // PR に投稿するのは固定文と検証済みリソース名だけにし、CLI の診断は Actions ログに残す。
  const log: string[] = [];
  const progress: Progress = (line) => {
    log.push(line);
    console.log(line);
  };
  let destroyExitCode: number | undefined;
  let cleanupExitCode = 0;
  try {
    progress(`Preparing OpenTofu destroy for PR #${pr}`);
    const result = await runPreviewTofu(project, pr, 'destroy', {
      beforeAttempt: () => isClosedOwnPullRequest(pr),
      onAttempt: ({ log, exitCode }) => {
        destroyExitCode = exitCode;
        progress(log);
      },
    });
    if (result === 0) {
      await deleteImages(pr, undefined, progress);
      // リソースやイメージの削除に失敗した場合は、定期 cleanup が再試行できるよう state を残す。
      progress(`Removing OpenTofu state for PR #${pr}`);
      await removePreviewState(project, pr);
    }
  } catch (error) {
    reportError(error);
    cleanupExitCode = error instanceof $.ShellError ? error.exitCode : 1;
  }

  const reportPath = Bun.env.PREVIEW_CLEANUP_REPORTS;
  if (reportPath && destroyExitCode !== undefined) {
    const report = {
      pr: Number(pr),
      log: log.join('\n'),
      exitCode: destroyExitCode,
      ...(cleanupExitCode ? { cleanupExitCode } : {}),
    };
    await appendFile(reportPath, `${JSON.stringify(report)}\n`);
  }
  return destroyExitCode !== undefined && destroyExitCode !== 0 ? destroyExitCode : cleanupExitCode;
}

async function sweep() {
  const pullRequests = await listPreviewStates(project);
  let result = 0;
  for (const pr of [...pullRequests].sort()) {
    try {
      if (await cleanup(pr, true)) {
        result = 1;
      }
    } catch (error) {
      reportError(error);
      result = 1;
    }
  }
  return result;
}

async function previewImageDigest(image: string, source: string) {
  const existingImage =
    await shell`gcloud artifacts docker images describe ${image} --format='value(image_summary.digest)'`
      .quiet()
      .nothrow();
  const existingDigest = existingImage.text().trim();
  if (existingImage.exitCode === 0 && digestPattern.test(existingDigest)) {
    return existingDigest;
  }
  await shell`gcloud auth configure-docker ${registryHost} --quiet`;
  const dockerfile = resolve('apps/api/Dockerfile');
  const previewScripts = resolve('scripts');
  await shell`docker build --target preview --build-context ${`preview-scripts=${previewScripts}`} \
    -f ${dockerfile} -t ${image} ${source}`;
  await shell`docker push ${image}`;
  const digest = (
    await shell`gcloud artifacts docker images describe ${image} --format='value(image_summary.digest)'`.text()
  ).trim();
  if (!digestPattern.test(digest)) {
    throw new Error('Invalid preview image digest');
  }
  return digest;
}

async function previewRecipeDigest() {
  const files = [
    'apps/api/Dockerfile',
    'scripts/preview-start.sh',
    'scripts/preview-ready.ts',
    'scripts/preview-nginx.conf',
  ];
  const contents = await Promise.all(files.map((file) => Bun.file(file).text()));
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(contents)).digest('hex').slice(0, 12);
}

async function validateOpenPullRequest(pr: string, sha: string) {
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Invalid commit SHA');
  }
  const info = await pullRequest(pr);
  if (info.state !== 'open' || info.sha !== sha || info.repository !== repository) {
    throw new Error('Pull request is closed, changed, or from another repository');
  }
}

function tagBindingParent(pr: string) {
  return `//run.googleapis.com/projects/${project}/locations/${region}/services/nuri-preview-pr-${pr}`;
}

function previewTagValue() {
  const value = required(Bun.env.PREVIEW_RUN_TAG_VALUE, 'PREVIEW_RUN_TAG_VALUE');
  if (!/^tagValues\/[0-9]+$/.test(value)) {
    throw new Error('Invalid preview tag value ID');
  }
  return value;
}

async function hasPreviewTag(parent: string, tagValue: string) {
  const token = (await shell`gcloud auth print-access-token`.text()).trim();
  const url = new URL(`https://${region}-cloudresourcemanager.googleapis.com/v3/tagBindings`);
  url.searchParams.set('parent', parent);
  url.searchParams.set('pageSize', '100');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  // タグ付きサービスだけを参照できる権限では、未設定のサービスは 403 になる。
  if (response.status === 403 || response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Could not list preview tag bindings: HTTP ${response.status}`);
  }
  const result: unknown = await response.json();
  return (
    isRecord(result) &&
    Array.isArray(result.tagBindings) &&
    result.tagBindings.some(
      (binding: unknown) => isRecord(binding) && binding.tagValue === tagValue,
    )
  );
}

async function attachPreviewTag(pr: string) {
  const parent = tagBindingParent(pr);
  const tagValue = previewTagValue();
  const created = await shell`gcloud resource-manager tags bindings create \
    --parent=${parent} --tag-value=${tagValue} --location=${region} --quiet`.nothrow();
  if (created.exitCode !== 0 && !created.stderr.toString().includes('ALREADY_EXISTS')) {
    throw new Error('Could not attach the preview tag');
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await hasPreviewTag(parent, tagValue)) {
      console.log(`Confirmed the Resource Manager tag for PR #${pr}`);
      return;
    }
    await Bun.sleep(5_000);
  }
  throw new Error('The preview tag binding is not visible yet');
}

async function inspect(pr: string, sha: string, outputPath: string) {
  await validateOpenPullRequest(pr, sha);
  const tagged =
    (await hasPreviewService(project, pr)) &&
    (await hasPreviewTag(tagBindingParent(pr), previewTagValue()));
  const environment = tagged ? 'preview' : 'preview-create';
  await appendFile(outputPath, `environment=${environment}\n`);
}

async function apply(pr: string, sha: string, outputPath: string) {
  await validateOpenPullRequest(pr, sha);
  const applyExit = await runPreviewTofu(project, pr, 'apply', {
    beforeAttempt: async () => {
      await validateOpenPullRequest(pr, sha);
      return true;
    },
    onAttempt: async ({ log, exitCode }) => {
      await appendFile(outputPath, `tofu_exit=${exitCode}\ntofu_log<<TOFU_LOG\n${log}\nTOFU_LOG\n`);
    },
  });
  if (applyExit === 0 && Bun.env.PREVIEW_CLOUD_ENVIRONMENT === 'preview-create') {
    await attachPreviewTag(pr);
  }
  return applyExit ?? 1;
}

async function publish(pr: string, sha: string, source: string, outputPath: string) {
  await validateOpenPullRequest(pr, sha);
  const service = `nuri-preview-pr-${pr}`;
  const serviceUrl = (
    await shell`gcloud run services describe ${service} --format='value(status.url)'`.text()
  ).trim();
  if (!runOriginPattern.test(serviceUrl)) {
    throw new Error('Invalid Cloud Run service URL');
  }
  const tag = `pr-${pr}`;
  const candidate = 'candidate';
  const origin = serviceUrl;
  const recipeDigest = await previewRecipeDigest();
  const revisionSuffix = `rev-${sha.slice(0, 12)}-${recipeDigest}`;
  const revision = `${service}-${revisionSuffix}`;
  const publicAnnotation = 'value(metadata.annotations."run.googleapis.com/invoker-iam-disabled")';
  const publicAccess = (
    await shell`gcloud run services describe ${service} --format=${publicAnnotation}`.text()
  ).trim();
  if (publicAccess !== 'true' && publicAccess !== 'True') {
    await shell`gcloud run services update ${service} --no-invoker-iam-check --quiet`;
  }
  const image = `${registry}/${tag}:${sha}-${recipeDigest}`;
  const current = servingRevision(await serviceStatus(service));

  let digest: string;
  if (current === revision) {
    const deployedImage = (
      await shell`gcloud run revisions describe ${revision} --format='value(spec.containers[0].image)'`.text()
    ).trim();
    digest = deployedImage.slice(deployedImage.lastIndexOf('@') + 1);
  } else {
    digest = await previewImageDigest(image, source);
    const existingRevision =
      await shell`gcloud run revisions describe ${revision} --format='value(metadata.name)'`
        .quiet()
        .nothrow();
    if (existingRevision.exitCode !== 0) {
      const imageByDigest = `${registry}/${tag}@${digest}`;
      const previewEnv = `PREVIEW_ORIGIN=${origin},GCS_BUCKET=${previewImageBucket(project, pr)}`;
      await shell`gcloud run deploy ${service} \
        --image=${imageByDigest} --revision-suffix=${revisionSuffix} \
        --no-traffic --port=8080 --min-instances=0 --max-instances=1 \
        --cpu=1 --memory=2Gi --cpu-throttling --timeout=180 \
        --set-env-vars=${previewEnv} --quiet`;
    }
    await shell`gcloud run services update-traffic ${service} --update-tags=${`${candidate}=${revision}`} --quiet`;
    try {
      const candidateUrl = traffic(await serviceStatus(service)).find(
        (entry) => entry.tag === candidate,
      )?.url;
      if (typeof candidateUrl !== 'string' || !runOriginPattern.test(candidateUrl)) {
        throw new Error('Invalid Cloud Run candidate URL');
      }
      await checkCloudPreview(candidateUrl, origin);
      const currentPr = await pullRequest(pr);
      if (
        currentPr.state !== 'open' ||
        currentPr.sha !== sha ||
        currentPr.repository !== repository
      ) {
        throw new Error('Pull request closed or changed during deployment');
      }
      await shell`gcloud run services update-traffic ${service} --to-revisions=${`${revision}=100`} --remove-tags=${candidate} --quiet`;
    } catch (error) {
      await shell`gcloud run services update-traffic ${service} --remove-tags=${candidate} --quiet`.nothrow();
      throw error;
    }
  }
  if (!digestPattern.test(digest)) {
    throw new Error('Invalid preview image digest');
  }
  const status = await serviceStatus(service);
  if (servingRevision(status) !== revision) {
    throw new Error('Public preview traffic does not match the deployed revision');
  }

  await deleteImages(pr, digest);
  const createdAt = (
    await shell`gcloud run revisions describe ${revision} --format='value(metadata.creationTimestamp)'`.text()
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(createdAt)) {
    throw new Error('Invalid preview creation timestamp');
  }
  await appendFile(outputPath, `origin=${origin}\ndeployed_at=${createdAt}\n`);
}

const [operation, pr, sha, source] = Bun.argv.slice(2);
const outputPath = required(Bun.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT');
if (operation === 'inspect') {
  await inspect(pullRequestNumber(pr), required(sha, 'SHA'), outputPath);
} else if (operation === 'apply') {
  process.exitCode = await apply(pullRequestNumber(pr), required(sha, 'SHA'), outputPath);
} else if (operation === 'publish') {
  await publish(
    pullRequestNumber(pr),
    required(sha, 'SHA'),
    required(source, 'source path'),
    outputPath,
  );
} else if (operation === 'cleanup') {
  try {
    process.exitCode =
      Bun.env.GITHUB_EVENT_NAME === 'schedule'
        ? await sweep()
        : await cleanup(pullRequestNumber(pr));
  } finally {
    const reportPath = Bun.env.PREVIEW_CLEANUP_REPORTS;
    if (reportPath && Bun.file(reportPath).size > 0) {
      await appendFile(outputPath, 'has_reports=true\n');
    }
  }
} else {
  throw new Error('Expected inspect, apply, publish or cleanup');
}
