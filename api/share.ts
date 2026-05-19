import type { VercelRequest, VercelResponse } from '@vercel/node';
import { normalizeGenerationLanguage } from '../server/_language.js';
import { defaultShareMeta, escapeHtml, fetchOriginalStoryMeta, fetchSharedStoryMeta, getShareId } from '../server/_shareMeta.js';

const absoluteUrl = (req: VercelRequest, path: string) => {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host || '3tnovelgame.vercel.app';
  return `${proto}://${host}${path}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareId = getShareId(req.query.share || req.query.id);
  const storyId = getShareId(req.query.story);
  const language = normalizeGenerationLanguage(req.query.lang);
  const meta = shareId
    ? (await fetchSharedStoryMeta(shareId, language).catch(() => null)) || defaultShareMeta(shareId, language)
    : (await fetchOriginalStoryMeta(storyId, language).catch(() => null)) || defaultShareMeta(storyId, language);
  const appUrl = shareId
    ? absoluteUrl(req, `/?share=${encodeURIComponent(shareId)}&lang=${encodeURIComponent(language)}`)
    : absoluteUrl(req, `/?story=${encodeURIComponent(storyId)}&lang=${encodeURIComponent(language)}`);
  const pageUrl = shareId
    ? absoluteUrl(req, `/api/share?share=${encodeURIComponent(shareId)}&lang=${encodeURIComponent(language)}`)
    : absoluteUrl(req, `/api/share?story=${encodeURIComponent(storyId)}&lang=${encodeURIComponent(language)}`);
  const imageUrl = shareId
    ? absoluteUrl(req, `/api/share-image?share=${encodeURIComponent(shareId)}&lang=${encodeURIComponent(language)}`)
    : absoluteUrl(req, `/api/share-image?story=${encodeURIComponent(storyId)}&lang=${encodeURIComponent(language)}`);
  const siteName = language === 'en-US' ? 'Fate Interference' : '命运干涉';
  const openLabel = language === 'en-US' ? 'Open this fate line' : '打开这条命运线';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(200).send(`<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />
    <script>window.location.replace(${JSON.stringify(appUrl)});</script>
  </head>
  <body>
    <main style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;line-height:1.7;background:#09090b;color:#f4f4f5;min-height:100vh">
      <h1>${escapeHtml(meta.title)}</h1>
      <p>${escapeHtml(meta.description)}</p>
      <p><a style="color:#a5b4fc" href="${escapeHtml(appUrl)}">${escapeHtml(openLabel)}</a></p>
    </main>
  </body>
</html>`);
}
