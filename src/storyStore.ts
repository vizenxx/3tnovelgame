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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type {
  StoryBranchDoc,
  StoryChapterDoc,
  StoryEndingDoc,
  StoryMeta,
  Visibility,
} from './storyCartridge';

export type StoryListItem = {
  id: string;
  title: string;
  tags: string[];
  visibility: Visibility;
  authorId: string;
  updatedAt: string | any;
  createdAt: string | any;
  version: number;
};

export async function listPublicStories(db: Firestore, pageSize = 20) {
  const q = query(
    collection(db, 'stories'),
    where('visibility', '==', 'public'),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StoryListItem[];
}

export async function listMyStories(db: Firestore, authorId: string, pageSize = 50) {
  const q = query(
    collection(db, 'stories'),
    where('authorId', '==', authorId),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StoryListItem[];
}

export async function createEmptyStory(db: Firestore, args: { authorId: string; title?: string }) {
  const now = new Date().toISOString();
  const meta: Omit<StoryMeta, 'coverUrl'> = {
    title: args.title || '未命名作品',
    main_axis: '（请填写本作主轴/命题/世界观核心）',
    tags: [],
    authorId: args.authorId,
    visibility: 'private',
    endingMode: 'dual',
    endingRates: { left: 40, right: 40 },
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
  const defaultEnding: StoryEndingDoc = { id: 'default', chapter_num: 7, text: '' };
  const leftEnding: StoryEndingDoc = { id: 'left', chapter_num: 7, text: '' };
  const rightEnding: StoryEndingDoc = { id: 'right', chapter_num: 7, text: '' };
  batch.set(doc(db, 'stories', ref.id, 'endings', 'default'), defaultEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'left'), leftEnding);
  batch.set(doc(db, 'stories', ref.id, 'endings', 'right'), rightEnding);
  await batch.commit();

  return ref.id;
}

export async function getStoryMeta(db: Firestore, storyId: string) {
  const snap = await getDoc(doc(db, 'stories', storyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as StoryListItem & StoryMeta;
}

export async function getStoryCartridge(db: Firestore, storyId: string) {
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

export async function saveStoryMeta(db: Firestore, storyId: string, patch: Partial<StoryMeta>) {
  await updateDoc(doc(db, 'stories', storyId), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  } as any);
}

export async function saveStoryChapter(db: Firestore, storyId: string, chapterNum: number, patch: Partial<StoryChapterDoc>) {
  await setDoc(doc(db, 'stories', storyId, 'chapters', String(chapterNum)), {
    ...patch,
    chapter_num: chapterNum,
  } as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function saveStoryEnding(db: Firestore, storyId: string, id: 'default' | 'left' | 'right', patch: Partial<StoryEndingDoc>) {
  await setDoc(doc(db, 'stories', storyId, 'endings', id), { id, chapter_num: 7, ...patch } as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function saveStoryMainlineBundle(db: Firestore, storyId: string, args: {
  metaPatch: Partial<StoryMeta>;
  chapters: Array<Pick<StoryChapterDoc, 'chapter_num' | 'title' | 'summary' | 'present_characters' | 'text'>>;
  endings: Array<Pick<StoryEndingDoc, 'id' | 'text'>>;
}) {
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
    batch.set(doc(db, 'stories', storyId, 'endings', ed.id), { id: ed.id, chapter_num: 7, text: ed.text } as any, { merge: true });
  }

  await batch.commit();
}

export async function upsertStoryBranch(db: Firestore, storyId: string, branchId: string, branch: StoryBranchDoc) {
  await setDoc(doc(db, 'stories', storyId, 'branches', branchId), branch as any, { merge: true });
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function createStoryBranch(db: Firestore, storyId: string, branch: Omit<StoryBranchDoc, 'id'>) {
  const ref = await addDoc(collection(db, 'stories', storyId, 'branches'), { ...branch, id: '' } as any);
  // Persist id field for easier export/compat
  await updateDoc(doc(db, 'stories', storyId, 'branches', ref.id), { id: ref.id } as any);
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
  return ref.id;
}

export async function deleteStoryBranch(db: Firestore, storyId: string, branchId: string) {
  await deleteDoc(doc(db, 'stories', storyId, 'branches', branchId));
  await updateDoc(doc(db, 'stories', storyId), { updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() } as any);
}

export async function deleteStoryCartridge(db: Firestore, storyId: string) {
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

