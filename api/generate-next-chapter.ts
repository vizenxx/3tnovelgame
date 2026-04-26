import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

function getNarrativePersonInstruction(value: unknown) {
  const key = String(value || 'third');
  if (key === 'first') {
    return '第一人称硬约束：全文必须以“我/我们”的叙事视角书写，所有心理、见闻与行动都必须从该叙述者视角自然展开；严禁在本章或后续章节突然切换成第三人称旁白。';
  }
  if (key === 'second') {
    return '第二人称硬约束：全文必须以“你”的沉浸式叙事视角书写；严禁在本章或后续章节突然切换成第一人称或第三人称。';
  }
  return '第三人称硬约束：全文必须以“他/她/他们/角色姓名”的第三人称叙事视角书写；严禁突然切换成“我”的第一人称自述。';
}

function ensureParagraphing(raw: string, opts?: { minParas?: number; maxParas?: number }) {
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

const chapterSchema = {
  type: Type.OBJECT,
  properties: {
    chapter_num: { type: Type.INTEGER },
    text: { type: Type.STRING },
    present_characters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['chapter_num', 'text', 'present_characters'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { blueprint, currentChapters, chapters: chaptersBody, targetChapterNum, targetWordCount, worldState, narrativePerson } = req.body || {};
    const safeTargetChapterNum = Math.min(7, Math.max(1, Number(targetChapterNum) || 1));
    const safeTargetWordCount = Math.min(1200, Math.max(400, Number(targetWordCount) || 400));
    const allChapters: any[] = Array.isArray(chaptersBody) && chaptersBody.length
      ? chaptersBody.slice(0, 7)
      : (Array.isArray(currentChapters) ? currentChapters.slice(0, 7) : []);

    if (!blueprint || typeof blueprint.main_axis !== 'string' || !Array.isArray(blueprint.characters)) {
      return res.status(400).json({ error: '蓝图参数不合法。' });
    }

    const historyChapters = allChapters.filter((chapter: any) => chapter?.text && String(chapter.text).trim().length > 0);
    const blueprintChapter = blueprint?.chapters?.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum);
    const liveChapter = allChapters.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum);
    const outlineSummary = (liveChapter?.summary && String(liveChapter.summary).trim())
      ? String(liveChapter.summary).trim()
      : (blueprintChapter?.summary || '');
    const futureOutlines = allChapters
      .filter((chapter: any) => chapter.chapter_num > safeTargetChapterNum && chapter.summary && String(chapter.summary).trim())
      .map((chapter: any) => `第${chapter.chapter_num}章要点：${String(chapter.summary).trim()}`)
      .join('\n');

    const defaultText = blueprint?.authorAssets?.defaultChapters?.[safeTargetChapterNum]?.text;
    const endingProto = blueprint?.authorAssets?.endingPrototypes;
    const prevChapterText = allChapters.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum - 1)?.text || '';

    let worldStatePrompt = '';
    if (worldState && worldState.canonical) {
      worldStatePrompt = `故事基准（硬约束，不可违背）：
人物：${JSON.stringify(worldState.canonical.characters || [])}
物件：${JSON.stringify(worldState.canonical.objects || [])}
场景：${JSON.stringify(worldState.canonical.scenes || [])}
核心规则：${(worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((worldState.deltaWeight || 0) * 100)}%）：
${(worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${worldState.endingDirection || 'neutral'}
${worldState.endingDirection && worldState.endingDirection !== 'neutral' && endingProto ? `结局原型参考：\n${String(endingProto[worldState.endingDirection] || '').substring(0, 400)}` : ''}

直接前文（第 ${safeTargetChapterNum - 1} 章，文风锚点）：
${String(prevChapterText).substring(0, 400)}`;
    } else {
      worldStatePrompt = `历史剧情回忆：${historyChapters.map((chapter: any) => `[${chapter.chapter_num}] ${String(chapter.text || '').substring(0, 200)}...`).join('\n')}`;
    }

    const prompt = `你是一个互动小说引擎的织梦者。
小说大纲/主轴：${blueprint.main_axis}
叙事人称：${getNarrativePersonInstruction(narrativePerson || blueprint.narrative_person)}
角色列表：${blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
${worldStatePrompt}
当前章节大纲指引：${outlineSummary}
${futureOutlines ? `后续章节走向备忘：\n${futureOutlines}` : ''}
${defaultText ? `作者默认主线原文（第${safeTargetChapterNum}章，作为优先参考原型）：\n${String(defaultText).substring(0, 1200)}` : ''}
${(!worldState || !worldState.canonical) && endingProto ? `作者结局原型：\n- default: ${String(endingProto.default || '').substring(0, 400)}\n- left: ${String(endingProto.left || '').substring(0, 400)}\n- right: ${String(endingProto.right || '').substring(0, 400)}` : ''}

任务：续写第 ${safeTargetChapterNum} 章全文内容。

要求（必须绝对服从）：
1. 必须顺接前文剧情，延续文风。
2. 章节号必须设置为 ${safeTargetChapterNum}。
3. 每章字数在 ${safeTargetWordCount} 左右。
4. 全文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。段落之间要自然衔接，避免跳跃叙述。
5. 必须严格遵守小说大纲/主轴和各角色的性格设定，人物互动必须符合前期建立的逻辑关系。
6. 必须与“后续章节走向备忘”中的主线发展保持严密的铺垫和连贯性，不能在当前章引入与后续大纲冲突的设定。
7. 如果有干涉偏移记录或支线触发设定，必须在文风和剧情逻辑上隐晦地体现这些涟漪效应。
8. 必须从本章开头到结尾严格保持指定叙事人称，不得段落间混用第一/第二/第三人称，也不得用“镜头切换”当作理由改变叙述视角。

请严格按照 JSON Schema 输出，不要包含图片 Prompt 或元注释。`;

    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: chapterSchema,
      },
    });

    const data = JSON.parse(response.text || '{}');
    if (data && typeof data.text === 'string') {
      data.text = ensureParagraphing(data.text, { minParas: 6, maxParas: 10 });
    }

    return res.status(200).json(data);
  } catch (error) {
    return sendInternalError(res, '生成章节失败', error);
  }
}
