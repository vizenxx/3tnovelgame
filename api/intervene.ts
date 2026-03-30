import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function ensureParagraphing(raw: string, opts?: { minParas?: number; maxParas?: number }) {
  const minParas = opts?.minParas ?? 6;
  const maxParas = opts?.maxParas ?? 10;
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return text;

  text = text.replace(/\n{3,}/g, '\n\n');

  const hasParaBreaks = text.includes('\n\n');
  if (!hasParaBreaks) {
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

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "重写后的章节内容（仅当前干涉的那一章需要全文，后续章节请留空）" },
          summary: { type: Type.STRING, description: "本章节的最新剧情大纲（由于蝴蝶效应，请重写未来各章的走向，20-40字）" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "本章出场的角色ID列表"
          }
        },
        required: ["chapter_num", "summary", "present_characters"]
      }
    },
    character_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "角色ID" },
          status: { type: Type.STRING, description: "如：存活、重伤、死亡、黑化、失踪等" },
          is_dead: { type: Type.BOOLEAN, description: "是否已死亡" }
        },
        required: ["id", "status", "is_dead"]
      }
    }
  },
  required: ["chapters", "character_updates"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      blueprint, 
      chapters, 
      chapterNum, 
      charId, 
      action, 
      currentEndingValue, 
      currentUnlockedBranches,
      targetWordCount,
      interventionHistory
    } = req.body;

    const history: Array<{ chapterNum: number; charId: string; action: string }> = Array.isArray(interventionHistory) ? interventionHistory : [];

    const justTriggeredHistory = [...history, { chapterNum, charId, action }];
    const evalTrigger = (t: any, fullHistory: Array<{ chapterNum: number; charId: string; action: string }>) => {
      if (t?.type === 'single' && t.single) {
        const s = t.single;
        if (typeof s.chapterNum === 'number' && (s.chapterNum < 2 || s.chapterNum > 6)) return false;
        return fullHistory.some(h => h.chapterNum === s.chapterNum && h.charId === s.charId && h.action === s.action);
      }
      if (t?.type === 'count' && t.count) {
        const c = t.count;
        if (typeof c.upToChapterNum === 'number' && (c.upToChapterNum < 2 || c.upToChapterNum > 6)) return false;
        const relevant = fullHistory.filter(h => h.charId === c.charId && h.action === c.action);
        const sliced = typeof c.upToChapterNum === 'number' ? relevant.filter(h => h.chapterNum <= c.upToChapterNum) : relevant;
        return sliced.length >= c.minCount;
      }
      return false;
    };
    const isTriggered = (b: any) => {
      const groups = Array.isArray(b?.triggerGroups) && b.triggerGroups.length > 0 ? b.triggerGroups.slice(0, 3) : [b?.trigger];
      return groups.every((g: any) => evalTrigger(g, justTriggeredHistory));
    };

    const unlocked = blueprint.branches.find((b: any) => isTriggered(b));
    const countTriggered = blueprint.branches.filter((b: any) => isTriggered(b));

    const isAlreadyUnlocked = currentUnlockedBranches.find((b: any) => b.id === unlocked?.id);
    const newlyUnlocked = [
      ...(unlocked && !isAlreadyUnlocked ? [unlocked] : []),
      ...countTriggered.filter((b: any) => !currentUnlockedBranches.some((x: any) => x.id === b.id))
    ];
    const newUnlockedBranches = [...currentUnlockedBranches, ...newlyUnlocked];

    const leftSublines = blueprint.branches.filter((b: any) => b.side === 'left') || [];
    const rightSublines = blueprint.branches.filter((b: any) => b.side === 'right') || [];
    const leftTotalWeight = leftSublines.reduce((acc: number, b: any) => acc + b.score, 0);
    const rightTotalWeight = rightSublines.reduce((acc: number, b: any) => acc + b.score, 0);
    
    let directEVChange = 0;
    for (const b of newlyUnlocked) {
      if (b.side === 'left') {
        directEVChange += (b.score / (leftTotalWeight || 1)) * 10;
      } else if (b.side === 'right') {
        directEVChange += -(b.score / (rightTotalWeight || 1)) * 10;
      }
    }

    const newEndingValue = Math.max(-25, Math.min(25, currentEndingValue + directEVChange));
    const charName = blueprint.characters.find((c: any) => c.id === charId)?.name;
    const endingProto = blueprint?.authorAssets?.endingPrototypes;
    const injected = newlyUnlocked.length > 0 ? newlyUnlocked.map((b: any) => ({ id: b.id, name: b.name, inject: b.inject, sceneText: b.sceneText, side: b.side })) : null;
    const evBefore = Number(currentEndingValue) || 0;
    const evAfter = newEndingValue;
    
    const prompt = `你是一个互动小说引擎。玩家在第 ${chapterNum} 章进行了命运干涉。
      
      角色ID对照表：${blueprint.characters.map((c: any) => `${c.name} (ID: ${c.id})`).join('\n')}
      前置剧情摘要：${chapters.filter((c: any) => c.chapter_num < chapterNum).map((c: any) => `第${c.chapter_num}章：${c.text}`).join('\n\n')}
      原定大纲：${chapters.map((c: any) => `第${c.chapter_num}章：${c.summary || c.text?.substring(0, 50)}`).join('\n')}
      干涉指令：玩家对角色【${charName}】施加了【${action === 'bless' ? '无形力量的庇佑' : '无形力量的磨难'}】。
      命运倾向值（干涉前→干涉后，范围约 -25 偏混沌 到 +25 偏秩序）：${evBefore} → ${evAfter}。数值越大越偏向「秩序/左结局」一侧，越小越偏向「混沌/右结局」一侧。请在后续各章 summary 中体现这一压力方向（与庇佑/磨难语义一致）。
      ${newlyUnlocked.length > 0 ? `本次新解锁支线：${newlyUnlocked.map((b: any) => b.name).join('、')}` : '未触发任何支线事件（只做局部涟漪）'}
      ${injected ? `支线注入包（必须落实到剧情中，优先级高于自由发挥）：\n${injected.map((x: any) => `- [${x.id}] ${x.name}\n  - mustHappen: ${(x.inject?.mustHappen || []).join('；')}\n  - mustReveal: ${(x.inject?.mustReveal || []).join('；')}\n  - mustChange: ${(x.inject?.mustChange || []).join('；')}\n  - sceneText: ${(x.sceneText || '').substring(0, 400)}`).join('\n')}` : ''}
      ${endingProto ? `作者结局原型（用于高强度倾向时靠拢）：\n- default: ${(endingProto.default || '').substring(0, 800)}\n- left: ${(endingProto.left || '').substring(0, 800)}\n- right: ${(endingProto.right || '').substring(0, 800)}` : ''}
      
      要求：
      1. **第 ${chapterNum} 章**：核心重写。生成全新的、细腻的小说全文。字数：${targetWordCount || 600} 中文字。文笔需呼应干涉。
         - **分段强约束**：全文必须拆成 6-10 段；每段 2-4 句；段落间必须使用两个换行符 (\\n\\n)。不得出现“整章一段”。
         - **段落逻辑**：每段只推进 1 个明确的叙事单位（场景/冲突/信息/抉择/后果之一），段落之间要有因果递进。
      2. **涟漪强度规则**：
         - 若未触发支线：第 ${chapterNum} 章必须写出可感知的因果变化；第 ${chapterNum + 1} 到 7 章的 summary 仍须**逐章重写**为 20-40 字新要点，至少体现「庇佑→更顺/更亮/更稳」或「磨难→更险/更暗/更乱」之一缕走向，**禁止**原样复制旧 summary。
         - 若触发支线：必须将支线注入包落地，并让后续 summary 明显向对应侧的结局原型与当前倾向值 ${evAfter} 靠拢。
      3. **第 ${chapterNum + 1} 到 7 章**：只需在 \`summary\` 字段给出新要点（20-40字），\`text\` 字段留空或省略（不要写正文）。
      4. **极度重要：剧情高亮**：玩家的干涉必须在第 ${chapterNum} 章产生具体的、可感知的连锁反应。所有因干涉直接或间接导致的情节变化（哪怕只有一句话），必须严密地包裹在 <mark> ... </mark> 标签中。
      
      请严格按 JSON 输出。不要包含任何元数据。`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: rewriteSchema,
      }
    });

    const aiData = JSON.parse(response.text || '{}');
    if (aiData?.chapters?.length) {
      aiData.chapters = aiData.chapters.map((c: any) => {
        if (c?.chapter_num === chapterNum && typeof c.text === 'string') {
          return { ...c, text: ensureParagraphing(c.text, { minParas: 6, maxParas: 10 }) };
        }
        return c;
      });
    }
    const leftProgress = Math.min(100, Math.max(0, (newEndingValue / 25) * 100));
    const rightProgress = Math.min(100, Math.max(0, (-newEndingValue / 25) * 100));
    let endingLabel = "均衡道";
    if (newEndingValue > 5) endingLabel = "秩序律";
    if (newEndingValue < -5) endingLabel = "混沌终";

    res.status(200).json({
      aiData,
      newEndingValue,
      newUnlockedBranches,
      unlockedBranch: unlocked && !isAlreadyUnlocked ? unlocked : null,
      uiFeedback: {
        leftProgress,
        rightProgress,
        endingLabel
      }
    });
  } catch (error: any) {
    console.error("API Error: ", error);
    res.status(500).json({ 
      error: error.message || '干涉处理失败',
      stack: error.stack || String(error)
    });
  }
}
