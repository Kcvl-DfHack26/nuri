/** Count, total and maximum of timings in milliseconds. */
type Timings = { count: number; totalMs: number; maxMs: number };

/**
 * What the AR camera measured since the last summary. It is mutated as landmarks arrive, so
 * measuring never re-renders the camera.
 */
export type ArMetricsWindow = {
  startedAtMs: number;
  results: number;
  renders: number;
  nativeLatency: Timings;
  renderDelay: Timings;
  /** When the latest result reached JavaScript, until a render shows it. */
  pendingSinceMs: number | undefined;
};

export type TimingSummary = { averageMs: number; maxMs: number };

/** One window's rates and timings. Timings are undefined when nothing was measured. */
export type ArMetricsSummary = {
  resultsPerSecond: number;
  rendersPerSecond: number;
  nativeLatency: TimingSummary | undefined;
  renderDelay: TimingSummary | undefined;
};

const millisecondsPerSecond = 1000;

function emptyTimings(): Timings {
  return { count: 0, totalMs: 0, maxMs: 0 };
}

function addTiming(timings: Timings, ms: number) {
  timings.count += 1;
  timings.totalMs += ms;
  timings.maxMs = Math.max(timings.maxMs, ms);
}

function summarizeTimings(timings: Timings): TimingSummary | undefined {
  if (timings.count === 0) {
    return undefined;
  }
  return { averageMs: timings.totalMs / timings.count, maxMs: timings.maxMs };
}

export function startArMetricsWindow(nowMs: number): ArMetricsWindow {
  return {
    startedAtMs: nowMs,
    results: 0,
    renders: 0,
    nativeLatency: emptyTimings(),
    renderDelay: emptyTimings(),
    pendingSinceMs: undefined,
  };
}

/** A landmark result reached JavaScript; its native latency comes with the event. */
export function recordArResult(
  window: ArMetricsWindow,
  { latencyMs, nowMs }: { latencyMs: number; nowMs: number },
) {
  window.results += 1;
  addTiming(window.nativeLatency, latencyMs);
  window.pendingSinceMs = nowMs;
}

/**
 * A render with the latest landmarks was committed. Results replaced before a render are never
 * shown, so the delay is measured from the result the render shows.
 */
export function recordArRender(window: ArMetricsWindow, nowMs: number) {
  if (window.pendingSinceMs === undefined) {
    return;
  }
  window.renders += 1;
  addTiming(window.renderDelay, nowMs - window.pendingSinceMs);
  window.pendingSinceMs = undefined;
}

/** Summarizes the window and starts the next one in place, keeping a result not yet rendered. */
export function takeArMetricsSummary(window: ArMetricsWindow, nowMs: number): ArMetricsSummary {
  const seconds = Math.max(nowMs - window.startedAtMs, 1) / millisecondsPerSecond;
  const summary = {
    resultsPerSecond: window.results / seconds,
    rendersPerSecond: window.renders / seconds,
    nativeLatency: summarizeTimings(window.nativeLatency),
    renderDelay: summarizeTimings(window.renderDelay),
  };
  window.startedAtMs = nowMs;
  window.results = 0;
  window.renders = 0;
  window.nativeLatency = emptyTimings();
  window.renderDelay = emptyTimings();
  return summary;
}
