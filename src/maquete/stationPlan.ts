// What stands behind a condominium: one antenna per MCP server the project used, or a radio central when there are many.
// No Three.js here so the rule can be tested.

/** Above this many servers a project gets one central building instead of a field of masts. */
export const STATION_LIMIT = 6;
/** Most antennas drawn on the central's roof (the sign carries the real total). */
export const CENTRAL_ROOF_MASTS = 9;

export interface StationMcp {
  name: string;
  calls: number;
  /** Configured in some agent (has an antenna in the civic radio park); false = brought by the agent app. */
  configured: boolean;
  transport: 'local' | 'remote';
}

export interface StationPlan {
  mode: 'none' | 'masts' | 'central';
  /** Busiest first; for 'central', only the ones drawn on the roof. */
  masts: Array<StationMcp & { height: number }>;
  total: number;
  calls: number;
}

/** Taller with more calls (log scale), from 5 to about 15 units. */
export const stationHeight = (calls: number) => Math.min(15, 5 + 2.6 * Math.log10(1 + calls));

export function planStation(mcps: StationMcp[]): StationPlan {
  const sorted = [...mcps].filter((m) => m.calls > 0).sort((a, b) => b.calls - a.calls);
  const calls = sorted.reduce((s, m) => s + m.calls, 0);
  if (!sorted.length) return { mode: 'none', masts: [], total: 0, calls: 0 };
  const central = sorted.length > STATION_LIMIT;
  const shown = central ? sorted.slice(0, CENTRAL_ROOF_MASTS) : sorted;
  return {
    mode: central ? 'central' : 'masts',
    masts: shown.map((m) => ({ ...m, height: central ? 2.5 + stationHeight(m.calls) * 0.35 : stationHeight(m.calls) })),
    total: sorted.length,
    calls,
  };
}
