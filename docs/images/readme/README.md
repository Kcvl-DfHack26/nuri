# README掲載画像

## PRとREADMEに載せる図

構成やデータの流れを伝える図を作成・更新するときは、リポジトリの [`diagram-design`](../../../.agents/skills/diagram-design/SKILL.md) を読む。導入元は [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)。作業用のworktreeにスキルを追加し直す場合は、ルートで次を実行する。

```sh
bunx skills add cathrynlavery/diagram-design --agent codex --skill diagram-design --copy --yes
```

1. 対象の実装と文書を照合し、読者が図で確かめる内容を決める。初回はスキルのスタイル設定を確認し、nuriの配色と読みやすい日本語のラベルを使う。図の中でも実装済みと予定を区別する。
2. スキルに従ってHTMLとSVGで図を作り、ブラウザーで日本語の表示、ラベル、矢印、欠けを確認する。公開用には[スキルの書き出し手順](../../../.agents/skills/diagram-design/references/export.md)に従ってPNGにし、GitHubで使う幅でも読めることを確かめる。
3. READMEの画像はこのディレクトリに置き、代替テキストと根拠となる実装・文書へのリンクを添える。PRの画像は `github-issue-pr-ops` の添付手順を使い、説明の近くに埋め込んで表示を確認する。

## Figmaのデザイン

2026年11月9日に[Figma Plan A](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=21-11426)（現在の名前は「実装plan」）からPNGを取得した。Figmaファイルの編集は行っていない。

| ファイル                | 対象                   | 参照ノード                                                                        |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `figma-home.png`        | ① ホーム（全体メイク） | [115:4109](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=115-4109) |
| `figma-ar.png`          | ⑦-1 眉                 | [278:8548](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=278-8548) |
| `figma-step-editor.png` | ⑫-5 手順を編集         | [218:7196](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=218-7196) |

これらはデザインの紹介であり、実アプリのスクリーンショットや動作確認の証拠ではない。デザイン中の投稿・件数・ガイド等は見本で、現在の実装と異なる場合がある。エミュレーターの撮影画像は含めていない。

## 構成図

2026年11月10日に [main の `d6a8884`](https://github.com/Kcvl-DfHack26/nuri/tree/d6a888426ac812717a2924e340bb12fd445cf5f3) を参照し、`diagram-design` で作成した。配色とZen Maru Gothicは[nuriのFoundations](../../../apps/mobile/global.css)に合わせた。各HTMLのインラインSVGが編集元で、READMEには同じ図のPNGを掲載する（実行構成は2880×1952、開発と配信は2880×1720）。

| 図         | 編集元                                                   | 照合先                                                                                                                                                                      |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実行構成   | [architecture-runtime.html](architecture-runtime.html)   | [Hono API](../../../apps/api/src/app.ts)・[プライバシー要件](../../requirements.md#5-非機能要件)・[画像ストレージ](../../setup.md#共有環境の画像ストレージ)                 |
| 開発と配信 | [architecture-delivery.html](architecture-delivery.html) | [共有stagingへの配信](../../../.github/workflows/deploy.yml)・[PRプレビュー](../../preview.md)・[ネイティブ版の配布](../../../.github/workflows/staging-mobile-release.yml) |

- 共有stagingは同じSHAの[配信実行](https://github.com/Kcvl-DfHack26/nuri/actions/runs/42624368331)でDBマイグレーション・候補検証・公開切替が成功した。本番EAS Updateの工程はスキップされた。公開APIの `/ready` と `/media/` の見本画像応答を確認した。
- ネイティブ版の[プレリリース](https://github.com/Kcvl-DfHack26/nuri/releases/tag/staging-42600942374)には、`c883922` から作ったAndroid APKとiOS Simulator用アプリがある。アプリのインストールや通知の実配送は確認範囲に含まない。
- 実行構成図は、端末・Cloud Run・各保存先を分け、Google SDKのIDトークンとOAuthの経路を示す。実行構成図の破線は、認証情報を設定した環境で使う通知経路を表す。開発と配信の図の破線はOpenTofuがリソースを管理する関係を示す。[通知の設定](../../setup.md#プッシュ通知)・[認証](../../auth.md)

### 構成図のロゴとアイコン

Expo・Hono・Drizzle ORM・React・OpenTofu・Vertex AIは下記の既存SVGを再利用した。Googleは[アプリ同梱の公式素材](../../../apps/mobile/assets/auth/README.md)を使った。Cloud Run、Cloud SQL、Cloud Storage、Secret Manager、Artifact Registryは[Google Cloudの公式アイコン集](https://cloud.google.com/icons)の旧コンソール版を使った。

Better AuthとGoogle Cloudのロゴは[SVGL](https://github.com/pheralb/svgl)、GitHub Actionsは[Simple Icons](https://github.com/simple-icons/simple-icons)、顔・ブラシ・ブラウザーの記号は[Lucide](https://github.com/lucide-icons/lucide)の素材を使った。各ロゴは各権利者に帰属する。

## 紹介用ロゴ

冒頭はアプリに同梱済みの`apps/mobile/assets/images/icon.png`を使用。nuriの新しいロゴは作成していない。

技術スタック表には取得済みSVGを使い、明暗のテーマで見えるよう白い台座を付けた。元のロゴの形・色は変更していない。

| ファイル           | ロゴ         | 元データ                                                                                                                          |
| ------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `logo-expo.svg`    | Expo         | [取得元](https://svgl.app/library/expo.svg)                                                                                       |
| `logo-react.svg`   | React Native | [取得元](https://svgl.app/library/react_light.svg)                                                                                |
| `logo-hono.svg`    | Hono         | [取得元](https://svgl.app/library/hono.svg)                                                                                       |
| `logo-vertex.svg`  | Vertex AI    | [取得元](https://services.google.com/fh/files/misc/core-products-icons.zip#Unique%20Icons/Vertex%20AI/SVG/VertexAI-512-color.svg) |
| `logo-drizzle.svg` | Drizzle ORM  | [取得元](https://svgl.app/library/drizzle-orm_light.svg)                                                                          |
| `logo-tofu.svg`    | OpenTofu     | [取得元](https://raw.githubusercontent.com/opentofu/brand-artifacts/main/symbol-only/transparent/SVG/on-light.svg)                |
