import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';
import path from 'node:path';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth';

function sanitizePayload(payload: unknown) {
  const raw = JSON.stringify(payload ?? {});
  return raw.length > 2000 ? `${raw.slice(0, 2000)}...<truncated>` : raw;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    if (process.env.ENABLE_DEBUG_LOG !== 'true') {
      return res.status(404).json({ error: 'Not Found' });
    }

    const logPath = path.resolve(process.cwd(), 'debug-e217f3.log');
    const line = JSON.stringify({
      at: new Date().toISOString(),
      uid: user.uid,
      isAnonymous: user.isAnonymous,
      payload: sanitizePayload(req.body),
    });
    fs.appendFileSync(logPath, `${line}\n`, 'utf8');
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendInternalError(res, '写入调试日志失败', error);
  }
}
