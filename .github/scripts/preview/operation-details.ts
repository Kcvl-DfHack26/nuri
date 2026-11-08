import { $ } from 'bun';

const address = 'google_cloud_run_v2_service.preview';
const serviceName = /^nuri-preview-pr-[1-9]\d{0,8}$/;
const actions = new Set(['no-op', 'create', 'read', 'update', 'delete']);
const hidden = Symbol('hidden');
const scalarFields = [
  ['ingress', 'ingress', /^INGRESS_TRAFFIC_(ALL|INTERNAL_ONLY|INTERNAL_LOAD_BALANCER)$/],
  ['deletion protection', 'deletion_protection', /^true$|^false$/],
  ['default URL disabled', 'default_uri_disabled', /^true$|^false$/],
  ['invoker IAM check disabled', 'invoker_iam_disabled', /^true$|^false$/],
  ['service min instances', 'scaling.0.min_instance_count', /^\d{1,5}$/],
  ['service max instances', 'scaling.0.max_instance_count', /^\d{1,5}$/],
  ['revision min instances', 'template.0.scaling.0.min_instance_count', /^\d{1,5}$/],
  ['revision max instances', 'template.0.scaling.0.max_instance_count', /^\d{1,5}$/],
  ['request timeout', 'template.0.timeout', /^\d{1,4}s$/],
  ['max concurrent requests', 'template.0.max_instance_request_concurrency', /^\d{1,5}$/],
  [
    'runtime service account',
    'template.0.service_account',
    /^nuri-preview-runtime@kcvlb4\.iam\.gserviceaccount\.com$/,
  ],
  [
    'container image',
    'template.0.containers.0.image',
    /^(?:us-docker\.pkg\.dev\/cloudrun\/container\/hello|asia-northeast1-docker\.pkg\.dev\/kcvlb4\/nuri-preview\/pr-[1-9]\d{0,8}(?::[a-f0-9]{40}|@sha256:[a-f0-9]{64}))$/,
  ],
  ['container port', 'template.0.containers.0.ports.0.container_port', /^\d{1,5}$/],
  ['CPU limit', 'template.0.containers.0.resources.0.limits.cpu', /^\d{1,4}(?:\.\d{1,3}|m)?$/],
  ['memory limit', 'template.0.containers.0.resources.0.limits.memory', /^\d{1,5}(?:Mi|Gi)$/],
  ['CPU throttling', 'template.0.containers.0.resources.0.cpu_idle', /^true$|^false$/],
] as const;

function property(value: unknown, key: string): unknown {
  if (value && typeof value === 'object' && Object.hasOwn(value, key)) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function readScalar(value: unknown, path: string, pattern: RegExp, ...masks: unknown[]) {
  for (const key of path.split('.')) {
    if (masks.includes(true)) {
      return hidden;
    }
    value = property(value, key);
    masks = masks.map((mask) => property(mask, key));
  }
  if (masks.includes(true)) {
    return hidden;
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return hidden;
  }
  const text = String(value);
  return pattern.test(text) ? text : hidden;
}

function previewResource(resources: unknown) {
  const entries: unknown[] = Array.isArray(resources) ? resources : [];
  return entries.find((entry) => property(entry, 'address') === address);
}

export function operationDetails(document: unknown, operation: 'apply' | 'destroy') {
  const change = property(previewResource(property(document, 'resource_changes')), 'change');
  const state = previewResource(
    property(property(property(document, 'values'), 'root_module'), 'resources'),
  );
  const before = operation === 'apply' ? property(change, 'before') : property(state, 'values');
  const after = operation === 'apply' ? property(change, 'after') : undefined;
  const beforeSensitive =
    operation === 'apply'
      ? property(change, 'before_sensitive')
      : property(state, 'sensitive_values');
  const afterMasks = [property(change, 'after_sensitive'), property(change, 'after_unknown')];
  const name =
    readScalar(after, 'name', serviceName, ...afterMasks) ??
    readScalar(before, 'name', serviceName, beforeSensitive);
  if (typeof name !== 'string') {
    return [];
  }

  const plannedActions = property(change, 'actions');
  const actionList: unknown[] =
    operation === 'destroy' ? ['delete'] : Array.isArray(plannedActions) ? plannedActions : [];
  const action = actionList
    .filter((item): item is string => typeof item === 'string' && actions.has(item))
    .join(' → ');
  const lines = [
    `Cloud Run service: ${name}`,
    `Resource ID: projects/kcvlb4/locations/asia-northeast1/services/${name}`,
  ];
  if (action) {
    lines.push(`Action: ${action}`);
  }
  const settings = scalarFields.flatMap(([label, path, pattern]) => {
    const previous = readScalar(before, path, pattern, beforeSensitive);
    const next = readScalar(after, path, pattern, ...afterMasks);
    if (previous === next || previous === hidden || next === hidden) {
      return [];
    }
    if (operation === 'destroy') {
      return [`  ${label}: ${previous}`];
    }
    return [`  ${label}: ${previous ?? '—'} → ${next ?? '—'}`];
  });
  if (settings.length) {
    lines.push(
      operation === 'apply' ? '設定差分（適用計画）' : '削除前の state に記録された設定',
      ...settings,
    );
  } else if (action === 'no-op') {
    lines.push('設定の変更なし');
  }
  return lines;
}

export async function readOperationDetails(
  directory: string,
  env: Record<string, string | undefined>,
  plan: string | undefined,
) {
  // show の生 JSON は環境変数や機密属性を含むため、標準出力やコメントへ転送しない。
  const result = await $`tofu -chdir=${directory} show -json ${plan ? [plan] : []}`
    .env(env)
    .quiet()
    .nothrow();
  if (result.exitCode === 0) {
    try {
      return operationDetails(JSON.parse(result.text()), plan ? 'apply' : 'destroy');
    } catch {
      // 補足情報の読み取りに失敗しても OpenTofu の操作は続ける。
    }
  }
  return ['リソース設定を取得できませんでした。Actions の実行ログを確認してください。'];
}
