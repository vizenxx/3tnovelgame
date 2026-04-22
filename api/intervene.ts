import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

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
    const perChunk = Math.max(1, Math.ceil(sentences.length / targetParas));
    const chunks: string[] = [];
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

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: '重写后的章节内容正文（必须包含全文）' },
          summary: { type: Type.STRING, description: '本章节的最新剧情大纲（20-40字）' },
          present_characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '本章出场的角色ID列表',
          },
        },
        required: ['chapter_num', 'summary', 'present_characters'],
      },
    },
    character_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: '角色ID' },
          status: { type: Type.STRING, description: '如：存活、重伤、死亡、黑化、失踪等' },
          is_dead: { type: Type.BOOLEAN, description: '是否已死亡' },
        },
        required: ['id', 'status', 'is_dead'],
      },
    },
  },
  required: ['chapters', 'character_updates'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const {
      blueprint,
      chapters,
      chapterNum,
      charId,
      action,
      currentEndingValue,
      currentUnlockedBranches,
      targetWordCount,
      interventionHistory,
      worldState,
    } = req.body || {};

    const safeChapterNum = Math.min(6, Math.max(1, Number(chapterNum) || 1));
    const safeTargetWordCount = Math.min(1200, Math.max(400, Number(targetWordCount) || 600));
    const safeCurrentUnlockedBranches = Array.isArray(currentUnlockedBranches) ? currentUnlockedBranches : [];
    const history: Array<{ chapterNum: number; charId: string; action: string }> = Array.isArray(interventionHistory) ? interventionHistory : [];

    if (!blueprint || !Array.isArray(blueprint.characters) || !Array.isArray(blueprint.branches) || !Array.isArray(chapters)) {
      return res.status(400).json({ error: '干涉请求参数不合法。' });
    }
    if (action !== 'bless' && action !== 'curse') {
      return res.status(400).json({ error: '干涉动作不合法。' });
    }

    const justTriggeredHistory = [...history, { chapterNum: safeChapterNum, charId, action }];
    const evalTrigger = (trigger: any, fullHistory: Array<{ chapterNum: number; charId: string; action: string }>) => {
      if (trigger?.type === 'single' && trigger.single) {
        const single = trigger.single;
        if (typeof single.chapterNum === 'number' && (single.chapterNum < 2 || single.chapterNum > 6)) return false;
        return fullHistory.some((item) => item.chapterNum === single.chapterNum && item.charId === single.charId && item.action === single.action);
      }
      if (trigger?.type === 'count' && trigger.count) {
        const count = trigger.count;
        if (typeof count.upToChapterNum === 'number' && (count.upToChapterNum < 2 || count.upToChapterNum > 6)) return false;
        const relevant = fullHistory.filter((item) => item.charId === count.charId && item.action === count.action);
        const sliced = typeof count.upToChapterNum === 'number' ? relevant.filter((item) => item.chapterNum <= count.upToChapterNum) : relevant;
        return sliced.length >= count.minCount;
      }
      return false;
    };
    const isTriggered = (branch: any) => {
      const groups = Array.isArray(branch?.triggerGroups) && branch.triggerGroups.length > 0 ? branch.triggerGroups.slice(0, 3) : [branch?.trigger];
      return groups.every((group: any) => evalTrigger(group, justTriggeredHistory));
    };

    const countTriggered = blueprint.branches.filter((branch: any) => isTriggered(branch));
    const unlocked = countTriggered[0];
    const newlyUnlocked = countTriggered.filter((branch: any) => !safeCurrentUnlockedBranches.some((existing: any) => existing.id === branch.id));
    const newUnlockedBranches = [...safeCurrentUnlockedBranches, ...newlyUnlocked];

    const leftBranches = blueprint.branches.filter((branch: any) => branch.side === 'left');
    const rightBranches = blueprint.branches.filter((branch: any) => branch.side === 'right');
    const leftTotalWeight = leftBranches.reduce((sum: number, branch: any) => sum + branch.score, 0);
    const rightTotalWeight = rightBranches.reduce((sum: number, branch: any) => sum + branch.score, 0);

    let directEVChange = 0;
    for (const branch of newlyUnlocked) {
      if (branch.side === 'left') {
        directEVChange += (branch.score / (leftTotalWeight || 1)) * 10;
      } else if (branch.side === 'right') {
        directEVChange -= (branch.score / (rightTotalWeight || 1)) * 10;
      }
    }

    const newEndingValue = Math.max(-25, Math.min(25, (Number(currentEndingValue) || 0) + directEVChange));
    const charName = blueprint.characters.find((character: any) => character.id === charId)?.name || '未知角色';
    const endingProto = blueprint?.authorAssets?.endingPrototypes;
    const injected = newlyUnlocked.length > 0
      ? newlyUnlocked.map((branch: any) => ({ id: branch.id, name: branch.name, inject: branch.inject, sceneText: branch.sceneText, side: branch.side }))
      : null;
    const prevChapterText = chapters.find((chapter: any) => chapter.chapter_num === safeChapterNum - 1)?.text || '';

    let worldStatePrompt = '';
    if (worldState && worldState.canonical) {
      worldStatePrompt = `故事主轴：${blueprint.main_axis || '（未提供）'}

故事基准（硬约束，不可违背）：
人物：${JSON.stringify(worldState.canonical.characters || [])}
物件：${JSON.stringify(worldState.canonical.objects || [])}
场景：${JSON.stringify(worldState.canonical.scenes || [])}
核心规则：${(worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((worldState.deltaWeight || 0) * 100)}%）：
${(worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${worldState.endingDirection || 'neutral'}
${worldState.endingDirection && worldState.endingDirection !== 'neutral' && endingProto ? `结局原型：\n${String(endingProto[worldState.endingDirection] || '').substring(0, 400)}` : ''}

直接前文（第 ${safeChapterNum - 1} 章，文风锚点）：
${String(prevChapterText).substring(0, 400)}`;
    } else {
      worldStatePrompt = `前置剧情摘要：${chapters.filter((chapter: any) => chapter.chapter_num < safeChapterNum).map((chapter: any) => `第${chapter.chapter_num}章：${chapter.text}`).join('\n\n')}`;
    }

    const prompt = `你是一个互动小说引擎。玩家在第 ${safeChapterNum} 章进行了命运干涉。

角色ID对照表：
${blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}

${worldStatePrompt}

各章情节概况（大纲）：
${chapters.map((chapter: any) => `第${chapter.chapter_num}章：${chapter.summary || String(chapter.text || '').substring(0, 50)}`).join('\n')}

命运扰动参数：目标角色【${charName}】，扰动极性【${action === 'bless' ? '正向' : '逆向'}】。这是系统层参数，不是角色可直接感知的事实。
命运倾向值（干涉前→干涉后）：${Number(currentEndingValue) || 0} → ${newEndingValue}。数值越大越偏向秩序/左结局，越小越偏向混沌/右结局。
${newlyUnlocked.length > 0 ? `本次新解锁支线：${newlyUnlocked.map((branch: any) => branch.name).join('、')}` : '本次未触发支线事件，只能做局部涟漪。'}
${injected ? `支线注入包（必须落地）：\n${injected.map((item: any) => `- [${item.id}] ${item.name}\n  - mustHappen: ${(item.inject?.mustHappen || []).join('；')}\n  - mustReveal: ${(item.inject?.mustReveal || []).join('；')}\n  - mustChange: ${(item.inject?.mustChange || []).join('；')}\n  - sceneText: ${String(item.sceneText || '').substring(0, 400)}`).join('\n')}` : ''}
${(!worldState || !worldState.canonical) && endingProto ? `作者结局原型：\n- default: ${String(endingProto.default || '').substring(0, 800)}\n- left: ${String(endingProto.left || '').substring(0, 800)}\n- right: ${String(endingProto.right || '').substring(0, 800)}` : ''}

隐性干预写作规则：
1. 严禁在正文出现“庇佑/磨难/干涉/玩家操作/系统指令”等元叙事字眼。
2. 必须将干预转译为自然因果：新事件、偶发变故、灵感、启示、线索暴露、人物决策偏移等。
3. 所有偏移都要依托原有故事与已触发支线的综合情况推进，不得突兀“神降”。
4. 允许结果偏向左/右，但不允许角色直接宣称“被庇佑/被诅咒/被操控”。

要求：
1. 第 ${safeChapterNum} 章到第 7 章都必须重写成完整正文，每章字数约 ${safeTargetWordCount} 字。
2. 每一章的正文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。
3. 所有因本次干涉直接或间接导致的变化，都必须用 <mark>...</mark> 包起来。
4. 即使未触发支线，也必须让本章和后续所有章节出现可感知偏移，不能复制旧正文。

请严格按 JSON 输出，不要包含元数据。`;

    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: rewriteSchema,
      },
    });

    const aiData = JSON.parse(response.text || '{}');
    if (Array.isArray(aiData?.chapters)) {
      aiData.chapters = aiData.chapters.map((chapter: any) => {
        if (chapter?.chapter_num === safeChapterNum && typeof chapter.text === 'string') {
          return { ...chapter, text: ensureParagraphing(chapter.text, { minParas: 6, maxParas: 10 }) };
        }
        return chapter;
      });
    }

    const leftProgress = Math.min(100, Math.max(0, (newEndingValue / 25) * 100));
    const rightProgress = Math.min(100, Math.max(0, (-newEndingValue / 25) * 100));
    let endingLabel = '均衡道';
    if (newEndingValue > 5) endingLabel = '秩序律';
    if (newEndingValue < -5) endingLabel = '混沌终';

    return res.status(200).json({
      aiData,
      newEndingValue,
      newUnlockedBranches,
      unlockedBranch: unlocked && !safeCurrentUnlockedBranches.some((branch: any) => branch.id === unlocked.id) ? unlocked : null,
      uiFeedback: {
        leftProgress,
        rightProgress,
        endingLabel,
      },
    });
  } catch (error) {
    return sendInternalError(res, '干涉处理失败', error);
  }
}
