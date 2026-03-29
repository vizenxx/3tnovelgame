import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { storyChapters } = JSON.parse(event.body || '{}');

    if (!storyChapters || !Array.isArray(storyChapters)) {
      return { statusCode: 400, body: JSON.stringify({ error: '无效的故事章节' }) };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    const prompt = `你是一个互动小说引擎。玩家刚刚完成了一部小说的游玩。
      请根据以下完整的故事内容，写一句（仅限一句，20字以内）充满诗意、情绪化或哲理性的总结评语。
      例如：“这一抹淡淡的忧伤，也许也是一种凄美吧”、“命运的齿轮终究碾碎了所有人的幻想”、“在废墟之上，希望的种子悄然发芽”。
      
      【故事内容】：
      ${storyChapters.map(c => `第${c.chapter_num}章：${c.text}`).join('\n\n')}
      `;
      
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: response.text?.trim() || "命运的织机停下了运转，留下一地无言的叹息。" })
    };
  } catch (error: any) {
    console.error("Generate Summary Error:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || '生成结局总结失败' })
    };
  }
};
