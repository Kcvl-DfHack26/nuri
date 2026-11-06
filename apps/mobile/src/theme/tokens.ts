import { useCSSVariable } from 'uniwind';

// Native icons and gradients need plain color values; read them from global.css, the single source.
export function useTokenColor(token: `--color-${string}`) {
  const value = useCSSVariable(token);
  if (typeof value !== 'string') {
    throw new Error(`${token} is not defined in global.css`);
  }
  return value;
}
