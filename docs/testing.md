# 検証

## 自動検査

```sh
bun run check
bun run dev:api      # 別ターミナルで起動し、migration完了を待つ
bun run test:integration
bun run doctor
bun run export:mobile
```

APIのDB不要のBunテストは `apps/api/src` から自動検出し、`*.integration.test.ts` は実PostgreSQL用のコマンドに分ける。認証の統合テストは実行ごとに一意なメールアドレスと送信元IPv6を使い、終了時にその実行のユーザーとレート制限行を削除する。開発・CI用DBに対して実行する。画像を扱う統合テストは、専用のFlociバケットを `GCS_BUCKET` と `STORAGE_EMULATOR_HOST` で指定する。Compose起動時にworktree専用バケットが作成される。

GitHub Actionsでは静的検査、Bunのユニットテスト、Jestの2 shard、HonoとPostgreSQLの統合テスト、ChromiumのWeb E2E、AndroidのMaestro、ネイティブバンドル、コンテナ、OpenTofu検査を並列で実行する。`All CI Checks` は各ジョブの成功を集約する。検査・Expo Doctor・バンドル生成はBunで実行する。Honoの配信用コンテナはイメージ内のNode.jsで疎通を確認する。

| 検査                     | 確認すること                                                  |
| ------------------------ | ------------------------------------------------------------- |
| ESLint・型・Bun          | workspace間の依存方向、環境設定、HTTP契約、Gitと起動CLIの境界 |
| Bun・実PostgreSQL・Floci | migration、認証・認可、保存された状態と画像配信               |
| Jest・jest-expo          | ネイティブ境界を差し替えた画面の状態と操作                    |
| 実Compose・Portless      | 各構成の解決、起動、HTTPS、worktree間の分離と永続化           |
| 開発ビルド               | 仮想端末でのTLS、Metro、Fast Refresh、認証の戻り先            |

`Native Bundle Build` はExpo DoctorとiOS／Androidのexportを実行し、`mobile-bundles` を保存する。

モバイルの `src` は `bun run lint` でReact DoctorのOxlintプラグインも実行する。Effectの解除漏れや不安定な依存、TanStack Queryのクライアント再生成や購読範囲、React Nativeのリストと条件付き描画を検査する。ルールは `oxlint.config.ts` で指定し、違反はローカルとCIの両方でエラーになる。

React Queryを使う画面テストでは `apps/mobile/src/lib/test/query-client.tsx` のfixtureを使う。テストごとにキャッシュを分離し、`gcTime: Infinity` でJest終了を妨げるタイマーの登録を防ぐ。

OpenTofuの認証不要の検査は次のコマンドで実行する。過去の検証記録には旧プロジェクト名や当時の構成を含む。

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

### Fallow

`bun run deadcode` と `bun run dupes` は `bun run check` とCIの `Static Analysis` で共通して実行する。未使用コード・依存関係などの警告、パース失敗、理由のない抑制、不要になった抑制をエラーとして扱う。自動・手動のエントリも未使用exportを検査する。重複は40トークン以上かつ5行以上の断片が2か所以上にあれば失敗する。Fallow既定のテスト・生成ファイルの除外を使い、既存重複のベースラインは設けない。

失敗したら同じコマンドをローカルで再実行し、出力されたパスと行番号を確認する。同じ規則を実装していれば共有し、独立に保つ必要がある場合は理由を添えて対象だけを抑制する。検出条件や抑制の変更はPRで根拠を示す。

`.fallowrc.json` の手動エントリはコンテナ起動時の `scripts/preview-ready.ts` とActionsの候補検査で呼ぶ `.github/scripts/preview/check.ts`。依存の除外はExpoとBabelがビルド時またはネイティブ側で使うパッケージ、トンネル用の `@expo/ngrok`、ESLintの設定経由で使うresolverに限る。

## PRに残す検証結果

1. 検証したコミットSHA、環境・クライアント、操作またはコマンド、観測した結果を書く。CIやバンドル、端末での操作、外部サービスを経由した検証を分ける。変更箇所に影響する差分を追加したら確認し直す。以前の証拠を引用するときは取得したSHAを示す。
2. UI変更では[PortlessとExpo Device Hub](setup.md#simulatorとemulatorで開発する)で対象画面を操作し、確認できた画像・動画を先に添付する。画像の直下に、端末・クライアントと確認した操作を添える。WebのUIを変更した場合は対象ブラウザーでも確認する。構成図やFigmaの画像は説明に使う。
3. 未確認の項目と理由を書く。指定された確認が止まったら、確認済みの結果と再開に必要な条件を共有する。テスト通知や別の検証アプリの結果には、その条件を明記する。

以下は記入例。

- **プロフィール設定** — 対象 `<SHA>`。Android EmulatorのExpo Goで顔タイプを選んで保存し、画面を開き直して値が残ることを確認。操作後の画像を添付。iOSの確認は未実施で、Simulatorが必要。
- **iOSの画像付き通知** — 対象 `<SHA>`。iOS Simulatorのnuri開発ビルドでテスト通知を注入し、通知の文面とタップ後の遷移を確認。バンドルとCIの結果は別記。APNs経由の受信と拡張によるサムネイル取得は未確認で、[対応するビルドとAPNs認証情報](setup.md#プッシュ通知)が必要。

## iOS / Android 共通の実機チェック

1. `bun run db:seed` 後、メイクタブの①に全体メイクの見本レシピが並び、狐メイクから⑤（タグ・取り込み元・使うメイク品）を開けることを確認する。再実行して件数が増えず、利用者が投稿したレシピが残ることも確認する。
2. ⑤の作者の行→プロフィール→戻る。
3. 未ログインのお気に入り／⑫の撮影はログインへ進む。GoogleのEmulate同意から復帰し、セッションが保持されることを確認する。
4. プロフィール編集とログアウト。表示情報と操作行が区別され、再起動後のセッション・設定が維持されることを確認する。
5. 端末の外観をダークにしてもアプリの配色はライトのままか確認し、文字を最大へ拡大する。全タブ、読み込み中・エラー・空の状態、ログイン、シートで見切れ・操作不能がないことを確認する。変更に応じて、キーボードやセーフエリア、再試行、戻る操作とシートを閉じる操作も試す。
6. ローカルのメール認証を変更した場合は単回リンクの失効・他端末での拒否を確認する。互換開発ビルドではパスキーの登録・ログイン・削除を確認し、Expo Goではパスキーの制約が伝わることを確認する。
7. API停止時のエラーと再試行。OS関連付け・実プロバイダでの認証はローカルEmulate／仮想WebAuthnの検証と別に記録する。

## Expo WebのE2E

Playwrightでエクスポート済みのExpo Webを起動し、Hono APIとPostgreSQLを経由してサンプルレシピを読む。Chromiumでスマートフォン・横向きタブレットの一覧、URL直アクセス、手順と完成、比較のドラッグを検査する。カメラ拒否後の見本と、仮想カメラの開始・停止も検査する。CIでは専用の使い捨てPostgreSQLとFlociを使い、失敗時にトレースを保存する。

ローカルでは次のように専用DBを起動する。停止するとこのコンテナのデータは消える。

```sh
docker run --rm --publish 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=nuri_e2e -e POSTGRES_PASSWORD=nuri_e2e postgres:17.7-bookworm

# 別ターミナルでFlociを起動する。GCSのみなのでDocker socketは不要。
docker run --rm --publish 127.0.0.1:4588:4588 floci/floci-gcp:0.12.0
```

DBが起動したら別のターミナルで実行する。

```sh
bunx --bun playwright install --no-shell chromium
bun run test:e2e
```

テストはDBへmigrationとseedを実行し、Honoがエクスポート済みのExpo WebとAPIを49116で同一オリジン配信する。別の使い捨てローカル環境を使う場合は `NURI_E2E_DATABASE_URL` と `NURI_E2E_STORAGE_EMULATOR_HOST` を設定する。テスト失敗時のトレースは `.artifacts/playwright/` に残る。ネイティブの画面操作は以下のMaestro、実カメラと顔追跡は端末で検証する。

## Maestro

GitHub Actionsの `Native E2E (Maestro Android)` は公式Expo Go APKをAndroidエミュレーターにインストールし、同じコミットのMetroからアプリを起動する。ゲストのプロフィールと設定への遷移を確認する。GitHub標準ランナーで実行し、EAS Build枠の消費は0。失敗時の診断は `maestro-android-debug` に保存する。

`apps/mobile/.maestro/showcase.yaml` が未ログイン時のホーム・プロフィール・設定フローを検証する。開発サーバーを必要としないpreview/simulatorビルドで実行する。

```sh
maestro test apps/mobile/.maestro/showcase.yaml
```

クラウド実行例は `docs/examples/native-e2e.yml`。2026-11-05の実アカウントでの検証では、EASのMaestroジョブに有料プランが必要だったため、未使用のサンプルとして置いている。契約後に `apps/mobile/.eas/workflows/native-e2e.yml` へコピーし、`eas workflow:validate`を通してから実行する。iOS E2Eのために各開発者のMacを必須にしない。

JestはExpo UIのネイティブ境界をmockするため、SwiftUI/Composeの実描画を保証しない。bundle生成、型検査、mock付きテストと、実機での確認は区別して記録する。

## 2026-11-06の認証付きSNSの検証

- `bun run check` が成功。Jestは5 suites／21 testsで、いいねの対象行だけの更新・全件再取得なし・並行更新の失敗復元・プロフィールキャッシュ、日時の粒度、文字サイズと色クラスの併用を含む。import境界の許可／禁止パターンはBunで確認した。
- 実PostgreSQLとVercel Emulateの統合テストは3 tests／58 assertions成功。Google／AppleのOAuth、アカウント連携、magic linkの単回性・native callback、WebAuthn署名・origin・リプレイ拒否、投稿の所有者認可といいねの冪等性を確認した。認証の迂回用エンドポイントは追加していない。
- Expo Doctorは20/20成功。iOS／Androidのbundle生成とNode向けAPI buildが成功した。
- 開発DBでseedを再実行し、画像付きユーザー4件・サンプル投稿8件が重複せず、既存の利用者投稿2件が保持された。アバターはAPIの静的配信から取得した。
- iPhone 17 Pro Simulator／iOS 26.5／Expo Goで実APIとseedを使用。角丸カードと8ptのカード間隔、右寄せしたいいね・共有、投稿者→プロフィール→戻る、共有シート、アカウント情報と操作行の区別を確認した。いいね2→3→2で投稿の位置が変わらない操作を動画に記録した。
- ライト／ダークの切替を確認し、独自の文字サイズクラスが文字色を消していた不具合を共通のtailwind-merge設定で修正した。プロフィールではSimulatorの文字拡大操作後も本文が折り返された。最大アクセシビリティ文字サイズと全画面の組み合わせは未確認。
- ログイン画面で黒地の公式AppleボタンとGoogleの多色ロゴを確認。Google Emulateからアプリへ復帰し、元のテストユーザーで再ログインした。投稿シートは初期高さとキーボード表示時の拡張・投稿操作領域を確認した。CUAの文字入力が反映されなかったため、この操作による新規投稿完了は未確認である。

Androidのネイティブ実行、iPhone実機、実Google／Appleプロバイダ、メール実配送、OS関連付けを使う実機パスキー、Maestroは未実施。Expo Goではnative passkeyを無効にし、代わりのログイン方法を案内する。追加のネイティブ依存・associated domainsを使うには新しい互換ビルドが必要である。DBは追加migrationを適用する。GCP apply・本番配信・OTA公開は実行していない。

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

## 2026-11-06のHTTPS切替の検証

- 標準の `<service>.<repo>-<worktree ID>.localhost` を維持し、PortlessをHTTPS/443、APIの開発認証URL・許可origin・Metroのproxy URLをHTTPSへ変更した。worktree-init、Compose project名、DB・volume名は変更していない。
- 他の開発環境のHTTP proxyを維持するため、Git管理外の専用stateで検証用HTTPS proxyを443に起動した。OSの信頼ストアは変更せず、検証用CAを明示して証明書を検証した。
- 1 worktreeで新規の依存導入・DB初期化・migration・API/Metro起動が成功。API `/ready`、Metro `/status`、iOS manifestとHTTPS bundle取得、HTTP/2、WSSの101 handshakeが成功した。コンテナ内部の8080/8081はHTTPのまま、DBはホスト非公開である。
- HTTPS APIへの登録・セッション取得とMetro originのCORSが成功。セッションcookieにSecure・HttpOnlyが付くことを確認し、検証ユーザーは削除した。
- `bun run check` と通常/editor/tunnel/Expo GoのCompose設定検証が成功。Expo Goのトンネル構成は従来どおりMetroのproxy URLを空にして外部トンネルを使う。
- mainのUniwind構成を取り込んだ後も `bun run check` とHTTPS bundle取得が成功。生成型・Metro設定・CSS生成のCI検査を維持した。

ブラウザの警告を消すためのOSへのCA信頼登録、iPhone/Android実機での接続・認証は未実施。通常利用時はホストで `portless trust` を行う。共有HTTP proxyのHTTPSへの切替は、利用中worktreeを止めた上でホスト側で一度行い、各worktreeの停止処理からは行わない。
