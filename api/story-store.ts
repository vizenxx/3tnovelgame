import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken, sendInternalError, sendMethodNotAllowed, verifyFirebaseToken } from './_auth.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from './_log.js';
import { supabaseInsert, supabaseRequest, supabaseRpc, supabaseUpsert } from './_supabase.js';
import { isStoryStoreAction } from './storyStoreContract.js';
import { normalizeEndingBias } from '../src/storyCartridge.js';

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
  'report_count',
  'average_chapter_words',
  'chapter_count',
  'card_excerpt',
  'allow_adaptation',
  'updated_at',
  'created_at',
  'version',
].join(',');
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
    tags: row.tags || [],
    visibility: row.visibility,
    authorId: row.author_id,
    authorName: row.author_name,
    coverUrl: row.cover_url,
    popularity: row.popularity,
    likeCount: row.like_count,
    interventionCount: row.intervention_count,
    favoriteCount: row.favorite_count,
    reportCount: row.report_count,
    averageChapterWords: row.average_chapter_words,
    chapterCount: row.chapter_count,
    cardExcerpt: row.card_excerpt,
    allowAdaptation: row.allow_adaptation,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    version: row.version,
  };
}

function storyMeta(row: any) {
  const endingRates = row.ending_rates || { left: 40, right: 40 };
  return {
    ...storyListItem(row),
    main_axis: row.main_axis,
    characters: row.characters || [],
    endingMode: row.ending_mode,
    endingRates,
    endingBias: normalizeEndingBias(endingRates),
    endingNames: row.ending_names || {},
    defaults: row.defaults || { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
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
    tags: row.tags || [],
    characters: row.characters || [],
    chapters: row.chapters || [],
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    visibility: row.visibility,
  };
}

function storyRowFromMeta(meta: any, id?: string) {
  const updatedAt = nowIso();
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
    report_count: asInt(meta.reportCount),
    average_chapter_words: asInt(meta.averageChapterWords),
    chapter_count: asInt(meta.chapterCount),
    card_excerpt: meta.cardExcerpt || '',
    allow_adaptation: Boolean(meta.allowAdaptation),
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

async function optionalUser(req: VercelRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  return verifyFirebaseToken(token);
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
        tier: branch.tier,
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
      tier: branch.tier,
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

    if (action === 'listPublicStories') {
      const rows = await supabaseRequest<any[]>('stories', { query: { visibility: 'eq.public', select: STORY_CARD_SELECT, order: 'updated_at.desc', limit: body.pageSize || 20 } });
      return res.status(200).json(rows.map(storyListItem));
    }

    if (action === 'listMyStories') {
      const authUser = await requireUser(req, res);
      if (!authUser) return;
      const rows = await supabaseRequest<any[]>('stories', { query: { author_id: `eq.${authUser.uid}`, select: STORY_CARD_SELECT, order: 'updated_at.desc', limit: body.pageSize || 50 } });
      return res.status(200).json(rows.map(storyListItem));
    }

    if (action === 'listMySharedStories') {
      const authUser = await requireUser(req, res);
      if (!authUser) return;
      const rows = await supabaseRequest<any[]>('shared_stories', { query: { author_id: `eq.${authUser.uid}`, select: SHARED_CARD_SELECT, order: 'updated_at.desc', limit: body.pageSize || 50 } });
      const favoriteRows = await supabaseRequest<any[]>('story_favorites', { query: { user_id: `eq.${authUser.uid}`, select: 'story_id,created_at', order: 'created_at.desc', limit: body.pageSize || 50 } });
      const favoriteIds = favoriteRows.map((row) => String(row.story_id || '')).filter(Boolean);
      const favoriteStories = favoriteIds.length
        ? await supabaseRequest<any[]>('stories', { query: { id: `in.(${favoriteIds.join(',')})`, select: STORY_CARD_SELECT } })
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
      return res.status(200).json(Array.from(deduped.values()));
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

    if (action === 'likeStory') {
      return res.status(200).json(await supabaseRpc('like_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid }));
    }

    if (action === 'favoriteStory') {
      return res.status(200).json(await supabaseRpc('favorite_story_once', { p_story_id: body.storyId, p_user_id: authUser.uid }));
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
      await supabaseRequest('stories', { method: 'PATCH', query: { author_id: `eq.${authUser.uid}` }, body: { author_name: body.authorName || guestName(authUser.uid), updated_at: nowIso() } });
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
        endingBias: { leftBaseWeight: 1, rightBaseWeight: 1 },
        endingNames: { left: '', right: '' },
        characters: [
          { id: 'c1', name: '角色一', desc: '（待填写简介）' },
          { id: 'c2', name: '角色二', desc: '（待填写简介）' },
          { id: 'c3', name: '角色三', desc: '（待填写简介）' },
        ],
      });
      const [created] = await supabaseInsert<any[]>('stories', [meta]);
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
        endingMode: bp.endingMode === 'single' ? 'single' : 'dual',
        endingRates: { left: bp.left_mainline_default || 40, right: bp.right_mainline_default || 40 },
        endingBias: normalizeEndingBias(bp.endingBias || { left: bp.left_mainline_default, right: bp.right_mainline_default }),
        endingNames: { left: '', right: '' },
        characters: characters.length ? characters : [{ id: 'c1', name: '角色一', desc: '（待填写简介）' }],
        coverUrl: bp.coverUrl || '',
      });
      const [created] = await supabaseInsert<any[]>('stories', [meta]);
      const storyId = created.id;
      const chapterByNum = new Map(chapters.map((chapter) => [chapter.chapter_num, chapter]));
      const bpChapterByNum = new Map(asArray(bp.chapters).map((chapter) => [chapter.chapter_num, chapter]));
      await supabaseUpsert('story_chapters', Array.from({ length: 7 }, (_, index) => {
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
      }), 'story_id,chapter_num');
      const defaultEndingText = chapterByNum.get(7)?.text || args.conclusionText || asArray(bp.endings).find((ending) => ending.type === 'normal')?.text || asArray(bp.endings)[0]?.text || '';
      const isSingleEnding = bp.endingMode === 'single';
      await supabaseUpsert('story_endings', [
        { story_id: storyId, id: 'default', chapter_num: 7, title: chapterByNum.get(7)?.title || '第七章', text: defaultEndingText },
        { story_id: storyId, id: 'left', chapter_num: 7, title: '左结局', text: isSingleEnding ? defaultEndingText : asArray(bp.endings).find((ending) => ending.type === 'good' || ending.type === 'left')?.text || '' },
        { story_id: storyId, id: 'right', chapter_num: 7, title: '右结局', text: isSingleEnding ? defaultEndingText : asArray(bp.endings).find((ending) => ending.type === 'bad' || ending.type === 'right')?.text || '' },
      ], 'story_id,id');
      const branches = asArray(bp.branches).map((branch) => ({
        story_id: storyId,
        side: branch.side === 'right' ? 'right' : 'left',
        tier: branch.score >= 5 ? 'hidden' : branch.score >= 3 ? 'large' : branch.score >= 2 ? 'medium' : 'small',
        name: branch.name || '未命名支线',
        hint: branch.hint || '',
        description: branch.desc || branch.sceneText || '',
        trigger: branch.trigger || { type: 'single', single: { chapterNum: 2, charId: characters[0]?.id || 'c1', action: 'bless' } },
        trigger_groups: branch.triggerGroups || (branch.trigger ? [branch.trigger] : []),
        common: false,
        inject: branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] },
        scene_text: branch.sceneText || branch.desc || '',
      }));
      if (branches.length) await supabaseInsert('story_branches', branches);
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
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteStoryCartridge') {
      await requireStoryOwner(body.storyId, authUser.uid);
      await supabaseRequest('stories', { method: 'DELETE', query: { id: `eq.${body.storyId}` } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'upsertStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const branch = body.branch || {};
      await supabaseUpsert('story_branches', [{
        id: body.branchId,
        story_id: body.storyId,
        side: branch.side || 'left',
        tier: branch.tier || 'small',
        name: branch.name || '',
        hint: branch.hint || '',
        description: branch.desc || '',
        trigger: branch.trigger || {},
        trigger_groups: asArray(branch.triggerGroups),
        common: Boolean(branch.common),
        inject: branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] },
        scene_text: branch.sceneText || '',
        updated_at: nowIso(),
      }], 'id');
      return res.status(200).json({ ok: true });
    }

    if (action === 'createStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      const branch = body.branch || {};
      const [created] = await supabaseInsert<any[]>('story_branches', [{
        story_id: body.storyId,
        side: branch.side || 'left',
        tier: branch.tier || 'small',
        name: branch.name || '',
        hint: branch.hint || '',
        description: branch.desc || '',
        trigger: branch.trigger || {},
        trigger_groups: asArray(branch.triggerGroups),
        common: Boolean(branch.common),
        inject: branch.inject || { mustHappen: [], mustReveal: [], mustChange: [] },
        scene_text: branch.sceneText || '',
      }]);
      return res.status(200).json(created.id);
    }

    if (action === 'deleteStoryBranch') {
      await requireStoryOwner(body.storyId, authUser.uid);
      await supabaseRequest('story_branches', { method: 'DELETE', query: { id: `eq.${body.branchId}`, story_id: `eq.${body.storyId}` } });
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
