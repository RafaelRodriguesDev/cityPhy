import { mkdirSync, writeFileSync } from 'node:fs';
import { addSample, tokensIn, WINDOW_MS, type PlanKind } from '../metrics/consumption/calibration.ts';
import { calibrationPath, claudeCalls, readCalibration } from '../metrics/consumption/claudeConsumption.ts';

/**
 * Stores one reading of the Claude app ("session 63%, resets at 12:50") with the fresh tokens cityPhy saw in that
 * window up to now. `clear: "session" | "week"` drops the readings of that window.
 */
export async function saveCalibration(dataDir: string, input: { kind?: unknown; percent?: unknown; resetsAt?: unknown; clear?: unknown }): Promise<{ ok: true; tokens?: number } | { error: string }> {
  const cal = readCalibration(dataDir);
  const write = (samples: typeof cal.samples) => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(calibrationPath(dataDir), JSON.stringify({ claude: { samples } }, null, 2), 'utf8');
  };
  if (input.clear === 'session' || input.clear === 'week') {
    write(cal.samples.filter((s) => s.kind !== input.clear));
    return { ok: true };
  }
  const kind = input.kind === 'session' || input.kind === 'week' ? (input.kind as PlanKind) : null;
  const percent = Number(input.percent);
  const resetsAt = Date.parse(String(input.resetsAt));
  const now = Date.now();
  if (!kind) return { error: 'Escolha sessão ou semana.' };
  if (!(percent > 0 && percent <= 100)) return { error: 'O percentual vai de 1 a 100.' };
  if (!(resetsAt > now && resetsAt <= now + WINDOW_MS[kind])) {
    return { error: kind === 'session' ? 'A sessão redefine nas próximas 5 horas: confira o horário.' : 'A semana reinicia nos próximos 7 dias: confira o dia e a hora.' };
  }
  const { calls } = await claudeCalls();
  const tokens = tokensIn(calls, resetsAt - WINDOW_MS[kind], now + 1);
  if (!tokens) return { error: 'Não achei uso do Claude Code nessa janela: o percentual veio de outro lugar (claude.ai, outra máquina).' };
  const next = addSample(cal, { kind, percent, resetsAt: new Date(resetsAt).toISOString(), at: new Date(now).toISOString(), tokens });
  write(next.samples);
  return { ok: true, tokens };
}
