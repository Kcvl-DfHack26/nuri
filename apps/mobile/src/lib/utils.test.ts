import { cn } from './utils';

test.each(['text-body', 'text-caption', 'text-title', 'text-login-wordmark', 'text-match-score'])(
  'keeps semantic color with %s typography',
  (size) => {
    expect(cn('text-foreground', size)).toBe(`text-foreground ${size}`);
    expect(cn(size, 'text-muted-foreground')).toBe(`${size} text-muted-foreground`);
  },
);

test('overrides typography and color independently for button labels', () => {
  expect(cn('text-foreground text-body', 'text-primary-foreground', 'text-caption')).toBe(
    'text-primary-foreground text-caption',
  );
});

test('keeps the selected border width and color when merging classes', () => {
  expect(cn('border-fine border-line-soft', 'border-selected border-accent-rose')).toBe(
    'border-selected border-accent-rose',
  );
});
