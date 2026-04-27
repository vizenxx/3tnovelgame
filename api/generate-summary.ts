import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey, parseGeminiJson } from './_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from './_log.js';
import { buildFinalSummaryPrompt } from '../Prompt/finalSummary.js';

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: '最终的故事结局总结，仅限一句话或短语，约15-30字' },
  },
  required: ['text'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-summary');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { blueprint, chapters, endingValue } = req.body || {};
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      chapterCount: Array.isArray(chapters) ? chapters.length : 0,
      endingValue: Number(endingValue) || 0,
    });
    if (!blueprint || typeof blueprint.main_axis !== 'string' || !Array.isArray(chapters)) {
      return res.status(400).json({ error: '总结请求参数不合法。' });
    }

    const safeChapters = chapters.slice(0, 7);
    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

    const prompt = buildFinalSummaryPrompt({ blueprint, safeChapters, endingValue });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: summarySchema,
      },
    });

    const data = parseGeminiJson(response.text);
    logGenerationInfo(logContext, 'success', { fallback: false });
    return res.status(200).json(data);
  } catch (error) {
    logGenerationError(logContext, 'failed-using-fallback', error);
    const endingValue = Number(req.body?.endingValue) || 0;
    const text = endingValue > 5
      ? '秩序的微光穿过裂隙，照见命运新的归途。'
      : endingValue < -5
        ? '混沌在余烬中低语，命运从此偏离旧轨。'
        : '风暴归于沉默，命运在平衡处留下回声。';
    logGenerationInfo(logContext, 'success', { fallback: true });
    return res.status(200).json({ text, fallback: true });
  }
}
