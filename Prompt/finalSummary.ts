export function buildFinalSummaryPrompt(args: { blueprint: any; safeChapters: any[]; endingValue: number }) {
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
