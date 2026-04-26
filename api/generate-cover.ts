import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const MAX_IMAGE_DATA_CHARS = 3_600_000;

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function sendCoverError(res: VercelResponse, status: number, code: string, message: string, error?: unknown) {
  if (error) {
    console.error(`[generate-cover:${code}]`, error);
  }
  return res.status(status).json({
    error: message,
    code,
    detail: process.env.NODE_ENV === 'production' ? undefined : safeErrorMessage(error),
  });
}

function getImageModelCandidates() {
  const configuredModels = (process.env.GEMINI_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([
    ...configuredModels,
    DEFAULT_IMAGE_MODEL,
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
  ]));
}

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

async function generateCoverImage(ai: GoogleGenAI, prompt: string) {
  let lastError: unknown = null;

  for (const model of getImageModelCandidates()) {
    for (const withImageConfig of [true, false]) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: withImageConfig ? {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: '1:1',
              imageSize: '1K',
            },
          } : {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        } as any);
        const image = extractInlineImageData(response);
        if (String(image.data || '').length > MAX_IMAGE_DATA_CHARS) {
          throw new Error(`Generated image payload is too large: ${String(image.data || '').length} chars.`);
        }
        return { ...image, model };
      } catch (error) {
        lastError = error;
        console.error(`Cover generation failed with ${model}${withImageConfig ? ' + imageConfig' : ''}:`, error);
      }
    }
  }

  const wrapped = new Error(safeErrorMessage(lastError));
  (wrapped as any).cause = lastError;
  throw wrapped;
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
    const image = await generateCoverImage(ai, finalPrompt);
    return res.status(200).json({
      imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
      model: image.model,
    });
  } catch (error) {
    const message = safeErrorMessage(error);
    if (message.includes('Missing valid Gemini API key') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      return sendCoverError(res, 503, 'gemini-api-key', 'AI 服务 API key 配置异常。', error);
    }
    if (message.includes('payload is too large')) {
      return sendCoverError(res, 413, 'image-too-large', '生成图片过大，暂时无法作为作品封面保存。请换一个更简洁的画面提示再试。', error);
    }
    if (message.includes('did not return an image')) {
      return sendCoverError(res, 502, 'no-inline-image', 'AI 服务没有返回图片。请调整提示词后重试。', error);
    }
    return sendInternalError(res, '封面生成失败', error);
  }
}
