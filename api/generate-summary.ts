import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "最终的故事结局总结（仅限一句话或短语），风格极度诗意，约15-30字" }
  },
  required: ["text"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { blueprint, chapters, endingValue } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const prompt = `你是一个互动小说编年史家。
      小说主轴：${blueprint.main_axis}
      章节历史：${chapters.map((c: any) => `
      --- 第${c.chapter_num}章：${c.title} ---
      情节摘要：${c.summary}
      详细文本：${c.text?.substring(0, 500)}...
      进展结果：${c.unlocked_branch ? `解锁支线 ${c.unlocked_branch}` : '主线推进'}
      `).join('\n\n')}
      
      最终命运天平：${endingValue}（目前的平衡状态：${
        endingValue > 3 ? '极度倾向秩序与守护' : 
        endingValue > 0 ? '略微倾向稳健秩序' : 
        endingValue < -3 ? '完全坠入混乱与毁灭' : 
        endingValue < 0 ? '产生了一些动荡与混乱' : 
        '完美的命运均衡'
      }）
      
      任务：为这段史诗般的冒险撰写一个如诗般优美的简短结语。
      
      要求：
      1. 文笔风格：体现“尘埃落定”的沧桑感，仅限一句话或一句短词。
      2. 情感共鸣：让玩家感受到这种“秩序”或“混乱”命运轨迹的最终归宿。
      3. 字数要求：严格限制在 15-30 字左右。不要写一段文字。
      
      请严格按 JSON 格式输出。不要包含元数据。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: summarySchema,
      }
    });

    res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error("API Error: ", error);
    res.status(500).json({ 
      error: error.message || '生成总结失败',
      stack: error.stack || String(error)
    });
  }
}
