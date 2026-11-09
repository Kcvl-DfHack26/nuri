import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { Canvas, Circle, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PostStep } from '@/components/post-draft';
import type { Hsv } from '@/lib/color';

import { stepColor, usePostDraft } from '@/components/post-draft';
import { Text } from '@/components/ui/text';
import { hexToHsv, hsvToHex } from '@/lib/color';

// The square's height and the hue bar's, in dp. The bar's touch area is the 48 dp around it, and a
// margin keeps the markers inside the palette.
const squareHeight = 180;
const barHeight = 24;
const touchHeight = 48;
const margin = 16;
const corner = 12;
// One step of the screen reader's adjust actions.
const adjustStep = 5;
// What the square's screen reader actions change.
const actionChanges: Partial<Record<string, { s: number; v: number }>> = {
  increment: { s: 0, v: adjustStep },
  decrement: { s: 0, v: -adjustStep },
  vivid: { s: adjustStep, v: 0 },
  dull: { s: -adjustStep, v: 0 },
};
// The color circle across the hue bar.
const hues = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

const clamp = (value: number, max: number) => Math.round(Math.min(max, Math.max(0, value)));

/** Touch handlers that keep a drag from scrolling the screen and report the finger's place. */
function dragHandlers(onTouch: (x: number, y: number) => void) {
  const touch = (event: GestureResponderEvent) => {
    onTouch(event.nativeEvent.locationX, event.nativeEvent.locationY);
  };
  return {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: touch,
    onResponderMove: touch,
  };
}

/**
 * ⑫-5 (#203): a palette that shows the colors it offers. The square picks saturation across and
 * brightness down for the bar's hue, so dark and pale makeup colors can be touched directly. A margin
 * around both keeps their markers whole at the edges, where black and white are.
 */
function ColorPalette({ value, onChange }: { value: Hsv; onChange: (value: Hsv) => void }) {
  const [width, setWidth] = useState(0);
  const inner = Math.max(0, width - margin * 2);
  const pure = hsvToHex({ h: value.h, s: 100, v: 100 });
  const marker = {
    x: margin + (value.s / 100) * inner,
    y: margin + (1 - value.v / 100) * squareHeight,
  };
  const hueX = margin + (value.h / 360) * inner;
  const share = (at: number, size: number) => Math.min(1, Math.max(0, (at - margin) / size));
  return (
    <View className="gap-1">
      <View
        {...dragHandlers((x, y) => {
          if (inner > 0) {
            onChange({
              ...value,
              s: clamp(share(x, inner) * 100, 100),
              v: clamp((1 - share(y, squareHeight)) * 100, 100),
            });
          }
        })}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="鮮やかさと明るさ"
        onLayout={(event: LayoutChangeEvent) => {
          setWidth(event.nativeEvent.layout.width);
        }}
        accessibilityValue={{ text: `鮮やかさ${value.s}、明るさ${value.v}` }}
        accessibilityActions={[
          { name: 'increment', label: '明るくする' },
          { name: 'decrement', label: '暗くする' },
          { name: 'vivid', label: '鮮やかにする' },
          { name: 'dull', label: 'くすませる' },
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          const change = actionChanges[nativeEvent.actionName];
          if (change) {
            onChange({
              ...value,
              s: clamp(value.s + change.s, 100),
              v: clamp(value.v + change.v, 100),
            });
          }
        }}
        style={{ height: squareHeight + margin * 2 }}
      >
        {/* The canvases are mounted before their contents: on Android, a canvas whose first
            drawing comes with its mount stays blank until the drawing changes. */}
        <Canvas pointerEvents="none" style={{ height: squareHeight + margin * 2 }}>
          {inner > 0 ? (
            <>
              <RoundedRect x={margin} y={margin} width={inner} height={squareHeight} r={corner}>
                <LinearGradient
                  start={vec(margin, 0)}
                  end={vec(margin + inner, 0)}
                  colors={['#FFFFFF', pure]}
                />
              </RoundedRect>
              <RoundedRect x={margin} y={margin} width={inner} height={squareHeight} r={corner}>
                <LinearGradient
                  start={vec(0, margin)}
                  end={vec(0, margin + squareHeight)}
                  colors={['#00000000', '#000000']}
                />
              </RoundedRect>
              <Circle
                cx={marker.x}
                cy={marker.y}
                r={12}
                color="#000000"
                style="stroke"
                strokeWidth={2}
              />
              <Circle
                cx={marker.x}
                cy={marker.y}
                r={10}
                color="#FFFFFF"
                style="stroke"
                strokeWidth={3}
              />
            </>
          ) : null}
        </Canvas>
      </View>
      <View
        {...dragHandlers((x) => {
          if (inner > 0) {
            onChange({ ...value, h: clamp(share(x, inner) * 360, 360) });
          }
        })}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="色合い"
        accessibilityValue={{ min: 0, max: 360, now: value.h }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const sign = nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange({
            ...value,
            h: clamp(value.h + sign * adjustStep * 2, 360),
          });
        }}
        style={{ height: touchHeight }}
      >
        <Canvas pointerEvents="none" style={{ height: touchHeight }}>
          {inner > 0 ? (
            <>
              <RoundedRect
                x={margin}
                y={(touchHeight - barHeight) / 2}
                width={inner}
                height={barHeight}
                r={barHeight / 2}
              >
                <LinearGradient start={vec(margin, 0)} end={vec(margin + inner, 0)} colors={hues} />
              </RoundedRect>
              <Circle cx={hueX} cy={touchHeight / 2} r={13} color={pure} />
              <Circle
                cx={hueX}
                cy={touchHeight / 2}
                r={13}
                color="#FFFFFF"
                style="stroke"
                strokeWidth={3}
              />
              <Circle
                cx={hueX}
                cy={touchHeight / 2}
                r={15}
                color="#000000"
                style="stroke"
                strokeWidth={1.5}
              />
            </>
          ) : null}
        </Canvas>
      </View>
    </View>
  );
}

/**
 * ⑫-5 (#203): the step's color. A color read from the video is shown as a guess and an unknown one
 * asks to be picked. Tapping the swatch opens a palette, so any color can be picked while it is
 * seen; 決定 keeps it for the post, ⑦ and the area.
 */
export function ColorField({ step, position }: { step: PostStep; position: number }) {
  const { updateStep } = usePostDraft();
  const current = stepColor(step);
  const [editing, setEditing] = useState<Hsv | null>(null);
  const note = step.color
    ? step.color.picked
      ? '選んだ色で塗ります'
      : '動画から読み取った色です。実際の商品の色とは違うことがあります'
    : '動画から色を読み取れませんでした。丸を押して選んでください';
  const shown = editing ? hsvToHex(editing) : current;
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline gap-2">
        <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
          色
        </Text>
        <Text className="font-maru text-meta text-ink-secondary">（変更できます）</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="色を選ぶ"
          accessibilityHint="色の一覧から色を選びます"
          disabled={editing !== null}
          onPress={() => {
            setEditing(hexToHsv(current));
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
          {editing ? '四角と下の帯を指でなぞって選び、決定を押してください' : note}
        </Text>
      </View>
      {editing ? (
        <View className="gap-3 rounded-card bg-bg-base px-3.5 py-3">
          <ColorPalette value={editing} onChange={setEditing} />
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
                updateStep(position, {
                  color: { hex: hsvToHex(editing), picked: true },
                });
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
