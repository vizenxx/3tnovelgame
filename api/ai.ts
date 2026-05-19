import type { VercelRequest, VercelResponse } from '@vercel/node';
import generateBlueprint from '../server/routes/generate-blueprint.js';
import generateContinuityNode from '../server/routes/generate-continuity-node.js';
import generateCover from '../server/routes/generate-cover.js';
import generateNextChapter from '../server/routes/generate-next-chapter.js';
import generateSeriesWorld from '../server/routes/generate-series-world.js';
import generateSummary from '../server/routes/generate-summary.js';
import digestChapter from '../server/routes/digest-chapter.js';
import intervene from '../server/routes/intervene.js';

export const maxDuration = 60;

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

const handlers: Record<string, ApiHandler> = {
  'generate-blueprint': generateBlueprint,
  'generate-continuity-node': generateContinuityNode,
  'generate-cover': generateCover,
  'generate-next-chapter': generateNextChapter,
  'generate-series-world': generateSeriesWorld,
  'generate-summary': generateSummary,
  'digest-chapter': digestChapter,
  intervene,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || req.body?.action || '').trim();
  const actionHandler = handlers[action];

  if (!actionHandler) {
    return res.status(404).json({
      error: '未知的 AI 操作。',
      code: 'AI_ACTION_NOT_FOUND',
      action,
    });
  }

  return actionHandler(req, res);
}
