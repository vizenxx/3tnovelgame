import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  loadEnv(mode, '.', '');
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
  const appVersion = String(packageJson.version || '0.0.0');
  const gitCommit = (() => {
    try {
      return execSync('git rev-parse --short=7 HEAD', {cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    } catch {
      return '';
    }
  })();
  const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'emit-app-version',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'app-version.json',
            source: JSON.stringify(
              {
                version: appVersion,
                gitCommit,
                buildId,
                generatedAt: new Date().toISOString(),
              },
              null,
              2,
            ),
          });
        },
      },
    ],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_COMMIT__: JSON.stringify(gitCommit),
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('motion') || id.includes('framer-motion')) return 'motion';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
