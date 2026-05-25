import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { loadLocalSecrets } from './load-local-secrets.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const staticOnly = args.has('--static');

loadLocalSecrets(root);
dotenv.config({ path: resolve(root, '.env.local'), quiet: true });
dotenv.config({ path: resolve(root, '.env'), quiet: true });

const migrationsDir = resolve(root, 'supabase/migrations');

const expectedTables = [
  'stories',
  'story_chapters',
  'story_endings',
  'story_branches',
  'shared_stories',
  'user_progress',
  'story_likes',
  'story_favorites',
  'story_reports',
  'app_settings',
  'cover_generation_usage',
  'author_follows',
  'user_notifications',
  'push_subscriptions',
  'series_worlds',
  'series_entries',
  'continuity_nodes',
];

const expectedIndexes = [
  'idx_stories_public_updated',
  'idx_stories_author_updated',
  'idx_shared_author_updated',
  'idx_shared_source',
  'idx_story_branches_story',
  'idx_shared_snapshot_dedupe',
  'idx_author_follows_author_created',
  'idx_user_notifications_user_created',
  'idx_push_subscriptions_user',
  'idx_series_worlds_author_updated',
  'idx_series_entries_series_order',
  'idx_series_entries_story',
  'idx_continuity_nodes_series_updated',
  'idx_continuity_nodes_source_story',
  'idx_stories_series',
];

const expectedRpc = [
  'get_story_cartridge',
  'increment_story_metric',
  'like_story_once',
  'unlike_story_once',
  'favorite_story_once',
  'unfavorite_story_once',
  'report_story_once',
  'reserve_cover_usage',
  'refund_cover_usage',
];

const expectedRlsTables = expectedTables.filter((table) => table !== 'series_entries');
const optionalRlsTables = ['series_entries'];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readMigrationSql() {
  if (!existsSync(migrationsDir)) {
    fail('Missing supabase/migrations directory.');
    return '';
  }
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
    .join('\n');
}

function checkStaticSchema(sql) {
  const normalized = sql.toLowerCase();
  for (const table of expectedTables) {
    if (!normalized.includes(`create table if not exists public.${table}`)) {
      fail(`Missing migration table definition: public.${table}`);
    }
  }
  for (const table of expectedRlsTables) {
    if (!normalized.includes(`alter table public.${table} enable row level security`)) {
      fail(`Missing RLS enable statement in migrations: public.${table}`);
    }
  }
  for (const table of optionalRlsTables) {
    if (!normalized.includes(`alter table public.${table} enable row level security`)) {
      console.warn(`Optional RLS statement not found in migrations: public.${table}`);
    }
  }
  for (const index of expectedIndexes) {
    if (!normalized.includes(`create index if not exists ${index}`) && !normalized.includes(`create unique index if not exists ${index}`)) {
      fail(`Missing expected migration index: ${index}`);
    }
  }
  for (const rpc of expectedRpc) {
    if (!normalized.includes(`function public.${rpc}`)) {
      fail(`Missing expected migration RPC/function: public.${rpc}`);
    }
  }
}

async function restProbe(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    console.warn('Live Supabase health skipped: SUPABASE_URL and SUPABASE_SECRET_KEY are not available.');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${supabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLiveRest() {
  for (const table of expectedTables) {
    const response = await restProbe(`/rest/v1/${table}?select=*&limit=0`);
    if (!response) return;
    if (!response.ok) {
      fail(`Live Supabase table probe failed: ${table} (${response.status}) ${await response.text()}`);
    }
  }

  const rpcResponse = await restProbe('/rest/v1/rpc/get_story_cartridge', {
    method: 'POST',
    body: JSON.stringify({ p_story_id: '__healthcheck_missing_story__' }),
  });
  if (!rpcResponse) return;
  if (rpcResponse.status === 404) {
    fail('Live Supabase RPC probe failed: get_story_cartridge is missing.');
  } else if (!rpcResponse.ok) {
    const text = await rpcResponse.text();
    if (/PGRST202|function .* not found|Could not find/i.test(text)) {
      fail(`Live Supabase RPC probe failed: get_story_cartridge not found (${rpcResponse.status}) ${text}`);
    }
  }
}

const sql = readMigrationSql();
checkStaticSchema(sql);

if (!staticOnly) {
  await checkLiveRest();
}

if (!process.exitCode) {
  console.log(`${staticOnly ? 'Static' : 'Static/live'} Supabase health check passed.`);
}
