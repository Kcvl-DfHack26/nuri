import type { PartId, PhotoCrop } from '@/components/recipes';

import recipesRound from '../../assets/plan-a/recipes/round.jpg';

// Fixed Plan A ④ sample. Nothing is fetched from the pasted URL: how posts are obtained and
// under which rights is still undecided, so every read shows this same post.

export const samplePost = {
  title: '透明感の韓国風メイク',
  author: '@yuna_makeup',
  photo: recipesRound,
  /** The 72×96 result thumbnail and the 112×140 saved cover share this crop in Plan A. */
  crop: { width: '142.86%', height: '142.86%', left: '-21.43%', top: '-38.57%' },
  productCount: 6,
} satisfies { title: string; author: string; photo: number; crop: PhotoCrop; productCount: number };

export const sampleSteps: {
  part: PartId;
  label: string;
  hint: string;
  segment: string;
  crop: PhotoCrop;
}[] = [
  {
    part: 'base',
    label: 'ベース',
    hint: '薄く全体に広げる',
    segment: '0:48',
    crop: { width: '200%', height: '215.8%', left: '-50%', top: '-51.79%' },
  },
  {
    part: 'brow',
    label: '眉',
    hint: '平行気味にふんわり',
    segment: '0:36',
    crop: { width: '294.12%', height: '317.35%', left: '-91.18%', top: '-77.12%' },
  },
  {
    part: 'eye',
    label: '目元',
    hint: '涙袋に明るい色をのせる',
    segment: '1:22',
    crop: { width: '416.67%', height: '449.59%', left: '-112.5%', top: '-143.87%' },
  },
  {
    part: 'cheek',
    label: 'チーク',
    hint: '中央に丸く入れる',
    segment: '0:30',
    crop: { width: '384.62%', height: '415%', left: '-92.31%', top: '-166%' },
  },
  {
    part: 'lip',
    label: 'リップ',
    hint: 'コーラルをうすく重ねる',
    segment: '0:24',
    crop: { width: '416.67%', height: '449.59%', left: '-170.83%', top: '-202.31%' },
  },
];

/** ④-1 history rows. Import history is not stored yet, so these stay inactive. */
export const recentImports: { title: string; source: string; photo: number; crop: PhotoCrop }[] = [
  {
    title: 'うるみ目ドーリー',
    source: '@saki_beauty・YouTube',
    photo: recipesRound,
    crop: { width: '166.67%', height: '222.15%', left: '-33.33%', top: '-66.64%' },
  },
  {
    title: 'ヘルシーつや肌',
    source: '@rina_make・Instagram',
    photo: recipesRound,
    crop: { width: '200%', height: '266.58%', left: '-50%', top: '-93.3%' },
  },
];

/** The link Plan A shows in the clipboard suggestion; the clipboard is not read yet. */
export const clipboardSample = 'instagram.com/reel/yuna_makeup…';
