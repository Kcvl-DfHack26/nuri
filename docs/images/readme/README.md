# README掲載画像

## Figmaのデザイン

2026年11月9日に[Figma Plan A](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=21-11426)からPNGを取得した。Figmaファイルの編集は行っていない。

| ファイル                | 対象                   | 参照ノード                                                                        |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `figma-home.png`        | ① ホーム（全体メイク） | [115:4109](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=115-4109) |
| `figma-ar.png`          | ⑦-1 眉                 | [278:8548](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=278-8548) |
| `figma-step-editor.png` | ⑫-5 手順を編集         | [218:7196](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=218-7196) |

これらはデザインの紹介であり、実アプリのスクリーンショットや動作確認の証拠ではない。デザイン中の投稿・件数・ガイド等は見本で、現在の実装と異なる場合がある。エミュレーターの撮影画像は含めていない。

## 白背景の構成図

- `architecture-runtime.png`: 実行構成。端末の顔処理、Cloud Run、Cloud SQL、Vertex AI、認証の主要経路。
- `architecture-delivery.png`: 開発・配信構成。Actionsによる処理順、EASとOpenTofuの関係。

[caru-ini/stack-diagram](https://github.com/caru-ini/stack-diagram/tree/1ed53e3e9525364ae5d82e0430f2bb3f7ef4c838)のテンプレートで作成したHTMLから、白背景のPNGを書き出した。技術ロゴはsvgl、gilbarbara/logos、Google Cloud product icons、OpenTofu、抽象的な端末機能の記号はLucideを使用。各商標は各権利者に帰属する。

図は[nuri main f0d41fe](https://github.com/Kcvl-DfHack26/nuri/tree/f0d41fe4b3dcee12d559cd52bfd8c6408ad497bb)と2026年11月9日の稼働環境を照合したスナップショット。このREADMEの基準である`6c2fdce`ではお気に入り機能が追加されているが、図の構成は変わらない。

- 顔追跡は端末のMediaPipe、診断は特徴点に基づくルール、ARはSkiaのUV描画。
- 動画解析はVertex AI上の`gemini-3.8-flash`、locationは`global`。動画はAPIのメモリ上で解析に渡し、APIで永続保存しない。
- 動画の意味情報を端末でUV形状へ変換する。動画画素から塗布輪郭を抽出する方式ではなく、生成時の色も現在は部位の既定値。[#203](https://github.com/Kcvl-DfHack26/nuri/issues/203)は改善予定。
- Webは同一originのAPIを利用する。全ネイティブ機能がWebでも動くという意味ではない。
- ネイティブのGoogle SDKでID tokenを取得してBetter Authへ渡す経路と、OAuthリダイレクトの経路がある。
- Secret Managerの値はCloud Runが環境変数として注入する。
- [Deploy run 42515520832](https://github.com/Kcvl-DfHack26/nuri/actions/runs/42515520832)でmigration・候補検証・公開切替が成功。EAS Update工程はskippedだった。
- 確認時点でProduction Infrastructureに必要な`TOFU_*`変数と`EXPO_UPDATE_ENABLED`は未登録。配備設定の将来の変更は図へ自動反映されない。

図の破線は配信の処理順または構成管理の関係で、migration Jobがサービスを直接デプロイする意味ではない。PRプレビュー・ローカル開発・全認証方式・全DBテーブルなどは省略している。詳細は[アーキテクチャ](../../architecture.md)と[セットアップ](../../setup.md)を参照。
