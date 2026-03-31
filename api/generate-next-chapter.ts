import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function ensureParagraphing(raw: string, opts?: { minParas?: number; maxParas?: number }) {
  const minParas = opts?.minParas ?? 6;
  const maxParas = opts?.maxParas ?? 10;
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return text;

  // normalize excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  const hasParaBreaks = text.includes('\n\n');
  if (!hasParaBreaks) {
    // Heuristic split by sentence end punctuation to create paragraph breaks.
    const sentences = text
      .split(/(?<=[。！？!?…])\s*/g)
      .map(s => s.trim())
      .filter(Boolean);

    const targetParas = Math.min(maxParas, Math.max(minParas, Math.ceil((sentences.length || 1) / 3)));
    const chunks: string[] = [];
    const per = Math.max(1, Math.ceil(sentences.length / targetParas));
    for (let i = 0; i < sentences.length; i += per) {
      chunks.push(sentences.slice(i, i + per).join(''));
    }
    text = chunks.join('\n\n');
  }

  // If too few paragraphs, try splitting long paragraphs.
  let paras = text.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
  if (paras.length < minParas) {
    const expanded: string[] = [];
    for (const p of paras) {
      if (expanded.length >= minParas) {
        expanded.push(p);
        continue;
      }
      if (p.length > 220) {
        const mid = Math.floor(p.length / 2);
        const left = p.slice(0, mid).replace(/\s+$/g, '');
        const right = p.slice(mid).replace(/^\s+/g, '');
        expanded.push(left, right);
      } else {
        expanded.push(p);
      }
    }
    paras = expanded.map(p => p.trim()).filter(Boolean);
  }

  // Cap paragraphs if there are too many.
  if (paras.length > maxParas) {
    const merged: string[] = [];
    const per = Math.ceil(paras.length / maxParas);
    for (let i = 0; i < paras.length; i += per) {
      merged.push(paras.slice(i, i + per).join('\n'));
    }
    paras = merged;
  }

  return paras.join('\n\n').trim();
}

const chapterSchema = {
  type: Type.OBJECT,
  properties: {
    chapter_num: { type: Type.INTEGER },
    text: { type: Type.STRING },
    present_characters: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }
    }
  },
  required: ["chapter_num", "text", "present_characters"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { blueprint, currentChapters, chapters: chaptersBody, targetChapterNum, targetWordCount, worldState } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const allChapters: any[] = Array.isArray(chaptersBody) && chaptersBody.length
      ? chaptersBody
      : (Array.isArray(currentChapters) ? currentChapters : []);
    const historyChapters = allChapters.filter((c: any) => c?.text && String(c.text).trim().length > 0);
    const bpCh = blueprint?.chapters?.find((c: any) => c.chapter_num === targetChapterNum);
    const liveCh = allChapters.find((c: any) => c.chapter_num === targetChapterNum);
    const outlineSummary = (liveCh?.summary && String(liveCh.summary).trim())
      ? String(liveCh.summary).trim()
      : (bpCh?.summary || '');
    const futureOutlines = allChapters
      .filter((c: any) => c.chapter_num > targetChapterNum && c.summary && String(c.summary).trim())
      .map((c: any) => `第${c.chapter_num}章要点：${String(c.summary).trim()}`)
      .join('\n');

    const defaultText = blueprint?.authorAssets?.defaultChapters?.[targetChapterNum]?.text;
    const endingProto = blueprint?.authorAssets?.endingPrototypes;

    // 直接前置剧情，作文风锚点
    const prevChapterText = allChapters.find((c: any) => c.chapter_num === targetChapterNum - 1)?.text || '';

    // 构建 World State 上下文
    let worldStatePrompt = '';
    if (worldState && worldState.canonical) {
      worldStatePrompt = `故事基准（硬约束，优先级最高，不可违背）：
人物：${JSON.stringify(worldState.canonical.characters || [])}
物件：${JSON.stringify(worldState.canonical.objects || [])}
场景：${JSON.stringify(worldState.canonical.scenes || [])}
核心规则：${(worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((worldState.deltaWeight || 0) * 100)}%）：
${(worldState.deltas || []).map((d: any) => d.characters_changed?.map((c: any) => c.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${worldState.endingDirection || 'neutral'}
${worldState.endingDirection && worldState.endingDirection !== 'neutral' && endingProto ? `结局原型（用于高强度倾向时靠拢参考）：\n${(endingProto[worldState.endingDirection] || '').substring(0, 400)}` : ''}

直接前文（第 ${targetChapterNum - 1} 章，文风锚点）：
${prevChapterText.substring(0, 400)}`;
    } else {
      worldStatePrompt = `历史剧情回忆：${historyChapters.map((c: any) => `[${c.chapter_num}] ${c.text?.substring(0, 200)}...`).join('\n')}`;
    }

    const prompt = `你是一个互动小说引擎的织梦者。
      小说大纲/主轴：${blueprint.main_axis}
      角色列表：${blueprint.characters.map((c: any) => `${c.id}:${c.name}(${c.desc})`).join('; ')}
      ${worldStatePrompt}
      当前章节大纲指引（优先使用「玩家会话中最新大纲」，已含命运干涉后的微调）：${outlineSummary}
      ${futureOutlines ? `后续章节走向备忘（已由系统在干涉后更新，续写时不得与之矛盾）：\n${futureOutlines}` : ''}
      ${defaultText ? `作者默认主线原文（第${targetChapterNum}章，作为最优先参考原型）：\n${String(defaultText).substring(0, 1200)}` : ''}
      ${(!worldState || !worldState.canonical) && endingProto ? `作者结局原型（用于保持全书一致性，不必全文引用）：\n- default: ${(endingProto.default || '').substring(0, 400)}\n- left: ${(endingProto.left || '').substring(0, 400)}\n- right: ${(endingProto.right || '').substring(0, 400)}` : ''}
      
      任务：续写第 ${targetChapterNum} 章全文内容。
      
      要求：
      1. 必须顺接前文剧情，延续文风。
      2. 章节号必须设置为 ${targetChapterNum}。
      3. 每章字数在 ${targetWordCount || 400} 左右，文笔优美。
      4. **分段强约束**：全文必须拆成 6-10 段；每段 2-4 句；段落间必须使用两个换行符 (\\n\\n)。不得出现“整章一段”。
      5. 段落之间要自然衔接，避免跳跃式叙述。
      
      请严格按照 JSON Schema 输出。
      不要包含任何图片 Prompt 或元注释。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: chapterSchema,
      }
    });

    const data = JSON.parse(response.text || '{}');
    if (data && typeof data.text === 'string') {
      data.text = ensureParagraphing(data.text, { minParas: 6, maxParas: 10 });
    }
    res.status(200).json(data);
  } catch (error: any) {
    console.error("API Error: ", error);
    res.status(500).json({ 
      error: error.message || '生成章节失败',
      stack: error.stack || String(error)
    });
  }
}
