// Claude Code does not write its plan percent to disk. The person types what the app shows (session and week) and
// cityPhy turns it into a limit in tokens: tokens it saw in that window ÷ percent. Every time the app blocked the
// person (a "rate_limit" rejection in the logs) the window was at 100%, which is one more sample. No DOM, no Three.js.
import type { PlanWindow } from './types.ts';

export type PlanKind = 'session' | 'week';
export const WINDOW_MS: Record<PlanKind, number> = { session: 5 * 3_600_000, week: 7 * 86_400_000 };
const LABEL: Record<PlanKind, string> = { session: '5 horas', week: 'semana' };
const MINUTES: Record<PlanKind, number> = { session: 300, week: 10080 };
/** Samples kept per window kind (newest win). */
export const MAX_SAMPLES = 12;

/** One call to the model: when and how many fresh tokens (input + cache writes + output). */
export interface TimedCall {
  at: number;
  fresh: number;
}

/** The app said the window was at 100%: a rejection in the logs, with the moment the window resets. */
export interface Block {
  kind: PlanKind;
  resetsAt: number;
}

/** What the person typed, and the tokens cityPhy saw in that window at that moment. */
export interface CalibrationSample {
  kind: PlanKind;
  percent: number;
  resetsAt: string;
  at: string;
  tokens: number;
}

export interface Calibration {
  samples: CalibrationSample[];
}

/** What a calibrated window looks like in the panel. */
export interface CalibratedInfo {
  /** Estimated 100% of the window, in fresh tokens. */
  limit: number;
  /** Fresh tokens in the current window. */
  used: number;
  fromApp: number;
  fromBlocks: number;
}

export const tokensIn = (calls: TimedCall[], from: number, to: number) => calls.reduce((s, c) => (c.at >= from && c.at < to ? s + c.fresh : s), 0);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Limit of a window kind: the median of every sample (typed percents and blocks at 100%). */
export function limitOf(kind: PlanKind, cal: Calibration, blocks: Block[], calls: TimedCall[]): { limit: number; fromApp: number; fromBlocks: number } | null {
  const app = cal.samples.filter((s) => s.kind === kind && s.percent > 0 && s.tokens > 0).map((s) => s.tokens / (s.percent / 100));
  const blocked = blocks
    .filter((b) => b.kind === kind)
    .map((b) => tokensIn(calls, b.resetsAt - WINDOW_MS[kind], b.resetsAt))
    .filter((t) => t > 0);
  const all = [...app, ...blocked];
  return all.length ? { limit: Math.round(median(all)), fromApp: app.length, fromBlocks: blocked.length } : null;
}

/**
 * The session window in effect now. A window lasts 5 hours from the first call after the previous one ended; a known
 * reset time (typed or from a block) pins one window, and the next ones are chained from the calls that follow it.
 * Null when nothing ran since the last window ended.
 */
export function sessionWindow(calls: TimedCall[], resets: number[], now: number): { start: number; end: number } | null {
  const w = WINDOW_MS.session;
  const anchor = Math.max(-Infinity, ...resets.filter((r) => r <= now + w));
  if (anchor > now) return { start: anchor - w, end: anchor };
  let end = Number.isFinite(anchor) ? anchor : -Infinity;
  let window: { start: number; end: number } | null = null;
  for (const c of [...calls].sort((a, b) => a.at - b.at)) {
    if (c.at < end || c.at > now) continue;
    window = { start: c.at, end: c.at + w };
    end = window.end;
  }
  return window && window.end > now ? window : null;
}

/** The weekly window: it resets at the same weekday and time every week, pinned by a known reset. */
export function weekWindow(resets: number[], now: number): { start: number; end: number } | null {
  if (!resets.length) return null;
  const w = WINDOW_MS.week;
  const anchor = Math.max(...resets);
  let end = anchor + Math.ceil((now - anchor) / w) * w;
  if (end <= now) end += w;
  return { start: end - w, end };
}

/** Plan windows for the consumption glasses, estimated from the calibration and the blocks. */
export function calibratedWindows(calls: TimedCall[], cal: Calibration, blocks: Block[], now: number): PlanWindow[] {
  const out: PlanWindow[] = [];
  for (const kind of ['session', 'week'] as PlanKind[]) {
    const lim = limitOf(kind, cal, blocks, calls);
    if (!lim) continue;
    const resets = [...cal.samples.filter((s) => s.kind === kind).map((s) => Date.parse(s.resetsAt)), ...blocks.filter((b) => b.kind === kind).map((b) => b.resetsAt)].filter(Number.isFinite);
    const win = kind === 'session' ? sessionWindow(calls, resets, now) : weekWindow(resets, now);
    const used = win ? tokensIn(calls, win.start, now + 1) : 0;
    out.push({
      label: LABEL[kind],
      minutes: MINUTES[kind],
      usedPercent: Math.min(100, (used / lim.limit) * 100),
      resetsAt: win ? new Date(win.end).toISOString() : null,
      seenAt: new Date(now).toISOString(),
      calibrated: { limit: lim.limit, used, fromApp: lim.fromApp, fromBlocks: lim.fromBlocks },
    });
  }
  return out;
}

/** Adds a typed sample, keeping the newest MAX_SAMPLES per kind. */
export function addSample(cal: Calibration, s: CalibrationSample): Calibration {
  const same = [...cal.samples.filter((x) => x.kind === s.kind), s].slice(-MAX_SAMPLES);
  return { samples: [...cal.samples.filter((x) => x.kind !== s.kind), ...same] };
}
