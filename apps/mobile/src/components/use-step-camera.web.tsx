import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

export function useStepCamera() {
  const request = useRef(0);
  const active = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'error'>('idle');

  const stop = useCallback(() => {
    request.current += 1;
    active.current?.getTracks().forEach((track) => {
      track.stop();
    });
    active.current = null;
    setStream(null);
    setStatus('idle');
  }, []);
  useFocusEffect(useCallback(() => stop, [stop]));

  const start = async () => {
    const id = ++request.current;
    setStatus('requesting');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      // A permission prompt can finish after the user has left the screen.
      if (id !== request.current) {
        next.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }
      active.current = next;
      setStream(next);
      setStatus('idle');
    } catch {
      if (id === request.current) {
        setStatus('error');
      }
    }
  };

  const attachVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video) {
        video.srcObject = stream;
      }
    },
    [stream],
  );

  const label = stream
    ? '見本に戻る'
    : status === 'requesting'
      ? '許可を待っています'
      : 'カメラを使う';
  return {
    preview: stream ? (
      <video
        ref={attachVideo}
        autoPlay
        muted
        playsInline
        aria-label="カメラ映像"
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
      />
    ) : undefined,
    control: (
      <View className="items-start gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={status === 'requesting'}
          className="min-h-12 justify-center rounded-full border border-white bg-white/90 px-4"
          onPress={() => {
            if (stream) {
              stop();
              return;
            }
            void start();
          }}
        >
          <Text className="font-maru-bold text-meta text-ink-primary">
            {stream
              ? '見本に戻る'
              : status === 'requesting'
                ? '許可を待っています'
                : 'カメラを使う'}
          </Text>
        </Pressable>
        {stream || status === 'error' ? (
          <Text
            accessibilityLiveRegion="polite"
            className="rounded-lg bg-white/90 px-2 py-1 font-maru text-meta text-ink-primary"
          >
            {stream
              ? 'カメラ映像は端末内で表示します。ガイドは見本で確認できます。'
              : 'カメラを開けませんでした。ブラウザの許可を確認するか、見本で続けられます。'}
          </Text>
        ) : null}
      </View>
    ),
  };
}
