import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';
import path from 'node:path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const payload = req.body ?? {};
    const logPath = path.resolve(process.cwd(), 'debug-e217f3.log');
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

