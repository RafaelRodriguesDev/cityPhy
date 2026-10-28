import { describe, expect, it } from 'vitest';
import { WINDOW_MS, addSample, calibratedWindows, limitOf, sessionWindow, tokensIn, weekWindow, type Calibration } from '../src/metrics/consumption/calibration.ts';

const H = 3_600_000;
const T0 = Date.parse('2026-10-28T08:00:00Z');
const calls = [
  { at: T0, fresh: 100_000 },
  { at: T0 + 1 * H, fresh: 200_000 },
  { at: T0 + 4 * H, fresh: 300_000 },
  // gap: next window starts here
  { at: T0 + 6 * H, fresh: 50_000 },
  { at: T0 + 7 * H, fresh: 150_000 },
];
const sample = (kind: 'session' | 'week', percent: number, tokens: number, resetsAt: string): Calibration['samples'][number] => ({ kind, percent, tokens, resetsAt, at: resetsAt });

describe('plan calibration', () => {
  it('chains 5-hour windows from the first call after the previous one ended', () => {
    expect(sessionWindow(calls, [], T0 + 2 * H)).toEqual({ start: T0, end: T0 + 5 * H });
    expect(sessionWindow(calls, [], T0 + 7.5 * H)).toEqual({ start: T0 + 6 * H, end: T0 + 11 * H });
    expect(sessionWindow(calls, [], T0 + 12 * H)).toBeNull();
  });

  it('pins the session window to a reset time the person typed', () => {
    const reset = T0 + 3 * H;
    expect(sessionWindow(calls, [reset], T0 + 2 * H)).toEqual({ start: reset - WINDOW_MS.session, end: reset });
  });

  it('repeats the weekly reset every 7 days', () => {
    const anchor = Date.parse('2026-10-24T19:00:00Z');
    expect(weekWindow([anchor], Date.parse('2026-10-28T12:00:00Z'))).toEqual({ start: anchor, end: anchor + WINDOW_MS.week });
    expect(weekWindow([anchor], anchor + WINDOW_MS.week + H)!.start).toBe(anchor + WINDOW_MS.week);
    expect(weekWindow([], T0)).toBeNull();
  });

  it('takes the median of typed percents and blocks at 100%', () => {
    const cal: Calibration = { samples: [sample('session', 50, 500_000, '2026-10-28T13:00:00Z'), sample('session', 25, 300_000, '2026-10-27T13:00:00Z')] };
    // samples: 1,000,000 and 1,200,000; block at T0+5h: 600,000 → median 1,000,000
    const lim = limitOf('session', cal, [{ kind: 'session', resetsAt: T0 + 5 * H }], calls)!;
    expect(lim).toEqual({ limit: 1_000_000, fromApp: 2, fromBlocks: 1 });
    expect(limitOf('week', cal, [], calls)).toBeNull();
  });

  it('turns the current window into a percent of the calibrated limit', () => {
    const cal: Calibration = { samples: [sample('session', 50, 300_000, new Date(T0 + 5 * H).toISOString())] };
    const [w] = calibratedWindows(calls, cal, [], T0 + 4.5 * H);
    expect(w).toMatchObject({ label: '5 horas', minutes: 300, resetsAt: new Date(T0 + 5 * H).toISOString() });
    expect(w.calibrated).toEqual({ limit: 600_000, used: 600_000, fromApp: 1, fromBlocks: 0 });
    expect(w.usedPercent).toBe(100);
    expect(tokensIn(calls, T0 + 6 * H, T0 + 8 * H)).toBe(200_000);
  });

  it('keeps only the newest samples of each kind', () => {
    let cal: Calibration = { samples: [] };
    for (let i = 0; i < 20; i++) cal = addSample(cal, sample('session', 10 + i, 1000, `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
    cal = addSample(cal, sample('week', 40, 5000, '2026-10-28T00:00:00Z'));
    expect(cal.samples.filter((s) => s.kind === 'session')).toHaveLength(12);
    expect(cal.samples.at(-1)!.kind).toBe('week');
  });
});
