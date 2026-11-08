import { Slider } from '@expo/ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PostStep } from '@/components/post-draft';
import type { Hsl } from '@/lib/color';

import { NativeHost } from '@/components/native-host';
import { stepColor, usePostDraft } from '@/components/post-draft';
import { Text } from '@/components/ui/text';
import { hexToHsl, hslToHex } from '@/lib/color';

const sliders = [
  { key: 'h', label: '色合い', max: 360 },
  { key: 's', label: '鮮やかさ', max: 100 },
  { key: 'l', label: '明るさ', max: 100 },
] as const;

/**
 * ⑫-5 (#203): the step's color. A color read from the video is shown as a guess and an unknown one
 * asks to be picked. Tapping the swatch opens sliders for hue, saturation and lightness, so any color
 * can be picked; 決定 keeps it for the post, ⑦ and the area.
 */
export function ColorField({ step, position }: { step: PostStep; position: number }) {
  const { updateStep } = usePostDraft();
  const current = stepColor(step);
  const [editing, setEditing] = useState<Hsl | null>(null);
  const note = step.color
    ? step.color.picked
      ? '選んだ色で塗ります'
      : '動画から読み取った色です。実際の商品の色とは違うことがあります'
    : '動画から色を読み取れませんでした。丸を押して選んでください';
  const shown = editing ? hslToHex(editing) : current;
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
        色
      </Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="色を選ぶ"
          accessibilityHint="色合い、鮮やかさ、明るさを変えて色を選びます"
          disabled={editing !== null}
          onPress={() => {
            setEditing(hexToHsl(current));
          }}
          className="size-12 items-center justify-center rounded-full active:opacity-70"
        >
          <View
            className="size-10 rounded-full border border-ink-primary/20"
            style={{ backgroundColor: shown }}
          />
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          className="flex-1 font-maru text-meta text-ink-secondary"
        >
          {editing ? '色を動かして選び、決定を押してください' : note}
        </Text>
      </View>
      {editing ? (
        <View className="gap-2 rounded-card bg-bg-base px-3.5 py-3">
          {sliders.map((slider) => (
            <View key={slider.key} className="gap-1">
              <Text className="font-maru-bold text-meta text-ink-primary">{slider.label}</Text>
              <NativeHost matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
                <Slider
                  testID={slider.label}
                  value={editing[slider.key]}
                  min={0}
                  max={slider.max}
                  step={1}
                  onValueChange={(value) => {
                    setEditing({ ...editing, [slider.key]: Math.round(value) });
                  }}
                />
              </NativeHost>
            </View>
          ))}
          <View className="flex-row justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(null);
              }}
              className="min-h-12 justify-center rounded-full px-4 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-ink-secondary">キャンセル</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                updateStep(position, { color: { hex: hslToHex(editing), picked: true } });
                setEditing(null);
              }}
              className="min-h-12 justify-center rounded-full bg-accent-rose px-5 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-white">決定</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
