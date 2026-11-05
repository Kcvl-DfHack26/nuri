# 開発環境と外部サービスの設定

2026年11月5日。GitHubは [ReoHakase/expo-hono-opentofu-starter](https://github.com/ReoHakase/expo-hono-opentofu-starter)、Expoは [@reohakase/expo-hono-opentofu-starter](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter)。Expo project IDは `1f2d3048-c03b-4d7e-8220-7385b3875389`。

Google CloudのAPIキーはローカル開発・ショーケースに不要。クラウドの初期構築にはログイン済みのGoogleアカウントと課金を有効化したプロジェクト、CIにはWorkload Identity Federationを使う。長期のサービスアカウントJSONキーは作らない。

## 1. ホストに必要なもの

- GitとDocker Engine + Compose v2。macOS/Linux、またはWindowsのWSL2でLinuxコンテナを動かせること。
- Dev Containerを使う場合はVS Code等の対応エディタ。
- 実機確認用のiPhone/Androidと、SDK 58対応のExpo Go。

Xcode、Android Studio、ホスト側のNode/Bun/gcloud/OpenTofuは必須ではない。WindowsではリポジトリをWSL2側のLinuxファイルシステムに置く。

### Dev Container（推奨）

リポジトリをcloneし、**Reopen in Container**を実行する。postCreateCommandがvolumeの所有者を整え、`bun install --frozen-lockfile`、`bun run setup`、`bun run db:migrate`を実行する。

```sh
bun run dev
```

APIは8080、Metroは8081。PostgreSQLはComposeの内部ネットワークだけに公開する。`.env`は未作成の場合のみ生成し、既存の値を上書きしない。認証secretはランダムに生成される。

### エディタなしでComposeだけを使う

```sh
docker compose up -d --build
# 以下は初回、または依存関係更新時
docker compose exec workspace bun install --frozen-lockfile
docker compose exec workspace bun run setup
docker compose exec workspace bun run db:migrate
# 開発中はこのターミナルを維持
docker compose exec workspace bun run dev
```

volumeの所有権エラーが発生したときだけ、次を実行する。ホストのソース全体へchownしない。

```sh
docker compose exec --user root workspace chown -R node:node \
  /workspace/node_modules /workspace/apps/mobile/node_modules \
  /workspace/apps/api/node_modules /workspace/packages/shared/node_modules \
  /home/node/.bun /home/node/.expo /home/node/.config/gcloud
```

停止は `docker compose down`。DBや認証状態を保つため、通常は `-v` を付けない。API/Metroのホスト公開先はloopback限定で、実機へは次のトンネルを使う。

### ホスト上のBunで開発する場合（任意）

Node 24とBun 1.4.4を用意する。

```sh
docker compose -f compose.yaml -f compose.host.yaml up -d postgres
bun install --frozen-lockfile
bun run setup
bun run db:migrate
bun run dev
```

`compose.host.yaml`だけがDBの5432をホストのloopbackへ公開する。ホストとコンテナのnode_modulesは別volumeで分離している。

## 2. iPhone / Android から開く

### まずExpo Goでショーケース

Metroが既に起動していれば止め、コンテナ内で実行する。

```sh
cd /workspace/apps/mobile
bun run go
```

ホスト開発なら `cd apps/mobile && bun run go`。表示されたQRコードをiPhoneのカメラで読み取るか、Expo Goの開発サーバーとして開く。Androidも同じサーバーへ接続できる。トンネルを使うのでPCと端末が同じLANでなくてもよい。URLは実行中だけ有効。

`EXPO_PUBLIC_API_URL`が空ならオフラインモード。検索、保存、完了、設定は利用でき、Accountには未接続の案内を表示する。

### ローカルAPIも実機から使う

別ターミナルでAPIを起動する。

```sh
docker compose exec workspace bun run dev:api
# ホスト開発なら bun run dev:api
```

**コンテナ開発時**のHTTPSトンネル:

```sh
docker compose --profile tunnel up -d api-tunnel
docker compose logs api-tunnel
```

ログに表示された `https://....trycloudflare.com` を使い、次の2ファイルを編集する。

| ファイル           | 値                                                  |
| ------------------ | --------------------------------------------------- |
| `apps/api/.env`    | `BETTER_AUTH_URL=https://....trycloudflare.com`     |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL=https://....trycloudflare.com` |

APIとMetroを再起動する。APIの `.env.example` には開発専用の `exp://**` originが含まれている。共有の本番APIにこのワイルドカードを入れない。実機の `localhost` はPCではなく端末自身なので、localhost URLをモバイルへ設定しない。

ホスト開発時は以下を使える（Docker Desktop/OrbStack）。Linuxでは `--add-host=host.docker.internal:host-gateway` も付ける。

```sh
docker run --rm cloudflare/cloudflared:2026.10.7 tunnel \
  --no-autoupdate --protocol http2 --url http://host.docker.internal:8080
```

Cloudflareトンネルは外向きTCP 7844が必要。今回のホストではこの通信がタイムアウトしたため、公開API経由の実機認証は未確認。利用できるネットワーク、別のHTTPSトンネル、またはstaging Cloud Runを使う。

`curl https://....trycloudflare.com/ready` が `{"status":"ready"}` になれば、SettingsのCheck connection、Accountの登録・ログインを試せる。トンネルを再作成するとURLが変わる。普段は安定したstaging Cloud Run URLへ切り替える。

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

このプロジェクトではApple Developer Programは未契約のため、iPhoneではExpo Goを使う。Apple契約なしで作れるiOS SimulatorビルドはiPhoneへインストールできない。Androidのpreview APKは署名済みの単体アプリとして配布できる。

このリポジトリはEASに接続済みで、`build:configure` / `update:configure`も実行済み。設定はfingerprint runtime policy、development/preview/production channel。フォーク時は `eas init`、`eas build:configure`、`eas update:configure` で自分のプロジェクトへ再接続する。

## 3. GitHubとExpoの手動設定

### GitHub Actions

通常のCIはsecretなしで動く。GitHubの **Settings → Actions → General** でActionsを有効にする。mainの保護を有効にするときは、初回のCI成功後に `quality`、`infrastructure`、`container` をrequired checkにする。

**Settings → Environments → production** は作成済みで、利用できるブランチをmainだけに制限している。フォーク時は作成し、必要に応じてrequired reviewerを指定する。デプロイ先の変数を設定する。

| 種別                 | 名前                             | 値・取得元                                                      |
| -------------------- | -------------------------------- | --------------------------------------------------------------- |
| Repository Variable  | `GCP_DEPLOY_ENABLED`             | 現在 `false`。GCP構築・secret投入・初期サービス作成後に `true`  |
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

### Expo GitHub連携・環境変数

Expoのログイン、EAS project、GitHubリポジトリの接続は完了済み。[プロジェクトのGitHub設定](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/github)のBase directoryは `/apps/mobile` として保存済み。以下の1〜2はフォーク・再設定時の手順。

Expo dashboardのRun workflow一覧にファイルが表示されない場合は、アプリディレクトリからEAS CLIでGit refを指定する。ワークフローの配置をリポジトリ直下へ変える必要はない。

```sh
cd apps/mobile
bunx eas workflow:run .eas/workflows/preview-update.yml --ref main --non-interactive --wait
```

この手動配信はpreview channelだけを更新する。API URLが未設定ならオフラインショーケースになる。EASのビルドとワークフローでもNode 24.19.0/Bun 1.4.4を固定している。

1. Expo dashboardのプロジェクト設定でGitHub Appを接続し、対象リポジトリへのアクセスを承認する。
2. モノレポのプロジェクトルートを **`apps/mobile`** に設定する。ワークフローはこの直下の `.eas/workflows` にある。
3. ExpoのEnvironment Variablesで、`EXPO_PUBLIC_API_URL` をdevelopment/preview/productionそれぞれに設定する。公開URLなのでvisibilityはplain text。previewは共有staging API、productionは本番API。ローカル `.env` はクラウドにはアップロードしない。
4. `bunx eas workflow:validate .eas/workflows/pr-preview.yml --non-interactive` 等で検証する。
5. 最初のDevelopment Buildを実機へ入れる。PR作成後のコメントにあるupdateリンクをDevelopment Buildで開く。

PRは `pr-<number>` branchへ公開し、共通preview channelの最新版を全PRで上書きしない。`native-builds.yml` は既定でiOS SimulatorとAndroid preview APKを作る。Development Buildが必要なら、実行時に `ios_profile=development` / `android_profile=development` を選ぶ。iOS実機用のdevelopmentにはApple署名が必要。mainに対応するproduction updateは、GitHubのAPIデプロイ成功後にのみ `production-update.yml` を呼び出す。

Expo GitHub Appの承認とCI token登録は完了済み。フォーク先ではそれぞれ自分のアカウントで設定する。Apple/Googleストアの契約・署名は別途必要で、TestFlight/ストア提出はこの初期設定では自動実行しない。

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

認証済みGCPプロジェクトへの変更はこの手順以降で発生し、Cloud SQL等に料金がかかる。今回はここ以降の実リソース作成は実行していない。

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
# github_repository_id はこのリポジトリでは 1446638863
# フォークでは gh api repos/OWNER/REPO --jq .id で取得
```

stagingとproductionは別のstate prefix、resource name、認証secret、DBを使う。最初は例の `daylight-staging` / `daylight/staging` を作成する。productionを用意するときは別の作業コピーで `name=daylight-production`、prefix `daylight/production` を設定し、stagingのstateを上書きしない。

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
export RESOURCE_NAME=daylight-staging
SQL_CONNECTION=$(tofu -chdir=infra output -raw sql_connection_name)
printf 'postgresql://daylight:%s@localhost/daylight?host=/cloudsql/%s' \
  "$TF_VAR_database_password" "$SQL_CONNECTION" | \
  gcloud secrets versions add "$RESOURCE_NAME-database-url" --project="$GCP_PROJECT" --data-file=-
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets versions add "$RESOURCE_NAME-auth-secret" --project="$GCP_PROJECT" --data-file=-
```

値はstdoutへ出さずstdinで渡す。`.tfvars`、GitHub、ExpoへDBパスワードを転記しない。

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

表示されたdigestを使い、`terraform.tfvars` の `image` を `<registry>/api@sha256:...`、`deploy_application=true` に設定してplan/applyする。

```sh
tofu -chdir=infra plan
tofu -chdir=infra apply
gcloud run jobs execute daylight-staging-migrate --region=asia-northeast1 --wait
API_ORIGIN=$(tofu -chdir=infra output -raw service_uri)
curl --fail "$API_ORIGIN/ready"
```

`api_origin`出力と`service_uri`が一致することを確認する。custom domainを使う場合はDNS/ドメインマッピングを別途設定し、`api_origin`にそのHTTPS URLを渡す。

準備ができたらGitHubの変数を埋め、`GCP_DEPLOY_ENABLED=true`を設定する。Expo側にproduction API URLとビルドを用意してから `EXPO_UPDATE_ENABLED=true` を設定する。以後、mainの成功したCIからmigration → candidate検証 → traffic切替 → Expo Updateの順に動く。

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
