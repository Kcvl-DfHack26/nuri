# PRプレビューとstaging配信

同じリポジトリのPRにある **previewを配信** を、write権限を持つメンバーがチェックする。Actionsから起動する場合は、mainの **Publish or clean up PR preview** に公開中のPR番号を渡す。

```sh
gh workflow run preview.yml --ref main -f pr=PR_NUMBER
```

成功するとコメントに対象SHA、Expo Web、Hono API、Expo Goの `exps://` URLとQRが表示される。pushは対象SHAを更新するだけ。プレビューを更新するときは、最新のコメントから再度リクエストする。同じSHAのリビジョンとビルド済みイメージは再利用する。

Expo Goは `apps/mobile` と同じSDKのビルドを使う。iOS実機では対応版の配布方法に従い、手元に対応版がなければWebで確認する。Expo Goに含まれないネイティブ機能は互換Development Buildで確認する。[Expo GoのSDK互換性](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)

## URLとデータ

`kcvlb4` の `asia-northeast1` にあるプレビュー専用Cloud Runサービス `nuri-preview` のリビジョンへ、`pr-<番号>` タグでアクセスする。候補リビジョンでHonoのDB接続、Webの直リンク・アセット、Expo GoのiOS／Android manifestを確認してからタグを切り替える。旧タグは候補の検査が通るまで有効。

| パス                                                       | 処理                        |
| ---------------------------------------------------------- | --------------------------- |
| `/` と画面の直リンク                                       | Expo Web                    |
| `/api/**`                                                  | Hono API                    |
| `/` のExpo Go向けリクエスト、`.bundle`、ネイティブアセット | Expo CLIのMetro             |
| `/expo-go/qr.svg`                                          | 同じホストを指すExpo Go用QR |

Honoはコンテナ内の使い捨てPostgreSQLを使う。インスタンスが起動するたびにmigrationと見本データの投入を行う。Googleやメールの実認証は共有stagingの検証を使う。PRプレビューのURLは公開されるため、機密データを入れない。

## 利用枠とcleanup

PRプレビューはリクエスト時のみビルドし、EAS Build・EAS Updateを使わない。Cloud Runは最小0、PRリビジョンごとの最大1インスタンス。アクセス時にはコンテナ起動・MetroのCPUとメモリ、通信量、Artifact Registryに費用が発生し得る。アクセスが途切れるとデータとMetroキャッシュは失われる。古いイメージの保存上限は14日。更新成功時はそのPRの旧リビジョンとイメージを削除する。[Cloud Runの最小インスタンス](https://docs.cloud.google.com/run/docs/configuring/min-instances)

main宛てのPRをマージ・クローズするとタグ、PR専用リビジョン、イメージを削除する。スタックの途中で閉じたPRや中断したcleanupは日次処理で回収する。cleanupはPRが閉じていることを再確認する。

## 初期設定

1. 管理者が `production` Environmentに `PREVIEW_INFRA_WIF_PROVIDER` と `PREVIEW_INFRA_SERVICE_ACCOUNT` を用意する。専用の管理用WIFは、このリポジトリのmain、`production` Environment、`.github/workflows/infra-preview.yml` に絞る。GCSの `nuri/preview` stateの更新と、`infra/preview` が管理する資源の作成・権限設定を許可する。
2. mainのCIが成功した状態で **Manage PR preview infrastructure** の `plan` を実行して差分を確認し、同じActionsの `apply` で専用サービス、レジストリ、配信用WIFを作成する。
3. GitHubの `preview` EnvironmentにOpenTofuの `preview_wif_provider` を `PREVIEW_WIF_PROVIDER`、`preview_service_account` を `PREVIEW_SERVICE_ACCOUNT` として登録する。プレビューの実行用サービスアカウントに本番のSecret ManagerやDB権限は付けない。
4. Repository Variable `PREVIEW_GCP_ENABLED=true` を設定し、テスト用PRをリクエストする。実際のWeb、API、Expo Goを確認したらPRを閉じ、タグとイメージの削除を確認する。

`PREVIEW_GCP_ENABLED` を無効にすると新規の公開と自動cleanupを停止する。利用終了時は有効な間にPRを閉じ、回収を確認する。

## staging配信

共有の `nuri-staging` は、mainのCIが成功したあとに **Deploy API, Expo Web and mobile update** から配信する。API・Webイメージの入力が同じならdigestを再利用する。自動実行で同じdigestが既に全トラフィックを受け、公開URLの検査も通る場合はmigrationと配信を省く。設定変更後など、同じイメージでも新しいrevisionが必要なら `gh workflow run deploy.yml --ref main` で実行する。

新しい配信はmigration、トラフィックなしの候補revisionでの `/ready` とWeb配信の検査、mainのSHA再確認、昇格の順。昇格時に候補タグを外し、公開URLを検査する。Expoの本番Updateは既存の有効化設定に従う。
