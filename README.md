# Daylight · Expo + Hono + OpenTofu

小さな習慣を記録する、Expo UIのショーケース兼ハッカソン用スターター。iOSの使い心地を優先し、Androidでも同じ機能を提供する。

- **Today**: おすすめの習慣、今日の進捗、完了シート
- **Library**: 検索、お気に入り、詳細画面
- **Settings**: 外観、触覚フィードバック、日次目標、API接続確認
- **Account**: Better Authによるメール登録・ログイン・ログアウト

Google Cloudなしでも、習慣・お気に入り・設定を端末内に保存して試せる。アカウント機能はローカルHono + PostgreSQL、または設定したHTTPS APIに接続する。端末内データのアカウント同期は行わない。

## 開発を始める

DockerとDev Containers対応エディタを用意し、**Reopen in Container**を実行する。依存関係のインストール、ローカル環境ファイルの作成、DB migrationが自動で行われる。

```sh
bun run dev
```

iPhoneのExpo Goから、ホストのOSやLAN構成に依存せず開く場合:

```sh
# apps/mobile の Metro を止めてから、同じコンテナ内で実行
cd apps/mobile
bun run go
```

表示されたQRコードをiPhoneのカメラで読み取る。AndroidはExpo Goから開く。Expo GoはSDK 58対応版を使う。サーバー用の秘密情報は不要。

**エディタを使わないCompose起動、APIトンネル、Google Cloud・GitHub・EASの初期設定は [docs/setup.md](docs/setup.md) にまとめている。**

## 構成

| 場所                             | 責務                                                                        |
| -------------------------------- | --------------------------------------------------------------------------- |
| `apps/mobile`                    | Expo SDK 58 / React Native 0.88 / Expo Router / Expo UI                     |
| `apps/api`                       | Node.js / Hono RPC / Better Auth / Drizzle / PostgreSQL                     |
| `packages/shared`                | Zodスキーマ、共有カタログ、純粋な検索処理                                   |
| `infra`                          | OpenTofu: Cloud Run、Cloud SQL、IAM、WIF、Secret Manager、Artifact Registry |
| `.devcontainer` / `compose.yaml` | Linux上のNode・Bun・gcloud・OpenTofu・TFLint・CodexとPostgreSQL             |
| `.github/workflows`              | 品質検査、コンテナ検証、APIデプロイと対応するExpo Update                    |
| `apps/mobile/.eas/workflows`     | PRプレビュー、開発ビルド、配信ワークフロー                                  |

## よく使うコマンド

| コマンド                                     | 内容                                             |
| -------------------------------------------- | ------------------------------------------------ |
| `bun run setup`                              | 未作成のローカルenvだけを生成                    |
| `bun run dev`                                | TurborepoでAPIとMetroを起動                      |
| `bun run check`                              | 整形、型付きlint、型検査、Bun/Jestテスト、Fallow |
| `bun run test:integration`                   | PostgreSQLを使った認証・認可テスト               |
| `bun run db:generate` / `bun run db:migrate` | migration生成 / 適用                             |
| `bun run doctor`                             | Expoの互換性確認                                 |
| `bun run export:mobile`                      | iOS・Androidのbundle生成                         |
| `bun run build:api`                          | Node.js向けAPI build                             |

## 文書

- [開発環境・アカウント・デプロイ設定](docs/setup.md)
- [アーキテクチャと技術選定](docs/architecture.md)
- [テストと実機チェック](docs/testing.md)
- [エージェントの作業規約](AGENTS.md)
- [意思決定の履歴: Expo技術選定検討](chatgpt-conversation://6aec01ec-6938-83e8-94df-24f41ae3ad55)
- [Expoプロジェクト](https://expo.dev/accounts/reohakase/projects/expo-hono-opentofu-starter)

通常のCIにはGoogle CloudやExpoのsecretは不要。GCPデプロイと本番OTA配信は、設定完了後に明示的に有効化する。
