import { connectDatabase } from './db/client';
import { like, post, user } from './db/schema';
import { readEnv } from './platform/env';

const env = readEnv();
if (env.NODE_ENV !== 'development' || !env.AUTH_EMULATE) {
  throw new Error('Sample data is only available in local emulation');
}
const { db, pool } = connectDatabase(env.DATABASE_URL);
const people = [
  { id: 'sample-haru', name: 'はる', image: '/sample-avatars/haru.jpg' },
  { id: 'sample-sora', name: 'そら', image: '/sample-avatars/sora.jpg' },
  { id: 'sample-yui', name: 'ゆい', image: '/sample-avatars/yui.jpg' },
  { id: 'sample-ren', name: 'れん', image: '/sample-avatars/ren.jpg' },
];
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
try {
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
      for (const person of people.slice(0, 1 + (index % 4))) {
        await tx.insert(like).values({ postId: item.id, userId: person.id }).onConflictDoNothing();
      }
    }
  });
  console.log('Local sample data ready: 4 users with avatars and 8 posts');
} finally {
  await pool.end();
}
