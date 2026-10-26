import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { readProjectExtras } from '../readers/projectExtras.ts';
import { readProjects } from '../readers/projects.ts';
import { readTowers } from '../readers/towers.ts';
import { readExampleUsage, readUsage } from '../readers/usage.ts';

function sendJson(res: ServerResponse, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/**
 * Serves the local data (dev server, 127.0.0.1 only): /api/towers, /api/projects and /api/usage.
 * `config` is null for the fictional example, which ships its usage as a file.
 */
export function dataPlugin(dataDir: string, config: CityphyConfig | null): Plugin {
  return {
    name: 'cityphy-data',
    configureServer(server) {
      server.middlewares.use('/api/towers', (_req, res) => sendJson(res, readTowers(dataDir)));
      server.middlewares.use('/api/projects', (_req, res) =>
        sendJson(res, readProjects(dataDir).map((p) => ({ ...p, cityphy: readProjectExtras(dataDir, p.name) }))),
      );
      server.middlewares.use('/api/usage', (_req, res) => {
        if (!config) return sendJson(res, readExampleUsage(dataDir));
        readUsage(config.projects, config.models ?? {})
          .then((u) => sendJson(res, u))
          .catch(() => sendJson(res, { multipliers: {}, agents: {} }));
      });
    },
  };
}
