# expo-hono-opentofu-starter

日本語のto C向けSNSサンプル。iOSの使い心地を優先し、Androidにも同じ機能を提供する。主要機能はXを参考にしたReusables／Uniwindの独自UI、ナビゲーションと設定はExpo UI／Expo RouterのネイティブUIを使う。

- **ホーム**: アバター付きタイムライン、500文字の投稿、いいね、OSの共有、自分の投稿の削除
- **マイページ**: 自分の投稿とプロフィール編集
- **設定**: 外観、触覚フィードバック、アカウント、パスキー
- **ログイン**: Google／Apple OAuth、メールのマジックリンク、パスキー。organization・パスワード認証は持たない

Google CloudやOAuthキーなしで、ComposeのHono・PostgreSQL・Vercel Emulateを使って試せる。投稿といいねはAPIに保存し、外観・触覚設定は端末内に保存する。認証と実機パスキーの前提は [docs/auth.md](docs/auth.md) を参照。

## 開発を始める

ローカルサーバーはDocker Composeで起動する。ホストにGit、Docker Engine + Compose v2、Node.js 24以降、Portless 0.16.0を用意する。Bunはコンテナに含まれる。

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

- [開発環境・アカウント・デプロイ設定](docs/setup.md)
- [アーキテクチャと技術選定](docs/architecture.md)
- [認証とseed](docs/auth.md)
- [テストと実機チェック](docs/testing.md)
- [エージェントの作業規約](AGENTS.md)
- [意思決定の履歴: Expo技術選定検討](chatgpt-conversation://6aec01ec-6938-83e8-94df-24f41ae3ad55)
- [Expoプロジェクト](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter)

通常のCIにはGoogle CloudやExpoのsecretは不要。GCPデプロイと本番OTA配信は、設定完了後に明示的に有効化する。
