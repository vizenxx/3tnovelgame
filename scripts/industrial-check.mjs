import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const runGit = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
let tracked = new Set();
try {
  tracked = new Set(runGit(['ls-files']).split(/\r?\n/).filter(Boolean));
} catch (error) {
  console.warn(`Git file tracking check skipped: ${error instanceof Error ? error.message : String(error)}`);
}

const forbiddenTracked = [
  '.env',
  '.env.local',
  'firebase-service-account.json',
  'debug-e217f3.log',
  'local-dev.log',
  'vite-dev.log',
].filter((file) => tracked.has(file));

if (forbiddenTracked.length > 0) {
  console.error(`Tracked secret/scratch files detected: ${forbiddenTracked.join(', ')}`);
  process.exitCode = 1;
}

const rootLocalSecretFiles = [
  '.env',
  '.env.local',
  'firebase-service-account.json',
].filter((file) => existsSync(resolve(root, file)));

if (rootLocalSecretFiles.length > 0) {
  console.warn(`Local secret files exist in the project root: ${rootLocalSecretFiles.join(', ')}. Keep them untracked and prefer moving service-account JSON outside the repo folder.`);
}

const appPath = resolve(root, 'src/App.tsx');
if (existsSync(appPath)) {
  const kb = statSync(appPath).size / 1024;
  if (kb > 250) {
    console.warn(`App.tsx is ${kb.toFixed(1)}KB. Keep extracting feature modules before adding major UX logic.`);
  }
}

const requiredEnvExamples = [
  'VITE_STORY_BACKEND',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'FIREBASE_PROJECT_ID',
  'GEMINI_API_KEY',
];
const envExampleTracked = tracked.size === 0 || tracked.has('.env.example');
if (!envExampleTracked) {
  console.error('.env.example should be tracked as the safe environment contract.');
  process.exitCode = 1;
}

console.log(`Industrial guardrail check complete. Required production env keys: ${requiredEnvExamples.join(', ')}`);
