import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchOriginalStoryMeta, fetchSharedStoryMeta, getShareId } from './_shareMeta.js';

const LOGO_PATH = '/pwa-icon-512.png';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareId = getShareId(req.query.share || req.query.id);
  const storyId = getShareId(req.query.story);
  const meta = shareId
    ? await fetchSharedStoryMeta(shareId).catch(() => null)
    : await fetchOriginalStoryMeta(storyId).catch(() => null);
  const coverUrl = meta?.coverUrl || '';

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');

  if (coverUrl.startsWith('data:image/')) {
    const match = coverUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const [, mimeType, base64] = match;
      const image = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(image);
    }
  }

  if (/^https?:\/\//i.test(coverUrl)) {
    res.setHeader('Location', coverUrl);
    return res.status(302).end();
  }

  res.setHeader('Location', LOGO_PATH);
  return res.status(302).end();
}
