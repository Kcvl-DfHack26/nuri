import type { MakeupShape } from '@starter/shared';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import * as Crypto from 'expo-crypto';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';

import type { PartId } from '@/components/recipes';

import { partColors, parts } from '@/components/recipes';
import { deleteFile } from '@/lib/files';
import { formatClock } from '@/lib/post-edit';
import { frameTimes } from '@/lib/step-frames';

import detailProductBrowPencil from '../../assets/plan-a/detail/product-brow-pencil.jpg';
import FaceTracker from '../../modules/face-tracker/src/FaceTrackerModule';

// Plan A ⑫ 投稿: the post being prepared lives only on the device until ⑫-8 sends it. The video
// leaves the device only when the user agrees on ⑫-3 to have it read by Gemini (#151), and the API
// keeps no copy; ⑫-8 sends the texts, the steps and one frame as the thumbnail.

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
  /** Empty until the user writes one; lists and the post fall back to the part name. */
  title: string;
  description: string;
  cosmetics: Cosmetic[];
  /** Where the step is in the video, in ms; `endMs` is null when the video's length is unknown. */
  segment: { startMs: number; endMs: number | null };
  /**
   * Frame cut from the step's segment: its start, or its middle or end when only there a face was
   * found (#224); null when it could not be cut.
   */
  image: string | null;
  /** The painted area read from the video (#156); null when none was read or the part changed. */
  shape: MakeupShape | null;
  /**
   * The color painted in the step (#203): read from the video, or `picked` by the user on ⑫-5. Null
   * when the analysis could not read it and the user has not picked one.
   */
  color: { hex: string; picked: boolean } | null;
};

type PostVideo = {
  uri: string;
  /** Times of 手順を区切る from the start of the recording, in ms; empty for a chosen video. */
  marks: number[];
  /** Length in ms when known: the recording's own, or what the picker reports. */
  durationMs: number | null;
};

export type PostDraft = {
  /** Sent with the post, so the API saves a resent post only once. */
  key: string;
  /** The recorded or chosen video, kept on the device until the post is sent. */
  video: PostVideo | null;
  /** Made by ⑫-3 from the video's marks. */
  steps: PostStep[];
  title: string;
  message: string;
  tags: string[];
  /** Frame of the video shown on ①'s recipe card; null until one is chosen on ⑫-7. */
  thumbnail: { uri: string; timeMs: number } | null;
  publishCosmetics: boolean;
  /** The saved recipe's ID once ⑫-8 posted it, so the post is never sent twice. */
  postedId: string | null;
};

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

const emptyDraft: Omit<PostDraft, 'key'> = {
  video: null,
  steps: [],
  title: '',
  message: '',
  tags: [],
  thumbnail: null,
  publishCosmetics: true,
  postedId: null,
};

/**
 * The color a step is painted in: its own color (#203), else its first cosmetic's when they are
 * published, else the part's.
 */
export function stepColor(step: PostStep, publishCosmetics = true) {
  return (
    step.color?.hex ??
    (publishCosmetics ? step.cosmetics[0]?.color : undefined) ??
    partColors[step.part]
  );
}

/** A step's title as shown in lists; an emptied title falls back to the part name. */
export function stepTitle(step: PostStep) {
  return step.title.trim() || parts[step.part].label;
}

/** A step's 区間 length, e.g. 1:12, or — when the video's length is unknown. */
export function segmentLength(step: Pick<PostStep, 'segment'>) {
  const { startMs, endMs } = step.segment;
  return endMs === null ? '—' : formatClock(endMs - startMs);
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
  /** Registers a file cut from the video on the device, deleted when the flow closes. */
  trackFile: (uri: string) => void;
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
    ...emptyDraft,
    key: Crypto.randomUUID(),
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
      deleteFile(recordedUri);
    };
  }, [recordedUri]);
  // Frames cut from the video can show the user's face, so none outlive the flow.
  const files = useRef(new Set<string>());
  // A frame still being cut when the flow closes is deleted as soon as it arrives.
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const owned = files.current;
    return () => {
      closed.current = true;
      for (const uri of owned) {
        deleteFile(uri);
      }
      owned.clear();
    };
  }, []);
  const trackFile = useCallback((uri: string) => {
    if (closed.current) {
      deleteFile(uri);
    } else {
      files.current.add(uri);
    }
  }, []);
  const updateStep = (index: number, change: Partial<PostStep>) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, position) =>
        position === index ? { ...step, ...change } : step,
      ),
    }));
  };
  return (
    <PostDraftContext value={{ draft, setDraft, updateStep, trackFile }}>
      {children}
    </PostDraftContext>
  );
}

export function usePostDraft() {
  const value = use(PostDraftContext);
  if (!value) {
    throw new Error('usePostDraft must be used inside PostDraftProvider');
  }
  return value;
}

/**
 * The frame for a step's segment (#224): the first of its start, middle and end where a face is
 * found, so ⑫-5 can lay the area on it; otherwise the first frame that could be cut. Without the
 * face tracker (Expo Go) it is the start. Null when no frame could be cut.
 */
export async function cutStepFrame(
  videoUri: string,
  segment: PostStep['segment'],
  quality: number,
  trackFile: (uri: string) => void,
): Promise<string | null> {
  let first: string | null = null;
  for (const time of frameTimes(segment)) {
    const image = await getThumbnailAsync(videoUri, { time, quality }).then(
      ({ uri }) => {
        trackFile(uri);
        return uri;
      },
      () => null,
    );
    if (image) {
      first ??= image;
      if (!FaceTracker) {
        return image;
      }
      const face = await FaceTracker.detectFaceAsync(image).catch(() => null);
      if (face) {
        return image;
      }
    }
  }
  return first;
}

/**
 * Cuts the frame for a step's new segment, after ⑫-4 added the step or ⑫-5 moved it. The frame is
 * kept only while the step still starts there; a frame that cannot be cut leaves the part's icon.
 */
export function useCutStepFrame() {
  const { draft, setDraft, trackFile } = usePostDraft();
  const videoUri = draft.video?.uri ?? null;
  return useCallback(
    (index: number, segment: PostStep['segment']) => {
      if (!videoUri) {
        return;
      }
      void cutStepFrame(videoUri, segment, 0.7, trackFile).then((image) => {
        setDraft((current) => ({
          ...current,
          steps: current.steps.map((step, at) =>
            at === index && step.segment.startMs === segment.startMs ? { ...step, image } : step,
          ),
        }));
      });
    },
    [videoUri, setDraft, trackFile],
  );
}
