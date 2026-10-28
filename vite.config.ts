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
  const example = mode === 'example';
  const config = example ? null : loadConfig();
  const dataDir = config ? config.dataDir : resolve(process.cwd(), 'examples', 'data');
  return {
    plugins: [dataPlugin(dataDir, example ? null : loadConfig)],
    server: { host: '127.0.0.1', port: 5190, strictPort: true },
    // The maquete is the main page; the first city stays at /classica.html.
    build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), classica: resolve(process.cwd(), 'classica.html') } } },
  };
});
