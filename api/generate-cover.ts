import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken, requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

const DAILY_LIMIT = 5;
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getFirestoreDatabaseId() {
  return process.env.FIREBASE_DATABASE_ID || process.env.FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
}

function firestoreDocUrl(uid: string, dateKey: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID environment variable.');
  const databaseId = encodeURIComponent(getFirestoreDatabaseId());
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${encodeURIComponent(uid)}/coverGenerationUsage/${encodeURIComponent(dateKey)}`;
}

function readIntegerField(data: any, field: string) {
  const value = data?.fields?.[field]?.integerValue ?? data?.fields?.[field]?.doubleValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function reserveDailyCoverGeneration(uid: string, idToken: string) {
  const dateKey = getTodayKey();
  const url = firestoreDocUrl(uid, dateKey);
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  const readResponse = await fetch(url, { headers });

  let currentCount = 0;
  if (readResponse.ok) {
    currentCount = readIntegerField(await readResponse.json(), 'count');
  } else if (readResponse.status !== 404) {
    throw new Error(`Failed to read cover generation quota: ${readResponse.status}`);
  }

  if (currentCount >= DAILY_LIMIT) {
    return { ok: false, remaining: 0 };
  }

  const nextCount = currentCount + 1;
  const writeResponse = await fetch(`${url}?updateMask.fieldPaths=count&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=date`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: {
        count: { integerValue: String(nextCount) },
        date: { stringValue: dateKey },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  if (!writeResponse.ok) {
    throw new Error(`Failed to update cover generation quota: ${writeResponse.status}`);
  }

  return { ok: true, remaining: Math.max(0, DAILY_LIMIT - nextCount) };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const idToken = getBearerToken(req);
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { prompt, title, mainAxis, tags } = req.body || {};
    const cleanPrompt = String(prompt || '').trim();
    if (cleanPrompt.length < 8) {
      return res.status(400).json({ error: '请先输入更具体的封面生成提示。' });
    }

    const quota = await reserveDailyCoverGeneration(user.uid, idToken);
    if (!quota.ok) {
      return res.status(429).json({ error: '今天的 AI 封面生成次数已经用完。', remaining: quota.remaining });
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
      remaining: quota.remaining,
    });
  } catch (error) {
    return sendInternalError(res, '封面生成失败', error);
  }
}
