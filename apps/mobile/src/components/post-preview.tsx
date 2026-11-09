import {
  productKindImage,
  recipeInputSchema,
  recipeProductsMax,
  recipeThumbnailMaxBytes,
} from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import type { PostDraft } from '@/components/post-draft';
import type { RecipeDetail, RecipeInput } from '@/lib/recipes';

import { AreaSummary } from '@/components/post-area-summary';
import { usePostConfirm } from '@/components/post-confirm';
import { stepColor, stepTitle, usePostDraft } from '@/components/post-draft';
import { RecipeContent } from '@/components/recipe-detail';
import { parts } from '@/components/recipes';
import { authClient } from '@/lib/api';
import { recipeMinutes } from '@/lib/post-edit';
import { postRecipe, recipeKeys } from '@/lib/recipes';

const fieldsSchema = recipeInputSchema.omit({ thumbnail: true });

/**
 * The cosmetics ⑤ lists for the post when the user publishes them (#224): each once, in step order,
 * with how it is used (the part, and the shade when there is one).
 */
function publishedProducts(draft: PostDraft): NonNullable<RecipeInput['products']> {
  if (!draft.publishCosmetics) {
    return [];
  }
  const seen = new Set<string>();
  return draft.steps
    .flatMap((step) =>
      step.cosmetics.map((cosmetic) => ({
        name: cosmetic.name.trim().slice(0, 80),
        part: step.part,
        usage: [parts[step.part].label, cosmetic.shade.trim()]
          .filter(Boolean)
          .join('・')
          .slice(0, 40),
      })),
    )
    .filter((item) => {
      if (!item.name || seen.has(item.name)) {
        return false;
      }
      seen.add(item.name);
      return true;
    })
    .slice(0, recipeProductsMax);
}

/** The draft's texts and steps as the API takes them; the thumbnail is read only when posting. */
function postFields(draft: PostDraft): Omit<RecipeInput, 'thumbnail'> {
  return {
    key: draft.key,
    title: draft.title,
    summary: draft.message,
    tags: draft.tags.map((tag) => tag.replace(/^#/u, '')),
    durationMinutes: recipeMinutes(draft.video?.durationMs ?? null),
    steps: draft.steps.map((step) => {
      // Only published cosmetics give their names and color; otherwise the part stands in.
      const cosmetics = draft.publishCosmetics ? step.cosmetics : [];
      const names = cosmetics.map((cosmetic) => cosmetic.name);
      return {
        part: step.part,
        label: parts[step.part].label,
        title: stepTitle(step),
        description: step.description,
        // ⑦ shows this as what the step uses; the part's name stands in when nothing is named.
        uses: names.join('、') || parts[step.part].label,
        color: stepColor(step, draft.publishCosmetics),
        ...(step.shape ? { shape: step.shape } : {}),
      };
    }),
    // Sent only when published, so an unpublished post keeps no cosmetics on the server.
    ...(draft.publishCosmetics ? { products: publishedProducts(draft) } : {}),
  };
}

function invalidMessage(field: PropertyKey | undefined) {
  if (field === 'title') {
    return 'タイトルを確認してください。';
  }
  return field === 'steps' ? '手順を確認してください。' : '投稿の内容を確認してください。';
}

/**
 * The thumbnail as base64 JPEG. A frame over the API's limit is cut again at a lower quality; the
 * file is deleted with the other frames when the flow closes.
 */
async function thumbnailBase64(
  draft: PostDraft,
  trackFile: (uri: string) => void,
): Promise<string> {
  const { video, thumbnail } = draft;
  if (!video || !thumbnail) {
    throw new Error('サムネイルにする場面を選んでください。');
  }
  let file = new File(thumbnail.uri);
  if (file.size > recipeThumbnailMaxBytes) {
    const smaller = await getThumbnailAsync(video.uri, { time: thumbnail.timeMs, quality: 0.3 });
    trackFile(smaller.uri);
    file = new File(smaller.uri);
  }
  if (file.size > recipeThumbnailMaxBytes) {
    throw new Error('サムネイルの写真が大きすぎます。別の場面を選んでください。');
  }
  return await file.base64();
}

// Plan A ⑫-8 投稿のプレビュー: ⑤ with the draft, and 投稿 sends it. Before sending, a native alert
// asks to publish the thumbnail, which can show the user's face, and the steps. The video is never
// sent. A failed post keeps the draft so 投稿 can be pressed again; the draft's key lets the API
// save a post resent after a lost response only once, with the latest contents. ⑫-6's cosmetics are Plan A samples with no
// product behind them, so they are posted as names in the steps, and the preview shows no product
// list either.
export function PostPreview() {
  const { draft, setDraft, trackFile } = usePostDraft();
  const { data: session } = authClient.useSession();
  const client = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const post = useMutation({
    mutationFn: async (current: PostDraft) =>
      await postRecipe({
        ...postFields(current),
        thumbnail: await thumbnailBase64(current, trackFile),
      }),
    onSuccess: (id) => {
      void client.invalidateQueries({ queryKey: recipeKeys.all });
      // The post is saved even if the user left the flow while it was sending; ⑫-9 needs the
      // draft that left with them, so it opens only while this screen is still there.
      if (mounted.current) {
        setDraft((current) => ({ ...current, postedId: id }));
        router.push('/post/done');
      }
    },
    onError: (error) => {
      if (mounted.current) {
        Alert.alert('投稿できませんでした', error.message);
      }
    },
  });
  const fields = postFields(draft);
  const confirm = usePostConfirm(() => {
    post.mutate(draft);
  });
  const recipe: RecipeDetail = {
    id: 'preview',
    title: draft.title.trim(),
    image: draft.thumbnail?.uri ?? '',
    tags: fields.tags,
    durationMinutes: fields.durationMinutes,
    likeCount: 0,
    source: null,
    part: null,
    summary: draft.message.trim() || null,
    author: {
      id: session?.user.id ?? 'preview',
      name: session?.user.name ?? '',
      image: session?.user.image ?? null,
    },
    favorited: false,
    // ⑫-8 shows the published cosmetics as ⑤ will, with their kind's photo and no shop.
    products: publishedProducts(draft).map((item, position) => ({
      id: `preview-${position}`,
      name: item.name,
      usage: item.usage,
      image: productKindImage(item.part),
      purchaseUrl: null,
    })),
    steps: [],
  };
  const onPost = () => {
    if (draft.postedId) {
      router.push('/post/done');
      return;
    }
    if (post.isPending) {
      return;
    }
    const checked = fieldsSchema.safeParse(fields);
    if (!checked.success) {
      Alert.alert('投稿できません', invalidMessage(checked.error.issues[0]?.path[0]));
      return;
    }
    if (!draft.thumbnail) {
      Alert.alert('投稿できません', 'サムネイルにする場面を選んでください。');
      return;
    }
    confirm.ask();
  };
  const areaSummary = (
    <AreaSummary
      areas={draft.steps.flatMap((step, index) => {
        const color = fields.steps[index]?.color;
        return step.shape && color ? [{ shape: step.shape, color }] : [];
      })}
    />
  );
  return (
    <>
      <RecipeContent
        recipe={recipe}
        steps={fields.steps}
        onPost={onPost}
        posting={post.isPending}
        areas={areaSummary}
      />
      {confirm.dialog}
    </>
  );
}
