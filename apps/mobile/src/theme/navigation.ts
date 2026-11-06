import { colors } from './colors';

// Apply the same OS-owned surface to the root stack and every tab stack.
export const stackOptions = {
  headerBackTitle: '戻る',
  contentStyle: { backgroundColor: colors.background },
};
