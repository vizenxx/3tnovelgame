import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "第一篇章标题" },
    main_axis: { type: Type.STRING, description: "第一篇章的核心主轴/大纲，作为后续发展的基架" },
    left_mainline_default: { type: Type.NUMBER, description: "左侧主线默认影响率 (0-100)" },
    right_mainline_default: { type: Type.NUMBER, description: "右侧主线默认影响率 (0-100)" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "如 c1, c2" },
          name: { type: Type.STRING, description: "纯粹的姓名，不要包含任何简介或括号附加信息" },
          desc: { type: Type.STRING, description: "一句话简介" }
        },
        required: ["id", "name", "desc"]
      }
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          title: { type: Type.STRING, description: "章节标题（6-12字）" },
          summary: { type: Type.STRING, description: "该章节的剧情要点大纲(20-40字)" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "本章出场的角色ID列表"
          }
        },
        required: ["chapter_num", "title", "summary", "present_characters"]
      }
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "good, normal, or bad" },
          text: { type: Type.STRING, description: "第一篇章结局走向描述" }
        },
        required: ["type", "text"]
      }
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.INTEGER, description: "权重：1(小), 2(中), 3(大), 5(隐)" },
          side: { type: Type.STRING, description: "left, right" },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING },
          condition_chapter: { type: Type.INTEGER },
          desc: { type: Type.STRING },
          is_hidden: { type: Type.BOOLEAN },
          hint: { type: Type.STRING }
        },
        required: ["id", "name", "score", "side", "condition_char", "condition_action", "condition_chapter", "desc", "is_hidden", "hint"]
      }
    }
  },
  required: ["title", "main_axis", "left_mainline_default", "right_mainline_default", "characters", "chapters", "endings", "branches"]
};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { selectedThemes, targetWordCount } = req.body || {};
    
    if (!selectedThemes || !Array.isArray(selectedThemes)) {
      return res.status(400).json({ error: '缺少选定的主题列表 (selectedThemes)' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const prompt = `你是一个互动小说世界构建师。
      已知主题：${selectedThemes.join(', ')}。
      
      任务：生成一个完整的首篇章（7章）的故事蓝图骨架。
      
      要求（极度重要）：
      1. **瞬发骨架模式**：由于性能限制，严禁在 \`chapters\` 中生成章节全文。
      2. 每一章必须提供一个 **summary (简短情节大纲，20-40字)**。
      2.1 每一章必须提供一个 **title（6-12字）**，与该章大纲一致。
      3. 设定 3-5 个角色，ID 需为 c1, c2 ...
      3.1 **人物简介必须写**：每个角色的 \`desc\` 必须是 15-35 字的具体简介（身份/动机/矛盾点至少包含两项），不能是空话。
      4. 设定结局影响率参数：left_mainline_default 和 right_mainline_default (0-100)。
      5. 设定逻辑严密的 3 种第 7 章结局走向。
      6. 规划 6-10 个支线命运点（branches），左右各半。
      6.1 **暗示短句必须写**：每条支线必须提供 \`hint\`（8-18字），用于在 UI 中给玩家“可解锁的隐约提示”。不得直接暴露“第X章/对谁/做什么”的完整条件，但要能让玩家猜到倾向（例如：关于“庇佑/磨难”的语气差异，或角色相关意象）。
      7. **角色命名规范**：\`name\` 字段只能包含角色的姓名（如“林晓”），严禁包含任何职业、头衔、性格描述或括号备注，所有背景描述必须全放进 \`desc\`。
      
      请严格按 JSON 格式输出。不要包含元数据。字数设定参考值：${targetWordCount || 600}。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: blueprintSchema,
      }
    });

    res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error("API Error: ", error);
    res.status(500).json({ 
      error: error.message || '生成蓝图失败',
      stack: error.stack || String(error)
    });
  }
}
