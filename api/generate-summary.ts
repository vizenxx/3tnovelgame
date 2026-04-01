import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth';

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: '最终的故事结局总结，仅限一句话或短语，约15-30字' },
  },
  required: ['text'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { blueprint, chapters, endingValue } = req.body || {};
    if (!blueprint || typeof blueprint.main_axis !== 'string' || !Array.isArray(chapters)) {
      return res.status(400).json({ error: '总结请求参数不合法。' });
    }

    const safeChapters = chapters.slice(0, 7);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const prompt = `你是一个互动小说编年史家。
小说主轴：${blueprint.main_axis}
章节历史：${safeChapters.map((chapter: any) => `
--- 第${chapter.chapter_num}章：${chapter.title} ---
情节摘要：${chapter.summary}
详细文本：${String(chapter.text || '').substring(0, 500)}...
进展结果：${chapter.unlocked_branch ? `解锁支线 ${chapter.unlocked_branch}` : '主线推进'}
`).join('\n\n')}

最终命运天平：${Number(endingValue) || 0}

任务：为这段史诗般的冒险撰写一句如诗般的结语。

要求：
1. 只写一句话或一句短语。
2. 长度控制在 15-30 字左右。
3. 必须能体现秩序、混沌或平衡的最终归宿。

请严格按 JSON 输出，不要包含元数据。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: summarySchema,
      },
    });

    return res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error) {
    return sendInternalError(res, '生成总结失败', error);
  }
}
