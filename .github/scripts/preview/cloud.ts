import { $ } from 'bun';
import { appendFile } from 'node:fs/promises';

import { checkCloudPreview } from './check';

const project = 'kcvlb4';
const region = 'asia-northeast1';
const service = 'nuri-preview';
const registryHost = `${region}-docker.pkg.dev`;
const registry = `${registryHost}/${project}/${service}`;
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
// 本番のプロジェクトやリージョンを操作しないよう、配信先を固定する。
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

async function traffic() {
  const result: unknown = await shell`gcloud run services describe ${service} --format=json`.json();
  if (!isRecord(result) || !isRecord(result.status)) {
    throw new Error('Missing Cloud Run status');
  }
  const trafficEntries: unknown[] = Array.isArray(result.status.traffic)
    ? result.status.traffic
    : [];
  return trafficEntries.filter(isRecord);
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

function revisions(progress?: Progress) {
  return cloudText(
    shell`gcloud run revisions list --service=${service} --format='value(metadata.name)'`,
    'Failed to list Cloud Run revisions.',
    progress,
  );
}

async function deleteUnused(
  pr: string,
  keepRevision?: string,
  keepDigest?: string,
  progress?: Progress,
) {
  const revisionPattern = new RegExp(`^${service}-pr-${pr}-[a-z0-9-]+$`);
  const listedRevisions = await revisions(progress);
  for (const revision of listedRevisions.split('\n')) {
    if (!revisionPattern.test(revision) || revision === keepRevision) {
      continue;
    }
    progress?.(`Deleting Cloud Run revision ${revision}`);
    await shell`gcloud run revisions delete ${revision} --quiet`;
  }

  const images = `${registry}/pr-${pr}`;
  const digests = await cloudText(
    shell`gcloud artifacts docker images list ${images} --format='value(version)'`,
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

async function cleanup(pr: string) {
  if ((await pullRequest(pr)).state !== 'closed') {
    return 0;
  }

  // PR に投稿するのは固定文と検証済みリソース名だけにし、CLI の診断は Actions ログに残す。
  const log: string[] = [];
  const progress: Progress = (line) => {
    log.push(line);
    console.log(line);
  };
  let exitCode = 0;
  try {
    const tag = `pr-${pr}`;
    const tags = (
      await traffic().catch((error: unknown) => {
        progress('Failed to read Cloud Run traffic tags.');
        throw error;
      })
    )
      .map((entry) => entry.tag)
      .filter((entry) => entry === tag || entry === `candidate-${tag}`)
      .join(',');
    if (tags) {
      progress(`Removing Cloud Run tags ${tags}`);
      await shell`gcloud run services update-traffic ${service} --remove-tags=${tags} --quiet`;
    }
    await deleteUnused(pr, undefined, undefined, progress);
  } catch (error) {
    reportError(error);
    exitCode = error instanceof $.ShellError ? error.exitCode : 1;
  }

  const reportPath = Bun.env.PREVIEW_CLEANUP_REPORTS;
  if (reportPath && log.length > 0) {
    const report = { pr: Number(pr), log: log.join('\n'), exitCode };
    await appendFile(reportPath, `${JSON.stringify(report)}\n`);
  }
  return exitCode;
}

async function sweep() {
  const listedRevisions = await revisions();
  const packages =
    await shell`gcloud artifacts packages list --repository=${service} --location=${region} --format='value(name)'`.text();
  const pullRequests = new Set<string>();
  const revisionPattern = new RegExp(`^${service}-pr-([1-9]\\d{0,8})-[a-f0-9]{12}$`, 'gm');
  for (const match of listedRevisions.matchAll(revisionPattern)) {
    if (match[1]) {
      pullRequests.add(match[1]);
    }
  }
  for (const match of packages.matchAll(/\/packages\/pr-([1-9]\d{0,8})$/gm)) {
    if (match[1]) {
      pullRequests.add(match[1]);
    }
  }
  let result = 0;
  for (const pr of [...pullRequests].sort()) {
    try {
      if (await cleanup(pr)) {
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
  await shell`docker build --target preview -f ${`${source}/apps/api/Dockerfile`} -t ${image} ${source}`;
  await shell`docker push ${image}`;
  const digest = (
    await shell`gcloud artifacts docker images describe ${image} --format='value(image_summary.digest)'`.text()
  ).trim();
  if (!digestPattern.test(digest)) {
    throw new Error('Invalid preview image digest');
  }
  return digest;
}

async function publish(pr: string, sha: string, source: string, outputPath: string) {
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Invalid commit SHA');
  }
  const info = await pullRequest(pr);
  if (info.state !== 'open' || info.sha !== sha || info.repository !== repository) {
    throw new Error('Pull request is closed, changed, or from another repository');
  }

  const serviceUrl = (
    await shell`gcloud run services describe ${service} --format='value(status.url)'`.text()
  ).trim();
  if (!runOriginPattern.test(serviceUrl)) {
    throw new Error('Invalid Cloud Run service URL');
  }
  const tag = `pr-${pr}`;
  const candidate = `candidate-${tag}`;
  const origin = `https://${tag}---${serviceUrl.slice('https://'.length)}`;
  const revisionSuffix = `${tag}-${sha.slice(0, 12)}`;
  const revision = `${service}-${revisionSuffix}`;
  const image = `${registry}/${tag}:${sha}`;
  const current = (await traffic()).find((entry) => entry.tag === tag);

  let digest: string;
  if (current?.revisionName === revision) {
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
      const previewEnv = `PREVIEW_ORIGIN=${origin}`;
      await shell`gcloud run deploy ${service} \
        --image=${imageByDigest} --revision-suffix=${revisionSuffix} \
        --no-traffic --port=8080 --min-instances=0 --max-instances=1 \
        --cpu=1 --memory=2Gi --cpu-throttling --timeout=180 \
        --set-env-vars=${previewEnv} --quiet`;
    }
    await shell`gcloud run services update-traffic ${service} --update-tags=${`${candidate}=${revision}`} --quiet`;
    try {
      const candidateUrl = (await traffic()).find((entry) => entry.tag === candidate)?.url;
      if (typeof candidateUrl !== 'string' || !runOriginPattern.test(candidateUrl)) {
        throw new Error('Invalid Cloud Run candidate URL');
      }
      await checkCloudPreview(candidateUrl, origin);
      const currentPr = await pullRequest(pr);
      if (currentPr.state !== 'open' || currentPr.sha !== sha) {
        throw new Error('Pull request closed or changed during deployment');
      }
      await shell`gcloud run services update-traffic ${service} --update-tags=${`${tag}=${revision}`} --remove-tags=${candidate} --quiet`;
    } catch (error) {
      await shell`gcloud run services update-traffic ${service} --remove-tags=${candidate} --quiet`.nothrow();
      throw error;
    }
  }
  if (!digestPattern.test(digest)) {
    throw new Error('Invalid preview image digest');
  }
  const deployed = (await traffic()).find(
    (entry) => entry.tag === tag && entry.revisionName === revision,
  );
  if (deployed?.url !== origin) {
    throw new Error('Public preview URL does not match the deployed revision');
  }

  await deleteUnused(pr, revision, digest);
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
if (operation === 'publish') {
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
  throw new Error('Expected publish or cleanup');
}
