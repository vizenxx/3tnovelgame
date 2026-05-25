import dotenv from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const getLocalSecretsDir = () => (
  process.env.LOCAL_SECRETS_DIR ||
  path.join(os.homedir(), '.3tNovelgame-secrets')
);

export const loadLocalSecrets = (rootDir = process.cwd()) => {
  const secretsDir = getLocalSecretsDir();
  const loaded = [];
  const candidates = [
    path.resolve(secretsDir, '.env'),
    path.resolve(secretsDir, '.env.local'),
    path.resolve(rootDir, '.env'),
    path.resolve(rootDir, '.env.local'),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    dotenv.config({ path: file, override: file.endsWith('.env.local'), quiet: true });
    loaded.push(file);
  }

  if (!process.env.FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
  }

  return { secretsDir, loaded };
};
