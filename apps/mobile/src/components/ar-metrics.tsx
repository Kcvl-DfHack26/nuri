import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { ArMetricsSummary, ArMetricsWindow, TimingSummary } from '@/lib/ar-metrics';

import { Text } from '@/components/ui/text';
import { takeArMetricsSummary } from '@/lib/ar-metrics';

/**
 * Builds for measuring the AR camera set EXPO_PUBLIC_AR_METRICS=1. It is inlined at bundle time,
 * so regular builds never show the numbers.
 */
export const arMetricsEnabled = process.env.EXPO_PUBLIC_AR_METRICS === '1';

const refreshIntervalMs = 1000;

function formatTiming(timing: TimingSummary | undefined) {
  if (!timing) {
    return '-';
  }
  return `平均${timing.averageMs.toFixed(0)}ms 最大${timing.maxMs.toFixed(0)}ms`;
}

/**
 * Shows the AR camera's rates and timings once a second and writes them to the device log, which
 * is read with `adb logcat -s ReactNativeJS`. Only the measurement build renders it.
 */
export function ArMetricsOverlay({ metrics }: { metrics: ArMetricsWindow }) {
  const [summary, setSummary] = useState<ArMetricsSummary>();

  useEffect(() => {
    const timer = setInterval(() => {
      const next = takeArMetricsSummary(metrics, performance.now());
      // oxlint-disable-next-line no-console -- The measurement build reports through the device log.
      console.log(`[ar-metrics] ${JSON.stringify(next)}`);
      setSummary(next);
    }, refreshIntervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [metrics]);

  if (!summary) {
    return null;
  }
  return (
    <View pointerEvents="none" className="absolute inset-x-2 bottom-1/3 rounded-lg bg-black/60 p-2">
      <Text className="font-maru text-micro text-white">
        {`推論 ${summary.resultsPerSecond.toFixed(1)}/秒  commit ${summary.rendersPerSecond.toFixed(1)}/秒`}
      </Text>
      <Text className="font-maru text-micro text-white">
        {`ネイティブ遅延 ${formatTiming(summary.nativeLatency)}`}
      </Text>
      <Text className="font-maru text-micro text-white">
        {`JS受信→commit ${formatTiming(summary.renderDelay)}`}
      </Text>
    </View>
  );
}
