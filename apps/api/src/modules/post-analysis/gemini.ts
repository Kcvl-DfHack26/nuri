import type { PostAnalysis } from '@starter/shared';

import { ApiError, GoogleGenAI } from '@google/genai';
import { cheekSchema, postAnalysisSchema, recipeStepsMax } from '@starter/shared';
import { z } from 'zod';

/** A video from ⑫-3 and the times (seconds) the user tapped 手順を区切る while recording. */
export type PostVideo = { data: Uint8Array; mimeType: string; marks: number[] };
/** Turns a video into the draft of its steps; replaced by a fake in tests. */
export type PostAnalyzer = (video: PostVideo) => Promise<PostAnalysis>;

const model = 'gemini-3.8-flash';

/**
 * What Gemini answers before the times are read and the cosmetics are checked by search. Times
 * are "m:ss" text: asked for seconds, Gemini wrote 1:07 as 107 (#185).
 */
const answerSchema = postAnalysisSchema.extend({
  steps: z
    .array(
      postAnalysisSchema.shape.steps.element.extend({
        start: z.string().trim().max(12),
        end: z.string().trim().max(12),
        // Checked after the answer, so a malformed color reads as unknown instead of failing.
        color: z.string().trim().max(20).nullable(),
        // Gemini always answers the blush type, null outside a cheek step (#224).
        cheek: cheekSchema.nullable(),
      }),
    )
    .max(recipeStepsMax),
  cosmetics: z
    .array(
      postAnalysisSchema.shape.cosmetics.element
        .pick({ brand: true, name: true, category: true, confidence: true })
        .extend({ evidence: z.string().trim().max(200) }),
    )
    .max(10),
});
/**
 * Keeps only the JSON Schema keywords Vertex AI accepts for structured output. Lengths, bounds and
 * formats are dropped here and checked by Zod on the answer instead.
 */
export function geminiJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => geminiJsonSchema(item));
  }
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }
  const kept = ['type', 'properties', 'items', 'enum', 'required', 'nullable', 'description'];
  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, value]) => {
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        return [
          [
            key,
            Object.fromEntries(
              Object.entries(value).map(([name, child]) => [name, geminiJsonSchema(child)]),
            ),
          ],
        ];
      }
      return kept.includes(key) ? [[key, geminiJsonSchema(value)]] : [];
    }),
  );
}
const answerJsonSchema = geminiJsonSchema(z.toJSONSchema(answerSchema, { target: 'openapi-3.0' }));

const verificationSchema = z.object({ found: z.boolean() });

// The words in postRegionSchema with their meaning, so Gemini picks names instead of numbers.
const prompt = `あなたはメイクの手順書を作るアシスタントです．入力は，利用者がインカメラで自分を撮ったメイク動画です．
次のことをJSONで答えてください．
- title: レシピの題名（20字程度）．summary: メイク全体の説明（80字程度）．
- steps: 手順ごとの区間（start・end は動画の先頭からの時刻を「分:秒」で書く．例：0:05，1:07．1分を過ぎた時刻は 107 ではなく 1:07 と書く），部位（part），利用者向けの短い説明（description，60字程度，「〜する」の形）．
  part は base=ベース，brow=眉，eye=アイシャドウ，lash=アイライン，cheek=チーク，shading=シェーディング，highlight=ハイライト，lip=リップ．
- cosmetics: 動画に映っているコスメ．パッケージの文字が読めない場合は推測しすぎず confidence を low にし，存在が確かでない商品名を作らない．evidence に判断の根拠を書く．steps[].cosmetics には使ったコスメの番号を入れる．
- 利用者が話した内容も，部位・説明・コスメ・色・塗った範囲の判断に使う．
- steps[].color: その手順で塗った色を #RRGGBB で書く．同じ部位でも工程ごとに色が違えば別の色にする（例：黒のライン，オレンジのシャドウ）．決める手がかりは次の順に使う．1. 利用者が話した色名・商品名・色番，2. 映っているパッケージやパレットの色，3. 実際に塗った所の色（照明で変わるので最後に使う）．どれでも決められなければ null にする．部位から思いつく色で埋めない．

steps[].regions には，その手順で実際に色を足した範囲を書く．もともと眉毛や唇の色があった所でも，色を足していない所は入れない．
- detail: 範囲の詳しい説明．顔の目印を基準に，始まりと終わり，形，向きを書く．
- side: screenLeft=画面の左，screenRight=画面の右，both=両方，center=中央．本人から見た左右ではなく，動画の画面で見た左右．
- start・end: 範囲の始まりと終わりの目印．終わりがなければ end は none．まぶたの範囲は，上まぶたなら upperLidEdge，下まぶた（涙袋・粘膜・下まつげの辺りを含む）なら lowerLidEdge を start か end に使う．まぶたに沿う範囲は，沿っている部分の始まりと終わりを両方答える（例：まぶた全体なら eyeInner から eyeOuter，目尻側の半分なら irisCenter から eyeOuter）．end を none にするのは，目尻などから外へ伸ばす部分だけにする．
  browHead=眉頭，browPeak=眉山，browTail=眉尻，browTailLine=小鼻と目尻を結んだ延長線上の眉の高さ，
  eyeInner=目頭，eyeOuter=目尻，irisCenter=黒目の中央，irisOuter=黒目の外側，upperLidEdge=上まぶたの縁，lowerLidEdge=下まぶたの縁，
  noseWing=小鼻，mouthCorner=口角，cheekboneTop=頬骨の最も高い位置，cheekCenter=頬の中央，temple=こめかみ，jawAngle=エラ，
  glabella=眉間，noseRoot=鼻根，noseBridge=鼻筋の中央，noseTip=鼻尖，upperLipCenter=上唇の中央，lowerLipCenter=下唇の中央，
  chin=あご先，foreheadCenter=額の中央，brow=眉全体，upperLip=上唇，lowerLip=下唇，lips=唇全体．
- shape: dot=点，line=線，band=幅のある線，ellipse=楕円，arc=線の目印に沿う弧，area=部位全体．
- length: end がないときに start から伸ばす長さ．none・short・medium・long から選ぶ．数字では答えない．太さは答えない．
- direction: outward=外側へ，inward=内側へ，upOutward=斜め上・外側へ，downOutward=斜め下・外側へ，up=上へ，down=下へ，none=なし．
- clip: 範囲をこの部位の中だけに限る場合に選ぶ（例：上唇の中央だけなら upperLip）．なければ none．

steps[].cheek には，part が cheek の手順だけ，チークの入れ方の型を答える．ほかの部位では null にする．利用者の話した言葉と，実際に塗った所に最も近い型を選ぶ．
- style: round=頬の中心に丸く（例：「頬の真ん中にふんわり」「にっこりして高い所に丸く」），high=頬骨の高い位置に横長（例：「頬骨に沿って」「高めに横に」），diagonal=頬骨からこめかみへ斜め上（例：「こめかみに向かって斜めに」「シャープに」），low=小鼻の高さに横長（例：「低めに」「小鼻の横から」），underEye=目のすぐ下に横に広く（例：「目の下に」「ハート型に」「涙袋の下に」），triangle=黒目の下・こめかみ側・小鼻の高さを結ぶ三角形（例：「三角に」「逆三角形に」「三角ゾーンに」）．
- size: small=狭め，medium=ふつう，large=広め．最初に筆を置いた所や色が濃く見える所ではなく，ぼかして広げた後に色が乗った範囲の広さで選ぶ．「ふんわり」「ぼかす」「なじませる」「広げる」「くるくる」などと言ったり，ブラシで広く動かしたりしたときは medium 以上にする．迷ったら medium にする．
- チークの regions には，目やまぶたの目印（eyeInner，eyeOuter，irisCenter，irisOuter，upperLidEdge，lowerLidEdge）を使わない．`;

/** The instructions for one video, with the user's marks when there are any. */
export function analysisPrompt(marks: number[]) {
  if (marks.length === 0) {
    return prompt;
  }
  const times = marks.map((mark) => clockText(mark)).join('，');
  return `${prompt}\n利用者は録画中に次の時刻で手順を区切りました: ${times}．これを手順の区切りの基準にし，明らかにずれている場合だけ補正してください．`;
}

/** Seconds from an "m:ss" time such as 1:07 or 0:05.5; null when the text is not one. */
export function clockSeconds(text: string) {
  const match = /^(\d{1,3}):([0-5]\d(?:\.\d+)?)$/.exec(text.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Gemini's steps with their "m:ss" times in seconds and their colors checked; a step whose time
 * cannot be read is left out.
 */
export function answerSteps<T extends { start: string; end: string; color: string | null }>(
  steps: readonly T[],
): (Omit<T, 'start' | 'end' | 'color'> & { start: number; end: number; color: string | null })[] {
  return steps.flatMap((step) => {
    const start = clockSeconds(step.start);
    const end = clockSeconds(step.end);
    // A color that is not #RRGGBB is unknown, not guessed (#203).
    const color =
      step.color && /^#[0-9A-Fa-f]{6}$/.test(step.color) ? step.color.toUpperCase() : null;
    return start === null || end === null ? [] : [{ ...step, start, end, color }];
  });
}

/** An "m:ss.s" time for seconds, e.g. 62.5 → 1:02.5, as the marks are written for Gemini. */
export function clockText(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, '0')}`;
}

/** Reads the one-line JSON a search answer starts with, also when Gemini wraps it in a fence. */
export function readVerification(text: string | undefined) {
  const match = text?.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    const parsed = verificationSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.found : null;
  } catch {
    return null;
  }
}

/** Calls Vertex AI once more when it answers 503 because of high demand. */
async function withRetry<T>(call: () => Promise<T>) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      return await call();
    }
    throw error;
  }
}

/** Gemini on Vertex AI, signed in with the runtime's Application Default Credentials. */
export function geminiAnalyzer(project: string, location: string): PostAnalyzer {
  const ai = new GoogleGenAI({ vertexai: true, project, location });

  async function verify(cosmetic: { brand: string; name: string; category: string }) {
    if (!cosmetic.name) {
      return { verified: null, sources: [] };
    }
    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents: `次のコスメについて，Google検索で実在する商品か確かめてください．
推定: ブランド「${cosmetic.brand}」，商品名「${cosmetic.name}」，種類「${cosmetic.category}」．
{"found": true か false} の1行のJSONだけを返してください．`,
          config: { tools: [{ googleSearch: {} }] },
        }),
      );
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .flatMap((chunk) =>
          chunk.web?.uri ? [{ title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri }] : [],
        )
        .slice(0, 5);
      return { verified: readVerification(response.text), sources };
    } catch {
      // A failed check keeps the guess and says it could not be checked.
      return { verified: null, sources: [] };
    }
  }

  return async ({ data, mimeType, marks }) => {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: Buffer.from(data).toString('base64'), mimeType } },
              { text: analysisPrompt(marks) },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: answerJsonSchema,
          temperature: 0.2,
        },
      }),
    );
    const answer = answerSchema.parse(JSON.parse(response.text ?? ''));
    const checks = await Promise.all(answer.cosmetics.map((cosmetic) => verify(cosmetic)));
    return postAnalysisSchema.parse({
      ...answer,
      steps: answerSteps(answer.steps),
      cosmetics: answer.cosmetics.map(({ evidence: _evidence, ...cosmetic }, index) => ({
        ...cosmetic,
        ...checks[index],
      })),
    });
  };
}
