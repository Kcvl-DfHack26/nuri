import { z } from 'zod';

export const ritualSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: z.enum(['Mind', 'Movement', 'Creativity']),
  minutes: z.number().int().positive(),
  symbol: z.enum(['sun', 'book', 'leaf', 'pencil', 'moon', 'sparkles']),
  steps: z.array(z.string()),
});

export type Ritual = z.infer<typeof ritualSchema>;

export const rituals: Ritual[] = [
  {
    id: 'morning',
    title: 'A slower morning',
    subtitle: 'A little space before the day begins.',
    category: 'Mind',
    minutes: 5,
    symbol: 'sun',
    steps: [
      'Find a comfortable place by a window.',
      'Take five slow breaths.',
      'Choose one thing you want to make time for today.',
    ],
  },
  {
    id: 'read',
    title: 'One more chapter',
    subtitle: 'Put your phone down. Pick a story up.',
    category: 'Mind',
    minutes: 15,
    symbol: 'book',
    steps: [
      'Pick a book you have been meaning to read.',
      'Find a quiet, comfortable spot.',
      'Read at your own pace. There is no finish line.',
    ],
  },
  {
    id: 'walk',
    title: 'Take the scenic route',
    subtitle: 'Fresh air, a new perspective.',
    category: 'Movement',
    minutes: 20,
    symbol: 'leaf',
    steps: [
      'Step outside and choose a familiar route.',
      'Notice three things you usually walk past.',
      'Let your pace be comfortable.',
    ],
  },
  {
    id: 'draw',
    title: 'Make something small',
    subtitle: 'A blank page is a good place to start.',
    category: 'Creativity',
    minutes: 10,
    symbol: 'pencil',
    steps: [
      'Find a pencil and a piece of paper.',
      'Draw something within reach.',
      'Keep the page. It does not need to be perfect.',
    ],
  },
  {
    id: 'evening',
    title: 'Leave the day here',
    subtitle: 'A gentle way to wind down.',
    category: 'Mind',
    minutes: 5,
    symbol: 'moon',
    steps: [
      'Write down one good moment from today.',
      'Put tomorrow’s first task on paper.',
      'Close your notebook and let the day be done.',
    ],
  },
  {
    id: 'notice',
    title: 'Find a little wonder',
    subtitle: 'Look at the everyday a little differently.',
    category: 'Creativity',
    minutes: 10,
    symbol: 'sparkles',
    steps: [
      'Choose an everyday object nearby.',
      'Notice its colors, shapes, and textures.',
      'Write three words that describe what you see.',
    ],
  },
];

export const catalogQuerySchema = z.object({ q: z.string().trim().max(100).default('') });

export function filterRituals(query: string, items: readonly Ritual[] = rituals): Ritual[] {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter((item) =>
    `${item.title} ${item.subtitle} ${item.category}`.toLocaleLowerCase().includes(normalized),
  );
}

export const preferencesSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  haptics: z.boolean().default(true),
  dailyGoal: z.number().int().min(1).max(5).default(3),
  favorites: z.array(z.string()).default([]),
  completed: z.record(z.string(), z.array(z.string())).default({}),
});

export type Preferences = z.infer<typeof preferencesSchema>;
