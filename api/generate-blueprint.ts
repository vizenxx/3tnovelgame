import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey, getGeminiModelCandidates, parseGeminiJson } from './_gemini.js';

function getNarrativePersonInstruction(value: unknown) {
  const key = String(value || 'third');
  if (key === 'first') {
    return '第一人称：全文必须以“我/我们”的叙事视角推进，严禁在章节之间切换成第三人称旁白。';
  }
  if (key === 'second') {
    return '第二人称：全文必须以“你”的沉浸式叙事视角推进，严禁在章节之间切换成第一或第三人称。';
  }
  return '第三人称：全文必须以“他/她/他们/角色姓名”的叙事视角推进，严禁突然切换成第一人称自述。';
}

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

function normalizeBlueprint(raw: any) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI_RESPONSE_INVALID: blueprint response is not an object.');
  }

  const characters = Array.isArray(raw.characters)
    ? raw.characters.slice(0, 5).map((character: any, index: number) => ({
        id: String(character?.id || `c${index + 1}`).trim() || `c${index + 1}`,
        name: String(character?.name || `角色${index + 1}`).trim(),
        desc: String(character?.desc || '尚待命运揭示的关键人物').trim(),
      })).filter((character: any) => character.name)
    : [];

  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.slice(0, 7).map((chapter: any, index: number) => ({
        chapter_num: Math.min(7, Math.max(1, Number(chapter?.chapter_num) || index + 1)),
        title: String(chapter?.title || `第${index + 1}章`).trim(),
        summary: String(chapter?.summary || '命运仍在雾中等待成形。').trim(),
        present_characters: Array.isArray(chapter?.present_characters)
          ? chapter.present_characters.map((id: any) => String(id)).filter(Boolean)
          : characters.map((character: any) => character.id).slice(0, 3),
      }))
    : [];

  const endings = Array.isArray(raw.endings)
    ? raw.endings.slice(0, 3).map((ending: any, index: number) => ({
        type: ['good', 'normal', 'bad'].includes(String(ending?.type)) ? String(ending.type) : ['normal', 'good', 'bad'][index] || 'normal',
        text: String(ending?.text || '命运在终章留下尚未命名的回声。').trim(),
      }))
    : [];

  const branches = Array.isArray(raw.branches)
    ? raw.branches.slice(0, 10).map((branch: any, index: number) => ({
        id: String(branch?.id || `b_${index + 1}`).trim(),
        name: String(branch?.name || characters[index % Math.max(1, characters.length)]?.name || `角色${index + 1}`).trim(),
        score: Math.min(5, Math.max(1, Number(branch?.score) || 1)),
        side: String(branch?.side) === 'right' ? 'right' : 'left',
        condition_char: String(branch?.condition_char || characters[index % Math.max(1, characters.length)]?.id || 'c1'),
        condition_action: String(branch?.condition_action) === 'curse' ? 'curse' : 'bless',
        condition_chapter: Math.min(6, Math.max(2, Number(branch?.condition_chapter) || 2)),
        desc: String(branch?.desc || '一次干涉会令潜藏的命运分歧浮现。').trim(),
        is_hidden: Boolean(branch?.is_hidden),
        hint: String(branch?.hint || '命运有细微回声').trim(),
      }))
    : [];

  if (!String(raw.title || '').trim() || !String(raw.main_axis || '').trim()) {
    throw new Error('AI_RESPONSE_INVALID: blueprint missed title or main_axis.');
  }
  if (characters.length === 0 || chapters.length === 0 || endings.length === 0 || branches.length === 0) {
    throw new Error('AI_RESPONSE_INVALID: blueprint missed required arrays.');
  }

  return {
    ...raw,
    title: String(raw.title).trim(),
    main_axis: String(raw.main_axis).trim(),
    left_mainline_default: Math.min(100, Math.max(0, Number(raw.left_mainline_default) || 40)),
    right_mainline_default: Math.min(100, Math.max(0, Number(raw.right_mainline_default) || 40)),
    characters,
    chapters,
    endings,
    branches,
  };
}

async function generateBlueprintWithFallback(ai: GoogleGenAI, prompt: string) {
  let lastError: unknown = null;
  for (const model of getGeminiModelCandidates()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: blueprintSchema,
        },
      });
      return normalizeBlueprint(parseGeminiJson(response.text));
    } catch (error) {
      lastError = error;
      console.error(`Blueprint generation failed with ${model}:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI_GENERATION_FAILED: Gemini blueprint generation failed.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { selectedThemes, customOutline, targetWordCount, narrativePerson } = req.body || {};

    if (!Array.isArray(selectedThemes) && !customOutline) {
      return res.status(400).json({ error: '必须选择至少一个主题或提供大纲' });
    }

    const safeTargetWordCount = Math.min(1200, Math.max(600, Number(targetWordCount) || 600));
    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

    const prompt = `你是一个互动小说世界构建师。
已知主题：${Array.isArray(selectedThemes) ? selectedThemes.join(', ') : '无'}。
用户提供的故事大纲/期望：${customOutline ? customOutline : '无'}。
叙事人称硬约束：${getNarrativePersonInstruction(narrativePerson)}

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
13. chapters 的 title/summary 必须与上述叙事人称相容，避免设计会迫使正文切换人称的章节视角。

请严格按 JSON 输出，不要包含元数据。字数参考值：${safeTargetWordCount}。`;

    const data = await generateBlueprintWithFallback(ai, prompt);
    return res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Missing valid Gemini API key.') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      return res.status(503).json({ error: 'AI 服务配置未完成，请稍后再试。', code: 'AI_CONFIG_MISSING' });
    }
    if (message.includes('AI_RESPONSE_INVALID') || message.includes('JSON')) {
      console.error('生成蓝图失败', error);
      return res.status(502).json({ error: 'AI 返回的蓝图格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成蓝图失败', error);
  }
}
