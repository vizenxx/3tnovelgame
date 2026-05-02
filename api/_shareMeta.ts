const DEFAULT_TITLE = '命运干涉｜可分享、可改写的互动故事引擎';
const DEFAULT_DESCRIPTION = '阅读别人分享的故事记录，或把时间线带回命运干涉，亲自改写新的结局。';

const getEnv = (name: string) => process.env[name] || '';
const getSupabaseKey = () => getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');

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

function firstJsonChapterExcerpt(chapters: any[]) {
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const text = String(chapter?.text || '').replace(/\s+/g, ' ').trim();
    if (text.length > 40) {
      return `${text.slice(0, 120)}${text.length > 120 ? '...' : ''}`;
    }
  }
  return '';
}

export type SharedStoryMeta = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  visibility: string;
};

export async function fetchSharedStoryMeta(shareId: string): Promise<SharedStoryMeta | null> {
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
  if (row?.visibility !== 'public') return null;

  const rawTitle = String(row.title || DEFAULT_TITLE);
  const title = rawTitle.replace(/[《》]/g, '').trim() || DEFAULT_TITLE;
  const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean) : [];
  const excerpt = firstJsonChapterExcerpt(row.chapters);
  const description = excerpt || String(row.main_axis || '') || (tags.length ? `一段关于${tags.slice(0, 3).join('、')}的命运记录。` : DEFAULT_DESCRIPTION);

  return {
    id: shareId,
    title: `《${title}》｜命运干涉`,
    description,
    coverUrl: String(row.cover_url || ''),
    visibility: row.visibility,
  };
}

export async function fetchOriginalStoryMeta(storyId: string): Promise<SharedStoryMeta | null> {
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

  const rawTitle = String(row.title || DEFAULT_TITLE);
  const title = rawTitle.replace(/[ã€Šã€‹]/g, '').trim() || DEFAULT_TITLE;
  const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean) : [];
  const description = String(row.card_excerpt || row.main_axis || '') || (tags.length ? `一段关于${tags.slice(0, 3).join('、')}的命运记录。` : DEFAULT_DESCRIPTION);

  return {
    id: storyId,
    title: `《${title}》｜命运干涉`,
    description,
    coverUrl: String(row.cover_url || ''),
    visibility: row.visibility,
  };
}

export function defaultShareMeta(shareId: string): SharedStoryMeta {
  return {
    id: shareId,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    coverUrl: '',
    visibility: 'public',
  };
}
