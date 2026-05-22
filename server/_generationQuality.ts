type ProseQualityOptions = {
  label: string;
  targetWordCount?: number;
  minRatio?: number;
  minUnits?: number;
  minParagraphs?: number;
};

export function countProseUnits(text: string) {
  const value = String(text || '').trim();
  const cjkCount = value.match(/[\u3400-\u9fff]/g)?.length || 0;
  const nonCjkWords = value
    .replace(/[\u3400-\u9fff]/g, ' ')
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
  return cjkCount + nonCjkWords;
}

export function countParagraphs(text: string) {
  return String(text || '')
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

export function assertProseQuality(text: string, options: ProseQualityOptions) {
  const clean = String(text || '').trim();
  if (!clean) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} is empty.`);
  }

  if (/<\s*\/?\s*mark|&lt;\s*\/?\s*mark|```|<\/?(?:span|strong|em|b|i)>/i.test(clean)) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} contains markup.`);
  }

  if (/^(前情摘要|继承前情|系统摘要|剧情提纲|大纲|Inherited context|Recap|Outline)\s*[:：]/i.test(clean)) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} looks like notes instead of prose.`);
  }

  const targetWordCount = Math.max(0, Number(options.targetWordCount) || 0);
  const ratioFloor = Math.floor(targetWordCount * (options.minRatio ?? 0.45));
  const minUnits = Math.max(options.minUnits ?? 0, ratioFloor);
  const units = countProseUnits(clean);
  if (minUnits > 0 && units < minUnits) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} is too short (${units}/${minUnits}).`);
  }

  const minParagraphs = options.minParagraphs ?? 0;
  const paragraphs = countParagraphs(clean);
  if (minParagraphs > 0 && paragraphs < minParagraphs) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} has too few paragraphs (${paragraphs}/${minParagraphs}).`);
  }
}
