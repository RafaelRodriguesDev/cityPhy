import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { loadConfig } from './src/config/loadConfig.ts';
import { dataPlugin } from './src/server/dataPlugin.ts';

export default defineConfig(({ mode }) => {
  // Data folder comes from cityphy.config.json; CITYPHY_DATA (env or .env.local) overrides it.
  // `npm run dev:example` (mode "example") shows the bundled fictional city instead.
  const env = loadEnv(mode, process.cwd(), '');
  process.env.CITYPHY_CONFIG ??= resolve(process.cwd(), 'cityphy.config.json');
  if (env.CITYPHY_DATA) process.env.CITYPHY_DATA = env.CITYPHY_DATA;
  const dataDir = mode === 'example' ? resolve(process.cwd(), 'examples', 'data') : loadConfig().dataDir;
  return {
    plugins: [dataPlugin(dataDir)],
    server: { host: '127.0.0.1', port: 5190, strictPort: true },
  };
});
