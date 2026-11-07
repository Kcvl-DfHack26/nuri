# 認証とサンプルデータ

## ローカルで試す

[セットアップ](setup.md)のHTTPS Composeを起動すると、API・PostgreSQLとVercel EmulateのGoogle、Apple、Resendが起動する。実プロバイダのキーやGoogle Cloudは不要。

```sh
bun run dev
# 別ターミナルで、起動済みのAPIへseedを投入
bun run db:seed
```

seedはSNSサンプルの画像付き4ユーザー・8投稿・20件のいいねと、Plan Aのレシピ6件・その作者3人・使うメイク品2点を固定IDで作る。`NODE_ENV=development` かつ `AUTH_EMULATE=true` に限定し、再実行しても重複せず、アプリから作ったユーザー・投稿・いいね・レシピは削除しない。サンプル画像はAPIに同梱し、外部の画像サーバーへ実行時に接続しない。写真の出典は `apps/api/assets/sample-avatars/README.md` と `apps/api/assets/sample-recipes/README.md`。サンプル著者とログインアカウントは別である。

| サービス       | PortlessのURL                                   |
| -------------- | ----------------------------------------------- |
| Google         | `https://google.nuri-<issue>-<topic>.localhost` |
| Apple          | `https://apple.nuri-<issue>-<topic>.localhost`  |
| メールの受信箱 | `https://mail.nuri-<issue>-<topic>.localhost`   |

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
| `APPLE_APP_ID`                              | `TEAM_ID.com.kcvl.nuri`                                      |
| `ANDROID_SHA256_CERT_FINGERPRINTS`          | Android署名証明書のSHA-256（カンマ区切り）                   |

実OAuthのcallbackは `<BETTER_AUTH_URL>/api/auth/callback/google` と `/apple`。ローカルは別provider IDの `/emulate-google` と `/emulate-apple` で、実プロバイダのidentityと混在させない。キー未設定のログイン方法はcapabilitiesに従って利用不可にする。認証バイパス・organization・パスワードログインは設けない。

## Android仮想端末でGoogleとメールを試す（#51）

今回使う方法は、スターターにあるBetter AuthのGoogle OAuthと、Resendで送る10分・単回利用のマジックリンク。Apple、パスキー、iOSとスマートフォン実機は今回の確認範囲外。両方ともAndroid Studio仮想端末のDevelopment Buildから、公開済みのHTTPS APIへ接続する。Expo GoではDevelopment Buildのネイティブ設定を確認できない。

1. Google Cloudの `kcvlb4` にある [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=kcvlb4) で、アプリ名とサポート用メールを設定し、外部向けのテスト利用者を登録する。Google OAuthクライアントは**ウェブアプリケーション**型で作り、承認済みリダイレクトURIを `https://nuri-staging-v3kjfarita-an.a.run.app/api/auth/callback/google` にする。これはAPIがGoogleの認可コードを受け取るURIで、Androidアプリのカスタムスキームではない。[Googleの設定手順](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)。
2. Resendで送信元を用意し、送信用APIキーを発行する。任意のメールアドレスへ送る場合はドメインを検証する。送信元を `nuri <login@検証済みドメイン>` の形で決める。Resendのテスト送信先だけでは実際の受信箱でログインリンクを開く確認にならない。[Resendの送信ドメイン](https://resend.com/docs/dashboard/domains/introduction)。
3. OpenTofuを初期設定のまま適用し、Secret Managerに `nuri-staging-google-client-id`、`nuri-staging-google-client-secret`、`nuri-staging-resend-api-key` の器を作る。GoogleのID・secretとResendのキーをそれぞれのsecretへ**バージョンとして**登録する。値をリポジトリ、Issue、PR、`terraform.tfvars`、Expoの環境変数に書かない。
4. `infra/terraform.tfvars` に `google_oauth_enabled = true`、`email_login_enabled = true`、`email_from = "nuri <login@検証済みドメイン>"` を設定してOpenTofuを再適用する。新revisionはCIが固定したトラフィックを引き継がず、0%のままになる。`gcloud run services describe nuri-staging --region=asia-northeast1 --format='value(status.latestCreatedRevisionName)'` で新revision名を取得し、`gcloud run services update-traffic nuri-staging --region=asia-northeast1 --update-tags=auth-test=新revision名` でテスト用URLを付ける。そのURLの `/ready` と `/api/auth-capabilities` で `google` と `email` がtrue、`emulated` がfalseであることを確認する。secretの値そのものは表示しない。
5. candidateの準備が整ったら、[配信手順](setup.md#初回イメージサービスmigration)に従ってmainからデプロイするか、stagingの `gcloud run services update-traffic nuri-staging --region=asia-northeast1 --to-revisions=新revision名=100` で確認済みrevisionへ切り替える。`status.traffic` と公開URLの `/ready`・`/api/auth-capabilities` を再確認する。
6. `EXPO_PUBLIC_API_URL` が上の公開API URLであるDevelopment BuildをAndroid仮想端末へ入れる。Googleでログインし、アプリへ戻り、アカウント表示とログアウト、再起動後のセッションを確認する。メールでは仮想端末からリンク送信後、**同じ仮想端末**の受信箱でリンクを開いて同じ確認をする。リンクの再利用・期限切れ・ブラウザを閉じた場合の案内も確認する。

GoogleとResendの設定がない間は、公開APIのログイン方法として表示されない。Googleだけ、またはメールだけ準備できた場合は対応するフラグだけを有効にできる。片方のGoogle OAuth credentialだけが設定された場合、APIは起動時に拒否する。

### 戻り先リンクの扱い

現行のExpo clientはGoogle OAuthからアプリへ戻るカスタムスキームのURLへセッションcookieを載せる。メールのリンクも同じスキームに単回利用tokenを載せる。同じスキームを登録した別アプリがこれらを受け取る可能性がある。メールの端末内state照合は誤操作を防ぐが、リンクを横取りした別アプリがtokenを直接交換することまでは防げない。このため今回の採用は管理下のAndroid仮想端末とテストアカウントによる検証に限る。一般向けビルドを配る前に、所有を検証したHTTPSドメインのAndroid App Links／iOS Universal Links、またはtokenをURLへ載せない方式へ移す必要がある。これは#51の仮想端末での動作確認と区別して扱う。

本番では `AUTH_EMULATE=false`、HTTPS、限定したoriginを使う。Google・Resendのsecret値はSecret Managerに置き、Cloud Runへsecret参照として渡す。OpenTofuはGoogle・Resendのsecretの器と有効化フラグを管理する。Appleの実サービス接続は今回扱わない。`EXPO_PUBLIC_*` へsecretを入れない。

## パスキーの端末設定

WebはBetter Auth公式passkey client、ネイティブは `react-native-passkey` から同じ登録／認証検証エンドポイントを使う。Expo Goにはこのモジュールがないため、ログイン画面（⑱）にはパスキーの操作を出さず、設定の登録は無効化して理由を表示する。登録済みキーの表示・削除はログイン後に利用できる。

Development Buildには `EXPO_PUBLIC_PASSKEY_RP_ID` を設定する。iOSのAssociated Domainsはapp.config.tsが `webcredentials:<RP ID>` を生成する。APIの `/.well-known/apple-app-site-association` と `/.well-known/assetlinks.json` に正しいアプリID・署名を設定する。RPドメインから認証エンドポイントと関連付けファイルを公開し、HTTPSと端末の関連付けを確認する。Androidのnative originも `PASSKEY_ORIGINS` へ明示する。

WebAuthnの署名・challenge・origin・削除後の拒否は統合テストで検証するが、OSの実パスキーと関連付けの成功とは区別する。ネイティブ依存・Associated Domains変更は新しいビルドが必要。互換性のないOTA配信は行わない。
