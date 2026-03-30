import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    conclusion: { type: Type.STRING, description: "最终的故事结局总结（约300-500字），文笔优美" }
  },
  required: ["conclusion"]
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
      章节历史：${chapters.map((c: any) => `第${c.chapter_num}章：${c.text?.substring(0, 100)}...`).join('\n')}
      最终结局倾向值：${endingValue}（正数为秩序，负数为混沌）
      
      任务：为这段冒险撰写一个精彩的最终总结（第一篇章完结篇）。
      
      要求：
      1. 文笔需具有史诗般的结束感。
      2. 需体现出玩家干涉导致的最终命运走向。
      3. 字数 400 字左右。
      
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
