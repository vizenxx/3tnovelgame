import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const assetsDir = resolve(root, 'dist/assets');

const forbiddenNeedles = [
  'GEMINI_API_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_PRIVATE_KEY',
  'service_role',
  'private_key',
  'buildInterventionRewritePrompt',
  'buildQuickStoryBlueprintPrompt',
  'buildChapterContinuationPrompt',
  'buildFinalSummaryPrompt',
  'buildDigestChapterPrompt',
  'buildInheritedOpeningPrompt',
  'storyRunEngine',
  'evaluateStoryRunAfterIntervention',
  'branchEffectiveWeight',
  'directEV',
  'hiddenBonus',
  'endingMechanics',
  'rewriteRange',
  'leftPool',
  'rightPool',
  'canonicalWorldState',
  'selectedEndingProto',
  'sourceMappingURL',
];

if (!existsSync(assetsDir)) {
  console.warn('Frontend safety scan skipped: dist/assets does not exist. Run npm run build first.');
  process.exit(0);
}

const files = readdirSync(assetsDir)
  .filter((file) => /\.(?:js|css|map)$/i.test(file))
  .map((file) => join(assetsDir, file));

const hits = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const needle of forbiddenNeedles) {
    if (content.includes(needle)) {
      hits.push({ file, needle });
    }
  }
}

if (hits.length > 0) {
  console.error('Frontend bundle safety scan failed. Internal/server-only strings found in dist/assets:');
  hits.forEach((hit) => console.error(`- ${hit.needle} in ${hit.file}`));
  process.exit(1);
}

console.log(`Frontend bundle safety scan passed (${files.length} asset files checked).`);
