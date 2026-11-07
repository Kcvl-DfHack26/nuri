# nuri

**自分の顔で、手順どおりに。**

nuriは、メイクの手順をレシピとして選び、インカメラに映る自分の顔へ塗る範囲と色を重ねながら、1ステップずつ再現するモバイルアプリです。SNSの投稿からレシピを取り込み、完成形をメイク前と比較する体験を目指します。

## 現在の実装

Expo／Hono／OpenTofuの[スターター](https://github.com/ReoHakase/expo-hono-opentofu-starter)を土台に、Figma「Plan A」に沿ってレシピ閲覧、メイク手順と完成比較、SNS取り込み、投稿、提案、マイページの画面を追加しました。レシピや商品、メイク画面の一部にはサンプルデータを使っています。APIにはスターター由来の認証、タイムライン、投稿、いいねが残っています。

次は[端末上の顔追跡（P1）](https://github.com/Kcvl-DfHack26/nuri/issues/25)と[顔に合わせた塗る範囲の重ね表示（P2）](https://github.com/Kcvl-DfHack26/nuri/issues/26)を開発ビルドで検証します。SNSからの自動取り込みは取得方法と権利条件を確認中です。初期の機能範囲と未決事項は[アプリ概要](docs/overview.md)と[要件定義](docs/requirements.md)にまとめています。

## 開発を始める

ローカルサーバーはDocker Composeで起動する。ホストにGit、Docker Engine + Compose v2、Node.js 24以降、Portless 0.16.0を用意する。Bunはコンテナに含まれる。WindowsではWSL2のLinuxファイルシステムで作業し、Docker DesktopのWSL integrationを有効にする。

```sh
npm install --global portless@0.16.0
sh scripts/worktree-init.sh
# ホストで一度だけ。既存のHTTPS/443 proxyは再利用する。
portless proxy start --https --port 443
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose up --build api metro
```

依存導入・未作成の環境ファイル生成・DB migrationが自動で行われる。PortlessがAPI・Metroの空きポートと `https://<service>.<project>.localhost` を割り当て、PostgreSQLとvolumeはworktreeごとに分離する。DBポートはホストへ公開しない。linked worktreeは `nuri-<issue>-<topic>` と命名する。旧project名からの切替は[移行手順](docs/setup.md#旧ハッシュ名から移行する)を参照。

Simulator／Emulatorの開発ビルドは[端末用のHTTPS設定](docs/setup.md#simulatorとemulatorで開発する)を使う。ホストで `bun run dev:devices`、別ターミナルで `bun run devices` を実行する。Expo Goで実機から開く場合は、起動中のMetroを止めてトンネル用構成を使う。

```sh
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose \
  -f compose.yaml -f compose.go.yaml up --build api metro
```

MetroログのQRコードをSDK 58対応のExpo Goで開く。実機には到達できるHTTPS APIが必要。MetroのトンネルではAPIやローカルOAuthは公開されない。APIを使う場合は[実機から届くAPIの設定](docs/setup.md#ローカルapiも実機から使う)を参照。

Dev Containers対応エディタでは **Reopen in Container** で編集・検査環境へ入れる。アプリの起動・停止はホストのPortlessで行う。終了時は `PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose --profile '*' down` を使う。自worktreeのrouteとコンテナだけを終了し、volumeを保持する。

**Bunの短縮コマンド、APIトンネル、Google Cloud・GitHub・EASの初期設定は [docs/setup.md](docs/setup.md) にまとめている。**

## 構成

| 場所                             | 責務                                                                        |
| -------------------------------- | --------------------------------------------------------------------------- |
| `apps/mobile`                    | Expo SDK 58 / React Native 0.88 / Expo Router / Expo UI                     |
| `apps/api`                       | Node.js / Hono RPC / Better Auth / Drizzle / PostgreSQL                     |
| `apps/emulate`                   | Vercel EmulateのGoogle・Apple・Resend                                       |
| `packages/shared`                | Zodスキーマと純粋な処理                                                     |
| `infra`                          | OpenTofu: Cloud Run、Cloud SQL、IAM、WIF、Secret Manager、Artifact Registry |
| `.devcontainer` / `compose.yaml` | Linux上のNode・Bun・gcloud・OpenTofu・TFLint・CodexとPostgreSQL             |
| `.github/workflows`              | 品質検査、コンテナ検証、手動PRプレビュー、APIデプロイ                       |
| `apps/mobile/.eas/workflows`     | 手動ネイティブビルド、本番Expo Update                                       |

## よく使うコマンド

ホストにBun 1.4.4を入れて `bun install --frozen-lockfile && bun run setup` すると、以下の短縮コマンドを使える。`dev*`、`services:*`、`db:migrate`、`test:integration` はホストからComposeを操作する。それ以外の検査はDev Container内でも実行できる。

| コマンド                                        | 内容                                               |
| ----------------------------------------------- | -------------------------------------------------- |
| `bun run setup`                                 | worktree設定と未作成のアプリenvを生成              |
| `bun run dev`                                   | ホストからComposeのDB・API・Metroを起動            |
| `bun run dev:devices`                           | 仮想端末用のHTTPS設定でAPI・Metroを起動            |
| `bun run devices`                               | ホストでExpo Device Hubを起動                      |
| `bun run dev:go`                                | Expo Go用のMetroトンネル付きで起動                 |
| `bun run check`                                 | 整形、型付きlint、型検査、Bun/Jestテスト、Fallow   |
| `bun run test:integration`                      | 起動済みのPostgreSQLを使った認証・認可テスト       |
| `bun run db:generate` / `bun run db:migrate`    | migration生成 / 適用                               |
| `bun run db:seed`                               | ローカルの4ユーザー・アバター・8投稿・いいねを用意 |
| `bun run doctor`                                | Expoの互換性確認                                   |
| `bun run export:mobile`                         | iOS・Androidのbundle生成                           |
| `bun run build:api`                             | Node.js向けAPI build                               |
| `bun run services:up` / `bun run services:down` | DB・API・Metroをバックグラウンド起動 / 停止        |

## 文書

- [nuriのアプリ概要](docs/overview.md)と[要件定義](docs/requirements.md)
- [開発環境・アカウント・デプロイ設定](docs/setup.md)
- [アーキテクチャと技術選定](docs/architecture.md)
- [認証とseed](docs/auth.md)
- [テストと実機チェック](docs/testing.md)
- [エージェントの作業規約](AGENTS.md)
- [Expoプロジェクト](https://expo.dev/accounts/kcvlb4/projects/nuri)

通常のCIにはGoogle CloudやExpoのsecretは不要。GCPデプロイと本番OTA配信は、設定完了後に明示的に有効化する。
