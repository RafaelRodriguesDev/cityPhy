import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { readProjectExtras } from '../readers/projectExtras.ts';
import { readProjects } from '../readers/projects.ts';
import { readTowers } from '../readers/towers.ts';

function sendJson(res: ServerResponse, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/** Serves the local data (dev server, 127.0.0.1 only): GET /api/towers and GET /api/projects. */
export function dataPlugin(dataDir: string): Plugin {
  return {
    name: 'cityphy-data',
    configureServer(server) {
      server.middlewares.use('/api/towers', (_req, res) => sendJson(res, readTowers(dataDir)));
      server.middlewares.use('/api/projects', (_req, res) =>
        sendJson(res, readProjects(dataDir).map((p) => ({ ...p, cityphy: readProjectExtras(dataDir, p.name) }))),
      );
    },
  };
}
