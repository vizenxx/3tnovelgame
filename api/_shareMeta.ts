const DEFAULT_TITLE = '命运干涉｜可分享、可改写的互动故事引擎';
const DEFAULT_DESCRIPTION = '阅读别人分享的故事记录，或把时间线带回命运干涉，亲自改写新的结局。';

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

const getEnv = (name: string) => process.env[name] || '';

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

function fieldToString(field?: FirestoreValue) {
  if (!field) return '';
  if (typeof field.stringValue === 'string') return field.stringValue;
  if (typeof field.integerValue === 'string') return field.integerValue;
  if (typeof field.doubleValue === 'number') return String(field.doubleValue);
  if (typeof field.booleanValue === 'boolean') return String(field.booleanValue);
  return '';
}

function fieldToTextArray(field?: FirestoreValue) {
  const values = field?.arrayValue?.values || [];
  return values.map((item) => fieldToString(item)).filter(Boolean);
}

function firstChapterExcerpt(field?: FirestoreValue) {
  const chapters = field?.arrayValue?.values || [];
  for (const chapter of chapters) {
    const text = fieldToString(chapter.mapValue?.fields?.text).replace(/\s+/g, ' ').trim();
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
  const projectId = getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID');
  const apiKey = getEnv('VITE_FIREBASE_API_KEY') || getEnv('FIREBASE_API_KEY');
  const databaseId = getEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || getEnv('FIRESTORE_DATABASE_ID') || '(default)';
  if (!projectId || !apiKey || !shareId) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/sharedStories/${encodeURIComponent(shareId)}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const fields = data?.fields || {};
  const visibility = fieldToString(fields.visibility) || 'private';
  if (visibility !== 'public') return null;

  const rawTitle = fieldToString(fields.title) || DEFAULT_TITLE;
  const title = rawTitle.replace(/[《》]/g, '').trim() || DEFAULT_TITLE;
  const excerpt = firstChapterExcerpt(fields.chapters);
  const tags = fieldToTextArray(fields.tags);
  const description = excerpt || fieldToString(fields.main_axis) || (tags.length ? `一段关于${tags.slice(0, 3).join('、')}的命运记录。` : DEFAULT_DESCRIPTION);

  return {
    id: shareId,
    title: `《${title}》｜命运干涉`,
    description,
    coverUrl: fieldToString(fields.coverUrl),
    visibility,
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
