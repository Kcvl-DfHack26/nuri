# PRプレビュー

初期設定後は、同じリポジトリからmainに向けたPRの作成、再オープン、pushで自動配信する。Draftも対象とする。再配信するには、write権限のあるメンバーがPRの **previewを配信** をチェックするか、mainの **PR Preview** に公開中のPR番号を渡す。

```sh
gh workflow run preview.yml --ref main -f pr=PR_NUMBER
```

配信せずプレビューコメントを更新する場合は `gh workflow run preview.yml --ref BRANCH -f pr=PR_NUMBER -f operation=comment` を使う。`BRANCH` にはこのモードを含むブランチを指定する。配信がまだ有効でなければ「🔧 設定待ち」を表示する。初期設定後に `--ref main` で同じ操作を実行すると配信チェックボックスが有効になる。

成功すると、PRコメントの表にExpo WebとHono APIのURL、Expo GoのQRと `exps://` URL、各行の状態、デプロイ日時（JST）、費用・利用枠が表示される。キューに入っている間にPRのSHAが変わった場合、古いイベントからの配信はスキップする。同じSHAのリビジョンとビルド済みイメージは再利用する。

Expo Goは `apps/mobile` と同じSDKのビルドを使う。iOS実機では対応版の配布方法に従い、手元に対応版がなければWebで確認する。Expo Goに含まれないネイティブ機能は互換Development Buildで確認する。[Expo GoのSDK互換性](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)

## URLとデータ

既存の `kcvlb4` プロジェクトの `asia-northeast1` に、配信対象PRのCloud Runサービス `nuri-preview-pr-<番号>` をOpenTofuで作る。プレビューのイメージは専用のArtifact Registry `nuri-preview`、stateは専用のGCSバケット `kcvlb4-nuri-preview-state` の `pr-<番号>/default.tfstate` に置く。アプリはサービスの `run.app` URLで開く。mainのDockerfileと起動スクリプトでPRの対象SHAをビルドする。候補リビジョンでHonoのDB接続、Webの直リンクとアセット、Expo GoのiOS／Android manifestを確認し、成功後にトラフィックを切り替える。

| パス                                                       | 処理                        |
| ---------------------------------------------------------- | --------------------------- |
| `/` と画面の直リンク                                       | Expo Web                    |
| `/api/**`                                                  | Hono API                    |
| `/` のExpo Go向けリクエスト、`.bundle`、ネイティブアセット | Expo CLIのMetro             |
| `/expo-go/qr.svg`                                          | 同じホストを指すExpo Go用QR |

Honoはコンテナ内の使い捨てPostgreSQLを使う。インスタンスが起動するたびにmigrationと見本データの投入を行う。Googleやメールの実認証は共有stagingの検証を使う。PRプレビューのURLは公開されるため、機密データを入れない。

## 利用枠とcleanup

PRプレビューのビルドはGitHub Actionsで行う。EAS Build・EAS Updateの利用枠は消費しない。1環境につきCloud Runサービスを1つ使い、インスタンス数は最小0、最大1に設定する。アクセス時にはコンテナ起動・MetroのCPUとメモリ、通信量、Artifact RegistryとGCSに費用が発生し得る。アクセスが途切れるとデータとMetroキャッシュは失われる。Registryは14日を超えるイメージを定期削除する。更新成功時はそのPRの旧イメージを削除する。古いリビジョンはトラフィックを受けず、PRを閉じたときにサービスと一緒に削除される。[Cloud Runの最小インスタンス](https://docs.cloud.google.com/run/docs/configuring/min-instances)

main宛てのPRをマージ・クローズすると、対象PRのstateで `tofu destroy` を実行し、専用サービスとURLを削除する。destroyが成功したあとにイメージとstateを回収する。スタックの途中で閉じたPRや中断したcleanupは日次処理で回収する。

**🧱 OpenTofu Apply** と **🧱 OpenTofu Destroy** は実行するたびに、そのプレビューのPRへ新規コメントで投稿する。結果と終了コードは常に表示する。「実行ログとリソース設定」を開くと、Cloud Runサービス名、操作、件数、Applyの設定差分、Destroy前にstateへ記録されていた設定を読める。コメントに載せる設定は、スケーリングやCPU、メモリなどの公開可能な項目に限る。詳しい診断は同じコメントのActionsリンクから確認できる。共有基盤の実行ログはActionsに残す。

Expo Free の月間枠は Android 15／iOS 15 ビルド、Workflows 60分、Update 1,000 MAU。PRごとの消費はいずれも0。別途、対応するネイティブビルドを新規作成する場合は、そのビルドの枠を使う。[Expo料金表](https://expo.dev/pricing)

費用列には東京の従量単価を表示する。Cloud Run、Artifact Registry、stateを置くCloud Storageは3つの入口で共有する。単価は共有無料枠の適用前で、外向き通信とCloud Storageの操作は別に計上する。Cloud Runの月間無料枠は180,000 vCPU秒、360,000 GiB秒、200万リクエスト。Artifact Registryは請求先アカウント全体で月0.5 GiBまで無料。プレビューのPostgreSQLはコンテナ内で動くため、PRごとのCloud SQL料金は発生しない。[Cloud Run料金表](https://cloud.google.com/run/pricing)・[Artifact Registry料金表](https://cloud.google.com/artifact-registry/pricing)・[Cloud Storage料金表](https://cloud.google.com/storage/pricing)

## 初期設定

1. Repository Variable `PREVIEW_GCP_PROJECT_ID` を `kcvlb4` に設定する。
2. `production` Environmentに初期設定用の `PREVIEW_INFRA_WIF_PROVIDER` と `PREVIEW_INFRA_SERVICE_ACCOUNT` を登録する。初期設定用のWIFを、このリポジトリのmain、`production` Environment、`.github/workflows/infra-preview.yml` に制限する。このアカウントに `gs://kcvlb4-tofu-state/nuri/preview` への書き込みと、プレビュー用のIAM、タグ、レジストリ、バケットの設定権限を付与する。mainのCI成功後、**Preview Infrastructure** の `plan` と `apply` をActionsで実行する。
3. OpenTofuの出力 `preview_wif_provider` を、GitHubの `preview` と `preview-create` の両Environmentに `PREVIEW_WIF_PROVIDER` として登録する。`PREVIEW_SERVICE_ACCOUNT` には、それぞれ `preview_service_account` と `preview_creator_service_account` を登録する。`preview_run_tag_key` と `preview_run_tag_value` はRepository Variable `PREVIEW_RUN_TAG_KEY` と `PREVIEW_RUN_TAG_VALUE` に登録する。
4. Repository Variable `PREVIEW_GCP_ENABLED=true` を設定し、テスト用PRを作成する。設定前から開いていたPRは手動で起動できる。Web、API、Expo Goと **🧱 OpenTofu Apply** を確認したらPRを閉じ、サービスとイメージの削除および **🧱 OpenTofu Destroy** のコメントを確認する。

作成ジョブは新規Cloud Runサービスを作ってプレビュー専用タグを付ける。配信・回収ジョブの更新・削除権限はそのタグ付きサービスに限られ、タグを付与する権限は持たない。コンテナが使う実行用サービスアカウントには、Cloud SQLやSecret Managerへの権限を付与しない。[Cloud Runのタグ](https://docs.cloud.google.com/run/docs/configuring/tags)

`PREVIEW_GCP_ENABLED` を無効にすると新規の公開と自動cleanupを停止する。利用終了時は有効な間にPRを閉じ、回収を確認する。
