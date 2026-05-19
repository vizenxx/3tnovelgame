import { OAuth2Client } from 'google-auth-library';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isGeminiMisconfiguredError } from './_gemini.js';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_ISSUER = FIREBASE_PROJECT_ID
  ? `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  : '';
const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const oauthClient = new OAuth2Client();

type CertCache = {
  certs: Record<string, string>;
  expiresAt: number;
};

type FirebaseTokenPayload = {
  sub?: string;
  email?: string;
  firebase?: {
    sign_in_provider?: string;
  };
} & Record<string, unknown>;

let certCache: CertCache | null = null;

export type AuthenticatedRequest = VercelRequest & {
  user: {
    uid: string;
    email?: string;
    isAnonymous: boolean;
    token: Record<string, unknown>;
  };
};

export function getBearerToken(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getFirebaseCerts() {
  if (certCache && certCache.expiresAt > Date.now()) {
    return certCache.certs;
  }

  const response = await fetch(FIREBASE_CERT_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase certs: ${response.status}`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  certCache = {
    certs,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };

  return certs;
}

export async function verifyFirebaseToken(idToken: string) {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('Missing FIREBASE_PROJECT_ID environment variable.');
  }

  const certs = await getFirebaseCerts();
  const ticket = await oauthClient.verifySignedJwtWithCertsAsync(
    idToken,
    certs,
    FIREBASE_PROJECT_ID,
    [FIREBASE_ISSUER]
  );

  const payload = ticket.getPayload() as unknown as FirebaseTokenPayload | undefined;
  if (!payload?.sub) {
    throw new Error('Invalid Firebase token payload');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    isAnonymous: payload.firebase?.sign_in_provider === 'anonymous',
    token: payload,
  };
}

export async function requireFirebaseAuth(req: VercelRequest, res: VercelResponse) {
  const idToken = getBearerToken(req);
  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  try {
    const user = await verifyFirebaseToken(idToken);
    (req as AuthenticatedRequest).user = user;
    return user;
  } catch (error) {
    console.error('Firebase auth verification failed:', error);
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

export function sendMethodNotAllowed(res: VercelResponse) {
  return res.status(405).json({ error: 'Method Not Allowed' });
}

export function sendInternalError(
  res: VercelResponse,
  message: string,
  error: unknown,
  extra: Record<string, string> = {}
) {
  console.error(message, error);
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  if (isGeminiMisconfiguredError(error)) {
    return res.status(503).json({
      ...extra,
      error: 'AI 服务配置未完成，请稍后再试。',
    });
  }

  const body: Record<string, string> = { ...extra, error: message };
  if (!isProd) {
    body.detail =
      error instanceof Error ? error.stack || error.message : String(error);
  }

  return res.status(500).json(body);
}
