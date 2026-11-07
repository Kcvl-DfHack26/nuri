import { purchaseUrlSchema } from '@starter/shared';
import { eq } from 'drizzle-orm';

import type { Database } from './client';

import { like, post, product, recipe, recipeProduct, recipeStep, user } from './schema';

// Development sample data. Every row has a stable ID and is upserted, so running the seed again
// neither duplicates rows nor removes or rewrites data created through the app.
// Image sources and licenses: apps/api/assets/*/README.md.
const people = [
  { id: 'sample-haru', name: 'はる', image: '/sample-avatars/haru.jpg' },
  { id: 'sample-sora', name: 'そら', image: '/sample-avatars/sora.jpg' },
  { id: 'sample-yui', name: 'ゆい', image: '/sample-avatars/yui.jpg' },
  { id: 'sample-ren', name: 'れん', image: '/sample-avatars/ren.jpg' },
  { id: 'sample-mio', name: 'mio', image: '/sample-avatars/mio.png' },
  { id: 'sample-kana', name: 'kana', image: null },
  { id: 'sample-yuna', name: 'yuna', image: null },
];
const socialPeople = people.slice(0, 4);
const posts = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'sample-haru',
    body: '近所の公園を散歩してきました\n少しずつ葉の色が変わっていて、秋を感じます🍂',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId: 'sample-sora',
    body: '気になっていた本を読み終えました\n\n読み始めると、つい時間を忘れてしまう。週末は本屋さんに寄って帰ろうかな📚',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId: 'sample-yui',
    body: '朝のコーヒーがうまく淹れられた☕️\nそれだけで、ちょっといい一日になりそう',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    userId: 'sample-ren',
    body: '今日はひと駅ぶん歩いて帰ることにした\nいつも通らない道に小さなパン屋さんを発見。こういう寄り道が好き',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    userId: 'sample-haru',
    body: '週末、晴れたら海を見に行きたい',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    userId: 'sample-yui',
    body: '初めて作ったスープがおいしくできたので、レシピをメモしておいた\n\n玉ねぎをゆっくり炒めるのが大事らしい。次はきのこを入れてみよう🍄',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    userId: 'sample-sora',
    body: '窓を開けたら風が気持ちいい\n今日は音楽を聴きながら部屋の片付け',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    userId: 'sample-ren',
    body: '夕焼けがきれいだった\n写真にはうまく写らなかったけど、しばらく眺めていた',
  },
];
const products = [
  {
    id: 'celane-brow-pencil',
    name: 'CELANE 極細アイブロウペンシル',
    image: '/sample-recipes/product-brow-pencil.jpg',
    purchaseUrl: null,
  },
  {
    id: 'mousse-cheek',
    name: 'ムースチーク',
    image: '/sample-recipes/product-cheek.jpg',
    // The products are fictional, so the link searches a real shop for the name instead of
    // pointing at a made-up product page. Plan A shows 買う only on this one.
    purchaseUrl: purchaseUrlSchema.parse(
      `https://www.amazon.co.jp/s?k=${encodeURIComponent('ムースチーク')}`,
    ),
  },
];
type SeedStep = Omit<typeof recipeStep.$inferInsert, 'recipeId' | 'position'>;

// Plan A's ⑦ steps for fox, the only recipe Plan A details.
const foxSteps: SeedStep[] = [
  {
    part: 'brow',
    label: '眉',
    title: '眉尻を濃く、眉頭は淡く',
    hint: 'スクリューブラシで眉頭の毛を立てる',
    product: 'アイブロウ（微アーチ眉）',
    colors: ['#79513A'],
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: '目尻側から横長にぼかす',
    hint: '中間・締め色は目頭側へ薄く',
    product: 'アイシャドウ（ベース・中間・締め）',
    colors: ['#E5B58A', '#C56D42', '#713E2C'],
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '黒目の外側から徐々に太く',
    hint: '目尻は斜め上に跳ね上げ三角を埋める',
    product: 'アイライン',
    colors: ['#38251D'],
  },
  {
    part: 'shading',
    label: 'シェード',
    title: '骨の凹みに沿って滑らせる',
    hint: '外側から内側へ境目を馴染ませる',
    product: 'シェーディング',
    colors: ['#A17B60'],
  },
  {
    part: 'cheek',
    label: 'チーク',
    title: 'こめかみへ斜め上に滑らせる',
    hint: '頬骨の高い位置から丸く広げない',
    product: 'チーク',
    colors: ['#B8754F'],
  },
];

// ③'s brow styles, one step each. Their photos are cells of Plan A's brow style sheet. Plan A
// recommends アーチ眉 for round faces (#47); the other tags are sample values.
function browStep(title: string, hint: string): SeedStep {
  return { part: 'brow', label: '眉', title, hint, product: 'アイブロウ', colors: ['#79513A'] };
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
    steps: [],
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
    steps: [],
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
    steps: [],
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
    steps: [browStep('眉山を作らず平行に描く', '眉頭から眉尻まで高さをそろえる')],
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
    steps: [browStep('眉山をほんの少しだけ上げる', '眉尻は眉頭より下げない')],
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
    steps: [browStep('眉山をなだらかな弧でつなぐ', '眉頭は淡く、眉山から眉尻へ細くする')],
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
    steps: [browStep('眉頭から眉尻へまっすぐ描く', '下側のラインをそろえて直線にする')],
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
    steps: [browStep('眉尻に向かって角度をつける', '眉山を外側に置き、縦の印象を足す')],
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
    steps: [browStep('眉尻をやや下げて描く', '眉頭はふんわり、眉尻は細く')],
  },
];

export async function seedSampleData(db: Database) {
  await db.transaction(async (tx) => {
    for (const person of people) {
      await tx
        .insert(user)
        .values({ ...person, email: `${person.id}@example.invalid` })
        .onConflictDoUpdate({ target: user.id, set: { name: person.name, image: person.image } });
    }
    for (const [index, item] of posts.entries()) {
      // Stable seed IDs only: never remove or rewrite posts created through the app.
      await tx
        .insert(post)
        .values({ ...item, createdAt: new Date(Date.now() - (index + 1) * 30 * 60 * 1000) })
        .onConflictDoUpdate({ target: post.id, set: { body: item.body } });
      for (const person of socialPeople.slice(0, 1 + (index % 4))) {
        await tx.insert(like).values({ postId: item.id, userId: person.id }).onConflictDoNothing();
      }
    }
    for (const { id, ...item } of products) {
      await tx
        .insert(product)
        .values({ id, ...item })
        .onConflictDoUpdate({ target: product.id, set: item });
    }
    for (const [index, { products: used, steps, ...item }] of recipes.entries()) {
      const values = { ...item, image: `/sample-recipes/${item.id}.jpg` };
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
  return { users: people.length, posts: posts.length, recipes: recipes.length };
}
