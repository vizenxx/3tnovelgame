export type GenerationLanguage = 'zh-CN' | 'en-US';

export function normalizeGenerationLanguage(value?: unknown): GenerationLanguage {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return String(rawValue || '').toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

export function generationLanguageInstruction(language: GenerationLanguage) {
  if (language === 'en-US') {
    return [
      'OUTPUT LANGUAGE HARD RULE:',
      'Write all user-facing generated content in natural English.',
      'This includes titles, chapter summaries, prose, character descriptions, branch names, status updates, and final summaries.',
      'Keep JSON keys exactly as requested; only translate the values.',
      'OUTPUT CLEANLINESS HARD RULE:',
      'Generated values must be plain text only. Never put HTML, XML, Markdown, code fences, <mark>, span tags, highlight tags, or any annotation markers inside titles, summaries, prose, endings, hints, or quotes.',
      'If something needs highlighting, return it only through the requested structured JSON field such as change_highlights.quote, and keep the prose itself unmarked.',
      'ENGLISH PRODUCT LOCALIZATION RULES:',
      'Do not merely translate Chinese wuxia/xianxia/fate terminology unless the requested premise explicitly asks for it.',
      'Prefer idiomatic English genre language, natural character names, readable chapter titles, and culturally familiar pacing for English-language interactive fiction.',
      'Avoid Chinese punctuation styles, Chinese book-title brackets, and literal phrases such as “left ending domain” in prose; use natural English story terms instead.',
      'If the input contains Chinese tags, reinterpret them into equivalent English genre concepts before writing.',
    ].join('\n');
  }

  return [
    '输出语言硬约束：',
    '所有面向读者的生成内容都必须使用自然、流畅的简体中文。',
    'JSON 字段名保持原要求不变，只调整字段值的语言。',
    '输出洁净硬约束：',
    '所有生成字段值都必须是纯文本。严禁在标题、摘要、正文、结局、提示、摘录中写入 HTML、XML、Markdown、代码块、<mark>、span 标签、高亮标签或任何标注用编码。',
    '如果需要标记变化，只能通过指定的结构化 JSON 字段输出，例如 change_highlights.quote；故事正文自身必须永远保持无标记。',
  ].join('\n');
}
