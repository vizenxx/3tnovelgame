import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
let failed = false;

const assert = (condition, message) => {
  if (!condition) {
    console.error(`Core flow check failed: ${message}`);
    failed = true;
  }
};

const app = read('src/App.tsx');
const storyClient = read('src/storyApiClient.ts');
const vercel = read('vercel.json');
const pkg = JSON.parse(read('package.json'));

[
  'STORY_SELECT',
  'PLAYING',
  'ARCHIVE',
  'AUTHORING',
  'READONLY_STORY',
  'SERIES_WORLD',
].forEach((state) => {
  assert(app.includes(state), `App route/state missing: ${state}`);
});

assert(app.includes('DevMetricsPanel'), 'Dev metrics panel is not mounted in App.tsx.');
assert(app.includes('recordApiMetric'), 'AI/apiFetch metrics are not recorded in App.tsx.');
assert(storyClient.includes("fetch('/api/story-store'"), 'storyApiClient should keep the single aggregated story endpoint.');
assert(storyClient.includes('recordApiMetric'), 'storyApiClient metrics are not recorded.');
assert(vercel.includes('"destination": "/api/ai?action=intervene"'), 'Vercel AI rewrite for intervention is missing.');
assert(vercel.includes('"destination": "/api/ai?action=generate-blueprint"'), 'Vercel AI rewrite for blueprint is missing.');
assert(pkg.scripts?.['check:core-flows'] === 'node scripts/check-core-flows.mjs', 'package.json check:core-flows script missing.');

const apiDir = resolve(root, 'api');
if (existsSync(apiDir)) {
  const functionFiles = readdirSync(apiDir)
    .filter((file) => /\.(?:ts|js|mjs|cjs)$/.test(file))
    .filter((file) => !file.endsWith('.d.ts'));
  assert(functionFiles.length <= 12, `Vercel Hobby function count exceeds 12: ${functionFiles.length}.`);
}

if (failed) {
  process.exit(1);
}

console.log('Core flow contract check passed.');
