import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { storyApi } from './storyApiClient';
import type {
  StoryBranchDoc,
  StoryChapterDoc,
  StoryCharacter,
  StoryEndingDoc,
  StoryMeta,
  Visibility,
} from './storyCartridge';
import { normalizeEndingBias } from './storyCartridge';

const countWords = (text?: string) => {
  const value = (text || '').trim();
  if (!value) return 0;
  const cjk = value.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const words = value.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return cjk + words;
};

const calcAverageChapterWords = (chapters?: Array<{ text?: string }>) => {
  const ready = (chapters || []).filter((chapter) => (chapter?.text || '').trim().length > 0);
  if (ready.length === 0) return 0;
  return Math.round(ready.reduce((sum, chapter) => sum + countWords(chapter.text), 0) / ready.length);
};

const buildCardExcerpt = (mainAxis?: string, chapters?: Array<{ text?: string; summary?: string }>) => {
  const fromChapter = (chapters || []).find((chapter) => (chapter?.text || chapter?.summary || '').trim().length > 0);
  return String(mainAxis || fromChapter?.summary || fromChapter?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
};

const countReadyChapters = (chapters?: Array<{ text?: string }>) => (
  (chapters || []).filter((chapter) => (chapter?.text || '').trim().length > 0).length
);

const canReadStoryRecord = (meta: StoryMeta, currentUserId?: string) => (
  meta.visibility === 'public' ||
  meta.visibility === 'unlisted' ||
  (!!currentUserId && meta.authorId === currentUserId)
);

// Story data is Supabase-first now. Firebase is retained only as an explicit
// emergency fallback when VITE_STORY_BACKEND is set to "firebase".
const useSupabaseStories = () => import.meta.env.VITE_STORY_BACKEND !== 'firebase';

export type StoryListItem = {
  id: string;
  title: string;
  main_axis?: string;
  tags: string[];
  visibility: Visibility;
  authorId: string;
  authorName?: string;
  originalAuthorId?: string | null;
  originalAuthorName?: string;
  intervenerId?: string | null;
  intervenerName?: string;
  coverUrl?: string;
  popularity?: number; // legacy field; replaced by interventionCount
  likeCount?: number;
  interventionCount?: number;
  favoriteCount?: number;
  shareCount?: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  reportCount?: number;
  averageChapterWords?: number;
  chapterCount?: number;
  cardExcerpt?: string;
  allowAdaptation?: boolean;
  endingMode?: 'dual' | 'single';
  endingRates?: { left: number; right: number };
  endingBias?: { leftBaseWeight: number; rightBaseWeight: number };
  endingNames?: { left?: string; right?: string };
  updatedAt: string | any;
  createdAt: string | any;
  version: number;
};

export type SharedStoryRecord = {
  id: string;
  archiveKind?: 'favorite' | 'snapshot';
  snapshotKind?: 'intervened' | 'saved_run';
  contentHash?: string;
  title: string;
  main_axis: string;
  tags: string[];
  characters: StoryCharacter[];
  chapters: StoryChapterDoc[];
  authorId: string;
  authorName?: string;
  originalAuthorId?: string | null;
  originalAuthorName?: string;
  intervenerId?: string | null;
  intervenerName?: string;
  coverUrl?: string;
  sourceStoryId?: string | null;
  averageChapterWords?: number;
  chapterCount?: number;
  cardExcerpt?: string;
  allowAdaptation?: boolean;
  createdAt: string;
  updatedAt: string;
  visibility: 'private' | 'unlisted';
};

export type StoryListSort = 'updated' | 'likes' | 'interventions' | 'favorites' | 'shares' | 'words';

export type UserNotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  storyId?: string | null;
  authorId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export async function listPublicStories(db: Firestore, pageSize = 20, sort: StoryListSort = 'updated') {
  if (useSupabaseStories()) {
    return storyApi<StoryListItem[]>('listPublicStories', { pageSize, sort }, { timeoutMs: 9000, stage: '公开作品列表同步' });
  }
  const orderField = sort === 'likes'
    ? 'likeCount'
    : sort === 'favorites'
    ? 'favoriteCount'
    : sort === 'shares'
    ? 'shareCount'
    : sort === 'words'
    ? 'averageChapterWords'
    : sort === 'interventions'
    ? 'interventionCount'
    : 'updatedAt';
  const q = query(
    collection(db, 'stories'),
    where('visibility', '==', 'public'),
    orderBy(orderField, 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StoryListItem[];
}

export async function getUserProgress(db: Firestore, userId: string, storyId: string) {
  if (useSupabaseStories()) {
    return storyApi<any | null>('getUserProgress', { storyId }, { auth: true, timeoutMs: 8000, stage: '故事进度同步' });
  }
  const progressSnap = await getDoc(doc(db, 'users', userId, 'progress', storyId));
  return progressSnap.exists() ? progressSnap.data() : null;
}

export async function saveUserProgress(db: Firestore, userId: string, storyId: string, payload: Record<string, any>) {
  if (useSupabaseStories()) {
    return storyApi('saveUserProgress', { storyId, payload }, { auth: true });
  }
  await setDoc(doc(db, 'users', userId, 'progress', storyId), {
    ...payload,
    userId,
    storyId,
    savedAt: serverTimestamp(),
  });
}

export async function getAppSettings(db: Firestore) {
  if (useSupabaseStories()) {
    return storyApi<Record<string, any>>('getAppSettings');
  }
  const snapshot = await getDoc(doc(db, 'appSettings', 'global'));
  return snapshot.exists() ? snapshot.data() : {};
}

export async function saveAppSettings(db: Firestore, userId: string, settings: Record<string, any>, isAdmin: boolean) {
  if (useSupabaseStories()) {
    return storyApi('saveAppSettings', { settings, isAdmin }, { auth: true });
  }
  await setDoc(doc(db, 'appSettings', 'global'), {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  }, { merge: true });
}

export async function reserveCoverGenerationUsage(db: Firestore, userId: string, dateKey: string, dailyLimit = 5) {
  if (useSupabaseStories()) {
    return storyApi<number>('reserveCoverUsage', { dateKey }, { auth: true });
  }
  const usageRef = doc(db, 'users', userId, 'coverGenerationUsage', dateKey);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(usageRef);
    const current = Number(snap.data()?.count || 0);
    if (current >= dailyLimit) {
      throw new Error('ä»Šå¤©çš„ AI å°é¢ç”Ÿæˆæ¬¡æ•°å·²ç»ç”¨å®Œã€‚');
    }
    const nextCount = current + 1;
    transaction.set(usageRef, {
      count: nextCount,
      date: dateKey,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return Math.max(0, dailyLimit - nextCount);
  });
}

export async function refundCoverGenerationUsage(db: Firestore, userId: string, dateKey: string) {
  if (useSupabaseStories()) {
    return storyApi('refundCoverUsage', { dateKey }, { auth: true });
  }
  const usageRef = doc(db, 'users', userId, 'coverGenerationUsage', dateKey);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(usageRef);
    const current = Number(snap.data()?.count || 0);
    transaction.set(usageRef, {
      count: Math.max(0, current - 1),
      date: dateKey,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

export async function incrementStoryMetric(db: Firestore, storyId: string, field: 'favoriteCount' | 'reportCount' | 'interventionCount') {
  if (useSupabaseStories()) {
    return storyApi('incrementStoryMetric', { storyId, field }, { auth: true });
  }
  await updateDoc(doc(db, 'stories', storyId), { [field]: increment(1) } as any);
}

export async function incrementShareMetric(db: Firestore, storyId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ shareCount: number }>('incrementShareMetric', { storyId }, { auth: true });
  }
  await updateDoc(doc(db, 'stories', storyId), { shareCount: increment(1) } as any);
  return { shareCount: 0 };
}

export async function listNotifications(db: Firestore, pageSize = 50) {
  if (useSupabaseStories()) {
    return storyApi<UserNotificationItem[]>('listNotifications', { pageSize }, { auth: true, timeoutMs: 8000, stage: '通知同步' });
  }
  return [];
}

export async function markNotificationsRead(db: Firestore) {
  if (useSupabaseStories()) {
    return storyApi('markNotificationsRead', {}, { auth: true, timeoutMs: 8000, stage: '通知已读同步' });
  }
  return { ok: true };
}

export async function likeStory(db: Firestore, storyId: string, userId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ alreadyExists: boolean }>('likeStory', { storyId }, { auth: true });
  }
  const storyRef = doc(db, 'stories', storyId);
  const likeRef = doc(db, 'stories', storyId, 'likes', userId);
  let alreadyExists = false;
  await runTransaction(db as any, async (transaction: any) => {
    const likeSnap = await transaction.get(likeRef);
    if (likeSnap.exists()) {
      alreadyExists = true;
      return;
    }
    transaction.set(likeRef, {
      userId,
      createdAt: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    });
    transaction.update(storyRef, { likeCount: increment(1) });
  });
  return { alreadyExists };
}

export async function unlikeStory(db: Firestore, storyId: string, userId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ removed: boolean }>('unlikeStory', { storyId }, { auth: true });
  }
  const storyRef = doc(db, 'stories', storyId);
  const likeRef = doc(db, 'stories', storyId, 'likes', userId);
  let removed = false;
  await runTransaction(db as any, async (transaction: any) => {
    const likeSnap = await transaction.get(likeRef);
    if (!likeSnap.exists()) return;
    removed = true;
    transaction.delete(likeRef);
    transaction.update(storyRef, { likeCount: increment(-1) });
  });
  return { removed };
}

export async function favoriteStory(db: Firestore, storyId: string, userId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ alreadyExists: boolean }>('favoriteStory', { storyId }, { auth: true });
  }
  const storyRef = doc(db, 'stories', storyId);
  const favoriteRef = doc(db, 'stories', storyId, 'favorites', userId);
  let alreadyExists = false;
  await runTransaction(db as any, async (transaction: any) => {
    const favoriteSnap = await transaction.get(favoriteRef);
    if (favoriteSnap.exists()) {
      alreadyExists = true;
      return;
    }
    transaction.set(favoriteRef, {
      userId,
      createdAt: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    });
    transaction.update(storyRef, { favoriteCount: increment(1) });
  });
  return { alreadyExists };
}

export async function unfavoriteStory(db: Firestore, storyId: string, userId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ removed: boolean }>('unfavoriteStory', { storyId }, { auth: true });
  }
  await deleteDoc(doc(db, 'stories', storyId, 'favorites', userId));
}

export async function reportStory(db: Firestore, storyId: string, userId: string, reason = '') {
  if (useSupabaseStories()) {
    return storyApi<{ alreadyExists: boolean }>('reportStory', { storyId, reason }, { auth: true });
  }
  await updateDoc(doc(db, 'stories', storyId), {
    reportCount: increment(1),
  } as any);
  return { alreadyExists: false };
}

export async function followAuthor(db: Firestore, authorId: string, authorName?: string) {
  if (useSupabaseStories()) {
    return storyApi<{ following: boolean; self?: boolean }>('followAuthor', { authorId, authorName }, { auth: true });
  }
  return { following: true };
}

export async function unfollowAuthor(db: Firestore, authorId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ following: boolean }>('unfollowAuthor', { authorId }, { auth: true });
  }
  return { following: false };
}

export async function getAuthorFollowState(db: Firestore, authorId: string) {
  if (useSupabaseStories()) {
    return storyApi<{ following: boolean }>('getAuthorFollowState', { authorId }, { auth: true });
  }
  return { following: false };
}

export async function getPushConfig() {
  return storyApi<{ publicKey: string; enabled: boolean }>('getPushConfig');
}

export async function savePushSubscription(subscription: PushSubscriptionJSON) {
  return storyApi('savePushSubscription', { subscription }, { auth: true });
}

export async function listMyStories(db: Firestore, authorId: string, pageSize = 50) {
  if (useSupabaseStories()) {
    return storyApi<StoryListItem[]>('listMyStories', { pageSize }, { auth: true, timeoutMs: 9000, stage: '我的作品同步' });
  }
  const q = query(
    collection(db, 'stories'),
    where('authorId', '==', authorId),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StoryListItem[];
}

export async function listAuthorStories(db: Firestore, authorId: string, pageSize = 50) {
  if (useSupabaseStories()) {
    return storyApi<StoryListItem[]>('listAuthorStories', { authorId, pageSize }, { auth: true, timeoutMs: 9000, stage: '作者作品同步' });
  }
  const q = query(
    collection(db, 'stories'),
    where('authorId', '==', authorId),
    where('visibility', 'in', ['public', 'unlisted']),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StoryListItem[];
}

export async function listMySharedStories(db: Firestore, authorId: string, pageSize = 50) {
  if (useSupabaseStories()) {
    return storyApi<SharedStoryRecord[]>('listMySharedStories', { pageSize }, { auth: true, timeoutMs: 9000, stage: '馆藏同步' });
  }
  const q = query(
    collection(db, 'sharedStories'),
    where('authorId', '==', authorId),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  const records = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as SharedStoryRecord[];
  const deduped = new Map<string, SharedStoryRecord>();
  records.forEach((record) => {
    const key = record.sourceStoryId || record.id;
    if (!deduped.has(key)) deduped.set(key, record);
  });
  return Array.from(deduped.values());
}

export async function updateAuthorNameEverywhere(db: Firestore, authorId: string, authorName: string) {
  if (useSupabaseStories()) {
    return storyApi('updateAuthorNameEverywhere', { authorName }, { auth: true });
  }
  const [stories, sharedStories] = await Promise.all([
    listMyStories(db, authorId, 100),
    listMySharedStories(db, authorId, 100),
  ]);

  const batch = writeBatch(db);
  stories.forEach((story) => {
    batch.update(doc(db, 'stories', story.id), {
      authorName,
      updatedAt: new Date().toISOString(),
    });
  });
  sharedStories.forEach((story) => {
    const provenancePatch = story.originalAuthorId === authorId ? { originalAuthorName: authorName } : {};
    batch.update(doc(db, 'sharedStories', story.id), {
      authorName,
      intervenerName: authorName,
      ...provenancePatch,
      updatedAt: new Date().toISOString(),
    });
  });
  await batch.commit();
}

export async function createEmptyStory(db: Firestore, args: { authorId: string; authorName?: string; title?: string; tags?: string[] }) {
  if (useSupabaseStories()) {
    return storyApi<string>('createEmptyStory', { args }, { auth: true });
  }
  const now = new Date().toISOString();
  const meta: StoryMeta = {
    title: args.title || '未命名作品',
    main_axis: '（请填写本作主轴/命题/世界观核心）',
    tags: args.tags || [],
    authorId: args.authorId,
    authorName: args.authorName || `游客+${args.authorId.slice(0, 6).toUpperCase()}`,
    visibility: 'private',
    popularity: 0,
    likeCount: 0,
    interventionCount: 0,
    favoriteCount: 0,
    reportCount: 0,
    averageChapterWords: 0,
    chapterCount: 7,
    cardExcerpt: '',
    allowAdaptation: false,
    endingMode: 'dual',
    endingRates: { left: 40, right: 40 },
    endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
    endingNames: { left: '', right: '' },
    createdAt: now,
    updatedAt: now,
    version: 1,
    defaults: { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
    characters: [
      { id: 'c1', name: '角色一', desc: '（待填写简介）' },
      { id: 'c2', name: '角色二', desc: '（待填写简介）' },
      { id: 'c3', name: '角色三', desc: '（待填写简介）' },
    ],
  };

  const ref = await addDoc(collection(db, 'stories'), {
    ...meta,
    createdAt: now,
    updatedAt: now,
  });

  const batch = writeBatch(db);
  for (let i = 1; i <= 7; i++) {
    const chapter: StoryChapterDoc = {
      chapter_num: i,
      title: `第${i}章`,
      summary: '',
      present_characters: [],
      text: '',
    };
    batch.set(doc(db, 'stories', ref.id, 'chapters', String(i)), chapter);
  }
  const defaultEnding: StoryEndingDoc = { id: 'default', chapter_num: 7, title: '第七章', text: '' };
  const leftEnding: StoryEndingDoc = { id: 'left', chapter_num: 7, title: '左结局', text: '' };
  const rightEnding: StoryEndingDoc = { id: 'right', chapter_num: 7, title: '右结局', text: '' };
  batch.set(doc(db, 'stories', ref.id, 'endings', 'default'), defaultEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'left'), leftEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'right'), rightEnding);
  await batch.commit();

  return ref.id;
}

export async function getStoryMeta(db: Firestore, storyId: string) {
  if (useSupabaseStories()) {
    return storyApi<(StoryListItem & StoryMeta) | null>('getStoryMeta', { storyId });
  }
  const snap = await getDoc(doc(db, 'stories', storyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as StoryListItem & StoryMeta;
}

export async function getStoryCartridge(db: Firestore, storyId: string) {
  if (useSupabaseStories()) {
    return storyApi('getStoryCartridge', { storyId }, { timeoutMs: 12000, stage: '完整故事读取' });
  }
  const metaSnap = await getDoc(doc(db, 'stories', storyId));
  if (!metaSnap.exists()) return null;
  const meta = metaSnap.data() as any as StoryMeta;

  const chaptersSnap = await getDocs(query(collection(db, 'stories', storyId, 'chapters'), orderBy('chapter_num', 'asc')));
  const chapters = chaptersSnap.docs.map(d => d.data() as any as StoryChapterDoc);

  const endingsSnap = await getDocs(collection(db, 'stories', storyId, 'endings'));
  const endings = endingsSnap.docs.map(d => d.data() as any as StoryEndingDoc);

  const branchesSnap = await getDocs(collection(db, 'stories', storyId, 'branches'));
  const branches = branchesSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as any as StoryBranchDoc[];

  return { storyId, meta, chapters, endings, branches };
}

export async function getSharedStoryRecord(db: Firestore, storyId: string, currentUserId?: string) {
  if (useSupabaseStories()) {
    return storyApi('getSharedStoryRecord', { storyId }, { timeoutMs: 12000, stage: '只读故事记录读取' });
  }
  const sharedSnap = await getDoc(doc(db, 'sharedStories', storyId));
  if (sharedSnap.exists()) {
    const data = sharedSnap.data() as SharedStoryRecord;
    
    // Check privacy
    if (data.visibility === 'private' && data.authorId !== currentUserId) {
      return null;
    }

    let sharedChapters = Array.isArray(data.chapters) ? data.chapters : [];
    let sourceMetaForSharedRecord: StoryMeta | null = null;
    if (sharedChapters.length < 7 && data.sourceStoryId) {
      try {
        const sourceMetaSnap = await getDoc(doc(db, 'stories', data.sourceStoryId));
        sourceMetaForSharedRecord = sourceMetaSnap.exists() ? sourceMetaSnap.data() as any as StoryMeta : null;
        if (sourceMetaForSharedRecord && canReadStoryRecord(sourceMetaForSharedRecord, currentUserId)) {
          const sourceChaptersSnap = await getDocs(
            query(collection(db, 'stories', data.sourceStoryId, 'chapters'), orderBy('chapter_num', 'asc'))
          );
          const sourceByNum = new Map(sourceChaptersSnap.docs.map(d => {
            const chapter = d.data() as any as StoryChapterDoc;
            return [chapter.chapter_num, chapter] as const;
          }));
          sharedChapters.forEach((chapter) => sourceByNum.set(chapter.chapter_num, chapter));
          sharedChapters = Array.from(sourceByNum.values()).sort((a, b) => a.chapter_num - b.chapter_num);
        }
      } catch {
        sourceMetaForSharedRecord = null;
      }
    }
    if (typeof (data as any).allowAdaptation !== 'boolean' && data.sourceStoryId && !sourceMetaForSharedRecord) {
      try {
        const sourceMetaSnap = await getDoc(doc(db, 'stories', data.sourceStoryId));
        sourceMetaForSharedRecord = sourceMetaSnap.exists() ? sourceMetaSnap.data() as any as StoryMeta : null;
      } catch {
        sourceMetaForSharedRecord = null;
      }
    }

    return {
      storyId: sharedSnap.id,
      meta: {
        sharedStoryId: sharedSnap.id,
        sourceStoryId: data.sourceStoryId || null,
        title: data.title,
        main_axis: data.main_axis,
        tags: data.tags || [],
        characters: data.characters || [],
        authorId: data.authorId,
        authorName: data.authorName,
        originalAuthorId: data.originalAuthorId || data.sourceStoryId || null,
        originalAuthorName: data.originalAuthorName || (data.originalAuthorId ? `游客+${String(data.originalAuthorId).slice(0, 6).toUpperCase()}` : data.authorName),
        intervenerId: data.intervenerId || data.authorId,
        intervenerName: data.intervenerName || data.authorName,
        coverUrl: (data as any).coverUrl || '',
        visibility: data.visibility || 'unlisted',
    averageChapterWords: data.averageChapterWords || 0,
    chapterCount: data.chapterCount || sharedChapters.length,
    cardExcerpt: data.cardExcerpt || buildCardExcerpt(data.main_axis, sharedChapters),
    allowAdaptation: typeof (data as any).allowAdaptation === 'boolean'
          ? (data as any).allowAdaptation
          : Boolean(sourceMetaForSharedRecord?.allowAdaptation),
      },
    chapters: sharedChapters,
    };
  }

  const metaSnap = await getDoc(doc(db, 'stories', storyId));
  if (!metaSnap.exists()) return null;

  const meta = metaSnap.data() as any as StoryMeta;
  if (meta.visibility !== 'public' && meta.visibility !== 'unlisted') {
    return null;
  }

  const chaptersSnap = await getDocs(
    query(collection(db, 'stories', storyId, 'chapters'), orderBy('chapter_num', 'asc'))
  );
  const chapters = chaptersSnap.docs.map(d => d.data() as any as StoryChapterDoc);

  return {
    storyId,
    meta: {
        ...meta,
        sourceStoryId: storyId,
        coverUrl: meta.coverUrl || '',
        originalAuthorId: meta.authorId,
        originalAuthorName: meta.authorName,
        intervenerId: null,
        intervenerName: '',
    },
    chapters,
  };
}

export async function createSharedStoryRecord(db: Firestore, args: {
  authorId: string;
  authorName?: string;
  title: string;
  main_axis: string;
  tags?: string[];
  characters?: StoryCharacter[];
  chapters: StoryChapterDoc[];
  sourceStoryId?: string | null;
  originalAuthorId?: string | null;
  originalAuthorName?: string;
  intervenerId?: string | null;
  intervenerName?: string;
  averageChapterWords?: number;
  allowAdaptation?: boolean;
  coverUrl?: string;
  visibility?: 'private' | 'unlisted';
  snapshotKind?: 'intervened' | 'saved_run';
  contentHash?: string;
}) {
  if (useSupabaseStories()) {
    return storyApi<string>('createSharedStoryRecord', { args }, { auth: true });
  }
  const now = new Date().toISOString();
  const payload: Omit<SharedStoryRecord, 'id'> = {
    archiveKind: 'snapshot',
    snapshotKind: args.snapshotKind || (args.visibility === 'private' ? 'saved_run' : 'intervened'),
    contentHash: args.contentHash || '',
    title: args.title,
    main_axis: args.main_axis,
    tags: args.tags || [],
    characters: args.characters || [],
    chapters: (args.chapters || []).map((chapter) => ({
      chapter_num: chapter.chapter_num,
      title: chapter.title || '',
      summary: chapter.summary || '',
      present_characters: Array.isArray(chapter.present_characters) ? chapter.present_characters : [],
      text: chapter.text || '',
    })).filter((chapter) => chapter.chapter_num >= 1 && chapter.chapter_num <= 7 && chapter.text.trim().length > 0),
    authorId: args.authorId,
    authorName: args.authorName || `游客+${args.authorId.slice(0, 6).toUpperCase()}`,
    originalAuthorId: args.originalAuthorId || args.sourceStoryId || null,
    originalAuthorName: args.originalAuthorName || (args.originalAuthorId ? `游客+${args.originalAuthorId.slice(0, 6).toUpperCase()}` : args.authorName || `游客+${args.authorId.slice(0, 6).toUpperCase()}`),
    intervenerId: args.intervenerId || args.authorId,
    intervenerName: args.intervenerName || args.authorName || `游客+${args.authorId.slice(0, 6).toUpperCase()}`,
    coverUrl: args.coverUrl || '',
    sourceStoryId: args.sourceStoryId || null,
    averageChapterWords: args.averageChapterWords || calcAverageChapterWords(args.chapters),
    chapterCount: countReadyChapters(args.chapters),
    cardExcerpt: buildCardExcerpt(args.main_axis, args.chapters),
    allowAdaptation: Boolean(args.allowAdaptation),
    createdAt: now,
    updatedAt: now,
    visibility: args.visibility || 'unlisted',
  };

  const ref = await addDoc(collection(db, 'sharedStories'), payload);
  return ref.id;
}

export async function createStorySnapshot(db: Firestore, args: Parameters<typeof createSharedStoryRecord>[1]) {
  return createSharedStoryRecord(db, args);
}

export async function deleteSharedStoryRecord(db: Firestore, sharedStoryId: string, authorId: string) {
  if (useSupabaseStories()) {
    return storyApi('deleteSharedStoryRecord', { sharedStoryId }, { auth: true });
  }
  const ref = doc(db, 'sharedStories', sharedStoryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as any;
  if (data.authorId !== authorId) {
    throw new Error('无权删除这条馆藏记录。');
  }
  await deleteDoc(ref);
}

export async function updateSharedStoryVisibility(
  db: Firestore,
  sharedStoryId: string,
  args: { authorId: string; visibility: 'private' | 'unlisted' }
) {
  if (useSupabaseStories()) {
    return storyApi('updateSharedStoryVisibility', { sharedStoryId, visibility: args.visibility }, { auth: true });
  }
  await updateDoc(doc(db, 'sharedStories', sharedStoryId), {
    authorId: args.authorId,
    visibility: args.visibility,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  } as any);
}

export async function adaptBlueprintToStory(db: Firestore, args: { authorId: string; authorName?: string; blueprint: any; chapters: any[]; conclusionText?: string; tags?: string[] }) {
  if (useSupabaseStories()) {
    return storyApi<string>('adaptBlueprintToStory', { args }, { auth: true });
  }
  const now = new Date().toISOString();
  const bp = args.blueprint;

  const normalizedChars: StoryCharacter[] = (bp.characters || []).slice(0, 5).map((c: any) => ({
    id: c.id || `c${Math.random()}`,
    name: (c.name || '').trim() || '角色',
    desc: (c.desc || '').trim() || '（待填写简介）'
  }));
  if (normalizedChars.length === 0) {
    normalizedChars.push({ id: 'c1', name: '角色一', desc: '（待填写简介）' });
  }

  const meta: StoryMeta = {
    title: bp.title || '从蓝图改编的作品',
    main_axis: bp.main_axis || '（无主轴记录）',
    tags: args.tags || bp.tags || [],
    authorId: args.authorId,
    authorName: args.authorName || `游客+${args.authorId.slice(0, 6).toUpperCase()}`,
    visibility: 'private',
    popularity: 0,
    likeCount: 0,
    interventionCount: 0,
    favoriteCount: 0,
    reportCount: 0,
    averageChapterWords: calcAverageChapterWords(args.chapters as any),
    chapterCount: countReadyChapters(args.chapters as any),
    cardExcerpt: buildCardExcerpt(bp.main_axis, args.chapters as any),
    allowAdaptation: Boolean(bp.allowAdaptation),
    endingMode: bp.endingMode === 'single' ? 'single' : 'dual',
    endingRates: { left: bp.left_mainline_default || 40, right: bp.right_mainline_default || 40 },
    endingBias: normalizeEndingBias(bp.endingBias || { left: bp.left_mainline_default, right: bp.right_mainline_default }),
    endingNames: { left: '', right: '' },
    createdAt: now,
    updatedAt: now,
    version: 1,
    defaults: { targetWordCount: 800, paragraphs: { min: 6, max: 10 } },
    characters: normalizedChars,
    coverUrl: bp.coverUrl || '',
  };

  const ref = await addDoc(collection(db, 'stories'), {
    ...meta,
    createdAt: now,
    updatedAt: now,
  });

  const batch = writeBatch(db);
  const chapterByNum = new Map<number, any>(args.chapters.map(c => [c.chapter_num, c]));
  const bpChapterByNum = new Map<number, any>((bp.chapters || []).map((c: any) => [c.chapter_num, c]));

  for (let i = 1; i <= 7; i++) {
    const activeChap = chapterByNum.get(i) || bpChapterByNum.get(i) || {};
    const chapter: StoryChapterDoc = {
      chapter_num: i,
      title: activeChap.title || `第${i}章`,
      summary: activeChap.summary || '',
      present_characters: (activeChap.present_characters || []).filter((id: string) => normalizedChars.find(c => c.id === id)),
      text: activeChap.text || '',
    };
    batch.set(doc(db, 'stories', ref.id, 'chapters', String(i)), chapter);
  }

  const defaultEnding: StoryEndingDoc = {
    id: 'default',
    chapter_num: 7,
    title: chapterByNum.get(7)?.title || bp.endings?.find((e: any) => e.type === 'normal')?.title || '第七章',
    text: chapterByNum.get(7)?.text || args.conclusionText || bp.endings?.find((e: any) => e.type === 'normal')?.text || ''
  };
  const singleEndingText = defaultEnding.text || bp.endings?.[0]?.text || '';
  const leftEnding: StoryEndingDoc = {
    id: 'left',
    chapter_num: 7,
    title: bp.endings?.find((e: any) => e.type === 'good' || e.type === 'left')?.title || '左结局',
    text: bp.endingMode === 'single' ? singleEndingText : bp.endings?.find((e: any) => e.type === 'good' || e.type === 'left')?.text || ''
  };
  const rightEnding: StoryEndingDoc = {
    id: 'right',
    chapter_num: 7,
    title: bp.endings?.find((e: any) => e.type === 'bad' || e.type === 'right')?.title || '右结局',
    text: bp.endingMode === 'single' ? singleEndingText : bp.endings?.find((e: any) => e.type === 'bad' || e.type === 'right')?.text || ''
  };
  batch.set(doc(db, 'stories', ref.id, 'endings', 'default'), defaultEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'left'), leftEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'right'), rightEnding);

  for (const b of (bp.branches || [])) {
    const isHidden = Boolean(b.is_hidden || b.hidden || b.score >= 5 || b.tier === 'hidden' || b.inject?.hidden);
    const branchDoc: Partial<StoryBranchDoc> = {
      side: b.side === 'left' ? 'left' : 'right',
      tier: b.score >= 5 ? 'large' : b.score >= 3 ? 'large' : b.score >= 2 ? 'medium' : 'small',
      name: b.name || '未命名支线',
      hint: b.hint || '',
      desc: b.desc || b.sceneText || '',
      common: false,
      trigger: b.trigger || { type: 'single', single: { chapterNum: 2, charId: normalizedChars[0].id, action: 'bless' } },
      triggerGroups: b.triggerGroups || (b.trigger ? [b.trigger] : []),
      inject: { ...(b.inject || { mustHappen: [], mustReveal: [], mustChange: [] }), hidden: isHidden },
      sceneText: b.sceneText || b.desc || '',
    };
    batch.set(doc(collection(db, 'stories', ref.id, 'branches')), branchDoc);
  }

  await batch.commit();
  return ref.id;
}

export async function saveStoryMeta(db: Firestore, storyId: string, patch: Partial<StoryMeta>) {
  if (useSupabaseStories()) {
    return storyApi('saveStoryMeta', { storyId, patch }, { auth: true });
  }
  await updateDoc(doc(db, 'stories', storyId), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  } as any);
}

export async function saveStoryChapter(db: Firestore, storyId: string, chapterNum: number, patch: Partial<StoryChapterDoc>) {
  if (useSupabaseStories()) {
    return storyApi('saveStoryChapter', { storyId, chapterNum, patch }, { auth: true });
  }
  await setDoc(doc(db, 'stories', storyId, 'chapters', String(chapterNum)), {
    ...patch,
    chapter_num: chapterNum,
  } as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function saveStoryEnding(db: Firestore, storyId: string, id: 'default' | 'left' | 'right', patch: Partial<StoryEndingDoc>) {
  if (useSupabaseStories()) {
    return storyApi('saveStoryEnding', { storyId, endingId: id, patch }, { auth: true });
  }
  await setDoc(doc(db, 'stories', storyId, 'endings', id), { id, chapter_num: 7, title: patch.title || '', ...patch } as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function saveStoryMainlineBundle(db: Firestore, storyId: string, args: {
  metaPatch: Partial<StoryMeta>;
  chapters: Array<Pick<StoryChapterDoc, 'chapter_num' | 'title' | 'summary' | 'present_characters' | 'text'>>;
  endings: Array<Pick<StoryEndingDoc, 'id' | 'title' | 'text'>>;
}) {
  if (useSupabaseStories()) {
    return storyApi('saveStoryMainlineBundle', { storyId, args }, { auth: true });
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'stories', storyId), {
    ...args.metaPatch,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  } as any);

  for (const ch of args.chapters) {
    batch.set(doc(db, 'stories', storyId, 'chapters', String(ch.chapter_num)), ch as any, { merge: true });
  }
  for (const ed of args.endings) {
    batch.set(doc(db, 'stories', storyId, 'endings', ed.id), { id: ed.id, chapter_num: 7, title: ed.title || '', text: ed.text } as any, { merge: true });
  }

  await batch.commit();
}

export async function upsertStoryBranch(db: Firestore, storyId: string, branchId: string, branch: StoryBranchDoc) {
  if (useSupabaseStories()) {
    return storyApi('upsertStoryBranch', { storyId, branchId, branch }, { auth: true });
  }
  await setDoc(doc(db, 'stories', storyId, 'branches', branchId), branch as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function createStoryBranch(db: Firestore, storyId: string, branch: Omit<StoryBranchDoc, 'id'>) {
  if (useSupabaseStories()) {
    return storyApi<string>('createStoryBranch', { storyId, branch }, { auth: true });
  }
  const ref = await addDoc(collection(db, 'stories', storyId, 'branches'), { ...branch, id: '' } as any);
  // Persist id field for easier export/compat
  await updateDoc(doc(db, 'stories', storyId, 'branches', ref.id), { id: ref.id } as any);
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
  return ref.id;
}

export async function deleteStoryBranch(db: Firestore, storyId: string, branchId: string) {
  if (useSupabaseStories()) {
    return storyApi('deleteStoryBranch', { storyId, branchId }, { auth: true });
  }
  await deleteDoc(doc(db, 'stories', storyId, 'branches', branchId));
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function deleteStoryCartridge(db: Firestore, storyId: string) {
  if (useSupabaseStories()) {
    return storyApi('deleteStoryCartridge', { storyId }, { auth: true });
  }
  const batch = writeBatch(db);
  const chaptersSnap = await getDocs(collection(db, 'stories', storyId, 'chapters'));
  chaptersSnap.docs.forEach(d => batch.delete(d.ref));
  const endingsSnap = await getDocs(collection(db, 'stories', storyId, 'endings'));
  endingsSnap.docs.forEach(d => batch.delete(d.ref));
  const branchesSnap = await getDocs(collection(db, 'stories', storyId, 'branches'));
  branchesSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'stories', storyId));
  await batch.commit();
}
