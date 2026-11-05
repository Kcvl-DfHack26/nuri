# 検証

## 自動検査

```sh
bun run check
bun run db:migrate
bun run test:integration
bun run doctor
bun run export:mobile
```

integration testは専用の一意なメールアドレスを使い、終了時にそのユーザーだけを削除する。開発/CI用DBに対して実行する。

```sh
tofu fmt -check -recursive infra
tofu -chdir=infra init -backend=false -lockfile=readonly
tofu -chdir=infra validate
tofu -chdir=infra/bootstrap init -backend=false -lockfile=readonly
tofu -chdir=infra/bootstrap validate
tflint --init
tflint --chdir=infra --config="$PWD/.tflint.hcl"
tflint --chdir=infra/bootstrap --config="$PWD/.tflint.hcl"
```

## iOS / Android 共通の実機チェック

1. Todayからmorningを開く。詳細、戻る操作、タブの状態を確認する。
2. お気に入り登録・解除。LibraryのSavedで反映されることを確認する。
3. 検索、該当なし、検索の消去による復帰を確認する。
4. 完了を押し、シートをボタン/スワイプ/Android Backで閉じる。Todayの進捗が増え、同日の重複記録が起こらないことを確認する。
5. 外観をSystem/Light/Darkに切り替える。目標を変えてTodayの分母が変わること、触覚設定が操作に反映されることを確認する。
6. アプリを終了して再起動し、端末内設定とお気に入りが保持されることを確認する。
7. 文字サイズを大きくし、小さい端末でも画面をスクロールして全操作に届くことを確認する。
8. API設定時はAccountで登録・ログイン・ログアウトする。キーボードで操作が隠れないこと、通信切断でも入力が失われず再試行できることを確認する。
9. API未設定時はオフライン案内、API停止時は接続エラーと再試行を確認する。

## Maestro

`apps/mobile/.maestro/showcase.yaml` が主要な詳細・保存・完了フローを検証する。開発サーバーを必要としないpreview/simulatorビルドで実行する。

```sh
maestro test apps/mobile/.maestro/showcase.yaml
```

クラウド実行例は `docs/examples/native-e2e.yml`。2026-11-05の実アカウントでの検証では、EASのMaestroジョブに有料プランが必要だったため、未使用のサンプルとして置いている。契約後に `apps/mobile/.eas/workflows/native-e2e.yml` へコピーし、`eas workflow:validate`を通してから実行する。iOS E2Eのために各開発者のMacを必須にしない。

JestはExpo UIのネイティブ境界をmockするため、SwiftUI/Composeの実描画を保証しない。bundle生成、型検査、mock付きテストと、実機での確認は区別して記録する。

## 2026-11-05の初期設定検証

- [GitHub CI](https://github.com/ReoHakase/expo-hono-opentofu-starter/actions/runs/41992135095): `2388c8b` のquality / infrastructure / containerが成功。lint・型・Bun/Jest・PostgreSQL認証統合テスト・Expo Doctor・両OSのbundle・OpenTofu/TFLint・Nodeコンテナーの起動を含む。
- [PR自動preview](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/workflows/01a1aac0-058d-7452-9edb-5b69be862cb7): 同じcommitで両OSのupdate公開とPRコメントが成功。
- [手動preview配信](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/workflows/01a1aac0-7f64-7679-b78c-e0fd098d1d3d): 同じcommitで成功。
- [iOS Simulatorビルド](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/builds/e473f917-7fc8-4930-bb93-2608408f03bf)と[Android preview APK](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/builds/43dce5d8-35a5-4990-bc67-2167e3445017)が成功。ビルド元は `9d35603`。その後のシート修正とBabel runtime変更はJavaScriptのみで、iOSのfingerprintが同一であることも確認した。
- ローカルiPhone 17 Pro Simulator / iOS 26.5のExpo Goで `2388c8b` を起動。Today→詳細→戻る、保存→LibraryのSaved絞り込み、完了シートの本文とDone、同日の重複完了防止、進捗1/3への反映、検索の該当なし、ダークモード、触覚設定の切り替えを確認した。完了シートの画像は [PR #5](https://github.com/ReoHakase/expo-hono-opentofu-starter/pull/5) に添付。

iPhone実機とAndroid端末での操作、日次目標スライダー、文字サイズ拡大、シートのスワイプ/Android Back、再起動後の保持、公開API経由の認証は未確認。Androidのビルド成功は操作確認の代わりにはしない。GCP本番デプロイと本番OTA、ストア提出は実行していない。
