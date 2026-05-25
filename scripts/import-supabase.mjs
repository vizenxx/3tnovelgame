import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { loadLocalSecrets } from './load-local-secrets.mjs';

loadLocalSecrets(process.cwd());
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const exportPath = process.env.FIRESTORE_EXPORT_PATH || process.argv[2];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

if (!exportPath || !supabaseUrl || (!supabaseKey && !dryRun)) {
  console.error('Missing FIRESTORE_EXPORT_PATH, SUPABASE_URL, or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const payload = JSON.parse(await fs.readFile(exportPath, 'utf8'));

function iso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return new Date().toISOString();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function int(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function storyRow(story) {
  return {
    id: story.id,
    title: story.title || '未命名作品',
    main_axis: story.main_axis || '',
    tags: arr(story.tags),
    cover_url: story.coverUrl || '',
    author_id: story.authorId || story.userId || '',
    author_name: story.authorName || '',
    visibility: story.visibility || 'private',
    popularity: int(story.popularity),
    like_count: int(story.likeCount),
    intervention_count: int(story.interventionCount ?? story.popularity),
    favorite_count: int(story.favoriteCount),
    report_count: int(story.reportCount),
    average_chapter_words: int(story.averageChapterWords),
    chapter_count: int(story.chapterCount || arr(story.chapters).length),
    card_excerpt: story.cardExcerpt || '',
    allow_adaptation: Boolean(story.allowAdaptation),
    ending_mode: story.endingMode || 'dual',
    ending_rates: story.endingRates || { left: story.left_mainline_default || 40, right: story.right_mainline_default || 40 },
    ending_names: story.endingNames || {},
    defaults: story.defaults || { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
    characters: arr(story.characters),
    version: int(story.version, 1),
    created_at: iso(story.createdAt),
    updated_at: iso(story.updatedAt),
  };
}

function sharedStoryRow(story) {
  return {
    id: story.id,
    title: story.title || '未命名记录',
    main_axis: story.main_axis || '',
    tags: arr(story.tags),
    characters: arr(story.characters),
    chapters: arr(story.chapters),
    author_id: story.authorId || '',
    author_name: story.authorName || '',
    original_author_id: story.originalAuthorId || null,
    original_author_name: story.originalAuthorName || '',
    intervener_id: story.intervenerId || null,
    intervener_name: story.intervenerName || '',
    cover_url: story.coverUrl || '',
    source_story_id: story.sourceStoryId || null,
    average_chapter_words: int(story.averageChapterWords),
    chapter_count: int(story.chapterCount || arr(story.chapters).length),
    card_excerpt: story.cardExcerpt || '',
    allow_adaptation: Boolean(story.allowAdaptation),
    visibility: story.visibility || 'public',
    created_at: iso(story.createdAt),
    updated_at: iso(story.updatedAt),
  };
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  if (dryRun) {
    console.log(`[dry-run] ${table}: ${rows.length}`);
    return;
  }
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('on_conflict', onConflict);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      throw new Error(`Supabase upsert failed for ${table}: ${response.status} ${await response.text()}`);
    }
  }
}

const stories = arr(payload.stories);
const storyRows = stories.map(storyRow).filter((story) => story.author_id);
const chapterRows = stories.flatMap((story) => arr(story.chapters).map((chapter) => ({
  story_id: story.id,
  chapter_num: int(chapter.chapter_num),
  title: chapter.title || '',
  summary: chapter.summary || '',
  present_characters: arr(chapter.present_characters),
  text: chapter.text || '',
}))).filter((chapter) => chapter.story_id && chapter.chapter_num);
const endingRows = stories.flatMap((story) => arr(story.endings).map((ending) => ({
  story_id: story.id,
  id: ending.id || 'default',
  chapter_num: int(ending.chapter_num, 7),
  title: ending.title || '',
  text: ending.text || '',
  key_nodes: arr(ending.keyNodes),
}))).filter((ending) => ending.story_id && ending.id);
const branchRows = stories.flatMap((story) => arr(story.branches).map((branch) => ({
  id: branch.id,
  story_id: story.id,
  side: branch.side === 'right' ? 'right' : 'left',
  tier: branch.tier || (branch.score >= 5 ? 'hidden' : branch.score >= 3 ? 'large' : branch.score >= 2 ? 'medium' : 'small'),
  name: branch.name || '',
  hint: branch.hint || '',
  description: branch.desc || branch.description || '',
  trigger: branch.trigger || {},
  trigger_groups: arr(branch.triggerGroups),
  common: Boolean(branch.common),
  inject: branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] },
  scene_text: branch.sceneText || '',
  created_at: iso(branch.createdAt),
  updated_at: iso(branch.updatedAt),
}))).filter((branch) => branch.id && branch.story_id);
const likeRows = stories.flatMap((story) => arr(story.likes).map((like) => ({
  story_id: story.id,
  user_id: like.userId || like.id,
  created_at: iso(like.createdAt),
}))).filter((like) => like.story_id && like.user_id);
const favoriteRows = stories.flatMap((story) => arr(story.favorites).map((favorite) => ({
  story_id: story.id,
  user_id: favorite.userId || favorite.id,
  created_at: iso(favorite.createdAt),
}))).filter((favorite) => favorite.story_id && favorite.user_id);
const sharedRows = arr(payload.sharedStories).map(sharedStoryRow).filter((story) => story.author_id);
const progressRows = arr(payload.users).flatMap((user) => arr(user.progress).map((progress) => ({
  user_id: user.id,
  story_id: progress.id || progress.storyId,
  payload: progress,
  updated_at: iso(progress.updatedAt),
}))).filter((progress) => progress.user_id && progress.story_id);
const usageRows = arr(payload.users).flatMap((user) => arr(user.coverGenerationUsage).map((usage) => ({
  user_id: user.id,
  date_key: usage.id || usage.date,
  count: int(usage.count),
  updated_at: iso(usage.updatedAt),
}))).filter((usage) => usage.user_id && usage.date_key);
const appSettingsRows = arr(payload.appSettings).map((setting) => ({
  id: setting.id,
  payload: setting,
  updated_by: setting.updatedBy || null,
  updated_at: iso(setting.updatedAt),
})).filter((setting) => setting.id);

console.log('Prepared import rows:', {
  stories: storyRows.length,
  chapters: chapterRows.length,
  endings: endingRows.length,
  branches: branchRows.length,
  likes: likeRows.length,
  favorites: favoriteRows.length,
  sharedStories: sharedRows.length,
  progress: progressRows.length,
  coverGenerationUsage: usageRows.length,
  appSettings: appSettingsRows.length,
});

await upsert('stories', storyRows, 'id');
await upsert('story_chapters', chapterRows, 'story_id,chapter_num');
await upsert('story_endings', endingRows, 'story_id,id');
await upsert('story_branches', branchRows, 'id');
await upsert('story_likes', likeRows, 'story_id,user_id');
await upsert('story_favorites', favoriteRows, 'story_id,user_id');
await upsert('shared_stories', sharedRows, 'id');
await upsert('user_progress', progressRows, 'user_id,story_id');
await upsert('cover_generation_usage', usageRows, 'user_id,date_key');
await upsert('app_settings', appSettingsRows, 'id');

console.log(dryRun ? 'Dry-run complete. No Supabase writes were made.' : 'Supabase import complete.');
