export function ensureParagraphing(raw: string, opts?: { minParas?: number; maxParas?: number }) {
  const minParas = opts?.minParas ?? 6;
  const maxParas = opts?.maxParas ?? 10;
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return text;

  text = text.replace(/\n{3,}/g, '\n\n');

  if (!text.includes('\n\n')) {
    const sentences = text
      .split(/(?<=[。！？!?…])\s*/g)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const targetParas = Math.min(maxParas, Math.max(minParas, Math.ceil((sentences.length || 1) / 3)));
    const chunks: string[] = [];
    const perChunk = Math.max(1, Math.ceil(sentences.length / targetParas));
    for (let index = 0; index < sentences.length; index += perChunk) {
      chunks.push(sentences.slice(index, index + perChunk).join(''));
    }
    text = chunks.join('\n\n');
  }

  let paragraphs = text.split(/\n{2,}/g).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length < minParas) {
    const expanded: string[] = [];
    for (const paragraph of paragraphs) {
      if (expanded.length >= minParas) {
        expanded.push(paragraph);
      } else if (paragraph.length > 220) {
        const midpoint = Math.floor(paragraph.length / 2);
        expanded.push(paragraph.slice(0, midpoint).trim(), paragraph.slice(midpoint).trim());
      } else {
        expanded.push(paragraph);
      }
    }
    paragraphs = expanded.filter(Boolean);
  }

  if (paragraphs.length > maxParas) {
    const merged: string[] = [];
    const perChunk = Math.ceil(paragraphs.length / maxParas);
    for (let index = 0; index < paragraphs.length; index += perChunk) {
      merged.push(paragraphs.slice(index, index + perChunk).join('\n'));
    }
    paragraphs = merged;
  }

  return paragraphs.join('\n\n').trim();
}

type ProseQualityOptions = {
  label: string;
  targetWordCount?: number;
  minRatio?: number;
  minUnits?: number;
  maxRatio?: number;
  maxUnits?: number;
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
  const maxUnits = Math.max(options.maxUnits ?? 0, targetWordCount > 0 ? Math.ceil(targetWordCount * (options.maxRatio ?? 0)) : 0);
  if (maxUnits > 0 && units > maxUnits) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} is too long (${units}/${maxUnits}).`);
  }

  const minParagraphs = options.minParagraphs ?? 0;
  const paragraphs = countParagraphs(clean);
  if (minParagraphs > 0 && paragraphs < minParagraphs) {
    throw new Error(`AI_RESPONSE_INVALID: ${options.label} has too few paragraphs (${paragraphs}/${minParagraphs}).`);
  }
}
