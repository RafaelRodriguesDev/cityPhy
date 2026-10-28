import { describe, expect, it } from 'vitest';
import { STATION_WIDTH, stationX } from '../src/maquete/antennaStation.ts';
import { CONDO_WIDTH } from '../src/maquete/condo.ts';
import { maqueteLayout } from '../src/maquete/layout.ts';
import { CENTRAL_ROOF_MASTS, STATION_LIMIT, planStation, stationHeight, type StationMcp } from '../src/maquete/stationPlan.ts';

const mcp = (name: string, calls: number, configured = false): StationMcp => ({ name, calls, configured, transport: 'local' });

describe('antenna station behind a condominium', () => {
  it('has nothing when the project used no MCP server', () => {
    expect(planStation([mcp('binlog', 0, true)]).mode).toBe('none');
  });

  it('draws one mast per server used, busiest first and tallest', () => {
    const p = planStation([mcp('a', 3), mcp('b', 2000), mcp('c', 0)]);
    expect(p.mode).toBe('masts');
    expect(p.masts.map((m) => m.name)).toEqual(['b', 'a']);
    expect(p.masts[0].height).toBeGreaterThan(p.masts[1].height);
    expect(p.total).toBe(2);
    expect(p.calls).toBe(2003);
  });

  it(`turns into a radio central above ${STATION_LIMIT} servers, keeping the real total`, () => {
    const many = Array.from({ length: 14 }, (_, i) => mcp(`s${i}`, i + 1));
    const p = planStation(many);
    expect(p.mode).toBe('central');
    expect(p.total).toBe(14);
    expect(p.masts).toHaveLength(CENTRAL_ROOF_MASTS);
    expect(planStation(many.slice(0, STATION_LIMIT)).mode).toBe('masts');
  });

  it('keeps masts between 5 and 15 units', () => {
    expect(stationHeight(0)).toBe(5);
    expect(stationHeight(1e9)).toBe(15);
  });

  it('stands behind the condominium, apart from its wall', () => {
    for (const p of maqueteLayout(3, 4).projects) expect(stationX(p.x, CONDO_WIDTH) - STATION_WIDTH / 2).toBeGreaterThan(p.x + CONDO_WIDTH / 2);
  });
});
