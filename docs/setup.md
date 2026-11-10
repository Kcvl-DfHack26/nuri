# 開発環境と外部サービスの設定

nuriのGitHubは [Kcvl-DfHack26/nuri](https://github.com/Kcvl-DfHack26/nuri)、Expoは [@kcvlb4/nuri](https://expo.dev/accounts/kcvlb4/projects/nuri)。Expo project IDは `78c53f89-e14a-4458-b16e-fe31cea9381d`。

この文書は[スターター](https://github.com/ReoHakase/expo-hono-opentofu-starter)の手順を引き継いでいる。nuriの共有APIはGoogle Cloudプロジェクト `kcvlb4` の `nuri-staging`。公開サービスとDBを共有しているため、この文書では本番として扱う。

Google CloudのAPIキーはローカルSNS・認証開発に不要。Vercel EmulateでGoogle OAuthとメールを試せる。[認証とseed](auth.md)を参照。本番を変更する GitHub Actions は Workload Identity Federation（WIF）を使う。

## 1. cloneとworktreeの準備

コード・設定・文書の変更は、Issueの起票または既存Issueの確認と担当設定から始める。Issueに対応するブランチで実装・検証し、コミット・push・Draft PR作成まで進める。詳細は [AGENTS.md](../AGENTS.md#issue--branch--pr)、独自UIの追加は [UI開発手順](ui.md)を参照。

ローカルのAPI・Metro・FlociはDocker Composeで動かす。FlociはCloud SQL Admin APIとCloud Storageを提供し、PostgreSQL 17を起動する。ホストにGit、Docker Engine + Compose v2、Bun（固定版は `.bun-version`）、Node.js 26（固定版は `.node-version`）、Portless **0.16.0** を用意する。Compose連携は0.16.0で追加されたため、0.15系では起動できない。Portlessの実行にはNode.jsを使う。Bunのグローバルbin（`bun pm bin --global`）をPATHに追加する。WindowsではWSL2のLinuxファイルシステムを使う。

```sh
bun install --global portless@0.16.0
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

Composeが依存導入と未作成のアプリenv生成を行う。Flociの準備ができると、`migrate` がCloud SQL Admin APIでインスタンス・DB・アプリユーザーを作り、返された接続先でDrizzle migrationを実行してから、同じサービスが画像バケットを初期化する。APIはこの準備が完了してから起動し、MetroはDBを待たず起動する。APIのみなら末尾を `api`、DBなしのMetroのみなら `metro` にする。内部ポートはAPI 8080、Metro 8081、DB 5432、Floci 4588。PostgreSQLとFlociはComposeネットワーク内で待ち受け、PortlessがAPI・Metro・Google／メールのEmulateにloopback上の空きポートを割り当てる。Docker socketはPostgreSQLを起動するFlociにだけ渡す。

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
sh scripts/services-down.sh
```

foregroundはCtrl+CでAPI・Metroとそのrouteを終了する。FlociとPostgreSQLなどの依存サービスも終了するには `sh scripts/services-down.sh` を使う。detachedのrouteはこのスクリプトの実行まで残る。同一worktreeへの `up` はCompose標準の再利用・更新となるため、既存コンテナへ接続する。別のworktreeは別projectとして起動する。

**API・Metroをplainな `docker compose up` で作り直すとPortlessのポート割当が失われるため、起動・再作成は `portless compose` を使う。** `logs`、`exec`、`ps`、`restart` は通常のComposeでも使える。終了スクリプトはFloci 0.12.0が停止時に残す場合があるPostgreSQLコンテナを、対象worktreeのラベルで照合して取り除く。その後、Portlessでrouteとネットワークを片付ける。共有proxyの `stop` / `clean` / `--force` をworktreeの後片付けに使わない。

### 開発用の環境変数

ホストにBunがある場合は `bun run setup` で先に作成できる。Composeから起動する場合も同じ初期化が走る。既存のアプリ設定は保持する。

| ファイル           | ローカル開発の設定                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`             | worktreeのmount先。`scripts/worktree-init.sh` が生成する                                                                              |
| `apps/api/.env`    | worktree固有の `BETTER_AUTH_SECRET` を生成する。`DATABASE_URL` と `BETTER_AUTH_URL` は空欄にし、ComposeのPostgreSQLとAPI originを使う |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` は空欄にし、ComposeのAPIへ接続する。実機から自分のAPIを使う場合は到達可能なHTTPS URLを設定する                  |

3ファイルはGit管理外。Google・メールはローカルの認証エミュレーターを使う。公開APIへの接続が必要な確認では、Expoのdevelopment環境に登録した公開URLを使う。[Expo GitHub連携・環境変数](#expo-github連携環境変数)

### Dev Containerで編集・検査する

worktreeをエディタで開いて **Reopen in Container** を実行する。`initializeCommand` がホストのPOSIX初期化を行い、Composeの `workspace` サービスとそのsetup・DB依存を起動する。API・Metroの公開ポートをエディタが再作成しないよう、`runServices` は編集用 `workspace` だけに限定する。

コンテナ内では `bun run check`、`bun run doctor`、`bun run export:mobile` 等を実行できる。DBを参照するコマンドは `sh scripts/with-local-database.sh <コマンド>` で実行する。Flociからその時点の接続先を取得し、コマンドの `DATABASE_URL` に渡す。Docker socketは渡していないため、Portlessの起動・停止コマンドはホストで実行する。エディタのport forwardは使わない。エディタを閉じてもサービスは停止しないので、作業終了時はホストで `sh scripts/services-down.sh` を実行する。

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
bun run db:seed      # サンプルのユーザー・レシピ・画像。既存の利用者データは保持
bun run test:integration # 起動済みのDBとFlociを使用
bun run services:down
```

統合テストの前にAPIを起動する。テストコマンドは起動中のDBを使い、端末用構成で動いているAPIやEmulateを通常構成で作り直さない。

### 旧PostgreSQLのデータを移す

旧構成から更新する前に、対象worktreeで開発DBをダンプする。旧 `postgres-data` volumeは保持する。

```sh
umask 077
backup="$(mktemp -d)/nuri-local-backup.sql"
docker compose exec -T postgres pg_dump --no-owner --no-privileges \
  -U expo-hono-opentofu-starter -d expo-hono-opentofu-starter > "$backup"
bun run services:down
```

新構成で初めてAPIを起動する前に、空のFloci DBへダンプを復元する。`migrate` のentrypointがAdmin APIから接続先を取得する。`nuri-local-backup.sql` はcheckout外に保存する。利用者データが含まれるため、不要になったら削除する。

```sh
bun run setup
bun run compose up -d --wait floci
bun run compose run --rm --build setup
bun run compose run --rm --no-deps -T migrate \
  sh -ec 'exec psql --dbname="$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1' < "$backup"
bun run dev:api
```

通常の `bun run services:down` と再起動で、Flociのメタデータ・GCSオブジェクトとPostgreSQLのデータを保持する。終了スクリプトが対象のPostgreSQLを止め、次回起動時にFlociが再作成する。新しい接続先をAPIに反映するには、停止後に `bun run dev:api` または `bun run dev` で起動する。

空のDBとGCSに初期化する場合は、対象worktreeを `bun run services:down` で止める。次の一覧から、そのworktreeのFlociメタデータとCloud SQL volumeを確認し、その2つの名前を指定して `docker volume rm` を実行する。旧 `postgres-data` と他worktreeのvolumeは移行用に保持する。

```sh
project='nuri-<issue>-<topic>'
docker volume inspect "${project}_floci-data" --format '{{.Name}}'
docker volume ls --filter "label=floci_namespace=$project" --format '{{.Name}}'
```

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

ネイティブUIを確認するときは、Portlessで作業中のworktreeのAPIとMetroを公開し、ホストのExpo Device Hubで端末を開いて操作する。撮影時は対象の端末と操作結果が分かる状態を選ぶ。[PRへの記録方法](testing.md#prに残す検証結果)も参照する。

| 確認したいこと                                           | クライアント                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Expo Goに含まれるUI・画面遷移・API連携                   | SDK 58対応のExpo Go。仮想端末から作業中のMetroへ接続する。                                      |
| 顔追跡・写真診断・ネイティブのパスキー・プッシュ通知など | 対象のネイティブモジュール・設定を含む互換開発ビルド。依存や設定が変わったら作り直す。          |
| 実機の署名・権限・配送                                   | 対象端末と、必要な署名・外部サービスを設定したビルド。[プッシュ通知](#プッシュ通知)を参照する。 |

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

HubはXcode／Android SDKがあるOSで起動する。WindowsではComposeはWSL2、HubとADBはWindows側で使う。Hubで対象端末を開き、選んだクライアントに `dev:devices` が表示したMetroのURLを渡す。開発ビルドでは「Enter URL」を使う。MetroがFast Refreshを担当し、Hubは画面表示と操作を担当する。CAの秘密鍵は端末へコピーしない。

終了時はHubをCtrl+C、サービスは `bun run services:down` で自worktreeだけを止める。ADBの転送を共有する他のworktreeがないときだけ、対象serialの `adb -s SERIAL reverse --remove tcp:443` で転送を外す。通常構成に戻すには `bun run dev` を使う。端末用overrideは明示した起動時だけ読み込まれる。

### Expo Goで実機を確認する

同じworktreeで起動中のMetroがあればCtrl+Cで止め、ホストのworktreeルートから実行する。

```sh
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose \
  -f compose.yaml -f compose.go.yaml up --build api metro
```

`compose.go.yaml` はMetroのコマンドだけを `expo start --go --tunnel ngrok --port 8081` へ変更する。表示されたQRコードをSDK 58対応のExpo Goで開く。iPhone・AndroidともPCと同じLANでなくても接続できる。SDK 58の既定ExpoトンネルはExpoログインを要求するため、ここでは導入済みの `@expo/ngrok` を明示して使う。URLは実行中だけ有効。

標準構成のMetroは `--lan`、`apps/mobile` には `tunnel` / `go` コマンドも残す。コンテナのLANアドレスは実機から直接到達できないため、実機はトンネル構成を使う。ホストブラウザではPortlessのMetro URLを開く。端末に `.localhost` を設定しない。

Composeでは空の `EXPO_PUBLIC_API_URL` を `app.config.ts` が開発API originで補う。Compose外でAPI未設定の場合、ホームには接続案内を表示する。レシピ・投稿・お気に入り・フォローにはAPIが必要。

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

Cloudflareトンネルは外向きTCP 7844が必要。`curl https://....trycloudflare.com/ready` が `{"status":"ready"}` になれば、レシピの閲覧・投稿を確認できる。GoogleのローカルEmulateは `.localhost` のため、APIトンネルだけでは実機OAuthを完了できない。実機認証には到達可能な検証APIと実プロバイダ設定を用意する。トンネルを作り直すとURLが変わる。普段は安定したstaging Cloud Run URLも使える。実機・公開トンネルの確認範囲は [docs/testing.md](testing.md) に記録する。

### Development BuildとPRプレビュー

Expo Goは初期確認に使う。PRの確認には [Cloud Runのプレビュー](preview.md) も使える。ネイティブモジュールを使う変更にはDevelopment Buildが必要。

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

顔追跡（`apps/mobile/modules/face-tracker`、MediaPipe Face Landmarker）はネイティブモジュールのため、Expo Goでは動かずDevelopment Buildが必要。Development Buildでは⑦（レシピの「メイクをはじめる」）で、カメラの映像に今の手順の塗る範囲を重ねる。⑩はカメラの映像だけを出す（#190）。ネイティブモジュールや依存を変えたら、新しいDevelopment Buildを作る（OTAでは届かない）。

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

ARの処理時間を測るときは、計測用のリリースビルドを作る（#236）。`EXPO_PUBLIC_AR_METRICS=1` はバンドル時に埋め込まれ、⑦⑩のカメラの上に1秒ごとの推論結果・描画の数と遅延を出す。同じ値をlogcatにも書く。

```sh
cd apps/mobile/android
EXPO_PUBLIC_AR_METRICS=1 EXPO_PUBLIC_API_URL=<APIのURL> ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64
adb install -r app/build/outputs/apk/release/app-release.apk
adb logcat -s ReactNativeJS | grep ar-metrics
```

このリポジトリはEASに接続済みで、`build:configure` / `update:configure`も実行済み。設定はfingerprint runtime policy、development/preview/production channel。フォーク時は `eas init`、`eas build:configure`、`eas update:configure` で自分のプロジェクトへ再接続する。

## 3. GitHubとExpoの手動設定

### GitHub Actions

通常のCIはsecretなしで動く。PRで静的検査、テスト、バンドル、コンテナ、OpenTofuの結果を確認できる。

本番アプリの配信、本番インフラ、プレビュー共有基盤のワークフローは、クラウド認証の前に同じスクリプトで対象SHAを確認する。現在の `main` と一致し、そのSHAへのpushで起動した `CI` が成功している場合に進む。

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

### PRプレビュー

初期設定、PRからの手動配信、Apply・Destroyのログとcleanupは [PRプレビュー](preview.md) を参照する。

### Expo GitHub連携・環境変数

スターターではExpoのログイン、EAS project、GitHubリポジトリの接続を完了し、プロジェクトのGitHub設定のBase directoryを `/apps/mobile` にした。nuriの [プロジェクトのGitHub設定](https://expo.dev/accounts/kcvlb4/projects/nuri/github) は未確認のため、下の手順で確認する。Expo側にあった自動PR preview・手動preview workflowは削除し、GitHub Actionsへ統一した。

フォーク・再設定時は以下を行う。

1. Expo dashboardでGitHub Appを対象リポジトリへ接続し、Base directoryを `apps/mobile` にする。
2. ExpoのEnvironment Variablesで `EXPO_PUBLIC_API_URL` をdevelopment/preview/productionそれぞれに設定する。公開URLなのでvisibilityはplain text。previewは共有staging API、productionは本番API。ローカル `.env` はクラウドへアップロードしない。未設定なら接続案内が表示され、SNS機能は利用できない。

`apps/mobile/.eas/workflows/native-builds.yml` は手動でiOS SimulatorとAndroid preview APKを作る。Development Buildが必要なら `ios_profile=development-simulator`（Simulator）または `development`（実機）、Androidは `android_profile=development` を選ぶ。iOS実機用にはApple署名が必要。本番は従来どおり、APIデプロイ成功後だけ `production-update.yml` を呼び出す。両方ともExpo Workflows側の実行となる。

`@kcvlb4/nuri` のdevelopment環境には、共有APIの `EXPO_PUBLIC_API_URL` が登録されている。依存導入済みのworktreeで、Expo CLIのログインと設定を確認できる。

```sh
cd apps/mobile
bunx eas whoami
bunx eas project:info
bunx eas env:list development --format short
```

CLIが未認証なら `bunx eas login` を実行する。公開APIで実機を確認するときだけ、development環境の `EXPO_PUBLIC_API_URL` を `apps/mobile/.env` に設定する。ローカルAPIに戻すときは空欄に戻す。`eas env:pull` の既定出力 `.env.local` はアプリの `.env` より優先されるため、確認用に取得する場合は `--path` でアプリの外に保存する。[Expoの環境変数](https://docs.expo.dev/eas/environment-variables/manage/)

Apple/Googleストアの契約・署名は別途必要で、TestFlight/ストア提出は自動実行しない。初期設定のビルド・端末確認記録は [検証](testing.md) を参照する。

### GitHub Releasesからstagingビルドを入れる

[GitHub Releases](https://github.com/Kcvl-DfHack26/nuri/releases) の `staging-<実行ID>` から、共有stagingにつながる配布ビルドを取得する。各ビルドはJavaScriptを同梱しており、起動にExpo GoやMetroは不要。

- Androidは `nuri-staging-android.apk` を対応端末で開くか、接続済みの端末に `adb install -r nuri-staging-android.apk` で入れる。
- iOS SimulatorはMacで `nuri-staging-ios-simulator.app.zip` を展開し、XcodeのSimulatorを起動して `xcrun simctl install booted ./nuri.app` を実行する。
- iPhone実機は `nuri-staging-ios-device-unsigned.app.zip` を取得し、[Personal Teamで署名](#iphone実機にpersonal-teamで入れる)してから入れる。

配布するにはGitHub Actionsの **Publish staging mobile release** を `main` から手動実行する。mainのCIとstagingの `/ready` が成功し、同じSHAから作成した3ファイルが検査を通ると公開プレリリースが作られる。失敗時はActionsのログを確認し、原因を解消して **Run workflow** から新しい実行を開始する。

初回設定ではGitHubの `mobile-release` 環境を `main` に制限し、[Expoのアクセストークン](https://docs.expo.dev/accounts/programmatic-access/)を環境Secret `EXPO_TOKEN` に登録する。トークンのアクセス先を `kcvlb4` に限定し、Expo Buildに必要な権限を与える。AndroidはEASの `com.kcvl.nuri` に登録した署名鍵を使う。鍵が未設定の場合は、Expoプロジェクトの管理者が `apps/mobile` で `bunx eas credentials --platform android` を実行して設定する。

#### iPhone実機にPersonal Teamで入れる

ReoHakaseの個人Apple Accountで `dev.reohakase.nuri.staging` に開発署名する手順。EASは実機用ZIPのビルドを担当し、署名はMac上で行う。このstaging版ではAPNsのリモート通知とパスキーのAssociated Domainsを無効にしている。

1. Xcodeの **Settings → Apple Accounts** で個人Apple Accountにサインインする。iPhoneをMacに接続してペアリングし、iPhoneの **設定 → プライバシーとセキュリティ → デベロッパモード** を有効にする。 [Appleのデベロッパモード手順](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
2. Xcodeの **File → New → Project → iOS → App** から空のiOSアプリを作成する。ターゲットの **Signing & Capabilities** で **Automatically manage signing** をオンにし、**Team** に **Personal Team**、**Bundle Identifier** に `dev.reohakase.nuri.staging` を設定する。
3. Xcodeの実行先に接続したiPhoneを選び、**Product → Build** を実行する。ビルドフォルダの `Products/Debug-iphoneos/` に生成された `.app` のパスを控える。続いて `xcrun devicectl list devices` で対象iPhoneの識別子を確認する。 [Appleの実機ビルド手順](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
4. リリースのSource commitと同じcheckoutのルートで以下を実行する。スクリプトはZIPを一時フォルダに展開し、Xcodeで作ったアプリと同じ開発署名を使ってiPhoneにインストールする。

   ```sh
   bash scripts/install-ios-personal-team.sh \
     ~/Downloads/nuri-staging-ios-device-unsigned.app.zip \
     '/path/to/Debug-iphoneos/SigningApp.app' \
     '<iPhoneの識別子>'
   ```

5. iPhoneのホーム画面からnuriを開き、stagingのレシピ一覧と詳細を確認する。「メイクをはじめる」でカメラを許可し、顔を動かしたときに重ね表示が追従することを確認する。

Personal Teamのプロビジョニングプロファイルは発行から7日で失効する。期限後は手順3でXcodeの開発プロファイルを更新し、同じZIPで手順4を実行する。 [AppleのPersonal Teamの説明](https://developer.apple.com/help/account/basics/about-your-developer-account/)

### プッシュ通知

- Expoの nuri プロジェクトにAPNsキーとFCM v1送信用の認証情報を登録する。AndroidのFirebaseアプリのパッケージ名は `com.kcvl.nuri`。EAS Environmentの `GOOGLE_SERVICES_JSON` をファイル型・Sensitiveで設定し、ビルドとEAS Updateの同じ環境で同一の `google-services.json` を使う。ローカルビルドでは同じ変数にファイルへの絶対パスを指定する。FCMのサービスアカウントキーはEASのCredentialsに登録し、アプリに含めない。[Expoの設定手順](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- 署名付きiOSビルドでは、EAS Environmentとローカルのビルド環境にApple Developerの `APPLE_TEAM_ID` を設定し、親アプリと `com.kcvl.nuri.notification-service` の署名を用意する。通知画像の取得を担当する拡張は、`@bacons/apple-targets` がiOSのprebuild時に組み込む。このプラグインはExpo CLIの設定読込時にも `@expo/plist` を使うため、production依存だけのPRプレビューでも解決できるようアプリの `dependencies` に明示する。Simulatorでは署名用のTeam IDを省略できる。
- Expo Push Serviceの拡張セキュリティを有効にし、APIにだけ `EXPO_PUSH_ACCESS_TOKEN` を設定する。ローカルでは `apps/api/.env`、Cloud Runでは `<name>-expo-push-access-token` のSecret Managerにバージョンを追加し、`push_notifications_enabled = true` で参照する。アプリ環境変数やGitにトークンを置かない。[Expoの送信認証](https://docs.expo.dev/push-notifications/sending-notifications/#additional-security)
- DB migrationを適用してAPIを起動し、通知プラグインを含むiOS・Androidの新しい開発ビルドを使う。ログイン後に「マイ → プロフィール設定 → 公開と通知 → プッシュ通知」を開き、「通知を有効にする」でOSの許可を与える。別アカウントで公開テストレシピにいいねし、受信とタップ、再送・自己いいね・ログアウト後に新規送信されないことを確認する。通知の許可は端末の設定で変更できる。Androidでは「いいね」と「動画レシピの作成」を別々に管理できる。

通知の検証は次のように分ける。

- 仮想端末にテスト通知を注入した場合は、文面・表示・タップ後の遷移など、操作して確かめた範囲を記録する。
- 実配送は、対象の開発ビルドで受信登録し、アプリの操作からExpo Push ServiceとAPNs／FCMを経由して届くことを確かめる。iOSの画像付き通知には、画像取得を担当する通知サービス拡張を含むビルド、APNsの認証情報、到達可能な画像が必要。iOS Simulatorで `simctl push` を使った表示確認は、拡張による画像取得の確認に含めない。[AppleのSimulatorに関する説明](https://developer.apple.com/documentation/xcode-release-notes/xcode-14-release-notes#Simulator)
- 容量、署名、認証情報などの不足で指定された検証が止まったら、確認済みの範囲と再開条件を共有する。

## 4. Google CloudとOpenTofu

### ローカルのCLIを設定する

Dev Containerにはgcloud、OpenTofu 1.13.8、TFLintが入っている。ホストで使う場合は、[Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk)と[OpenTofu 1.13.8](https://github.com/opentofu/opentofu/releases/tag/v1.13.8)をインストールする。Google Cloud Consoleのブラウザログインとは別にCLIのログインが必要。`kcvlb4` を閲覧できるGoogleアカウントを選ぶ。

```sh
gcloud config configurations create nuri-kcvlb4 --no-activate
gcloud --configuration=nuri-kcvlb4 auth login
gcloud --configuration=nuri-kcvlb4 config set project kcvlb4
gcloud --configuration=nuri-kcvlb4 config set run/region asia-northeast1
gcloud --configuration=nuri-kcvlb4 run services describe nuri-staging --format='value(status.url)'
```

設定が既にあれば作成は省く。名前付き設定をコマンドごとに指定すると、他のリポジトリで使うgcloudの既定プロジェクトに影響しない。この設定は `describe`、ログ、公開URLの確認に使う。開発者のGCP権限も閲覧に絞る。ローカルのOpenTofuは認証なしで検証できる。

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

ローカルで本番のGCS backendへ接続する設定やADCを作る必要はない。独立した開発用GCPプロジェクトでADCが必要な場合は、そのプロジェクトに絞った開発用の権限を使う。[Google CloudのADC](https://docs.cloud.google.com/docs/terraform/authentication)

### 本番のOpenTofuをGitHub Actionsで適用する

`kcvlb4` の `nuri-staging`、Cloud SQL、Secret Manager、GCS stateは本番扱い。ローカルでの `tofu apply`／`destroy`、`gcloud` による公開設定・トラフィック・secretの変更は禁止する。インフラ変更は **Production Infrastructure**、アプリ配信は **Deploy API, Expo Web and mobile update** を使う。2つのワークフローは同じconcurrency groupを使う。

**Production Infrastructure** は、push時のCIに成功した最新の `main` から手動実行する。既定の `plan` で差分を確認し、承認を得て `apply` を実行する。差分、適用結果、診断は各Actionsの実行ログで確認する。

`apply` はその実行内でplanを取り直し、削除・置換を含む場合は停止する。既存の `gs://kcvlb4-tofu-state/nuri/staging` を使うため、初回構築・state移行・廃止は管理者が別の手順をレビューし、承認済みのGitHub Actionsで行う。

```sh
gh workflow run infra-production.yml --ref main -f operation=plan
# planをレビューしてから実行する
gh workflow run infra-production.yml --ref main -f operation=apply
```

稼働開始前に、管理者が承認済みの管理用GitHub Actionsから以下を用意する。既存のアプリ配信用サービスアカウントには、OpenTofuの適用権限を付けない。

- IaC専用のWIF pool／providerとサービスアカウント。別poolに分け、OIDCの条件でリポジトリID `1447386190`、`refs/heads/main`、`production` Environment、`Kcvl-DfHack26/nuri/.github/workflows/infra-production.yml@refs/heads/main` を照合する。GitHub Environmentの許可ブランチは `main`。本番のリソース変更はActionsのサービスアカウントに限定する。[Google Cloudのデプロイパイプライン用WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- IaC用アカウントには、対象のstateをロック・更新するGCS権限と、`infra/` が管理するGCPリソースの変更に必要な権限を付ける。既存DBパスワードは `nuri-staging-database-url` のSecret Manager参照からrunner内で渡す。このsecretだけに `roles/secretmanager.secretAccessor` を付ける。DBパスワードはGitHub変数・ファイル・stateに転記しない。
- GitHubの `production` Environmentに `TOFU_WORKLOAD_IDENTITY_PROVIDER`（providerの完全なリソース名）、`TOFU_SERVICE_ACCOUNT`（専用アカウントのメール）、`TOFU_VARIABLES_JSON`（既存環境のsecretを含まないOpenTofu入力）を設定する。JSONでは `deploy_application` と `deletion_protection` を `true`、`image` をdigest付き、`api_origin` を正規の公開URLにする。`database_password_version`、DBのtier、OAuth・メール有効化と送信元、許可originは、既存の入力と照合する。project、region、service、GitHubリポジトリはワークフローが固定する。

### CIからのデプロイを有効にする

GitHub Environment `production` には、`kcvlb4` のサービスとmigration Job、配信用WIFが登録されている。[GitHub Actionsの設定](#github-actions)に変数一覧がある。`GCP_DEPLOY_ENABLED=true` なら、mainのCI成功後に「Expo Webを同梱するイメージの作成 → migration Job → candidateの `/ready` とWeb配信の検査 → トラフィック切替」を実行する。手動で配信する場合も同じActionsを使う。

```sh
gh workflow run deploy.yml --ref main
```

OpenTofuでサービス設定を変えて新しいrevisionができた場合も、トラフィックの切替はこの配信フローを使う。`EXPO_UPDATE_ENABLED=true` の場合、APIの確認後にGitHub ActionsがExpoの本番Updateを呼び出す。本番のOAuthやメール設定を変更するときは、[認証設定](auth.md#android仮想端末でgoogleとメールを試す51)を参照する。

### 共有環境の画像ストレージ

stagingはOpenTofuが作る環境専用の非公開バケットを使う。APIの実行用サービスアカウントにバケット内のオブジェクト権限を付与し、APIと同じCloud Runリビジョンに `GCS_BUCKET` を設定する。配信用のパスは `/media/**` になる。

画像ストレージのPRをmainにマージし、mainのCIが成功した後、**Production Infrastructure** の `plan` でバケット・IAM・Cloud Run環境変数の差分を確認してから `apply` する。バケット名はOpenTofu出力の `image_bucket` で確認できる。反映後にmainの **Deploy API, Expo Web and mobile update** を実行し、候補の `/ready` と画像配信を確認する。デプロイは環境のDB migrationを実行する。見本データの投入と旧 `/sample-avatars/`・`/sample-recipes/` 参照の移行は、開発・プレビュー環境で [seedを再実行](auth.md) して行う。stagingに旧seed参照がある場合は、配信切替前に対象の行と画像を確認する。

### Webを開く

```sh
API_ORIGIN=$(gcloud --configuration=nuri-kcvlb4 run services describe nuri-staging --format='value(status.url)')
bash scripts/check-expo-web.sh "$API_ORIGIN"
```

Cloud Runの既定HTTPS URLをブラウザで開く。Web同梱イメージの配備後は、同じホストの `/` がExpo Web、`/api/**` がHono、`/_expo/static/**` と `/assets/**` が静的ファイルになる。レシピ直リンクはSPAで開ける。将来のLP用 `/about/` は現時点では404を返す。WebはアクセスしたホストのAPIを使い、共有する正規URLはOpenTofuの `api_origin` と揃える。Google OAuthのリダイレクト先は既存どおり正規URLの `/api/auth/callback/google` を使う。

アプリから読むには、ExpoのEnvironment Variablesの `EXPO_PUBLIC_API_URL`（previewとproduction）に `service_uri` を設定する（[Expo GitHub連携・環境変数](#expo-github連携環境変数)）。

2026年11月7日の初回公開では、このブランチのOpenTofu設定を適用してmigration jobとCloud Runサービスを作成した。その後、[mainのデプロイ](https://github.com/Kcvl-DfHack26/nuri/actions/runs/42372457055)（`ce37dd2`）でmigration・candidateの `/ready`・トラフィック切替が成功した。CIはOpenTofuの変更を適用しないため、IaCの検証結果とは分けて扱う。実サービスのstartup probeが `/ready` であることを確認し、`https://nuri-staging-v3kjfarita-an.a.run.app` の `/health`・`/ready`・`/api/recipes` が200で応答した。Expoのdevelopment・preview・production環境の `EXPO_PUBLIC_API_URL` もこのURLに設定した。Androidエミュレーターの開発ビルドでメイク画面の空状態を確認し、Cloud Runのログでアプリからの `GET /api/recipes?offset=0` が200で応答した。iOS実機は未確認。DBはmigrationのみで、レシピ一覧は空。開発用seedを本番DBへ実行せず、アプリでレシピを表示するためのデータは #30 の方針に従って用意する。

### 稼働の確認

```sh
API_ORIGIN=$(gcloud --configuration=nuri-kcvlb4 run services describe nuri-staging --format='value(status.url)')
curl --fail "$API_ORIGIN/health"
curl --fail "$API_ORIGIN/ready"
curl --fail "$API_ORIGIN/api/recipes"
gcloud --configuration=nuri-kcvlb4 run services describe nuri-staging --format='yaml(status.traffic)'
gcloud --configuration=nuri-kcvlb4 logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="nuri-staging"' --limit=50
gcloud --configuration=nuri-kcvlb4 run jobs executions list --job=nuri-staging-migrate --limit=5
```

### 現行環境の規模と費用

nuriは作成済みのプロジェクト（クレジット約$40）を使う。

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

### 止め方

新規配信の停止はGitHubのRepository Variable `GCP_DEPLOY_ENABLED` を `false` にする。稼働中のrevisionは配信を続ける。API停止、Cloud SQL停止、リソース削除が必要な場合は、影響とデータ保全をレビューし、承認済みのGitHub Actionsから実施する。

## 5. ハーネスと検証

```sh
codex mcp login expo
bun run check
bun run test:integration
bun run doctor
bun run export:mobile
```

Codexはrootの `AGENTS.md` と `.agents/skills` を使う。Expo MCPは `.codex/config.toml` に設定済み。MCPのOAuth、Expo CLIのログイン、GitHubの接続はそれぞれ認証する。ホストやDev Containerでは各自ログインし、認証データはリポジトリへコピーしない。

詳細な実機手順とMaestroの有料プラン条件は [testing.md](testing.md)。インフラだけの `fmt` / `init -backend=false` / `validate` / TFLintはGCP認証なしで実行できる。
