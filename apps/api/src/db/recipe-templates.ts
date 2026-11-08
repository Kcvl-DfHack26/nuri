import { eq, inArray } from 'drizzle-orm';

import type { Database } from './client';

import {
  browShapes,
  catEyeShape,
  catLinerShape,
  foxCheekShape,
  foxEyeShape,
  foxLinerShape,
  foxShadingShape,
  koreanBaseShape,
  koreanCheekShape,
  koreanHighlightShape,
  koreanLipShape,
  longCheekShape,
  longShadingShape,
  naturalEyeShape,
  naturalLipShape,
  roundCheekShape,
  underEyeShape,
} from './sample-shapes';
import { product, recipe, recipeProduct, recipeStep, user } from './schema';

type TemplateStep = Omit<typeof recipeStep.$inferInsert, 'recipeId' | 'position'>;
type TemplateProduct = { productId: string; usage: string };

// These are editorial templates, not imported SNS posts or verified product SKUs. Each color is a
// screen swatch for the look; people choose foundation, contour and brow shades for their own skin
// and hair. The technique and color-family sources are recorded in docs/makeup-recipes.md.
const products = [
  { id: 'template-base', name: '薄づきベース', image: null, purchaseUrl: null },
  {
    id: 'template-brow-pencil',
    name: '極細アイブロウペンシル',
    image: '/sample-recipes/product-brow-pencil.jpg',
    purchaseUrl: null,
  },
  { id: 'template-brow-powder', name: 'アイブロウパウダー', image: null, purchaseUrl: null },
  { id: 'template-eye-shadow', name: 'アイシャドウ', image: null, purchaseUrl: null },
  { id: 'template-eye-liner', name: 'アイライナー', image: null, purchaseUrl: null },
  { id: 'template-shading', name: 'シェーディング', image: null, purchaseUrl: null },
  {
    id: 'template-cheek',
    name: 'チーク',
    image: '/sample-recipes/product-cheek.jpg',
    purchaseUrl: null,
  },
  { id: 'template-highlight', name: 'ハイライト', image: null, purchaseUrl: null },
  { id: 'template-lip', name: 'リップカラー', image: null, purchaseUrl: null },
];

function step(
  part: TemplateStep['part'],
  label: string,
  title: string,
  hint: string,
  cosmetic: string,
  colors: string[],
  shape: TemplateStep['shape'],
): TemplateStep {
  return { part, label, title, hint, product: cosmetic, colors, shape };
}

function browStep(
  title: string,
  hint: string,
  color: string,
  shape: TemplateStep['shape'],
  cosmetic = 'アイブロウパウダー・極細ペンシル',
) {
  return step('brow', '眉', title, hint, cosmetic, [color], shape);
}

const browProducts: TemplateProduct[] = [
  { productId: 'template-brow-powder', usage: '眉頭を淡くぼかす' },
  { productId: 'template-brow-pencil', usage: '毛の足りない所と眉尻を描く' },
];

export const recipeTemplates = [
  {
    id: 'fox',
    legacyAuthorId: 'sample-mio',
    title: '狐メイク',
    tags: ['切れ長アイ'],
    durationMinutes: 15,
    products: [
      { productId: 'template-brow-powder', usage: '眉頭を淡くぼかす' },
      { productId: 'template-brow-pencil', usage: '髪色になじむブラウン' },
      { productId: 'template-eye-shadow', usage: 'ベージュ・赤みブラウン・深いブラウン' },
      { productId: 'template-eye-liner', usage: 'ダークブラウン' },
      { productId: 'template-shading', usage: '肌より少し暗いニュートラルブラウン' },
      { productId: 'template-cheek', usage: '落ち着いたテラコッタ' },
      { productId: 'template-lip', usage: 'ローズベージュ' },
    ],
    steps: [
      browStep(
        '眉山をゆるく上げ、眉尻を細く',
        '眉頭は淡く、毛の足りない所だけ描き足す',
        '#79513A',
        browShapes.softArch,
      ),
      step(
        'eye',
        'シャドウ',
        '目尻側へ横長にぼかす',
        'ベージュを全体に、深いブラウンを目尻側1/3に重ねる',
        '3色アイシャドウ',
        ['#E5B58A', '#B77A5E', '#713E2C'],
        foxEyeShape,
      ),
      step(
        'lash',
        'ライン',
        'まつ毛の際から目尻を長く',
        '目頭は細く、目尻はこめかみへ細く長めに伸ばす',
        'ダークブラウンのアイライナー',
        ['#38251D'],
        foxLinerShape,
      ),
      step(
        'shading',
        'シェード',
        'こめかみと輪郭を薄く',
        '肌より少し暗い色を外側から内側へぼかす',
        'シェーディング',
        ['#927A69'],
        foxShadingShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬骨からこめかみへ斜め上に',
        'テラコッタを薄く重ね、境目をぼかす',
        'チーク',
        ['#B8754F'],
        foxCheekShape,
      ),
      step(
        'lip',
        'リップ',
        'ローズベージュを薄く重ねる',
        '唇の輪郭に沿い、中央から外側へなじませる',
        'リップカラー',
        ['#A76563'],
        naturalLipShape,
      ),
    ],
  },
  {
    id: 'round',
    legacyAuthorId: 'sample-mio',
    title: '丸顔メイク',
    tags: ['丸顔向け'],
    durationMinutes: 15,
    products: [
      { productId: 'template-base', usage: '自分の肌色に合う薄づきの色' },
      { productId: 'template-shading', usage: '肌より少し暗い色' },
      { productId: 'template-brow-powder', usage: '眉頭を淡くぼかす' },
      { productId: 'template-brow-pencil', usage: '髪色になじむブラウン' },
      { productId: 'template-eye-shadow', usage: 'グレイッシュブラウン' },
      { productId: 'template-cheek', usage: '落ち着いたローズレッド' },
      { productId: 'template-lip', usage: 'ローズブラウン' },
    ],
    steps: [
      step(
        'base',
        'ベース',
        '顔の中央を薄く整える',
        '目の下・額中央・あごに置き、外側へ薄くぼかす',
        '肌色に合う薄づきファンデーション',
        ['#D8BBA7'],
        koreanBaseShape,
      ),
      step(
        'shading',
        'シェード',
        '輪郭と頬骨の下に陰影を',
        '額の端・輪郭・頬骨の下を薄くぼかす',
        '肌より少し暗いシェーディング',
        ['#927A69'],
        foxShadingShape,
      ),
      browStep('眉山を少し高めに', '自眉を生かし、眉尻は細く仕上げる', '#705848', browShapes.arch),
      step(
        'eye',
        'シャドウ',
        '目尻側に締め色を',
        'グレイッシュブラウンを外側ほど濃く',
        'アイシャドウ',
        ['#B5A69B', '#79685F'],
        foxEyeShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬骨の高い所から外へ',
        '落ち着いたローズレッドを楕円に薄く',
        'チーク',
        ['#B86F69'],
        roundCheekShape,
      ),
      step(
        'lip',
        'リップ',
        'ローズブラウンで引き締める',
        '薄く重ねて輪郭を自然になじませる',
        'リップカラー',
        ['#9E5E62'],
        naturalLipShape,
      ),
    ],
  },
  {
    id: 'cat',
    legacyAuthorId: 'sample-mio',
    title: '猫メイク',
    tags: ['キャットライン'],
    durationMinutes: 15,
    products: [
      { productId: 'template-brow-powder', usage: '眉頭を淡くぼかす' },
      { productId: 'template-brow-pencil', usage: '自然なダークブラウン' },
      { productId: 'template-eye-shadow', usage: 'ベージュとブラウン' },
      { productId: 'template-eye-liner', usage: '黒のリキッドタイプ' },
      { productId: 'template-cheek', usage: 'やわらかいローズ' },
      { productId: 'template-lip', usage: 'ローズピンク' },
    ],
    steps: [
      browStep(
        '眉山を抑えてすっきり描く',
        '眉尻を細くし、眉頭は描き込みすぎない',
        '#5E4636',
        browShapes.straight,
      ),
      step(
        'eye',
        'シャドウ',
        '目尻側1/3を濃く',
        'ベージュを全体に、ブラウンを目尻に重ねる',
        'アイシャドウ',
        ['#C9AA95', '#66443D'],
        catEyeShape,
      ),
      step(
        'lash',
        'ライン',
        '目尻に小さな三角の跳ね上げ',
        'まつ毛の際を細く引き、目を開けて角度を確認',
        '黒のリキッドアイライナー',
        ['#251C1B'],
        catLinerShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬の高い所へ丸く',
        'ローズを少量ずつ重ねてぼかす',
        'チーク',
        ['#C98287'],
        koreanCheekShape,
      ),
      step(
        'lip',
        'リップ',
        'ローズピンクを均一に',
        '唇の中央から外側へ薄くのばす',
        'リップカラー',
        ['#B96875'],
        naturalLipShape,
      ),
    ],
  },
  {
    id: 'long',
    legacyAuthorId: 'sample-mio',
    title: '面長メイク',
    tags: ['面長向け'],
    durationMinutes: 15,
    products: [
      { productId: 'template-brow-powder', usage: '髪色に近い柔らかなブラウン' },
      { productId: 'template-brow-pencil', usage: '眉の下側と眉尻を細く足す' },
      { productId: 'template-eye-shadow', usage: '下まぶた用の淡いブラウン' },
      { productId: 'template-cheek', usage: '落ち着いたピンク' },
      { productId: 'template-shading', usage: '肌より少し暗い色' },
      { productId: 'template-lip', usage: 'やわらかいピンク' },
    ],
    steps: [
      browStep(
        '眉山を抑えて平行気味に',
        '眉の下側を少し足し、眉尻は長くしすぎない',
        '#79685D',
        browShapes.flat,
      ),
      step(
        'eye',
        'シャドウ',
        '下まぶたにも淡い影を',
        '淡いブラウンを下まぶたに細くぼかす',
        'アイシャドウ',
        ['#B69A8F'],
        underEyeShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬の高い位置から横長に',
        'ピンクを水平な楕円にぼかし、縦に広げない',
        'チーク',
        ['#C98790'],
        longCheekShape,
      ),
      step(
        'shading',
        'シェード',
        '額の上とあご先を薄く',
        '首の色に近い影色を少しずつぼかす',
        'シェーディング',
        ['#9A8477'],
        longShadingShape,
      ),
      step(
        'lip',
        'リップ',
        '柔らかいピンクで血色を',
        '唇の輪郭に沿って薄くなじませる',
        'リップカラー',
        ['#BE7D86'],
        naturalLipShape,
      ),
    ],
  },
  {
    id: 'office',
    legacyAuthorId: 'sample-kana',
    title: '5分で仕上げるオフィス顔',
    tags: ['時短'],
    durationMinutes: 5,
    products: [
      { productId: 'template-base', usage: '肌色に合う色つき下地' },
      { productId: 'template-brow-powder', usage: '髪色になじむブラウン' },
      { productId: 'template-eye-shadow', usage: '単色のベージュブラウン' },
      { productId: 'template-cheek', usage: '薄づきのコーラル' },
      { productId: 'template-lip', usage: '透けるコーラルピンク' },
    ],
    steps: [
      step(
        'base',
        'ベース',
        '色つき下地を薄く',
        '顔の中央から外側へ、素肌が透ける厚さに',
        '肌色に合う色つき下地',
        ['#DBC1AF'],
        koreanBaseShape,
      ),
      browStep(
        '眉の隙間だけを埋める',
        'パウダーでなぞり、眉頭は淡く残す',
        '#806B5B',
        browShapes.softArch,
        'アイブロウパウダー',
      ),
      step(
        'eye',
        'シャドウ',
        '単色をまぶたに薄く',
        'ベージュブラウンを指で広げ、境目をぼかす',
        '単色アイシャドウ',
        ['#AD8A72'],
        naturalEyeShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬の高い所に少量',
        '薄づきコーラルを指でなじませる',
        'クリームチーク',
        ['#D18E7D'],
        koreanCheekShape,
      ),
      step(
        'lip',
        'リップ',
        '色つきリップで血色を',
        '唇全体に薄く塗り、足りなければ重ねる',
        '色つきリップバーム',
        ['#C77975'],
        naturalLipShape,
      ),
    ],
  },
  {
    id: 'korean',
    legacyAuthorId: 'sample-yuna',
    title: '透明感の韓国風',
    tags: ['ツヤ肌'],
    durationMinutes: 20,
    products: [
      { productId: 'template-base', usage: '自分の肌色に合う薄づきの色' },
      { productId: 'template-brow-powder', usage: '淡いグレイッシュブラウン' },
      { productId: 'template-brow-pencil', usage: '眉尻だけ細く描き足す' },
      { productId: 'template-eye-shadow', usage: '淡いピンクベージュ' },
      { productId: 'template-highlight', usage: '淡いパール' },
      { productId: 'template-cheek', usage: '透けるピンク' },
      { productId: 'template-lip', usage: 'ローズレッドのティント' },
    ],
    steps: [
      step(
        'base',
        'ベース',
        '薄く均一なツヤ肌に',
        '肌色に合う薄づきベースを中央から外へ',
        '薄づきのツヤ系ベース',
        ['#E5C8BB'],
        koreanBaseShape,
      ),
      browStep(
        '淡い平行眉に整える',
        '眉頭はパウダーで淡く、眉尻だけ描き足す',
        '#76645C',
        browShapes.flat,
      ),
      step(
        'eye',
        'シャドウ',
        'ピンクベージュを薄く',
        '上まぶた全体と下まぶた中央に少量のせる',
        'アイシャドウ',
        ['#D7ABA8'],
        naturalEyeShape,
      ),
      step(
        'highlight',
        'ハイライト',
        '鼻筋と頬骨に細く光を',
        'パールを少量ずつ置き、境目をぼかす',
        'ハイライト',
        ['#F4E4DC'],
        koreanHighlightShape,
      ),
      step(
        'cheek',
        'チーク',
        '頬の高い位置に透けるピンク',
        '薄く重ねてベースのツヤを残す',
        'チーク',
        ['#DEA2AB'],
        koreanCheekShape,
      ),
      step(
        'lip',
        'リップ',
        '唇の内側を濃く',
        'ローズレッドを中央に置き、外へぼかす',
        'リップティント',
        ['#C85669'],
        koreanLipShape,
      ),
    ],
  },
  {
    id: 'brow-straight-flat',
    legacyAuthorId: 'sample-mio',
    title: '平行眉',
    part: 'brow' as const,
    summary: '淡い眉頭と水平なライン',
    tags: ['初心者OK', 'ナチュラル'],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉山を抑えて水平に',
        '眉頭はパウダー、眉山の下と眉尻だけペンシルで足す',
        '#79685D',
        browShapes.flat,
      ),
    ],
  },
  {
    id: 'brow-soft-arch',
    legacyAuthorId: 'sample-mio',
    title: '微アーチ眉',
    part: 'brow' as const,
    summary: '眉山を少しだけ上げる自然な形',
    tags: ['初心者OK', 'ナチュラル'],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉山を少し上げて描く',
        '眉尻は眉頭より下げず、毛の隙間だけ描き足す',
        '#795F50',
        browShapes.softArch,
      ),
    ],
  },
  {
    id: 'brow-arch',
    legacyAuthorId: 'sample-mio',
    title: 'アーチ眉',
    part: 'brow' as const,
    summary: 'なだらかな山と細い眉尻',
    tags: ['丸顔向け'],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉山を上げて弧を描く',
        '眉山から細い眉尻へつなぎ、眉頭は淡く',
        '#705848',
        browShapes.arch,
      ),
    ],
  },
  {
    id: 'brow-straight',
    legacyAuthorId: 'sample-mio',
    title: 'ストレート眉',
    part: 'brow' as const,
    summary: '角度を抑えた直線的な眉',
    tags: ['初心者OK'],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉頭から眉尻まで直線的に',
        '下のラインをそろえ、眉尻は細く終える',
        '#624B40',
        browShapes.straight,
      ),
    ],
  },
  {
    id: 'brow-rising',
    legacyAuthorId: 'sample-mio',
    title: '上がり眉',
    part: 'brow' as const,
    summary: '眉尻へ向けて角度をつける',
    tags: [],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉山から眉尻を高めに',
        '少しずつ角度を足し、眉頭は濃くしない',
        '#624B40',
        browShapes.rising,
      ),
    ],
  },
  {
    id: 'brow-falling',
    legacyAuthorId: 'sample-mio',
    title: '下がり眉',
    part: 'brow' as const,
    summary: '眉尻を少し下げた柔らかな形',
    tags: ['ナチュラル'],
    durationMinutes: 3,
    products: browProducts,
    steps: [
      browStep(
        '眉尻を少しだけ下げる',
        '眉頭は淡く、下げる幅を小さくして細く終える',
        '#806A5C',
        browShapes.falling,
      ),
    ],
  },
];

/** Update only the twelve known templates. User-created recipes, posts and favorites are untouched. */
export async function syncRecipeTemplates(db: Database) {
  await db.transaction(async (tx) => {
    await tx
      .insert(user)
      .values({
        id: 'nuri-editorial',
        name: 'nuri',
        email: 'nuri-editorial@example.invalid',
      })
      .onConflictDoNothing();
    for (const { id, ...fields } of products) {
      await tx
        .insert(product)
        .values({ id, ...fields })
        .onConflictDoUpdate({ target: product.id, set: fields });
    }
    for (const [
      index,
      { id, legacyAuthorId, products: used, steps, ...fields },
    ] of recipeTemplates.entries()) {
      const values = {
        ...fields,
        authorId: 'nuri-editorial',
        image: `/sample-recipes/${id}.jpg`,
        source: null,
        likeCount: 0,
      };
      const updated = await tx
        .insert(recipe)
        .values({
          id,
          ...values,
          createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
        })
        .onConflictDoUpdate({
          target: recipe.id,
          set: values,
          setWhere: inArray(recipe.authorId, [legacyAuthorId, 'nuri-editorial']),
        })
        .returning({ id: recipe.id });
      if (!updated.length) {
        continue;
      }
      await tx.delete(recipeProduct).where(eq(recipeProduct.recipeId, id));
      await tx.delete(recipeStep).where(eq(recipeStep.recipeId, id));
      if (used.length) {
        await tx
          .insert(recipeProduct)
          .values(used.map((item, position) => ({ recipeId: id, position, ...item })));
      }
      if (steps.length) {
        await tx
          .insert(recipeStep)
          .values(steps.map((entry, position) => ({ recipeId: id, position, ...entry })));
      }
    }
  });
  return { recipes: recipeTemplates.length };
}

export const templateRecipeIds = recipeTemplates.map(({ id }) => id);
export const templateProductIds = products.map(({ id }) => id);
