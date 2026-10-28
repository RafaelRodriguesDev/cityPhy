import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { readProjectExtras } from '../readers/projectExtras.ts';
import { readProjects } from '../readers/projects.ts';
import { readTowers } from '../readers/towers.ts';
import { readExampleUsage, readUsage } from '../readers/usage.ts';
import { readConsumption, readExampleConsumption } from '../readers/consumption.ts';
import { readActivity, readExampleActivity } from '../readers/activity.ts';
import { readExampleLibrary, readLibrary } from '../readers/library.ts';
import { readControl, readExampleControl } from '../readers/control.ts';
import { readExampleWork, readWork } from '../readers/work.ts';

function sendJson(res: ServerResponse, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/**
 * Serves the local data (dev server, 127.0.0.1 only): towers, projects, usage, consumption, activity, library,
 * control (sessions cityPhy saw) and work (conversations with their skills and MCP calls).
 * `getConfig` reads cityphy.config.json on every request, so config edits show up without a restart;
 * it is null for the fictional example, which ships its usage as a file.
 */
export function dataPlugin(dataDir: string, getConfig: (() => CityphyConfig) | null): Plugin {
  return {
    name: 'cityphy-data',
    configureServer(server) {
      server.middlewares.use('/api/towers', (_req, res) => sendJson(res, readTowers(dataDir)));
      server.middlewares.use('/api/projects', (_req, res) => {
        const config = getConfig?.() ?? null;
        sendJson(
          res,
          readProjects(dataDir).map((p) => {
            // Members of a group carry the group (root path) and its memory, where the agents' sessions are recorded.
            const group = config?.projects.find((c) => c.name === p.name)?.group;
            return { ...p, cityphy: readProjectExtras(dataDir, p.name), ...(group ? { group, groupCityphy: readProjectExtras(dataDir, group.name) } : {}) };
          }),
        );
      });
      server.middlewares.use('/api/consumption', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleConsumption(dataDir));
        readConsumption(getConfig())
          .then((c) => sendJson(res, c))
          .catch(() => sendJson(res, []));
      });
      server.middlewares.use('/api/activity', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleActivity(dataDir));
        readActivity(getConfig())
          .then((a) => sendJson(res, a))
          .catch(() => sendJson(res, { windowMinutes: 15, generatedAt: new Date().toISOString(), agents: {} }));
      });
      server.middlewares.use('/api/library', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleLibrary(dataDir));
        try {
          sendJson(res, readLibrary(getConfig()));
        } catch {
          sendJson(res, { agents: [], skills: [], mcps: [] });
        }
      });
      server.middlewares.use('/api/control', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleControl(dataDir));
        const out: Record<string, ReturnType<typeof readControl>> = {};
        for (const p of readProjects(dataDir)) {
          try {
            out[p.name] = readControl(dataDir, p.name);
          } catch {
            out[p.name] = {};
          }
        }
        sendJson(res, out);
      });
      server.middlewares.use('/api/work', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleWork(dataDir));
        readWork(getConfig())
          .then((w) => sendJson(res, w))
          .catch(() => sendJson(res, {}));
      });
      server.middlewares.use('/api/usage', (_req, res) => {
        if (!getConfig) return sendJson(res, readExampleUsage(dataDir));
        const config = getConfig();
        readUsage(config.projects, config.models ?? {})
          .then((u) => sendJson(res, u))
          .catch(() => sendJson(res, { multipliers: {}, agents: {} }));
      });
    },
  };
}
