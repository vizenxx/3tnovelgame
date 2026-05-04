export type StoryHashChapter = {
  chapter_num?: number;
  title?: string;
  summary?: string;
  text?: string;
};

export const normalizeStoryChaptersForHash = (chapters?: StoryHashChapter[]) => (
  (chapters || [])
    .map((chapter) => ({
      chapter_num: Number(chapter?.chapter_num || 0),
      title: String(chapter?.title || '').trim(),
      summary: String(chapter?.summary || '').trim(),
      text: String(chapter?.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((chapter) => chapter.chapter_num >= 1 && chapter.chapter_num <= 7)
    .sort((a, b) => a.chapter_num - b.chapter_num)
);

export const hashStoryChapters = (chapters?: StoryHashChapter[]) => {
  const value = JSON.stringify(normalizeStoryChaptersForHash(chapters));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const areStoryChaptersEquivalent = (
  a?: StoryHashChapter[],
  b?: StoryHashChapter[]
) => hashStoryChapters(a) === hashStoryChapters(b);
