import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    main_axis: { type: Type.STRING, description: "故事的核心主轴与基调" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          desc: { type: Type.STRING, description: "角色背景描述(50字内)" }
        }
      }
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          summary: { type: Type.STRING, description: "该章节的剧情要点大纲(20-40字)" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }
          }
        }
      }
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "good, normal, bad" },
          text: { type: Type.STRING, description: "结局走向描述" }
        }
      }
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          desc: { type: Type.STRING },
          side: { type: Type.STRING, description: "left, right" },
          score: { type: Type.INTEGER, description: "权重1-5" },
          condition_chapter: { type: Type.INTEGER },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING }
        }
      }
    }
  },
  required: ["main_axis", "characters", "chapters", "endings", "branches"]
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
      3. 设定 3-5 个角色，ID 需为 c1, c2 ...
      4. 设定逻辑严密的 3 种第 7 章结局走向。
      5. 规划 6-10 个支线命运点（branches），左右各半。
      
      请严格按 JSON 格式输出。不要包含元数据。字数设定参考值：${targetWordCount || 600}。`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-8b', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: blueprintSchema,
      }
    });

    res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || '生成蓝图失败' });
  }
}
