# モバイルの作業指示

- [リポジトリ全体の作業指示](../../AGENTS.md)に従う。Expo SDK 58とReact Native 0.88はロックファイルで管理する。
- 対象のFigmaノードと既存ルートを確認し、[UIの規約](../../docs/ui.md)に沿ってiOS・Androidで実装する。設定などの標準操作には共通 `@expo/ui` を優先し、iOS固有の実装にはAndroidで動く代替を用意する。
- ExpoのAPIを使う前にSDK 58の公式文書と導入済みの型を確認する。ネイティブ依存はこのディレクトリで `bunx expo install` を使い、生成された `ios/` と `android/` を手で編集しない。
- `bun run typecheck`、`bun run test`、`bun run doctor`、`bun run export` はこのディレクトリで実行できる。lintはルートの `bun run lint` を使う。
- 端末の接続・撮影には[PortlessとExpo Device Hubの手順](../../docs/setup.md#simulatorとemulatorで開発する)を使う。対象機能に合わせてExpo Goか互換開発ビルドを選ぶ。
- `EXPO_PUBLIC_*` に秘密情報を入れない。
