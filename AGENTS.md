# nuri 作業の入口

- 最初に[アプリ概要](docs/overview.md)を読み、現行の機能、未決事項、検証の範囲を区別する。
- 画面変更の前に[Figma「実装plan」](https://www.figma.com/design/dwoWsLmVBU5c0Hx0vlVWua/?node-id=21-11426)の対象ノードと既存の画面・導線を照合する。色と文字はFoundationsに従い、設計との差が必要ならIssueに理由を記録する。[UIの規約](docs/ui.md)と[画面番号・機能要件](docs/requirements.md)を参照する。
- iOSの操作感を優先し、Androidでも同じ機能を提供する。Webの対応範囲は[配信設計](docs/architecture.md#審査向けwebの配信設計)と対象Issueで確認する。
- ライブ顔追跡と写真診断は端末内で処理する。⑫-3の録画は解析への明示同意後、プロフィール写真や公開用サムネイルは利用者が保存・投稿を選んだ時点で送る。SNSのURL取り込みは準備中で、取得方法と権利条件は未決。[プライバシー要件](docs/requirements.md#5-非機能要件)を参照する。
- 作業指示・文書・図の説明は日本語で書く。コマンド、識別子、引用元の正式名称は保つ。

## 実装の境界

- `apps/mobile/src/app` はExpo Routerのルートとレイアウト専用。画面の部品やフックは外に置く。APIは `apps/api` のHonoが担当し、Node.jsで配信する。依存導入と検査にはBunを使う。
- `packages/shared` はZodのスキーマと純粋関数を置く。端末固有のモジュール、DB接続、秘密情報、サーバーの環境変数に依存させない。
- モバイルが `@starter/api/contract` から読み込めるのは `AppType` の型だけ。Hono RPCの型を再利用し、APIの実装やレスポンス型の複製を持ち込まない。
- 外部入力はZodで検証する。Better Authが認証し、保護されたHonoルートが認可する。モバイルのセッションは `@better-auth/expo` を通して `expo-secure-store` に保持する。
- TypeScriptは厳格に扱い、`any`、安全でない型アサーション、未処理のPromiseを避ける。ライブラリの標準機能と既存の実装を再利用する。
- ローカルではGCPの認証情報なしで開発できるようにする。開発用seedは冪等とし、利用者が作成・変更したデータを保つ。構成の詳細と実装上の判断は[アーキテクチャ](docs/architecture.md)を更新する。

## IssueからPRまで

- 実装・修正・文書・開発手順の変更は、Issueの作成または確認、担当の設定から始める。事前の読み取り調査は可能。目的・受け入れ条件・検証方法を記録し、作業範囲が変わったら関連作業を続ける前にIssueを更新する。
- 1つの実装Issueにつき1ブランチ・1PR。ブランチ名は `codex/<issue>-<topic>` とし、`gh issue develop` でIssueに紐付ける。worktree名は `nuri-<issue>-<topic>` とし、Composeの分離のためホスト内で一意にする。小文字の英数字・ハイフンで63文字以内とし、両端は英数字にする。
- 実装依頼は検証・コミット・push・Draft PR作成または更新まで進める。PRに `Closes #<issue>` と最新の対象SHAでの確認結果を記載し、IssueとPRのリンクを報告する。
- Draft解除とマージは許可された範囲で行う。必須チェックとブランチ保護を確認し、マージ後はPRとIssueの状態を取り直す。

## スキル

- Expoの作業は `.agents/skills/expo-overview/SKILL.md` から入り、該当するExpo・EASスキルを読む。変更には `minimum-impl`、Issue・PRには `github-issue-pr-ops`、コミットには `conventional-commit` を使う。
- 人が読むPR・READMEに載せる構成図やフロー図を作成・更新するときは、[`diagram-design`](.agents/skills/diagram-design/SKILL.md)を使う。公開用の書き出しと配置は[README掲載画像の手順](docs/images/readme/README.md#prとreadmeに載せる図)を参照する。
- 取り込んだスキルと `skills-lock.json` は、スキルの追加・更新を目的とする変更で管理する。

## 開発と検証

- [セットアップ](docs/setup.md)に沿って、ホストのPortlessからworktree別のComposeを起動する。共有のHTTPSプロキシと公開CAを使う。起動・停止時は同じworktreeを指定し、DBのボリュームと生成された接続設定を保つ。Gitフックの初回導入はworktree間で直列に行う。
- ネイティブUIの確認・撮影はPortlessとExpo Device Hubを使う。[仮想端末の接続とクライアントの選び方](docs/setup.md#simulatorとemulatorで開発する)を確認する。
- [検証手順](docs/testing.md)から変更を保証できる最も低い層を選ぶ。BunはAPI・純粋な処理、Jestはモバイルの状態と操作、Maestroはネイティブの代表経路を担当する。文書変更では整形・リンク・記述の整合を確認する。インフラ検査は `infra/bootstrap` も対象にする。
- [PRに残す検証結果](docs/testing.md#prに残す検証結果)に従い、対象SHA・環境・操作・実測結果と未確認事項を分ける。指定された確認が止まったら、先に確認できた証拠と再開条件を共有する。

## 配信と秘密情報

- 通常CIはGCPやExpoの秘密情報を必要としない。外部サービスの設定と配信条件は[セットアップ](docs/setup.md)を参照する。Expo MCPの認証は `codex mcp login expo` を使う。
- GCPのローカル認証はADC、CIはWorkload Identity Federationを使う。長期のサービスアカウント鍵、認証情報、端末の接続設定をコミットしない。
- OpenTofuはリソース、DrizzleはDBスキーマ、CIは配信を担当する。稼働中のAPIと互換性のあるマイグレーションを先に適用し、準備確認後にトラフィックを切り替える。APIの準備完了後に本番Expo Updateを公開する。
- ネイティブ依存や設定が変わったら互換ビルドを作る。フィンガープリントをruntime versionに使い、互換性のないOTA更新を配信しない。
- 検査を通すためにインフラを適用したり、永続データを削除したり、ストアへ提出したり、本番のトラフィックを変更したりしない。
