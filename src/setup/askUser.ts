import { createInterface } from 'node:readline/promises';

export interface Asker {
  yesNo(question: string, byDefault: boolean, key?: string): Promise<boolean>;
  number(question: string, byDefault: number, key?: string): Promise<number>;
  close(): void;
}

const YES = /^(s|sim|y|yes|true|1)$/i;

/**
 * Questions for the person. An agent that already asked in chat passes the answers with
 * `--answers graph=sim,memory=nao,...` (or `--yes` for the defaults); otherwise we ask on the terminal.
 */
export function createAsker(answers: Record<string, string>, acceptDefaults: boolean): Asker {
  const rl = !acceptDefaults && process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ask = async (q: string, def: string, key?: string): Promise<string> => {
    if (key && key in answers) return answers[key];
    if (!rl) return def;
    const a = (await rl.question(`${q} `)).trim();
    return a || def;
  };
  return {
    async yesNo(q, def, key) {
      return YES.test(await ask(`${q} [${def ? 'S/n' : 's/N'}]`, def ? 's' : 'n', key));
    },
    async number(q, def, key) {
      const n = Number(await ask(`${q} [${def}]`, String(def), key));
      return Number.isFinite(n) && n > 0 ? n : def;
    },
    close() {
      rl?.close();
    },
  };
}

/** "graph=sim,memory=nao" -> { graph: 'sim', memory: 'nao' } */
export function parseAnswers(text: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (text ?? '').split(',')) {
    const [k, v] = pair.split('=').map((s) => s?.trim());
    if (k && v) out[k] = v;
  }
  return out;
}
