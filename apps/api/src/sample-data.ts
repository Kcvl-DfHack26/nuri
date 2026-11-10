import { ApiError } from '@google-cloud/storage';
import { purchaseUrlSchema } from '@starter/shared';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';

import type { Database } from './db/client';
import type { ImageStore } from './platform/images';

import {
  browShapes,
  catEyeShape,
  catLinerShape,
  foxCheekShape,
  foxEyeOuterShape,
  foxEyeShape,
  foxHighlightShape,
  foxInnerLinerShape,
  foxLinerShape,
  foxShadingShape,
  koreanBaseShape,
  koreanCheekShape,
  koreanHighlightShape,
  koreanLipShape,
  longCheekShape,
  longEyeShape,
  longHighlightShape,
  longLinerShadowShape,
  longLinerShape,
  longShadingShape,
} from './db/sample-shapes';
import { product, recipe, recipeProduct, recipeStep, user } from './db/schema';
import { imagePath, saveImage } from './platform/images';

// Development sample data. Every row has a stable ID and is upserted, so running the seed again
// neither duplicates rows nor removes or rewrites data created through the app.
// Image sources and licenses: apps/api/assets/*/README.md.
const people = [
  { id: 'sample-haru', name: 'はる', image: 'sample-avatars/haru.jpg' },
  { id: 'sample-sora', name: 'そら', image: 'sample-avatars/sora.jpg' },
  { id: 'sample-yui', name: 'ゆい', image: 'sample-avatars/yui.jpg' },
  { id: 'sample-ren', name: 'れん', image: 'sample-avatars/ren.jpg' },
  { id: 'sample-mio', name: 'mio', image: 'sample-avatars/mio.png' },
  { id: 'sample-kana', name: 'kana', image: null },
  { id: 'sample-yuna', name: 'yuna', image: null },
];
const products = [
  {
    id: 'celane-brow-pencil',
    name: 'CELANE 極細アイブロウペンシル',
    image: 'sample-recipes/product-brow-pencil.jpg',
    purchaseUrl: null,
  },
  {
    id: 'mousse-cheek',
    name: 'ムースチーク',
    image: 'sample-recipes/product-cheek.jpg',
    // The products are fictional, so the link searches a real shop for the name instead of
    // pointing at a made-up product page. Plan A shows 買う only on this one.
    purchaseUrl: purchaseUrlSchema.parse(
      `https://www.amazon.co.jp/s?k=${encodeURIComponent('ムースチーク')}`,
    ),
  },
];
type SeedStep = Omit<typeof recipeStep.$inferInsert, 'recipeId' | 'position'>;

// Plan A's ⑦ steps for fox, with the steps and areas the team made in the makeup area editor
// (#260). The hints and products of the added steps are sample values.
const foxSteps: SeedStep[] = [
  {
    part: 'brow',
    label: '眉',
    title: '眉尻を濃く、眉頭は淡く',
    hint: 'スクリューブラシで眉頭の毛を立てる',
    product: 'アイブロウ（微アーチ眉）',
    colors: ['#79513A'],
    shape: browShapes.softArch,
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: 'ベース色を狭め横長で乗せる',
    hint: '目頭側は薄く、目尻側へ横長にのばす',
    product: 'アイシャドウ（ベース色）',
    colors: ['#E5AC99'],
    shape: foxEyeShape,
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: '上まぶた目尻側に重ねる',
    hint: '締め色は黒目の外側から目尻までにとどめる',
    product: 'アイシャドウ（締め色）',
    colors: ['#B8704D'],
    shape: foxEyeOuterShape,
  },
  {
    part: 'highlight',
    label: 'ハイライト',
    title: '黒目のおわり〜目尻に塗る。目頭に点置き',
    hint: '指先で軽くたたいてなじませる',
    product: 'ハイライト',
    colors: ['#F1E7D7'],
    shape: foxHighlightShape,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '黒目の外側から徐々に太く',
    hint: '目尻は斜め上に跳ね上げ三角を埋める',
    product: 'アイライン',
    colors: ['#38251D'],
    shape: foxLinerShape,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '粘膜ラインを目の形が平行四辺形に見えるように',
    hint: '目尻側の上下の粘膜だけを埋める',
    product: 'アイライン（ペンシル）',
    colors: ['#38251D'],
    shape: foxInnerLinerShape,
  },
  {
    part: 'shading',
    label: 'シェード',
    title: '骨の凹みに沿って滑らせる',
    hint: '外側から内側へ境目を馴染ませる',
    product: 'シェーディング',
    colors: ['#6B5443'],
    shape: foxShadingShape,
  },
  {
    part: 'cheek',
    label: 'チーク',
    title: 'こめかみへ斜め上に滑らせる',
    hint: '頬骨の高い位置から丸く広げない',
    product: 'チーク',
    colors: ['#B8754F'],
    shape: foxCheekShape,
  },
];

// 面長メイク's steps and areas from the makeup area editor (#260). The brow keeps the existing
// 平行眉 shape, which suits a long face (#47). The hints and products are sample values.
const longSteps: SeedStep[] = [
  {
    part: 'highlight',
    label: 'ハイライト',
    title: '鼻根より少し下と鼻先より少し上において中顔面短縮',
    hint: '縦に長くのばさず、短く置く',
    product: 'ハイライト',
    colors: ['#F3E3C8'],
    shape: longHighlightShape,
  },
  {
    part: 'shading',
    label: 'シェード',
    title: '顎先が尖って見えるように下から上に',
    hint: 'あご先の下側から上へ短くぼかす',
    product: 'シェーディング',
    colors: ['#A17B60'],
    shape: longShadingShape,
  },
  {
    part: 'cheek',
    label: 'チーク',
    title: '目元において外側へ広げていく',
    hint: '横長に入れて縦の長さを目立たせない',
    product: 'チーク',
    colors: ['#E8968A'],
    shape: longCheekShape,
  },
  {
    part: 'brow',
    label: '眉',
    title: '眉尻を濃く、眉頭は淡く',
    hint: '眉山を作らず横のラインを意識する',
    product: 'アイブロウ（平行眉）',
    colors: ['#72533D'],
    shape: browShapes.flat,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '黒目より外側から傾きをかえずに延長するように',
    hint: '目尻の延長線上へ真横に近くのばす',
    product: 'アイライン',
    colors: ['#38251D'],
    shape: longLinerShape,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '黒目の外側からアイラインの先へ向かうように',
    hint: 'ブラウンで影をつけて目の横幅を出す',
    product: 'アイライン（ブラウン）',
    colors: ['#785255'],
    shape: longLinerShadowShape,
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: '下まぶたに色を置くことで面長解消',
    hint: '目尻側から黒目の下まで細く入れる',
    product: 'アイシャドウ',
    colors: ['#B37D7D'],
    shape: longEyeShape,
  },
];

// Sample steps so the seeded recipes cover every part. Texts and colors are sample values.
const catSteps: SeedStep[] = [
  {
    part: 'brow',
    label: '眉',
    title: '眉尻まで同じ太さでまっすぐ',
    hint: '眉山は作らずにすっきりと',
    product: 'アイブロウ（ストレート眉）',
    colors: ['#5E4636'],
    shape: browShapes.straight,
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: '目尻の外側だけに締め色',
    hint: '下まぶたの目尻にも少し入れる',
    product: 'アイシャドウ（締め色）',
    colors: ['#B88B78', '#8A5A52', '#4F3330'],
    shape: catEyeShape,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '目尻から長く跳ね上げる',
    hint: 'まぶたを閉じて角度を確かめる',
    product: 'アイライン',
    colors: ['#1F1717'],
    shape: catLinerShape,
  },
];

const koreanSteps: SeedStep[] = [
  {
    part: 'base',
    label: 'ベース',
    title: '顔の中心から薄く広げる',
    hint: '輪郭は塗らずにぼかすだけ',
    product: 'クッションファンデ',
    colors: ['#F1D3BF'],
    shape: koreanBaseShape,
  },
  {
    part: 'highlight',
    label: 'ハイライト',
    title: '鼻筋と頬の高い位置に光',
    hint: '指でぽんぽんと置く',
    product: 'ハイライト',
    colors: ['#FFF1DE'],
    shape: koreanHighlightShape,
  },
  {
    part: 'cheek',
    label: 'チーク',
    title: '頬の中心に丸く',
    hint: '笑ったときに高くなる位置',
    product: 'チーク',
    colors: ['#F2A5A8'],
    shape: koreanCheekShape,
  },
  {
    part: 'lip',
    label: 'リップ',
    title: '内側を濃く、外へぼかす',
    hint: '輪郭はとらずに指でなじませる',
    product: 'リップティント',
    colors: ['#D9475B'],
    shape: koreanLipShape,
  },
];

// ③'s brow styles, one step each. Their photos are cells of Plan A's brow style sheet. Plan A
// recommends アーチ眉 for round faces (#47); the other tags are sample values.
function browStep(title: string, hint: string, shape: SeedStep['shape']): SeedStep {
  return {
    part: 'brow',
    label: '眉',
    title,
    hint,
    product: 'アイブロウ',
    colors: ['#79513A'],
    shape,
  };
}
// Newest first, in Plan A's ① order. Only fox has Plan A detail data; the other tags,
// durations, sources and counts are sample values.
const recipes = [
  {
    id: 'fox',
    authorId: 'sample-mio',
    title: '狐メイク',
    tags: ['丸顔向け'],
    durationMinutes: 15,
    likeCount: 1200,
    source: 'instagram' as const,
    products: [
      { productId: 'celane-brow-pencil', usage: '眉・モカブラウン' },
      { productId: 'mousse-cheek', usage: 'チーク・コーラル' },
    ],
    steps: foxSteps,
  },
  {
    id: 'round',
    authorId: 'sample-mio',
    title: '丸顔メイク',
    tags: ['丸顔向け'],
    durationMinutes: 10,
    likeCount: 1200,
    source: null,
    products: [],
    steps: [],
  },
  {
    id: 'cat',
    authorId: 'sample-mio',
    title: '猫メイク',
    tags: ['たれ目向け'],
    durationMinutes: 15,
    likeCount: 1200,
    source: 'instagram' as const,
    products: [],
    steps: catSteps,
  },
  {
    id: 'long',
    authorId: 'sample-mio',
    title: '面長メイク',
    tags: ['面長向け'],
    durationMinutes: 12,
    likeCount: 1200,
    source: null,
    products: [],
    steps: longSteps,
  },
  {
    id: 'office',
    authorId: 'sample-kana',
    title: '5分で仕上げるオフィス顔',
    tags: ['時短'],
    durationMinutes: 5,
    likeCount: 864,
    source: 'youtube' as const,
    products: [],
    steps: [],
  },
  {
    id: 'korean',
    authorId: 'sample-yuna',
    title: '透明感の韓国風',
    tags: ['透明感'],
    durationMinutes: 20,
    likeCount: 3400,
    source: 'tiktok' as const,
    products: [],
    steps: koreanSteps,
  },
  {
    id: 'brow-straight-flat',
    authorId: 'sample-mio',
    title: '平行眉',
    part: 'brow' as const,
    summary: 'やさしく若見え',
    tags: ['初心者OK', 'ナチュラル'],
    durationMinutes: 3,
    likeCount: 96,
    source: null,
    products: [],
    steps: [browStep('眉山を作らず平行に描く', '眉頭から眉尻まで高さをそろえる', browShapes.flat)],
  },
  {
    id: 'brow-soft-arch',
    authorId: 'sample-mio',
    title: '微アーチ眉',
    part: 'brow' as const,
    summary: '自然で垢抜け',
    tags: ['初心者OK', 'ナチュラル'],
    durationMinutes: 3,
    likeCount: 412,
    source: null,
    products: [],
    steps: [browStep('眉山をほんの少しだけ上げる', '眉尻は眉頭より下げない', browShapes.softArch)],
  },
  {
    id: 'brow-arch',
    authorId: 'sample-mio',
    title: 'アーチ眉',
    part: 'brow' as const,
    summary: '女性らしく上品な',
    tags: ['丸顔向け'],
    durationMinutes: 3,
    likeCount: 188,
    source: null,
    products: [],
    steps: [
      browStep('眉山をなだらかな弧でつなぐ', '眉頭は淡く、眉山から眉尻へ細くする', browShapes.arch),
    ],
  },
  {
    id: 'brow-straight',
    authorId: 'sample-mio',
    title: 'ストレート眉',
    part: 'brow' as const,
    summary: '知的でクール',
    tags: ['初心者OK'],
    durationMinutes: 3,
    likeCount: 73,
    source: null,
    products: [],
    steps: [
      browStep(
        '眉頭から眉尻へまっすぐ描く',
        '下側のラインをそろえて直線にする',
        browShapes.straight,
      ),
    ],
  },
  {
    id: 'brow-rising',
    authorId: 'sample-mio',
    title: '上がり眉',
    part: 'brow' as const,
    summary: 'シャープで自信のある',
    tags: [],
    durationMinutes: 3,
    likeCount: 254,
    source: null,
    products: [],
    steps: [
      browStep('眉尻に向かって角度をつける', '眉山を外側に置き、縦の印象を足す', browShapes.rising),
    ],
  },
  {
    id: 'brow-falling',
    authorId: 'sample-mio',
    title: '下がり眉',
    part: 'brow' as const,
    summary: '優しく穏やかな',
    tags: ['ナチュラル'],
    durationMinutes: 3,
    likeCount: 61,
    source: null,
    products: [],
    steps: [browStep('眉尻をやや下げて描く', '眉頭はふんわり、眉尻は細く', browShapes.falling)],
  },
];

export async function seedSampleData(db: Database, images: ImageStore) {
  const recipeImageKey = (id: string) => `sample-recipes/${id}.jpg`;
  const imageKeys = [
    ...people.flatMap((person) => (person.image ? [person.image] : [])),
    ...products.map((item) => item.image),
    ...recipes.map((item) => recipeImageKey(item.id)),
  ];
  // Finish uploading before changing any database reference. Fixed object names and the
  // create-only precondition let concurrent seeds safely reuse an already uploaded fixture.
  await Promise.all(
    imageKeys.map(async (key) => {
      const bytes = await readFile(new URL(`../assets/${key}`, import.meta.url));
      try {
        await saveImage(images, key, bytes);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 412)) {
          throw error;
        }
      }
    }),
  );
  await db.transaction(async (tx) => {
    for (const { id, name, image: key } of people) {
      const image = key ? imagePath(key) : null;
      const insert = tx.insert(user).values({ id, name, image, email: `${id}@example.invalid` });
      if (key) {
        // Change only the previous bundled fixture reference for this user.
        await insert.onConflictDoUpdate({
          target: user.id,
          set: { image },
          setWhere: eq(user.image, `/${key}`),
        });
      } else {
        await insert.onConflictDoNothing({ target: user.id });
      }
    }
    for (const { id, ...item } of products) {
      const values = { ...item, image: imagePath(item.image) };
      await tx
        .insert(product)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: product.id, set: values });
    }
    for (const [index, { products: used, steps, ...item }] of recipes.entries()) {
      const values = { ...item, image: imagePath(recipeImageKey(item.id)) };
      const seeded = await tx
        .insert(recipe)
        .values({ ...values, createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000) })
        // A recipe someone else made with the same slug is left untouched.
        .onConflictDoUpdate({
          target: recipe.id,
          set: values,
          setWhere: eq(recipe.authorId, item.authorId),
        })
        .returning({ id: recipe.id });
      if (!seeded.length) {
        continue;
      }
      for (const [position, entry] of used.entries()) {
        await tx
          .insert(recipeProduct)
          .values({ recipeId: item.id, position, ...entry })
          .onConflictDoUpdate({
            target: [recipeProduct.recipeId, recipeProduct.productId],
            set: { position, usage: entry.usage },
          });
      }
      for (const [position, step] of steps.entries()) {
        await tx
          .insert(recipeStep)
          .values({ recipeId: item.id, position, ...step })
          .onConflictDoUpdate({ target: [recipeStep.recipeId, recipeStep.position], set: step });
      }
    }
  });
  return { users: people.length, recipes: recipes.length };
}
