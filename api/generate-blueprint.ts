import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: '第一篇章标题' },
    main_axis: { type: Type.STRING, description: '第一篇章的核心主轴/大纲，作为后续发展的基架' },
    left_mainline_default: { type: Type.NUMBER, description: '左侧主线默认影响率 (0-100)' },
    right_mainline_default: { type: Type.NUMBER, description: '右侧主线默认影响率 (0-100)' },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: '如 c1, c2' },
          name: { type: Type.STRING, description: '纯粹的姓名，不要包含任何简介或括号附加信息' },
          desc: { type: Type.STRING, description: '一句话简介' },
        },
        required: ['id', 'name', 'desc'],
      },
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          title: { type: Type.STRING, description: '章节标题（6-12字）' },
          summary: { type: Type.STRING, description: '该章节的剧情要点大纲(20-40字)' },
          present_characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '本章出场的角色ID列表',
          },
        },
        required: ['chapter_num', 'title', 'summary', 'present_characters'],
      },
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'good, normal, or bad' },
          text: { type: Type.STRING, description: '第一篇章结局走向描述' },
        },
        required: ['type', 'text'],
      },
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.INTEGER, description: '权重：1(小), 2(中), 3(大), 5(隐)' },
          side: { type: Type.STRING, description: 'left, right' },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING },
          condition_chapter: { type: Type.INTEGER },
          desc: { type: Type.STRING },
          is_hidden: { type: Type.BOOLEAN },
          hint: { type: Type.STRING },
        },
        required: ['id', 'name', 'score', 'side', 'condition_char', 'condition_action', 'condition_chapter', 'desc', 'is_hidden', 'hint'],
      },
    },
  },
  required: ['title', 'main_axis', 'left_mainline_default', 'right_mainline_default', 'characters', 'chapters', 'endings', 'branches'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { selectedThemes, customOutline, targetWordCount } = req.body || {};

    if (!Array.isArray(selectedThemes) && !customOutline) {
      return res.status(400).json({ error: '必须选择至少一个主题或提供大纲' });
    }

    const safeTargetWordCount = Math.min(1200, Math.max(600, Number(targetWordCount) || 600));
    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

    const prompt = `你是一个互动小说世界构建师。
已知主题：${Array.isArray(selectedThemes) ? selectedThemes.join(', ') : '无'}。
用户提供的故事大纲/期望：${customOutline ? customOutline : '无'}。

任务：生成一个完整的首篇章（7章）的故事蓝图骨架。

要求（极度重要）：
1. 由于性能限制，严禁在 chapters 中生成章节全文。
2. 每一章必须提供一个 summary（简短情节大纲，20-40字）。
3. 每一章必须提供一个 title（6-12字），与该章大纲一致。
4. 设定 3-5 个角色，ID 必须为 c1, c2 ...
5. 每个角色的 desc 必须是 15-35 字的具体简介，至少包含身份/动机/矛盾点中的两项。
6. 设定结局影响率参数：left_mainline_default 和 right_mainline_default (0-100)。
7. 设定逻辑严密的 3 种第 7 章结局走向。结局与主线设定必须契合。
8. 规划 6-10 个支线命运点（branches），左右各半。支线情节必须根据左/右主线做数学设定，相互影响。角色性格和核心主线必须在后续章节的大纲里严格体现。
9. 每条支线必须提供 hint（8-18字），用于 UI 中的隐约提示，但不要直接暴露完整触发条件。
10. condition_char 只能使用已创建的角色ID；condition_chapter 必须是 2 到 6 的整数；condition_action 只能是 bless 或 curse。
11. desc 必须写清该支线发生时的具体剧情变化和隐藏内幕。
12. name 字段只能是角色姓名，所有背景描述全部放进 desc。

请严格按 JSON 输出，不要包含元数据。字数参考值：${safeTargetWordCount}。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: blueprintSchema,
      },
    });

    return res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error) {
    return sendInternalError(res, '生成蓝图失败', error);
  }
}
