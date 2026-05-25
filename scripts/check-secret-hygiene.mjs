import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = process.cwd();
let failed = false;

const fail = (message) => {
  console.error(`Secret hygiene check failed: ${message}`);
  failed = true;
};

const warn = (message) => {
  console.warn(`Secret hygiene warning: ${message}`);
};

const getTrackedFiles = () => {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    const roots = ['api', 'src', 'scripts', 'server', 'supabase', 'Prompt', 'public'];
    const files = ['package.json', 'vercel.json', 'vite.config.ts', 'index.html', '.env.example'];
    const walk = (dir) => {
      const abs = resolve(root, dir);
      if (!existsSync(abs)) return;
      for (const entry of readdirSync(abs)) {
        const rel = join(dir, entry).replace(/\\/g, '/');
        const full = resolve(root, rel);
        if (entry === 'node_modules' || entry === 'dist') continue;
        if (statSync(full).isDirectory()) walk(rel);
        else files.push(rel);
      }
    };
    roots.forEach(walk);
    return files;
  }
};

const trackedFiles = getTrackedFiles();
const trackedSet = new Set(trackedFiles);
const detectorFiles = new Set([
  'scripts/check-secret-hygiene.mjs',
  'scripts/check-frontend-safety.mjs',
]);

[
  '.env',
  '.env.local',
  'firebase-service-account.json',
  'local-dev.log',
  'local-dev.err.log',
  'vite-dev.log',
  'debug-e217f3.log',
].forEach((file) => {
  if (trackedSet.has(file)) fail(`${file} is tracked by git.`);
});

trackedFiles.forEach((file) => {
  if (/service-account.*\.json$/i.test(file) || /private.*key/i.test(file)) {
    fail(`${file} looks like a secret credential file and must not be tracked.`);
  }
});

const rootSecretFiles = ['.env', '.env.local', 'firebase-service-account.json']
  .filter((file) => existsSync(resolve(root, file)));
if (rootSecretFiles.length > 0) {
  warn(`${rootSecretFiles.join(', ')} exist in the repo folder. Keep them ignored; move service-account JSON outside the repo when possible.`);
}

const scanExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.toml', '.yml', '.yaml']);
const realSecretPatterns = [
  { name: 'Google/Firebase API key literal', regex: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: 'Supabase secret key literal', regex: /sb_secret_[0-9A-Za-z_-]{20,}/ },
  { name: 'PEM private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: 'Firebase private key JSON', regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ },
  { name: 'VAPID private key assignment', regex: /VAPID_PRIVATE_KEY\s*=\s*["'][A-Za-z0-9_-]{30,}["']/ },
];

const forbiddenClientEnv = [
  /VITE_[A-Z0-9_]*SECRET[A-Z0-9_]*/,
  /VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/,
  /VITE_[A-Z0-9_]*PRIVATE_KEY[A-Z0-9_]*/,
];

for (const file of trackedFiles) {
  const ext = extname(file);
  if (!scanExtensions.has(ext)) continue;
  if (detectorFiles.has(file)) continue;
  if (file === '.env.example') continue;
  const abs = resolve(root, file);
  if (!existsSync(abs)) continue;
  const content = readFileSync(abs, 'utf8');
  for (const pattern of realSecretPatterns) {
    if (pattern.regex.test(content)) fail(`${pattern.name} found in tracked file ${file}.`);
  }
  for (const regex of forbiddenClientEnv) {
    const match = content.match(regex);
    if (match) fail(`Browser-exposed secret-like env name ${match[0]} found in ${file}.`);
  }
}

const srcFiles = trackedFiles.filter((file) => file.startsWith('src/') && /\.(?:ts|tsx|js|jsx)$/.test(file));
for (const file of srcFiles) {
  const content = readFileSync(resolve(root, file), 'utf8');
  if (/(?:from|import)\s+['"].*Prompt\//.test(content) || /process\.env\.(?:GEMINI|SUPABASE_SECRET|FIREBASE_PRIVATE|VAPID_PRIVATE)/.test(content)) {
    fail(`Frontend source ${file} imports or references server-only prompt/secret material.`);
  }
}

if (failed) process.exit(1);
console.log(`Secret hygiene check passed (${trackedFiles.length} tracked/fallback files considered).`);
