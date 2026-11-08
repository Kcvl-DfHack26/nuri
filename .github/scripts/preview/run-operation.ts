import { $ } from 'bun';

type Event = {
  type?: string;
  changes?: { operation?: string; add?: number; change?: number; remove?: number };
  hook?: { resource?: { resource_type?: string; resource_name?: string }; action?: string };
};

function eventLine(event: Event) {
  if (event.type === 'change_summary' && event.changes) {
    const { operation, add, change, remove } = event.changes;
    if (
      (operation === 'apply' || operation === 'destroy') &&
      [add, change, remove].every((count) => Number.isSafeInteger(count))
    ) {
      return `Resources: ${add} added, ${change} changed, ${remove} destroyed.`;
    }
  }

  // リソースのID、インスタンスキー、診断メッセージ、出力値はPRへ転記しない。
  const { resource, action } = event.hook ?? {};
  const type = resource?.resource_type;
  const name = resource?.resource_name;
  const identifier = /^[A-Za-z0-9_-]{1,80}$/;
  if (
    event.type &&
    ['apply_start', 'apply_complete', 'apply_errored'].includes(event.type) &&
    typeof type === 'string' &&
    typeof name === 'string' &&
    identifier.test(type) &&
    identifier.test(name) &&
    action &&
    ['noop', 'create', 'read', 'update', 'replace', 'delete'].includes(action)
  ) {
    return `${type}.${name}: ${action} ${event.type.slice('apply_'.length)}`;
  }
  return null;
}

type Operation = {
  directory: string;
  operation: 'apply' | 'destroy';
  options: string[];
  env: Record<string, string | undefined>;
  events: string;
};

export async function executeOperation({ directory, operation, options, env, events }: Operation) {
  const result = await $`tofu -chdir=${directory} ${operation} -json-into=${events} ${options}`
    .env(env)
    .nothrow();
  let excerpt: string[];
  try {
    const raw = await Bun.file(events).text();
    excerpt = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => eventLine(JSON.parse(line) as Event))
      .filter((line) => line !== null)
      .slice(-80);
  } catch {
    excerpt = ['Operation events unavailable. See the Actions log.'];
  }

  return {
    exitCode: result.exitCode,
    log: [`tofu ${operation}`, ...excerpt, `Exit status: ${result.exitCode}`].join('\n'),
  };
}
