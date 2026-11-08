export function requireEnv(name: string) {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Set ${name}`);
  }
  return value;
}

export function readOperation() {
  const operation = requireEnv('OPERATION');
  if (operation !== 'plan' && operation !== 'apply') {
    throw new Error('Invalid operation');
  }
  return operation;
}
