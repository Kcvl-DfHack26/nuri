# 認証とサンプルデータ

今回の⑱ログイン画面はGoogleとパスキー、ゲスト参加を提供する。メールのマジックリンクは送信ドメインが未検証で、アプリへのログイン完了も未確認のため表示しない。サーバー側の既存処理とローカル検証手順は残し、一般利用者への提供は #177 で再開する。

## ローカルで試す

[セットアップ](setup.md)のHTTPS Composeを起動すると、API・PostgreSQLとVercel EmulateのGoogle、Resendが起動する。実プロバイダのキーやGoogle Cloudは不要。

```sh
bun run dev
# 別ターミナルで、起動済みのAPIへseedを投入
bun run db:seed
```

seedは画像付きのサンプルユーザーと、実装planの全体メイクレシピ6件・眉のレシピ6件・使うメイク品2点を固定IDで作る。`NODE_ENV=development` かつ `AUTH_EMULATE=true` に限定し、再実行しても重複せず、アプリから作ったユーザー・レシピは削除しない。サンプル画像はFlociのworktree専用バケットへ投入し、APIの `/media/` から配信する。PR previewでは同じ経路でPR専用の非公開Cloud Storageバケットを使う。写真の出典は `apps/api/assets/sample-avatars/README.md` と `apps/api/assets/sample-recipes/README.md`。サンプル著者とログインアカウントは別である。

旧seedのDBを引き継ぐ場合も、開発API起動後に `bun run db:seed` を実行する。画像の投入がすべて成功してからDBを更新する。旧サンプル画像を参照するサンプルユーザー、レシピ、商品が `/media/` へ切り替わる。サンプルユーザー自身が変更した画像や名前は保持する。旧 `/sample-avatars/` と `/sample-recipes/` の静的URLは廃止したため、seed後にアプリを再読み込みする。失敗時はバケットと接続設定を確認して同じコマンドを再実行する。

| サービス       | PortlessのURL                                   |
| -------------- | ----------------------------------------------- |
| Google         | `https://google.nuri-<issue>-<topic>.localhost` |
| メールの受信箱 | `https://mail.nuri-<issue>-<topic>.localhost`   |

ログイン画面のGoogleボタンでEmulateの同意画面を開き、`hanako@example.com` または `taro@example.com` を選ぶ。実際のBetter Authセッションが発行される。実アカウントのパスワードは入力しない。email magic linkは任意のテスト用メールアドレスへ送信し、ローカル受信箱で開く。

マジックリンクは10分で失効する単回利用トークン。モバイルは同じ端末で開く。メール内のHTTPSリンクから「nuriアプリで開く」を押してアプリへ戻り、SecureStoreに保存したリクエストstateを照合する。案内ページはURL断片からリンクを作り、トークンをCloud Runへのリクエストやアクセスログへ送らない。Better Authの検証とSet-CookieをExpo pluginへ引き渡す。リンクやcookieはログ・Issueへ貼らない。

`.localhost` はホスト／iOS Simulator向け。SimulatorではPortless CAもそのSimulatorの信頼ストアへ登録する。APIやMetroだけを公開トンネルへ通してもGoogleのローカルURLに実機は到達できない。エミュレータを一般公開せず、実機は到達できる検証APIと実プロバイダ設定を使う。

## 設定の正本

APIの環境変数は `apps/api/.env.example` と `src/platform/env.ts`。Composeはローカルエミュレータの内部URLと公開URLを注入する。任意のURL変数を使わない場合は未定義にし、空文字を設定しない。

| 変数                                        | 用途                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `BETTER_AUTH_URL` / `TRUSTED_ORIGINS`       | APIのHTTPS URLと許可するアプリ・Web origin（カンマ区切り）   |
| `AUTH_EMULATE`                              | ローカル限定。本番でtrueなら起動を拒否                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 実Google OAuthクライアント                                   |
| `RESEND_API_KEY` / `EMAIL_FROM`             | 実メール送信キーと送信元。一般配信には検証済みドメインが必要 |
| `PASSKEY_RP_ID` / `PASSKEY_ORIGINS`         | パスキーのRPドメインと許可origin（カンマ区切り）             |
| `APPLE_APP_ID`                              | `TEAM_ID.com.kcvl.nuri`                                      |
| `ANDROID_SHA256_CERT_FINGERPRINTS`          | Android署名証明書のSHA-256（カンマ区切り）                   |

`TRUSTED_ORIGINS` は前後の空白と空要素を除いて読み込む。Better AuthはアプリとWebの値を使う。APIのCORSと書き込み時のOrigin確認には、設定されたWeb originとAPI自身のoriginを使う。

実OAuthのcallbackは `<BETTER_AUTH_URL>/api/auth/callback/google`。ローカルは別provider IDの `/emulate-google` で、実プロバイダのidentityと混在させない。キー未設定のログイン方法はcapabilitiesに従って利用不可にする。認証バイパス・organization・パスワードログインは設けない。

Googleとマジックリンクは、大文字・小文字を区別しない同じ確認済みメールアドレスで同一アカウントに入る。Better Authがメールを正規化し、PostgreSQLの既存の `user.email` 一意制約で重複を防ぐ。マイページから「プロフィール設定」を開き、設定項目の末尾にある「アカウント」でGoogle連携状態を確認できる。既存のApple連携とユーザーデータは保持する。Appleでのみログインしていた利用者は、登録メールにマジックリンクを受け取れる場合、同じアカウントを利用できる。非公開メールの転送が止まっている場合はこの経路を使えない。

## アプリからのGoogleログイン

iOS、Android、WebでBetter AuthのブラウザOAuthを使う。Google Cloudのウェブ用OAuthクライアントはAPIに設定する。iOSとAndroidではBetter AuthのExpo clientが認証ブラウザを開き、完了後にアプリへ戻ってセッションを保存する。ローカルのEmulateも同じ入口を使う。

## Android仮想端末でGoogleとメールを試す（#51）

今回使う方法は、スターターにあるBetter AuthのGoogle OAuthと、Resendで送る10分・単回利用のマジックリンク。Apple、パスキー、iOSとスマートフォン実機は今回の確認範囲外。両方ともAndroid Studio仮想端末のDevelopment Buildから、公開済みのHTTPS APIへ接続する。Expo GoではDevelopment Buildのネイティブ設定を確認できない。

1. Google Cloudの `kcvlb4` にある [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=kcvlb4) で、アプリ名とサポート用メールを設定し、外部向けのテスト利用者を登録する。Google OAuthクライアントは**ウェブアプリケーション**型で作り、承認済みリダイレクトURIを `https://nuri-staging-v3kjfarita-an.a.run.app/api/auth/callback/google` にする。これはAPIがGoogleの認可コードを受け取るURIで、Androidアプリのカスタムスキームではない。[Googleの設定手順](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)。
2. Resendで送信専用APIキーを発行する。ドメイン未登録の段階では `nuri <onboarding@resend.dev>` を送信元にして、Resendアカウント自身の受信箱だけで検証する。任意の利用者へ送る前には所有ドメインを検証し、送信元を `nuri <login@検証済みドメイン>` に替える。`delivered@resend.dev` などの疑似宛先では実際の受信箱でログインリンクを開く確認にならない。[Resendの送信ドメイン](https://resend.com/docs/dashboard/domains/introduction)。
3. [本番OpenTofuのActions](setup.md#本番のopentofuをgithub-actionsで適用する)でSecret Managerに設定先を用意する。管理者が承認済みのGitHub Actionsで `nuri-staging-google-client-id`、`nuri-staging-google-client-secret`、`nuri-staging-resend-api-key` に値を登録する。値はリポジトリ、Issue、PR、`terraform.tfvars`、Expoの環境変数に書かない。
4. `production` Environmentの `TOFU_VARIABLES_JSON` で `google_oauth_enabled` と `email_login_enabled` を有効にし、`email_from` に検証用または検証済みの送信元を設定する。GitHub Actionsのplanを確認してから適用する。
5. [アプリ配信のActions](setup.md#ciからのデプロイを有効にする)で新しいrevisionを配信する。公開URLの `/ready` と `/api/auth-capabilities` で `google` と `email` がtrue、`emulated` がfalseであることを確認する。
6. `EXPO_PUBLIC_API_URL` が上の公開API URLであるDevelopment BuildをAndroid仮想端末へ入れる。Googleでログインし、アプリへ戻り、アカウント表示とログアウト、再起動後のセッションを確認する。メールでは仮想端末からリンク送信後、**同じ仮想端末**の受信箱でHTTPSリンクを開き、表示された「nuriアプリで開く」を押す。アプリへの復帰と同じ確認をする。リンクの再利用・期限切れ・ブラウザを閉じた場合の案内も確認する。

GoogleとResendの設定がない間は、公開APIのログイン方法として表示されない。Googleだけ、またはメールだけ準備できた場合は対応するフラグだけを有効にできる。片方のGoogle OAuth credentialだけが設定された場合、APIは起動時に拒否する。

### 戻り先リンクの扱い

現行のExpo clientはGoogle OAuthからアプリへ戻るカスタムスキームのURLへセッションcookieを載せる。メールはメールアプリが開けるHTTPSの案内ページを経由し、そこから同じスキームに単回利用tokenを載せる。同じスキームを登録した別アプリがこれらを受け取る可能性がある。メールの端末内state照合は誤操作を防ぐが、リンクを横取りした別アプリがtokenを直接交換することまでは防げない。このため今回の採用は管理下のAndroid仮想端末とテストアカウントによる検証に限る。一般向けビルドを配る前に、所有を検証したHTTPSドメインのAndroid App Links／iOS Universal Links、またはtokenをURLへ載せない方式へ移す必要がある。これは#51の仮想端末での動作確認と区別して扱う。

本番では `AUTH_EMULATE=false`、HTTPS、限定したoriginを使う。Google・Resendのsecret値はSecret Managerに置き、Cloud Runへsecret参照として渡す。OpenTofuはGoogle・Resendのsecretの器と有効化フラグを管理する。`EXPO_PUBLIC_*` へsecretを入れない。

## パスキーの端末設定

WebはBetter Auth公式passkey client、ネイティブは `react-native-passkey` から同じ登録／認証検証エンドポイントを使う。Expo Goにはこのモジュールがないため、ログイン画面（⑱）にはパスキーの操作を出さず、プロフィール設定の登録ボタンは無効化して理由を表示する。「プロフィール設定」末尾の「アカウント」で登録件数を確認できる。「パスキー」を展開すると、その場で登録済みキーの一覧・追加・削除を操作できる。

Development Buildには `EXPO_PUBLIC_PASSKEY_RP_ID` を設定する。iOSのAssociated Domainsはapp.config.tsが `webcredentials:<RP ID>` を生成する。APIの `/.well-known/apple-app-site-association` と `/.well-known/assetlinks.json` に正しいアプリID・署名を設定する。RPドメインから認証エンドポイントと関連付けファイルを公開し、HTTPSと端末の関連付けを確認する。Androidのnative originも `PASSKEY_ORIGINS` へ明示する。

WebAuthnの署名・challenge・origin・削除後の拒否は統合テストで検証するが、OSの実パスキーと関連付けの成功とは区別する。ネイティブ依存・Associated Domains変更は新しいビルドが必要。互換性のないOTA配信は行わない。
