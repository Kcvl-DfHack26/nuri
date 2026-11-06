# 独自UIとOS標準UI

設定フォーム、Picker、Switch、Slider、Menu、BottomSheetは共通 `@expo/ui` を優先する。Native Tabs・Stack・戻る操作はExpo Routerが担当する。独自の配色や見た目が必要な部分は、React Native ReusablesのローカルコンポーネントとUniwindで実装する。

今回の導入は基盤のみ。既存Today／Library／Settingsの表示・操作と、OSセマンティックカラー・グリーンのアクセントを維持する。

## 構成

- Uniwind Free **1.13.2**、Tailwind CSS **4.3.4**。Expo SDK 58、React 19、React Native 0.88を維持する。NativeWind、追加Babel preset、Tailwind v3用configは使わない。
- `apps/mobile/metro.config.mjs` でExpoの標準Metro設定を `withUniwindConfig` で包む。`global.css` をRoot Layoutで読み、Tailwindの探索元はモバイルの `src` に限定する。
- `apps/mobile/src/components/ui` の `Text` と `Button` は、[React Native ReusablesのUniwind registry](https://github.com/founded-labs/react-native-reusables/tree/385834c2196f8a303cbc9057d1ac768f3bde0a3b/packages/registry/src/uniwind/components/ui)を基にしたソース。隣の `LICENSE` を維持する。
- 上流からの調整は、import先、React 19のref型・Context、未対応roleの型キャスト除去、ネイティブの最小48pt/dp・可変高・文字の折り返し。`style`、`className`、accessibility propsは通常どおり渡せる。
- `Button` は `variant`／`size`／`onPress`／`disabled`、`Text` は `variant`／`asChild` を提供する。ラベルにはローカルの `Text` を使うとButtonのvariantに追従する。アイコンのみの操作には明示的なaccessibilityLabelを付ける。
- Portal・アニメーション・アイコン用の追加依存は初期構成に含めない。現在のText／Buttonには不要で、独自のoverlayは実際に必要になったときだけ導入する。

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
      <NativeHost matchContents>
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

JestはButtonの操作・disabled、Textのアクセシビリティ、外観設定の保存・復元・失敗後の再試行を検証する。MetroによるclassName変換とネイティブ描画はJestだけでは検証できないため、iOS／AndroidのExpo Goでライト／ダーク、system追従、大きな文字、標準UIとの併用を確認する。bundle成功を端末確認の代わりにはしない。

## 参照

- [Uniwindの導入](https://docs.uniwind.dev/quickstart)
- [UniwindのテーマとAppearance連動](https://docs.uniwind.dev/theming/basics)
- [Uniwindの型生成](https://docs.uniwind.dev/api/generate-artifacts)
- [Expo UI SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/ui/)
