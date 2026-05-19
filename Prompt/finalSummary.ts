export function buildFinalSummaryPrompt(args: { blueprint: any; safeChapters: any[]; endingValue: number; language?: 'zh-CN' | 'en-US' | string }) {
  if (args.language === 'en-US') {
    return `You are a chronicler of English-language interactive fiction.
Story premise: ${args.blueprint.main_axis}
Chapter history: ${args.safeChapters.map((chapter: any) => `
--- Chapter ${chapter.chapter_num}: ${chapter.title} ---
Plot summary: ${chapter.summary}
Excerpt: ${String(chapter.text || '').substring(0, 500)}
`).join('\n')}

Final fate balance: ${Number(args.endingValue) || 0}

Task: Write one poetic closing line for this adventure.

Requirements:
1. Write only one sentence or one short phrase.
2. Keep it around 8-18 English words.
3. It must express whether the story ends in order, chaos, or balance without using app UI jargon.`;
  }
  return `你是一个互动小说编年史家。
小说主轴：${args.blueprint.main_axis}
章节历史：${args.safeChapters.map((chapter: any) => `
--- 第${chapter.chapter_num}章：${chapter.title} ---
情节摘要：${chapter.summary}
正文片段：${String(chapter.text || '').substring(0, 500)}
`).join('\n')}

最终命运天平：${Number(args.endingValue) || 0}

任务：为这段史诗般的冒险撰写一句如诗般的结语。

要求：
1. 只写一句话或一句短语。
2. 长度控制在 15-30 字左右。
3. 必须能体现秩序、混沌或平衡的最终归宿。`;
}
