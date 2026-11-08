# 開発環境と外部サービスの設定

nuriのGitHubは [Kcvl-DfHack26/nuri](https://github.com/Kcvl-DfHack26/nuri)、Expoは [@kcvlb4/nuri](https://expo.dev/accounts/kcvlb4/projects/nuri)。Expo project IDは `78c53f89-e14a-4458-b16e-fe31cea9381d`。

この文書はスターター（[ReoHakase/expo-hono-opentofu-starter](https://github.com/ReoHakase/expo-hono-opentofu-starter)、2026年11月6日）の手順を引き継いでいる。「完了済み」「登録済み」やtoken名はスターターでの記録で、nuriのGitHub・Expo・Google Cloudでの設定状況は未確認。

Google CloudのAPIキーはローカルSNS・認証開発に不要。Vercel EmulateでGoogle／Apple OAuthとメールを試せる。[認証とseed](auth.md)を参照。クラウドの初期構築にはログイン済みのGoogleアカウントと課金を有効化したプロジェクト、CIにはWorkload Identity Federationを使う。長期のサービスアカウントJSONキーは作らない。

## 1. cloneとworktreeの準備

コード・設定・文書の変更は、Issueの起票または既存Issueの確認と担当設定から始める。Issueに対応するブランチで実装・検証し、コミット・push・Draft PR作成まで進める。詳細は [AGENTS.md](../AGENTS.md#issue--branch--pr)、独自UIの追加は [UI開発手順](ui.md)を参照。

ローカルのAPI・Metro・PostgreSQLはすべてDocker Composeで動かす。ホストにGit、Docker Engine + Compose v2、Node.js 24以降、Portless **0.16.0** を用意する。Compose連携は0.16.0で追加されたため、0.15系では起動できない。ホストのBunは任意。WindowsではWSL2のLinuxファイルシステムを使う。

```sh
npm install --global portless@0.16.0
# 例: Issue 123の作業ブランチを用意してから追加
git worktree add ../nuri-123-example codex/123-example
cd ../nuri-123-example
sh scripts/worktree-init.sh
```

Composeはディレクトリ名をproject名として使う。メインのcheckoutは `nuri`、作業用は `nuri-<issue>-<topic>` とし、ホスト内で一意にする。小文字・数字・ハイフンのみ、先頭・末尾は英数字、63文字以内とする。別の親ディレクトリでも同じ名前ならコンテナ・ネットワーク・volumeを共有してしまう。POSIXの初期化処理はmount先をルートのGit管理外 `.env` へ保存する。checkoutとGit共通ディレクトリをホストと同じ絶対パスでmountするため、linked worktreeでもGitが動く。`node_modules`、ルートの生成 `.env`、DB volumeは他worktreeからコピーしない。

### 起動・接続・停止

ホストで共有HTTPS/443 proxyを一度起動する。tablecast-poc等の既存のproxyは再利用する。初回のローカルCA登録や管理者認証はホストの対話ターミナルで行う。既存proxyがHTTPの場合は、そのホストで利用中のworktreeを止め、`portless proxy stop` の後に以下のHTTPS proxyを起動する。この切替はホスト全体で一度行う。

```sh
portless proxy start --https --port 443
# CAの信頼登録を後から行う場合
portless trust
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose up --build api metro
```

Composeが依存導入・未作成のアプリenv生成・PostgreSQLのhealthcheck・migrationを行う。APIはmigration後に起動し、MetroはDBを待たず起動する。APIのみなら末尾を `api`、DBなしのMetroのみなら `metro` にする。内部ポートはAPI 8080、Metro 8081、DB 5432。Google／Apple／メールのEmulateもAPIの依存として起動する。PostgreSQLはホストへ公開せず、PortlessがHTTPサービスにloopback上の空きポートを割り当てる。

| サービス    | ホストからのURL                                |
| ----------- | ---------------------------------------------- |
| API         | `https://api.nuri-<issue>-<topic>.localhost`   |
| Metro / Web | `https://metro.nuri-<issue>-<topic>.localhost` |

URL形式は `https://<service>.<project>.localhost`。ホストと、端末用構成を使うSimulator／Emulator向けであり、iPhone／Android実機は後述のHTTPSトンネルを使う。API・Metroの内部通信は引き続きHTTPで、TLS終端はホストのPortlessが担当する。

実際のURLはPortlessが表示する。ホスト公開ポートは `portless compose port api 8080` / `portless compose port metro 8081` で確認できる。Portlessはprojectごとに割当を保持し、複数worktree間の衝突を避ける。開発では `.env` の空の `BETTER_AUTH_URL` をComposeのAPI originで補い、Metro originも許可originへ追加する。

```sh
# バックグラウンド起動
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose up -d --build api metro
# 自worktreeだけを終了。DBや認証設定のvolumeは保持する。
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose --profile '*' down
```

foregroundはCtrl+CでAPI・Metroとそのrouteを終了する。DB等の依存サービスも終了するには `portless compose --profile '*' down` を使う。detachedのrouteは `portless compose --profile '*' down` まで残る。同一worktreeへの `up` はCompose標準の再利用・更新となるため、既存コンテナへ接続する。別のworktreeは別projectとして起動する。

**API・Metroをplainな `docker compose up` で作り直すとPortlessのポート割当が失われるため、起動・再作成・終了は `portless compose` を使う。** `logs`、`exec`、`ps`、`restart` は通常のComposeでも使える。共有proxyの `stop` / `clean` / `--force` をworktreeの後片付けに使わない。

`setup` は既存アプリenvとsecretを保持する。ルート `.env` はCompose用の生成設定専用。トンネルURL等は `apps/api/.env` / `apps/mobile/.env` に置く。ローカルDBの `DATABASE_URL` はComposeが注入する。CI/Cloud Runでは明示した `DATABASE_URL` を使い、`bun run --cwd apps/api db:migrate` / `bun run --cwd apps/api test:integration` を直接実行する。

### Dev Containerで編集・検査する

worktreeをエディタで開いて **Reopen in Container** を実行する。`initializeCommand` がホストのPOSIX初期化を行い、Composeの `workspace` サービスとそのsetup・DB依存を起動する。API・Metroの公開ポートをエディタが再作成しないよう、`runServices` は編集用 `workspace` だけに限定する。

コンテナ内では `bun run check`、`bun run doctor`、`bun run export:mobile` 等を実行できる。Docker socketは渡していないため、Portlessの起動・停止コマンドはホストで実行する。エディタのport forwardは使わない。エディタを閉じてもサービスは停止しないので、作業終了時はホストで `portless compose --profile '*' down` を実行する。

自動依存導入は `--ignore-scripts` で共有Git hookを変更しない。Dev Containerの初回作成、またはホストの `bun install` / `bun run hooks:install` は同じGitリポジトリで順に行う。Lefthookが共有 `.git/hooks` を更新するためで、準備後のサーバーは並列起動できる。

### ホストのBunで短縮コマンドを使う

ホストにBun 1.4.4があれば以下のaliasを使える。サーバー本体は引き続きCompose内で動く。共通の `bun run compose <args>` がHTTPS/443設定をまとめ、BunとComposeのdotenv解釈の違いによるパスの変形を避けるため、生成したパス変数をCompose自身に読み直させる。

```sh
bun install --frozen-lockfile
bun run setup
bun run dev          # API・Metro（依存DBとmigrationを含む）
bun run dev:api      # APIとDB
bun run dev:mobile   # Metroのみ。DB不要
bun run dev:devices  # Simulator／Emulatorの開発ビルド用
bun run devices      # ホストのExpo Device Hub
bun run dev:go       # API・DBとExpo Go用トンネル付きMetro
bun run services:up  # API・DB・Metroをバックグラウンド起動
bun run db:migrate
bun run db:seed      # 4ユーザーの画像・8投稿・いいね。既存の利用者データは保持
bun run test:integration # 起動済みのDBを使用
bun run services:down
```

統合テストの前にAPIを起動する。テストコマンドは起動中のDBを使い、端末用構成で動いているAPIやEmulateを通常構成で作り直さない。

### 旧ハッシュ名から移行する

初期化を実行する前に、旧ルート `.env` の `COMPOSE_PROJECT_NAME` を控える。旧projectを起動したホストと同じPortless proxyを選び、控えた名前で対象だけを止める。

```sh
old_project='expo-hono-opentofu-starter-<旧ID>'
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose -p "$old_project" --profile '*' down
sh scripts/worktree-init.sh
```

新しい名前では空のローカルDBで開始する。旧volumeとアプリの `.env`・secretは保持し、データを自動移行しない。`down -v` や共有proxyの停止は不要。アプリenvに旧URLを明示していた場合は新URLに直す。端末用設定を再生成し、必要に応じてAndroidのhostsを更新して再ログインする。旧ルートenvが残っている間、`dev:devices` は旧projectを作り直さずに終了する。

## 2. iPhone / Android から開く

### SimulatorとEmulatorで開発する

iOS Simulator用は `development-simulator`、Android Emulator用は `development` で開発ビルドを作る。クラウドビルドは手動で起動する。ローカルではSDKを準備し、`apps/mobile` で `bunx expo run:ios --no-bundler --device` または `bunx expo run:android --no-bundler --device SERIAL` を使える。previewはMetro接続用の開発ビルドと区別する。

worktreeルートから実行する。

```sh
bun run dev:devices
# 別のホストターミナル
bun run devices
```

`dev:devices` は選択したPortlessの公開HTTPS URLから、Git管理外の `.env.devices` と `.env.devices.hosts` を生成する。既存のアプリenvは上書きしない。別のHTTPS proxyを使う場合は、起動・CA取得・停止の全コマンドに同じ `PORTLESS_STATE_DIR` をexportする。HTTP proxyしか選ばれていない場合はコンテナの再作成前に停止する。

- **iOS Simulator:** `xcrun simctl list devices available` で対象を選び、`xcrun simctl keychain SIMULATOR_UDID add-root-cert "${PORTLESS_STATE_DIR:-$HOME/.portless}/ca.pem"` を実行する。macOSの名前解決は同じproxyを選んで `portless hosts sync` で同期する。
- **Android Emulator:** `adb devices -l` で対象serialを確認し、`adb -s SERIAL push "${PORTLESS_STATE_DIR:-$HOME/.portless}/ca.pem" /sdcard/Download/portless-ca.crt` で公開CAを送る。Emulatorのセキュリティ設定からCA証明書として登録する。ユーザーCAを信頼するのはnuriのdebugビルドのlocalhostのみ。この設定を使うには開発ビルドを作り直す。
- **Androidの名前解決:** AOSPまたはGoogle APIsの開発用AVDを `emulator -avd AVD_NAME -writable-system -no-snapshot` で起動する。対象serialだけで `adb -s SERIAL root` と `adb -s SERIAL remount` を行い、`adb -s SERIAL pull /system/etc/hosts .env.devices.android-hosts` で既存hostsを取得する。remountがverity解除と再起動を求める場合は、そのAVDに限り `adb -s SERIAL disable-verity` と `adb -s SERIAL reboot` の後でroot／remountをやり直す。既存行を残して `.env.devices.hosts` の自project分をマージし、`adb -s SERIAL push .env.devices.android-hosts /system/etc/hosts` で戻す。最後に `adb -s SERIAL reverse tcp:443 tcp:443` を実行する（標準以外はhelperが表示したポートを使う）。AVDを終了したらhosts、端末を再起動したら転送を再確認する。

HubはXcode／Android SDKがあるOSで起動する。WindowsではComposeはWSL2、HubとADBはWindows側で使う。Dev ClientのEnter URLにはhelperが表示するMetroのHTTPS URLを入れる。MetroがFast Refreshを担当し、Hubは画面表示と操作を担当する。CAの秘密鍵は端末へコピーしない。

終了時はHubをCtrl+C、サービスは `bun run services:down` で自worktreeだけを止める。ADBの転送を共有する他のworktreeがないときだけ、対象serialの `adb -s SERIAL reverse --remove tcp:443` で転送を外す。通常構成に戻すには `bun run dev` を使う。端末用overrideは明示した起動時だけ読み込まれる。

### Expo Goで実機を確認する

同じworktreeで起動中のMetroがあればCtrl+Cで止め、ホストのworktreeルートから実行する。

```sh
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose \
  -f compose.yaml -f compose.go.yaml up --build api metro
```

`compose.go.yaml` はMetroのコマンドだけを `expo start --go --tunnel ngrok --port 8081` へ変更する。表示されたQRコードをSDK 58対応のExpo Goで開く。iPhone・AndroidともPCと同じLANでなくても接続できる。SDK 58の既定ExpoトンネルはExpoログインを要求するため、ここでは導入済みの `@expo/ngrok` を明示して使う。URLは実行中だけ有効。

標準構成のMetroは `--lan`、`apps/mobile` には `tunnel` / `go` コマンドも残す。コンテナのLANアドレスは実機から直接到達できないため、実機はトンネル構成を使う。ホストブラウザではPortlessのMetro URLを開く。端末に `.localhost` を設定しない。

Composeでは空の `EXPO_PUBLIC_API_URL` を `app.config.ts` が開発API originで補う。Compose外でAPI未設定の場合、ホームには接続案内を表示する。タイムライン・投稿・いいねにはAPIが必要で、外観・触覚だけが端末内設定。

### ローカルAPIも実機から使う

Expo GoトンネルはMetro専用なので、APIには別のworktree別HTTPSトンネルを使う。起動中のAPIに対してホストで実行する。

```sh
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose --profile tunnel up -d api-tunnel
portless compose logs api-tunnel
```

ログの `https://....trycloudflare.com` を使い、次の2ファイルを編集する。

| ファイル           | 値                                                  |
| ------------------ | --------------------------------------------------- |
| `apps/api/.env`    | `BETTER_AUTH_URL=https://....trycloudflare.com`     |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL=https://....trycloudflare.com` |

`portless compose restart api metro` で環境ファイルを読み直す。APIの `.env.example` には開発専用の `exp://**` originが含まれている。共有の本番APIにこのワイルドカードを入れない。実機の `localhost` は端末自身を指すため、localhost URLをモバイルへ設定しない。

Cloudflareトンネルは外向きTCP 7844が必要。`curl https://....trycloudflare.com/ready` が `{"status":"ready"}` になれば、タイムラインの閲覧・投稿を確認できる。Google／AppleのローカルEmulateは `.localhost` のため、APIトンネルだけでは実機OAuthを完了できない。実機認証には到達可能な検証APIと実プロバイダ設定を用意する。トンネルを作り直すとURLが変わる。普段は安定したstaging Cloud Run URLも使える。実機・公開トンネルの確認範囲は [docs/testing.md](testing.md) に記録する。

### Development BuildとPRプレビュー

Expo Goは初期確認に使う。PRのExpo Updateをインストールして試すにはDevelopment Buildを使う。

```sh
cd apps/mobile
bunx eas login
bunx eas project:info
bunx eas build --profile development --platform ios
bunx eas build --profile development --platform android
```

iPhone実機への内部配布にはApple Developer Program、端末登録、署名情報が必要。初回は対話形式で `bunx eas device:create` / `bunx eas credentials` を実行して登録する。Apple側の契約・端末承認はIaCで代替できない。クラウドビルドはEASの利用枠を消費する。

EASの `development` のAndroidビルドは、ビルド用マシンでGradleがメモリ不足で落ちたため、`eas.json` でGradleのworkerを2つに絞り、ABIを `arm64-v8a` と `x86_64` に限っている。32bit ARMの端末には入らない。この設定でのEASのビルドはまだ確かめていない。

2026年11月7日時点で、試したApple IDはApple Developer Programに入っておらず、`bunx eas device:create` がAppleに拒否されたため、iPhoneのDevelopment Buildはまだ作れていない。Developer ProgramのチームにいるApple IDで、試す人のiPhoneを先に `bunx eas device:create` で登録してからビルドする（登録していない端末には入らない）。AndroidのAPKは端末の登録なしで入れられる。

顔追跡（`apps/mobile/modules/face-tracker`、MediaPipe Face Landmarker）はネイティブモジュールのため、Expo Goでは動かずDevelopment Buildが必要。Development Buildでは⑦（レシピの「メイクをはじめる」）と⑩で、カメラの映像に今の手順の塗る範囲を重ねる。ネイティブモジュールや依存を変えたら、新しいDevelopment Buildを作る（OTAでは届かない）。

Androidのネイティブコードは手元でもコンパイルを確かめられる。JDK 17とAndroid SDK（Platform 37.0、Build-Tools 37.0.0、NDK 27.1.12297006、CMake 3.22.1）を入れ、`JAVA_HOME` と `ANDROID_HOME` を設定する。生成される `android/` はコミットしない。

```sh
cd apps/mobile
CI=1 bunx expo prebuild --platform android --no-install
cd android && ./gradlew :app:assembleDebug
```

実機がないときは、Android StudioのエミュレーターとPCのウェブカメラで顔追跡の動作を確かめられる。エミュレーターはカメラの映像とGPUの命令を変換して渡すため、fpsと遅延は中位の端末の性能を表さない。Android Studioの初回設定（Standard）でSDKとエミュレーターを入れると、足りないNDK・CMake・Build-ToolsはGradleが入れる。AVDの `~/.android/avd/<AVD名>.avd/config.ini` で `hw.camera.front=webcam0` にする（使えるカメラは `emulator -webcam-list` で分かる）。`-gpu host` はPCのGPUで画面を描き、`-qemu -cpu host` はAVX2などをエミュレーターの中に見せてCPUの推論を速くする。ウェブカメラを挿し直したら、スナップショットが古いデバイスを開いたままになるため `-no-snapshot-load` で起動し直す。

```sh
~/Android/Sdk/emulator/emulator -avd <AVD名> -gpu host -memory 4096 -no-snapshot-load -qemu -cpu host
cd apps/mobile/android
./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
```

アプリを開いて開発サーバー `http://127.0.0.1:8081` を選び、レシピの⑤から「メイクをはじめる」で⑦を開く。この方式ではMediaPipeのGPU推論が毎フレーム失敗し、150フレーム後にCPUに切り替わる（エミュレーターのカメラでは約10秒）。GPUで動くことだけを確かめるときは `-feature GuestAngle` を足す（1回約400msかかる）。

このリポジトリはEASに接続済みで、`build:configure` / `update:configure`も実行済み。設定はfingerprint runtime policy、development/preview/production channel。フォーク時は `eas init`、`eas build:configure`、`eas update:configure` で自分のプロジェクトへ再接続する。

## 3. GitHubとExpoの手動設定

### GitHub Actions

通常のCIはsecretなしで動く。PRでは `All CI Checks` から、静的検査、各テスト、バンドル、コンテナ、OpenTofuの結果を確認できる。

**Settings → Environments → production** は作成済みで、利用できるブランチをmainだけに制限している。フォーク時は作成し、必要に応じてrequired reviewerを指定する。デプロイ先の変数を設定する。

| 種別                 | 名前                             | 値・取得元                                                      |
| -------------------- | -------------------------------- | --------------------------------------------------------------- |
| Repository Variable  | `GCP_DEPLOY_ENABLED`             | 現在 `true`。停止時は `false`                                   |
| Environment Variable | `GCP_PROJECT_ID`                 | 対象GCP project ID                                              |
| Environment Variable | `GCP_REGION`                     | 例: `asia-northeast1`                                           |
| Environment Variable | `CLOUD_RUN_SERVICE`              | OpenTofuの `name`                                               |
| Environment Variable | `ARTIFACT_REPOSITORY`            | OpenTofuの `name`                                               |
| Environment Variable | `CLOUD_RUN_MIGRATION_JOB`        | `<name>-migrate`                                                |
| Environment Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `tofu output -raw workload_identity_provider`                   |
| Environment Variable | `GCP_SERVICE_ACCOUNT`            | `tofu output -raw deploy_service_account`                       |
| Repository Variable  | `EXPO_UPDATE_ENABLED`            | 現在 `false`。本番API、EAS環境、署名済みビルドの準備後に `true` |
| Environment Secret   | `EXPO_TOKEN`                     | 登録済み。ExpoのCI用access token                                |

例（値を確認してから実行）:

```sh
gh variable set GCP_PROJECT_ID --env production --body YOUR_PROJECT_ID
gh variable set GCP_REGION --env production --body asia-northeast1
# tokenは引数やGit管理ファイルへ書かず、対話入力する
gh secret set EXPO_TOKEN --env production
```

Google CloudのAPIキーやサービスアカウントJSONをGitHub Secretに登録する必要はない。`EXPO_TOKEN`はExpo account settingsのAccess Tokensから発行する。リポジトリ内、`EXPO_PUBLIC_*`、Issue本文へ貼らない。

登録したtokenの名称は `GitHub Actions: ReoHakase/expo-hono-opentofu-starter production`。対象を `reohakase` アカウントに限定し、権限は `VIEW` / `RUN` / `PUBLISH`。アカウント管理権限は含めない。更新時は同じ制限のtokenを発行してEnvironment Secretを差し替え、旧tokenを失効させる。

### 手動preview配信（GitHub Actions）

PRの **previewを配信** をチェックすると、そのコミットのExpo Web、Hono API、Expo Go QRをコメントに載せる。mainのstaging配信とは別に動く。[PRプレビューの使い方と初期設定](preview.md)

### Expo GitHub連携・環境変数

スターターではExpoのログイン、EAS project、GitHubリポジトリの接続を完了し、プロジェクトのGitHub設定のBase directoryを `/apps/mobile` にした。nuriの [プロジェクトのGitHub設定](https://expo.dev/accounts/kcvlb4/projects/nuri/github) は未確認のため、下の手順で確認する。Expo側にあった自動PR preview・手動preview workflowは削除し、GitHub Actionsへ統一した。

フォーク・再設定時は以下を行う。

1. Expo dashboardでGitHub Appを対象リポジトリへ接続し、Base directoryを `apps/mobile` にする。
2. ExpoのEnvironment Variablesで `EXPO_PUBLIC_API_URL` をdevelopment/preview/productionそれぞれに設定する。公開URLなのでvisibilityはplain text。previewは共有staging API、productionは本番API。ローカル `.env` はクラウドへアップロードしない。未設定なら接続案内が表示され、SNS機能は利用できない。
3. PRプレビューを使う環境では、GitHubの `preview` EnvironmentにCloud Runプレビュー用WIFを設定する。[プレビューの初期設定](preview.md#初期設定)

`apps/mobile/.eas/workflows/native-builds.yml` は手動でiOS SimulatorとAndroid preview APKを作る。Development Buildが必要なら `ios_profile=development-simulator`（Simulator）または `development`（実機）、Androidは `android_profile=development` を選ぶ。iOS実機用にはApple署名が必要。本番は従来どおり、APIデプロイ成功後だけ `production-update.yml` を呼び出す。両方ともExpo Workflows側の実行となる。

Apple/Googleストアの契約・署名は別途必要で、TestFlight/ストア提出は自動実行しない。初期設定のビルド・端末確認記録は [検証](testing.md) を参照する。

## 4. Google Cloudの準備（認証情報が用意できてから）

### プロジェクト・課金・ローカル認証

Google Cloud Consoleでプロジェクトを作成して課金アカウントを接続する。初期構築担当には、API有効化、IAM/サービスアカウント、Cloud SQL、Run、Secret Manager、Storage、Artifact Registryを作成できる権限が必要。組織ポリシーでpublic Cloud RunやWIFが禁止されている場合は管理者側の設定が必要。

```sh
gcloud auth login --no-launch-browser
gcloud auth application-default login --no-launch-browser
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com storage.googleapis.com
```

認証済みGCPプロジェクトへの変更はこの手順以降で発生し、Cloud SQL等に料金がかかる。`kcvlb4` の `nuri-staging` は2026年11月7日に作成した。別環境で再実行する前に既存のstateとリソースを確認する。

### 適用の時期・規模・費用

nuriは作成済みのプロジェクト（クレジット約$40）を使う。

- 時期：11月8〜9日に適用する。P0はレシピをサーバーのデータで出すため、11月10日19:00の提出時点でCloud RunのAPIが動いている必要がある。最初は `deploy_application=false` でCloud SQL等を作り、APIのイメージができたら `true` にする。
- 規模：`infra/` の既定値のまま使う。Cloud SQLは `db-f1-micro`（共有コア、ZONAL、SSD 10GB）、Cloud Runは1 vCPU・512MiB・0〜3台。APIの接続プールは1台あたり5本なので、3台でも15本で `db-f1-micro` の上限25本に収まる。`db-f1-micro` はCloud SQLのSLAの対象外だが、審査のデモには足りる。
- 止める時期：11月14日（Regional Day）の後。決勝に進んだら11月27日（Demo Day）の後。Cloud SQLは停止中もストレージとIPv4アドレスに課金されるため、残す必要がなければ削除する。手順は[止め方](#止め方)に書いた。クレジットの有効期限が先に来る場合は、その前に止める。

費用はasia-northeast1の料金表（2026年11月7日確認）で見積もった。合計は1日約$0.41で、11月8日から動かすと11月14日までで約$3、11月27日までで約$8。

| 項目                    | 単価・無料枠                                                                | 1日あたり         |
| ----------------------- | --------------------------------------------------------------------------- | ----------------- |
| Cloud SQL `db-f1-micro` | $0.014/時                                                                   | $0.34             |
| Cloud SQL SSD 10GB      | $0.00030274/GiB・時                                                         | $0.07             |
| Cloud SQLのバックアップ | $0.000142466/GiB・時（1GB未満の見込み）                                     | $0.01未満         |
| Cloud Run               | 毎月18万vCPU秒・36万GiB秒・200万リクエストまで無料（課金アカウント単位）    | 0（無料枠の範囲） |
| Artifact Registry       | 0.5GBまで無料、超えた分は$0.000136986/GiB・時。同じリージョンへの転送は無料 | 数セント          |
| Secret Manager          | 有効なバージョン6個・アクセス1万回まで無料                                  | 0                 |

料金表：[Cloud SQL](https://cloud.google.com/sql/pricing)、[Cloud Run](https://cloud.google.com/run/pricing)、[Artifact Registry](https://cloud.google.com/artifact-registry/pricing)、[Secret Manager](https://cloud.google.com/secret-manager/pricing)。

### State bucketのbootstrap

```sh
tofu -chdir=infra/bootstrap init
tofu -chdir=infra/bootstrap plan -var='project_id=YOUR_PROJECT_ID'
tofu -chdir=infra/bootstrap apply -var='project_id=YOUR_PROJECT_ID'
```

bootstrapのstateもbucketへ移す。`backend.tf` は生成ファイルとしてGit対象外。

```sh
cp infra/bootstrap/backend.tf.example infra/bootstrap/backend.tf
tofu -chdir=infra/bootstrap init -migrate-state \
  -backend-config='bucket=YOUR_PROJECT_ID-tofu-state' \
  -backend-config='prefix=bootstrap'
```

### アプリ用リソースの作成

```sh
cp infra/backend.hcl.example infra/backend.hcl
cp infra/terraform.tfvars.example infra/terraform.tfvars
# bucket/project_id/region/nameを編集
# github_repository_id はこのリポジトリでは 1447386190
# フォークでは gh api repos/OWNER/REPO --jq .id で取得
```

stagingとproductionは別のstate prefix、resource name、認証secret、DBを使う。最初は例の `nuri-staging` / `nuri/staging` を作成する。productionを用意するときは別の作業コピーで `name=nuri-production`、prefix `nuri/production` を設定し、stagingのstateを上書きしない。

```sh
tofu -chdir=infra init -backend-config=backend.hcl
# 一度生成した値はpassword managerへ保存し、以後のplan/applyでも同じ値を使用する
export TF_VAR_database_password="$(openssl rand -hex 32)"
tofu -chdir=infra plan
tofu -chdir=infra apply
```

初回は `deploy_application=false`。Cloud SQL、DBユーザー、Artifact Registry、Secret Managerの器、WIF/IAMまで作成し、未準備のイメージをCloud Runへ起動しない。

DBパスワードはephemeral/write-onlyのためstateに保存しない。次回は保存したパスワードを `TF_VAR_database_password` に設定する。ローテーション時は `database_password_version` も増やし、対応するSecret Manager値とアプリのrevisionも更新する。

### IaCで管理しないsecretの値

以下は自分のproject/nameへ置き換える。DB URLにはCloud SQLのUnix socketを使い、一般公開のDB接続許可は作らない。

```sh
export GCP_PROJECT=YOUR_PROJECT_ID
export RESOURCE_NAME=nuri-staging
SQL_CONNECTION=$(tofu -chdir=infra output -raw sql_connection_name)
printf 'postgresql://expo-hono-opentofu-starter:%s@localhost/expo-hono-opentofu-starter?host=/cloudsql/%s' \
  "$TF_VAR_database_password" "$SQL_CONNECTION" | \
  gcloud secrets versions add "$RESOURCE_NAME-database-url" --project="$GCP_PROJECT" --data-file=-
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets versions add "$RESOURCE_NAME-auth-secret" --project="$GCP_PROJECT" --data-file=-
```

値はstdoutへ出さずstdinで渡す。`.tfvars`、GitHub、ExpoへDBパスワードを転記しない。

Google・メールのログインは、Google OAuthクライアントとResendの送信設定を用意した後に有効にする。OpenTofuでsecretの器を作り、各値をSecret Managerのバージョンへ入れてから、`google_oauth_enabled`・`email_login_enabled`と`email_from`を設定して再適用する。Android仮想端末での手順、戻り先リンクの制約は[認証の設定と検証](auth.md#android仮想端末でgoogleとメールを試す51)を参照する。

### 初回イメージ・サービス・migration

Docker操作はDockerを使えるホストで行う。Dev Container内にはホストのDocker socketを渡していない。

```sh
REGISTRY=$(tofu -chdir=infra output -raw registry)
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
# Cloud Run向けはホストCPUにかかわらずlinux/amd64を生成する
docker buildx build --platform linux/amd64 -f apps/api/Dockerfile \
  -t "$REGISTRY/api:bootstrap" --push .
gcloud artifacts docker images describe "$REGISTRY/api:bootstrap" \
  --format='value(image_summary.digest)'
```

表示されたdigestを使い、`terraform.tfvars` の `image` を `<registry>/api@sha256:...`、`deploy_application=true` に設定する。トラフィックを受けるサービスより先にmigrationを行うため、最初の適用だけはmigrationのjobを先に作る。

```sh
# 1. migrationのjobだけを作り、DBへmigrationを適用する
#    DBとDBユーザーは deploy_application=false の適用で作成済みであることが前提
tofu -chdir=infra plan -target='google_cloud_run_v2_job.migrate[0]'
tofu -chdir=infra apply -target='google_cloud_run_v2_job.migrate[0]'
gcloud run jobs execute nuri-staging-migrate --region=asia-northeast1 --wait
# 2. サービスと公開設定を作る
tofu -chdir=infra plan
tofu -chdir=infra apply
API_ORIGIN=$(tofu -chdir=infra output -raw service_uri)
curl --fail "$API_ORIGIN/ready"
```

サービスのstartup probeは `/ready`（DBへ `SELECT 1`）を使う。DB URLやsecretが誤っているとrevisionが起動せず、applyが失敗する。このときCloud Runのサービスだけが作られ、OpenTofuのstateには残らない。secretを直してから `gcloud run services delete nuri-staging --region=asia-northeast1` で消し、もう一度applyする（`deletion_protection` はOpenTofu側の設定なので、gcloudでは消せる）。liveness probeは `/health` のままにし、DBが一時的に落ちてもインスタンスを再起動しない。

初回の `api_origin` はサービス作成前に実URLが分からないため暫定値になる。`service_uri` と一致しなければ、`terraform.tfvars` の `api_origin` に `service_uri` を設定し、再度 `tofu plan` と `tofu apply` を行う。これでCloud Runの `BETTER_AUTH_URL` も実URLに変わる。`kcvlb4` では初回の推定URLと実URLが異なったため、この2回目の適用を行った。最後に両方の出力が一致することを確認する。custom domainを使う場合はDNS/ドメインマッピングを別途設定し、`api_origin`にそのHTTPS URLを渡す。

### CIからのデプロイを有効にする

nuriのリポジトリには、2026年11月7日にGitHub Environment `production` を作成し、利用可能なブランチをmainだけに制限した。別のリポジトリで未作成なら、先に同じ設定で作る。

```sh
gh api -X PUT repos/Kcvl-DfHack26/nuri/environments/production \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/Kcvl-DfHack26/nuri/environments/production/deployment-branch-policies \
  -f name=main -f type=branch
```

production Environmentの変数をOpenTofuの出力から設定する。値を確認してから実行する。

```sh
gh variable set GCP_PROJECT_ID --env production --body YOUR_PROJECT_ID
gh variable set GCP_REGION --env production --body asia-northeast1
gh variable set CLOUD_RUN_SERVICE --env production --body "$(tofu -chdir=infra output -raw cloud_run_service)"
gh variable set ARTIFACT_REPOSITORY --env production --body "$(tofu -chdir=infra output -raw artifact_repository)"
gh variable set CLOUD_RUN_MIGRATION_JOB --env production --body "$(tofu -chdir=infra output -raw migration_job)"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --env production --body "$(tofu -chdir=infra output -raw workload_identity_provider)"
gh variable set GCP_SERVICE_ACCOUNT --env production --body "$(tofu -chdir=infra output -raw deploy_service_account)"
gh variable set GCP_DEPLOY_ENABLED --body true
gh workflow run deploy.yml --ref main
```

以後、mainの成功したCIから「Expo Webを同梱したイメージ作成 → migrationのjob → candidateで `/ready` とWeb配信の検査 → トラフィック切替」の順に動く。migrationが失敗したらデプロイは止まり、今のrevisionがトラフィックを受け続ける。Expo側にproduction API URLとビルドを用意してから `EXPO_UPDATE_ENABLED=true` を設定すると、最後にExpo Updateを配信する。

### Webを開く

```sh
tofu -chdir=infra output -raw expo_web_url
bun .github/scripts/check-expo-web.ts "$(tofu -chdir=infra output -raw service_uri)"
```

`expo_web_url` は既存のCloud Runサービスの既定HTTPS URLを指す。Web同梱イメージの配備後は、同じホストの `/` がExpo Web、`/api/**` がHono、`/_expo/static/**` と `/assets/**` が静的ファイルになる。レシピ直リンクはSPAで開ける。将来のLP用 `/about/` は現時点では404を返す。WebはアクセスしたホストのAPIを使い、共有する正規URLはOpenTofuの `api_origin` と揃える。Google OAuthのリダイレクト先は既存どおり正規URLの `/api/auth/callback/google` を使う。

アプリから読むには、ExpoのEnvironment Variablesの `EXPO_PUBLIC_API_URL`（previewとproduction）に `service_uri` を設定する（[Expo GitHub連携・環境変数](#expo-github連携環境変数)）。

2026年11月7日の初回公開では、このブランチのOpenTofu設定を適用してmigration jobとCloud Runサービスを作成した。その後、[mainのデプロイ](https://github.com/Kcvl-DfHack26/nuri/actions/runs/42372457055)（`ce37dd2`）でmigration・candidateの `/ready`・トラフィック切替が成功した。CIはOpenTofuの変更を適用しないため、IaCの検証結果とは分けて扱う。実サービスのstartup probeが `/ready` であることを確認し、`https://nuri-staging-v3kjfarita-an.a.run.app` の `/health`・`/ready`・`/api/recipes` が200で応答した。Expoのdevelopment・preview・production環境の `EXPO_PUBLIC_API_URL` もこのURLに設定した。Androidエミュレーターの開発ビルドでメイク画面の空状態を確認し、Cloud Runのログでアプリからの `GET /api/recipes?offset=0` が200で応答した。iOS実機は未確認。DBはmigrationのみで、レシピ一覧は空。開発用seedを本番DBへ実行せず、アプリでレシピを表示するためのデータは #30 の方針に従って用意する。

CIはトラフィックを特定のrevisionへ固定する。そのため、CIのデプロイ後に `tofu apply` で環境変数などを変えると、新しいrevisionはトラフィック0%で作られる。変更後は `gh workflow run deploy.yml --ref main` で配信し直すか、`gcloud run services update-traffic nuri-staging --region=asia-northeast1 --to-latest` で切り替える。

### 稼働の確認

`tofu` のstateを読めない人は `gcloud run services describe nuri-staging --region=asia-northeast1 --format='value(status.url)'` でURLを得る。

```sh
API_ORIGIN=$(tofu -chdir=infra output -raw service_uri)
curl --fail "$API_ORIGIN/health"       # {"status":"ok"}：プロセスが応答する
curl --fail "$API_ORIGIN/ready"        # {"status":"ready"}：DBへ接続できる
curl --fail "$API_ORIGIN/api/recipes"  # アプリが読むレシピ一覧
# どのrevisionがトラフィックを受けているか
gcloud run services describe nuri-staging --region=asia-northeast1 --format='yaml(status.traffic)'
# 直近のログとmigrationの実行結果
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="nuri-staging"' --limit=50
gcloud run jobs executions list --job=nuri-staging-migrate --region=asia-northeast1 --limit=5
```

GitHub Actionsの **Deploy API and mobile update** の実行結果でも、migrationと `/ready` の成否を確かめられる。最後にアプリでレシピ一覧が表示されることを確かめる。Cloud Runは0台まで縮むため、しばらくアクセスがないと最初の応答に数秒かかる。

### 止め方

止める度合いに応じて選ぶ。上から順に影響が大きくなる。

1. **CIからのデプロイだけ止める**：`gh variable set GCP_DEPLOY_ENABLED --body false`。動いているAPIはそのまま残る。
2. **APIの公開を一時的に止める**：`gcloud run services update nuri-staging --region=asia-northeast1 --ingress=internal`。外部からのリクエストは届かなくなる。次の `tofu apply` で公開に戻る（`ingress` をOpenTofuが管理しているため）。
3. **Cloud SQLを一時的に止める**：`gcloud sql instances patch nuri-staging --activation-policy=NEVER`。APIもDBへ接続できなくなり、新しいインスタンスは `/ready` を通らないため、リクエストはすべて失敗する。時間課金は止まるが、ストレージとIPv4アドレスの課金は続く。再開は `--activation-policy=ALWAYS`。次の `tofu apply` でも起動する。
4. **すべて削除する**（11月14日の後。決勝に進んだら11月27日の後）：DBのデータは戻せない。残す必要があれば先に書き出す。

```sh
gh variable set GCP_DEPLOY_ENABLED --body false
# plan/applyと同じDBパスワードを、shellの履歴に残さず入力する
read -rs TF_VAR_database_password && export TF_VAR_database_password
# deletion_protection 以外の変更が出ていないことをplanで確かめてからapplyする
tofu -chdir=infra plan -var=deletion_protection=false
tofu -chdir=infra apply -var=deletion_protection=false
tofu -chdir=infra destroy -var=deletion_protection=false
```

`deletion_protection` はCloud SQL・Cloud Runのサービス・migrationのjobのOpenTofuからの削除を防ぎ、Cloud SQLではGCP側の削除防止も有効にする。`false` で一度applyして両方を解除してからdestroyする。stateのbucket（`infra/bootstrap`）は `prevent_destroy` のため残る。費用は月数セント以下。削除するとstateも失うため、不要になったときに手動で消す。Workload Identity Poolは削除後30日間は同じIDで作り直せない（`gcloud iam workload-identity-pools undelete` で戻す）。Cloud SQLのインスタンス名も削除後しばらく再利用できない。

## 5. ハーネスと検証

```sh
codex mcp login expo
bun run check
bun run test:integration
bun run doctor
bun run export:mobile
```

Codexはrootの `AGENTS.md` と `.agents/skills` を使う。Expo MCPは `.codex/config.toml` に設定済み。このホストでは `codex mcp login expo` のOAuthも完了済み。MCPのOAuth、Expo CLIのログイン、GitHubの接続はそれぞれ認証する。別のホストやDev Containerでは各自ログインし、認証データはリポジトリへコピーしない。

詳細な実機手順とMaestroの有料プラン条件は [testing.md](testing.md)。インフラだけの `fmt` / `init -backend=false` / `validate` / TFLintはGCP認証なしで実行できる。
