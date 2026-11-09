import {
  recordArRender,
  recordArResult,
  startArMetricsWindow,
  takeArMetricsSummary,
} from './ar-metrics';

test('summarizes rates and timings over the window', () => {
  const window = startArMetricsWindow(0);
  recordArResult(window, { latencyMs: 40, nowMs: 100 });
  recordArRender(window, 104);
  recordArResult(window, { latencyMs: 60, nowMs: 200 });
  recordArRender(window, 210);

  expect(takeArMetricsSummary(window, 500)).toEqual({
    resultsPerSecond: 4,
    rendersPerSecond: 4,
    nativeLatency: { averageMs: 50, maxMs: 60 },
    renderDelay: { averageMs: 7, maxMs: 10 },
  });
});

test('measures the delay from the result a render shows', () => {
  const window = startArMetricsWindow(0);
  recordArResult(window, { latencyMs: 30, nowMs: 100 });
  recordArResult(window, { latencyMs: 30, nowMs: 130 });
  recordArRender(window, 135);
  // A render without a new result, such as a layout change, is not counted.
  recordArRender(window, 300);

  const summary = takeArMetricsSummary(window, 1000);
  expect(summary.resultsPerSecond).toBe(2);
  expect(summary.rendersPerSecond).toBe(1);
  expect(summary.renderDelay).toEqual({ averageMs: 5, maxMs: 5 });
});

test('starts the next window and keeps a result not yet rendered', () => {
  const window = startArMetricsWindow(0);
  recordArResult(window, { latencyMs: 30, nowMs: 990 });
  takeArMetricsSummary(window, 1000);
  recordArRender(window, 1010);

  expect(takeArMetricsSummary(window, 2000)).toEqual({
    resultsPerSecond: 0,
    rendersPerSecond: 1,
    nativeLatency: undefined,
    renderDelay: { averageMs: 20, maxMs: 20 },
  });
});
