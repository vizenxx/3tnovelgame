import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const requiredHeaders = [
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'X-Frame-Options',
  'Cross-Origin-Opener-Policy',
  'Content-Security-Policy',
];

const rootHeaders = Object.fromEntries(
  (vercelConfig.headers || [])
    .find((entry) => entry.source === '/(.*)')
    ?.headers
    ?.map((header) => [header.key, header.value]) || []
);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const ensureDist = () => {
  assert(existsSync(resolve(distDir, 'index.html')), 'dist/index.html missing. Run npm run build first.');
  assert(existsSync(resolve(distDir, 'manifest.webmanifest')), 'dist/manifest.webmanifest missing.');
};

const serveFile = (requestPath) => {
  const cleanPath = decodeURIComponent(requestPath.split('?')[0] || '/');
  const relative = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  let target = resolve(distDir, relative);
  if (!target.startsWith(distDir) || !existsSync(target) || statSync(target).isDirectory()) {
    target = resolve(distDir, 'index.html');
  }
  return {
    body: readFileSync(target),
    type: contentTypes[extname(target)] || 'application/octet-stream',
    target,
  };
};

const startServer = () => new Promise((resolveServer) => {
  const server = createServer((req, res) => {
    const { body, type } = serveFile(req.url || '/');
    Object.entries(rootHeaders).forEach(([key, value]) => res.setHeader(key, value));
    res.setHeader('Content-Type', type);
    res.statusCode = 200;
    res.end(body);
  });
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolveServer({ server, baseUrl: `http://127.0.0.1:${address.port}` });
  });
});

const get = async (baseUrl, path) => {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { response, text };
};

const run = async () => {
  ensureDist();
  requiredHeaders.forEach((header) => {
    assert(rootHeaders[header], `vercel.json missing required security header: ${header}`);
  });

  const { server, baseUrl } = await startServer();
  try {
    const home = await get(baseUrl, '/');
    assert(home.response.status === 200, 'home did not return 200');
    assert(home.text.includes('<div id="root">'), 'home missing React root');
    assert(home.text.includes('manifest.webmanifest'), 'home missing manifest link');
    assert(home.text.includes('boot-splash'), 'home missing boot splash shell');
    requiredHeaders.forEach((header) => {
      assert(home.response.headers.get(header), `served home missing security header: ${header}`);
    });

    const assetPaths = [...home.text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
      .map((match) => match[1])
      .filter((asset) => asset.startsWith('/assets/'));
    assert(assetPaths.length >= 2, 'home did not reference expected JS/CSS assets');
    for (const asset of assetPaths) {
      const assetResponse = await fetch(`${baseUrl}${asset}`);
      assert(assetResponse.status === 200, `asset failed: ${asset}`);
      assert((assetResponse.headers.get('content-type') || '').length > 0, `asset missing content-type: ${asset}`);
    }

    const manifest = await get(baseUrl, '/manifest.webmanifest');
    assert(manifest.response.status === 200, 'manifest did not return 200');
    const manifestJson = JSON.parse(manifest.text);
    assert(manifestJson.name || manifestJson.short_name, 'manifest missing app name');
    assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length > 0, 'manifest missing icons');

    const sw = await get(baseUrl, '/sw.js');
    assert(sw.response.status === 200, 'service worker did not return 200');
    assert(sw.text.includes('install') && sw.text.includes('fetch'), 'service worker missing lifecycle handlers');

    const version = await get(baseUrl, '/app-version.json');
    assert(version.response.status === 200, 'app-version.json did not return 200');
    const versionJson = JSON.parse(version.text);
    assert(versionJson.version && versionJson.buildId, 'app-version missing version/buildId');

    const deepLink = await get(baseUrl, '/share/example-deep-link');
    assert(deepLink.response.status === 200, 'SPA fallback did not return 200');
    assert(deepLink.text.includes('<div id="root">'), 'SPA fallback did not serve app shell');
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  console.log('E2E smoke test passed.');
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
