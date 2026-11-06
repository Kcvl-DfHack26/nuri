# 認証とサンプルデータ

## ローカルで試す

[セットアップ](setup.md)のHTTPS Composeを起動すると、API・PostgreSQLとVercel EmulateのGoogle、Apple、Resendが起動する。実プロバイダのキーやGoogle Cloudは不要。

```sh
bun run dev
# 別ターミナルで、起動済みのAPIへseedを投入
bun run db:seed
```

seedは画像付き4ユーザー、8投稿、20件のいいねを固定IDで作る。`NODE_ENV=development` かつ `AUTH_EMULATE=true` に限定し、再実行しても重複せず、アプリから作ったユーザー・投稿・いいねは削除しない。サンプル画像はAPIに同梱し、外部の画像サーバーへ実行時に接続しない。写真の出典は `apps/api/assets/sample-avatars/README.md`。サンプル著者とログインアカウントは別である。

| サービス       | PortlessのURL                                              |
| -------------- | ---------------------------------------------------------- |
| Google         | `https://google.expo-hono-opentofu-starter-<ID>.localhost` |
| Apple          | `https://apple.expo-hono-opentofu-starter-<ID>.localhost`  |
| メールの受信箱 | `https://mail.expo-hono-opentofu-starter-<ID>.localhost`   |

ログイン画面のGoogle／AppleボタンでEmulateの同意画面を開き、`hanako@example.com` または `taro@example.com` を選ぶ。実際のBetter Authセッションが発行される。実アカウントのパスワードは入力しない。email magic linkは任意のテスト用メールアドレスへ送信し、ローカル受信箱で開く。

マジックリンクは10分で失効する単回利用トークン。モバイルは同じ端末で開く。SecureStoreに保存したリクエストstateを照合し、Better Authの検証とSet-CookieをExpo pluginへ引き渡す。リンクやcookieはログ・Issueへ貼らない。

`.localhost` はホスト／iOS Simulator向け。SimulatorではPortless CAもそのSimulatorの信頼ストアへ登録する。APIやMetroだけを公開トンネルへ通してもGoogle／AppleのローカルURLに実機は到達できない。エミュレータを一般公開せず、実機は到達できる検証APIと実プロバイダ設定を使う。

## 設定の正本

APIの環境変数は `apps/api/.env.example` と `src/platform/env.ts`。Composeはローカルエミュレータの内部URLと公開URLを注入する。任意のURL変数を使わない場合は未定義にし、空文字を設定しない。

| 変数                                        | 用途                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `BETTER_AUTH_URL` / `TRUSTED_ORIGINS`       | APIのHTTPS URLと許可するアプリ・Web origin                   |
| `AUTH_EMULATE`                              | ローカル限定。本番でtrueなら起動を拒否                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 実Google OAuthクライアント                                   |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`   | 実Apple Services IDと署名済みclient-secret JWT。期限前に更新 |
| `RESEND_API_KEY` / `EMAIL_FROM`             | 実メール送信キーと検証済み送信元                             |
| `PASSKEY_RP_ID` / `PASSKEY_ORIGINS`         | パスキーのRPドメインと許可origin（カンマ区切り）             |
| `APPLE_APP_ID`                              | `TEAM_ID.dev.reohakase.expohonopentofustarter`               |
| `ANDROID_SHA256_CERT_FINGERPRINTS`          | Android署名証明書のSHA-256（カンマ区切り）                   |

実OAuthのcallbackは `<BETTER_AUTH_URL>/api/auth/callback/google` と `/apple`。ローカルは別provider IDの `/emulate-google` と `/emulate-apple` で、実プロバイダのidentityと混在させない。キー未設定のログイン方法はcapabilitiesに従って利用不可にする。認証バイパス・organization・パスワードログインは設けない。

本番では `AUTH_EMULATE=false`、HTTPS、限定したoriginを使う。Google／Apple／Resendのsecret値はSecret Managerに置き、Cloud Runへsecret参照として渡す。現在のIaCはDB URLとBetter Auth secretの器まで管理しており、追加プロバイダのSecret Manager／Cloud Run参照の配線は本番設定時に追加する。今回クラウドへのapplyや本番設定変更は行っていない。`EXPO_PUBLIC_*` へsecretを入れない。

## パスキーの端末設定

WebはBetter Auth公式passkey client、ネイティブは `react-native-passkey` から同じ登録／認証検証エンドポイントを使う。Expo Goにはこのモジュールがないため、登録・ログインを無効化して理由を表示する。登録済みキーの表示・削除はログイン後に利用できる。

Development Buildには `EXPO_PUBLIC_PASSKEY_RP_ID` を設定する。iOSのAssociated Domainsはapp.config.tsが `webcredentials:<RP ID>` を生成する。APIの `/.well-known/apple-app-site-association` と `/.well-known/assetlinks.json` に正しいアプリID・署名を設定する。RPドメインから認証エンドポイントと関連付けファイルを公開し、HTTPSと端末の関連付けを確認する。Androidのnative originも `PASSKEY_ORIGINS` へ明示する。

WebAuthnの署名・challenge・origin・削除後の拒否は統合テストで検証するが、OSの実パスキーと関連付けの成功とは区別する。ネイティブ依存・Associated Domains変更は新しいビルドが必要。互換性のないOTA配信は行わない。
