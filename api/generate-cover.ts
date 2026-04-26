import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

function extractInlineImageData(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts || response?.parts || [];
  for (const part of parts) {
    const inlineData = part?.inlineData || part?.inline_data;
    if (inlineData?.data) {
      return {
        data: inlineData.data,
        mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
      };
    }
  }
  throw new Error('Gemini did not return an image.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { prompt, title, mainAxis, tags } = req.body || {};
    const cleanPrompt = String(prompt || '').trim();
    if (cleanPrompt.length < 8) {
      return res.status(400).json({ error: '请先输入更具体的封面生成提示。' });
    }

    const finalPrompt = [
      '为互动小说生成一张 1:1 方形作品封面，1024x1024，适合移动端作品卡展示。',
      '画面需要有强烈叙事氛围、明确视觉焦点、电影感构图，不要出现水印、二维码、UI 边框或多余文字。',
      title ? `作品名：${String(title).slice(0, 80)}` : '',
      mainAxis ? `故事主轴：${String(mainAxis).slice(0, 600)}` : '',
      Array.isArray(tags) && tags.length > 0 ? `标签：${tags.slice(0, 6).join('、')}` : '',
      `作者提示：${cleanPrompt}`,
    ].filter(Boolean).join('\n');

    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      contents: finalPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    } as any);

    const image = extractInlineImageData(response);
    return res.status(200).json({
      imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
    });
  } catch (error) {
    return sendInternalError(res, '封面生成失败', error);
  }
}
