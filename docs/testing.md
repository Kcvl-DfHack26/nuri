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

## 2026-11-05の初期設定検証（改名前のビルド）

- [GitHub CI](https://github.com/ReoHakase/expo-hono-opentofu-starter/actions/runs/41992135095): `2388c8b` のquality / infrastructure / containerが成功。lint・型・Bun/Jest・PostgreSQL認証統合テスト・Expo Doctor・両OSのbundle・OpenTofu/TFLint・Nodeコンテナーの起動を含む。
- [PR自動preview](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/workflows/01a1aac0-058d-7452-9edb-5b69be862cb7): 同じcommitで両OSのupdate公開とPRコメントが成功。
- [手動preview配信](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/workflows/01a1aac0-7f64-7679-b78c-e0fd098d1d3d): 同じcommitで成功。
- [iOS Simulatorビルド](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/builds/e473f917-7fc8-4930-bb93-2608408f03bf)と[Android preview APK](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/builds/43dce5d8-35a5-4990-bc67-2167e3445017)が成功。ビルド元は `9d35603`。その後のシート修正とBabel runtime変更はJavaScriptのみで、iOSのfingerprintが同一であることも確認した。
- ローカルiPhone 17 Pro Simulator / iOS 26.5のExpo Goで `2388c8b` を起動。Today→詳細→戻る、保存→LibraryのSaved絞り込み、完了シートの本文とDone、同日の重複完了防止、進捗1/3への反映、検索の該当なし、ダークモード、触覚設定の切り替えを確認した。完了シートの画像は [PR #5](https://github.com/ReoHakase/expo-hono-opentofu-starter/pull/5) に添付。

iPhone実機とAndroid端末での操作、日次目標スライダー、文字サイズ拡大、シートのスワイプ/Android Back、再起動後の保持、公開API経由の認証は未確認。Androidのビルド成功は操作確認の代わりにはしない。GCP本番デプロイと本番OTA、ストア提出は実行していない。

## 2026-11-05の改名・worktree分離の検証

- `bun run check`、`bun run test:integration`、`bun run build:api` が成功。IDの安定性、引用符・空白・ドル記号を含むパス、symlink、branch変更、detached HEAD、同時setupによるsecret保持と既存envの保持をBunで確認した。
- Expo Doctorは20/20成功。SDK 58のiOS・Android bundle生成が成功。新しいアプリID・スキームに対応するネイティブビルドはまだ作成していない。
- 実際のlinked worktreeを3つ作成し、ホストのみ・コンテナのみ・ホスト2つ＋コンテナ1つでAPI `/ready` とMetro `/status` が同時に成功した。コンテナ内部はそれぞれ8080/8081、ホスト公開ポートは6個すべて異なった。
- 各DBへ異なる検証値を保存し、他worktreeの値が見えないこと、停止・再起動やホスト/コンテナの切替後も自分の値を保持することを確認した。1つの `services:down` 後も他のAPIが応答し、停止対象のDB volumeも保持された。ホストのAPI二重起動は既存プロセスを終了せず拒否された。
- コンテナ内からlinked worktreeのGit操作が成功。Turborepoの共有キャッシュ参照による起動エラーを、worktree内への明示cacheDirで解消した。API終了処理も重複signalでDB poolを二重終了しないよう修正し、3コンテナのCtrl+C終了を確認した。
- ルートとbootstrapのOpenTofu fmt/init（backend無効・lockfile読取専用）/validate、TFLintが成功。ShellCheckとGitHub Actionsのactionlintも成功。ホストにIaC CLIがないため、Dev Containerイメージ内の固定版を使用した。クラウドへのapply・配信は実行していない。
- iPhone 17 Pro Simulator / iOS 26.5のExpo Goで起動し、設定画面の新名称・オフライン案内・ダークモード・触覚Switchを確認した。SQLiteに新しい `expo-hono-opentofu-starter.preferences` キーで設定が保存されたことも確認した。日次目標SliderのAX操作ではアプリ側の値変更を確認できていない。

初回の依存導入を3つ同時に実行するとLefthookの共有hook更新が競合したため、初回install/コンテナ作成は順に実行する手順とした。Portless 0.15.8の同時route登録中に一度JSON読取警告を観測したが、登録後の全routeは正常に応答した。Dockerの容量上限により1台のReact Native DevTools取得がfallbackになった。検証専用コンテナ・volume・worktreeは終了後に削除し、通常の開発用DBと既存の旧DBは保持した。

Androidのネイティブ実行、iPhone/Android実機、公開HTTPSトンネルを通した端末認証、新アプリIDのビルド/インストールは未実施。改名前のビルド成功記録は、新しい識別子のネイティブ検証には含めない。

## 2026-11-06のPortless Compose連携の検証

- Portless 0.16.0でAPI・MetroをComposeサービスとして起動し、`/ready` / `/status` が応答した。APIはDBのTCP healthcheckとmigration完了を待つ。Metro単独起動ではDBコンテナが作られないことを確認した。
- 3 linked worktreeでAPI・Metroが同時に応答し、6つの公開ポートがすべて異なり、loopback限定であることを確認した。PostgreSQLは3つともホスト公開なし。各DBに異なる値を保存し、他worktreeの値が見えないことを確認した。
- 1つのprojectをdownしても残りのAPIが応答し、停止対象のDB volumeは保持された。再起動後も検証値を保持した。foregroundのCtrl+CでAPI・Metroとrouteが終了し、他projectと共有proxyの既存routeは保持された。`services:down` はeditorを含む全profileを終了する。
- 空白・引用符・ドル記号を含むcheckoutでComposeのmountとAPI起動が成功し、Bunの共通Compose aliasでもパスを保持できることを確認した。BunテストではIDの安定性、branch変更、detached HEAD、symlink、同時setup、secretと既存アプリenvの保持を検証した。
- API環境のBunテストで開発originの補完、明示HTTPS URLの優先、本番への開発設定の混入防止、secretを含まないエラーを検証した。通常MetroのmanifestとJavaScript bundleをPortless経由で取得し、内部8081が公開bundle URLへ混ざらないことを確認した。実APIのCORSでもMetro originが許可された。
- `compose.go.yaml` でExpo GoのQRと匿名ngrokトンネルを生成し、公開トンネルからiOS manifestを取得した。SDK 58の既定Expoトンネルはログインを要求するため、開発用コマンドは `--tunnel ngrok` を明示する。
- `bun run check`、Compose経由の認証統合テストとmigration、Expo Doctor（20/20）、iOS・Android export、通常/editor/tunnel/Expo GoのCompose設定検証が成功した。
- 既存イメージから起動した編集用workspaceでlinked worktreeのGit操作・型検査が成功し、API・MetroのPortless公開ポートも維持された。

Dockerの容量上限により、3 worktreeそれぞれへの依存の新規導入は完了しなかった。並列サービス検証ではGit管理外のoverrideで導入済みの依存volumeのみを共有し、ソース・アプリenv・DB・ネットワーク・公開ポートは分離した。標準Compose設定は依存volumeもprojectごとに分離する。

Dev Container CLI 0.90.0 / Docker Compose 5.5.0による新規buildは未完了。最初はBakeが生成Dockerfileの外部パスへのread許可を要求し、Git管理外のcheckout内をTMPDIRにして再試行した後はGoogle Cloud CLI導入中に容量不足で停止した。既存イメージでのworkspace検証と新規build成功は区別する。

iPhone/Android実機での接続・認証、新しいDev Containerイメージの初回作成、3 worktreeの完全に独立した依存導入は未確認。UIやネイティブ依存・アプリIDを変更しておらず、今回ネイティブビルド・配信・IaC applyは実行していない。
