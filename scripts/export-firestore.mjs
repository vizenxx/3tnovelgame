import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseId = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
const outputPath = process.env.FIRESTORE_EXPORT_PATH || path.resolve('tmp', `firestore-export-${Date.now()}.json`);

if (!serviceAccountPath || !projectId) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID.');
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFilename: serviceAccountPath,
  scopes: ['https://www.googleapis.com/auth/datastore'],
});

const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;

async function authedFetch(url) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token || token}` },
  });
  if (!response.ok) {
    throw new Error(`Firestore request failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function docId(name) {
  return String(name || '').split('/').pop();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

async function listCollection(collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(`${baseUrl}/${collectionPath}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await authedFetch(url.toString());
    for (const document of data.documents || []) {
      docs.push({ id: docId(document.name), ...decodeFields(document.fields || {}) });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function exportStory(story) {
  const [chapters, endings, branches, likes, favorites] = await Promise.all([
    listCollection(`stories/${story.id}/chapters`).catch(() => []),
    listCollection(`stories/${story.id}/endings`).catch(() => []),
    listCollection(`stories/${story.id}/branches`).catch(() => []),
    listCollection(`stories/${story.id}/likes`).catch(() => []),
    listCollection(`stories/${story.id}/favorites`).catch(() => []),
  ]);
  return { ...story, chapters, endings, branches, likes, favorites };
}

async function exportUser(user) {
  const [progress, coverGenerationUsage] = await Promise.all([
    listCollection(`users/${user.id}/progress`).catch(() => []),
    listCollection(`users/${user.id}/coverGenerationUsage`).catch(() => []),
  ]);
  return { ...user, progress, coverGenerationUsage };
}

const [storyMetas, sharedStories, users, appSettings] = await Promise.all([
  listCollection('stories'),
  listCollection('sharedStories'),
  listCollection('users').catch(() => []),
  listCollection('appSettings').catch(() => []),
]);

const stories = [];
for (const story of storyMetas) {
  stories.push(await exportStory(story));
}

const usersWithChildren = [];
for (const user of users) {
  usersWithChildren.push(await exportUser(user));
}

const payload = {
  exportedAt: new Date().toISOString(),
  projectId,
  databaseId,
  counts: {
    stories: stories.length,
    chapters: stories.reduce((sum, story) => sum + story.chapters.length, 0),
    endings: stories.reduce((sum, story) => sum + story.endings.length, 0),
    branches: stories.reduce((sum, story) => sum + story.branches.length, 0),
    sharedStories: sharedStories.length,
    users: usersWithChildren.length,
    progress: usersWithChildren.reduce((sum, user) => sum + user.progress.length, 0),
  },
  stories,
  sharedStories,
  users: usersWithChildren,
  appSettings,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Firestore export written to ${outputPath}`);
console.log(JSON.stringify(payload.counts, null, 2));
