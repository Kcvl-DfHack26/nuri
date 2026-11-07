import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { File } from 'expo-file-system';
import { createContext, use, useEffect, useState } from 'react';

import type { PartId, PhotoCrop } from '@/components/recipes';

import { parts } from '@/components/recipes';

import detailProductBrowPencil from '../../assets/plan-a/detail/product-brow-pencil.jpg';

// Plan A ⑫ 投稿: the post being prepared lives only on the device until posting is built.
// Recording, step generation and upload are not implemented; the draft starts from Plan A's
// sample of a recorded fox-make video.

export type Cosmetic = {
  id: string;
  name: string;
  category: string;
  shade: string;
  /** Swatch shown when there is no product photo. */
  color: string;
  image?: number;
};

export type PostStep = {
  part: PartId;
  /** Short label under the step icon on the preview, e.g. シャドウ. */
  label: string;
  title: string;
  description: string;
  cosmetics: Cosmetic[];
  segment: { from: string; to: string; length: string };
  /** Crop of the sample video frame in the 68×84 step thumbnail. */
  thumbCrop: PhotoCrop;
};

type PostVideo = {
  uri: string;
  /** Times of 手順を区切る from the start of the recording, in ms; empty for a chosen video. */
  marks: number[];
  /** Length in ms when known: the recording's own, or what the picker reports. */
  durationMs: number | null;
};

type PostDraft = {
  /** The recorded or chosen video, kept on the device until the post is sent. */
  video: PostVideo | null;
  steps: PostStep[];
  message: string;
  tags: string[];
  /** Frame of the video shown on ①'s recipe card; null until one is chosen on ⑫-7. */
  thumbnail: { uri: string; timeMs: number } | null;
  publishCosmetics: boolean;
  publishBefore: boolean;
};

export const sampleVideoLength = '14:32';

const celane: Cosmetic = {
  id: 'celane-brow-pencil',
  name: 'CELANE 極細アイブロウペンシル',
  category: '眉',
  shade: '03 モカブラウン',
  color: '#8A664F',
  image: detailProductBrowPencil,
};

/** ⑫-6: cosmetics Plan A shows as found in a step's clip, by part. */
export const cosmeticCandidates: Partial<Record<PartId, Cosmetic[]>> = {
  brow: [
    celane,
    {
      id: 'fuwari-brow-powder',
      name: 'ふんわりアイブロウパウダー',
      category: '眉',
      shade: 'ナチュラルブラウン',
      color: '#A68066',
    },
    {
      id: 'brow-mascara-light',
      name: '眉マスカラ ライト',
      category: '眉',
      shade: 'ライトブラウン',
      color: '#B88F73',
    },
  ],
};

const sampleDraft: PostDraft = {
  video: null,
  steps: [
    {
      part: 'brow',
      label: '眉',
      title: '眉を描く',
      description: '眉頭から眉尻へ、毛の流れに沿って細く描き足します',
      cosmetics: [celane],
      segment: { from: '0:18', to: '1:30', length: '1:12' },
      thumbCrop: { width: '250%', height: '359.6%', left: '-78.75%', top: '-68.32%' },
    },
    {
      part: 'eye',
      label: 'シャドウ',
      title: 'アイシャドウ',
      description: 'ベージュ系のパレット',
      cosmetics: [],
      segment: { from: '1:30', to: '4:10', length: '2:40' },
      thumbCrop: { width: '277.78%', height: '399.55%', left: '-55.56%', top: '-107.88%' },
    },
    {
      part: 'lash',
      label: 'ライン',
      title: 'アイライン',
      description: '目尻を少し長めに',
      cosmetics: [],
      segment: { from: '4:10', to: '5:15', length: '1:05' },
      thumbCrop: { width: '357.14%', height: '513.71%', left: '-64.29%', top: '-154.11%' },
    },
    {
      part: 'shading',
      label: 'シェード',
      title: 'シェーディング',
      description: '小鼻の横からフェイスラインへ',
      cosmetics: [],
      segment: { from: '5:15', to: '7:03', length: '1:48' },
      thumbCrop: { width: '250%', height: '359.6%', left: '-80%', top: '-118.67%' },
    },
    {
      part: 'cheek',
      label: 'チーク',
      title: 'チーク',
      description: '頬骨の上に高めに',
      cosmetics: [],
      segment: { from: '7:03', to: '9:05', length: '2:02' },
      thumbCrop: { width: '238.1%', height: '342.47%', left: '-28.57%', top: '-116.44%' },
    },
    {
      part: 'lip',
      label: 'リップ',
      title: 'リップ',
      description: 'コーラル系のティント',
      cosmetics: [],
      segment: { from: '9:05', to: '9:59', length: '0:54' },
      thumbCrop: { width: '250%', height: '359.6%', left: '-80%', top: '-149.23%' },
    },
  ],
  message: '丸顔でも目元がすっきり見える狐メイク。チークを高めに入れるのがポイント！',
  tags: [],
  thumbnail: null,
  publishCosmetics: true,
  publishBefore: false,
};

/** A step's title as shown in lists; an emptied title falls back to the part name. */
export function stepTitle(step: PostStep) {
  return step.title.trim() || parts[step.part].label;
}

/** Every cosmetic used in the post, once, in step order. */
export function usedCosmetics(steps: PostStep[]) {
  const seen = new Map<string, Cosmetic>();
  for (const cosmetic of steps.flatMap((step) => step.cosmetics)) {
    seen.set(cosmetic.id, cosmetic);
  }
  return [...seen.values()];
}

type PostDraftContextValue = {
  draft: PostDraft;
  setDraft: Dispatch<SetStateAction<PostDraft>>;
  updateStep: (index: number, change: Partial<PostStep>) => void;
};

const PostDraftContext = createContext<PostDraftContextValue | null>(null);

// Mounted by the post flow's layout, so leaving the flow discards the draft.
export function PostDraftProvider({
  videoUri,
  videoDurationMs,
  children,
}: {
  /** The video chosen on ⑫-1, read once when the flow opens. */
  videoUri?: string | undefined;
  /** Its length in ms when the picker reports it. */
  videoDurationMs?: number | undefined;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState<PostDraft>(() => ({
    ...sampleDraft,
    video: videoUri ? { uri: videoUri, marks: [], durationMs: videoDurationMs ?? null } : null,
  }));
  // A video recorded on ⑫-2 holds the user's face and voice, so it is deleted once the draft lets
  // go of it (the flow closes or another video replaces it). A chosen video is left alone.
  const recordedUri = draft.video && draft.video.uri !== videoUri ? draft.video.uri : null;
  useEffect(() => {
    if (!recordedUri) {
      return;
    }
    return () => {
      const file = new File(recordedUri);
      if (file.exists) {
        file.delete();
      }
    };
  }, [recordedUri]);
  const updateStep = (index: number, change: Partial<PostStep>) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, position) =>
        position === index ? { ...step, ...change } : step,
      ),
    }));
  };
  return <PostDraftContext value={{ draft, setDraft, updateStep }}>{children}</PostDraftContext>;
}

export function usePostDraft() {
  const value = use(PostDraftContext);
  if (!value) {
    throw new Error('usePostDraft must be used inside PostDraftProvider');
  }
  return value;
}
