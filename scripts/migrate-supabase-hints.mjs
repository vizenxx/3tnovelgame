import fs from 'node:fs/promises';

async function loadEnv() {
  const env = {};
  try {
    const content = await fs.readFile('.env.local', 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.replace(/\r/g, '');
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (match) {
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[match[1]] = val;
      }
    }
  } catch (e) {
    console.warn('Failed to load .env.local:', e.message);
  }
  return env;
}

const writeMode = process.argv.includes('--write');

async function run() {
  const env = await loadEnv();
  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
    process.exit(1);
  }

  console.log(`Using Supabase Url: ${supabaseUrl}`);
  console.log(`Mode: ${writeMode ? 'WRITE (applying changes)' : 'DRY-RUN (read-only)'}`);

  // Fetch branches
  const url = `${supabaseUrl}/rest/v1/story_branches?select=id,story_id,name,hint,trigger,trigger_groups`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch branches:', response.status, await response.text());
    return;
  }

  const branches = await response.json();
  console.log(`Fetched ${branches.length} branches.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const b of branches) {
    const originalHint = String(b.hint || '').trim();
    if (!originalHint) {
      skippedCount++;
      continue;
    }

    // Determine target groups
    let groups = Array.isArray(b.trigger_groups) ? b.trigger_groups : [];
    if (groups.length === 0 && b.trigger && typeof b.trigger === 'object' && Object.keys(b.trigger).length > 0) {
      groups = [b.trigger];
    }

    if (groups.length === 0) {
      console.warn(`Branch ID: ${b.id} ("${b.name}") has hint but no trigger/trigger_groups. Skipping.`);
      skippedCount++;
      continue;
    }

    // Split the hint
    const parts = originalHint.split(/[；;]/).map(s => s.trim());

    // Update each group with the hint
    const updatedGroups = groups.map((group, idx) => {
      const conditionHint = parts[idx] !== undefined ? parts[idx] : '';
      return {
        ...group,
        hint: conditionHint,
      };
    });

    // Check if anything actually changed
    const originalStr = JSON.stringify(b.trigger_groups);
    const updatedStr = JSON.stringify(updatedGroups);

    if (originalStr === updatedStr) {
      skippedCount++;
      continue;
    }

    migratedCount++;
    console.log(`[Migrate] Branch ID: ${b.id} ("${b.name}")`);
    console.log(`  - Legacy Hint: "${originalHint}"`);
    console.log(`  - Split parts: ${JSON.stringify(parts)}`);
    console.log(`  - New Groups: ${JSON.stringify(updatedGroups)}`);

    if (writeMode) {
      const patchUrl = `${supabaseUrl}/rest/v1/story_branches?id=eq.${b.id}`;
      const patchResponse = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger_groups: updatedGroups }),
      });

      if (!patchResponse.ok) {
        console.error(`  x Failed to patch branch ${b.id}:`, patchResponse.status, await patchResponse.text());
        process.exit(1);
      } else {
        console.log(`  ✓ Patched successfully`);
      }
      
      // Delay slightly to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log(`\nMigration run completed.`);
  console.log(`Total processed: ${branches.length}`);
  console.log(`Total migrated/updated: ${migratedCount}`);
  console.log(`Total skipped (no hint / already matched): ${skippedCount}`);
  if (!writeMode && migratedCount > 0) {
    console.log(`\nRun with --write flag to apply changes to Supabase.`);
  }
}

run().catch(console.error);
