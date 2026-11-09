# 独自UIとOS標準UI

設定フォーム、Picker、Switch、Slider、Menu、BottomSheetは共通 `@expo/ui` を優先する。Native Tabs・Stack・戻る操作はExpo Routerが担当する。独自の配色や見た目が必要な部分は、React Native ReusablesのローカルコンポーネントとUniwindで実装する。

操作のタップ領域は48pt/dp以上にする。見出しは用途が伝わる日本語にし、句読点を付けない。有効な操作は表示どおりに動作させる。読み込み中・エラー・空の状態にもセーフエリアとキーボードの余白を保つ。iOS固有の実装はプラットフォーム別のファイルに置き、Androidで使うアイコンと操作を用意する。

Stack・戻る操作・共有シートはOS標準。下のタブはiOSがNative Tabs、Androidは実装planの `TabBar/Glass` を `expo-router/ui` で描く（[アーキテクチャ](architecture.md)）。設定はネイティブのForm／Picker／Switchを使う。商品詳細（⑥）は画面の50%の高さで固定し、文字を大きくしたときだけ最大90%まで高くする。見出しと購入ボタンを固定し、間の色・成分だけをスクロールする。iOSのreact-native-screensはシート内で見つけたScrollViewをシート全体の大きさに広げるため、ScrollViewは `collapsable={false}` のViewで包む。画面背景はOSセマンティックカラー、独自コンテンツはneutralテーマ。ただしメイクの流れ（①②③⑤⑥⑦⑩⑪）とマイページ（⑰⑰-2）はFigmaの実装planのFoundationsに従い、アプリ全体はライト配色と暗いステータスバーで表示する。アプリ独自のグリーンは使わない。

Googleは公式の多色ロゴ付き白ボタンを使う。ログイン（⑱）は実装planに合わせてライト配色で表示し、Googleとパスキーを提供し、メールは送信ドメインとログイン完了を確認してから再開する（#177）。出典は `apps/mobile/assets/auth/README.md` にある。

## 構成

- Uniwind Free **1.13.2**、Tailwind CSS **4.3.4**。Expo SDK 58、React 19、React Native 0.88を維持する。NativeWind、追加Babel preset、Tailwind v3用configは使わない。
- `apps/mobile/metro.config.cts` でExpoの標準Metro設定を `withUniwindConfig` で包む。`global.css` をRoot Layoutで読み、Tailwindの探索元はモバイルの `src` に限定する。
- `apps/mobile/src/components/ui` の `Text` と `Button` は、[React Native ReusablesのUniwind registry](https://github.com/founded-labs/react-native-reusables/tree/385834c2196f8a303cbc9057d1ac768f3bde0a3b/packages/registry/src/uniwind/components/ui)を基にしたソース。隣の `LICENSE` を維持する。
- 上流からの調整は、import先、React 19のref型・Context、未対応roleの型キャスト除去、ネイティブの最小48pt/dp・可変高・文字の折り返し。`style`、`className`、accessibility propsは通常どおり渡せる。
- `Button` は `variant`／`size`／`onPress`／`disabled`、`Text` は `variant`／`asChild` を提供する。ラベルにはローカルの `Text` を使うとButtonのvariantに追従する。アイコンのみの操作には明示的なaccessibilityLabelを付ける。
- Portal・アニメーション・アイコン用の追加依存は初期構成に含めない。現在のText／Buttonには不要で、独自のoverlayは実際に必要になったときだけ導入する。

## 文字とアイコンと日時

独自UIのサイズは `global.css` の `text-body`（17/24pt）、`text-caption`（13/18pt）、`text-title`（22/28pt）に集約する。名前はbodyのsemibold、本文・操作ラベルはbody、日時・反応数・補足はcaption。`lib/utils.ts` のtailwind-mergeにもこの3つを文字サイズとして登録し、文字色を上書きさせない。ネイティブのナビゲーション・FormはOSの文字スタイルを使う。Dynamic Typeは無効化しない。

操作アイコンは `theme/metrics.ts` の20pt。アバターは投稿40pt、ユーザー概要80pt。補助的なchevronとiOSのタブアイコンは役割の違う標準サイズを保つ。Googleの公式ロゴはブランド規約を優先する。

投稿日時は `lib/date.ts` で1分未満は「たった今」、1時間未満は分、24時間未満は時間、それ以前は月日、別年は年月日。読み上げは正確な年月日時刻を使う。一覧内で基準時刻を共有し、画面への復帰と手動更新で揃えて更新する。いいねした行だけ時刻表記が進まないようにする。行ごとの `toLocaleString` のオプション指定はしない。

## 外観と色

独自UIにはReusables標準のneutral配色を使う。`global.css` にライトのセマンティックカラーを定義し、`bg-background`、`text-foreground`、`bg-primary` などで参照する。独自UIの色を変える際の正本はこのCSSであり、JSへ同じカラー表を複製しない。

実装planに合わせ、Expoの `userInterfaceStyle` とRoot LayoutのUniwindをライトに固定する。

`@expo/ui` のSwiftUI／Compose要素に `className` を直接渡さない。Expo UIは公式のprops・style・modifiersで設定し、周囲のReact Native `View`／`Text`と独自UIをUniwindでスタイリングする。独自UIはHostの外側へ配置する。ネイティブツリー内部へReact Nativeを入れる必要がある場合は、共通 `@expo/ui` の `RNHostView` にReact Nativeのルート要素を渡す。

```tsx
import { Switch } from '@expo/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function CustomSection() {
  const [enabled, setEnabled] = useState(false);
  return (
    <View className="gap-4 rounded-lg bg-background p-4">
      <Text variant="h3">表示の設定</Text>
      <Button onPress={() => setEnabled((current) => !current)}>
        <Text>{enabled ? 'オフにする' : 'オンにする'}</Text>
      </Button>
      <NativeHost matchContents={{ vertical: true }}>
        <Switch label="表示を有効にする" value={enabled} onValueChange={setEnabled} />
      </NativeHost>
    </View>
  );
}
```

これは組み合わせ例で、製品ルートには追加していない。画面側でも固定高や `allowFontScaling={false}` で文字を切らない。色クラスはCSSで探索できる完全な文字列にし、`bg-${color}` のような動的組み立てを避ける。

## コンポーネントの追加

作業はIssueから始め、同じIssueのブランチ・PRで依存と検証結果まで管理する。追加前にExpo UIの標準コンポーネントで要件を満たせるか確認する。

```bash
cd apps/mobile
# components.jsonの@rnrはUniwind専用registryを指す
bunx shadcn@latest add @rnr/card
bun run styles:generate
```

Reusablesはnpmから丸ごと読み込むUIライブラリではなく、ソースをプロジェクトへ取り込む仕組み。既存ファイルを自動上書きせず、取得したコード・依存・変更差分を確認する。ネイティブ依存が必要になった場合は、このworkspaceから `bunx expo install <package>` でSDK互換版を選ぶ。

公式Reusables CLIの一括初期化・doctorによる自動修復は使わない。今回の小さな構成には不要なPortal・Reanimated等の導入や、既存テーマの置換を避けるため、Uniwind registryを明示して必要なコンポーネントだけを追加する。

Fallowはスターターが提供するText／Buttonだけを明示的な公開入口として扱う。新しいコンポーネントは利用する画面と一緒に追加する。ディレクトリ全体の除外や、検査を通す目的のダミーimportは追加しない。

## 検証

`bun run lint` はモバイルの `className`、`contentContainerClassName` などの Uniwind 用 props、`cn`・`cva` のクラス文字列を検査する。Tailwind v4 の設定は `apps/mobile/global.css` を参照する。lint の先頭で Uniwind の生成処理を実行し、プラットフォームのバリアントと色名を ESLint でも解決できるようにする。

任意値は同じ値を表せる Tailwind のクラス（`min-h-13`、`gap-0.75`、`aspect-175/118` など）を優先する。画面間で共有する色・角丸・文字サイズは `global.css` のトークンを使う。写真やグラデーションの配置など、固有の値が必要な場合はその行だけ lint の例外とし、理由を書く。クラスを変数から組み立てず、条件ごとに完全なクラス文字列を選ぶ。

`uniwind-types.d.ts` はUniwindが生成した宣言をそのまま追跡する。設定変更後に `bun run --cwd apps/mobile styles:generate` を実行する。CSS import用の公式 `expo/types` はtsconfigから明示的に読み込み、未追跡の `expo-env.d.ts` に依存しない。CIはUniwindの型を再生成して差分がないことを確認してから通常チェックを実行するので、型検査のためにMetroを起動する必要はない。

```bash
bun run check
bun run doctor
bun run export:mobile
```

お気に入りは `useFavorite` で対象レシピを楽観更新し、一覧・詳細・お気に入り一覧のTanStack Queryキャッシュに反映する。失敗時は変更したキャッシュだけを復元し、別レシピの並行操作を巻き戻さない。処理後は対象の詳細を、最後の操作が終わった時点でお気に入り一覧とユーザー情報を再取得する。プロフィール保存後は `recipeKeys.all` を無効化し、レシピの作者名も再取得する。FlatListの `refreshing` はpull-to-refresh専用状態とし、背景の再取得では立てない。

JestはButtonの操作・disabled、Textのアクセシビリティ、プロフィール設定内のパスキー操作を検証する。MetroによるclassName変換とネイティブ描画はJestだけでは検証できないため、iOS／Androidの[対象機能に合うクライアント](setup.md#simulatorとemulatorで開発する)でライト配色、大きな文字、標準UIとの併用を確認する。バンドルと端末操作の結果は[分けて記録する](testing.md#prに残す検証結果)。

## 参照

- [Uniwindの導入](https://docs.uniwind.dev/quickstart)
- [UniwindのテーマとAppearance連動](https://docs.uniwind.dev/theming/basics)
- [Uniwindの型生成](https://docs.uniwind.dev/api/generate-artifacts)
- [Expo UI SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/ui/)

- [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Google Sign-In branding](https://developers.google.com/identity/branding-guidelines)
