# 独自UIとOS標準UI

設定フォーム、Picker、Switch、Slider、Menu、BottomSheetは共通 `@expo/ui` を優先する。Native Tabs・Stack・戻る操作はExpo Routerが担当する。独自の配色や見た目が必要な部分は、React Native ReusablesのローカルコンポーネントとUniwindで実装する。

主要SNS機能はXを参考にした独自UIを使う。タイムラインは左にアバター、右に名前・日時・本文・いいね／共有を配置する。本文・反応はReusables／Uniwind、プロフィールは独立したユーザーの概要とネイティブ編集ボタンを使う。投稿者のアイコンからユーザー→投稿一覧へ移動できる。投稿カードは外側の横余白12pt・カード間8pt・角丸16pt、内側は横と上12pt。40ptアバターと8ptの間隔で密度を保ち、いいね・共有は右寄せで4pt間隔にする。操作のタップ領域は48pt/dp以上にする。未実装の返信・リポスト・フォローを操作可能なボタンとして置かない。

Native Tabs・Stack・戻る操作・共有シートはOS標準。設定はネイティブのForm／Picker／Switchを使う。投稿シートは65%、プロフィール編集は40%の高さから開く。iOS 26の投稿導線は投稿タブを開いている間だけタブ直上のBottomAccessory、それ以前とAndroidはツールバー。画面背景はOSセマンティックカラー、独自コンテンツはneutralテーマ。アプリ独自のグリーンは使わない。

Googleは公式の多色ロゴ付き白ボタン、AppleはiOSの公式AppleAuthenticationButton（ライトで黒、ダークで白）を使う。AndroidのAppleボタンも公式生成画像。出典は `apps/mobile/assets/auth/README.md` にある。

## 構成

- Uniwind Free **1.13.2**、Tailwind CSS **4.3.4**。Expo SDK 58、React 19、React Native 0.88を維持する。NativeWind、追加Babel preset、Tailwind v3用configは使わない。
- `apps/mobile/metro.config.mjs` でExpoの標準Metro設定を `withUniwindConfig` で包む。`global.css` をRoot Layoutで読み、Tailwindの探索元はモバイルの `src` に限定する。
- `apps/mobile/src/components/ui` の `Text` と `Button` は、[React Native ReusablesのUniwind registry](https://github.com/founded-labs/react-native-reusables/tree/385834c2196f8a303cbc9057d1ac768f3bde0a3b/packages/registry/src/uniwind/components/ui)を基にしたソース。隣の `LICENSE` を維持する。
- 上流からの調整は、import先、React 19のref型・Context、未対応roleの型キャスト除去、ネイティブの最小48pt/dp・可変高・文字の折り返し。`style`、`className`、accessibility propsは通常どおり渡せる。
- `Button` は `variant`／`size`／`onPress`／`disabled`、`Text` は `variant`／`asChild` を提供する。ラベルにはローカルの `Text` を使うとButtonのvariantに追従する。アイコンのみの操作には明示的なaccessibilityLabelを付ける。
- Portal・アニメーション・アイコン用の追加依存は初期構成に含めない。現在のText／Buttonには不要で、独自のoverlayは実際に必要になったときだけ導入する。

## 文字とアイコンと日時

独自UIのサイズは `global.css` の `text-body`（17/24pt）、`text-caption`（13/18pt）、`text-title`（22/28pt）に集約する。名前はbodyのsemibold、本文・操作ラベルはbody、日時・反応数・補足はcaption。`lib/utils.ts` のtailwind-mergeにもこの3つを文字サイズとして登録し、文字色を上書きさせない。ネイティブのナビゲーション・FormはOSの文字スタイルを使う。Dynamic Typeは無効化しない。

操作アイコンは `theme/metrics.ts` の20pt。アバターは投稿40pt、ユーザー概要80pt。補助的なchevronとOSのタブアイコンは役割の違う標準サイズを保つ。Google／Appleの公式ロゴはブランド規約を優先する。

投稿日時は `lib/date.ts` で1分未満は「たった今」、1時間未満は分、24時間未満は時間、それ以前は月日、別年は年月日。読み上げは正確な年月日時刻を使う。一覧内で基準時刻を共有し、画面への復帰と手動更新で揃えて更新する。いいねした行だけ時刻表記が進まないようにする。行ごとの `toLocaleString` のオプション指定はしない。

## 外観と色

独自UIにはReusables標準のneutral配色を使う。`global.css` の `@variant light`／`@variant dark` にセマンティックカラーを定義し、`bg-background`、`text-foreground`、`bg-primary` などで参照する。独自UIの色を変える際の正本はこのCSSであり、JSへ同じカラー表を複製しない。

外観の正本は既存の `PreferencesProvider` に保存された `appearance`。設定を保存できたときに `Uniwind.setTheme('system' | 'light' | 'dark')` を適用する。UniwindがネイティブのAppearanceも更新するため、既存のNativeHost・Navigation・StatusBarと連動する。新しいテーマ保存先や独立した切替スイッチは作らない。

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
      <Text variant="h3">Custom controls</Text>
      <Button onPress={() => setEnabled((current) => !current)}>
        <Text>{enabled ? 'Turn off' : 'Turn on'}</Text>
      </Button>
      <NativeHost matchContents={{ vertical: true }}>
        <Switch label="Native control" value={enabled} onValueChange={setEnabled} />
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

`uniwind-types.d.ts` はUniwindが生成した宣言をそのまま追跡する。設定変更後に `bun run --cwd apps/mobile styles:generate` を実行する。CSS import用の公式 `expo/types` はtsconfigから明示的に読み込み、未追跡の `expo-env.d.ts` に依存しない。CIはUniwindの型を再生成して差分がないことを確認してから通常チェックを実行するので、型検査のためにMetroを起動する必要はない。

```bash
bun run check
bun run doctor
bun run export:mobile
```

いいねは行ごとの `useMutation` で対象投稿IDを楽観更新し、ホーム／プロフィールのTanStack Queryキャッシュに反映する。`onError` はその投稿だけ復元し、別投稿の並行操作を巻き戻さない。成功時の全件invalidateを行わず、未変更オブジェクトの参照を保ってmemo化したPostRowの再描画を省く。FlatListの `refreshing` を立てない。pull-to-refresh専用状態を持ち、背景の再取得で画面が下へずれないことをRNTLと実画面で確認する。

JestはButtonの操作・disabled、Textのアクセシビリティ、外観設定の保存・復元・失敗後の再試行を検証する。MetroによるclassName変換とネイティブ描画はJestだけでは検証できないため、iOS／AndroidのExpo Goでライト／ダーク、system追従、大きな文字、標準UIとの併用を確認する。bundle成功を端末確認の代わりにはしない。

## 参照

- [Uniwindの導入](https://docs.uniwind.dev/quickstart)
- [UniwindのテーマとAppearance連動](https://docs.uniwind.dev/theming/basics)
- [Uniwindの型生成](https://docs.uniwind.dev/api/generate-artifacts)
- [Expo UI SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/ui/)

- [MobbinのXタイムライン参照](https://mobbin.com/screens/ef7b7aa6-f2ae-4957-a3e2-6271022bad6c)
- [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
- [Google Sign-In branding](https://developers.google.com/identity/branding-guidelines)
