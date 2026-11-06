# nuri

**自分の顔で、手順どおりに。**

nuriは、メイクの手順をレシピとして選び、インカメラに映る自分の顔へ塗る範囲と色を重ねながら、1ステップずつ再現するモバイルアプリです。SNSの投稿からレシピを取り込み、完成形をメイク前と比較する体験を目指します。

## 最初に確かめること

顔の特徴点を端末上で追跡し、眉・チーク・シェーディングの塗る範囲を顔の動きに合わせて表示できるか検証します。この結果を踏まえて、レシピ選択から完成プレビューまでの実装を進めます。

## 開発の出発点

[Expo + Hono + OpenTofu starter](https://github.com/ReoHakase/expo-hono-opentofu-starter)を `starter/main` から取り込んでいます。アプリのコードは、まだスターターのSNSサンプル（タイムライン・投稿・いいね）のままです。nuriの画面へ順に置き換えます。

機能範囲、PoCの順序、未決事項は[概要](docs/overview.md)を参照してください。

## 開発を始める

ローカルサーバーはDocker Composeで起動する。ホストにGit、Docker Engine + Compose v2、Node.js 24以降、Portless 0.16.0を用意する。Bunはコンテナに含まれる。WindowsではWSL2のLinuxファイルシステムで作業し、Docker DesktopのWSL integrationを有効にする。

```sh
npm install --global portless@0.16.0
sh scripts/worktree-init.sh
# ホストで一度だけ。既存のHTTPS/443 proxyは再利用する。
portless proxy start --https --port 443
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose up --build api metro
```

依存導入・未作成の環境ファイル生成・DB migrationが自動で行われる。PortlessがAPI・Metroの空きポートと `https://<service>.expo-hono-opentofu-starter-<ID>.localhost` を割り当て、PostgreSQLとvolumeはworktreeごとに分離する。DBポートはホストへ公開しない。

Expo GoでiPhone・Androidから開く場合は、上の起動をCtrl+Cで止めてトンネル用構成を使う。

```sh
PORTLESS_HTTPS=1 PORTLESS_PORT=443 portless compose \
  -f compose.yaml -f compose.go.yaml up --build api metro
```

MetroログのQRコードをSDK 58対応のExpo Goで開く。実機には到達できるHTTPS APIが必要。ローカルOAuthエミュレータはホスト／iOS Simulator用で、Metroトンネルだけでは実機から接続できない。

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
| `.github/workflows`              | 品質検査、コンテナ検証、APIデプロイと対応するExpo Update                    |
| `apps/mobile/.eas/workflows`     | PRプレビュー、開発ビルド、配信ワークフロー                                  |

## よく使うコマンド

ホストにBun 1.4.4を入れて `bun install --frozen-lockfile && bun run setup` すると、以下の短縮コマンドを使える。`dev*`、`services:*`、`db:migrate`、`test:integration` はホストからComposeを操作する。それ以外の検査はDev Container内でも実行できる。

| コマンド                                        | 内容                                               |
| ----------------------------------------------- | -------------------------------------------------- |
| `bun run setup`                                 | worktree設定と未作成のアプリenvを生成              |
| `bun run dev`                                   | ホストからComposeのDB・API・Metroを起動            |
| `bun run dev:go`                                | Expo Go用のMetroトンネル付きで起動                 |
| `bun run check`                                 | 整形、型付きlint、型検査、Bun/Jestテスト、Fallow   |
| `bun run test:integration`                      | PostgreSQLを使った認証・認可テスト                 |
| `bun run db:generate` / `bun run db:migrate`    | migration生成 / 適用                               |
| `bun run db:seed`                               | ローカルの4ユーザー・アバター・8投稿・いいねを用意 |
| `bun run doctor`                                | Expoの互換性確認                                   |
| `bun run export:mobile`                         | iOS・Androidのbundle生成                           |
| `bun run build:api`                             | Node.js向けAPI build                               |
| `bun run services:up` / `bun run services:down` | DB・API・Metroをバックグラウンド起動 / 停止        |

## 文書

- [nuriのアプリ概要](docs/overview.md)
- [開発環境・アカウント・デプロイ設定](docs/setup.md)
- [アーキテクチャと技術選定](docs/architecture.md)
- [認証とseed](docs/auth.md)
- [テストと実機チェック](docs/testing.md)
- [エージェントの作業規約](AGENTS.md)
- [Expoプロジェクト](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter)

通常のCIにはGoogle CloudやExpoのsecretは不要。GCPデプロイと本番OTA配信は、設定完了後に明示的に有効化する。
