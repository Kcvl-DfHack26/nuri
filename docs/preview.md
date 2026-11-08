# PRプレビュー

同じリポジトリのPRにある **previewを配信** を、write権限を持つメンバーがチェックする。Actionsから起動する場合は、mainの **PR Preview** に公開中のPR番号を渡す。

```sh
gh workflow run preview.yml --ref main -f pr=PR_NUMBER
```

配信せずプレビューコメントを更新する場合は `gh workflow run preview.yml --ref BRANCH -f pr=PR_NUMBER -f operation=comment` を使う。`BRANCH` にはこのモードを含むブランチを指定する。配信がまだ有効でなければ「🔧 設定待ち」を表示する。初期設定後に `--ref main` で同じ操作を実行すると配信チェックボックスが有効になる。

成功すると、PRコメントの表にExpo WebとHono APIのURL、Expo GoのQRと `exps://` URL、各行の状態とデプロイ日時（JST）が表示される。pushは対象SHAを更新するだけ。プレビューを更新するときは、最新のコメントから再度リクエストする。同じSHAのリビジョンとビルド済みイメージは再利用する。

Expo Goは `apps/mobile` と同じSDKのビルドを使う。iOS実機では対応版の配布方法に従い、手元に対応版がなければWebで確認する。Expo Goに含まれないネイティブ機能は互換Development Buildで確認する。[Expo GoのSDK互換性](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)

## URLとデータ

プレビュー専用GCPプロジェクトの `asia-northeast1` に、明示的に配信を依頼したPRのCloud Runサービス `nuri-preview-pr-<番号>` をOpenTofuで作る。GCSの `<project>-nuri-preview-state` にPRごとの `pr-<番号>/default.tfstate` を置く。アプリはサービスの `run.app` URLで開く。候補リビジョンでHonoのDB接続、Webの直リンクとアセット、Expo GoのiOS／Android manifestを確認し、成功後にトラフィックを切り替える。

| パス                                                       | 処理                        |
| ---------------------------------------------------------- | --------------------------- |
| `/` と画面の直リンク                                       | Expo Web                    |
| `/api/**`                                                  | Hono API                    |
| `/` のExpo Go向けリクエスト、`.bundle`、ネイティブアセット | Expo CLIのMetro             |
| `/expo-go/qr.svg`                                          | 同じホストを指すExpo Go用QR |

Honoはコンテナ内の使い捨てPostgreSQLを使う。インスタンスが起動するたびにmigrationと見本データの投入を行う。Googleやメールの実認証は共有stagingの検証を使う。PRプレビューのURLは公開されるため、機密データを入れない。

## 利用枠とcleanup

PRプレビューはリクエスト時のみビルドし、EAS Build・EAS Updateを使わない。1環境につきCloud Runサービスを1つ使い、インスタンス数は最小0、最大1に設定する。アクセス時にはコンテナ起動・MetroのCPUとメモリ、通信量、Artifact RegistryとGCSに費用が発生し得る。アクセスが途切れるとデータとMetroキャッシュは失われる。Registryは14日を超えるイメージを定期削除する。更新成功時はそのPRの旧リビジョンとイメージを削除する。[Cloud Runの最小インスタンス](https://docs.cloud.google.com/run/docs/configuring/min-instances)

main宛てのPRをマージ・クローズすると、対象PRのstateで `tofu destroy` を実行し、専用サービスとURLを削除する。destroyが成功したあとにイメージとstateを回収する。スタックの途中で閉じたPRや中断したcleanupは日次処理で回収する。

**🧱 OpenTofu Apply** と **🧱 OpenTofu Destroy** は実行するたびに、そのプレビューのPRへ新規コメントで投稿する。コードブロックには公開できるリソース操作、件数、終了コードを載せる。詳しい診断は同じコメントのActionsリンクから確認できる。共有基盤の実行ログはActionsに残す。

Expo Free の月間枠は Android 15／iOS 15 ビルド、Workflows 60分、Update 1,000 MAU。PRごとの消費はいずれも0。別途、対応するネイティブビルドを新規作成する場合は、そのビルドの枠を使う。[Expo料金表](https://expo.dev/pricing)

Cloud Runの月間無料枠は 180,000 vCPU秒、360,000 GiB秒、200万リクエスト。東京の従量単価で1 vCPU・2 GiBの課金時間10分は約 $0.017。Registryは請求先アカウント全体で月0.5 GiBまで無料。1 GiBを7日置くと、無料枠の差し引き前で約 $0.023。合計は約 $0.040 にリクエストと外向き転送料等を加えた額で、実際のクレジット消費は共有無料枠の残りと利用量で変わる。プレビューのPostgreSQLはコンテナ内で動くため、PRごとのCloud SQL料金は発生しない。[Cloud Run料金表](https://cloud.google.com/run/pricing)・[Artifact Registry料金表](https://cloud.google.com/artifact-registry/pricing)

## 初期設定

1. 管理者が課金を有効にしたプレビュー専用GCPプロジェクトを用意し、Repository Variable `PREVIEW_GCP_PROJECT_ID` に登録する。Cloud Runのサービス作成権限はプロジェクト単位で付与されるため、共有環境が動く `kcvlb4` とは分ける。[Cloud Runの作成権限](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services/create)
2. `production` Environmentに `PREVIEW_INFRA_WIF_PROVIDER` と `PREVIEW_INFRA_SERVICE_ACCOUNT` を用意する。管理用WIFはこのリポジトリのmain、`production` Environment、`.github/workflows/infra-preview.yml` に絞り、`gs://kcvlb4-tofu-state/nuri/preview` の更新とプレビュー専用プロジェクトのセットアップを許可する。mainのCI成功後、**Preview Infrastructure** の `plan` と `apply` をActionsで実行し、共有レジストリ、PR用state bucket、配信用WIFを作成する。
3. GitHubの `preview` EnvironmentにOpenTofuの `preview_wif_provider` を `PREVIEW_WIF_PROVIDER`、`preview_service_account` を `PREVIEW_SERVICE_ACCOUNT` として登録する。プレビューの実行用サービスアカウントに本番のSecret ManagerやDB権限は付けない。
4. Repository Variable `PREVIEW_GCP_ENABLED=true` を設定し、テスト用PRの配信をリクエストする。Web、API、Expo Goと **🧱 OpenTofu Apply** を確認したらPRを閉じ、サービスとイメージの削除および **🧱 OpenTofu Destroy** のコメントを確認する。

`PREVIEW_GCP_ENABLED` を無効にすると新規の公開と自動cleanupを停止する。利用終了時は有効な間にPRを閉じ、回収を確認する。
