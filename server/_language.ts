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
      'ENGLISH PRODUCT LOCALIZATION RULES:',
      'Do not merely translate Chinese wuxia/xianxia/命运 terminology unless the requested premise explicitly asks for it.',
      'Prefer idiomatic English genre language, natural character names, readable chapter titles, and culturally familiar pacing for English-language interactive fiction.',
      'Avoid Chinese punctuation styles, Chinese book-title brackets, and literal phrases such as “left ending domain” in prose; use natural English story terms instead.',
      'If the input contains Chinese tags, reinterpret them into equivalent English genre concepts before writing.',
    ].join('\n');
  }
  return [
    '输出语言硬约束：',
    '所有面向读者的生成内容都必须使用自然、流畅的简体中文。',
    'JSON 字段名保持原要求不变，只调整字段值的语言。',
  ].join('\n');
}
