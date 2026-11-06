# 開発環境と外部サービスの設定

2026年11月5日。GitHubは [ReoHakase/expo-hono-opentofu-starter](https://github.com/ReoHakase/expo-hono-opentofu-starter)、Expoは [@reohakase/expo-hono-opentofu-starter](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter)。Expo project IDは `1f2d3048-c03b-4d7e-8220-7385b3875389`。

Google CloudのAPIキーはローカル開発・ショーケースに不要。クラウドの初期構築にはログイン済みのGoogleアカウントと課金を有効化したプロジェクト、CIにはWorkload Identity Federationを使う。長期のサービスアカウントJSONキーは作らない。

## 1. cloneとworktreeの準備

コード・設定・文書の変更は、Issueの起票または既存Issueの確認と担当設定から始める。Issueに対応するブランチで実装・検証し、コミット・push・Draft PR作成まで進める。詳細は [AGENTS.md](../AGENTS.md#issue--branch--pr)、独自UIの追加は [UI開発手順](ui.md)を参照。

GitとDocker Engine + Compose v2を用意する。Dev ContainerはホストのNode/Bunを必要としない。WindowsではWSL2のLinuxファイルシステムを使う。

```sh
git worktree add -b codex/my-change ../my-change HEAD
cd ../my-change
```

各checkoutを初期化する。同じGitリポジトリの `bun install` / Dev Containerの初回作成は順に実行する。Lefthookが共有 `.git/hooks` を更新するため、初回インストール同士を同時に実行すると競合する。準備後の開発サーバーは並列起動できる。`node_modules`、ルートの生成 `.env`、DB volumeはコピーしない。アプリの環境ファイルは各worktreeで生成する。

### Dev Container（推奨）

worktreeをエディタで開いて **Reopen in Container** を実行する。ホストの `initializeCommand` が `sh scripts/worktree-init.sh` を実行し、実パス由来のID・Compose名・mount先をルートの生成 `.env` へ保存する。branch変更やdetached HEADでもIDは変わらない。checkoutとGit共通ディレクトリをホストと同じ絶対パスでmountするため、linked worktreeでもGitが動く。

postCreateCommandがvolumeの所有者を整え、依存導入・アプリenv生成・migrationを実行する。

```sh
bun run dev
```

コンテナ内はAPI 8080、Metro 8081、DB 5432。ホスト公開先はDockerの自動割当で、loopback限定。エディタの追加port forwardは使わない。ホストから確認するには:

```sh
docker compose port workspace 8080
docker compose port workspace 8081
```

### エディタなしでComposeを使う

ホストのNode/Bunは不要。初回は以下を実行する。

```sh
sh scripts/worktree-init.sh
docker compose up -d --build
docker compose exec --user root workspace chown -R node:node \
  node_modules apps/mobile/node_modules apps/api/node_modules packages/shared/node_modules \
  /home/node/.bun /home/node/.expo /home/node/.config/gcloud
docker compose exec workspace bun install --frozen-lockfile
docker compose exec workspace bun run setup
docker compose exec workspace bun run dev
```

### ホストのBunで開発する

Node 24とBun 1.4.4を用意する。同じworktreeのコンテナ開発から切り替える場合は、先に `docker compose stop workspace api-tunnel` を実行する。

```sh
bun install --frozen-lockfile
bun run setup
# ホストで一度だけ。tablecast-poc等の既存のHTTP/80 proxyは再利用する。
bunx --no-install portless proxy start --no-tls --port 80
bun run dev
```

Portless 0.15.8がAPIとMetroに別の空きポートとworktree別ホスト名を割り当てる。APIは `http://api.<ID>.expo-hono-opentofu-starter.localhost`、Webは `http://metro.<ID>.expo-hono-opentofu-starter.localhost`。ExpoのQRには標準のLAN/トンネル接続先を使い、端末に `.localhost` を設定しない。共有proxyの初回起動に管理者認証が必要な環境では、上記コマンドをホストの対話ターミナルで実行する。

`dev` / `dev:api` は自worktreeのPostgreSQLを起動してhealthcheck・migration後にAPIを開始する。ホストのDB公開先もDockerが自動割当する。`dev:mobile` はDBなしで起動できる。`db:migrate` と `test:integration` も同じDBを解決する。CIやAPIの環境ファイルに明示した `DATABASE_URL` があれば、その接続先を使う。

```sh
bun run dev:api
bun run dev:mobile
bun run services:up
bun run services:down
```

Ctrl+Cは開発プロセスとそのPortless routeを終了する。`services:down`、またはホストの `docker compose down` は自worktreeのComposeだけを停止し、volumeを保持する。共有proxyの `stop` / `clean` / `--force` をworktreeの後片付けに使わない。同一worktreeのAPIまたはMetroの二重起動は既存プロセスを奪わず失敗する。

`setup` は既存アプリenvとsecretを保持する。APIの `DATABASE_URL` と `BETTER_AUTH_URL` は空でローカル自動設定になり、実機認証ではHTTPSトンネルURLを明示する。ルート `.env` はCompose用の生成設定専用。自分の環境値は `apps/api/.env` / `apps/mobile/.env` に置く。

旧構成からは新しいDB・volume・保存namespaceで開始する。データ移行や旧スキームの互換処理はない。旧Composeの稼働を止めたい場合は、その旧設定・project名で通常停止する。旧volumeは新環境へ自動接続しない。

## 2. iPhone / Android から開く

### まずExpo Goでショーケース

同じworktreeのMetroが起動していれば止め、worktreeルートから実行する。

```sh
cd apps/mobile
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

ホスト開発時は、API起動ログの実ポートで `API_PORT` を置き換えて以下を使える（Docker Desktop/OrbStack）。Linuxでは `--add-host=host.docker.internal:host-gateway` も付ける。

```sh
docker run --rm cloudflare/cloudflared:2026.10.7 tunnel \
  --no-autoupdate --protocol http2 --url http://host.docker.internal:API_PORT
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

通常のCIはsecretなしで動く。GitHub Actionsは有効で、mainはPR経由の変更と `quality`、`infrastructure`、`container` の成功を必須に設定済み。最新mainへの追従、会話の解決も必要で、管理者にも適用する。承認人数は0、force pushとブランチ削除は禁止。フォーク時は初回CI成功後に同じ保護を設定する。

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

### 手動preview配信（GitHub Actions）

PRを作成・更新すると、`expo-hono-opentofu-starter preview` コメントだけを作成・更新する。**pushではExpoへ配信しない**。コメントの **🚀 previewを配信** チェックボックスを押すと、そのコメントに記載したSHAを両OSへ配信する。実行中・成功・失敗、配信SHA、OS別リンクとQRは同じコメントへ戻る。

Actionsの **Publish preview → Run workflow** から、branchを `main`、`pr` を公開中PRの番号として指定してもよい。

```sh
gh workflow run preview.yml --ref main -f pr=PR_NUMBER
```

- リポジトリのwrite権限を持つ利用者だけ実行できる。同一リポジトリからmainへ向けた公開中PRに限り、fork・bot操作・古いSHAのコメントは拒否する。
- `pull_request_target` はコメント更新だけに使い、信頼済みworkflowのコードのみ実行する。配信側も認可後に固定SHAをcheckoutし、依存インストール時にはExpo tokenを渡さない。
- GitHub Environment **preview** はmainからのworkflowだけを許可し、専用 `EXPO_TOKEN` を登録済み。token名は `GitHub Actions: ReoHakase/expo-hono-opentofu-starter preview`、対象は `reohakase`、権限は `VIEW` / `RUN` / `PUBLISH`。productionのtokenとは分ける。
- Expo公式 `expo/expo-github-action/preview` がGitHub runner上でbundle生成と `eas update` を実行する。**Expo Workflowsの60分枠は使わない**。GitHub Actionsの実行時間と、EAS UpdateのMAU・転送量・保存容量の枠は使う。
- 配信先はEAS environment `preview`、branch `pr-<番号>`。共通preview channelやproductionは上書きしない。対応するfingerprintのDevelopment Buildからリンク・QRを開く。Expo Goは従来どおりローカル開発サーバーを使う。

フォーク先ではGitHub Environment `preview` を同様に作り、Expo tokenを登録する。

```sh
# tokenは対話入力する。引数・リポジトリへ書かない。
gh secret set EXPO_TOKEN --env preview
```

この仕組みは `issue_comment` / `pull_request_target` を使うため、workflowをdefault branchへ取り込んだ後に有効になる。既に公開中のPRには、次のpushまたは手動実行でコメントを作成する。

### Expo GitHub連携・環境変数

Expoのログイン、EAS project、GitHubリポジトリの接続は完了済み。[プロジェクトのGitHub設定](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter/github)のBase directoryは `/apps/mobile`。Expo側にあった自動PR preview・手動preview workflowは削除し、GitHub Actionsへ統一した。

フォーク・再設定時は以下を行う。

1. Expo dashboardでGitHub Appを対象リポジトリへ接続し、Base directoryを `apps/mobile` にする。
2. ExpoのEnvironment Variablesで `EXPO_PUBLIC_API_URL` をdevelopment/preview/productionそれぞれに設定する。公開URLなのでvisibilityはplain text。previewは共有staging API、productionは本番API。ローカル `.env` はクラウドへアップロードしない。未設定ならオフラインショーケースとして動く。
3. GitHubのpreview Environmentへtokenを登録し、PRコメントまたはActionsから配信する。

`apps/mobile/.eas/workflows/native-builds.yml` は手動でiOS SimulatorとAndroid preview APKを作る。Development Buildが必要なら `ios_profile=development` / `android_profile=development` を選ぶ。iOS実機用にはApple署名が必要。本番は従来どおり、APIデプロイ成功後だけ `production-update.yml` を呼び出す。両方ともExpo Workflows側の実行となる。

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

stagingとproductionは別のstate prefix、resource name、認証secret、DBを使う。最初は例の `expo-hono-opentofu-starter-staging` / `expo-hono-opentofu-starter/staging` を作成する。productionを用意するときは別の作業コピーで `name=expo-hono-opentofu-starter-production`、prefix `expo-hono-opentofu-starter/production` を設定し、stagingのstateを上書きしない。

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
export RESOURCE_NAME=expo-hono-opentofu-starter-staging
SQL_CONNECTION=$(tofu -chdir=infra output -raw sql_connection_name)
printf 'postgresql://expo-hono-opentofu-starter:%s@localhost/expo-hono-opentofu-starter?host=/cloudsql/%s' \
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
gcloud run jobs execute expo-hono-opentofu-starter-staging-migrate --region=asia-northeast1 --wait
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
