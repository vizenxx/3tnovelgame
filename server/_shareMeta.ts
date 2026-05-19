import { normalizeGenerationLanguage, type GenerationLanguage } from './_language.js';

const DEFAULT_META = {
  'zh-CN': {
    title: '命运干涉｜可分享、可改写的互动故事引擎',
    description: '阅读别人分享的故事记录，或把时间线带回命运干涉，亲自改写新的结局。',
    suffix: '命运干涉',
    tagPrefix: '一段关于',
    tagSuffix: '的命运记录。',
  },
  'en-US': {
    title: 'Fate Interference | Shareable interactive story engine',
    description: 'Read a shared fate line, or bring the timeline back into Fate Interference and reshape the ending.',
    suffix: 'Fate Interference',
    tagPrefix: 'A fate record about ',
    tagSuffix: '.',
  },
} satisfies Record<GenerationLanguage, Record<string, string>>;

const getEnv = (name: string) => process.env[name] || '';
const getSupabaseKey = () => getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');
const metaFor = (language?: string | null) => DEFAULT_META[normalizeGenerationLanguage(language)];

export function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getShareId(input: unknown) {
  const value = Array.isArray(input) ? input[0] : input;
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

function stripBookTitle(value: string) {
  return String(value || '').replace(/[《》]/g, '').trim();
}

function firstJsonChapterExcerpt(chapters: any[]) {
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const text = String(chapter?.text || '').replace(/\s+/g, ' ').trim();
    if (text.length > 40) {
      return `${text.slice(0, 120)}${text.length > 120 ? '...' : ''}`;
    }
  }
  return '';
}

function tagDescription(tags: string[], language: GenerationLanguage) {
  const meta = DEFAULT_META[language];
  if (!tags.length) return meta.description;
  const separator = language === 'en-US' ? ', ' : '、';
  return `${meta.tagPrefix}${tags.slice(0, 3).join(separator)}${meta.tagSuffix}`;
}

function formatShareTitle(rawTitle: string, language: GenerationLanguage) {
  const meta = DEFAULT_META[language];
  const title = stripBookTitle(rawTitle) || meta.title;
  return `《${title}》｜${meta.suffix}`;
}

export type SharedStoryMeta = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  visibility: string;
};

export async function fetchSharedStoryMeta(
  shareId: string,
  language: GenerationLanguage = 'zh-CN'
): Promise<SharedStoryMeta | null> {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const supabaseKey = getSupabaseKey();
  if (!supabaseUrl || !supabaseKey || !shareId) return null;

  const url = `${supabaseUrl}/rest/v1/shared_stories?id=eq.${encodeURIComponent(shareId)}&select=id,title,main_axis,tags,chapters,cover_url,visibility&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) return null;

  const rows = await response.json();
  const row = rows?.[0];
  if (row?.visibility !== 'unlisted') return null;

  const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean) : [];
  const excerpt = firstJsonChapterExcerpt(row.chapters);
  const description = excerpt || String(row.main_axis || '') || tagDescription(tags, language);

  return {
    id: shareId,
    title: formatShareTitle(row.title, language),
    description,
    coverUrl: String(row.cover_url || ''),
    visibility: row.visibility,
  };
}

export async function fetchOriginalStoryMeta(
  storyId: string,
  language: GenerationLanguage = 'zh-CN'
): Promise<SharedStoryMeta | null> {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const supabaseKey = getSupabaseKey();
  if (!supabaseUrl || !supabaseKey || !storyId) return null;

  const url = `${supabaseUrl}/rest/v1/stories?id=eq.${encodeURIComponent(storyId)}&visibility=in.(public,unlisted)&select=id,title,main_axis,tags,card_excerpt,cover_url,visibility&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) return null;

  const rows = await response.json();
  const row = rows?.[0];
  if (!row) return null;

  const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean) : [];
  const description = String(row.card_excerpt || row.main_axis || '') || tagDescription(tags, language);

  return {
    id: storyId,
    title: formatShareTitle(row.title, language),
    description,
    coverUrl: String(row.cover_url || ''),
    visibility: row.visibility,
  };
}

export function defaultShareMeta(shareId: string, language: GenerationLanguage = 'zh-CN'): SharedStoryMeta {
  const meta = metaFor(language);
  return {
    id: shareId,
    title: meta.title,
    description: meta.description,
    coverUrl: '',
    visibility: 'unlisted',
  };
}
