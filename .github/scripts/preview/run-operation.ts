import { $ } from 'bun';
import { z } from 'zod';

const eventSchema = z.object({
  type: z.string().optional(),
  changes: z
    .object({ operation: z.string(), add: z.int(), change: z.int(), remove: z.int() })
    .optional(),
  hook: z
    .object({
      resource: z.object({ resource_type: z.string(), resource_name: z.string() }).optional(),
      action: z.string().optional(),
    })
    .optional(),
  diagnostic: z.object({ severity: z.string(), summary: z.string().optional() }).optional(),
});
function eventLine(event: z.infer<typeof eventSchema>) {
  if (event.type === 'change_summary' && event.changes) {
    const { operation, add, change, remove } = event.changes;
    if (operation === 'apply' || operation === 'destroy') {
      return `Resources: ${add} added, ${change} changed, ${remove} destroyed.`;
    }
  }

  if (event.type === 'diagnostic' && event.diagnostic?.severity === 'error') {
    const code = /googleapi: Error ([45]\d{2}):/.exec(event.diagnostic.summary ?? '')?.[1];
    return code
      ? `Google Cloud API error: HTTP ${code}. See the Actions log for the full diagnostic.`
      : 'OpenTofu reported an error. See the Actions log for the full diagnostic.';
  }

  // イベント由来のリソース識別子は型と宣言名だけを転記する。
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
  operation: 'plan' | 'apply';
  options: string[];
  env: Record<string, string | undefined>;
  events: string;
  details: string[];
};

export async function executeOperation({
  directory,
  operation,
  options,
  env,
  events,
  details,
}: Operation) {
  const result = await $`tofu -chdir=${directory} ${operation} -json-into=${events} ${options}`
    .env(env)
    .nothrow();
  let excerpt: string[];
  try {
    const raw = await Bun.file(events).text();
    excerpt = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => eventSchema.safeParse(JSON.parse(line)))
      .flatMap((event) => (event.success ? [eventLine(event.data)] : []))
      .filter((line) => line !== null)
      .slice(-80);
  } catch {
    excerpt = ['Operation events unavailable. See the Actions log.'];
  }

  return {
    exitCode: result.exitCode,
    log: [
      `tofu ${operation}${options.includes('-destroy') ? ' -destroy' : ''}`,
      ...excerpt,
      `Exit status: ${result.exitCode}`,
      '',
      ...details,
    ]
      .join('\n')
      .trimEnd(),
  };
}
