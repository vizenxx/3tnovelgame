import type { VercelRequest, VercelResponse } from '@vercel/node';
import webPush from 'web-push';
import { getBearerToken, sendInternalError, sendMethodNotAllowed, verifyFirebaseToken } from '../server/_auth.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../server/_log.js';
import { supabaseInsert, supabaseRequest, supabaseRpc, supabaseUpsert } from '../server/_supabase.js';
import { isStoryStoreAction } from '../server/storyStoreContract.js';
import { normalizeEndingBiasDisplay as normalizeEndingBias } from '../server/_endingMechanics.js';

const nowIso = () => new Date().toISOString();
const ADMIN_USER_IDS = new Set(['LWgIE31RtCTZBiMNF7S9viNE7Aw2']);
const STORY_CARD_SELECT = [
  'id',
  'title',
  'main_axis',
  'tags',
  'visibility',
  'author_id',
  'author_name',
  'cover_url',
  'popularity',
  'like_count',
  'intervention_count',
  'favorite_count',
  'share_count',
  'report_count',
  'average_chapter_words',
  'chapter_count',
  'card_excerpt',
  'allow_adaptation',
  'series_id',
  'series_role',
  'continuity_node_id',
  'series_constraints',
  'ending_mode',
  'ending_rates',
  'ending_names',
  'updated_at',
  'created_at',
  'version',
].join(',');
const LEGACY_STORY_CARD_SELECT = STORY_CARD_SELECT
  .split(',')
  .filter((field) => field !== 'share_count')
  .join(',');
const STORY_CARD_TIMEOUT_MS = Number(process.env.SUPABASE_STORY_CARD_TIMEOUT_MS || 16000);
const STORY_LIST_ENRICH_TIMEOUT_MS = Number(process.env.SUPABASE_STORY_LIST_ENRICH_TIMEOUT_MS || 3500);
const SHARED_CARD_SELECT = [
  'id',
  'snapshot_kind',
  'content_hash',
  'title',
  'main_axis',
  'tags',
  'characters',
  'author_id',
  'author_name',
  'original_author_id',
  'original_author_name',
  'intervener_id',
  'intervener_name',
  'cover_url',
  'source_story_id',
  'average_chapter_words',
  'chapter_count',
  'card_excerpt',
  'allow_adaptation',
  'fate_record',
  'visibility',
  'created_at',
  'updated_at',
].join(',');
const asArray = (value: any) => Array.isArray(value) ? value : [];
const asInt = (value: any, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const guestName = (uid: string) => `游客+${String(uid || '').slice(0, 6).toUpperCase()}`;

class StoryStoreHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StoryStoreHttpError';
    this.status = status;
    this.code = code;
  }
}

function countWords(text?: string) {
  const value = (text || '').trim();
  if (!value) return 0;
  const cjk = value.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const words = value.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return cjk + words;
}

function calcAverageChapterWords(chapters?: Array<{ text?: string }>) {
  const ready = asArray(chapters).filter((chapter) => (chapter?.text || '').trim().length > 0);
  if (ready.length === 0) return 0;
  return Math.round(ready.reduce((sum, chapter) => sum + countWords(chapter.text), 0) / ready.length);
}

function buildCardExcerpt(mainAxis?: string, chapters?: Array<{ text?: string; summary?: string }>) {
  const fromChapter = asArray(chapters).find((chapter) => (chapter?.text || chapter?.summary || '').trim().length > 0);
  return String(mainAxis || fromChapter?.summary || fromChapter?.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function countReadyChapters(chapters?: Array<{ text?: string }>) {
  return asArray(chapters).filter((chapter) => (chapter?.text || '').trim().length > 0).length;
}

function storyListItem(row: any) {
  return {
    id: row.id,
    title: row.title,
    main_axis: row.main_axis,
    tags: asArray(row.tags),
    visibility: row.visibility,
    authorId: row.author_id,
    authorName: row.author_name,
    coverUrl: row.cover_url,
    popularity: row.popularity,
    likeCount: row.like_count,
    interventionCount: row.intervention_count,
    favoriteCount: row.favorite_count,
    shareCount: row.share_count,
    reportCount: row.report_count,
    averageChapterWords: row.average_chapter_words,
    chapterCount: row.chapter_count,
    cardExcerpt: row.card_excerpt,
    allowAdaptation: row.allow_adaptation,
    seriesId: row.series_id || null,
    seriesRole: row.series_role || 'standalone',
    continuityNodeId: row.continuity_node_id || null,
    seriesConstraints: row.series_constraints || {},
    endingMode: row.ending_mode,
    endingRates: row.ending_rates || { left: 40, right: 40 },
    endingBias: normalizeEndingBias(row.ending_rates || { left: 40, right: 40 }),
    endingNames: row.ending_names || {},
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    version: row.version,
  };
}

async function fetchStoryCardRows(query: Record<string, string | number | boolean | undefined>) {
  try {
    return await supabaseRequest<any[]>('stories', { query: { ...query, select: STORY_CARD_SELECT }, timeoutMs: STORY_CARD_TIMEOUT_MS });
  } catch (error: any) {
    if (!/share_count/i.test(String(error?.message || error))) throw error;
    console.warn('[story-store] share_count column unavailable, using legacy story card select.');
    return supabaseRequest<any[]>('stories', { query: { ...query, select: LEGACY_STORY_CARD_SELECT }, timeoutMs: STORY_CARD_TIMEOUT_MS });
  }
}

async function enrichStoryActionState(items: any[], userId?: string | null) {
  if (items.length === 0) return items;
  const storyIds = Array.from(new Set(items
    .map((item) => String(item.sourceStoryId || item.id || ''))
    .filter(Boolean)));
  if (storyIds.length === 0) return items;
  const inFilter = `in.(${storyIds.join(',')})`;
  const [likeRows, favoriteRows, branchRows, progressRows] = await Promise.all([
    userId ? supabaseRequest<any[]>('story_likes', { query: { user_id: `eq.${userId}`, story_id: inFilter, select: 'story_id' }, timeoutMs: STORY_LIST_ENRICH_TIMEOUT_MS }).catch((error) => {
      console.warn('[story-store] list likes enrichment skipped:', error?.message || error);
      return [];
    }) : Promise.resolve([]),
    userId ? supabaseRequest<any[]>('story_favorites', { query: { user_id: `eq.${userId}`, story_id: inFilter, select: 'story_id' }, timeoutMs: STORY_LIST_ENRICH_TIMEOUT_MS }).catch((error) => {
      console.warn('[story-store] list favorites enrichment skipped:', error?.message || error);
      return [];
    }) : Promise.resolve([]),
    supabaseRequest<any[]>('story_branches', { query: { story_id: inFilter, select: 'story_id,id' }, timeoutMs: STORY_LIST_ENRICH_TIMEOUT_MS }).catch((error) => {
      console.warn('[story-store] list branches enrichment skipped:', error?.message || error);
      return [];
    }),
    userId ? supabaseRequest<any[]>('user_progress', { query: { user_id: `eq.${userId}`, story_id: inFilter, select: 'story_id,payload' }, timeoutMs: STORY_LIST_ENRICH_TIMEOUT_MS }).catch((error) => {
      console.warn('[story-store] list progress enrichment skipped:', error?.message || error);
      return [];
    }) : Promise.resolve([]),
  ]);
  const likedIds = new Set(likeRows.map((row) => String(row.story_id || '')));
  const favoritedIds = new Set(favoriteRows.map((row) => String(row.story_id || '')));
  const branchCountByStory = new Map<string, number>();
  branchRows.forEach((row) => {
    const storyId = String(row.story_id || '');
    if (storyId) branchCountByStory.set(storyId, (branchCountByStory.get(storyId) || 0) + 1);
  });
  const unlockedCountByStory = new Map<string, number>();
  progressRows.forEach((row) => {
    const storyId = String(row.story_id || '');
    const historical = asArray(row.payload?.historicallyUnlockedBranches || row.payload?.unlockedBranches);
    const ids = new Set(historical.map((branch: any) => String(branch?.id || '')).filter(Boolean));
    if (storyId) unlockedCountByStory.set(storyId, ids.size);
  });
  return items.map((item) => ({
    ...item,
    likedByMe: likedIds.has(String(item.sourceStoryId || item.id || '')),
    favoritedByMe: favoritedIds.has(String(item.sourceStoryId || item.id || '')),
    branchCount: branchCountByStory.get(String(item.sourceStoryId || item.id || '')) || item.branchCount || 0,
    unlockedBranchCount: unlockedCountByStory.get(String(item.sourceStoryId || item.id || '')) || item.unlockedBranchCount || 0,
  }));
}

function storyMeta(row: any) {
  const endingRates = row.ending_rates || { left: 40, right: 40 };
  return {
    ...storyListItem(row),
    main_axis: row.main_axis,
    characters: asArray(row.characters),
    endingMode: row.ending_mode,
    endingRates,
    endingBias: normalizeEndingBias(endingRates),
    endingNames: row.ending_names || {},
    defaults: row.defaults || { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
  };
}

function seriesWorldRecord(row: any) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    title: row.title,
    pitch: row.pitch,
    genreTags: asArray(row.genre_tags),
    worldBible: row.world_bible || {},
    timelineNotes: row.timeline_notes || '',
    ironLaws: asArray(row.iron_laws),
    futureDirections: asArray(row.future_directions),
    visibility: row.visibility || 'private',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function seriesWorldRowFromArgs(args: any, authUser: any, id?: string) {
  const updatedAt = nowIso();
  return {
    ...(id ? { id } : {}),
    author_id: authUser.uid,
    author_name: args.authorName || args.author_name || guestName(authUser.uid),
    title: args.title || '未命名世界观设定',
    pitch: args.pitch || '',
    genre_tags: asArray(args.genreTags || args.genre_tags),
    world_bible: args.worldBible || args.world_bible || {},
    timeline_notes: args.timelineNotes || args.timeline_notes || '',
    iron_laws: asArray(args.ironLaws || args.iron_laws),
    future_directions: asArray(args.futureDirections || args.future_directions),
    visibility: args.visibility === 'public' || args.visibility === 'unlisted' ? args.visibility : 'private',
    updated_at: updatedAt,
    created_at: args.createdAt || args.created_at || updatedAt,
  };
}

function continuityNodeRecord(row: any) {
  return {
    id: row.id,
    seriesId: row.series_id,
    sourceStoryId: row.source_story_id,
    targetStoryId: row.target_story_id,
    title: row.title,
    endingDomain: row.ending_domain || 'middle',
    endingId: row.ending_id || 'default',
    requiredBranchIds: asArray(row.required_branch_ids),
    optionalBranchIds: asArray(row.optional_branch_ids),
    bridgeSummary: row.bridge_summary || '',
    legacyState: row.legacy_state || {},
    repairRules: asArray(row.repair_rules),
    sequelSeedPrompt: row.sequel_seed_prompt || '',
    visibility: row.visibility || 'private',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function continuityNodeRowFromArgs(args: any, authUser: any, id?: string) {
  const updatedAt = nowIso();
  return {
    ...(id ? { id } : {}),
    series_id: args.seriesId || args.series_id,
    source_story_id: args.sourceStoryId || args.source_story_id || null,
    target_story_id: args.targetStoryId || args.target_story_id || null,
    title: args.title || '未命名接续节点',
    ending_domain: ['left', 'right', 'middle'].includes(args.endingDomain || args.ending_domain) ? (args.endingDomain || args.ending_domain) : 'middle',
    ending_id: args.endingId || args.ending_id || 'default',
    required_branch_ids: asArray(args.requiredBranchIds || args.required_branch_ids),
    optional_branch_ids: asArray(args.optionalBranchIds || args.optional_branch_ids),
    bridge_summary: args.bridgeSummary || args.bridge_summary || '',
    legacy_state: args.legacyState || args.legacy_state || {},
    repair_rules: asArray(args.repairRules || args.repair_rules),
    sequel_seed_prompt: args.sequelSeedPrompt || args.sequel_seed_prompt || '',
    visibility: args.visibility === 'public' || args.visibility === 'unlisted' ? args.visibility : 'private',
    created_by: authUser.uid,
    updated_at: updatedAt,
    created_at: args.createdAt || args.created_at || updatedAt,
  };
}

function sharedRecord(row: any) {
  return {
    id: row.id,
    archiveKind: row.archive_kind || 'snapshot',
    snapshotKind: row.snapshot_kind || 'intervened',
    contentHash: row.content_hash || '',
    title: row.title,
    main_axis: row.main_axis,
    tags: asArray(row.tags),
    characters: asArray(row.characters),
    chapters: asArray(row.chapters),
    authorId: row.author_id,
    authorName: row.author_name,
    originalAuthorId: row.original_author_id,
    originalAuthorName: row.original_author_name,
    intervenerId: row.intervener_id,
    intervenerName: row.intervener_name,
    coverUrl: row.cover_url,
    sourceStoryId: row.source_story_id,
    averageChapterWords: row.average_chapter_words,
    chapterCount: row.chapter_count,
    cardExcerpt: row.card_excerpt,
    allowAdaptation: row.allow_adaptation,
    fateRecord: row.fate_record || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    visibility: row.visibility,
  };
}

function storyRowFromMeta(meta: any, id?: string) {
  const updatedAt = nowIso();
  const rawContinuityNodeId = meta.continuityNodeId || meta.continuity_node_id || '';
  const continuityNodeId = String(rawContinuityNodeId).startsWith('anchor:') ? null : rawContinuityNodeId || null;
  return {
    ...(id ? { id } : {}),
    title: meta.title || '未命名作品',
    main_axis: meta.main_axis || '',
    tags: asArray(meta.tags),
    cover_url: meta.coverUrl || '',
    author_id: meta.authorId,
    author_name: meta.authorName || guestName(meta.authorId),
    visibility: meta.visibility || 'private',
    popularity: asInt(meta.popularity),
    like_count: asInt(meta.likeCount),
    intervention_count: asInt(meta.interventionCount ?? meta.popularity),
    favorite_count: asInt(meta.favoriteCount),
    share_count: asInt(meta.shareCount),
    report_count: asInt(meta.reportCount),
    average_chapter_words: asInt(meta.averageChapterWords),
    chapter_count: asInt(meta.chapterCount),
    card_excerpt: meta.cardExcerpt || '',
    allow_adaptation: Boolean(meta.allowAdaptation),
    series_id: meta.seriesId || meta.series_id || null,
    series_role: meta.seriesRole || meta.series_role || (meta.seriesId || meta.series_id ? 'main' : 'standalone'),
    continuity_node_id: continuityNodeId,
    series_constraints: meta.seriesConstraints || meta.series_constraints || {},
    ending_mode: meta.endingMode || 'dual',
    ending_rates: { ...(meta.endingRates || { left: 40, right: 40 }), ...normalizeEndingBias(meta.endingBias || meta.endingRates) },
    ending_names: meta.endingNames || {},
    defaults: meta.defaults || { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
    characters: asArray(meta.characters),
    version: asInt(meta.version, 1),
    created_at: meta.createdAt || updatedAt,
    updated_at: updatedAt,
  };
}

const OPTIONAL_STORY_INSERT_COLUMNS = [
  'share_count',
  'series_id',
  'series_role',
  'continuity_node_id',
  'series_constraints',
];

function isSupabaseMissingStoryColumnError(error: any) {
  const message = String(error?.message || error || '');
  return /Could not find|column|schema cache|PGRST/i.test(message)
    && OPTIONAL_STORY_INSERT_COLUMNS.some((column) => message.includes(column));
}

function stripOptionalStoryInsertColumns(row: Record<string, any>) {
  const next = { ...row };
  OPTIONAL_STORY_INSERT_COLUMNS.forEach((column) => {
    delete next[column];
  });
  return next;
}

async function insertStoryRow(row: Record<string, any>, context: string) {
  try {
    return {
      rows: await supabaseInsert<any[]>('stories', [row]),
      usedOptionalColumns: true,
    };
  } catch (error) {
    if (!isSupabaseMissingStoryColumnError(error)) throw error;
    console.warn('[story-store] stories insert optional-column fallback', {
      context,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      rows: await supabaseInsert<any[]>('stories', [stripOptionalStoryInsertColumns(row)]),
      usedOptionalColumns: false,
    };
  }
}

async function optionalUser(req: VercelRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await verifyFirebaseToken(token);
  } catch (error: any) {
    // Public reads should not fail just because an installed PWA is holding an
    // expired/stale Firebase token. Auth-required actions still call requireUser.
    console.warn('[story-store:optional-auth-failed]', { message: error?.message || String(error) });
    return null;
  }
}

function getPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@3tnovelgame.local';
  return { publicKey, privateKey, subject, enabled: Boolean(publicKey && privateKey) };
}

async function sendPushNotification(userIds: string[], payload: { title: string; body: string; url?: string }) {
  const config = getPushConfig();
  if (!config.enabled || userIds.length === 0) return;
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const rows = await supabaseRequest<any[]>('push_subscriptions', {
    query: {
      user_id: `in.(${Array.from(new Set(userIds)).join(',')})`,
      select: 'user_id,endpoint,subscription',
    },
  }).catch(() => []);
  await Promise.all(rows.map(async (row) => {
    try {
      await webPush.sendNotification(row.subscription, JSON.stringify(payload));
    } catch (error: any) {
      if ([404, 410].includes(Number(error?.statusCode))) {
        await supabaseRequest('push_subscriptions', {
          method: 'DELETE',
          query: { endpoint: `eq.${row.endpoint}` },
        }).catch(() => null);
      } else {
        console.warn('[push-notification:send-failed]', { userId: row.user_id, statusCode: error?.statusCode, message: error?.message });
      }
    }
  }));
}

async function notifyUsers(rows: Array<{
  userId: string;
  type: string;
  title: string;
  body: string;
  storyId?: string | null;
  authorId?: string | null;
  url?: string;
}>) {
  const notifications = rows
    .filter((row) => row.userId)
    .map((row) => ({
      user_id: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      story_id: row.storyId || null,
      author_id: row.authorId || null,
      created_at: nowIso(),
    }));
  if (notifications.length === 0) return;
  await supabaseInsert('user_notifications', notifications).catch((error) => {
    console.warn('[notifications:insert-failed]', error);
  });
  await sendPushNotification(
    notifications.map((row: any) => row.user_id),
    { title: rows[0].title, body: rows[0].body, url: rows[0].url || '/' }
  );
}

async function notifyAuthorFollowers(authorId: string, args: { type: 'author_new_story' | 'author_story_updated'; title: string; body: string; storyId?: string | null }) {
  if (!authorId) return;
  const followers = await supabaseRequest<any[]>('author_follows', {
    query: { author_id: `eq.${authorId}`, select: 'follower_id', limit: 500 },
  }).catch(() => []);
  const rows = followers
    .map((row) => String(row.follower_id || ''))
    .filter((followerId) => followerId && followerId !== authorId)
    .map((followerId) => ({
      userId: followerId,
      type: args.type,
      title: args.title,
      body: args.body,
      storyId: args.storyId || null,
      authorId,
      url: args.storyId ? `/?story=${encodeURIComponent(args.storyId)}` : '/',
    }));
  await notifyUsers(rows);
}

async function requireUser(req: VercelRequest, res: VercelResponse) {
  const user = await optionalUser(req);
  if (!user) {
    res.status(401).json({
      code: 'AUTH_REQUIRED',
      requestId: String(res.getHeader('x-request-id') || ''),
      error: 'Unauthorized',
    });
    return null;
  }
  return user;
}

async function requireStoryOwner(storyId: string, uid: string) {
  const rows = await supabaseRequest<any[]>('stories', { query: { id: `eq.${storyId}`, select: 'id,author_id' } });
  if (!rows?.[0] || rows[0].author_id !== uid) {
    throw new StoryStoreHttpError(403, 'STORY_OWNER_REQUIRED', '无权修改这个作品。');
  }
}

async function getCartridge(storyId: string, currentUserId?: string) {
  try {
    const payload = await supabaseRpc<any>('get_story_cartridge', { p_story_id: storyId });
    const row = Array.isArray(payload) ? payload[0] : payload;
    const metaRow = row?.meta;
    if (!metaRow) return null;
    if (metaRow.visibility === 'private' && metaRow.author_id !== currentUserId) return null;
    return {
      storyId,
      meta: storyMeta(metaRow),
      chapters: asArray(row.chapters).map((chapter) => ({
        chapter_num: chapter.chapter_num,
        title: chapter.title,
        summary: chapter.summary,
        present_characters: chapter.present_characters || [],
        text: chapter.text,
      })),
      endings: asArray(row.endings).map((ending) => ({
        id: ending.id,
        chapter_num: ending.chapter_num,
        title: ending.title,
        text: ending.text,
        keyNodes: ending.key_nodes || [],
      })),
      branches: asArray(row.branches).map((branch) => ({
        id: branch.id,
        side: branch.side,
        tier: branch.tier === 'hidden' ? 'small' : branch.tier,
        is_hidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
        name: branch.name,
        hint: branch.hint,
        desc: branch.description,
        trigger: branch.trigger,
        triggerGroups: branch.trigger_groups,
        common: branch.common,
        inject: branch.inject,
        sceneText: branch.scene_text,
      })),
    };
  } catch (error) {
    console.warn('get_story_cartridge rpc unavailable, falling back to REST fanout:', error);
  }

  const [metaRow] = await supabaseRequest<any[]>('stories', { query: { id: `eq.${storyId}`, select: '*', limit: 1 } });
  if (!metaRow) return null;
  if (metaRow.visibility === 'private' && metaRow.author_id !== currentUserId) return null;
  const [chapters, endings, branches] = await Promise.all([
    supabaseRequest<any[]>('story_chapters', { query: { story_id: `eq.${storyId}`, select: '*', order: 'chapter_num.asc' } }),
    supabaseRequest<any[]>('story_endings', { query: { story_id: `eq.${storyId}`, select: '*' } }),
    supabaseRequest<any[]>('story_branches', { query: { story_id: `eq.${storyId}`, select: '*' } }),
  ]);
  return {
    storyId,
    meta: storyMeta(metaRow),
    chapters: chapters.map((chapter) => ({
      chapter_num: chapter.chapter_num,
      title: chapter.title,
      summary: chapter.summary,
      present_characters: chapter.present_characters || [],
      text: chapter.text,
    })),
    endings: endings.map((ending) => ({
      id: ending.id,
      chapter_num: ending.chapter_num,
      title: ending.title,
      text: ending.text,
      keyNodes: ending.key_nodes || [],
    })),
    branches: branches.map((branch) => ({
      id: branch.id,
      side: branch.side,
      tier: branch.tier === 'hidden' ? 'small' : branch.tier,
      is_hidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
      name: branch.name,
      hint: branch.hint,
      desc: branch.description,
      trigger: branch.trigger,
      triggerGroups: branch.trigger_groups,
      common: branch.common,
      inject: branch.inject,
      sceneText: branch.scene_text,
    })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  const logContext = getRequestLogContext(req, 'story-store');
  res.setHeader('x-request-id', logContext.requestId);

  try {
    const body = req.body || {};
    const action = String(body.action || '');
    if (!isStoryStoreAction(action)) {
      logGenerationInfo(logContext, 'unsupported-action', { action });
      return res.status(400).json({
        code: 'UNSUPPORTED_ACTION',
        requestId: logContext.requestId,
        error: `Unsupported story-store action: ${action}`,
      });
    }
    logGenerationInfo(logContext, 'start', { action });
    const user = await optionalUser(req);

    if (action === 'getPushConfig') {
      const config = getPushConfig();
      return res.status(200).json({ publicKey: config.publicKey, enabled: config.enabled });
    }

    if (action === 'listPublicStories') {
      const publicSortOrder = ({
        likes: 'like_count.desc',
        interventions: 'intervention_count.desc',
        favorites: 'favorite_count.desc',
        shares: 'share_count.desc',
        words: 'average_chapter_words.desc',
        updated: 'updated_at.desc',
      } as Record<string, string>)[String(body.sort || 'updated')] || 'updated_at.desc';
      const rows = await fetchStoryCardRows({
          visibility: 'eq.public',
          order: `${publicSortOrder},updated_at.desc`,
          limit: body.pageSize || 20,
      });
      return res.status(200).json(await enrichStoryActionState(rows.map(storyListItem), user?.uid));
    }

    if (action === 'listMyStories') {
      const authUser = await requireUser(req, res);
      if (!authUser) return;
      const rows = await fetchStoryCardRows({ author_id: `eq.${authUser.uid}`, order: 'updated_at.desc', limit: body.pageSize || 50 });
      return res.status(200).json(await enrichStoryActionState(rows.map(storyListItem), authUser.uid));
    }

    if (action === 'listAuthorStories') {
      const authorId = String(body.authorId || '');
      if (!authorId) return res.status(400).json({ error: 'Missing authorId' });
      const rows = await fetchStoryCardRows({
          author_id: `eq.${authorId}`,
          visibility: 'in.(public,unlisted)',
          order: 'updated_at.desc',
          limit: body.pageSize || 50,
      });
      return res.status(200).json(await enrichStoryActionState(rows.map(storyListItem), user?.uid));
    }

    if (action === 'listMySharedStories') {
      const authUser = await requireUser(req, res);
      if (!authUser) return;
      const [rows, favoriteRows] = await Promise.all([
        supabaseRequest<any[]>('shared_stories', {
          query: { author_id: `eq.${authUser.uid}`, select: SHARED_CARD_SELECT, order: 'updated_at.desc', limit: body.pageSize || 50 },
          timeoutMs: STORY_CARD_TIMEOUT_MS,
        }),
        supabaseRequest<any[]>('story_favorites', {
          query: { user_id: `eq.${authUser.uid}`, select: 'story_id,created_at', order: 'created_at.desc', limit: body.pageSize || 50 },
          timeoutMs: STORY_CARD_TIMEOUT_MS,
        }),
      ]);
      const favoriteIds = favoriteRows.map((row) => String(row.story_id || '')).filter(Boolean);
      const favoriteStories = favoriteIds.length
        ? await fetchStoryCardRows({ id: `in.(${favoriteIds.join(',')})` })
        : [];
      const deduped = new Map<string, any>();
      favoriteStories.map(storyListItem).forEach((story) => {
        const favorite = favoriteRows.find((row) => row.story_id === story.id);
        deduped.set(`favorite:${story.id}`, {
          ...story,
          archiveKind: 'favorite',
          sourceStoryId: story.id,
          originalAuthorId: story.authorId,
          originalAuthorName: story.authorName,
          intervenerId: null,
          intervenerName: '',
          createdAt: favorite?.created_at || story.updatedAt,
          updatedAt: favorite?.created_at || story.updatedAt,
        });
      });
      rows.map(sharedRecord).forEach((record) => {
        const key = `snapshot:${record.sourceStoryId || record.id}:${record.contentHash || record.id}:${record.snapshotKind || ''}`;
        if (!deduped.has(key)) deduped.set(key, record);
      });
      return res.status(200).json(await enrichStoryActionState(Array.from(deduped.values()), authUser.uid));
    }

    if (action === 'getStoryMeta') {
      const [row] = await supabaseRequest<any[]>('stories', { query: { id: `eq.${body.storyId}`, select: '*', limit: 1 } });
      if (!row || (row.visibility === 'private' && row.author_id !== user?.uid)) return res.status(200).json(null);
      return res.status(200).json(storyMeta(row));
    }

    if (action === 'getStoryCartridge') {
      return res.status(200).json(await getCartridge(body.storyId, user?.uid));
    }

    if (action === 'getSharedStoryRecord') {
      const [sharedRow] = await supabaseRequest<any[]>('shared_stories', { query: { id: `eq.${body.storyId}`, select: '*', limit: 1 } });
      if (sharedRow) {
        if (sharedRow.visibility === 'private' && sharedRow.author_id !== user?.uid) return res.status(200).json(null);
        const record = sharedRecord(sharedRow);
        return res.status(200).json({
          storyId: record.id,
          meta: {
            archiveKind: record.archiveKind,
            snapshotKind: record.snapshotKind,
            contentHash: record.contentHash,
            sharedStoryId: record.id,
            sourceStoryId: record.sourceStoryId || null,
            title: record.title,
            main_axis: record.main_axis,
            tags: record.tags,
            characters: record.characters,
            authorId: record.authorId,
            authorName: record.authorName,
            originalAuthorId: record.originalAuthorId || record.sourceStoryId || null,
            originalAuthorName: record.originalAuthorName || record.authorName,
            intervenerId: record.intervenerId || record.authorId,
            intervenerName: record.intervenerName || record.authorName,
            coverUrl: record.coverUrl || '',
            visibility: record.visibility,
            averageChapterWords: record.averageChapterWords || 0,
            chapterCount: record.chapterCount || record.chapters.length,
            cardExcerpt: record.cardExcerpt || buildCardExcerpt(record.main_axis, record.chapters),
            allowAdaptation: Boolean(record.allowAdaptation),
          },
          chapters: record.chapters,
        });
      }
      const cartridge = await getCartridge(body.storyId, user?.uid);
      if (!cartridge || cartridge.meta.visibility === 'private') return res.status(200).json(null);
      return res.status(200).json({
        storyId: body.storyId,
        meta: {
          ...cartridge.meta,
          sourceStoryId: body.storyId,
          originalAuthorId: cartridge.meta.authorId,
          originalAuthorName: cartridge.meta.authorName,
          intervenerId: null,
          intervenerName: '',
        },
        chapters: cartridge.chapters,
      });
    }

    if (action === 'getAppSettings') {
      const [row] = await supabaseRequest<any[]>('app_settings', { query: { id: 'eq.global', select: 'payload', limit: 1 } });
      return res.status(200).json(row?.payload || {});
    }

    const authUser = await requireUser(req, res);
    if (!authUser) return;

    if (action === 'getUserProgress') {
      const [row] = await supabaseRequest<any[]>('user_progress', { query: { user_id: `eq.${authUser.uid}`, story_id: `eq.${body.storyId}`, select: 'payload,updated_at', limit: 1 } });
      return res.status(200).json(row?.payload || null);
    }

    if (action === 'saveUserProgress') {
      await supabaseUpsert('user_progress', [{
        user_id: authUser.uid,
        story_id: body.storyId,
        payload: body.payload || {},
        updated_at: nowIso(),
      }], 'user_id,story_id');
      return res.status(200).json({ ok: true });
    }

    if (action === 'listMySeriesWorlds') {
      const rows = await supabaseRequest<any[]>('series_worlds', {
        query: {
          author_id: `eq.${authUser.uid}`,
          select: '*',
          order: 'updated_at.desc',
          limit: body.pageSize || 50,
        },
      }).catch((error) => {
        if (/series_worlds/i.test(String(error?.message || error))) return [];
        throw error;
      });
      return res.status(200).json(rows.map(seriesWorldRecord));
    }

    if (action === 'getSeriesWorld') {
      const seriesId = String(body.seriesId || '');
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      const [row] = await supabaseRequest<any[]>('series_worlds', { query: { id: `eq.${seriesId}`, select: '*', limit: 1 } });
      if (!row || (row.visibility === 'private' && row.author_id !== authUser.uid)) return res.status(200).json(null);
      return res.status(200).json(seriesWorldRecord(row));
    }

    if (action === 'saveSeriesWorld') {
      const args = body.args || {};
      const seriesId = String(body.seriesId || args.id || '');
      if (seriesId) {
        const [existing] = await supabaseRequest<any[]>('series_worlds', { query: { id: `eq.${seriesId}`, select: 'author_id', limit: 1 } });
        if (!existing || existing.author_id !== authUser.uid) return res.status(403).json({ code: 'OWNER_REQUIRED', error: 'Forbidden' });
        await supabaseRequest('series_worlds', {
          method: 'PATCH',
          query: { id: `eq.${seriesId}`, author_id: `eq.${authUser.uid}` },
          body: seriesWorldRowFromArgs(args, authUser, seriesId),
        });
        return res.status(200).json(seriesId);
      }
      const [created] = await supabaseInsert<any[]>('series_worlds', [seriesWorldRowFromArgs(args, authUser)]);
      return res.status(200).json(created.id);
    }

    if (action === 'deleteSeriesWorld') {
      const seriesId = String(body.seriesId || '');
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      await supabaseRequest('continuity_nodes', {
        method: 'DELETE',
        query: { series_id: `eq.${seriesId}`, created_by: `eq.${authUser.uid}` },
      }).catch((error) => {
        if (!/continuity_nodes/i.test(String(error?.message || error))) throw error;
      });
      await supabaseRequest('series_worlds', {
        method: 'DELETE',
        query: { id: `eq.${seriesId}`, author_id: `eq.${authUser.uid}` },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'listContinuityNodes') {
      const seriesId = String(body.seriesId || '');
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      const [series] = await supabaseRequest<any[]>('series_worlds', { query: { id: `eq.${seriesId}`, select: 'author_id,visibility', limit: 1 } });
      if (!series || (series.visibility === 'private' && series.author_id !== authUser.uid)) return res.status(200).json([]);
      const rows = await supabaseRequest<any[]>('continuity_nodes', {
        query: { series_id: `eq.${seriesId}`, select: '*', order: 'updated_at.desc', limit: body.pageSize || 50 },
      }).catch((error) => {
        if (/continuity_nodes/i.test(String(error?.message || error))) return [];
        throw error;
      });
      return res.status(200).json(rows.map(continuityNodeRecord));
    }

    if (action === 'saveContinuityNode') {
      const args = body.args || {};
      const seriesId = String(args.seriesId || body.seriesId || '');
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      const [series] = await supabaseRequest<any[]>('series_worlds', { query: { id: `eq.${seriesId}`, select: 'author_id', limit: 1 } });
      if (!series || series.author_id !== authUser.uid) return res.status(403).json({ code: 'OWNER_REQUIRED', error: 'Forbidden' });
      const nodeId = String(body.nodeId || args.id || '');
      if (nodeId) {
        await supabaseRequest('continuity_nodes', {
          method: 'PATCH',
          query: { id: `eq.${nodeId}`, series_id: `eq.${seriesId}` },
          body: continuityNodeRowFromArgs({ ...args, seriesId }, authUser, nodeId),
        });
        return res.status(200).json(nodeId);
      }
      const [created] = await supabaseInsert<any[]>('continuity_nodes', [continuityNodeRowFromArgs({ ...args, seriesId }, authUser)]);
      return res.status(200).json(created.id);
    }

    if (action === 'attachStoryToSeries') {
      const seriesId = String(body.seriesId || '');
      const storyId = String(body.storyId || '');
      if (!seriesId || !storyId) return res.status(400).json({ error: 'Missing seriesId or storyId' });
      await requireStoryOwner(storyId, authUser.uid);
      const [series] = await supabaseRequest<any[]>('series_worlds', { query: { id: `eq.${seriesId}`, select: 'author_id', limit: 1 } });
      if (!series || series.author_id !== authUser.uid) return res.status(403).json({ code: 'OWNER_REQUIRED', error: 'Forbidden' });
      const entryOrder = Math.max(1, asInt(body.entryOrder, 1));
      const seriesRole = ['main', 'sequel', 'prequel', 'side'].includes(String(body.seriesRole || '')) ? String(body.seriesRole) : 'main';
      const continuityNodeId = body.continuityNodeId || null;
      await supabaseRequest('stories', {
        method: 'PATCH',
        query: { id: `eq.${storyId}` },
        body: {
          series_id: seriesId,
          series_role: seriesRole,
          continuity_node_id: continuityNodeId,
          series_constraints: body.seriesConstraints || {},
          updated_at: nowIso(),
        },
      });
      await supabaseUpsert('series_entries', [{
        series_id: seriesId,
        story_id: storyId,
        entry_order: entryOrder,
        entry_type: seriesRole,
        timeline_label: body.timelineLabel || '',
        created_at: nowIso(),
      }], 'series_id,story_id');
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveAppSettings') {
      if (!ADMIN_USER_IDS.has(authUser.uid)) {
        return res.status(403).json({
          code: 'ADMIN_REQUIRED',
          requestId: logContext.requestId,
          error: 'Forbidden',
        });
      }
      await supabaseUpsert('app_settings', [{
        id: 'global',
        payload: body.settings || {},
        updated_by: authUser.uid,
        updated_at: nowIso(),
      }], 'id');
      return res.status(200).json({ ok: true });
    }

    if (action === 'listNotifications') {
      const rows = await supabaseRequest<any[]>('user_notifications', {
        query: {
          user_id: `eq.${authUser.uid}`,
          select: 'id,type,title,body,story_id,author_id,created_at,read_at',
          order: 'created_at.desc',
          limit: body.pageSize || 50,
        },
      }).catch((error) => {
        if (/user_notifications/i.test(String(error?.message || error))) return [];
        throw error;
      });
      return res.status(200).json(rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        storyId: row.story_id,
        authorId: row.author_id,
        createdAt: row.created_at,
        readAt: row.read_at,
      })));
    }

    if (action === 'listFollowedAuthors') {
      const rows = await supabaseRequest<any[]>('author_follows', {
        query: {
          follower_id: `eq.${authUser.uid}`,
          select: 'author_id,author_name,created_at',
          order: 'created_at.desc',
          limit: body.pageSize || 100,
        },
      }).catch((error) => {
        if (/author_follows/i.test(String(error?.message || error))) return [];
        throw error;
      });
      return res.status(200).json(rows.map((row) => ({
        authorId: row.author_id,
        authorName: row.author_name || guestName(row.author_id),
        followedAt: row.created_at,
      })));
    }

    if (action === 'markNotificationsRead') {
      await supabaseRequest('user_notifications', {
        method: 'PATCH',
        query: { user_id: `eq.${authUser.uid}`, read_at: 'is.null' },
        body: { read_at: nowIso() },
      }).catch((error) => {
        if (/user_notifications/i.test(String(error?.message || error))) return null;
        throw error;
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteNotification') {
      const notificationId = String(body.notificationId || '');
      if (!notificationId) return res.status(400).json({ error: 'Missing notificationId' });
      await supabaseRequest('user_notifications', {
        method: 'DELETE',
        query: { id: `eq.${notificationId}`, user_id: `eq.${authUser.uid}` },
      }).catch((error) => {
        if (/user_notifications/i.test(String(error?.message || error))) return null;
        throw error;
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteAllNotifications') {
      await supabaseRequest('user_notifications', {
        method: 'DELETE',
        query: { user_id: `eq.${authUser.uid}` },
      }).catch((error) => {
        if (/user_notifications/i.test(String(error?.message || error))) return null;
        throw error;
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'getAuthorFollowState') {
      const authorId = String(body.authorId || '');
      if (!authorId) return res.status(400).json({ error: 'Missing authorId' });
      const rows = await supabaseRequest<any[]>('author_follows', {
        query: { follower_id: `eq.${authUser.uid}`, author_id: `eq.${authorId}`, select: 'author_id', limit: 1 },
      }).catch(() => []);
      return res.status(200).json({ following: rows.length > 0 });
    }

    if (action === 'followAuthor') {
      const authorId = String(body.authorId || '');
      if (!authorId) return res.status(400).json({ error: 'Missing authorId' });
      if (authorId === authUser.uid) return res.status(200).json({ following: false, self: true });
      await supabaseUpsert('author_follows', [{
        follower_id: authUser.uid,
        author_id: authorId,
        author_name: body.authorName || guestName(authorId),
        created_at: nowIso(),
      }], 'follower_id,author_id');
      return res.status(200).json({ following: true });
    }

    if (action === 'unfollowAuthor') {
      const authorId = String(body.authorId || '');
      if (!authorId) return res.status(400).json({ error: 'Missing authorId' });
      await supabaseRequest('author_follows', {
        method: 'DELETE',
        query: { follower_id: `eq.${authUser.uid}`, author_id: `eq.${authorId}` },
      });
      return res.status(200).json({ following: false });
    }

    if (action === 'savePushSubscription') {
      const subscription = body.subscription || {};
      const endpoint = String(subscription.endpoint || '');
      if (!endpoint) return res.status(400).json({ error: 'Missing push endpoint' });
      await supabaseUpsert('push_subscriptions', [{
        user_id: authUser.uid,
        endpoint,
        subscription,
        updated_at: nowIso(),
      }], 'user_id,endpoint');
      return res.status(200).json({ ok: true });
    }

    if (action === 'reserveCoverUsage') {
      return res.status(200).json(await supabaseRpc('reserve_cover_usage', { p_user_id: authUser.uid, p_date_key: body.dateKey, p_limit: 5 }));
    }

    if (action === 'refundCoverUsage') {
      return res.status(200).json(await supabaseRpc('refund_cover_usage', { p_user_id: authUser.uid, p_date_key: body.dateKey }));
    }

    if (action === 'incrementStoryMetric') {
      const allowed = new Set(['favoriteCount', 'reportCount', 'interventionCount']);
      if (!allowed.has(body.field)) return res.status(400).json({ error: 'Invalid metric field' });
      return res.status(200).json(await supabaseRpc('increment_story_metric', { p_story_id: body.storyId, p_field: body.field }));
    }

    if (action === 'incrementShareMetric') {
      const storyId = String(body.storyId || '');
      if (!storyId) return res.status(400).json({ error: 'Missing storyId' });
      const [story] = await supabaseRequest<any[]>('stories', {
        query: { id: `eq.${storyId}`, select: 'id,title,author_id,author_name,share_count', limit: 1 },
      }).catch((error) => {
        if (!/share_count/i.test(String(error?.message || error))) throw error;
        return supabaseRequest<any[]>('stories', { query: { id: `eq.${storyId}`, select: 'id,title,author_id,author_name', limit: 1 } });
      });
      if (!story) return res.status(404).json({ error: 'Story not found' });
      const nextShareCount = Math.max(0, asInt(story.share_count) + 1);
      await supabaseRequest('stories', {
        method: 'PATCH',
        query: { id: `eq.${storyId}` },
        body: { share_count: nextShareCount },
      }).catch((error) => {
        if (!/share_count/i.test(String(error?.message || error))) throw error;
        console.warn('[story-store] share_count column unavailable, share metric skipped.');
      });
      if (story.author_id && story.author_id !== authUser.uid) {
        await notifyUsers([{
          userId: story.author_id,
          type: 'story_shared',
          title: '作品被分享',
          body: `《${story.title || '未命名作品'}》刚刚被分享了。`,
          storyId,
          authorId: story.author_id,
          url: `/?story=${encodeURIComponent(storyId)}`,
        }]);
      }
      return res.status(200).json({ shareCount: nextShareCount });
    }

    if (action === 'likeStory') {
      const [story] = await supabaseRequest<any[]>('stories', {
        query: { id: `eq.${body.storyId}`, select: 'id,title,author_id', limit: 1 },
      }).catch(() => []);
      const result = await supabaseRpc('like_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid });
      if (story?.author_id && story.author_id !== authUser.uid && !(result as any)?.alreadyExists && !(result as any)?.already_exists) {
        await notifyUsers([{
          userId: story.author_id,
          type: 'story_liked',
          title: '新的点赞',
          body: `《${story.title || '未命名作品'}》收到了一个新的点赞。`,
          storyId: body.storyId,
          authorId: story.author_id,
          url: `/?story=${encodeURIComponent(body.storyId)}`,
        }]);
      }
      return res.status(200).json(result);
    }

    if (action === 'unlikeStory') {
      try {
        return res.status(200).json(await supabaseRpc('unlike_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid }));
      } catch (error) {
        console.warn('[story-store:unlikeStory:fallback]', error);
        const existing = await supabaseRequest<any[]>('story_likes', {
          query: { story_id: `eq.${body.storyId}`, user_id: `eq.${authUser.uid}`, select: 'story_id', limit: 1 },
        });
        if (!existing?.length) return res.status(200).json({ removed: false });
        await supabaseRequest('story_likes', {
          method: 'DELETE',
          query: { story_id: `eq.${body.storyId}`, user_id: `eq.${authUser.uid}` },
        });
        const [storyRow] = await supabaseRequest<any[]>('stories', {
          query: { id: `eq.${body.storyId}`, select: 'like_count', limit: 1 },
        });
        await supabaseRequest('stories', {
          method: 'PATCH',
          query: { id: `eq.${body.storyId}` },
          body: { like_count: Math.max(0, asInt(storyRow?.like_count) - 1) },
        });
        return res.status(200).json({ removed: true, fallback: true });
      }
    }

    if (action === 'favoriteStory') {
      const [story] = await supabaseRequest<any[]>('stories', {
        query: { id: `eq.${body.storyId}`, select: 'id,title,author_id', limit: 1 },
      }).catch(() => []);
      const result = await supabaseRpc('favorite_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid });
      if (story?.author_id && story.author_id !== authUser.uid && !(result as any)?.alreadyExists && !(result as any)?.already_exists) {
        await notifyUsers([{
          userId: story.author_id,
          type: 'story_favorited',
          title: '新的收藏',
          body: `《${story.title || '未命名作品'}》被加入收藏了。`,
          storyId: body.storyId,
          authorId: story.author_id,
          url: `/?story=${encodeURIComponent(body.storyId)}`,
        }]);
      }
      return res.status(200).json(result);
    }

    if (action === 'unfavoriteStory') {
      return res.status(200).json(await supabaseRpc('unfavorite_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid }));
    }

    if (action === 'reportStory') {
      return res.status(200).json(await supabaseRpc('report_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid, p_reason: body.reason || '' }));
    }

    if (action === 'createSharedStoryRecord') {
      const args = body.args || {};
      const sharedVisibility = args.visibility === 'private' ? 'private' : 'unlisted';
      const payload = {
        snapshot_kind: args.snapshotKind || (sharedVisibility === 'private' ? 'saved_run' : 'intervened'),
        content_hash: args.contentHash || '',
        title: args.title,
        main_axis: args.main_axis || '',
        tags: asArray(args.tags),
        characters: asArray(args.characters),
        chapters: asArray(args.chapters).filter((chapter) => chapter.chapter_num >= 1 && chapter.chapter_num <= 7 && String(chapter.text || '').trim()),
        author_id: authUser.uid,
        author_name: args.authorName || guestName(authUser.uid),
        original_author_id: args.originalAuthorId || args.sourceStoryId || null,
        original_author_name: args.originalAuthorName || args.authorName || guestName(authUser.uid),
        intervener_id: args.intervenerId || authUser.uid,
        intervener_name: args.intervenerName || args.authorName || guestName(authUser.uid),
        cover_url: args.coverUrl || '',
        source_story_id: args.sourceStoryId || null,
        average_chapter_words: asInt(args.averageChapterWords || calcAverageChapterWords(args.chapters)),
        chapter_count: countReadyChapters(args.chapters),
        card_excerpt: buildCardExcerpt(args.main_axis, args.chapters),
        allow_adaptation: Boolean(args.allowAdaptation),
        fate_record: args.fateRecord || null,
        visibility: sharedVisibility,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      if (payload.source_story_id && payload.content_hash) {
        const [existing] = await supabaseRequest<any[]>('shared_stories', {
          query: {
            author_id: `eq.${authUser.uid}`,
            source_story_id: `eq.${payload.source_story_id}`,
            content_hash: `eq.${payload.content_hash}`,
            snapshot_kind: `eq.${payload.snapshot_kind}`,
            select: 'id,visibility',
            limit: 1,
          },
        });
        if (existing?.id) {
          if (payload.visibility !== existing.visibility) {
            await supabaseRequest('shared_stories', {
              method: 'PATCH',
              query: { id: `eq.${existing.id}`, author_id: `eq.${authUser.uid}` },
              body: { visibility: payload.visibility, updated_at: nowIso() },
            });
          }
          return res.status(200).json(existing.id);
        }
      }
      const [created] = await supabaseInsert<any[]>('shared_stories', [payload]);
      return res.status(200).json(created.id);
    }

    if (action === 'updateAuthorNameEverywhere') {
      await supabaseRequest('stories', { method: 'PATCH', query: { author_id: `eq.${authUser.uid}` }, body: { author_name: body.authorName || guestName(authUser.uid) } });
      await supabaseRequest('shared_stories', { method: 'PATCH', query: { author_id: `eq.${authUser.uid}` }, body: { author_name: body.authorName || guestName(authUser.uid), intervener_name: body.authorName || guestName(authUser.uid), updated_at: nowIso() } });
      await supabaseRequest('shared_stories', { method: 'PATCH', query: { original_author_id: `eq.${authUser.uid}` }, body: { original_author_name: body.authorName || guestName(authUser.uid), updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'createEmptyStory') {
      const args = body.args || {};
      const authorName = args.authorName || guestName(authUser.uid);
      const meta = storyRowFromMeta({
        title: args.title || '未命名作品',
        main_axis: '（请填写本作主轴/命题/世界观核心）',
        tags: asArray(args.tags),
        authorId: authUser.uid,
        authorName,
        visibility: 'private',
        averageChapterWords: 0,
        chapterCount: 7,
        allowAdaptation: false,
        endingMode: 'dual',
        endingRates: { left: 40, right: 40 },
        endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
        endingNames: { left: '', right: '' },
        characters: [
          { id: 'c1', name: '角色一', desc: '（待填写简介）' },
          { id: 'c2', name: '角色二', desc: '（待填写简介）' },
          { id: 'c3', name: '角色三', desc: '（待填写简介）' },
        ],
      });
      const { rows: createdRows } = await insertStoryRow(meta, 'createEmptyStory');
      const [created] = createdRows;
      const storyId = created.id;
      await supabaseUpsert('story_chapters', Array.from({ length: 7 }, (_, index) => ({
        story_id: storyId,
        chapter_num: index + 1,
        title: `第${index + 1}章`,
        summary: '',
        present_characters: [],
        text: '',
      })), 'story_id,chapter_num');
      await supabaseUpsert('story_endings', [
        { story_id: storyId, id: 'default', chapter_num: 7, title: '第七章', text: '' },
        { story_id: storyId, id: 'left', chapter_num: 7, title: '左结局', text: '' },
        { story_id: storyId, id: 'right', chapter_num: 7, title: '右结局', text: '' },
      ], 'story_id,id');
      return res.status(200).json(storyId);
    }

    if (action === 'adaptBlueprintToStory') {
      let adaptStage = 'prepare';
      const runAdaptStage = async <T,>(stage: string, task: () => Promise<T>) => {
        adaptStage = stage;
        try {
          return await task();
        } catch (error) {
          console.error('[story-store] adaptBlueprintToStory failed', {
            stage: adaptStage,
            message: error instanceof Error ? error.message : String(error),
          });
          throw new StoryStoreHttpError(
            500,
            'ADAPT_BLUEPRINT_FAILED',
            `一键改编失败（${adaptStage}）：${error instanceof Error ? error.message : String(error)}`
          );
        }
      };
      const args = body.args || {};
      const bp = args.blueprint || {};
      const chapters = asArray(args.chapters);
      const characters = asArray(bp.characters).slice(0, 5);
      const meta = storyRowFromMeta({
        title: bp.title || '从蓝图改编的作品',
        main_axis: bp.main_axis || '（无主轴记录）',
        tags: args.tags || bp.tags || [],
        authorId: authUser.uid,
        authorName: args.authorName || guestName(authUser.uid),
        visibility: 'private',
        averageChapterWords: calcAverageChapterWords(chapters),
        chapterCount: countReadyChapters(chapters),
        cardExcerpt: buildCardExcerpt(bp.main_axis, chapters),
        allowAdaptation: Boolean(bp.allowAdaptation),
        seriesId: bp.seriesContext?.id || args.seriesId || null,
        seriesRole: bp.continuityNode?.id || args.continuityNodeId ? 'sequel' : (bp.seriesContext?.id || args.seriesId ? 'main' : 'standalone'),
        continuityNodeId: bp.continuityNode?.id || args.continuityNodeId || null,
        seriesConstraints: {
          seriesTitle: bp.seriesContext?.title || '',
          baselineRuleIds: bp.seriesSelection?.baselineRuleIds || [],
          characterIds: bp.seriesSelection?.characterIds || [],
          selectedBaselineRules: bp.seriesContext?.selectedBaselineRules || [],
          selectedCharacterCards: bp.seriesContext?.selectedCharacterCards || [],
          ironLaws: bp.seriesContext?.ironLaws || [],
          continuityTitle: bp.continuityNode?.title || '',
          continuityNodeId: bp.continuityNode?.id || args.continuityNodeId || null,
          sourceStoryId: bp.continuityNode?.sourceStoryId || bp.seriesSelection?.sourceStoryId || args.sourceStoryId || null,
          sourceTitle: bp.continuityNode?.legacyState?.sourceTitle || '',
          endingId: bp.continuityNode?.endingId || bp.seriesSelection?.endingId || args.endingId || '',
          endingTitle: bp.continuityNode?.legacyState?.ending?.title || '',
          endingDomain: bp.continuityNode?.endingDomain || '',
          bridgeSummary: bp.continuityNode?.bridgeSummary || '',
          repairRules: bp.continuityNode?.repairRules || [],
          sequelSeedPrompt: bp.continuityNode?.sequelSeedPrompt || bp.seriesSelection?.hardSettings || '',
          previousStorySummary: bp.continuityNode?.legacyState?.chapterArc || [],
          previousCharacters: bp.continuityNode?.legacyState?.characters || [],
          requiredBranchIds: asArray(bp.continuityNode?.requiredBranchIds || bp.seriesSelection?.requiredBranchIds || args.requiredBranchIds),
          requiredBranches: asArray(bp.continuityNode?.legacyState?.branches).map((branch: any) => ({
            id: branch.id || '',
            name: branch.name || branch.title || branch.id || '',
            desc: branch.desc || branch.description || '',
          })),
        },
        endingMode: bp.endingMode === 'single' ? 'single' : 'dual',
        endingRates: { left: bp.left_mainline_default || 40, right: bp.right_mainline_default || 40 },
        endingBias: normalizeEndingBias(bp.endingBias || { left: bp.left_mainline_default, right: bp.right_mainline_default }),
        endingNames: { left: '', right: '' },
        characters: characters.length ? characters : [{ id: 'c1', name: '角色一', desc: '（待填写简介）' }],
        coverUrl: bp.coverUrl || '',
      });
      const { rows: createdRows, usedOptionalColumns } = await runAdaptStage('create-story', () => insertStoryRow(meta, 'adaptBlueprintToStory'));
      const [created] = createdRows;
      const storyId = created.id;
      if (usedOptionalColumns && meta.series_id) {
        await runAdaptStage('create-series-entry', () => supabaseUpsert('series_entries', [{
          series_id: meta.series_id,
          story_id: storyId,
          entry_order: meta.series_role === 'sequel' ? 2 : 1,
          entry_type: meta.series_role === 'standalone' ? 'main' : meta.series_role,
          timeline_label: meta.series_role === 'sequel' ? '续作' : '第一部',
          created_at: nowIso(),
        }], 'series_id,story_id')).catch((error) => {
          console.warn('[story-store] series entry create skipped', error);
        });
      }
      const chapterByNum = new Map(chapters.map((chapter) => [chapter.chapter_num, chapter]));
      const bpChapterByNum = new Map(asArray(bp.chapters).map((chapter) => [chapter.chapter_num, chapter]));
      await runAdaptStage('create-chapters', () => supabaseUpsert('story_chapters', Array.from({ length: 7 }, (_, index) => {
        const chapterNum = index + 1;
        const chapter: any = chapterByNum.get(chapterNum) || bpChapterByNum.get(chapterNum) || {};
        return {
          story_id: storyId,
          chapter_num: chapterNum,
          title: chapter.title || `第${chapterNum}章`,
          summary: chapter.summary || '',
          present_characters: asArray(chapter.present_characters),
          text: chapter.text || '',
        };
      }), 'story_id,chapter_num'));
      const defaultEndingText = chapterByNum.get(7)?.text || args.conclusionText || asArray(bp.endings).find((ending) => ending.type === 'normal')?.text || asArray(bp.endings)[0]?.text || '';
      const isSingleEnding = bp.endingMode === 'single';
      await runAdaptStage('create-endings', () => supabaseUpsert('story_endings', [
        { story_id: storyId, id: 'default', chapter_num: 7, title: chapterByNum.get(7)?.title || '第七章', text: defaultEndingText },
        { story_id: storyId, id: 'left', chapter_num: 7, title: '左结局', text: isSingleEnding ? defaultEndingText : asArray(bp.endings).find((ending) => ending.type === 'good' || ending.type === 'left')?.text || '' },
        { story_id: storyId, id: 'right', chapter_num: 7, title: '右结局', text: isSingleEnding ? defaultEndingText : asArray(bp.endings).find((ending) => ending.type === 'bad' || ending.type === 'right')?.text || '' },
      ], 'story_id,id'));
      const branches = asArray(bp.branches).map((branch) => ({
        story_id: storyId,
        side: branch.side === 'right' ? 'right' : 'left',
        tier: branch.score >= 5 ? 'large' : branch.score >= 3 ? 'large' : branch.score >= 2 ? 'medium' : 'small',
        name: branch.name || '未命名支线',
        hint: branch.hint || '',
        description: branch.desc || branch.sceneText || '',
        trigger: branch.trigger || { type: 'single', single: { chapterNum: 2, charId: characters[0]?.id || 'c1', action: 'bless' } },
        trigger_groups: branch.triggerGroups || (branch.trigger ? [branch.trigger] : []),
        common: false,
        inject: { ...(branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] }), hidden: Boolean(branch.is_hidden || branch.hidden || branch.score >= 5) },
        scene_text: branch.sceneText || branch.desc || '',
      }));
      if (branches.length) await runAdaptStage('create-branches', () => supabaseInsert('story_branches', branches));
      return res.status(200).json(storyId);
    }

    if (action === 'deleteSharedStoryRecord') {
      await supabaseRequest('shared_stories', { method: 'DELETE', query: { id: `eq.${body.sharedStoryId}`, author_id: `eq.${authUser.uid}` } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'updateSharedStoryVisibility') {
      const visibility = body.visibility === 'private' ? 'private' : 'unlisted';
      await supabaseRequest('shared_stories', { method: 'PATCH', query: { id: `eq.${body.sharedStoryId}`, author_id: `eq.${authUser.uid}` }, body: { visibility, updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveStoryMeta') {
      await requireStoryOwner(body.storyId, authUser.uid);
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: storyRowFromMeta({ ...body.patch, authorId: authUser.uid }, body.storyId) });
      if (body.patch?.visibility === 'public' || body.patch?.visibility === 'unlisted') {
        await notifyAuthorFollowers(authUser.uid, {
          type: 'author_story_updated',
          title: '追踪作者更新了作品',
          body: `《${body.patch?.title || '未命名作品'}》刚刚更新了。`,
          storyId: body.storyId,
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveStoryChapter') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const patch = body.patch || {};
      await supabaseUpsert('story_chapters', [{
        story_id: body.storyId,
        chapter_num: body.chapterNum,
        title: patch.title || '',
        summary: patch.summary || '',
        present_characters: asArray(patch.present_characters),
        text: patch.text || '',
      }], 'story_id,chapter_num');
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveStoryEnding') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const patch = body.patch || {};
      await supabaseUpsert('story_endings', [{
        story_id: body.storyId,
        id: body.endingId,
        chapter_num: 7,
        title: patch.title || '',
        text: patch.text || '',
        key_nodes: asArray(patch.keyNodes),
      }], 'story_id,id');
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'saveStoryMainlineBundle') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const args = body.args || {};
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { ...storyRowFromMeta({ ...args.metaPatch, authorId: authUser.uid }, body.storyId), updated_at: nowIso() } });
      await supabaseUpsert('story_chapters', asArray(args.chapters).map((chapter) => ({ story_id: body.storyId, chapter_num: chapter.chapter_num, title: chapter.title || '', summary: chapter.summary || '', present_characters: asArray(chapter.present_characters), text: chapter.text || '' })), 'story_id,chapter_num');
      await supabaseUpsert('story_endings', asArray(args.endings).map((ending) => ({ story_id: body.storyId, id: ending.id, chapter_num: 7, title: ending.title || '', text: ending.text || '' })), 'story_id,id');
      if (args.metaPatch?.visibility === 'public' || args.metaPatch?.visibility === 'unlisted') {
        await notifyAuthorFollowers(authUser.uid, {
          type: 'author_story_updated',
          title: '追踪作者更新了作品',
          body: `《${args.metaPatch?.title || '未命名作品'}》刚刚更新了。`,
          storyId: body.storyId,
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteStoryCartridge') {
      if (!ADMIN_USER_IDS.has(authUser.uid)) {
        await requireStoryOwner(body.storyId, authUser.uid);
      }
      await supabaseRequest('stories', { method: 'DELETE', query: { id: `eq.${body.storyId}` } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'upsertStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const branch = body.branch || {};
      const isHidden = Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden);
      const tier = branch.tier === 'large' ? 'large' : branch.tier === 'medium' ? 'medium' : 'small';
      await supabaseUpsert('story_branches', [{
        id: body.branchId,
        story_id: body.storyId,
        side: branch.side || 'left',
        tier,
        name: branch.name || '',
        hint: branch.hint || '',
        description: branch.desc || '',
        trigger: branch.trigger || {},
        trigger_groups: asArray(branch.triggerGroups),
        common: Boolean(branch.common),
        inject: { ...(branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] }), hidden: isHidden },
        scene_text: branch.sceneText || '',
        updated_at: nowIso(),
      }], 'id');
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'createStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const branch = body.branch || {};
      const isHidden = Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden);
      const tier = branch.tier === 'large' ? 'large' : branch.tier === 'medium' ? 'medium' : 'small';
      const [created] = await supabaseInsert<any[]>('story_branches', [{
        story_id: body.storyId,
        side: branch.side || 'left',
        tier,
        name: branch.name || '',
        hint: branch.hint || '',
        description: branch.desc || '',
        trigger: branch.trigger || {},
        trigger_groups: asArray(branch.triggerGroups),
        common: Boolean(branch.common),
        inject: { ...(branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] }), hidden: isHidden },
        scene_text: branch.sceneText || '',
      }]);
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { updated_at: nowIso() } });
      return res.status(200).json(created.id);
    }

    if (action === 'deleteStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      await supabaseRequest('story_branches', { method: 'DELETE', query: { id: `eq.${body.branchId}`, story_id: `eq.${body.storyId}` } });
      await supabaseRequest('stories', { method: 'PATCH', query: { id: `eq.${body.storyId}` }, body: { updated_at: nowIso() } });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({
      code: 'UNSUPPORTED_ACTION',
      requestId: logContext.requestId,
      error: `Unsupported story-store action: ${action}`,
    });
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    if (error instanceof StoryStoreHttpError) {
      return res.status(error.status).json({
        code: error.code,
        requestId: logContext.requestId,
        error: error.message,
      });
    }
    return sendInternalError(res, 'story-store failed', error, {
      code: 'STORY_STORE_FAILED',
      requestId: logContext.requestId,
    });
  }
}
