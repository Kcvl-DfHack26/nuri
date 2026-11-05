# 検証

## 自動検査

```sh
bun run check
bun run db:migrate
bun run test:integration
bun run doctor
bun run export:mobile
```

integration testは専用の一意なメールアドレスを使い、終了時にそのユーザーだけを削除する。開発/CI用DBに対して実行する。

```sh
tofu fmt -check -recursive infra
tofu -chdir=infra init -backend=false -lockfile=readonly
tofu -chdir=infra validate
tofu -chdir=infra/bootstrap init -backend=false -lockfile=readonly
tofu -chdir=infra/bootstrap validate
tflint --init
tflint --chdir=infra --config="$PWD/.tflint.hcl"
tflint --chdir=infra/bootstrap --config="$PWD/.tflint.hcl"
```

## iOS / Android 共通の実機チェック

1. Todayからmorningを開く。詳細、戻る操作、タブの状態を確認する。
2. お気に入り登録・解除。LibraryのSavedで反映されることを確認する。
3. 検索、該当なし、検索の消去による復帰を確認する。
4. 完了を押し、シートをボタン/スワイプ/Android Backで閉じる。Todayの進捗が増え、同日の重複記録が起こらないことを確認する。
5. 外観をSystem/Light/Darkに切り替える。目標を変えてTodayの分母が変わること、触覚設定が操作に反映されることを確認する。
6. アプリを終了して再起動し、端末内設定とお気に入りが保持されることを確認する。
7. 文字サイズを大きくし、小さい端末でも画面をスクロールして全操作に届くことを確認する。
8. API設定時はAccountで登録・ログイン・ログアウトする。キーボードで操作が隠れないこと、通信切断でも入力が失われず再試行できることを確認する。
9. API未設定時はオフライン案内、API停止時は接続エラーと再試行を確認する。

## Maestro

`apps/mobile/.maestro/showcase.yaml` が主要な詳細・保存・完了フローを検証する。開発サーバーを必要としないpreview/simulatorビルドで実行する。

```sh
maestro test apps/mobile/.maestro/showcase.yaml
```

クラウド実行例は `docs/examples/native-e2e.yml`。2026-11-05の実アカウントでの検証では、EASのMaestroジョブに有料プランが必要だったため、未使用のサンプルとして置いている。契約後に `apps/mobile/.eas/workflows/native-e2e.yml` へコピーし、`eas workflow:validate`を通してから実行する。iOS E2Eのために各開発者のMacを必須にしない。

JestはExpo UIのネイティブ境界をmockするため、SwiftUI/Composeの実描画を保証しない。bundle生成、型検査、mock付きテストと、実機での確認は区別して記録する。
