import { cn } from './utils';

test.each(['body', 'caption', 'title'])('keeps semantic color with %s typography', (size) => {
  expect(cn('text-foreground', `text-${size}`)).toBe(`text-foreground text-${size}`);
  expect(cn(`text-${size}`, 'text-muted-foreground')).toBe(`text-${size} text-muted-foreground`);
});

test('overrides typography and color independently for button labels', () => {
  expect(cn('text-foreground text-body', 'text-primary-foreground', 'text-caption')).toBe(
    'text-primary-foreground text-caption',
  );
});
