import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, ChevronRight, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft, Heart, Bookmark, Flag, Settings, PenSquare, Archive, ExternalLink, ArrowUp, Download, Sun, Moon, Search, GitBranch, Trophy, Bell, BarChart3, WifiOff } from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { createEmptyStory, createSharedStoryRecord, createStorySnapshot, adaptBlueprintToStory, createStoryBranch, deleteAllNotifications, deleteNotification, deleteSharedStoryRecord, deleteStoryBranch, deleteStoryCartridge, deleteSeriesWorld, favoriteStory, unfavoriteStory, followAuthor, getAppSettings, getAuthorFollowState, getPushConfig, getSharedStoryRecord, getStoryCartridge as getStoryCartridgeStore, getStoryMeta, getUserProgress as getUserProgressStore, incrementShareMetric, incrementStoryMetric, likeStory, unlikeStory, listAuthorStories, listContinuityNodes, listFollowedAuthors, listMySeriesWorlds, listMySharedStories, listMyStories, listNotifications, listPublicStories, markNotificationsRead, refundCoverGenerationUsage, reportStory, reserveCoverGenerationUsage, saveAppSettings, saveContinuityNode, savePushSubscription, saveSeriesWorld, saveStoryMainlineBundle, saveStoryMeta, saveUserProgress as saveUserProgressStore, unfollowAuthor, updateAuthorNameEverywhere, updateSharedStoryVisibility, upsertStoryBranch, type ContinuityNodeRecord, type SeriesWorldRecord } from './storyStore';
import { normalizeEndingBias, type EndingBias } from './storyCartridge';
import { deleteLocalCache, getLocalCache, pruneLocalCache, setLocalCache } from './localCache';
import {
  TUTORIAL_STORY_CARTRIDGE,
  TUTORIAL_PROGRESS_VERSION,
  getTutorialInterventionResult,
  getTutorialEndingText
} from './tutorialCartridge';

const getUserProgress = async (db: any, uid: string, storyId: string) => {
  if (storyId === 'tutorial-cartridge') {
    const val = localStorage.getItem('tutorial-cartridge-progress');
    const parsed = val ? JSON.parse(val) : null;
    return parsed?.tutorialProgressVersion === TUTORIAL_PROGRESS_VERSION ? parsed : null;
  }
  return getUserProgressStore(db, uid, storyId);
};

const saveUserProgress = async (db: any, uid: string, storyId: string, payload: any) => {
  if (storyId === 'tutorial-cartridge') {
    localStorage.setItem('tutorial-cartridge-progress', JSON.stringify({
      ...payload,
      tutorialProgressVersion: TUTORIAL_PROGRESS_VERSION,
    }));
    return;
  }
  return saveUserProgressStore(db, uid, storyId, payload);
};

const getStoryCartridge = async (db: any, storyId: string): Promise<any> => {
  if (storyId === 'tutorial-cartridge') {
    return TUTORIAL_STORY_CARTRIDGE;
  }
  return getStoryCartridgeStore(db, storyId);
};
import { useAppNavigation } from './navigation/useAppNavigation';
import { createIdleStoryListSyncState, updateStoryListSegmentState, type StoryListSegment, type SyncStatus } from './storySyncTypes';
import { StartupShell } from './components/StartupShell';
import { BackNavButton } from './components/BackNavButton';
import { semanticButtonClass, semanticIconButtonClass, semanticMenuButtonClass } from './components/semanticClasses';
import { areStoryChaptersEquivalent, hashStoryChapters } from './storyContentHash';
import { getFriendlyServerError } from './friendlyErrors';
import { createTranslator, getInitialLanguage, LANGUAGE_STORAGE_KEY, type AppLanguage } from './i18n';
import { dictionaries } from './i18n/dictionaries';

const AuthView = lazy(() => import('./components/AuthView').then((module) => ({ default: module.AuthView })));
import { 
  signInWithRedirect,
  signInWithPopup,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged, 
  signOut,
  signInAnonymously,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---
type GameState = 'STORY_SELECT' | 'AUTHORING' | 'THEME_SELECTION' | 'SERIES_WORLD_LIST' | 'SERIES_WORLD_GENERATE' | 'SERIES_WORLD_EDIT' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY' | 'READONLY_STORY' | 'ARCHIVE' | 'ACCOUNT_CENTER';
type NarrativePerson = 'first' | 'second' | 'third';
type EndingMode = 'single' | 'dual';
type AppTheme = 'dark' | 'light';
type StoryLibrarySort = 'updated' | 'likes' | 'interventions' | 'favorites' | 'shares' | 'words';
type AuthoringListSort = 'updated' | 'created' | 'likes' | 'favorites' | 'shares' | 'interventions';
type QuickGenerationMode = 'quiz' | 'advanced';
type QuickQuizStepId = 'worlds' | 'moods' | 'conflict' | 'relationships' | 'interference' | 'length';
type QuickQuizOption = {
  id: string;
  label: Record<AppLanguage, string>;
  tag?: string;
  outline: Record<AppLanguage, string>;
  narrativeHint?: 'ensemble' | 'dual';
  endingMode?: EndingMode;
  targetWordCount?: number;
};
type QuickQuizStep = {
  id: QuickQuizStepId;
  title: Record<AppLanguage, string>;
  subtitle: Record<AppLanguage, string>;
  maxSelections: number;
  options: QuickQuizOption[];
};
type QuickQuizAnswers = Record<QuickQuizStepId, string[]>;
type QuickCharacterSeed = {
  enabled: boolean;
  name: string;
  role: string;
  position: 'protagonist' | 'important' | 'mystery';
  note: string;
};
type QuickGenerationInput = {
  selectedThemes: string[];
  customOutline: string;
  targetWordCount: number;
  narrativePerson: NarrativePerson;
  endingMode: EndingMode;
  endingBias: { leftBaseWeight: number; rightBaseWeight: number };
  seriesContext?: SeriesWorldRecord | null;
  continuityNode?: ContinuityNodeRecord | null;
  seriesSelection?: SeriesSelectionState;
};

type SeriesBaselineRule = {
  id: string;
  detail: string;
  title?: string;
  kind?: string;
  tags?: string[];
};

type SeriesCharacterCard = {
  id: string;
  name: string;
  desc: string;
  role?: string;
  status?: string;
};

type SeriesSelectionState = {
  baselineRuleIds: string[];
  characterIds: string[];
  useContinuity: boolean;
  sourceStoryId: string;
  continuityNodeId: string;
  requiredBranchIds: string[];
  endingId: string;
  hardSettings: string;
};

type SequelGateModalState = {
  storyId: string;
  sourceStoryId: string;
  sourceTitle: string;
  missingBranches: Array<{ id: string; name: string }>;
  missingEnding?: { id: string; name: string };
};

type ConnectivityDrawerState = {
  tone: 'offline' | 'weak' | 'stale' | 'error';
  title: string;
  detail?: string;
};

type FateCompletionRecord = {
  runId: string;
  sourceStoryId: string;
  storyTitle: string;
  endingDomain: 'left' | 'right' | 'middle';
  selectedEndingId: string;
  selectedEndingTitle?: string;
  unlockedBranchIds: string[];
  unlockedBranches: Array<{ id: string; name: string }>;
  historicallyUnlockedBranchIds: string[];
  characterStatuses: Record<string, { status: string; isDead: boolean }>;
  storyConclusion: string;
  chapterSummaries: Array<{ chapterNum: number; title: string; summary: string }>;
  completedAt: string;
  sourceType?: 'auto' | 'archived';
  pinned?: boolean;
};

type PendingSequelInheritance = {
  storyId: string;
  cartridge: any;
  progressData: any;
  requirement: any;
  records: FateCompletionRecord[];
};

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";
const PUBLIC_STORY_LIST_LIMIT = 100;
const MY_STORY_LIST_LIMIT = 80;
const ARCHIVE_STORY_LIST_LIMIT = 80;
const APP_VERSION_LABEL = `Beta v${__APP_VERSION__ || '0.8.0'}`;
const APP_BUILD_LABEL = [__APP_COMMIT__ ? `commit ${__APP_COMMIT__}` : '', __APP_BUILD_ID__ ? `build ${__APP_BUILD_ID__}` : ''].filter(Boolean).join(' · ');
const legacyWorldStateKey = ['canonical', 'World', 'State'].join('');

const makeSeriesItemId = (prefix: string, value: unknown, index: number) => {
  const raw = typeof value === 'string'
    ? value
    : typeof value === 'object' && value
      ? String((value as any).id || (value as any).title || (value as any).name || index + 1)
      : String(index + 1);
  return `${prefix}-${raw.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-+|-+$/g, '') || index + 1}`;
};

const getSeriesBaselineRules = (series?: Partial<SeriesWorldRecord> | null): SeriesBaselineRule[] => {
  if (!series) return [];
  const worldBible = (series.worldBible || {}) as any;
  const source = Array.isArray(worldBible.baselineRules) && worldBible.baselineRules.length > 0
    ? worldBible.baselineRules
    : Array.isArray(series.ironLaws) && series.ironLaws.length > 0
      ? series.ironLaws
      : Array.isArray(worldBible.coreRules)
        ? worldBible.coreRules
        : [];
  return source.map((item: any, index: number) => ({
    id: String(item?.id || makeSeriesItemId('rule', item, index)),
    title: String(item?.title || item?.name || item?.rule || item || `世界基准 ${index + 1}`),
    detail: String(item?.detail || item?.desc || item?.description || item?.rule || item || ''),
    kind: item?.kind || item?.type || 'baseline',
  })).filter((rule: SeriesBaselineRule) => rule.title || rule.detail);
};

const getSeriesCharacterCards = (series?: Partial<SeriesWorldRecord> | null): SeriesCharacterCard[] => {
  if (!series) return [];
  const worldBible = (series.worldBible || {}) as any;
  const source = Array.isArray(worldBible.characterPool) && worldBible.characterPool.length > 0
    ? worldBible.characterPool
    : Array.isArray(worldBible.characters)
      ? worldBible.characters
      : Array.isArray(worldBible.recurringCharacterSeeds)
        ? worldBible.recurringCharacterSeeds
        : [];
  return source.map((item: any, index: number) => ({
    id: String(item?.id || makeSeriesItemId('character', item?.name || item, index)),
    name: String(item?.name || item?.title || `角色${index + 1}`),
    desc: String(item?.desc || item?.description || item?.profile || item?.role || ''),
    role: item?.role || item?.position || '',
    status: item?.status || '',
  })).filter((card: SeriesCharacterCard) => card.name);
};

const buildAppliedSeriesContext = (
  series: SeriesWorldRecord | null | undefined,
  selection?: Partial<SeriesSelectionState> | null,
  continuityNode?: ContinuityNodeRecord | null
) => {
  if (!series) return null;
  const rules = getSeriesBaselineRules(series);
  const cards = getSeriesCharacterCards(series);
  const selectedRuleIds = new Set(selection?.baselineRuleIds?.length ? selection.baselineRuleIds : rules.map((rule) => rule.id));
  const selectedCharacterIds = new Set(selection?.characterIds?.length ? selection.characterIds : cards.map((card) => card.id));
  const appliedBaselineRules = rules.filter((rule) => selectedRuleIds.has(rule.id));
  const selectedCharacterCards = cards.filter((card) => selectedCharacterIds.has(card.id));
  return {
    ...series,
    selectedBaselineRules: appliedBaselineRules,
    selectedCharacterCards,
    selectedContinuityNode: continuityNode || null,
    worldBible: {
      ...(series.worldBible || {}),
      appliedBaselineRules,
      characterPool: selectedCharacterCards,
    },
    ironLaws: appliedBaselineRules.map((rule) => rule.detail || rule.title),
  };
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface Character {
  id: string;
  name: string;
  desc: string;
}

interface Chapter {
  chapter_num: number;
  text: string;
  present_characters: string[];
  title?: string;
  summary?: string;
}

interface Ending {
  type: 'good' | 'normal' | 'bad';
  title?: string;
  text: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaUpdateInfo {
  latestVersion: string;
  latestBuildId: string;
  isIos: boolean;
}

interface Branch {
  id: string;
  name: string;
  score?: number;
  side: 'left' | 'right';
  condition_char: string;
  condition_action: 'bless' | 'curse';
  condition_chapter: number;
  desc: string;
  is_hidden: boolean;
  hint?: string;
}

interface Blueprint {
  title: string;
  main_axis: string;
  tags?: string[];
  narrative_person?: NarrativePerson;
  left_mainline_default: number; // e.g., 80
  right_mainline_default: number; // e.g., 40
  characters: Character[];
  chapters: Chapter[];
  endings: Ending[];
  branches: Branch[];
  endingMode?: 'dual' | 'single';
  endingBias?: { leftBaseWeight: number; rightBaseWeight: number };
  endingNames?: { left?: string; right?: string };
  authorAssets?: {
    defaultChapters?: Record<number, { text: string; title?: string; summary?: string }>;
    endingPrototypes?: { default?: string; left?: string; right?: string };
  };
}

const THEMES = [
  "赛博朋克", "克苏鲁", "神话", "修仙", "末日", "废土", "中世纪", "奇幻",
  "校园", "恋爱", "悬疑", "推理", "星际", "科幻", "武侠", "江湖",
  "现代", "都市", "恐怖", "战争"
];

const THEME_LABEL_EN: Record<string, string> = {
  赛博朋克: 'Cyberpunk',
  克苏鲁: 'Cosmic horror',
  神话: 'Myth',
  修仙: 'Cultivation',
  末日: 'Apocalypse',
  废土: 'Wasteland',
  中世纪: 'Medieval',
  奇幻: 'Fantasy',
  校园: 'Campus',
  恋爱: 'Romance',
  悬疑: 'Mystery',
  推理: 'Detective',
  星际: 'Space opera',
  科幻: 'Sci-fi',
  武侠: 'Wuxia',
  江湖: 'Martial world',
  现代: 'Modern',
  都市: 'Urban',
  恐怖: 'Horror',
  战争: 'War',
};

const NARRATIVE_PERSON_OPTIONS: Array<{ value: NarrativePerson; label: { 'zh-CN': string; 'en-US': string }; hint: { 'zh-CN': string; 'en-US': string } }> = [
  { value: 'third', label: { 'zh-CN': '第三人称', 'en-US': 'Third person' }, hint: { 'zh-CN': '以他/她/他们叙述，适合群像与史诗感。', 'en-US': 'Uses he/she/they narration; good for ensemble and epic stories.' } },
  { value: 'first', label: { 'zh-CN': '第一人称', 'en-US': 'First person' }, hint: { 'zh-CN': '以我/我们叙述，更贴近主角内心。', 'en-US': 'Uses I/we narration; closer to the protagonist’s inner voice.' } },
  { value: 'second', label: { 'zh-CN': '第二人称', 'en-US': 'Second person' }, hint: { 'zh-CN': '以第二人称叙述，适合沉浸式命运体验。', 'en-US': 'Uses you-centered narration for an immersive fate experience.' } },
];

const DISPLAY_TAG_LIMIT = 3;

const stripBookTitle = (value: string) => String(value || '').replace(/[《》]/g, '').trim();
const formatBookTitle = (value: string) => `《${stripBookTitle(value) || '未命名作品'}》`;
const limitFiveChars = (value: string) => Array.from(String(value || '').trim()).slice(0, 5).join('');
const normalizeTagList = (tags: string[] = []) => {
  const seen = new Set<string>();
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, 20);
};
const parseEditableJson = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw || '') as T;
  } catch {
    return fallback;
  }
};
const createEmptySeriesBaselineRule = (index: number) => ({
  id: `rule_${index + 1}`,
  title: '',
  detail: '',
  kind: '世界',
});
const createEmptySeriesCharacterCard = (index: number) => ({
  id: `char_${index + 1}`,
  name: '',
  role: '',
  desc: '',
  status: '',
});
const parseTagInput = (value: string) => normalizeTagList(String(value || '').split('，'));
const createEmptySeriesPlotMaterial = (index: number) => ({
  id: `plot_${index + 1}`,
  title: '',
  tag: '灵感',
  detail: '',
});
const normalizeSeriesPlotMaterial = (note: any, index: number) => {
  if (note && typeof note === 'object') {
    return {
      id: String(note.id || `plot_${index + 1}`),
      title: String(note.title || note.name || `情节素材 ${index + 1}`),
      tag: String(note.tag || note.kind || '灵感'),
      detail: String(note.detail || note.desc || note.description || ''),
      sourceType: note.sourceType,
      sourceId: note.sourceId,
    };
  }
  return {
    id: `plot_${index + 1}`,
    title: `情节素材 ${index + 1}`,
    tag: '灵感',
    detail: String(note || ''),
  };
};
const buildSeriesWorldDraftFromSourceStory = (sourceStory: any) => {
  const meta = sourceStory?.meta || sourceStory || {};
  const title = String(meta.title || sourceStory?.title || '未命名作品').trim();
  const characters = Array.isArray(meta.characters) ? meta.characters : Array.isArray(sourceStory?.characters) ? sourceStory.characters : [];
  const branches = Array.isArray(sourceStory?.branches) ? sourceStory.branches : [];
  const endings = Array.isArray(sourceStory?.endings) ? sourceStory.endings : [];
  return {
    title: `${title}世界观设定`,
    pitch: String(meta.main_axis || meta.description || '').trim(),
    genreTags: normalizeTagList([...(Array.isArray(meta.tags) ? meta.tags : []), ...(Array.isArray(sourceStory?.tags) ? sourceStory.tags : [])]),
    worldBible: {
      worldview: String(meta.main_axis || meta.description || meta.premise || '').trim(),
      baselineRules: [],
      characterPool: characters.map((character: any, index: number) => ({
        id: String(character?.id || `char_${index + 1}`),
        name: String(character?.name || character?.title || `角色 ${index + 1}`).trim(),
        role: String(character?.role || '原作角色').trim(),
        desc: String(character?.desc || character?.description || character?.profile || '').trim(),
        status: '',
      })).filter((character: any) => character.name || character.desc).slice(0, 12),
      plotNotes: [
        ...branches.map((branch: any, index: number) => ({
          id: `branch_${branch?.id || index + 1}`,
          title: String(branch?.name || branch?.title || `支线 ${index + 1}`).trim(),
          tag: '支线',
          detail: String(branch?.desc || branch?.description || branch?.story || branch?.content || '').trim(),
          sourceType: 'branch',
          sourceId: branch?.id || null,
        })),
        ...endings.map((ending: any, index: number) => ({
          id: `ending_${ending?.id || index + 1}`,
          title: String(ending?.title || ending?.name || `结局 ${index + 1}`).trim(),
          tag: '结局',
          detail: String(ending?.text || ending?.content || ending?.summary || '').trim(),
          sourceType: 'ending',
          sourceId: ending?.id || null,
        })),
      ].filter((item: any) => item.title || item.detail).slice(0, 24),
    },
    timelineNotes: '',
    ironLaws: [],
    futureDirections: [],
    visibility: 'private',
  };
};
const formatStoryHeading = (chapter: Pick<Chapter, 'chapter_num' | 'title'>) => {
  const title = String(chapter.title || '').trim();
  return title ? `第${chapter.chapter_num}章：${title}` : `第${chapter.chapter_num}章`;
};
const endingIdToLabel = (id: 'default' | 'left' | 'right' | string) => {
  if (id === 'left') return '左域默认结局';
  if (id === 'right') return '右域默认结局';
  return '中域默认结局';
};

const authoringEndingIdToLabel = (id: 'default' | 'left' | 'right' | string) => {
  if (id === 'default') return '中域默认结局';
  if (id === 'left') return '左域默认结局';
  if (id === 'right') return '右域默认结局';
  if (id.startsWith('left-')) return '左域具体结局';
  if (id.startsWith('right-')) return '右域具体结局';
  if (id.startsWith('middle-')) return '中域具体结局';
  return `具体结局 ${id}`;
};

const endingDomainFromId = (id: string): 'middle' | 'left' | 'right' => {
  if (id === 'left' || id.startsWith('left-')) return 'left';
  if (id === 'right' || id.startsWith('right-')) return 'right';
  return 'middle';
};

const endingDomainTitle = (domain: 'middle' | 'left' | 'right') => {
  if (domain === 'left') return '左结局域';
  if (domain === 'right') return '右结局域';
  return '中结局域';
};

const createEndingIdForDomain = (domain: 'middle' | 'left' | 'right') =>
  `${domain}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const getCurrentLanguageQuery = () => {
  try {
    const language = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return `lang=${encodeURIComponent(language === 'en-US' ? 'en-US' : 'zh-CN')}`;
  } catch (error) {
    return 'lang=zh-CN';
  }
};

const buildSharedStoryUrl = (storyId: string) =>
  `${window.location.origin}/api/share?share=${encodeURIComponent(storyId)}&${getCurrentLanguageQuery()}`;

const buildOriginalStoryUrl = (storyId: string) =>
  `${window.location.origin}/api/share?story=${encodeURIComponent(storyId)}&${getCurrentLanguageQuery()}`;

const buildAppSharedStoryUrl = (storyId: string) =>
  `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(storyId)}&${getCurrentLanguageQuery()}`;

const buildAppOriginalStoryUrl = (storyId: string) =>
  `${window.location.origin}${window.location.pathname}?story=${encodeURIComponent(storyId)}&${getCurrentLanguageQuery()}`;

const ADMIN_USER_IDS = new Set(['LWgIE31RtCTZBiMNF7S9viNE7Aw2']);
type AppFeatureSettings = {
  coverGenerationEnabled: boolean;
};
const DEFAULT_FEATURE_SETTINGS: AppFeatureSettings = {
  coverGenerationEnabled: false,
};
const GUEST_ACCOUNT_RETENTION_DAYS = 180;
const STORY_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const ONBOARDING_STORAGE_KEY = '3t-onboarding-v1-dismissed';
const PUSH_PROMPT_DISMISSED_KEY = '3t-push-prompt-dismissed-v1';
const GUEST_RETENTION_NOTICE =
  '游客账号如果连续 180 天没有登录或打开 app 保持活跃，可能会被系统自动清理。注册成正式账号后，当前作品和记录会继续保留。';

const QUICK_STORY_TEMPLATES: Array<{
  id: string;
  label: string;
  badge: string;
  hint: string;
  tags: string[];
  outline: string;
  person: NarrativePerson;
  endingMode: EndingMode;
  endingBias: { leftBaseWeight: number; rightBaseWeight: number };
}> = [
  {
    id: 'city-mystery',
    label: '都市悬疑',
    badge: '适合快节奏',
    hint: '现代城市、秘密组织、选择代价清楚。',
    tags: ['悬疑', '现代', '命运'],
    outline: '一名普通人在深夜收到一封来自未来的讯息，讯息准确预告了第二天会发生的意外。为了阻止事故，他开始追查讯息来源，却发现每一次拯救都会让另一个人的命运偏离原轨。',
    person: 'third',
    endingMode: 'dual',
    endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
  },
  {
    id: 'ancient-fate',
    label: '古风权谋',
    badge: '适合多线支线',
    hint: '人物关系强，适合支线牵动结局域。',
    tags: ['古风', '权谋', '羁绊'],
    outline: '边境小城的年轻谋士被卷入王朝继承风波。三方势力都以天下安危为名拉拢他，而他发现真正能改变局势的，不是兵权，而是几位被历史忽略的小人物。',
    person: 'third',
    endingMode: 'dual',
    endingBias: { leftBaseWeight: 50, rightBaseWeight: 30 },
  },
  {
    id: 'single-emotion',
    label: '单线情感',
    badge: '适合唯一走向',
    hint: '结局固定，重点在干涉后如何圆回主线。',
    tags: ['治愈', '日常', '遗憾'],
    outline: '一位总是错过重要告别的人，意外获得三次干涉过去片段的机会。无论他如何改变细节，最终都必须学会面对同一个答案。',
    person: 'first',
    endingMode: 'single',
    endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
  },
];

const QUICK_STORY_TEMPLATE_EN: Record<string, { label: string; badge: string; hint: string; tags: string[] }> = {
  'city-mystery': {
    label: 'Urban Mystery',
    badge: 'Fast-paced',
    hint: 'Modern city, secret organizations, clear cost for each choice.',
    tags: ['Mystery', 'Modern', 'Fate'],
  },
  'ancient-fate': {
    label: 'Court Intrigue',
    badge: 'Branch-rich',
    hint: 'Strong character ties, ideal for branches that pull the ending domain.',
    tags: ['Ancient', 'Intrigue', 'Bonds'],
  },
  'single-emotion': {
    label: 'Single-Ending Drama',
    badge: 'One ending',
    hint: 'The ending is fixed; interference changes how the story returns to it.',
    tags: ['Healing', 'Slice of life', 'Regret'],
  },
};

const QUICK_QUIZ_STEPS: QuickQuizStep[] = [
  {
    id: 'worlds',
    title: { 'zh-CN': '想进入怎样的世界？', 'en-US': 'What kind of world?' },
    subtitle: { 'zh-CN': '最多选择 2 个，系统会把它们融合成故事舞台。', 'en-US': 'Pick up to 2. They will become the story stage.' },
    maxSelections: 2,
    options: [
      { id: 'city', label: { 'zh-CN': '都市', 'en-US': 'Urban' }, tag: '都市', outline: { 'zh-CN': '现代都市', 'en-US': 'a modern city' } },
      { id: 'ancient', label: { 'zh-CN': '古风', 'en-US': 'Ancient' }, tag: '古风', outline: { 'zh-CN': '古风时代', 'en-US': 'an ancient-inspired world' } },
      { id: 'fantasy', label: { 'zh-CN': '奇幻', 'en-US': 'Fantasy' }, tag: '奇幻', outline: { 'zh-CN': '奇幻世界', 'en-US': 'a fantasy world' } },
      { id: 'scifi', label: { 'zh-CN': '科幻', 'en-US': 'Sci-fi' }, tag: '科幻', outline: { 'zh-CN': '科幻未来', 'en-US': 'a science-fiction future' } },
      { id: 'apocalypse', label: { 'zh-CN': '末日', 'en-US': 'Apocalypse' }, tag: '末日', outline: { 'zh-CN': '末日废土', 'en-US': 'an apocalyptic wasteland' } },
      { id: 'campus', label: { 'zh-CN': '校园', 'en-US': 'Campus' }, tag: '校园', outline: { 'zh-CN': '校园生活', 'en-US': 'a campus setting' } },
      { id: 'cthulhu', label: { 'zh-CN': '克苏鲁', 'en-US': 'Cosmic horror' }, tag: '克苏鲁', outline: { 'zh-CN': '克苏鲁式未知恐惧', 'en-US': 'cosmic horror and forbidden unknowns' } },
      { id: 'wuxia', label: { 'zh-CN': '武侠', 'en-US': 'Wuxia' }, tag: '武侠', outline: { 'zh-CN': '江湖武侠', 'en-US': 'a wuxia martial world' } },
      { id: 'xianxia', label: { 'zh-CN': '修仙', 'en-US': 'Cultivation' }, tag: '修仙', outline: { 'zh-CN': '修仙宗门', 'en-US': 'a cultivation world' } },
      { id: 'cyberpunk', label: { 'zh-CN': '赛博朋克', 'en-US': 'Cyberpunk' }, tag: '赛博朋克', outline: { 'zh-CN': '赛博朋克城市', 'en-US': 'a cyberpunk city' } },
      { id: 'myth', label: { 'zh-CN': '神话', 'en-US': 'Myth' }, tag: '神话', outline: { 'zh-CN': '神话与人间交错', 'en-US': 'myth crossing into the human world' } },
      { id: 'mystery', label: { 'zh-CN': '悬疑', 'en-US': 'Mystery' }, tag: '悬疑', outline: { 'zh-CN': '悬疑迷局', 'en-US': 'a mystery full of hidden clues' } },
    ],
  },
  {
    id: 'moods',
    title: { 'zh-CN': '希望故事是什么味道？', 'en-US': 'What mood should it have?' },
    subtitle: { 'zh-CN': '最多选择 2 个，让故事更贴近想玩的气质。', 'en-US': 'Pick up to 2 to shape the reading flavor.' },
    maxSelections: 2,
    options: [
      { id: 'hotblood', label: { 'zh-CN': '热血', 'en-US': 'Heroic' }, tag: '热血', outline: { 'zh-CN': '热血而有冲劲', 'en-US': 'heroic and energetic' } },
      { id: 'eerie', label: { 'zh-CN': '诡秘', 'en-US': 'Eerie' }, tag: '诡秘', outline: { 'zh-CN': '诡秘而充满不安', 'en-US': 'eerie and unsettling' } },
      { id: 'healing', label: { 'zh-CN': '治愈', 'en-US': 'Healing' }, tag: '治愈', outline: { 'zh-CN': '治愈但保留遗憾', 'en-US': 'healing with lingering regret' } },
      { id: 'gloomy', label: { 'zh-CN': '阴郁', 'en-US': 'Somber' }, tag: '阴郁', outline: { 'zh-CN': '阴郁压抑', 'en-US': 'somber and heavy' } },
      { id: 'romantic', label: { 'zh-CN': '浪漫', 'en-US': 'Romantic' }, tag: '浪漫', outline: { 'zh-CN': '浪漫而带有命运感', 'en-US': 'romantic with a sense of fate' } },
      { id: 'cruel', label: { 'zh-CN': '残酷', 'en-US': 'Cruel' }, tag: '残酷', outline: { 'zh-CN': '残酷且代价清晰', 'en-US': 'cruel with clear consequences' } },
      { id: 'epic', label: { 'zh-CN': '史诗', 'en-US': 'Epic' }, tag: '史诗', outline: { 'zh-CN': '史诗格局', 'en-US': 'epic in scale' } },
      { id: 'absurd', label: { 'zh-CN': '荒诞', 'en-US': 'Absurd' }, tag: '荒诞', outline: { 'zh-CN': '荒诞又暗藏逻辑', 'en-US': 'absurd but internally logical' } },
      { id: 'lonely', label: { 'zh-CN': '孤独', 'en-US': 'Lonely' }, tag: '孤独', outline: { 'zh-CN': '孤独而克制', 'en-US': 'lonely and restrained' } },
      { id: 'fated', label: { 'zh-CN': '宿命感', 'en-US': 'Fateful' }, tag: '宿命感', outline: { 'zh-CN': '带有强烈宿命感', 'en-US': 'strongly shaped by fate' } },
    ],
  },
  {
    id: 'conflict',
    title: { 'zh-CN': '主线最想围绕什么？', 'en-US': 'What drives the plot?' },
    subtitle: { 'zh-CN': '选择一个核心冲突，故事会围绕它推进。', 'en-US': 'Pick one core conflict for the story to follow.' },
    maxSelections: 1,
    options: [
      { id: 'truth', label: { 'zh-CN': '调查真相', 'en-US': 'Uncover truth' }, tag: '调查', outline: { 'zh-CN': '主线围绕调查真相推进', 'en-US': 'the plot revolves around uncovering the truth' } },
      { id: 'save', label: { 'zh-CN': '拯救某人', 'en-US': 'Save someone' }, tag: '拯救', outline: { 'zh-CN': '主线围绕拯救重要之人推进', 'en-US': 'the plot centers on saving someone important' } },
      { id: 'revenge', label: { 'zh-CN': '复仇', 'en-US': 'Revenge' }, tag: '复仇', outline: { 'zh-CN': '主线围绕复仇与代价推进', 'en-US': 'the plot follows revenge and its cost' } },
      { id: 'escape', label: { 'zh-CN': '逃亡', 'en-US': 'Escape' }, tag: '逃亡', outline: { 'zh-CN': '主线围绕逃亡与追捕推进', 'en-US': 'the plot follows escape and pursuit' } },
      { id: 'power', label: { 'zh-CN': '权力斗争', 'en-US': 'Power struggle' }, tag: '权谋', outline: { 'zh-CN': '主线围绕权力斗争推进', 'en-US': 'the plot revolves around a power struggle' } },
      { id: 'identity', label: { 'zh-CN': '身份秘密', 'en-US': 'Hidden identity' }, tag: '身份秘密', outline: { 'zh-CN': '主线围绕身份秘密推进', 'en-US': 'the plot turns on a hidden identity' } },
      { id: 'survival', label: { 'zh-CN': '灾难求生', 'en-US': 'Survival' }, tag: '求生', outline: { 'zh-CN': '主线围绕灾难求生推进', 'en-US': 'the plot centers on surviving disaster' } },
      { id: 'betrayal', label: { 'zh-CN': '背叛', 'en-US': 'Betrayal' }, tag: '背叛', outline: { 'zh-CN': '主线围绕背叛与信任崩塌推进', 'en-US': 'the plot follows betrayal and broken trust' } },
      { id: 'growth', label: { 'zh-CN': '成长', 'en-US': 'Growth' }, tag: '成长', outline: { 'zh-CN': '主线围绕成长与选择推进', 'en-US': 'the plot follows growth through difficult choices' } },
      { id: 'atonement', label: { 'zh-CN': '赎罪', 'en-US': 'Atonement' }, tag: '赎罪', outline: { 'zh-CN': '主线围绕赎罪与弥补推进', 'en-US': 'the plot follows atonement and repair' } },
    ],
  },
  {
    id: 'relationships',
    title: { 'zh-CN': '想看怎样的人物关系？', 'en-US': 'Which relationships interest you?' },
    subtitle: { 'zh-CN': '最多选择 2 个，系统会把它们变成角色张力。', 'en-US': 'Pick up to 2. They become character tension.' },
    maxSelections: 2,
    options: [
      { id: 'rivals', label: { 'zh-CN': '宿敌', 'en-US': 'Rivals' }, outline: { 'zh-CN': '人物关系包含宿敌式拉扯', 'en-US': 'include rival-like tension' } },
      { id: 'mentor', label: { 'zh-CN': '师徒', 'en-US': 'Mentor/student' }, outline: { 'zh-CN': '人物关系包含师徒羁绊', 'en-US': 'include a mentor-student bond' } },
      { id: 'childhood', label: { 'zh-CN': '青梅竹马', 'en-US': 'Childhood bond' }, outline: { 'zh-CN': '人物关系包含旧日羁绊', 'en-US': 'include a childhood or old bond' } },
      { id: 'frenemy', label: { 'zh-CN': '敌友难分', 'en-US': 'Enemy or ally' }, outline: { 'zh-CN': '人物关系带有敌友难分的暧昧立场', 'en-US': 'include relationships that blur enemy and ally' } },
      { id: 'dual', label: { 'zh-CN': '双主角', 'en-US': 'Dual leads' }, outline: { 'zh-CN': '故事适合双主角互相映照', 'en-US': 'use two leads who mirror each other' }, narrativeHint: 'dual' },
      { id: 'ensemble', label: { 'zh-CN': '群像', 'en-US': 'Ensemble' }, outline: { 'zh-CN': '故事适合群像人物互相牵动', 'en-US': 'use an ensemble cast whose choices affect each other' }, narrativeHint: 'ensemble' },
      { id: 'disguise', label: { 'zh-CN': '伪装身份', 'en-US': 'Disguise' }, outline: { 'zh-CN': '人物关系包含伪装身份与误判', 'en-US': 'include disguises and mistaken assumptions' } },
      { id: 'destined', label: { 'zh-CN': '命定之人', 'en-US': 'Fated bond' }, outline: { 'zh-CN': '人物关系包含命定般的牵引', 'en-US': 'include a fated bond' } },
      { id: 'amnesia', label: { 'zh-CN': '失忆者', 'en-US': 'Amnesiac' }, outline: { 'zh-CN': '人物关系受到失忆或遗忘影响', 'en-US': 'let memory loss affect relationships' } },
      { id: 'traitor', label: { 'zh-CN': '背叛者', 'en-US': 'Traitor' }, outline: { 'zh-CN': '人物关系中隐藏背叛者', 'en-US': 'hide a betrayer among the characters' } },
    ],
  },
  {
    id: 'interference',
    title: { 'zh-CN': '希望干涉带来什么感觉？', 'en-US': 'How should interference feel?' },
    subtitle: { 'zh-CN': '选择一种游戏感，决定故事偏转的力度。', 'en-US': 'Pick the kind of story shift you want.' },
    maxSelections: 1,
    options: [
      { id: 'gentle', label: { 'zh-CN': '温和改写', 'en-US': 'Gentle rewrite' }, outline: { 'zh-CN': '干涉更偏向温和改写，重视唯一走向里的过程变化', 'en-US': 'interference should gently reshape the path within one fixed ending' }, endingMode: 'single' },
      { id: 'branching', label: { 'zh-CN': '明显分歧', 'en-US': 'Clear branches' }, outline: { 'zh-CN': '干涉会制造明显分歧', 'en-US': 'interference should create clear branches' }, endingMode: 'dual' },
      { id: 'butterfly', label: { 'zh-CN': '蝴蝶效应', 'en-US': 'Butterfly effect' }, outline: { 'zh-CN': '小选择会逐步引发蝴蝶效应', 'en-US': 'small choices should gradually create butterfly effects' }, endingMode: 'dual' },
      { id: 'darkcost', label: { 'zh-CN': '黑暗代价', 'en-US': 'Dark cost' }, outline: { 'zh-CN': '每次改变都要有清晰代价', 'en-US': 'every change should carry a visible cost' }, endingMode: 'dual' },
      { id: 'defy', label: { 'zh-CN': '逆天改命', 'en-US': 'Defy fate' }, outline: { 'zh-CN': '干涉应有逆天改命的强烈张力', 'en-US': 'interference should feel like defying fate' }, endingMode: 'dual' },
      { id: 'hiddenTruth', label: { 'zh-CN': '隐藏真相', 'en-US': 'Hidden truth' }, outline: { 'zh-CN': '干涉会逐步揭开隐藏真相', 'en-US': 'interference should uncover hidden truths' }, endingMode: 'dual' },
    ],
  },
  {
    id: 'length',
    title: { 'zh-CN': '想读多长？', 'en-US': 'How long should it read?' },
    subtitle: { 'zh-CN': '决定每章大约字数，不影响 7 章结构。', 'en-US': 'Sets the approximate chapter length, still 7 chapters.' },
    maxSelections: 1,
    options: [
      { id: 'short', label: { 'zh-CN': '轻快', 'en-US': 'Light' }, outline: { 'zh-CN': '篇幅轻快，节奏紧凑', 'en-US': 'keep it light and brisk' }, targetWordCount: 600 },
      { id: 'standard', label: { 'zh-CN': '标准', 'en-US': 'Standard' }, outline: { 'zh-CN': '篇幅标准，兼顾情节和细节', 'en-US': 'use a balanced standard length' }, targetWordCount: 800 },
      { id: 'rich', label: { 'zh-CN': '丰富', 'en-US': 'Rich' }, outline: { 'zh-CN': '篇幅更丰富，增加氛围和人物细节', 'en-US': 'make it richer with more atmosphere and character detail' }, targetWordCount: 1000 },
    ],
  },
];

const createDefaultQuickQuizAnswers = (): QuickQuizAnswers => ({
  worlds: [],
  moods: [],
  conflict: [],
  relationships: [],
  interference: [],
  length: ['standard'],
});

const createDefaultQuickCharacterSeed = (): QuickCharacterSeed => ({
  enabled: false,
  name: '',
  role: '',
  position: 'protagonist',
  note: '',
});

const getLocalDeviceId = () => {
  if (typeof window === 'undefined') return 'server';
  const storageKey = '3t-local-device-id';
  const existing = window.localStorage?.getItem(storageKey);
  if (existing) return existing;
  const next = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage?.setItem(storageKey, next);
  return next;
};

const getSharedStoryIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('share') || urlParams.get('story');
};

const buildFacebookShareUrl = (url: string, quote: string) => {
  const shareUrl = new URL('https://www.facebook.com/sharer/sharer.php');
  shareUrl.searchParams.set('u', url);
  shareUrl.searchParams.set('quote', quote);
  return shareUrl.toString();
};

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const writeClipboardText = async (value: string) => {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return false;
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asSafeArray = <T = any,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const renderCharacterHighlights = (text: string, keyPrefix: string, characters: Character[] = []) => {
  const safeCharacters = asSafeArray<Character>(characters);
  if (safeCharacters.length > 0) {
    const names = safeCharacters.map(c => c.name).filter(Boolean);
    if (names.length > 0) {
      names.sort((a, b) => b.length - a.length);
      const regex = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g');
      const subParts = text.split(regex);
      return subParts.map((subPart, j) => {
        if (names.includes(subPart)) {
          return <span key={`${keyPrefix}-c-${j}`} className="text-indigo-300 font-medium">{subPart}</span>;
        }
        return <span key={`${keyPrefix}-t-${j}`}>{subPart}</span>;
      });
    }
  }
  return <span key={`${keyPrefix}-plain`}>{text}</span>;
};

const renderParagraphWithHighlights = (text: unknown, characters: Character[] = [], changeQuotes: string[] = []) => {
  const parts = stripGeneratedMarkup(text).split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <span key={i} className="text-amber-400 font-bold bg-amber-400/10 px-1 rounded">{part.slice(6, -7)}</span>;
    }

    const quotes = changeQuotes
      .map((quote) => String(quote || '').trim())
      .filter((quote) => quote.length >= 4 && part.includes(quote))
      .sort((a, b) => b.length - a.length);
    if (quotes.length > 0) {
      const regex = new RegExp(`(${quotes.map(escapeRegExp).join('|')})`, 'g');
      return (
        <span key={i}>
          {part.split(regex).map((subPart, j) => (
            quotes.includes(subPart)
              ? <span key={`${i}-h-${j}`} className="rounded bg-amber-400/12 px-1 font-bold text-amber-300">{renderCharacterHighlights(subPart, `${i}-h-${j}`, characters)}</span>
              : renderCharacterHighlights(subPart, `${i}-${j}`, characters)
          ))}
        </span>
      );
    }

    return <span key={i}>{renderCharacterHighlights(part, String(i), characters)}</span>;
  });
};

const GlobalError = ({ errorMsg }: { errorMsg: string | null }) => (
  <AnimatePresence>
    {errorMsg && (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        role="alert"
        aria-live="assertive"
        className="app-toast fixed left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-[6100] w-[min(92vw,28rem)] -translate-x-1/2 rounded-[1.5rem] px-5 py-4 text-center text-sm font-bold leading-relaxed text-zinc-100 backdrop-blur-xl"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-indigo-400 to-sky-300" />
        <div>{errorMsg}</div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InstallAppBanner = ({
  canInstall,
  isStandalone,
  onInstall,
}: {
  canInstall: boolean;
  isStandalone: boolean;
  onInstall: () => void;
}) => {
  const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (isStandalone) return null;
  // Show if native install is available OR if it's iOS (we can show tutorial)
  if (!canInstall && !isIos) return null;

  return (
    <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-bold text-indigo-100">安装到手机桌面</div>
          <div className="text-xs leading-relaxed text-indigo-200/80">
            安装后可像原生应用一样从桌面直接打开，加载也会更稳定。
          </div>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200"
        >
          立即安装
        </button>
      </div>
    </div>
  );
};

const PwaUpdateModal = ({
  updateInfo,
  isApplying,
  onClose,
  onUpdate,
}: {
  updateInfo: PwaUpdateInfo | null;
  isApplying: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) => {
  if (!updateInfo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[3600] bg-black/80 backdrop-blur-sm`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-zinc-800 p-5 shadow-2xl sm:p-6"
        >
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">版本更新</div>
            <h3 className="text-2xl font-black text-white">发现新版 App</h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              当前安装的 PWA 不是最新版。最新版本为 {updateInfo.latestVersion}，建议现在升级后再继续使用。
            </p>
          </div>

          {updateInfo.isIos ? (
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
                <div>1. 点击下方“打开更新页”</div>
                <div>2. 在 Safari 中重新打开本站并等待页面加载完成</div>
                <div>3. 回到主屏幕重新进入 App；如果仍未更新，再从 Safari 重新“添加到主屏幕”</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center"
                >
                  打开更新页
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 font-bold"
                >
                  稍后再说
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isApplying}
                className="py-3 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 font-bold disabled:opacity-50"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={onUpdate}
                disabled={isApplying}
                className="py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
              >
                {isApplying ? '升级中...' : '立即升级'}
              </button>
              {/*
                <CheckCircle2 className="h-4 w-4" />
                全部已读
              </button>
              <button type="button" onClick={() => void clearAllNotifications()} className={semanticButtonClass('danger', { compact: true })} disabled={notificationLoading || notificationItems.length === 0}>
                <Trash2 className="h-4 w-4" />
                清空
              </button>
              */}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const LoadingOverlay = ({ progress, status, subtext, variant = 'default', language = 'zh-CN' }: { progress: number, status: string, subtext?: string, variant?: 'default' | 'bless' | 'curse' | 'ending', language?: AppLanguage }) => {
  const isEnglishOverlay = language === 'en-US';
  const footerLabel = variant === 'default'
    ? (isEnglishOverlay ? 'Weaving causality' : '正在编织因果')
    : variant === 'ending'
    ? (isEnglishOverlay ? 'Ending in motion' : '终局演绎中')
    : (isEnglishOverlay ? 'Reshaping the chain' : '因果链条重塑中');

  return (
  <div className={`fixed inset-0 z-[6000] backdrop-blur-xl flex flex-col items-center justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center transition-colors duration-700 ${
    variant === 'bless' ? 'bg-emerald-950/90' : 
    variant === 'curse' ? 'bg-rose-950/90' : 
    variant === 'ending' ? 'bg-amber-950/90' :
    'bg-zinc-950/90'
  }`}>
    <motion.div
      animate={{ rotate: variant === 'ending' ? 180 : -360, scale: [1, 1.1, 1] }}
      transition={{ rotate: { repeat: Infinity, duration: variant === 'ending' ? 8 : 3, ease: 'linear' }, scale: { repeat: Infinity, duration: 2 } }}
      className="relative mb-7"
    >
      {variant === 'bless' ? (
        <Zap className="h-16 w-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
      ) : variant === 'curse' ? (
        <Skull className="h-16 w-16 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
      ) : variant === 'ending' ? (
        <Sparkles className="h-16 w-16 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
      ) : (
        <RefreshCcw className="h-14 w-14 text-indigo-500" />
      )}
    </motion.div>
    
    <h2 className={`text-4xl font-black mb-2 tracking-tighter ${
      variant === 'bless' ? 'text-emerald-400' : 
      variant === 'curse' ? 'text-rose-500' : 
      variant === 'ending' ? 'text-amber-400' :
      'text-white'
    }`}>
      {status}
    </h2>
    {subtext && <p className="mb-8 max-w-md text-sm leading-relaxed text-zinc-400">{subtext}</p>}
    
    <div className="mb-4 h-2 w-full max-w-md overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 shadow-inner">
      <motion.div 
        className={`h-full transition-all duration-500 ${
          variant === 'bless' ? 'bg-gradient-to-r from-emerald-600 to-teal-400' : 
          variant === 'curse' ? 'bg-gradient-to-r from-rose-700 to-orange-500' : 
          variant === 'ending' ? 'bg-gradient-to-r from-amber-600 to-yellow-400' :
          'bg-gradient-to-r from-indigo-600 to-violet-500'
        }`}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
      />
    </div>
    
    <div className="flex justify-between w-full max-w-md text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">
      <span>{footerLabel}</span>
      <span>{Math.round(progress)}%</span>
    </div>
  </div>
  );
};

const BlockingSyncOverlay = ({
  title,
  detail,
  zIndexClass = 'z-[5200]',
}: {
  title: string;
  detail?: string;
  zIndexClass?: string;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`${safeModalBackdropClass} ${zIndexClass} bg-zinc-950/55 backdrop-blur-md`}
  >
    <motion.div
      initial={{ y: 14, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 10, opacity: 0, scale: 0.98 }}
      className="app-modal-surface w-full max-w-sm rounded-[1.75rem] p-5 text-center backdrop-blur-xl"
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-300" />
      <div className="mt-4 text-sm font-black text-zinc-100">{title}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-300 to-indigo-500"
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          style={{ width: '55%' }}
        />
      </div>
      {detail && <p className="mt-3 text-xs leading-relaxed text-zinc-500">{detail}</p>}
    </motion.div>
  </motion.div>
);

const InlineSyncState = ({
  tone = 'loading',
  title,
  detail,
  actionLabel,
  onAction,
}: {
  tone?: 'loading' | 'error' | 'empty';
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className={`app-card-quiet flex min-h-56 flex-col items-center justify-center rounded-[2rem] p-8 text-center ${
    tone === 'error' ? 'border-amber-500/30 bg-amber-500/10' : ''
  }`}>
    {tone === 'loading' ? (
      <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
    ) : tone === 'error' ? (
      <AlertCircle className="h-8 w-8 text-amber-300" />
    ) : (
      <BookOpen className="h-8 w-8 text-zinc-500" />
    )}
    <div className={`mt-4 text-sm font-black ${tone === 'error' ? 'text-amber-100' : 'text-zinc-200'}`}>{title}</div>
    {tone === 'loading' && (
      <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-300 to-indigo-500"
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          style={{ width: '55%' }}
        />
      </div>
    )}
    {detail && (
      <p className={`mx-auto mt-3 max-w-xl text-xs leading-relaxed ${tone === 'error' ? 'text-amber-100/75' : 'text-zinc-500'}`}>
        {detail}
      </p>
    )}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className={`${semanticButtonClass(tone === 'error' ? 'primary' : 'secondary', { compact: true })} mt-5`}
      >
        <RefreshCcw className="h-4 w-4" />
        {actionLabel}
      </button>
    )}
  </div>
);

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] ${className}`} />
);

const StoryCardSkeleton = () => (
  <div className="story-library-card p-4">
    <div className="flex gap-4">
      <div className="w-28 shrink-0 space-y-3 sm:w-32">
        <SkeletonBlock className="h-28 w-28 rounded-3xl sm:h-32 sm:w-32" />
        <div className="grid gap-2">
          <SkeletonBlock className="h-5" />
          <SkeletonBlock className="h-5" />
          <SkeletonBlock className="h-5" />
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <SkeletonBlock className="h-7 w-3/4" />
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-6 w-16 rounded-lg" />
          <SkeletonBlock className="h-6 w-20 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <SkeletonBlock className="h-10 rounded-xl" />
          <SkeletonBlock className="h-10 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

const ListSkeleton = ({ count = 6, compact = false }: { count?: number; compact?: boolean }) => (
  <div className={compact ? 'grid gap-3' : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'}>
    {Array.from({ length: count }).map((_, index) => (
      compact ? (
        <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="mt-3 h-4 w-full" />
          <SkeletonBlock className="mt-2 h-4 w-4/5" />
        </div>
      ) : (
        <StoryCardSkeleton key={index} />
      )
    ))}
  </div>
);

const ConnectivityDrawer = ({
  state,
  onRetry,
  onHome,
  onDismiss,
}: {
  state: ConnectivityDrawerState | null;
  onRetry: () => void;
  onHome: () => void;
  onDismiss: () => void;
}) => (
  <AnimatePresence>
    {state && (
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.35rem)] z-[6200] mx-auto max-w-2xl rounded-[1.5rem] border border-white/10 bg-zinc-950/92 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${state.tone === 'offline' ? 'bg-rose-500/15 text-rose-200' : state.tone === 'error' ? 'bg-amber-500/15 text-amber-200' : 'bg-indigo-500/15 text-indigo-200'}`}>
            {state.tone === 'offline' ? <WifiOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-zinc-100">{state.title}</div>
            {state.detail && <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-400">{state.detail}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onRetry} className={semanticButtonClass('primary', { compact: true })}>
                <RefreshCcw className="h-4 w-4" />
                重试同步
              </button>
              <button type="button" onClick={onHome} className={semanticButtonClass('secondary', { compact: true })}>
                回到首页
              </button>
              <button type="button" onClick={onDismiss} className={semanticButtonClass('ghost', { compact: true })}>
                继续浏览
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const countChars = (text: string) => text?.trim()?.length || 0;

function summaryEndingCategoryLabel(args: {
  endingMode: 'dual' | 'single' | undefined;
  endingNames: { left?: string; right?: string } | undefined;
  endingLabel: string;
}) {
  const mode = args.endingMode ?? 'dual';
  if (mode === 'single') return '唯一结局';
  if (args.endingLabel === '秩序律') return '左域结局';
  if (args.endingLabel === '混沌终') return '右域结局';
  return '中域结局';
}

const getEndingBias = (source?: any) => normalizeEndingBias(source?.endingBias || source?.endingRates || {
  left: source?.left_mainline_default,
  right: source?.right_mainline_default,
});

const getStoryEndingMode = (source?: any): EndingMode => (
  (source?.endingMode || source?.meta?.endingMode) === 'single' ? 'single' : 'dual'
);

const isSingleEndingStory = (source?: any) => getStoryEndingMode(source) === 'single';

const normalizeEndingBiasPercent = (value: number) => normalizeEndingBias({
  leftBaseWeight: value,
  rightBaseWeight: value,
}).leftBaseWeight;

const clampEndingBiasAxis = (value: number) => Math.max(-70, Math.min(70, Math.round(Number(value) || 0)));

const endingBiasAxisFromBias = (input?: Partial<EndingBias> | { left?: number; right?: number } | null) => {
  const bias = normalizeEndingBias(input);
  return clampEndingBiasAxis(bias.leftBaseWeight - bias.rightBaseWeight);
};

const endingBiasFromAxis = (axis: number) => {
  const value = clampEndingBiasAxis(axis);
  if (value >= 0) {
    const ratio = value / 70;
    return normalizeEndingBias({
      leftBaseWeight: Math.round(40 + ratio * 40),
      rightBaseWeight: Math.round(40 - ratio * 30),
    });
  }
  const ratio = Math.abs(value) / 70;
  return normalizeEndingBias({
    leftBaseWeight: Math.round(40 - ratio * 30),
    rightBaseWeight: Math.round(40 + ratio * 40),
  });
};

const endingBiasAxisLabel = (axis: number) => {
  const value = clampEndingBiasAxis(axis);
  const strength = Math.abs(value);
  if (strength < 10) return '中性';
  const side = value > 0 ? '左域' : '右域';
  if (strength >= 60) return `${side}极强`;
  if (strength >= 45) return `${side}强`;
  if (strength >= 25) return `${side}明显`;
  return `${side}轻微`;
};

const endingBiasPercentLabel = (value: number) => {
  const percent = normalizeEndingBiasPercent(value);
  if (percent >= 75) return '极强';
  if (percent >= 65) return '强';
  if (percent >= 55) return '明显';
  if (percent >= 40) return '普通';
  if (percent >= 30) return '轻微';
  if (percent >= 20) return '较弱';
  return '极弱';
};

const endingBiasStoryCardLabels = (source?: any) => {
  if (isSingleEndingStory(source)) return [
    { side: 'single', label: '唯一走向', value: '', active: true },
  ];
  const bias = getEndingBias(source);
  return [
    { side: 'left', label: '左域', value: endingBiasPercentLabel(bias.leftBaseWeight), active: bias.leftBaseWeight >= bias.rightBaseWeight },
    { side: 'right', label: '右域', value: endingBiasPercentLabel(bias.rightBaseWeight), active: bias.rightBaseWeight >= bias.leftBaseWeight },
  ];
};

const endingDomainFromValue = (value: number): 'left' | 'right' | 'middle' => {
  if (value >= 15) return 'left';
  if (value <= -15) return 'right';
  return 'middle';
};

const endingDomainUserLabel = (domain: 'left' | 'right' | 'middle') => {
  if (domain === 'left') return '左域';
  if (domain === 'right') return '右域';
  return '中域';
};

const inheritedEndingDisplayLabel = (record: Partial<FateCompletionRecord>, requirement?: any) => {
  const titled = String(record.selectedEndingTitle || requirement?.endingName || '').trim();
  if (titled && !['秩序律', '混沌终', '均衡道'].includes(titled)) return titled;
  return `${endingDomainUserLabel((record.endingDomain || requirement?.endingDomain || 'middle') as 'left' | 'right' | 'middle')}结局`;
};

const endingDomainToneClass = (domain: 'left' | 'right' | 'middle') => {
  if (domain === 'left') return 'text-indigo-200 bg-indigo-500/12 border-indigo-400/20';
  if (domain === 'right') return 'text-rose-200 bg-rose-500/12 border-rose-400/20';
  return 'text-zinc-200 bg-zinc-500/12 border-zinc-400/20';
};

const endingDomainCards = (source?: any) => {
  const names = source?.endingNames || {};
  return [
    {
      id: 'middle',
      title: '中结局域',
      label: '中域默认结局',
      hint: '命运没有明显偏向左右时，会进入中结局域；作者也可以为中域设置不同的具体结局。',
    },
    {
      id: 'left',
      title: `${names.left || '左域'}结局`,
      label: '左域默认结局',
      hint: '命运明显偏向左域时进入。左域支线可绑定到不同具体结局。',
    },
    {
      id: 'right',
      title: `${names.right || '右域'}结局`,
      label: '右域默认结局',
      hint: '命运明显偏向右域时进入。右域支线可绑定到不同具体结局。',
    },
  ];
};

const shortUserId = (value?: string | null) => (value || 'guest').slice(0, 6).toUpperCase();

const getUserAuthorName = (value: FirebaseUser | null) => {
  if (!value) return '未知作者';
  if (value.isAnonymous) return `游客+${shortUserId(value.uid)}`;
  return value.displayName || value.email || `用户+${shortUserId(value.uid)}`;
};

const getStoryAuthorName = (story: any) => {
  const meta = story?.meta || story || {};
  return meta.authorName || meta.authorDisplayName || (meta.authorId ? `游客+${shortUserId(meta.authorId)}` : '未知作者');
};
const getOriginalAuthorName = (story: any) => {
  const meta = story?.meta || story || {};
  return meta.originalAuthorName || meta.sourceAuthorName || (meta.originalAuthorId ? `游客+${shortUserId(meta.originalAuthorId)}` : meta.authorName || getStoryAuthorName(story));
};
const getIntervenerName = (story: any) => {
  const meta = story?.meta || story || {};
  return meta.intervenerName || meta.recordOwnerName || meta.authorName || (meta.intervenerId ? `游客+${shortUserId(meta.intervenerId)}` : '');
};

const getStoryTitle = (story: any) => story?.meta?.title || story?.title || '未命名故事';
const getStoryMainAxis = (story: any) => story?.meta?.main_axis || story?.main_axis || '';
const getStoryTags = (story: any) => story?.meta?.tags || story?.tags || [];
const getStoryCoverUrl = (story: any) => story?.meta?.coverUrl || story?.coverUrl || '';
const inferStoryLanguage = (story: any): AppLanguage => {
  const explicit = story?.meta?.language || story?.language || story?.storyLanguage;
  if (explicit === 'en-US' || explicit === 'zh-CN') return explicit;
  const sample = [
    getStoryTitle(story),
    getStoryMainAxis(story),
    getStoryTags(story).join(' '),
    story?.cardExcerpt || story?.meta?.cardExcerpt || '',
  ].join(' ');
  const cjkCount = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
  return cjkCount > latinCount * 0.35 ? 'zh-CN' : 'en-US';
};
const storyMatchesLanguage = (story: any, language: AppLanguage) => inferStoryLanguage(story) === language;

const buildStoryShareText = (title?: string, chapters?: Array<{ text?: string }>) => {
  const safeTitle = stripBookTitle(title || '未命名故事');
  const excerpt = (chapters || [])
    .map((chapter) => String(chapter?.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .find((text) => text.length > 40);
  return excerpt
    ? `《${safeTitle}》\n${excerpt.slice(0, 120)}${excerpt.length > 120 ? '...' : ''}\n\n有人改写了命运，而这一页，留下了它偏离原轨的瞬间。`
    : `《${safeTitle}》\n故事已经开场，命运还没有落笔。来看看它会通往哪里。`;
};

const buildShareClipboardText = (shareText: string, shareUrl: string) => `${shareText}\n\n${shareUrl}`;

const compressImageToSquareDataUrl = async (input: File | string, maxDataUrlLength = 850_000): Promise<string> => {
  const sourceUrl = typeof input === 'string'
    ? input
    : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Image read failed.'));
        reader.readAsDataURL(input);
      });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed.'));
    img.src = sourceUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const side = Math.min(width, height);
  ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 1024, 1024);

  for (const quality of [0.86, 0.78, 0.68, 0.58, 0.48]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxDataUrlLength || quality === 0.48) {
      return dataUrl;
    }
  }

  return canvas.toDataURL('image/jpeg', 0.48);
};

const countStoryWords = (text?: string) => {
  const value = (text || '').trim();
  if (!value) return 0;
  const cjk = value.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const words = value.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return cjk + words;
};

const getAverageChapterWords = (chapters?: Array<{ text?: string }>) => {
  const readyChapters = (chapters || []).filter((chapter) => (chapter.text || '').trim().length > 0);
  if (readyChapters.length === 0) return 0;
  return Math.round(readyChapters.reduce((sum, chapter) => sum + countStoryWords(chapter.text), 0) / readyChapters.length);
};

const getStoryAverageChapterWords = (story: any) => {
  const stored = Number(story?.averageChapterWords ?? story?.meta?.averageChapterWords ?? 0);
  if (stored > 0) return stored;
  const fallback = getAverageChapterWords((story?.chapters || story?.meta?.chapters || []) as Array<{ text?: string }>);
  return fallback > 0 ? fallback : 0;
};

const getStoryCardExcerpt = (mainAxis?: string, chapters?: Array<{ text?: string; summary?: string }>) => {
  const chapterSeed = (chapters || []).find((chapter) => String(chapter?.text || chapter?.summary || '').trim());
  return String(mainAxis || chapterSeed?.summary || chapterSeed?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
};

const getReadyChapterCount = (chapters?: Array<{ text?: string }>) => (
  (chapters || []).filter((chapter) => String(chapter?.text || '').trim()).length
);

const getStoryLikeCount = (story: any) => Number(story?.likeCount ?? story?.meta?.likeCount ?? 0);
const getStoryInterventionCount = (story: any) =>
  Number(story?.interventionCount ?? story?.meta?.interventionCount ?? story?.popularity ?? story?.meta?.popularity ?? 0);
const getStoryFavoriteCount = (story: any) => Number(story?.favoriteCount ?? story?.meta?.favoriteCount ?? 0);
const getStoryShareCount = (story: any) => Number(story?.shareCount ?? story?.meta?.shareCount ?? 0);
const getStoryBranchCount = (story: any) => Number(story?.branchCount ?? story?.meta?.branchCount ?? story?.branches?.length ?? story?.meta?.branches?.length ?? 0);
const getStoryUnlockedBranchCount = (story: any) => Number(story?.unlockedBranchCount ?? story?.meta?.unlockedBranchCount ?? 0);
const getStoryEndingCount = (story: any) => {
  if (isSingleEndingStory(story)) return 1;
  const count = Number(story?.endingCount ?? story?.meta?.endingCount ?? story?.endings?.length ?? story?.meta?.endings?.length ?? 0);
  if (count > 0) return count;
  return 3;
};
const getStoryUnlockedEndingCount = (story: any) => Number(story?.unlockedEndingCount ?? story?.meta?.unlockedEndingCount ?? 0);
const getStoryUpdatedMs = (story: any) => {
  const value = story?.updatedAt?.toDate?.() || story?.updatedAt || story?.createdAt?.toDate?.() || story?.createdAt;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
};
const getStoryCreatedMs = (story: any) => {
  const value = story?.createdAt?.toDate?.() || story?.createdAt || story?.meta?.createdAt?.toDate?.() || story?.meta?.createdAt;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
};
const formatShortDate = (value: number) => {
  if (!value) return '未记录';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value));
};
const getVisibilityLabel = (visibility?: string) => (
  visibility === 'public' ? '公开' : visibility === 'unlisted' ? '非公开链接' : '私人'
);

const sanitizeTextForAdaptation = (input?: string) => {
  const value = String(input || '');
  return value
    .replace(/\[focus\]|\[\/focus\]/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~`#>]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const stripGeneratedMarkup = (value: unknown) => String(value || '')
  .replace(/&lt;\s*\/?\s*mark\s*&gt;/gi, '')
  .replace(/&lt;\s*\/?\s*(?:span|strong|em|b|i|u|p|div|br|code|pre|section|article|aside|font|small|big|center|ruby|rt|rp)(?:\s+[^&]*?)?\s*&gt;/gi, '')
  .replace(/<\s*\/?\s*mark\s*>/gi, '')
  .replace(/<\/?(?:span|strong|em|b|i|u|p|div|br|code|pre|section|article|aside|font|small|big|center|ruby|rt|rp)(?:\s+[^<>]*?)?>/gi, '')
  .replace(/<\/?[a-z][a-z0-9:-]*(?:\s+[^<>]*?)?>/gi, '')
  .replace(/```(?:json|html|xml|markdown|md)?/gi, '')
  .replace(/```/g, '')
  .replace(/\[\/?(?:focus|highlight|mark|changed?|diff|insert|delete)\]/gi, '')
  .replace(/(?:【|「|\[)?(?:高亮|标记|变化标记|highlight|markup)(?:】|」|\])?[：:]/gi, '')
  .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const normalizeChangeHighlightsForClient = (raw: any) => {
  const next: Record<number, string[]> = {};
  (Array.isArray(raw) ? raw : []).forEach((item: any) => {
    const chapterNum = Number(item?.chapter_num ?? item?.chapterNum);
    const quote = stripGeneratedMarkup(item?.quote || '').replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(chapterNum) || quote.length < 4 || quote.length > 160) return;
    next[chapterNum] = [...(next[chapterNum] || []), quote];
  });
  return Object.fromEntries(
    Object.entries(next).map(([chapterNum, quotes]) => [chapterNum, Array.from(new Set(quotes)).slice(0, 6)])
  ) as Record<number, string[]>;
};

const toDefaultArtstyleChapters = (chapters?: Chapter[]) =>
  (chapters || []).map((chapter) => ({
    ...chapter,
    text: sanitizeTextForAdaptation(chapter.text),
  }));

const normalizeCharacters = (chars: Array<{ name: string; desc: string }>) => {
  const trimmed = (chars || []).map(c => ({ name: (c.name || '').trim(), desc: (c.desc || '').trim() }));
  return trimmed.map((c, idx) => ({ id: `c${idx + 1}`, name: c.name || `角色${idx + 1}`, desc: c.desc || '（待填写简介）' }));
};

const chapterOptions = [2, 3, 4, 5, 6] as const;

function triggerPreview(args: {
  triggerType: 'single' | 'count';
  singleChapterNum: number;
  singleCharId: string;
  singleAction: 'bless' | 'curse';
  countCharId: string;
  countAction: 'bless' | 'curse';
  minCount: number;
  upToChapterNum: number;
  characters: Array<{ id: string; name: string }>;
}) {
  const nameOf = (id: string) => args.characters.find(c => c.id === id)?.name || '（未选择角色）';
  const actLabel = (a: 'bless' | 'curse') => (a === 'bless' ? '庇佑' : '磨难');
  const chap = Math.max(2, Math.min(6, Number(args.upToChapterNum || 2)));
  if (args.triggerType === 'single') {
    const c = Math.max(2, Math.min(6, Number(args.singleChapterNum || 2)));
    return `触发条件预览：第${c}章，对「${nameOf(args.singleCharId)}」施加「${actLabel(args.singleAction)}」时触发。`;
  }
  return `触发条件预览：在第${chap}章结算时，「${nameOf(args.countCharId)}」被「${actLabel(args.countAction)}」的累计次数 ≥ ${Math.max(1, Number(args.minCount || 1))} 则触发。`;
}

function formatTriggerCondition(tg: any, characters: any[], isEnglish: boolean) {
  if (!tg) return '';
  const nameOf = (id: string) => characters.find(c => c.id === id)?.name || id || (isEnglish ? '(Unknown Character)' : '（未知角色）');
  
  if (tg.type === 'single' || (!tg.type && tg.single)) {
    const single = tg.single || {};
    const chap = single.chapterNum || 2;
    const charName = nameOf(single.charId);
    const act = isEnglish
      ? (single.action === 'curse' ? 'Hardship' : 'Bless')
      : (single.action === 'curse' ? '磨难' : '庇佑');
    return isEnglish
      ? `Ch. ${chap}: Apply "${act}" to ${charName}`
      : `第${chap}章，对「${charName}」施加「${act}」`;
  } else if (tg.type === 'count' || (!tg.type && tg.count)) {
    const count = tg.count || {};
    const chap = count.upToChapterNum || 6;
    const charName = nameOf(count.charId);
    const act = isEnglish
      ? (count.action === 'curse' ? 'Hardship' : 'Bless')
      : (count.action === 'curse' ? '磨难' : '庇佑');
    const minC = count.minCount || 1;
    return isEnglish
      ? `By Ch. ${chap}: Cumulative "${act}" on ${charName} ≥ ${minC} times`
      : `第${chap}章及以前，对「${charName}」累计施加「${act}」的次数 ≥ ${minC} 次`;
  }
  return '';
}

type ConditionForm = {
  kind: 'single' | 'count';
  singleChapterNum: number;
  singleCharId: string;
  singleAction: 'bless' | 'curse';
  countCharId: string;
  countAction: 'bless' | 'curse';
  minCount: number;
  upToChapterNum: number;
  hint?: string;
};

type ParsedImportCondition = {
  type: 'single' | 'count';
  single?: { chapterNum: number; charName: string; action: 'bless' | 'curse' };
  count?: { upToChapterNum: number; charName: string; action: 'bless' | 'curse'; minCount: number };
  hint?: string;
};

type ParsedImportBranch = {
  name: string;
  side: 'left' | 'right';
  tier: 'small' | 'medium' | 'large';
  isHidden: boolean;
  hint: string;
  sceneText: string;
  common: boolean;
  conditions: ParsedImportCondition[];
};

function pickLabeledText(block: string, labels: string[]): string {
  for (const label of labels) {
    const m = block.match(new RegExp(`${label}\\s*[：:]\\s*([^\\n]+)`));
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function parseAction(raw: string): 'bless' | 'curse' {
  return /curse|磨难/.test(raw) ? 'curse' : 'bless';
}

function parseSide(raw: string): 'left' | 'right' {
  return /right|右/.test(raw) ? 'right' : 'left';
}

function parseTier(raw: string): 'small' | 'medium' | 'large' {
  if (/large|大/.test(raw)) return 'large';
  if (/medium|中/.test(raw)) return 'medium';
  return 'small';
}

function parseHiddenBranch(raw: string): boolean {
  return /hidden|隐|隐藏/.test(raw);
}

function normalizeBranchTier(tier: string): 'small' | 'medium' | 'large' {
  if (tier === 'large') return 'large';
  if (tier === 'medium') return 'medium';
  return 'small';
}

function branchTierLabel(tier: string) {
  const normalized = normalizeBranchTier(tier);
  if (normalized === 'large') return '大';
  if (normalized === 'medium') return '中';
  return '小';
}

function stableBranchSignature(branch: any) {
  if (!branch) return '';
  const normalized = {
    id: String(branch.id || ''),
    name: String(branch.name || ''),
    side: branch.side === 'right' ? 'right' : 'left',
    tier: normalizeBranchTier(branch.tier || 'small'),
    is_hidden: Boolean(branch.is_hidden || branch.hidden || branch.inject?.hidden),
    hint: String(branch.hint || ''),
    desc: String(branch.desc || ''),
    sceneText: String(branch.sceneText || ''),
    trigger: branch.trigger || null,
    triggerGroups: branch.triggerGroups || null,
    condition_char: String(branch.condition_char || ''),
    condition_action: branch.condition_action === 'curse' ? 'curse' : 'bless',
    condition_chapter: Number(branch.condition_chapter || 2),
    endingId: String(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || ''),
  };
  return JSON.stringify(normalized);
}

function parseConditionLine(line: string): ParsedImportCondition | null {
  const text = line.trim();
  if (!text) return null;
  if (/single/i.test(text)) {
    const chapterNum = Number((text.match(/chapter\s*=\s*([2-6])/i) || text.match(/第\s*([2-6])\s*章/) || [])[1] || 2);
    const charName = ((text.match(/character\s*=\s*([^\|\n,，]+)/i) || text.match(/角色\s*[：:]\s*([^\|\n,，]+)/) || [])[1] || '').trim();
    const action = parseAction((text.match(/action\s*=\s*([a-zA-Z\u4e00-\u9fa5]+)/i) || text.match(/(庇佑|磨难)/) || [])[1] || 'bless');
    return { type: 'single', single: { chapterNum: Math.max(2, Math.min(6, chapterNum)), charName, action } };
  }
  if (/count/i.test(text) || /累计/.test(text)) {
    const upToChapterNum = Number((text.match(/upToChapter\s*=\s*([2-6])/i) || text.match(/触发章节\s*[：:=]?\s*([2-6])/) || text.match(/第\s*([2-6])\s*章/) || [])[1] || 6);
    const charName = ((text.match(/character\s*=\s*([^\|\n,，]+)/i) || text.match(/角色\s*[：:]\s*([^\|\n,，]+)/) || [])[1] || '').trim();
    const action = parseAction((text.match(/action\s*=\s*([a-zA-Z\u4e00-\u9fa5]+)/i) || text.match(/(庇佑|磨难)/) || [])[1] || 'bless');
    const minCount = Number((text.match(/minCount\s*=\s*(\d+)/i) || text.match(/累计次数\s*[>=：:]\s*(\d+)/) || text.match(/(\d+)\s*次/) || [])[1] || 1);
    return { type: 'count', count: { upToChapterNum: Math.max(2, Math.min(6, upToChapterNum)), charName, action, minCount: Math.max(1, minCount) } };
  }
  return null;
}

function extractSection(text: string, start: RegExp, end?: RegExp): string {
  const m = text.match(start);
  if (!m || m.index === undefined) return '';
  const from = m.index + m[0].length;
  const rest = text.slice(from);
  if (!end) return rest.trim();
  const e = rest.search(end);
  return (e === -1 ? rest : rest.slice(0, e)).trim();
}

function parseImportedAuthoringText(raw: string) {
  const text = (raw || '').replace(/\r\n/g, '\n').trim();
  const mainline = extractSection(text, /#\s*主线设置[\s\S]*?\n/i, /#\s*支线设置/i);
  const branchesSection = extractSection(text, /#\s*支线设置[\s\S]*?\n/i);

  const title = ((mainline.match(/##\s*标题[^\n]*\n([\s\S]*?)(?=\n##|\n###|$)/i) || [])[1] || '').trim().split('\n').find((s: string) => s.trim()) || '';
  const mainAxis = ((mainline.match(/##\s*主轴[^\n]*\n([\s\S]*?)(?=\n##\s*主要角色|\n##|\n###|$)/i) || [])[1] || '').trim();

  const characters: Array<{ name: string; desc: string }> = [];
  const roleRegex = /###\s*角色\d+[^\n]*\n([\s\S]*?)(?=\n###\s*角色\d+|\n##\s*默认故事|\n##\s*结局|$)/g;
  let roleMatch: RegExpExecArray | null;
  while ((roleMatch = roleRegex.exec(mainline))) {
    const block = roleMatch[1];
    const name = pickLabeledText(block, ['姓名', '名字']) || block.split('\n').map(s => s.trim()).find(Boolean) || '';
    const desc = pickLabeledText(block, ['角色简介', '简介']) || block.split('\n').slice(1).join(' ').trim();
    if (name) characters.push({ name: name.trim(), desc: (desc || '（待填写简介）').trim() });
  }

  const chapters: Array<{ chapter_num: number; title: string; text: string; summary: string }> = [];
  const chapterRegex = /###\s*第\s*([1-6])\s*章[《「"]?([^\n》」"]*)[》」"]?\s*\n([\s\S]*?)(?=\n###\s*第\s*[1-6]\s*章|\n##\s*结局|$)/g;
  let chapterMatch: RegExpExecArray | null;
  while ((chapterMatch = chapterRegex.exec(mainline))) {
    const n = Number(chapterMatch[1]);
    const titleText = (chapterMatch[2] || `第${n}章`).trim() || `第${n}章`;
    const body = chapterMatch[3].replace(/^\s*（正文）\s*$/gm, '').trim();
    chapters.push({ chapter_num: n, title: titleText, text: body.slice(0, 1200), summary: '' });
  }

  const defaultEnding = extractSection(mainline, /###\s*(默认结局|中域默认结局|中结局域)[^\n]*\n/i, /###\s*(左结局|左域默认结局|左结局域|左向默认结局|右结局|右域默认结局|右结局域|右向默认结局)/i).trim();
  const leftEnding = extractSection(mainline, /###\s*(左结局|左域默认结局|左结局域|左向默认结局)[^\n]*\n/i, /###\s*(右结局|右域默认结局|右结局域|右向默认结局)/i).trim();
  const rightEnding = extractSection(mainline, /###\s*(右结局|右域默认结局|右结局域|右向默认结局)[^\n]*\n/i).trim();

  const branches: ParsedImportBranch[] = [];
  const branchRegex = /##\s*支线\d+[^\n]*\n([\s\S]*?)(?=\n##\s*支线\d+|$)/g;
  let branchMatch: RegExpExecArray | null;
  while ((branchMatch = branchRegex.exec(branchesSection))) {
    const block = branchMatch[1];
    const name = pickLabeledText(block, ['支线名']) || '未命名支线';
    const side = parseSide(pickLabeledText(block, ['倾向']));
    const impactRaw = pickLabeledText(block, ['影响']);
    const hiddenRaw = pickLabeledText(block, ['隐藏', '隐']);
    const tier = parseTier(impactRaw);
    const isHidden = parseHiddenBranch(impactRaw) || /true|是|1|yes/i.test(hiddenRaw);
    const hint = pickLabeledText(block, ['提示短句']) || `留意${name}`;
    const common = /true|是|1/.test(pickLabeledText(block, ['通用支线']).toLowerCase());
    const sceneText = extractSection(block, /-\s*支线情节\s*[：:]\s*/i, /\n-\s*(触发后剧情改变|支线名|倾向|影响|隐藏|隐|提示短句|通用支线|触发条件组)/i).trim().slice(0, 300);
    const conditions: ParsedImportCondition[] = [];
    const condMatches = block.match(/条件组\d+\s*[：:]\s*[^\n]+/g) || [];
    for (const c of condMatches) {
      const parsed = parseConditionLine(c);
      if (parsed) conditions.push(parsed);
    }
    const fallbackCondition: ParsedImportCondition = { type: 'single', single: { chapterNum: 2, charName: '', action: 'bless' } };
    branches.push({
      name: name.trim(),
      side,
      tier,
      isHidden,
      hint: hint.trim(),
      sceneText: sceneText || '',
      common,
      conditions: (conditions.length > 0 ? conditions : [fallbackCondition])
        .map((condition, index) => index === 0 && !condition.hint ? { ...condition, hint: hint.trim() } : condition)
        .slice(0, 3),
    });
  }

  return {
    title,
    mainAxis,
    characters,
    chapters,
    endings: { default: defaultEnding.slice(0, 1200), left: leftEnding.slice(0, 1200), right: rightEnding.slice(0, 1200) },
    branches,
  };
}

export default function App() {
  const [appLanguage, setAppLanguageState] = useState<AppLanguage>(() => getInitialLanguage());
  const t = createTranslator(appLanguage, dictionaries);
  const isEnglish = appLanguage === 'en-US';
  const tr = (zh: string, en: string) => (isEnglish ? en : zh);
  const setAppLanguage = (language: AppLanguage) => {
    setAppLanguageState(language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  };

  useEffect(() => {
    document.documentElement.lang = appLanguage;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, appLanguage);
  }, [appLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prune = () => {
      void pruneLocalCache({ maxEntries: 180, maxAgeMs: 45 * 24 * 60 * 60 * 1000 });
    };
    const requestIdle = (window as any).requestIdleCallback as undefined | ((callback: () => void, options?: { timeout?: number }) => number);
    const cancelIdle = (window as any).cancelIdleCallback as undefined | ((id: number) => void);
    if (requestIdle) {
      const id = requestIdle(prune, { timeout: 6000 });
      return () => cancelIdle?.(id);
    }
    const timer = window.setTimeout(prune, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [startupMessage, setStartupMessage] = useState(() => (
    getInitialLanguage() === 'en-US' ? 'Linking the fate archive...' : '正在连接时空枢纽...'
  ));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const {
    viewState: gameState,
    setViewState: setGameState,
    navigateTo,
    resetTo: resetNavigationTo,
    goBack,
    returnStackRef: navigationStackRef,
  } = useAppNavigation<GameState>('STORY_SELECT');
  const resetToHome = () => {
    resetNavigationTo('STORY_SELECT');
  };
  const scrollToTopAfterViewChange = () => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 80);
  };
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState<string | null>(null);
  const [globalLoadingDetail, setGlobalLoadingDetail] = useState<string | null>(null);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [themeInputText, setThemeInputText] = useState('');
  useEffect(() => {
    if (selectedThemes.length > 0 && !themeInputText) {
      setThemeInputText(selectedThemes.join('，'));
    }
  }, [selectedThemes, themeInputText]);
  useEffect(() => {
    if (!isSessionHydrated || !user || typeof window === 'undefined') return;
    if (!window.localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      setShowOnboardingGuide(true);
    }
  }, [isSessionHydrated, user?.uid]);
  useEffect(() => {
    if (!isSessionHydrated || !user || typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'default') return;
    if (window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY)) return;
    const timer = window.setTimeout(() => setShowPushPermissionPrompt(true), 1200);
    return () => window.clearTimeout(timer);
  }, [isSessionHydrated, user?.uid]);
  const [customOutline, setCustomOutline] = useState<string>('');
  const [quickGenerationMode, setQuickGenerationMode] = useState<QuickGenerationMode>('quiz');
  const [quickQuizStepIndex, setQuickQuizStepIndex] = useState(0);
  const [quickQuizAnswers, setQuickQuizAnswers] = useState<QuickQuizAnswers>(() => createDefaultQuickQuizAnswers());
  const [quickCharacterSeed, setQuickCharacterSeed] = useState<QuickCharacterSeed>(() => createDefaultQuickCharacterSeed());
  const [seriesWorlds, setSeriesWorlds] = useState<SeriesWorldRecord[]>([]);
  const [continuityNodes, setContinuityNodes] = useState<ContinuityNodeRecord[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [quickSeriesBindingId, setQuickSeriesBindingId] = useState('');
  const [selectedContinuityNodeId, setSelectedContinuityNodeId] = useState('');
  const [seriesSourceStoryId, setSeriesSourceStoryId] = useState('');
  const [quickContinuitySourceStory, setQuickContinuitySourceStory] = useState<any | null>(null);
  const [quickContinuityLoading, setQuickContinuityLoading] = useState(false);
  const [authoringContinuitySourceStory, setAuthoringContinuitySourceStory] = useState<any | null>(null);
  const [authoringContinuityLoading, setAuthoringContinuityLoading] = useState(false);
  const [quickSeriesSelection, setQuickSeriesSelection] = useState<SeriesSelectionState>({
    baselineRuleIds: [],
    characterIds: [],
    useContinuity: false,
    sourceStoryId: '',
    continuityNodeId: '',
    requiredBranchIds: [],
    endingId: '',
    hardSettings: '',
  });
  const [seriesGenerating, setSeriesGenerating] = useState(false);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesForm, setSeriesForm] = useState<Partial<SeriesWorldRecord>>({
    title: '',
    pitch: '',
    genreTags: [],
    worldBible: {},
    timelineNotes: '',
    ironLaws: [],
    futureDirections: [],
    visibility: 'private',
  });
  const [continuityForm, setContinuityForm] = useState<Partial<ContinuityNodeRecord>>({
    title: '',
    endingDomain: 'middle',
    endingId: 'default',
    requiredBranchIds: [],
    optionalBranchIds: [],
    bridgeSummary: '',
    legacyState: {},
    repairRules: [],
    sequelSeedPrompt: '',
    visibility: 'private',
  });
  const [seriesWorldBibleText, setSeriesWorldBibleText] = useState('{}');
  const [seriesIronLawsText, setSeriesIronLawsText] = useState('[]');
  const [seriesFutureDirectionsText, setSeriesFutureDirectionsText] = useState('[]');
  const [continuityLegacyText, setContinuityLegacyText] = useState('{}');
  const [continuityRepairText, setContinuityRepairText] = useState('[]');
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [changeHighlights, setChangeHighlights] = useState<Record<number, string[]>>({});
  const [interventionsLeft, setInterventionsLeft] = useState(3);
  const [endingValue, setEndingValue] = useState(0);
  const [unlockedBranches, setUnlockedBranches] = useState<Branch[]>([]);
  const [historicallyUnlockedBranches, setHistoricallyUnlockedBranches] = useState<Branch[]>([]);
  const [intervenedChapters, setIntervenedChapters] = useState<number[]>([]);
  const [activeInterventionChapter, setActiveInterventionChapter] = useState<number | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [interventionEffect, setInterventionEffect] = useState<'bless' | 'curse' | null>(null);
  const [activeInterventionOverlay, setActiveInterventionOverlay] = useState<{ type: 'bless' | 'curse' | 'ending', targetChapter: number, statusRaw: string } | null>(null);
  const [branchUnlockNotice, setBranchUnlockNotice] = useState<Branch | null>(null);
  const [interventionStatusNotice, setInterventionStatusNotice] = useState<{
    updates: Array<{ id: string; name: string; status: string; isDead: boolean }>;
  } | null>(null);
  const [characterStatuses, setCharacterStatuses] = useState<Record<string, { status: string, isDead: boolean }>>({});
  const [storyConclusion, setStoryConclusion] = useState<string | null>(null);
  const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingSummaryRequest, setPendingSummaryRequest] = useState<'auto_interventions' | 'manual' | null>(null);
  /** 总结页入口：三次干涉耗尽自动进入 vs 手动结束游玩 */
  const [summaryEntrySource, setSummaryEntrySource] = useState<'auto_interventions' | 'manual' | null>(null);
  const [uiFeedback, setUiFeedback] = useState<{leftProgress: number, rightProgress: number, endingLabel: string}>({leftProgress: 0, rightProgress: 0, endingLabel: "中域"});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<FirestoreErrorInfo | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isStoryInfoOpen, setIsStoryInfoOpen] = useState(false);
  const [isTallNarrowViewport, setIsTallNarrowViewport] = useState(false);
  const [naturalChapters, setNaturalChapters] = useState<Chapter[]>([]);
  // 用于“重新干涉”回滚到干涉前的初始剧情版本
  const [initialNaturalChapters, setInitialNaturalChapters] = useState<Chapter[]>([]);
  /** 总结页/弹窗打开后，禁止未完成的章节生成回写 chapters，避免干扰总结 UI */
  const suppressChapterWritesRef = useRef(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [targetWordCount, setTargetWordCount] = useState(600);
  const [narrativePerson, setNarrativePerson] = useState<NarrativePerson>('third');
  const [quickEndingMode, setQuickEndingMode] = useState<EndingMode>('dual');
  const [quickEndingBias, setQuickEndingBias] = useState({ leftBaseWeight: 40, rightBaseWeight: 40 });
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallModal, setShowIosInstallModal] = useState<boolean>(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [optimisticLikedStoryIds, setOptimisticLikedStoryIds] = useState<Set<string>>(() => new Set());
  const [optimisticFavoritedStoryIds, setOptimisticFavoritedStoryIds] = useState<Set<string>>(() => new Set());
  const [sharedStoryId, setSharedStoryId] = useState<string | null>(null);
  const [readonlyStoryData, setReadonlyStoryData] = useState<{ meta: any, chapters: Chapter[] } | null>(null);
  const [readonlyCanGoBack, setReadonlyCanGoBack] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [showSafariGuide, setShowSafariGuide] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [myBio, setMyBio] = useState('');
  const [editingBio, setEditingBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [isAccountCenterOpen, setIsAccountCenterOpen] = useState(false);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [isEditBioModalOpen, setIsEditBioModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [accountCenterMode, setAccountCenterMode] = useState<'personal' | 'settings'>('personal');
  const [isCreationDockOpen, setIsCreationDockOpen] = useState(false);
  const [showLeaveGameModal, setShowLeaveGameModal] = useState(false);
  const [pendingProgressToLoad, setPendingProgressToLoad] = useState<{ id: string, data: any } | null>(null);

  const [dismissedHelpCards, setDismissedHelpCards] = useState<Record<string, boolean>>(() => {
    try {
      const val = localStorage.getItem('dismissed-help-cards');
      return val ? JSON.parse(val) : {};
    } catch {
      return {};
    }
  });

  const dismissHelpCard = (key: string) => {
    setDismissedHelpCards(prev => {
      const next = { ...prev, [key]: true };
      localStorage.setItem('dismissed-help-cards', JSON.stringify(next));
      return next;
    });
  };

  const restoreHelpCards = () => {
    setDismissedHelpCards({});
    localStorage.removeItem('dismissed-help-cards');
    setErrorMsg(isEnglish ? 'All onboarding helper cards have been restored!' : '已成功恢复所有新手引导卡片！');
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const [tourStep, setTourStep] = useState<number | null>(null);
  const [helpSearch, setHelpSearch] = useState('');
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);



  // Cartridge platform state
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [activeStoryMeta, setActiveStoryMeta] = useState<any | null>(null);
  const [publicStories, setPublicStories] = useState<any[]>([]);
  const [myStories, setMyStories] = useState<any[]>([]);
  const [mySharedStories, setMySharedStories] = useState<any[]>([]);
  const [storyListSyncState, setStoryListSyncState] = useState(createIdleStoryListSyncState);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'private' | 'unlisted'>('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Record<string, boolean>>({});
  const [archiveChoiceStoryId, setArchiveChoiceStoryId] = useState<string | null>(null);
  const [archiveTab, setArchiveTab] = useState<'favorite' | 'saved' | 'authors'>('favorite');
  const [followedAuthors, setFollowedAuthors] = useState<Array<{ authorId: string; authorName: string; followedAt: string }>>([]);
  const [followedAuthorsLoading, setFollowedAuthorsLoading] = useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [playingTocOpen, setPlayingTocOpen] = useState(false);
  const [readonlyReturnTarget, setReadonlyReturnTarget] = useState<GameState>('STORY_SELECT');
  const [archiveReturnTarget, setArchiveReturnTarget] = useState<GameState>('STORY_SELECT');
  const [storyLibraryTab, setStoryLibraryTab] = useState<'mine' | 'public'>('public');
  const [storyLibrarySearch, setStoryLibrarySearch] = useState('');
  const [storyLibraryVisibilityFilter, setStoryLibraryVisibilityFilter] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
  const [storyLibrarySort, setStoryLibrarySort] = useState<StoryLibrarySort>('updated');
  const [storyDetailStory, setStoryDetailStory] = useState<any | null>(null);
  const [authoringListSearch, setAuthoringListSearch] = useState('');
  const [authoringListVisibilityFilter, setAuthoringListVisibilityFilter] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
  const [authoringSeriesKindFilter, setAuthoringSeriesKindFilter] = useState<'all' | 'standalone' | 'series'>('all');
  const [authoringSeriesWorldFilter, setAuthoringSeriesWorldFilter] = useState('all');
  const [authoringCreatedFilter, setAuthoringCreatedFilter] = useState<'all' | '7d' | '30d' | '365d'>('all');
  const [authoringListSort, setAuthoringListSort] = useState<AuthoringListSort>('updated');
  const [authorPulseNotifications, setAuthorPulseNotifications] = useState<Array<{
    id: string;
    storyId?: string;
    title: string;
    detail: string;
    tone: 'like' | 'favorite' | 'share' | 'intervention' | 'encourage';
  }>>([]);
  const [authorProfileTarget, setAuthorProfileTarget] = useState<{ authorId: string; authorName: string } | null>(null);
  const [authorProfileStories, setAuthorProfileStories] = useState<any[]>([]);
  const [authorProfileLoading, setAuthorProfileLoading] = useState(false);
  const [authorProfileFollowing, setAuthorProfileFollowing] = useState(false);
  const [authorProfileBusy, setAuthorProfileBusy] = useState(false);
  const [authorProfileBio, setAuthorProfileBio] = useState('');
  const [pushSubscribeBusy, setPushSubscribeBusy] = useState(false);
  const [showPushPermissionPrompt, setShowPushPermissionPrompt] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    storyId?: string | null;
    authorId?: string | null;
    createdAt: string;
    readAt?: string | null;
    local?: boolean;
  }>>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [shareComposer, setShareComposer] = useState<ShareData | null>(null);
  const [shareComposerText, setShareComposerText] = useState('');
  const shareComposerResolveRef = useRef<((success: boolean) => void) | null>(null);
  const authorMetricSnapshotRef = useRef<Map<string, { like: number; favorite: number; share: number; intervention: number }>>(new Map());
  const authorPulseInitializedRef = useRef(false);
  const storySelectScrollYRef = useRef(0);
  const [storyImportCode, setStoryImportCode] = useState('');
  const [authoringCustomTagsInput, setAuthoringCustomTagsInput] = useState('');
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [storyListLoadError, setStoryListLoadError] = useState<string | null>(null);
  const [storyLaunchOverlay, setStoryLaunchOverlay] = useState<{ progress: number; status: string } | null>(null);
  const [authoringStoryId, setAuthoringStoryId] = useState<string | null>(null);
  const [authoringCartridge, setAuthoringCartridge] = useState<any | null>(null);
  const [authoringSaving, setAuthoringSaving] = useState(false);
  const [authoringLoadingStoryId, setAuthoringLoadingStoryId] = useState<string | null>(null);
  const [authoringCoverPrompt, setAuthoringCoverPrompt] = useState('');
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverGenerationRemaining, setCoverGenerationRemaining] = useState<number | null>(null);
  const [featureSettings, setFeatureSettings] = useState<AppFeatureSettings>(DEFAULT_FEATURE_SETTINGS);
  const [adminFeatureDraft, setAdminFeatureDraft] = useState<AppFeatureSettings>(DEFAULT_FEATURE_SETTINGS);
  const [isSavingAdminSettings, setIsSavingAdminSettings] = useState(false);
  const [authoringImportText, setAuthoringImportText] = useState('');
  const [authoringImportReplaceBranches, setAuthoringImportReplaceBranches] = useState(true);
  const [authoringTab, setAuthoringTab] = useState<'settings' | 'series' | 'mainline' | 'branches'>('settings');
  const [authoringTocOpen, setAuthoringTocOpen] = useState(false);
  const [authoringFindReplaceOpen, setAuthoringFindReplaceOpen] = useState(false);
  const [authoringFindQuery, setAuthoringFindQuery] = useState('');
  const [authoringReplaceQuery, setAuthoringReplaceQuery] = useState('');
  const [authoringFindScope, setAuthoringFindScope] = useState({ chapters: true, endings: true, characters: true });
  const [authoringFindChapterNums, setAuthoringFindChapterNums] = useState<number[]>([]);
  const [authoringFindEndingIds, setAuthoringFindEndingIds] = useState<string[]>([]);
  const [authoringFindCompact, setAuthoringFindCompact] = useState(false);
  const [authoringFindMatchIndex, setAuthoringFindMatchIndex] = useState(0);

  useEffect(() => {
    if (gameState === 'AUTHORING' && authoringCartridge && localStorage.getItem('completed-authoring-tour') !== 'true') {
      setTourStep(0);
      setAuthoringTab('settings');
    } else {
      setTourStep(null);
    }
  }, [gameState, authoringCartridge]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    const handleScrollReset = () => {
      const scrollContainers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll');
      scrollContainers.forEach(container => {
        container.scrollTop = 0;
      });
    };
    handleScrollReset();
    const t1 = setTimeout(handleScrollReset, 30);
    const t2 = setTimeout(handleScrollReset, 100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [gameState, archiveTab, authoringTab, activeStoryId]);

  type AuthoringFindMatch = {
    type: 'chapter' | 'ending' | 'character';
    id: string;
    label: string;
    field: 'title' | 'text' | 'name' | 'desc';
    selector: string;
    index: number;
  };

  const getAuthoringFindMatches = (cartridge = authoringCartridge) => {
    if (!cartridge || !authoringFindQuery) return [] as AuthoringFindMatch[];
    const queryText = authoringFindQuery;
    const matches: AuthoringFindMatch[] = [];
    const pushMatch = (
      type: AuthoringFindMatch['type'],
      id: string,
      label: string,
      field: AuthoringFindMatch['field'],
      value: unknown,
    ) => {
      const index = String(value || '').indexOf(queryText);
      if (index >= 0) matches.push({ type, id, label, field, selector: `authoring-${type}-${id}-${field}`, index });
    };
    if (authoringFindScope.chapters) {
      (cartridge.chapters || []).forEach((chapter: any) => {
        const chapterNum = Number(chapter.chapter_num);
        if (!authoringFindChapterNums.includes(chapterNum)) return;
        pushMatch('chapter', String(chapterNum), `第${chapterNum}章标题`, 'title', chapter.title);
        pushMatch('chapter', String(chapterNum), `第${chapterNum}章正文`, 'text', chapter.text);
      });
    }
    if (authoringFindScope.endings) {
      (cartridge.endings || []).forEach((ending: any) => {
        const endingId = String(ending.id || '');
        if (!authoringFindEndingIds.includes(endingId)) return;
        pushMatch('ending', endingId, `${ending.title || endingIdToLabel(ending.id)}标题`, 'title', ending.title);
        pushMatch('ending', endingId, `${ending.title || endingIdToLabel(ending.id)}正文`, 'text', ending.text);
      });
    }
    if (authoringFindScope.characters) {
      (cartridge.meta?.characters || []).forEach((character: any, index: number) => {
        pushMatch('character', String(index), `${character.name || `角色${index + 1}`}名称`, 'name', character.name);
        pushMatch('character', String(index), `${character.name || `角色${index + 1}`}设定`, 'desc', character.desc);
      });
    }
    return matches;
  };

  const scrollToAuthoringFindMatch = (match?: AuthoringFindMatch) => {
    if (!match) return;
    setAuthoringTab(match.type === 'character' ? 'branches' : 'mainline');
    const targetId = match.type === 'chapter'
      ? `authoring-chapter-${match.id}`
      : match.type === 'ending'
      ? `authoring-ending-${match.id}`
      : `authoring-character-${match.id}`;
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const field = document.getElementById(match.selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!field || typeof field.setSelectionRange !== 'function') return;
      field.focus({ preventScroll: true });
      if (field instanceof HTMLTextAreaElement) {
        const style = window.getComputedStyle(field);
        const lineHeight = Number.parseFloat(style.lineHeight || '20') || 20;
        const fontSize = Number.parseFloat(style.fontSize || '14') || 14;
        const horizontalPadding = Number.parseFloat(style.paddingLeft || '0') + Number.parseFloat(style.paddingRight || '0');
        const usableWidth = Math.max(1, field.clientWidth - horizontalPadding - 24);
        const approxCharWidth = Math.max(7, fontSize * 0.9);
        const charsPerLine = Math.max(1, Math.floor(usableWidth / approxCharWidth));
        const visualLineCount = field.value
          .slice(0, match.index)
          .split(/\r\n|\r|\n/)
          .reduce((total, line) => total + Math.max(1, Math.ceil((line.length + 1) / charsPerLine)), 0) - 1;
        const targetScrollTop = Math.max(0, visualLineCount * lineHeight - field.clientHeight * 0.42);
        const applyTextAreaScroll = () => {
          field.scrollTop = Math.min(targetScrollTop, Math.max(0, field.scrollHeight - field.clientHeight));
        };
        applyTextAreaScroll();
        window.requestAnimationFrame(applyTextAreaScroll);
      }
      field.setSelectionRange(match.index, match.index + authoringFindQuery.length);
    }, 180);
  };

  const openCompactFindMode = () => {
    const matches = getAuthoringFindMatches();
    setAuthoringFindCompact(true);
    setAuthoringFindReplaceOpen(false);
    setAuthoringFindMatchIndex(0);
    window.setTimeout(() => scrollToAuthoringFindMatch(matches[0]), 0);
    if (matches.length === 0) showError('没有找到匹配内容。');
  };

  const moveAuthoringFindMatch = (direction: 1 | -1) => {
    const matches = getAuthoringFindMatches();
    if (matches.length === 0) {
      showError('没有找到匹配内容。');
      return;
    }
    const nextIndex = (authoringFindMatchIndex + direction + matches.length) % matches.length;
    setAuthoringFindMatchIndex(nextIndex);
    scrollToAuthoringFindMatch(matches[nextIndex]);
  };

  const replaceCurrentAuthoringMatch = () => {
    const matches = getAuthoringFindMatches();
    const match = matches[authoringFindMatchIndex];
    if (!match || !authoringFindQuery) return;
    setAuthoringCartridge((prev: any) => {
      if (!prev) return prev;
      if (match.type === 'chapter') {
        return {
          ...prev,
          chapters: (prev.chapters || []).map((chapter: any) => Number(chapter.chapter_num) === Number(match.id)
            ? {
                ...chapter,
                [match.field]: String(chapter[match.field] || '').replace(authoringFindQuery, authoringReplaceQuery),
              }
            : chapter),
        };
      }
      if (match.type === 'ending') {
        return {
          ...prev,
          endings: (prev.endings || []).map((ending: any) => String(ending.id || '') === match.id
            ? {
                ...ending,
                [match.field]: String(ending[match.field] || '').replace(authoringFindQuery, authoringReplaceQuery),
              }
            : ending),
        };
      }
      return {
        ...prev,
        meta: {
          ...prev.meta,
          characters: (prev.meta?.characters || []).map((character: any, index: number) => String(index) === match.id
            ? {
                ...character,
                [match.field]: String(character[match.field] || '').replace(authoringFindQuery, authoringReplaceQuery),
              }
            : character),
        },
      };
    });
    setAuthoringDirty(true);
    window.setTimeout(() => moveAuthoringFindMatch(1), 0);
  };

  const handleAuthoringReplaceAll = () => {
    if (!authoringFindQuery) return;
    setAuthoringCartridge((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev };
      const q = authoringFindQuery;
      const r = authoringReplaceQuery;
      const chapterNums = new Set(authoringFindChapterNums);
      const endingIds = new Set(authoringFindEndingIds);
      if (authoringFindScope.chapters && next.chapters) {
        next.chapters = next.chapters.map((c: any) => (
          chapterNums.has(Number(c.chapter_num))
            ? {
                ...c,
                title: (c.title || '').split(q).join(r),
                text: (c.text || '').split(q).join(r),
              }
            : c
        ));
      }
      if (authoringFindScope.endings && next.endings) {
        next.endings = next.endings.map((e: any) => (
          endingIds.has(String(e.id))
            ? {
                ...e,
                title: (e.title || '').split(q).join(r),
                text: (e.text || '').split(q).join(r),
              }
            : e
        ));
      }
      if (authoringFindScope.characters && next.meta?.characters) {
        next.meta = {
          ...next.meta,
          characters: next.meta.characters.map((ch: any) => ({
            ...ch,
            name: (ch.name || '').split(q).join(r),
            desc: (ch.desc || '').split(q).join(r),
          }))
        };
      }
      return next;
    });
    setAuthoringDirty(true);
    showError('替换完成！');
    setAuthoringFindReplaceOpen(false);
  };
  const [appTheme, setAppTheme] = useState<AppTheme>(() => (
    typeof window !== 'undefined' && window.localStorage?.getItem('app-theme') === 'light'
      ? 'light'
      : 'dark'
  ));
  const [readingTextOpacity, setReadingTextOpacity] = useState(() => {
    const saved = typeof window !== 'undefined' ? Number(window.localStorage?.getItem('reading-text-brightness')) : 1;
    return Number.isFinite(saved) ? Math.max(0.7, Math.min(1, saved)) : 1;
  });
  const [branchForm, setBranchForm] = useState({
    id: '',
    name: '',
    side: 'left' as 'left' | 'right',
    tier: 'small' as 'small' | 'medium' | 'large',
    isHidden: false,
    endingId: '',
    triggerType: 'single' as 'single' | 'count',
    singleChapterNum: 2,
    singleCharId: '',
    singleAction: 'bless' as 'bless' | 'curse',
    countCharId: '',
    countAction: 'bless' as 'bless' | 'curse',
    minCount: 1,
    upToChapterNum: 6,
    hint: '',
    sceneText: '',
  });
  const [branchConditions, setBranchConditions] = useState<ConditionForm[]>([
    {
      kind: 'single',
      singleChapterNum: 2,
      singleCharId: '',
      singleAction: 'bless',
      countCharId: '',
      countAction: 'bless',
      minCount: 1,
      upToChapterNum: 6,
      hint: '',
    },
  ]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [authoringSavedSnapshot, setAuthoringSavedSnapshot] = useState('');
  const [authoringDirty, setAuthoringDirty] = useState(false);
  const [authoringSaveSuccessStory, setAuthoringSaveSuccessStory] = useState<any | null>(null);
  const [interventionHistory, setInterventionHistory] = useState<Array<{ chapterNum: number; charId: string; action: 'bless' | 'curse' }>>([]);
  const localDeviceIdRef = useRef(getLocalDeviceId());
  const hasLoadedInitialStoryListRef = useRef(false);
  const archiveRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const fetchingChapterRef = useRef<number | null>(null);
  const quickGenerationDraftSignatureRef = useRef<string | null>(null);
  const [backgroundGeneratingChapter, setBackgroundGeneratingChapter] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [connectivityDismissedAt, setConnectivityDismissedAt] = useState(0);
  const [manualConnectivityNotice, setManualConnectivityNotice] = useState<ConnectivityDrawerState | null>(null);
  const [sequelGateModal, setSequelGateModal] = useState<SequelGateModalState | null>(null);
  const [pendingSequelInheritance, setPendingSequelInheritance] = useState<PendingSequelInheritance | null>(null);

  // Client-side story continuity digest used between chapter updates.
  const [worldStateDigest, setWorldStateDigest] = useState<any>(null);
  const [deltaWorldStateByChapter, setDeltaWorldStateByChapter] = useState<Record<string, any>>({});
  const [readingTextScale, setReadingTextScale] = useState(() => {
    const saved = typeof window !== 'undefined' ? Number(window.localStorage?.getItem('reading-text-scale')) : 1;
    return Number.isFinite(saved) ? Math.max(0.9, Math.min(1.4, saved)) : 1;
  });
  const isAdminUser = Boolean(user && ADMIN_USER_IDS.has(user.uid));
  const canUseCoverGeneration = isAdminUser || featureSettings.coverGenerationEnabled;
  const isGlobalBlockingLoading = Boolean(
    globalLoadingMessage ||
    authoringSaving ||
    isGeneratingCover
  );
  const globalBlockingLoadingMessage = globalLoadingMessage ||
    (authoringSaving
      ? (isEnglish ? 'Saving...' : '正在保存...')
      : isSharing
      ? (isEnglish ? 'Preparing share link...' : '正在生成分享链接...')
      : isGeneratingCover
      ? (isEnglish ? 'Creating cover...' : '正在绘制封面...')
      : (isEnglish ? 'Processing...' : '正在处理...'));
  const globalBlockingLoadingDetail = globalLoadingDetail ||
    (authoringSaving
      ? (isEnglish ? 'Syncing story content. Please keep this page open.' : '正在同步作品内容，请不要关闭页面。')
      : isSharing
      ? (isEnglish ? 'Preparing share content and opening the system share sheet.' : '正在准备分享内容，并尝试调用系统分享。')
      : isGeneratingCover
      ? (isEnglish ? 'Generating the cover image. The editor will resume when it is ready.' : '正在生成封面图像，完成后会自动回到编辑状态。')
      : (isEnglish ? 'Handling the current action. Please wait.' : '正在处理当前操作，请稍候。'));
  const isRecoveringInvalidGameState = isSessionHydrated && Boolean(user) && (
    (gameState === 'READONLY_STORY' && !readonlyStoryData) ||
    ((gameState === 'PLAYING' || gameState === 'SUMMARY') && !blueprint)
  );

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
    document.documentElement.style.colorScheme = appTheme;
    window.localStorage?.setItem('app-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncOnlineState = () => setIsOnline(navigator.onLine !== false);
    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);
    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    const brightness = Math.max(0.7, Math.min(1, readingTextOpacity));
    document.documentElement.style.setProperty('--app-reading-brightness', String(brightness));
    window.localStorage?.setItem('reading-text-brightness', String(brightness));
  }, [readingTextOpacity]);

  useEffect(() => {
    const scale = Math.max(0.9, Math.min(1.4, readingTextScale));
    document.documentElement.style.setProperty('--app-reading-scale', String(scale));
    window.localStorage?.setItem('reading-text-scale', String(scale));
  }, [readingTextScale]);

  // --- Helpers ---
  const fetchWithTimeout = async (url: string, init: RequestInit, ms: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, errorMsg = "AI 响应超时，请重试。"): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    return Promise.race([promise, timeoutPromise]);
  };

  const retryOnlineOnce = async <T,>(fn: () => Promise<T>, label: string): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
        console.warn(`${label} failed once; retrying`, error);
        await new Promise(resolve => setTimeout(resolve, 700));
        return fn();
      }
      throw error;
    }
  };

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      if (retries > 0 && isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  const readErrorMessage = async (response: Response) => {
    try {
      const raw = await response.text();
      if (!raw) return `请求失败（${response.status}）`;
      try {
        const data = JSON.parse(raw);
        return [data?.error, data?.code ? `(${data.code})` : '', data?.detail ? `：${data.detail}` : ''].filter(Boolean).join(' ') || `请求失败（${response.status}）`;
      } catch {
        return raw || `请求失败（${response.status}）`;
      }
    } catch (error: any) {
      return error?.message || `请求失败（${response.status}）`;
    }
  };

  const getAuthHeaders = async (headers?: HeadersInit) => {
    if (!user) {
      throw new Error('请先登录后再继续。');
    }

    const merged = new Headers(headers || {});
    if (!merged.has('Content-Type')) {
      merged.set('Content-Type', 'application/json');
    }

    const idToken = await user.getIdToken();
    merged.set('Authorization', `Bearer ${idToken}`);
    return merged;
  };

  const apiFetch = async (url: string, init: RequestInit = {}, ms = 60000) => {
    const headers = await getAuthHeaders(init.headers);
    try {
      return await fetchWithTimeout(url, { ...init, headers }, ms);
    } catch (e: any) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) {
        throw new Error('AI 响应耗时过长，连接超时（这通常是服务器拥挤或生成内容过多导致，请稍后重试）。');
      }
      throw e;
    }
  };

  const resolveActiveStoryProvenance = async () => {
    let sourceMeta = activeStoryMeta || null;
    if (db && activeStoryId && (!sourceMeta?.authorId || sourceMeta.authorId === user?.uid)) {
      try {
        sourceMeta = await getStoryMeta(db as any, activeStoryId);
      } catch (error) {
        console.warn('Unable to resolve original story author:', error);
      }
    }

    return {
      originalAuthorId: sourceMeta?.originalAuthorId || sourceMeta?.authorId || activeStoryId || user?.uid || null,
      originalAuthorName: getOriginalAuthorName(sourceMeta || { authorId: activeStoryId || user?.uid, authorName: getUserAuthorName(user) }),
    };
  };

  const currentRunMatchesOriginal = () => (
    Boolean(activeStoryId) &&
    initialNaturalChapters.length > 0 &&
    areStoryChaptersEquivalent(chapters, initialNaturalChapters)
  );

  const getCleanCurrentRunChapters = () => chapters.map((chapter) => ({
    ...chapter,
    text: stripGeneratedMarkup(chapter.text),
    summary: stripGeneratedMarkup((chapter as any).summary || ''),
  }));

  const cacheSharedSnapshotAfterCreate = (shareId: string, sharedRecord: any, cleanChapters = getCleanCurrentRunChapters()) => {
    void cacheSharedStory(shareId, { meta: { ...sharedRecord, sharedStoryId: shareId }, chapters: cleanChapters as any })
      .catch((error) => console.warn('share cacheSharedStory failed:', error));
    void cacheStoryLists(publicStories, myStories, [sharedRecord, ...mySharedStories.filter((story: any) => story.id !== shareId)])
      .catch((error) => console.warn('share cacheStoryLists failed:', error));
  };

  const createCurrentStorySnapshot = async (visibility: 'private' | 'unlisted', snapshotKind: 'intervened' | 'saved_run') => {
    if (!user || !blueprint) throw new Error('请先进入故事后再继续。');
    const provenance = await resolveActiveStoryProvenance();
    const cleanChapters = getCleanCurrentRunChapters();
    const contentHash = hashStoryChapters(cleanChapters);
    const shouldSaveInheritanceRecord = Boolean(activeStoryId && (storyConclusion || interventionsLeft <= 0));
    const archivedFateRecord = shouldSaveInheritanceRecord
      ? createFateCompletionRecord({
          runId: `${activeStoryId}:archive:${contentHash}`,
          storyConclusion: storyConclusion || '',
          sourceType: 'archived',
          pinned: true,
        })
      : null;
    const shareId = await createStorySnapshot(db as any, {
      authorId: user.uid,
      authorName: getUserAuthorName(user),
      title: blueprint.title || '未命名故事',
      main_axis: blueprint.main_axis || '',
      tags: selectedThemes,
      characters: blueprint.characters || [],
      chapters: cleanChapters as any,
      averageChapterWords: getAverageChapterWords(cleanChapters),
      coverUrl: activeStoryMeta?.coverUrl || '',
      sourceStoryId: activeStoryId || null,
      originalAuthorId: provenance.originalAuthorId,
      originalAuthorName: provenance.originalAuthorName,
      intervenerId: user.uid,
      intervenerName: getUserAuthorName(user),
      allowAdaptation: getActiveStoryAllowAdaptation(),
      visibility,
      snapshotKind,
      contentHash,
      fateRecord: archivedFateRecord,
    });
    const sharedRecord = {
      id: shareId,
      archiveKind: 'snapshot',
      snapshotKind,
      contentHash,
      title: blueprint.title || '未命名故事',
      main_axis: blueprint.main_axis || '',
      tags: selectedThemes,
      characters: blueprint.characters || [],
      chapters: cleanChapters,
      authorId: user.uid,
      authorName: getUserAuthorName(user),
      originalAuthorId: provenance.originalAuthorId,
      originalAuthorName: provenance.originalAuthorName,
      intervenerId: user.uid,
      intervenerName: getUserAuthorName(user),
      coverUrl: activeStoryMeta?.coverUrl || '',
      sourceStoryId: activeStoryId,
      averageChapterWords: getAverageChapterWords(cleanChapters),
      chapterCount: getReadyChapterCount(cleanChapters),
      cardExcerpt: getStoryCardExcerpt(blueprint.main_axis || '', cleanChapters),
      allowAdaptation: getActiveStoryAllowAdaptation(),
      fateRecord: archivedFateRecord,
      visibility,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMySharedStories((prev) => [sharedRecord, ...prev.filter((story: any) => story.id !== shareId)]);
    if (archivedFateRecord) {
      await saveCompletedRunRecord(archivedFateRecord, {
        ...buildCurrentRunSnapshot(),
        storyConclusion,
        interventionsLeft,
      });
    }
    return { shareId, sharedRecord, cleanChapters };
  };

  const sharePayload = async (payload: ShareData) => new Promise<boolean>((resolve) => {
    setGlobalLoadingMessage(null);
    setGlobalLoadingDetail(null);
    shareComposerResolveRef.current = resolve;
    setShareComposer(payload);
    setShareComposerText(String(payload.text || ''));
  });

  const shareOriginalStoryByCard = async (story: any) => {
    const storyId = story?.id || story?.storyId || story?.sourceStoryId;
    if (!storyId) throw new Error('找不到作品 ID。');
    const shareTitle = formatBookTitle(getStoryTitle(story));
    // Try to build a real excerpt from card data or cached cartridge
    const excerptSource = story?.chapters || [];
    const mainAxis = getStoryMainAxis(story);
    const cardExcerpt = story?.cardExcerpt || story?.meta?.cardExcerpt || '';
    let shareText: string;
    if (excerptSource.length > 0) {
      shareText = buildStoryShareText(shareTitle, excerptSource);
    } else if (cardExcerpt) {
      shareText = `《${stripBookTitle(shareTitle)}》\n${String(cardExcerpt).slice(0, 120)}${cardExcerpt.length > 120 ? '...' : ''}\n\n有人改写了命运，而这一页，留下了它偏离原轨的瞬间。`;
    } else if (mainAxis) {
      shareText = `《${stripBookTitle(shareTitle)}》\n${String(mainAxis).slice(0, 120)}${mainAxis.length > 120 ? '...' : ''}\n\n故事已经开场，命运还没有落笔。来看看它会通往哪里。`;
    } else {
      shareText = buildStoryShareText(shareTitle, []);
    }
    if (await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(storyId) })) {
      await recordStoryShare(storyId);
    }
  };

  const shareStoryCardWithFeedback = async (story: any) => {
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing story share...' : '正在准备分享作品...');
      setGlobalLoadingDetail(isEnglish ? 'Creating the story link and opening the system share sheet.' : '正在生成作品链接，并尝试调起系统分享。');
      await shareOriginalStoryByCard(story);
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享失败。');
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleShareSavedAuthoringStory = async () => {
    const storyId = authoringSaveSuccessStory?.storyId || authoringStoryId;
    if (!storyId || !authoringSaveSuccessStory) return;
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing story share...' : '正在准备分享作品...');
      setGlobalLoadingDetail(isEnglish ? 'Creating the story link and opening the system share sheet.' : '正在生成作品链接，并尝试调用系统分享。');
      let meta = {
        ...(authoringSaveSuccessStory.meta || {}),
        id: storyId,
        storyId,
      };
      if ((meta.visibility || 'private') === 'private') {
        await saveStoryMeta(db as any, storyId, { visibility: 'unlisted' } as any);
        meta = { ...meta, visibility: 'unlisted' };
        setAuthoringCartridge((prev: any) => prev ? ({ ...prev, meta: { ...prev.meta, visibility: 'unlisted' } }) : prev);
        setAuthoringSaveSuccessStory((prev: any) => prev ? ({ ...prev, meta: { ...prev.meta, visibility: 'unlisted' } }) : prev);
        setMyStories((prev) => prev.map((story: any) => (story.id === storyId ? { ...story, visibility: 'unlisted' } : story)));
      }
      const shareTitle = formatBookTitle(getStoryTitle(meta));
      const shareText = buildStoryShareText(shareTitle, authoringSaveSuccessStory.chapters || []);
      if (await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(storyId) })) {
        await recordStoryShare(storyId);
      }
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享作品失败。');
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const isGuestAuthoredMeta = (meta: any) => {
    return String(meta?.authorName || '').startsWith('游客+') || String(meta?.originalAuthorName || '').startsWith('游客+');
  };

  const canAdaptCurrentStory = () => {
    if (!user || !blueprint) return false;
    if (!activeStoryId) return true;
    if (activeStoryMeta?.authorId === user.uid) return true;
    if (isGuestAuthoredMeta(activeStoryMeta)) return true;
    return Boolean(activeStoryMeta?.allowAdaptation);
  };

  const isAdaptCurrentStoryUnavailable = () => (
    isLoadingStories || !user || !blueprint
  );

  const canAdaptReadonlyStory = (meta: any) => {
    if (!user || !meta) return false;
    if (meta.authorId === user.uid || meta.originalAuthorId === user.uid) return true;
    if (isGuestAuthoredMeta(meta)) return true;
    return Boolean(meta.allowAdaptation);
  };

  const getActiveStoryAllowAdaptation = () => (
    Boolean(activeStoryMeta?.allowAdaptation || (blueprint as any)?.allowAdaptation)
  );

  const scrollToChapter = (chapterNum: number) => {
    window.setTimeout(() => {
      const target = document.getElementById(`chapter-${chapterNum}`);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 80);
  };

  const getBranchTriggerChapter = (branch: any) => {
    const singleChapter = branch?.trigger?.type === 'single' ? branch.trigger.single?.chapterNum : undefined;
    const firstSingleGroup = Array.isArray(branch?.triggerGroups)
      ? branch.triggerGroups.find((group: any) => group?.type === 'single')?.single?.chapterNum
      : undefined;
    return Number(singleChapter || firstSingleGroup || branch?.condition_chapter || 2);
  };

  const normalizeUnlockedBranchesForBlueprint = (branches: any[] = [], sourceBlueprint: Blueprint | null = blueprint) => {
    const currentBranches = new Map<string, any>((sourceBlueprint?.branches || []).map((branch: any) => [String(branch.id || ''), branch]));
    return (branches || [])
      .map((branch: any) => {
        const current = currentBranches.get(String(branch?.id || ''));
        return current ? { ...current, _historySignature: stableBranchSignature(current) } : null;
      })
      .filter(Boolean) as Branch[];
  };

  const normalizeHistoricalUnlockedBranchesForBlueprint = (branches: any[] = [], sourceBlueprint: Blueprint | null = blueprint) => {
    const currentBranches = new Map<string, any>((sourceBlueprint?.branches || []).map((branch: any) => [String(branch.id || ''), branch]));
    const seen = new Set<string>();
    return (branches || [])
      .map((branch: any) => {
        const id = String(branch?.id || '');
        if (!id || seen.has(id)) return null;
        const current = currentBranches.get(id);
        if (!current) return null;
        const currentSignature = stableBranchSignature(current);
        const savedSignature = String(branch?._historySignature || stableBranchSignature(branch));
        if (savedSignature && savedSignature !== currentSignature) return null;
        seen.add(id);
        return { ...current, _historySignature: currentSignature };
      })
      .filter(Boolean) as Branch[];
  };

  const getChapterAvailableCharacters = (chapter: Chapter, sourceBlueprint: Blueprint | null = blueprint) => {
    if (!sourceBlueprint) return [] as Character[];
    const availableCharacters: Character[] = [];
    const addCharacter = (character?: Character) => {
      if (character && !availableCharacters.some((item) => item.id === character.id)) {
        availableCharacters.push(character);
      }
    };

    (chapter.present_characters || []).forEach((charIdOrName) => {
      addCharacter(sourceBlueprint.characters.find((char) => char.id === charIdOrName || char.name === charIdOrName));
    });

    const chapterText = String(chapter.text || '');
    sourceBlueprint.characters.forEach((char) => {
      if (char.name && chapterText.includes(char.name)) addCharacter(char);
    });

    (sourceBlueprint.branches || []).forEach((branch: any) => {
      const groups = Array.isArray(branch.triggerGroups) && branch.triggerGroups.length > 0
        ? branch.triggerGroups
        : branch.trigger
          ? [branch.trigger]
          : [];
      groups.forEach((group: any) => {
        const single = group?.type === 'single' ? group.single : null;
        const count = group?.type === 'count' ? group.count : null;
        if (Number(single?.chapterNum) === Number(chapter.chapter_num)) {
          addCharacter(sourceBlueprint.characters.find((char) => char.id === single.charId || char.name === single.charId));
        }
        if (count && Number(count.upToChapterNum) >= Number(chapter.chapter_num)) {
          addCharacter(sourceBlueprint.characters.find((char) => char.id === count.charId || char.name === count.charId));
        }
      });
    });

    return availableCharacters;
  };

  const todayUsageKey = () => new Date().toISOString().slice(0, 10);

  const reserveCoverGenerationQuota = async () => {
    if (!db || !user) throw new Error('请先登录后再生成封面。');
    const dateKey = todayUsageKey();
    return reserveCoverGenerationUsage(db as any, user.uid, dateKey);
  };

  const refundCoverGenerationQuota = async () => {
    if (!db || !user) return [];
    const dateKey = todayUsageKey();
    await refundCoverGenerationUsage(db as any, user.uid, dateKey);
    return;
  };

  const ReadingTextControls = () => (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800/45 bg-zinc-950/45 p-1 text-xs font-bold text-zinc-400 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setReadingTextScale((value) => Math.max(0.9, Number((value - 0.1).toFixed(1))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
      >
        A-
      </button>
      <span className="min-w-12 text-center text-zinc-500">{Math.round(readingTextScale * 100)}%</span>
      <button
        type="button"
        onClick={() => setReadingTextScale((value) => Math.min(1.4, Number((value + 0.1).toFixed(1))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
      >
        A+
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-800" />
      <button
        type="button"
        onClick={() => setReadingTextOpacity((value) => Math.max(0.7, Number((value - 0.05).toFixed(2))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
      >
        亮-
      </button>
      <span className="min-w-12 text-center text-zinc-500">{Math.round(readingTextOpacity * 100)}%</span>
      <button
        type="button"
        onClick={() => setReadingTextOpacity((value) => Math.min(1, Number((value + 0.05).toFixed(2))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-zinc-800 hover:text-white active:scale-95"
      >
        亮+
      </button>
    </div>
  );

  const readingParagraphStyle = {
    fontSize: `${readingTextScale}rem`,
    lineHeight: 1.85,
    opacity: readingTextOpacity,
  } as React.CSSProperties;

  const renderReadingParagraph = (text: unknown, characters: Character[] = [], changeQuotes: string[] = []) => {
    const paragraph = String(text || '');
    if (!isEnglish) {
      return renderParagraphWithHighlights(paragraph, characters, changeQuotes);
    }
    const match = paragraph.match(/^(\s*)([A-Za-z][A-Za-z'’-]*)([\s\S]*)$/);
    if (!match) {
      return renderParagraphWithHighlights(paragraph, characters, changeQuotes);
    }
    const [, leadingSpace, firstWord, rest] = match;
    return (
      <>
        {leadingSpace}
        <span className="mr-1 align-baseline text-[1.35em] font-black leading-none text-indigo-300">{firstWord}</span>
        {renderParagraphWithHighlights(rest, characters, changeQuotes)}
      </>
    );
  };

  const isChapterTextReady = (chapter: Chapter | undefined) => {
    return Boolean(
      chapter &&
      typeof chapter.text === 'string' &&
      chapter.text.trim().length > 50 &&
      chapter.text !== '命运涟漪正在扩散，重写中...'
    );
  };

  const startProgressSimulation = (durationMs: number, messages: string[]) => {
    setGenerationProgress(0);
    setGenerationStatus(messages[0]);
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressRatio = elapsed / durationMs;
      
      let currentProgress = 0;
      if (progressRatio < 0.2) {
        currentProgress = progressRatio * 2.5 * 50; // 0 to 50
      } else if (progressRatio < 0.8) {
        currentProgress = 50 + (progressRatio - 0.2) * 0.5 * 50; // 50 to 80
      } else {
        currentProgress = 80 + (progressRatio - 0.8) * 0.75 * 18; // 80 to 98
      }
      
      setGenerationProgress(Math.min(currentProgress, 98));
      
      const msgIndex = Math.min(
        Math.floor((currentProgress / 100) * messages.length),
        messages.length - 1
      );
      setGenerationStatus(messages[msgIndex]);
    }, 200);
    
    return interval;
  };

  const startStoryLaunchProgress = () => {
    const messages = isEnglish
      ? [
          'Opening the fate archive...',
          'Reading chapters and branches...',
          'Checking saved progress...',
          'Entering the story...',
        ]
      : [
          '正在打开命运档案...',
          '正在读取章节与支线...',
          '正在检查已保存进度...',
          '即将进入故事...',
        ];
    const startTime = Date.now();
    setStoryLaunchOverlay({ progress: 6, status: messages[0] });
    return window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(92, 6 + (elapsed / 2600) * 86);
      const index = Math.min(messages.length - 1, Math.floor((progress / 100) * messages.length));
      setStoryLaunchOverlay({ progress, status: messages[index] });
    }, 180);
  };

  const normalizeBranchConditionsForStorage = (conditions: ConditionForm[] = []) => (
    conditions.slice(0, 3).map((condition) =>
      condition.kind === 'single'
        ? {
            type: 'single' as const,
            single: {
              chapterNum: Math.max(2, Math.min(6, condition.singleChapterNum)),
              charId: condition.singleCharId || '',
              action: condition.singleAction,
            },
            hint: condition.hint || '',
          }
        : {
            type: 'count' as const,
            count: {
              charId: condition.countCharId || '',
              action: condition.countAction,
              minCount: Math.max(1, condition.minCount),
              upToChapterNum: Math.max(2, Math.min(6, condition.upToChapterNum)),
            },
            hint: condition.hint || '',
          }
    )
  );

  const buildAuthoringSnapshot = (cartridge: any) => {
    if (!cartridge) return '';
    return JSON.stringify({
      storyId: cartridge.storyId || '',
      meta: {
        title: stripBookTitle(cartridge.meta?.title || ''),
        main_axis: String(cartridge.meta?.main_axis || ''),
        coverUrl: String(cartridge.meta?.coverUrl || ''),
        visibility: cartridge.meta?.visibility || 'private',
        tags: normalizeTagList(cartridge.meta?.tags || []),
        endingMode: cartridge.meta?.endingMode || 'dual',
        endingBias: normalizeEndingBias(cartridge.meta?.endingBias || cartridge.meta?.endingRates),
        endingNames: {
          left: limitFiveChars(cartridge.meta?.endingNames?.left || ''),
          right: limitFiveChars(cartridge.meta?.endingNames?.right || ''),
        },
        characters: normalizeCharacters(cartridge.meta?.characters || []),
      },
      chapters: (cartridge.chapters || []).map((chapter: any) => ({
        chapter_num: chapter.chapter_num,
        title: String(chapter.title || ''),
        summary: String(chapter.summary || ''),
        text: String(chapter.text || ''),
      })),
      endings: (cartridge.endings || []).map((ending: any) => ({
        id: ending.id,
        title: String(ending.title || ''),
        text: String(ending.text || ''),
      })),
      branches: (cartridge.branches || []).map((branch: any) => ({
        id: branch.id,
        name: String(branch.name || ''),
        hint: String(branch.hint || ''),
        tier: normalizeBranchTier(branch.tier || 'small'),
        isHidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
        side: branch.side || 'left',
        sceneText: String(branch.sceneText || ''),
      })),
    });
  };

  const markAuthoringSaved = (cartridge: any) => {
    setAuthoringSavedSnapshot(buildAuthoringSnapshot(cartridge));
    setAuthoringDirty(false);
  };


  const handleSaveProgressAndReturnLegacy = async () => {
    if (!user || !activeStoryId || !db || !blueprint) return;
    try {
      setAuthoringSaving(true);
      setGlobalLoadingMessage(isEnglish ? 'Saving progress...' : '正在保存进度...');
      await saveUserProgress(db as any, user.uid, activeStoryId, {
        ...buildCurrentRunSnapshot(),
        userId: user.uid,
        storyId: activeStoryId,
      });
      await resetGame();
      setShowLeaveGameModal(false);
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
    } finally {
      setGlobalLoadingMessage(null);
      setAuthoringSaving(false);
    }
  };

  const handleSaveWorkAndReturnLegacy = async () => {
    if (!user || !blueprint) return;
    try {
      setAuthoringSaving(true);
      setGlobalLoadingMessage(isEnglish ? 'Saving fate line...' : '正在收藏命运...');
      const sourceChapters = (naturalChapters.length > 0 ? naturalChapters : chapters).map((chapter) => ({
        ...chapter,
        text: stripGeneratedMarkup(chapter.text),
        summary: stripGeneratedMarkup((chapter as any).summary || ''),
      }));
      const provenance = await resolveActiveStoryProvenance();
      await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint.title,
        main_axis: blueprint.main_axis,
        tags: selectedThemes,
        characters: blueprint.characters,
        chapters: sourceChapters as any,
        averageChapterWords: getAverageChapterWords(sourceChapters),
        coverUrl: activeStoryMeta?.coverUrl || '',
        sourceStoryId: activeStoryId,
        originalAuthorId: provenance.originalAuthorId,
        originalAuthorName: provenance.originalAuthorName,
        intervenerId: user.uid,
        intervenerName: getUserAuthorName(user),
        allowAdaptation: getActiveStoryAllowAdaptation(),
        visibility: 'private',
      });
      await resetGame();
      setShowLeaveGameModal(false);
    } catch (e) {
      console.error(e);
      showError("收藏命运失败");
    } finally {
      setGlobalLoadingMessage(null);
      setAuthoringSaving(false);
    }
  };

  const buildWorldStateForPrompt = (upToChapter: number, currentEndingValue: number) => {
    const canonical = worldStateDigest;
    const deltas = Object.entries(deltaWorldStateByChapter || {})
      .filter(([n]) => parseInt(n) <= upToChapter)
      .map(([, d]) => d);
      
    const deltaWeight = Math.min(1, Math.abs(currentEndingValue) / 25);
    
    return {
      canonical,
      deltas,
      deltaWeight,
      endingDirection: currentEndingValue > 10 ? 'left' : currentEndingValue < -10 ? 'right' : 'neutral'
    };
  };

  // --- Handlers ---
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth?.currentUser?.uid,
        email: auth?.currentUser?.email,
        emailVerified: auth?.currentUser?.emailVerified,
        isAnonymous: auth?.currentUser?.isAnonymous,
        tenantId: auth?.currentUser?.tenantId,
        providerInfo: auth?.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setFirestoreError(errInfo);
    showError("数据库操作失败，请检查权限或网络。");
  };

  const syncCurrentAuthorName = async (targetUser: FirebaseUser) => {
    if (!db) return;
    const authorName = getUserAuthorName(targetUser);
    try {
      await updateAuthorNameEverywhere(db as any, targetUser.uid, authorName);
      setActiveStoryMeta((prev: any) => prev ? { ...prev, authorName } : prev);
      setProfileDisplayName(authorName);
    } catch (error) {
      console.warn('Author name sync skipped:', error);
    }
  };

  const ensureSevenChapterShells = (sourceChapters: any[] = []) => {
    return Array.from({ length: 7 }, (_, index) => {
      const chapterNum = index + 1;
      const existing = sourceChapters.find((chapter) => Number(chapter?.chapter_num) === chapterNum);
      return {
        chapter_num: chapterNum,
        title: existing?.title || `第${chapterNum}章`,
        summary: existing?.summary || '',
        present_characters: Array.isArray(existing?.present_characters) ? existing.present_characters : [],
        text: existing?.text || '',
      };
    });
  };

  const cacheScope = () => `${localDeviceIdRef.current}:${user?.uid || 'guest'}`;
  const storyListCacheKey = () => `story-list:${cacheScope()}`;
  const storyCartridgeCacheKey = (storyId: string) => `story-cartridge:${cacheScope()}:${storyId}`;
  const sharedStoryCacheKey = (storyId: string) => `shared-story:${cacheScope()}:${storyId}`;
  const activeRunCacheKey = () => `active-run:${cacheScope()}`;
  const quickGenerationDraftCacheKey = () => `quick-generation-draft:${cacheScope()}`;
  const quickText = (value?: Partial<Record<AppLanguage, string>> | null) =>
    String(value?.[appLanguage] || value?.['zh-CN'] || value?.['en-US'] || '');
  const getQuickQuizOption = (stepId: QuickQuizStepId, optionId: string) =>
    QUICK_QUIZ_STEPS.find((step) => step.id === stepId)?.options.find((option) => option.id === optionId);
  const toggleQuickQuizAnswer = (step: QuickQuizStep, optionId: string) => {
    setQuickQuizAnswers((prev) => {
      const current = asSafeArray(prev[step.id]);
      const exists = current.includes(optionId);
      const next = exists
        ? current.filter((id) => id !== optionId)
        : step.maxSelections === 1
          ? [optionId]
          : [...current, optionId].slice(0, step.maxSelections);
      return { ...prev, [step.id]: next };
    });
  };
  const buildQuickCharacterSeedOutline = (seed: QuickCharacterSeed = quickCharacterSeed) => {
    if (!seed.enabled) return '';
    const name = seed.name.trim();
    const role = seed.role.trim();
    const note = seed.note.trim();
    if (!name && !role && !note) return '';
    const positionText = appLanguage === 'en-US'
      ? ({
          protagonist: 'as the protagonist or central viewpoint character',
          important: 'as an important character who strongly affects the plot',
          mystery: 'as a mysterious character whose truth is gradually revealed',
        } satisfies Record<QuickCharacterSeed['position'], string>)[seed.position]
      : ({
          protagonist: '作为主角或核心视角人物',
          important: '作为会强烈影响主线的重要角色',
          mystery: '作为真相逐步揭开的神秘人物',
        } satisfies Record<QuickCharacterSeed['position'], string>)[seed.position];
    if (appLanguage === 'en-US') {
      return `User character seed: include ${name || 'this character'} ${positionText}${role ? `; identity/relationship: ${role}` : ''}${note ? `; character note: ${note}` : ''}. Keep the character naturally integrated with the selected tags instead of making the story feel like a biography.`;
    }
    return `用户人物设定：请将${name || '该人物'}${positionText}${role ? `；身份/关系：${role}` : ''}${note ? `；人设补充：${note}` : ''}。请让人物自然融入已选择的标签与故事类型，不要写成单纯人物传记。`;
  };
  const buildQuickGenerationInputFromQuiz = (
    answers: QuickQuizAnswers = quickQuizAnswers,
    characterSeedInput?: QuickCharacterSeed
  ): QuickGenerationInput => {
    const seed = characterSeedInput || quickCharacterSeed;
    const selectedOptions = QUICK_QUIZ_STEPS.flatMap((step) =>
      asSafeArray(answers[step.id])
        .map((optionId) => ({ step, option: getQuickQuizOption(step.id, optionId) }))
        .filter((item): item is { step: QuickQuizStep; option: QuickQuizOption } => Boolean(item.option))
    );
    const fallbackTags = QUICK_QUIZ_STEPS.flatMap((step) => asSafeArray(answers[step.id]).map((id) => String(id))).filter(Boolean);
    const keyTags = normalizeTagList(
      selectedOptions.map(({ option }) => appLanguage === 'en-US' ? quickText(option.label) : (option.tag || quickText(option.label))).filter(Boolean).length > 0
        ? selectedOptions.map(({ option }) => appLanguage === 'en-US' ? quickText(option.label) : (option.tag || quickText(option.label)))
        : fallbackTags
    ).slice(0, 4);
    const outlinePieces = selectedOptions
      .map(({ option }) => quickText(option.outline))
      .filter(Boolean);
    const safeOutlinePieces = outlinePieces.length > 0 ? outlinePieces : fallbackTags;
    const relationshipHints = asSafeArray(answers.relationships)
      .map((id) => getQuickQuizOption('relationships', id)?.narrativeHint)
      .filter(Boolean);
    const interferenceOption = asSafeArray(answers.interference)
      .map((id) => getQuickQuizOption('interference', id))
      .find(Boolean);
    const lengthOption = asSafeArray(answers.length)
      .map((id) => getQuickQuizOption('length', id))
      .find(Boolean);
    const narrativeHint = relationshipHints.includes('ensemble')
      ? (appLanguage === 'en-US' ? 'Use an ensemble perspective with several important characters affecting one another.' : '请采用群像叙事，让多个重要角色互相牵动。')
      : relationshipHints.includes('dual')
        ? (appLanguage === 'en-US' ? 'Use a dual-lead structure where the two protagonists mirror and challenge each other.' : '请采用双主角结构，让两位主角互相映照与拉扯。')
        : '';
    const customOutlineFromQuiz = appLanguage === 'en-US'
      ? `Generate an interactive seven-chapter story for immediate play. Preferences: ${safeOutlinePieces.join('; ')}. ${narrativeHint} ${buildQuickCharacterSeedOutline(seed)} Keep the story coherent, playable, and suitable for fate interference.`
      : `请生成一篇适合马上游玩的七章互动故事。玩家偏好：${safeOutlinePieces.join('；')}。${narrativeHint}${buildQuickCharacterSeedOutline(seed)}请确保故事逻辑完整、适合命运干涉，并保留清晰的人物牵引。`;
    return {
      selectedThemes: keyTags,
      customOutline: customOutlineFromQuiz,
      targetWordCount: Number(lengthOption?.targetWordCount || 800),
      narrativePerson: 'third',
      endingMode: interferenceOption?.endingMode || 'dual',
      endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
    };
  };
  const getActiveQuickGenerationInput = (): QuickGenerationInput => (
    (() => {
      const selectedSeries = seriesWorlds.find((series) => series.id === quickSeriesBindingId) || null;
      const selectedEnding = asSafeArray<any>(quickContinuitySourceStory?.endings).find((ending) => String(ending.id || '') === quickSeriesSelection.endingId);
      const selectedBranches = asSafeArray<any>(quickContinuitySourceStory?.branches).filter((branch) => quickSeriesSelection.requiredBranchIds.includes(String(branch.id || '')));
      const previousStorySummary = asSafeArray<any>(quickContinuitySourceStory?.chapters)
        .sort((a, b) => Number(a.chapter_num || a.chapterNum || 0) - Number(b.chapter_num || b.chapterNum || 0))
        .map((chapter) => ({
          chapterNum: Number(chapter.chapter_num || chapter.chapterNum || 0),
          title: chapter.title || '',
          summary: chapter.summary || String(chapter.text || '').slice(0, 260),
        }))
        .filter((chapter) => chapter.chapterNum || chapter.summary);
      const previousCharacters = asSafeArray<any>(quickContinuitySourceStory?.meta?.characters || quickContinuitySourceStory?.characters)
        .map((character) => ({
          id: character.id || '',
          name: character.name || '',
          desc: character.desc || character.description || '',
        }))
        .filter((character) => character.name || character.desc);
      const selectedNode = quickSeriesSelection.useContinuity && quickSeriesSelection.sourceStoryId && quickSeriesSelection.endingId
        ? {
            id: `anchor:${quickSeriesSelection.sourceStoryId}:${quickSeriesSelection.endingId}:${quickSeriesSelection.requiredBranchIds.join('-')}`,
            seriesId: quickSeriesBindingId,
            sourceStoryId: quickSeriesSelection.sourceStoryId,
            title: selectedEnding?.title
              ? `${tr('继承', 'Inherit')}: ${selectedEnding.title}`
              : tr('自定义继承节点', 'Custom continuity anchor'),
            endingDomain: endingDomainFromId(quickSeriesSelection.endingId),
            endingId: quickSeriesSelection.endingId,
            requiredBranchIds: quickSeriesSelection.requiredBranchIds,
            optionalBranchIds: [],
            bridgeSummary: [
              quickContinuitySourceStory?.meta?.title ? `${tr('前作', 'Previous story')}: ${quickContinuitySourceStory.meta.title}` : '',
              quickContinuitySourceStory?.meta?.main_axis ? `${tr('前作主轴', 'Previous premise')}: ${quickContinuitySourceStory.meta.main_axis}` : '',
              previousStorySummary.length ? `${tr('前作章节概况', 'Previous chapter arc')}: ${previousStorySummary.map((chapter) => `${chapter.chapterNum}. ${chapter.title || ''} ${chapter.summary || ''}`.trim()).join(' / ')}` : '',
              selectedEnding ? `${tr('指定结局', 'Selected ending')}: ${selectedEnding.title || selectedEnding.id}` : '',
              selectedBranches.length ? `${tr('指定支线重点', 'Selected branch focus')}: ${selectedBranches.map((branch) => `${branch.name || branch.title || branch.id}: ${branch.desc || branch.description || asSafeArray(branch.inject?.mustHappen).join('，')}`).join(' / ')}` : '',
            ].filter(Boolean).join('\n'),
            legacyState: {
              sourceTitle: quickContinuitySourceStory?.meta?.title || '',
              premise: quickContinuitySourceStory?.meta?.main_axis || quickContinuitySourceStory?.meta?.description || '',
              chapterArc: previousStorySummary,
              characters: previousCharacters,
              ending: selectedEnding || null,
              branches: selectedBranches,
            },
            repairRules: quickSeriesSelection.hardSettings
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((rule) => ({ rule })),
            sequelSeedPrompt: quickSeriesSelection.hardSettings,
            visibility: 'private',
            createdBy: user?.uid || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as ContinuityNodeRecord
        : null;
      const seriesContext = buildAppliedSeriesContext(selectedSeries, quickSeriesSelection, selectedNode);
      const baseInput = quickGenerationMode === 'quiz'
        ? buildQuickGenerationInputFromQuiz()
        : {
            selectedThemes,
            customOutline,
            targetWordCount,
            narrativePerson,
            endingMode: quickEndingMode,
            endingBias: quickEndingBias,
          };
      return {
        ...baseInput,
        seriesContext,
        continuityNode: selectedNode,
        seriesSelection: quickSeriesSelection,
      };
    })()
  );
  const getIncompleteQuickQuizStep = () => QUICK_QUIZ_STEPS.find((step) => asSafeArray(quickQuizAnswers[step.id]).length < 1);
  const createRandomQuickQuizAnswers = (): QuickQuizAnswers => {
    const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
    return QUICK_QUIZ_STEPS.reduce((answers, step) => {
      const count = step.maxSelections > 1 ? 1 + Math.floor(Math.random() * step.maxSelections) : 1;
      answers[step.id] = shuffle(step.options).slice(0, count).map((option) => option.id);
      return answers;
    }, createDefaultQuickQuizAnswers());
  };
  const quickGenerationSignature = (override?: {
    mode?: QuickGenerationMode;
    answers?: QuickQuizAnswers;
    characterSeed?: QuickCharacterSeed;
    input?: QuickGenerationInput;
  }) => JSON.stringify({
    quickGenerationMode: override?.mode || quickGenerationMode,
    quickQuizAnswers: override?.answers || quickQuizAnswers,
    quickCharacterSeed: override?.characterSeed || quickCharacterSeed,
    selectedThemes: override?.input?.selectedThemes || selectedThemes,
    customOutline: (override?.input?.customOutline || customOutline).trim(),
    targetWordCount: override?.input?.targetWordCount || targetWordCount,
    quickSeriesBindingId: override?.input?.seriesContext?.id || quickSeriesBindingId,
    quickSeriesSelection: override?.input?.seriesSelection || quickSeriesSelection,
    narrativePerson: override?.input?.narrativePerson || narrativePerson,
    quickEndingMode: override?.input?.endingMode || quickEndingMode,
    quickEndingBias: override?.input?.endingBias || quickEndingBias,
  });

  const applyStoryListCache = (data: any) => {
    setPublicStories(asSafeArray(data?.pub));
    setMyStories(asSafeArray(data?.mine));
    setMySharedStories(asSafeArray(data?.shared));
  };

  const cacheStoryLists = async (pub: any[], mine: any[], shared: any[], publicSort: StoryLibrarySort = storyLibrarySort) => {
    await setLocalCache(storyListCacheKey(), {
      pub: asSafeArray(pub),
      mine: asSafeArray(mine),
      shared: asSafeArray(shared),
      publicSort,
    });
  };

  const getStoryListCache = async () => getLocalCache<{ pub: any[]; mine: any[]; shared: any[]; publicSort?: StoryLibrarySort }>(storyListCacheKey());

  const getCachedStoryCartridge = async (storyId: string, expectedStory?: any) => {
    if (storyId === 'tutorial-cartridge') {
      return TUTORIAL_STORY_CARTRIDGE;
    }
    const cached = await getLocalCache<any>(storyCartridgeCacheKey(storyId));
    if (!cached?.value) return null;
    const expectedUpdatedAt = String(expectedStory?.updatedAt || '');
    const cachedUpdatedAt = String(cached.value?.meta?.updatedAt || '');
    const expectedVersion = Number(expectedStory?.version || 0);
    const cachedVersion = Number(cached.value?.meta?.version || 0);
    if (expectedUpdatedAt && cachedUpdatedAt && expectedUpdatedAt !== cachedUpdatedAt) return null;
    if (expectedVersion && cachedVersion && expectedVersion !== cachedVersion) return null;
    return cached.value;
  };

  const getAnyCachedStoryCartridge = async (storyId: string) => {
    if (storyId === 'tutorial-cartridge') {
      return TUTORIAL_STORY_CARTRIDGE;
    }
    const cached = await getLocalCache<any>(storyCartridgeCacheKey(storyId));
    return cached?.value || null;
  };

  const revalidateStoryCartridgeInBackground = (storyId: string) => {
    if (!db) return;
    void getStoryCartridge(db as any, storyId)
      .then((fresh) => cacheStoryCartridge(storyId, fresh))
      .catch((error) => console.warn('[story-cartridge:revalidate]', storyId, error));
  };

  const cacheStoryCartridge = async (storyId: string, cartridge: any) => {
    if (cartridge) await setLocalCache(storyCartridgeCacheKey(storyId), cartridge);
  };

  const getCachedSharedStory = async (storyId: string) => getLocalCache<{ meta: any; chapters: Chapter[] }>(sharedStoryCacheKey(storyId));

  const cacheSharedStory = async (storyId: string, record: { meta: any; chapters: Chapter[] }) => {
    await setLocalCache(sharedStoryCacheKey(storyId), record);
  };

  const markStoryListSegment = (segment: StoryListSegment, status: SyncStatus, error?: string) => {
    setStoryListSyncState((prev) => updateStoryListSegmentState(prev, segment, status, error));
  };

  const buildEndingProgressSnapshot = (value = endingValue, feedback: any = uiFeedback, completed = false) => {
    const endingDomain = endingDomainFromValue(Number(value || 0));
    const selectedEndingId = String(
      feedback?.selectedEndingId ||
      feedback?.endingId ||
      feedback?.selectedEnding ||
      (endingDomain === 'middle' ? 'default' : endingDomain)
    );
    return {
      endingDomain,
      selectedEndingId,
      finalEndingId: selectedEndingId,
      ...(completed ? { completedAt: new Date().toISOString() } : {}),
    };
  };

  const createFateCompletionRecord = (overrides: Partial<FateCompletionRecord> = {}): FateCompletionRecord => {
    const endingSnapshot = buildEndingProgressSnapshot(endingValue, uiFeedback, true);
    const completedAt = overrides.completedAt || new Date().toISOString();
    const branchList = asSafeArray<any>(unlockedBranches);
    const historicalBranchList = asSafeArray<any>(historicallyUnlockedBranches);
    return {
      runId: overrides.runId || `${activeStoryId || 'story'}:${completedAt}`,
      sourceStoryId: overrides.sourceStoryId || activeStoryId || '',
      storyTitle: overrides.storyTitle || activeStoryMeta?.title || blueprint?.title || '未命名作品',
      endingDomain: overrides.endingDomain || endingSnapshot.endingDomain,
      selectedEndingId: overrides.selectedEndingId || endingSnapshot.selectedEndingId,
      selectedEndingTitle: overrides.selectedEndingTitle || inheritedEndingDisplayLabel({ endingDomain: endingSnapshot.endingDomain, selectedEndingId: endingSnapshot.selectedEndingId }),
      unlockedBranchIds: overrides.unlockedBranchIds || branchList.map((branch) => String(branch?.id || '')).filter(Boolean),
      unlockedBranches: overrides.unlockedBranches || branchList.map((branch) => ({ id: String(branch?.id || ''), name: String(branch?.name || branch?.title || branch?.id || '') })).filter((branch) => branch.id),
      historicallyUnlockedBranchIds: overrides.historicallyUnlockedBranchIds || historicalBranchList.map((branch) => String(branch?.id || '')).filter(Boolean),
      characterStatuses: overrides.characterStatuses || characterStatuses,
      storyConclusion: overrides.storyConclusion ?? storyConclusion ?? '',
      chapterSummaries: overrides.chapterSummaries || asSafeArray<any>(chapters).slice(0, 7).map((chapter) => ({
        chapterNum: Number(chapter.chapter_num || 0),
        title: String(chapter.title || ''),
        summary: String(chapter.summary || chapter.text || '').slice(0, 520),
      })).filter((chapter) => chapter.chapterNum > 0),
      completedAt,
      sourceType: overrides.sourceType || 'auto',
      pinned: Boolean(overrides.pinned),
    };
  };

  const getCompletedRunRecords = (progressData: any): FateCompletionRecord[] => (
    asSafeArray<any>(progressData?.completedRuns)
      .map((record) => ({
        ...record,
        runId: String(record?.runId || record?.id || ''),
        sourceStoryId: String(record?.sourceStoryId || ''),
        storyTitle: String(record?.storyTitle || '前作命运线'),
        endingDomain: ['left', 'right', 'middle'].includes(record?.endingDomain) ? record.endingDomain : 'middle',
        selectedEndingId: String(record?.selectedEndingId || record?.finalEndingId || 'default'),
        unlockedBranchIds: asSafeArray<string>(record?.unlockedBranchIds),
        unlockedBranches: asSafeArray<any>(record?.unlockedBranches),
        historicallyUnlockedBranchIds: asSafeArray<string>(record?.historicallyUnlockedBranchIds),
        characterStatuses: record?.characterStatuses || {},
        storyConclusion: String(record?.storyConclusion || ''),
        chapterSummaries: asSafeArray<any>(record?.chapterSummaries),
        completedAt: String(record?.completedAt || record?.createdAt || ''),
        sourceType: record?.sourceType === 'archived' ? 'archived' : 'auto',
        pinned: Boolean(record?.pinned || record?.sourceType === 'archived'),
      }))
      .filter((record) => record.runId && record.sourceStoryId)
  );

  const appendCompletedRunToProgress = (progressData: any, record: FateCompletionRecord) => {
    const previous = getCompletedRunRecords(progressData).filter((item) => item.runId !== record.runId);
    const merged = [record, ...previous].sort((a, b) => Date.parse(b.completedAt || '') - Date.parse(a.completedAt || ''));
    const pinnedRecords = merged.filter((item) => item.pinned || item.sourceType === 'archived');
    const autoRecords = merged.filter((item) => !item.pinned && item.sourceType !== 'archived').slice(0, 3);
    return {
      ...(progressData || {}),
      completedRuns: [...pinnedRecords, ...autoRecords],
    };
  };

  const saveCompletedRunRecord = async (record: FateCompletionRecord, basePayload: Record<string, any> = {}) => {
    if (!user || !db || !record.sourceStoryId) return;
    let existingProgress: any = null;
    try {
      existingProgress = await getUserProgress(db as any, user.uid, record.sourceStoryId);
    } catch (error) {
      console.warn('[progress:load-before-completion-record]', error);
    }
    const mergedPayload = { ...(existingProgress || {}), ...(basePayload || {}) };
    await saveUserProgress(db as any, user.uid, record.sourceStoryId, {
      ...appendCompletedRunToProgress(mergedPayload, record),
      ...buildEndingProgressSnapshot(endingValue, uiFeedback, true),
      completedAt: record.completedAt,
    });
  };

  const findStoryListItemById = (storyId?: string) => {
    if (!storyId) return null;
    return [...asSafeArray(publicStories), ...asSafeArray(myStories), ...asSafeArray(mySharedStories)]
      .find((story: any) => String(story?.id || story?.storyId || story?.sourceStoryId) === String(storyId)) || null;
  };

  const getSequelRequirementFromMeta = (meta?: any, continuityNode?: ContinuityNodeRecord | null) => {
    const constraints = meta?.seriesConstraints || meta?.series_constraints || {};
    const requiredBranchIds = asSafeArray<string>(
      constraints.requiredBranchIds ||
      constraints.required_branch_ids ||
      constraints.continuityRequiredBranchIds ||
      continuityNode?.requiredBranchIds
    ).map(String).filter(Boolean);
    const forbiddenBranchIds = asSafeArray<string>(
      constraints.forbiddenBranchIds ||
      constraints.forbidden_branch_ids ||
      constraints.excludedBranchIds ||
      constraints.excluded_branch_ids ||
      (continuityNode as any)?.forbiddenBranchIds ||
      (continuityNode as any)?.excludedBranchIds
    ).map(String).filter(Boolean);
    const sourceStoryId = String(
      constraints.sourceStoryId ||
      constraints.source_story_id ||
      continuityNode?.sourceStoryId ||
      meta?.sourceStoryId ||
      ''
    ).trim();
    const endingId = String(
      constraints.endingId ||
      constraints.requiredEndingId ||
      constraints.continuityEndingId ||
      continuityNode?.endingId ||
      ''
    ).trim();
    const isSequel = meta?.seriesRole === 'sequel' || meta?.series_role === 'sequel' || Boolean(meta?.continuityNodeId || meta?.continuity_node_id || constraints.continuityNodeId || sourceStoryId || continuityNode?.id);
    if (!isSequel || !sourceStoryId || (!requiredBranchIds.length && !endingId)) return null;
    const requiredBranchDetails = asSafeArray<any>(
      constraints.requiredBranches ||
      constraints.selectedBranches ||
      constraints.continuityBranches ||
      continuityNode?.legacyState?.branches
    );
    const forbiddenBranchDetails = asSafeArray<any>(
      constraints.forbiddenBranches ||
      constraints.excludedBranches ||
      (continuityNode as any)?.forbiddenBranches ||
      (continuityNode as any)?.excludedBranches
    );
    return {
      sourceStoryId,
      sourceTitle: constraints.sourceTitle || constraints.sourceStoryTitle || continuityNode?.legacyState?.sourceTitle || findStoryListItemById(sourceStoryId)?.title || '前作',
      endingId,
      endingName: constraints.endingTitle || constraints.requiredEndingTitle || continuityNode?.legacyState?.ending?.title || endingId,
      continuityTitle: constraints.continuityTitle || continuityNode?.title || '',
      bridgeSummary: constraints.bridgeSummary || continuityNode?.bridgeSummary || '',
      repairRules: asSafeArray<any>(constraints.repairRules || continuityNode?.repairRules),
      sequelSeedPrompt: constraints.sequelSeedPrompt || continuityNode?.sequelSeedPrompt || '',
      previousStorySummary: asSafeArray<any>(constraints.previousStorySummary || continuityNode?.legacyState?.chapterArc),
      previousCharacters: asSafeArray<any>(constraints.previousCharacters || continuityNode?.legacyState?.characters),
      requiredBranchIds,
      requiredBranches: requiredBranchDetails,
      forbiddenBranchIds,
      forbiddenBranches: forbiddenBranchDetails,
    };
  };

  const buildSeriesCarryoverFromMeta = (meta?: any) => {
    const constraints = meta?.seriesConstraints || meta?.series_constraints || {};
    const seriesId = meta?.seriesId || meta?.series_id || null;
    const seriesTitle = constraints.seriesTitle || meta?.seriesTitle || '';
    const sourceStoryId = constraints.sourceStoryId || constraints.source_story_id || null;
    const endingId = constraints.endingId || constraints.requiredEndingId || '';
    const requiredBranchIds = asSafeArray<string>(constraints.requiredBranchIds || constraints.required_branch_ids);
    const continuityNodeId = meta?.continuityNodeId || meta?.continuity_node_id || constraints.continuityNodeId || null;
    const hasSeries = Boolean(seriesId || seriesTitle);
    const hasContinuity = Boolean(sourceStoryId || endingId || requiredBranchIds.length || continuityNodeId);
    return {
      seriesContext: hasSeries ? {
        id: seriesId || '',
        title: seriesTitle || '',
        pitch: '',
        genreTags: constraints.genreTags || meta?.tags || [],
        worldBible: {
          baselineRules: constraints.selectedBaselineRules || [],
          characterPool: constraints.selectedCharacterCards || [],
        },
        visibility: 'private',
      } : null,
      continuityNode: hasContinuity ? {
        id: continuityNodeId || (sourceStoryId && endingId ? `anchor:${sourceStoryId}:${endingId}:${requiredBranchIds.join('-')}` : ''),
        seriesId: seriesId || '',
        sourceStoryId,
        title: constraints.continuityTitle || constraints.endingTitle || '继承条件',
        endingDomain: constraints.endingDomain || endingDomainFromId(endingId),
        endingId,
        requiredBranchIds,
        optionalBranchIds: [],
        bridgeSummary: constraints.bridgeSummary || '',
        legacyState: {
          sourceTitle: constraints.sourceTitle || '',
          ending: { id: endingId, title: constraints.endingTitle || endingId },
          branches: constraints.requiredBranches || [],
          chapterArc: constraints.previousStorySummary || [],
          characters: constraints.previousCharacters || [],
        },
        repairRules: constraints.repairRules || [],
        sequelSeedPrompt: constraints.sequelSeedPrompt || '',
        visibility: 'private',
        createdBy: meta?.authorId || meta?.author_id || '',
        createdAt: meta?.createdAt || meta?.created_at || '',
        updatedAt: meta?.updatedAt || meta?.updated_at || '',
      } as ContinuityNodeRecord : null,
      seriesSelection: hasSeries ? {
        baselineRuleIds: asSafeArray<string>(constraints.baselineRuleIds),
        characterIds: asSafeArray<string>(constraints.characterIds),
        useContinuity: hasContinuity,
        sourceStoryId: sourceStoryId || '',
        continuityNodeId: continuityNodeId || '',
        requiredBranchIds,
        endingId,
        hardSettings: constraints.sequelSeedPrompt || asSafeArray<any>(constraints.repairRules).map((rule) => rule?.rule || rule?.text || rule).filter(Boolean).join('\n'),
      } as SeriesSelectionState : null,
    };
  };

  const resolveSequelRequirement = async (meta?: any) => {
    const direct = getSequelRequirementFromMeta(meta);
    if (direct) return direct;
    const seriesId = String(meta?.seriesId || meta?.series_id || '').trim();
    const continuityNodeId = String(meta?.continuityNodeId || meta?.continuity_node_id || meta?.seriesConstraints?.continuityNodeId || '').trim();
    if (!db || !seriesId || !continuityNodeId || continuityNodeId.startsWith('anchor:')) return null;
    let nodes = continuityNodes.filter((node) => node.seriesId === seriesId);
    if (nodes.length === 0) {
      try {
        nodes = await listContinuityNodes(db as any, seriesId, 80);
        setContinuityNodes((prev) => {
          const byId = new Map(prev.map((node) => [node.id, node]));
          nodes.forEach((node) => byId.set(node.id, node));
          return Array.from(byId.values());
        });
      } catch (error) {
        console.warn('[sequel-gate:continuity-node]', error);
        return null;
      }
    }
    const node = nodes.find((item) => item.id === continuityNodeId) || null;
    return node ? getSequelRequirementFromMeta(meta, node) : null;
  };

  const createFateRecordFromProgress = (sourceStoryId: string, progressData: any): FateCompletionRecord | null => {
    if (!progressData) return null;
    const endingDomain = ['left', 'right', 'middle'].includes(progressData.endingDomain)
      ? progressData.endingDomain
      : endingDomainFromValue(Number(progressData.endingValue || 0));
    const selectedEndingId = String(progressData.selectedEndingId || progressData.finalEndingId || (endingDomain === 'middle' ? 'default' : endingDomain));
    const branchList = asSafeArray<any>(progressData.unlockedBranches || progressData.historicallyUnlockedBranches);
    const historicalList = asSafeArray<any>(progressData.historicallyUnlockedBranches || progressData.unlockedBranches);
    const completedAt = String(progressData.completedAt || progressData.savedLocallyAt || new Date().toISOString());
    return {
      runId: String(progressData.runId || `${sourceStoryId}:${selectedEndingId}:${completedAt}`),
      sourceStoryId,
      storyTitle: String(progressData.activeStoryMeta?.title || progressData.blueprint?.title || findStoryListItemById(sourceStoryId)?.title || '前作命运线'),
      endingDomain: endingDomain as 'left' | 'right' | 'middle',
      selectedEndingId,
      selectedEndingTitle: inheritedEndingDisplayLabel({ endingDomain: endingDomain as 'left' | 'right' | 'middle', selectedEndingId }),
      unlockedBranchIds: branchList.map((branch) => String(typeof branch === 'string' ? branch : branch?.id || '')).filter(Boolean),
      unlockedBranches: branchList.map((branch) => ({ id: String(typeof branch === 'string' ? branch : branch?.id || ''), name: String(typeof branch === 'string' ? branch : branch?.name || branch?.title || branch?.id || '') })).filter((branch) => branch.id),
      historicallyUnlockedBranchIds: historicalList.map((branch) => String(typeof branch === 'string' ? branch : branch?.id || '')).filter(Boolean),
      characterStatuses: progressData.characterStatuses || {},
      storyConclusion: String(progressData.storyConclusion || ''),
      chapterSummaries: asSafeArray<any>(progressData.currentChapters || progressData.chapters).slice(0, 7).map((chapter) => ({
        chapterNum: Number(chapter.chapter_num || chapter.chapterNum || 0),
        title: String(chapter.title || ''),
        summary: String(chapter.summary || chapter.text || '').slice(0, 520),
      })).filter((chapter) => chapter.chapterNum > 0),
      completedAt,
      sourceType: 'auto',
      pinned: false,
    };
  };

  const getArchivedFateRecordsForStory = (sourceStoryId: string): FateCompletionRecord[] => (
    asSafeArray<any>(mySharedStories)
      .filter((story) => (
        story?.archiveKind !== 'favorite' &&
        String(story?.sourceStoryId || '') === String(sourceStoryId || '') &&
        story?.fateRecord
      ))
      .map((story) => ({
        ...story.fateRecord,
        runId: String(story.fateRecord?.runId || story.id || ''),
        sourceStoryId: String(story.fateRecord?.sourceStoryId || story.sourceStoryId || sourceStoryId),
        storyTitle: String(story.fateRecord?.storyTitle || story.title || '前作命运线'),
        endingDomain: ['left', 'right', 'middle'].includes(story.fateRecord?.endingDomain) ? story.fateRecord.endingDomain : 'middle',
        selectedEndingId: String(story.fateRecord?.selectedEndingId || 'default'),
        unlockedBranchIds: asSafeArray<string>(story.fateRecord?.unlockedBranchIds),
        unlockedBranches: asSafeArray<any>(story.fateRecord?.unlockedBranches),
        historicallyUnlockedBranchIds: asSafeArray<string>(story.fateRecord?.historicallyUnlockedBranchIds),
        characterStatuses: story.fateRecord?.characterStatuses || {},
        storyConclusion: String(story.fateRecord?.storyConclusion || ''),
        chapterSummaries: asSafeArray<any>(story.fateRecord?.chapterSummaries),
        completedAt: String(story.fateRecord?.completedAt || story.updatedAt || story.createdAt || ''),
        sourceType: 'archived' as const,
        pinned: true,
      }))
      .filter((record) => record.runId && record.sourceStoryId)
  );

  const evaluateSequelGate = async (cartridge: any) => {
    if (!user || !db) return { allowed: true as const };
    const requirement = await resolveSequelRequirement(cartridge?.meta);
    if (!requirement) {
      const meta = cartridge?.meta || {};
      const hasSequelMarker = meta.seriesRole === 'sequel' || meta.series_role === 'sequel' || Boolean(meta.continuityNodeId || meta.continuity_node_id || meta.seriesConstraints?.continuityNodeId);
      if (!hasSequelMarker) return { allowed: true as const };
      return {
        allowed: false as const,
        modal: {
          storyId: meta.id || '',
          sourceStoryId: '',
          sourceTitle: '前作',
          missingBranches: [],
          missingEnding: { id: 'continuity-unavailable', name: '续作前置条件暂时无法读取，请稍后重试。' },
        },
      };
    }
    let sourceProgress: any = null;
    try {
      sourceProgress = await getUserProgress(db as any, user.uid, requirement.sourceStoryId);
    } catch (error) {
      console.warn('[sequel-gate:progress]', error);
      return {
        allowed: false as const,
        modal: {
          storyId: cartridge?.meta?.id || '',
          sourceStoryId: requirement.sourceStoryId,
          sourceTitle: requirement.sourceTitle,
          missingBranches: requirement.requiredBranchIds.map((id) => ({ id, name: requirement.requiredBranches.find((branch: any) => String(branch?.id) === id)?.name || id })),
          missingEnding: requirement.endingId ? { id: requirement.endingId, name: requirement.endingName || requirement.endingId } : undefined,
        },
      };
    }
    const currentRunBranches = asSafeArray<any>(sourceProgress?.unlockedBranches);
    const legacyBranchSource = currentRunBranches.length > 0
      ? currentRunBranches
      : asSafeArray<any>(sourceProgress?.historicallyUnlockedBranches);
    const historicalIds = new Set(
      legacyBranchSource
        .map((branch) => String(typeof branch === 'string' ? branch : branch?.id || ''))
        .filter(Boolean)
    );
    const missingBranches = requirement.requiredBranchIds
      .filter((id) => !historicalIds.has(id))
      .map((id) => ({ id, name: requirement.requiredBranches.find((branch: any) => String(branch?.id) === id)?.name || id }));
    const forbiddenBranches = asSafeArray<string>(requirement.forbiddenBranchIds)
      .filter((id) => historicalIds.has(id))
      .map((id) => ({ id, name: `不应触发：${requirement.forbiddenBranches?.find((branch: any) => String(branch?.id) === id)?.name || id}` }));
    const progressDomain = String(sourceProgress?.endingDomain || endingDomainFromValue(Number(sourceProgress?.endingValue || 0)));
    const explicitProgressEndingId = sourceProgress?.selectedEndingId || sourceProgress?.finalEndingId;
    const progressEndingId = String(explicitProgressEndingId || (progressDomain === 'middle' ? 'default' : progressDomain));
    const requiredEndingId = requirement.endingId;
    const endingMatches = !requiredEndingId ||
      (explicitProgressEndingId
        ? requiredEndingId === progressEndingId
        : requiredEndingId === progressDomain || endingDomainFromId(requiredEndingId) === progressDomain);
    const sourceProgressLooksCompleted = Boolean(
      sourceProgress?.completedAt ||
      sourceProgress?.storyConclusion ||
      Number(sourceProgress?.interventionsLeft ?? 3) <= 0
    );
    const recordMap = new Map<string, FateCompletionRecord>();
    [...getCompletedRunRecords(sourceProgress), ...getArchivedFateRecordsForStory(requirement.sourceStoryId)].forEach((record) => {
      if (!record?.runId) return;
      const existing = recordMap.get(record.runId);
      if (!existing || record.sourceType === 'archived') {
        recordMap.set(record.runId, record);
      }
    });
    const records = Array.from(recordMap.values());
    const eligibleRecords = records.filter((record) => {
      const branchIds = new Set((record.unlockedBranchIds || []).map(String));
      const branchesOk = requirement.requiredBranchIds.every((id) => branchIds.has(id));
      const forbiddenOk = !asSafeArray<string>(requirement.forbiddenBranchIds).some((id) => branchIds.has(id));
      const recordEndingMatches = !requiredEndingId ||
        requiredEndingId === record.selectedEndingId ||
        (!record.selectedEndingId && (requiredEndingId === record.endingDomain || endingDomainFromId(requiredEndingId) === record.endingDomain));
      return branchesOk && forbiddenOk && recordEndingMatches;
    });
    const fallbackRecord = records.length === 0 && sourceProgressLooksCompleted && missingBranches.length === 0 && forbiddenBranches.length === 0 && endingMatches
      ? createFateRecordFromProgress(requirement.sourceStoryId, sourceProgress)
      : null;
    const inheritableRecords = eligibleRecords.length ? eligibleRecords : (fallbackRecord ? [fallbackRecord] : []);
    if (inheritableRecords.length > 0) return { allowed: true as const, requirement, sourceProgress, eligibleRecords: inheritableRecords };
    const noEligibleCompletedRun = sourceProgressLooksCompleted && records.length > 0 && missingBranches.length === 0 && forbiddenBranches.length === 0 && endingMatches;
    return {
      allowed: false as const,
      modal: {
        storyId: cartridge?.meta?.id || '',
        sourceStoryId: requirement.sourceStoryId,
        sourceTitle: requirement.sourceTitle,
        missingBranches: [...missingBranches, ...forbiddenBranches],
        missingEnding: endingMatches
          ? (sourceProgressLooksCompleted
              ? (noEligibleCompletedRun ? { id: 'no-eligible-record', name: '没有找到同时符合这些支线与结局的前作完成记录。' } : undefined)
              : { id: 'not-completed', name: '前作需要先完成并记录结局。' })
          : { id: requiredEndingId, name: requirement.endingName || requiredEndingId },
      },
    };
  };

  const buildCurrentRunSnapshot = () => ({
    userId: user?.uid,
    storyId: activeStoryId,
    gameState,
    selectedThemes,
    blueprint,
    activeStoryMeta,
    interventionsLeft,
    endingValue,
    unlockedBranches,
    historicallyUnlockedBranches,
    intervenedChapters,
    naturalChapters,
    initialNaturalChapters,
    characterStatuses,
    storyConclusion,
    interventionHistory,
    worldStateDigest,
    deltaWorldStateByChapter,
    currentChapters: chapters,
    changeHighlights,
    uiFeedback,
    ...buildEndingProgressSnapshot(endingValue, uiFeedback, Boolean(storyConclusion || interventionsLeft <= 0)),
    savedLocallyAt: Date.now(),
  });

  const applyLocalRunSnapshot = async (snapshot: any) => {
    if (!snapshot?.blueprint) return false;
    const historicalBranches = normalizeHistoricalUnlockedBranchesForBlueprint(
      asSafeArray(snapshot.historicallyUnlockedBranches || snapshot.unlockedBranches),
      snapshot.blueprint
    );
    navigateTo(snapshot.gameState === 'SUMMARY' ? 'PLAYING' : snapshot.gameState || 'PLAYING', { reset: true });
    setSelectedThemes(asSafeArray(snapshot.selectedThemes));
    setBlueprint({
      ...snapshot.blueprint,
      tags: asSafeArray(snapshot.blueprint?.tags),
      characters: asSafeArray(snapshot.blueprint?.characters),
      chapters: asSafeArray(snapshot.blueprint?.chapters),
      branches: asSafeArray(snapshot.blueprint?.branches),
      endings: asSafeArray(snapshot.blueprint?.endings),
    });
    setChapters(asSafeArray(snapshot.currentChapters));
    setChangeHighlights(snapshot.changeHighlights || {});
    setInterventionsLeft(snapshot.interventionsLeft ?? 3);
    setEndingValue(snapshot.endingValue || 0);
    setUnlockedBranches(normalizeUnlockedBranchesForBlueprint(asSafeArray(snapshot.unlockedBranches), snapshot.blueprint));
    setHistoricallyUnlockedBranches(historicalBranches);
    setIntervenedChapters(asSafeArray(snapshot.intervenedChapters));
    setNaturalChapters(asSafeArray(snapshot.naturalChapters));
    setInitialNaturalChapters(asSafeArray(snapshot.initialNaturalChapters));
    setCharacterStatuses(snapshot.characterStatuses || {});
    setStoryConclusion(snapshot.storyConclusion || null);
    setActiveStoryId(snapshot.storyId || null);
    setActiveStoryMeta(snapshot.activeStoryMeta || null);
    setInterventionHistory(asSafeArray(snapshot.interventionHistory));
    setWorldStateDigest(snapshot.worldStateDigest || snapshot?.[legacyWorldStateKey] || null);
    setDeltaWorldStateByChapter(snapshot.deltaWorldStateByChapter || {});
    if (snapshot.uiFeedback) setUiFeedback(snapshot.uiFeedback);
    if (snapshot.storyId && snapshot.cartridge) {
      await cacheStoryCartridge(snapshot.storyId, snapshot.cartridge);
    }
    setSessionId(user?.uid || null);
  };

  const refreshStories = async (options: { force?: boolean; includeArchive?: boolean; publicSort?: StoryLibrarySort } = {}) => {
    if (!user || !db) return false;
    const requestedPublicSort = options.publicSort || storyLibrarySort;
    setIsLoadingStories(true);
    markStoryListSegment('public', 'loading');
    markStoryListSegment('mine', 'loading');
    if (options.includeArchive) markStoryListSegment('archive', 'loading');
    try {
      const cached = await getStoryListCache();
      if (cached?.value) {
        applyStoryListCache(cached.value);
        if (!options.force && cached.value.publicSort === requestedPublicSort && Date.now() - cached.updatedAt < STORY_LIST_CACHE_TTL_MS) {
          setStoryListLoadError(null);
          markStoryListSegment('public', 'stale');
          markStoryListSegment('mine', 'stale');
          if (cached.value.shared) markStoryListSegment('archive', 'stale');
          return true;
        }
      }
      markStoryListSegment('public', 'syncing');
      markStoryListSegment('mine', 'syncing');
      const [publicResult, mineResult] = await Promise.allSettled([
        withTimeout(
          retryOnlineOnce(() => listPublicStories(db as any, PUBLIC_STORY_LIST_LIMIT, requestedPublicSort), 'public story list'),
          24000,
          '公开作品同步超时。'
        ),
        withTimeout(
          retryOnlineOnce(() => listMyStories(db as any, user.uid, MY_STORY_LIST_LIMIT), 'my story list'),
          24000,
          '我的作品同步超时。'
        ),
      ]);
      const pub = publicResult.status === 'fulfilled'
        ? asSafeArray(publicResult.value)
        : asSafeArray(cached?.value?.pub || publicStories);
      const mine = mineResult.status === 'fulfilled'
        ? asSafeArray(mineResult.value)
        : asSafeArray(cached?.value?.mine || myStories);
      if (publicResult.status === 'rejected') markStoryListSegment('public', 'error', String(publicResult.reason?.message || publicResult.reason || '公开作品同步失败'));
      else markStoryListSegment('public', 'idle');
      if (mineResult.status === 'rejected') markStoryListSegment('mine', 'error', String(mineResult.reason?.message || mineResult.reason || '我的作品同步失败'));
      else markStoryListSegment('mine', 'idle');

      let shared = asSafeArray(cached?.value?.shared || mySharedStories);
      if (options.includeArchive) {
        markStoryListSegment('archive', 'syncing');
        try {
          shared = asSafeArray(await withTimeout(
            retryOnlineOnce(() => listMySharedStories(db as any, user.uid, ARCHIVE_STORY_LIST_LIMIT), 'archive story list'),
            28000,
            '连接收藏馆超时，稍后进入收藏馆时会继续同步。'
          ));
          markStoryListSegment('archive', 'idle');
        } catch (archiveError: any) {
          markStoryListSegment('archive', 'error', String(archiveError?.message || archiveError || '收藏馆同步失败'));
        }
      }
      setPublicStories(asSafeArray(pub));
      setMyStories(asSafeArray(mine));
      setMySharedStories(asSafeArray(shared));
      await cacheStoryLists(pub, mine, shared, requestedPublicSort);
      const publicFailed = publicResult.status === 'rejected';
      const mineFailed = mineResult.status === 'rejected';
      const segmentErrors = [publicResult, mineResult].filter((result) => result.status === 'rejected');
      if (segmentErrors.length === 2 && !cached?.value) {
        const message = '作品库同步失败，请稍后重试。';
        setStoryListLoadError(message);
        setManualConnectivityNotice({ tone: 'error', title: '作品库同步失败', detail: message });
        showError(message);
        return false;
      }
      const partialMessage = publicFailed && !mineFailed
        ? '公开作品同步失败，我的作品仍可浏览。'
        : mineFailed && !publicFailed
          ? '我的作品同步失败，公开作品仍可浏览。'
          : segmentErrors.length
            ? '部分作品列表同步失败，已保留可用内容。'
            : null;
      setStoryListLoadError(partialMessage);
      if (partialMessage) setManualConnectivityNotice({ tone: 'weak', title: '部分作品列表同步失败', detail: partialMessage });
      if (partialMessage) showError(partialMessage);
      return segmentErrors.length < 2;
    } catch (error: any) {
      console.error(error);
      const cached = await getStoryListCache();
      if (cached?.value) applyStoryListCache(cached.value);
      const message = getFriendlyServerError(error, '作品库同步失败。');
      setStoryListLoadError(message);
      showError(message);
      return false;
    } finally {
      setIsLoadingStories(false);
    }
  };

  const refreshArchiveStories = async (options: { force?: boolean } = {}) => {
    if (archiveRefreshInFlightRef.current) {
      if (options.force) markStoryListSegment('archive', 'syncing');
      return archiveRefreshInFlightRef.current;
    }
    const refreshTask = (async () => {
    if (!user || !db) {
      const message = '收藏馆暂时无法连接账号资料，请稍后重试。';
      markStoryListSegment('archive', 'error', message);
      showError(message);
      return;
    }
    setIsLoadingStories(true);
    markStoryListSegment('archive', 'loading');
    try {
      const cached = await getStoryListCache();
      if (cached?.value?.shared) {
        setMySharedStories(asSafeArray(cached.value.shared));
        if (!options.force && Date.now() - cached.updatedAt < STORY_LIST_CACHE_TTL_MS) {
          markStoryListSegment('archive', 'stale');
          return;
        }
      }
      markStoryListSegment('archive', 'syncing');
      const shared = asSafeArray(await withTimeout(
        retryOnlineOnce(() => listMySharedStories(db as any, user.uid, ARCHIVE_STORY_LIST_LIMIT), 'archive story list'),
        28000,
        '连接收藏馆超时，已先显示本机缓存。'
      ));
      setMySharedStories(shared);
      await cacheStoryLists(publicStories, myStories, shared);
      markStoryListSegment('archive', 'idle');
    } catch (error: any) {
      console.error(error);
      const cached = await getStoryListCache();
      if (cached?.value?.shared) setMySharedStories(asSafeArray(cached.value.shared));
      const message = getFriendlyServerError(error, '收藏馆同步失败，已先显示本机缓存。');
      markStoryListSegment('archive', 'error', message);
      showError(message);
    } finally {
      setIsLoadingStories(false);
    }
    })();
    archiveRefreshInFlightRef.current = refreshTask;
    try {
      await refreshTask;
    } finally {
      if (archiveRefreshInFlightRef.current === refreshTask) {
        archiveRefreshInFlightRef.current = null;
      }
    }
  };

  const refreshFollowedAuthors = async () => {
    if (!user || !db) {
      setFollowedAuthors([]);
      return;
    }
    try {
      setFollowedAuthorsLoading(true);
      const rows = await listFollowedAuthors(db as any, 100);
      setFollowedAuthors(rows || []);
    } catch (error) {
      console.warn('followed authors sync failed:', error);
      showError('追踪作者列表同步失败，请稍后再试。');
    } finally {
      setFollowedAuthorsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      authorMetricSnapshotRef.current = new Map();
      authorPulseInitializedRef.current = false;
      setAuthorPulseNotifications([]);
      setFollowedAuthors([]);
      setMyBio('');
      return;
    }

    const nextSnapshot = new Map<string, { like: number; favorite: number; share: number; intervention: number }>();
    myStories.forEach((story: any) => {
      const storyId = String(story?.id || '');
      if (!storyId) return;
      nextSnapshot.set(storyId, {
        like: getStoryLikeCount(story),
        favorite: getStoryFavoriteCount(story),
        share: getStoryShareCount(story),
        intervention: getStoryInterventionCount(story),
      });
    });

    if (!authorPulseInitializedRef.current) {
      authorMetricSnapshotRef.current = nextSnapshot;
      authorPulseInitializedRef.current = true;
      const lastKey = `author-pulse:last-encouragement:${user.uid}`;
      const lastSentAt = Number(localStorage.getItem(lastKey) || 0);
      const hasEnoughGap = Date.now() - lastSentAt > 1000 * 60 * 60 * 20;
      const topStory = [...myStories].sort((a: any, b: any) => (
        (getStoryLikeCount(b) + getStoryFavoriteCount(b) + getStoryShareCount(b) + getStoryInterventionCount(b))
        - (getStoryLikeCount(a) + getStoryFavoriteCount(a) + getStoryShareCount(a) + getStoryInterventionCount(a))
      ))[0];
      if (hasEnoughGap && topStory) {
        const title = formatBookTitle(getStoryTitle(topStory));
        const likes = getStoryLikeCount(topStory);
        const favorites = getStoryFavoriteCount(topStory);
        const shares = getStoryShareCount(topStory);
        const interventions = getStoryInterventionCount(topStory);
        pushAuthorPulseNotification({
          storyId: topStory.id,
          tone: 'encourage',
          title: '创作脉搏',
          detail: `${title} 目前收获 ${likes} 个点赞、${favorites} 个收藏、${shares} 次分享、${interventions} 次干涉，可以优先看看它的数据与后续开发方向。`,
        });
        localStorage.setItem(lastKey, String(Date.now()));
      }
      return;
    }

    const previousSnapshot = authorMetricSnapshotRef.current;
    myStories.forEach((story: any) => {
      const storyId = String(story?.id || '');
      const previous = previousSnapshot.get(storyId);
      if (!storyId || !previous) return;
      const title = formatBookTitle(getStoryTitle(story));
      const likeDelta = getStoryLikeCount(story) - previous.like;
      const favoriteDelta = getStoryFavoriteCount(story) - previous.favorite;
      const shareDelta = getStoryShareCount(story) - previous.share;
      const interventionDelta = getStoryInterventionCount(story) - previous.intervention;
      if (likeDelta > 0) {
        pushAuthorPulseNotification({ storyId, tone: 'like', title: '新的点赞', detail: `${title} 新增 ${likeDelta} 个点赞。` });
      }
      if (favoriteDelta > 0) {
        pushAuthorPulseNotification({ storyId, tone: 'favorite', title: '新的收藏', detail: `${title} 新增 ${favoriteDelta} 个收藏。` });
      }
      if (shareDelta > 0) {
        pushAuthorPulseNotification({ storyId, tone: 'share', title: '新的分享', detail: `${title} 新增 ${shareDelta} 次分享。` });
      }
      if (interventionDelta > 0) {
        pushAuthorPulseNotification({ storyId, tone: 'intervention', title: '新的干涉', detail: `${title} 新增 ${interventionDelta} 次干涉。` });
      }
    });
    authorMetricSnapshotRef.current = nextSnapshot;
  }, [myStories, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !db) {
      setNotificationItems([]);
      return;
    }
    void refreshNotificationCenter();
    const timer = window.setInterval(() => {
      void refreshNotificationCenter();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [user?.uid, db]);

  useEffect(() => {
    if (gameState !== 'AUTHORING' || authoringCartridge || !user || !db) return;
    void loadSeriesWorlds();
    const timer = window.setInterval(() => {
      void refreshStories({ force: true });
      void loadSeriesWorlds();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [gameState, authoringCartridge, user?.uid, db, storyLibrarySort]);

  useEffect(() => {
    if (gameState !== 'THEME_SELECTION' || !user || !db) return;
    void loadSeriesWorlds();
  }, [gameState, user?.uid, db]);

  useEffect(() => {
    if (!quickSeriesBindingId) {
      setQuickSeriesSelection((prev) => ({
        ...prev,
        baselineRuleIds: [],
        characterIds: [],
        useContinuity: false,
        sourceStoryId: '',
        continuityNodeId: '',
        requiredBranchIds: [],
        endingId: '',
        hardSettings: '',
      }));
      setQuickContinuitySourceStory(null);
      return;
    }
    const selected = seriesWorlds.find((series) => series.id === quickSeriesBindingId);
    if (!selected) return;
    setSelectedSeriesId(quickSeriesBindingId);
    const baselineRuleIds = getSeriesBaselineRules(selected).map((rule) => rule.id);
    const characterIds = getSeriesCharacterCards(selected).map((card) => card.id);
    setQuickSeriesSelection((prev) => ({
      ...prev,
      baselineRuleIds: prev.baselineRuleIds.length ? prev.baselineRuleIds.filter((id) => baselineRuleIds.includes(id)) : baselineRuleIds,
      characterIds: prev.characterIds.length ? prev.characterIds.filter((id) => characterIds.includes(id)) : characterIds,
      sourceStoryId: '',
      continuityNodeId: '',
      requiredBranchIds: [],
      endingId: '',
      hardSettings: '',
    }));
    void loadContinuityNodesForSeries(quickSeriesBindingId);
  }, [quickSeriesBindingId, seriesWorlds.length]);

  useEffect(() => {
    const sourceStoryId = quickSeriesSelection.sourceStoryId;
    if (!sourceStoryId || !db) {
      setQuickContinuitySourceStory(null);
      return;
    }
    let cancelled = false;
    setQuickContinuityLoading(true);
    getStoryCartridge(db as any, sourceStoryId)
      .then((story) => {
        if (cancelled) return;
        setQuickContinuitySourceStory(story);
        const branchIds = new Set(asSafeArray<any>(story?.branches).map((branch) => String(branch.id || '')).filter(Boolean));
        const endingIds = new Set(asSafeArray<any>(story?.endings).map((ending) => String(ending.id || '')).filter(Boolean));
        setQuickSeriesSelection((prev) => ({
          ...prev,
          requiredBranchIds: prev.requiredBranchIds.filter((id) => branchIds.has(id)),
          endingId: prev.endingId && endingIds.has(prev.endingId) ? prev.endingId : '',
          continuityNodeId: '',
        }));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setQuickContinuitySourceStory(null);
          showError(tr('前作资料读取失败。', 'Failed to load previous story data.'));
        }
      })
      .finally(() => {
        if (!cancelled) setQuickContinuityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quickSeriesSelection.sourceStoryId, db]);

  useEffect(() => {
    if (gameState !== 'AUTHORING' || !authoringCartridge?.meta?.seriesId || authoringCartridge?.meta?.seriesRole !== 'sequel' || !db) {
      setAuthoringContinuitySourceStory(null);
      return;
    }
    const sourceStoryId = String(authoringCartridge.meta?.seriesConstraints?.sourceStoryId || '');
    if (!sourceStoryId) {
      setAuthoringContinuitySourceStory(null);
      return;
    }
    let cancelled = false;
    setAuthoringContinuityLoading(true);
    getStoryCartridge(db as any, sourceStoryId)
      .then((story) => {
        if (cancelled) return;
        setAuthoringContinuitySourceStory(story);
        const branchIds = new Set(asSafeArray<any>(story?.branches).map((branch) => String(branch.id || '')).filter(Boolean));
        const endingIds = new Set(asSafeArray<any>(story?.endings).map((ending) => String(ending.id || '')).filter(Boolean));
        setAuthoringCartridge((prev: any) => {
          if (!prev) return prev;
          const constraints = prev.meta?.seriesConstraints || {};
          const requiredBranchIds = asSafeArray<string>(constraints.requiredBranchIds).filter((id) => branchIds.has(id));
          const endingId = constraints.endingId && endingIds.has(String(constraints.endingId)) ? constraints.endingId : '';
          const previousStorySummary = asSafeArray<any>(story?.chapters)
            .sort((a, b) => Number(a.chapter_num || a.chapterNum || 0) - Number(b.chapter_num || b.chapterNum || 0))
            .map((chapter) => ({
              chapterNum: Number(chapter.chapter_num || chapter.chapterNum || 0),
              title: chapter.title || '',
              summary: chapter.summary || String(chapter.text || '').slice(0, 260),
            }))
            .filter((chapter) => chapter.chapterNum || chapter.summary);
          const previousCharacters = asSafeArray<any>(story?.meta?.characters || (story as any)?.characters)
            .map((character) => ({
              id: character.id || '',
              name: character.name || '',
              desc: character.desc || character.description || '',
            }))
            .filter((character) => character.name || character.desc);
          return {
            ...prev,
            meta: {
              ...prev.meta,
              seriesConstraints: {
                ...constraints,
                requiredBranchIds,
                requiredBranches: asSafeArray<any>(story?.branches).filter((branch) => requiredBranchIds.includes(String(branch.id || ''))).map((branch) => ({
                  id: String(branch.id || ''),
                  name: branch.name || branch.title || branch.id || '',
                  desc: branch.desc || branch.description || '',
                })),
                endingId,
                endingTitle: asSafeArray<any>(story?.endings).find((ending) => String(ending.id || '') === endingId)?.title || '',
                previousStorySummary,
                previousCharacters,
              },
            },
          };
        });
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setAuthoringContinuitySourceStory(null);
          showError(tr('前作资料读取失败。', 'Failed to load previous story data.'));
        }
      })
      .finally(() => {
        if (!cancelled) setAuthoringContinuityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameState, authoringCartridge?.meta?.seriesId, authoringCartridge?.meta?.seriesRole, authoringCartridge?.meta?.seriesConstraints?.sourceStoryId, db]);

  useEffect(() => {
    if (gameState !== 'SERIES_WORLD_EDIT' || !selectedSeriesId) return;
    const selected = seriesWorlds.find((series) => series.id === selectedSeriesId);
    if (selected) {
      setSeriesForm(selected);
      setSeriesWorldBibleText(JSON.stringify(selected.worldBible || {}, null, 2));
      setSeriesIronLawsText(JSON.stringify(selected.ironLaws || [], null, 2));
      setSeriesFutureDirectionsText(JSON.stringify(selected.futureDirections || [], null, 2));
    }
    loadContinuityNodesForSeries(selectedSeriesId).catch(() => {});
  }, [gameState, selectedSeriesId, seriesWorlds.length]);

  const toggleTheme = (theme: string) => {
    setSelectedThemes((prev) => (
      prev.includes(theme)
        ? prev.filter((item) => item !== theme)
        : prev.length >= 4
          ? prev
          : [...prev, theme]
    ));
  };

  const openReadonlyStory = async (storyId: string, options?: { allowBack?: boolean; returnTarget?: GameState }) => {
    if (!db) return;
    try {
      setIsLoadingStories(true);
      setGlobalLoadingMessage(isEnglish ? 'Opening story record...' : '正在打开故事记录...');
      setGlobalLoadingDetail(isEnglish ? 'Reading the saved fate line. If local cache exists, the reader opens first while cloud data is checked.' : '正在读取收藏命运线；如果本机已有缓存，会先进入阅读页再校验云端记录。');
      const cached = await getCachedSharedStory(storyId);
      if (cached?.value) {
        setReadonlyStoryData({ meta: cached.value.meta, chapters: cached.value.chapters as any });
        setReadonlyCanGoBack(Boolean(options?.allowBack));
        setReadonlyReturnTarget(options?.returnTarget || 'STORY_SELECT');
        navigateTo('READONLY_STORY', { reset: !options?.allowBack });
      }
      const record = await getSharedStoryRecord(db as any, storyId, user?.uid);
      if (!record) {
        showError('未找到这份故事记录，或当前账号没有访问权限。');
        return;
      }
      await cacheSharedStory(storyId, { meta: record.meta, chapters: record.chapters as any });
      setReadonlyStoryData({ meta: record.meta, chapters: record.chapters as any });
      setReadonlyCanGoBack(Boolean(options?.allowBack));
      setReadonlyReturnTarget(options?.returnTarget || 'STORY_SELECT');
      navigateTo('READONLY_STORY', { replace: Boolean(cached?.value), reset: !options?.allowBack });
      const nextUrl = buildAppSharedStoryUrl(storyId);
      window.history.replaceState({ internalReadonly: true }, '', nextUrl);
    } catch (error) {
      console.error(error);
      showError('载入故事记录失败。');
    } finally {
      setIsLoadingStories(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const leaveReadonlyStory = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setReadonlyStoryData(null);
    setReadonlyCanGoBack(false);
    if (readonlyCanGoBack) {
      goBack(readonlyReturnTarget);
    } else {
      resetToHome();
    }
  };

  const handleInterveneFromReadonly = async () => {
    if (!readonlyStoryData?.meta || !user || !db) return;
    const originalStoryId = readonlyStoryData.meta?.sourceStoryId;
    if (!originalStoryId) {
      showError('该分享记录未关联原始故事，无法直接干涉。');
      return;
    }
    setReadonlyStoryData(null);
    setReadonlyCanGoBack(false);
    window.history.replaceState({}, '', window.location.pathname);
    await startStoryPlay(originalStoryId);
  };

  const handleAdaptFromReadonly = async () => {
    if (!readonlyStoryData?.meta || !readonlyStoryData?.chapters || !user || !db) return;
    if (!canAdaptReadonlyStory(readonlyStoryData.meta)) {
      showError('原作者尚未开放这篇作品的一键改编权限。');
      return;
    }
    try {
      setIsLoadingStories(true);
      const carryover = buildSeriesCarryoverFromMeta(readonlyStoryData.meta);
      const blueprint = {
        title: stripBookTitle(readonlyStoryData.meta.title || '未命名故事'),
        main_axis: readonlyStoryData.meta.main_axis || '（无主轴记录）',
        characters: readonlyStoryData.meta.characters || [],
        tags: readonlyStoryData.meta.tags || [],
        chapters: readonlyStoryData.chapters.map((chapter) => ({
          chapter_num: chapter.chapter_num,
          title: chapter.title || `第${chapter.chapter_num}章`,
          summary: chapter.summary || '',
          present_characters: Array.isArray(chapter.present_characters) ? chapter.present_characters : [],
          text: '',
        })),
        endings: [],
        left_mainline_default: 40,
        right_mainline_default: 40,
        endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
        seriesContext: carryover.seriesContext,
        continuityNode: carryover.continuityNode,
        seriesSelection: carryover.seriesSelection,
      };
      const resetArtstyleChapters = toDefaultArtstyleChapters(readonlyStoryData.chapters);
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        blueprint,
        chapters: resetArtstyleChapters,
        tags: readonlyStoryData.meta.tags || [],
        seriesId: carryover.seriesContext?.id || readonlyStoryData.meta.seriesId || null,
        continuityNodeId: carryover.continuityNode?.id && !String(carryover.continuityNode.id).startsWith('anchor:')
          ? carryover.continuityNode.id
          : null,
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      navigateTo('AUTHORING');
      showError('已完成一键改编，正在进入作者编辑界面。');
      setReadonlyStoryData(null);
      setReadonlyCanGoBack(false);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error(error);
      showError(`一键改编失败：${error instanceof Error ? error.message : '请稍后再试。'}`);
    } finally {
      setIsLoadingStories(false);
    }
  };

  const handleArchiveVisibilityChange = async (story: any, visibility: 'private' | 'unlisted') => {
    if (!db || !user || !story?.id) return;
    if (story.archiveKind === 'favorite') {
      showError('收藏原作的公开状态由原作者决定。');
      return;
    }
    try {
      setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: true }));
      await updateSharedStoryVisibility(db as any, story.id, {
        authorId: user.uid,
        visibility,
      });
      setMySharedStories((prev) =>
        prev.map((item) => (item.id === story.id ? { ...item, visibility } : item))
      );
      if (readonlyStoryData?.meta?.sharedStoryId === story.id) {
        setReadonlyStoryData((prev) => prev ? { ...prev, meta: { ...prev.meta, visibility } } : prev);
      }
    } catch (error) {
      console.error(error);
      showError('更新公开设置失败，请稍后再试。');
    } finally {
      setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: false }));
    }
  };

  const handleDeleteArchiveStory = (story: any) => {
    if (!db || !user || !story?.id) return;
    setConfirmationModal({
      isOpen: true,
      title: '删除馆藏记录？',
      message: `这只会删除当前账号馆藏里的《${stripBookTitle(story.title || '未命名故事')}》记录，不会删除原作者的作品，也不会影响其他人已拥有的分享链接记录。此操作无法撤销。`,
      onConfirm: async () => {
        try {
          setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: true }));
          if (story.archiveKind === 'favorite') {
            await unfavoriteStory(db as any, story.sourceStoryId || story.id, user.uid);
          } else {
            await deleteSharedStoryRecord(db as any, story.id, user.uid);
          }
          setMySharedStories((prev) => prev.filter((item: any) => item.id !== story.id));
          showError('馆藏记录已删除。');
        } catch (error: any) {
          console.error(error);
          showError(error?.message || '删除馆藏记录失败。');
        } finally {
          setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: false }));
        }
      },
    });
  };

  const shareExistingArchiveStory = async () => {
    const story = readonlyStoryData;
    const archiveId = story?.meta?.sharedStoryId;
    const sourceStoryId = story?.meta?.sourceStoryId || story?.storyId;
    if (!story || !user || (!archiveId && !sourceStoryId)) return;
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing share...' : '正在准备分享...');
      setGlobalLoadingDetail(isEnglish ? 'Checking archive visibility and preparing an unlisted link.' : '正在确认馆藏记录的可见范围，并准备非公开链接。');
      if (archiveId && story.meta?.visibility !== 'unlisted') {
        await handleArchiveVisibilityChange({ id: archiveId }, 'unlisted');
      }
      const shareUrl = archiveId ? buildSharedStoryUrl(archiveId) : buildOriginalStoryUrl(sourceStoryId);
      const shareTitle = formatBookTitle(story.meta?.title || '未命名故事');
      const shareText = buildStoryShareText(shareTitle, story.chapters);
      if (await sharePayload({ title: shareTitle, text: shareText, url: shareUrl })) {
        await recordStoryShare(sourceStoryId);
      }
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享失败。');
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const deleteReadonlyArchiveStory = () => {
    const story = readonlyStoryData;
    const archiveId = story?.meta?.sharedStoryId;
    if (!db || !user || !story || !archiveId || story.meta?.authorId !== user.uid) return;
    setConfirmationModal({
      isOpen: true,
      title: '删除馆藏记录？',
      message: `这会删除当前账号馆藏里的《${stripBookTitle(story.meta?.title || '未命名故事')}》记录。原作者作品不会被删除，但这条记录的分享链接将无法继续访问。此操作无法撤销。`,
      onConfirm: async () => {
        try {
          setArchiveUpdatingIds((prev) => ({ ...prev, [archiveId]: true }));
          await deleteSharedStoryRecord(db as any, archiveId, user.uid);
          setMySharedStories((prev) => prev.filter((item: any) => item.id !== archiveId));
          setReadonlyStoryData(null);
          setReadonlyCanGoBack(false);
          window.history.replaceState({}, '', window.location.pathname);
          goBack(readonlyReturnTarget === 'ARCHIVE' ? 'ARCHIVE' : 'STORY_SELECT');
          showError('馆藏记录已删除。');
        } catch (error: any) {
          console.error(error);
          showError(error?.message || '删除馆藏记录失败。');
        } finally {
          setArchiveUpdatingIds((prev) => ({ ...prev, [archiveId]: false }));
        }
      },
    });
  };

  const openArchiveView = (returnTarget: GameState = gameState === 'PLAYING' ? 'PLAYING' : 'STORY_SELECT') => {
    setArchiveReturnTarget(returnTarget);
    setIsActionMenuOpen(false);
    setIsAccountCenterOpen(false);
    setIsCreationDockOpen(false);
    setArchiveChoiceStoryId(null);
    markStoryListSegment('archive', 'loading');
    navigateTo('ARCHIVE');
    void refreshArchiveStories({ force: true });
    void refreshFollowedAuthors();
  };

  const openPersonalCenter = () => {
    setAccountCenterMode('personal');
    setIsCreationDockOpen(false);
    navigateTo('ACCOUNT_CENTER');
  };

  const openSystemSettings = () => {
    setAccountCenterMode('settings');
    setIsCreationDockOpen(false);
    setIsAccountCenterOpen(true);
  };

  const leaveArchiveView = () => {
    goBack(archiveReturnTarget);
    if (archiveReturnTarget === 'STORY_SELECT') {
      window.setTimeout(() => window.scrollTo({ top: storySelectScrollYRef.current || 0, behavior: 'smooth' }), 0);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const currentUser = auth.currentUser;
      if (currentUser?.isAnonymous) {
        if (isIosDevice()) {
          await linkWithRedirect(currentUser, provider);
          return;
        }
        const result = await linkWithPopup(currentUser, provider);
        await syncCurrentAuthorName(result.user);
      } else {
        if (isIosDevice()) {
          await signInWithRedirect(auth, provider);
          return;
        }
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showError('Google 登录窗口已关闭，请重新操作。');
        return;
      }
      if (code.includes('popup') || code.includes('blocked')) {
        if (auth.currentUser?.isAnonymous) {
          await linkWithRedirect(auth.currentUser, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
        return;
      }
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        await signInWithPopup(auth, provider);
        return;
      }
      console.error(error);
      showError(error?.message || 'Google 登录失败，请重试。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailPasswordLogin = async () => {
    if (!auth || !authEmail.trim() || authPassword.length < 6) {
      showError('请输入有效邮箱和至少 6 位密码。');
      return;
    }
    setIsLoggingIn(true);
    try {
      const email = authEmail.trim();
      const currentUser = auth.currentUser;
      if (currentUser?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, authPassword);
        const result = await linkWithCredential(currentUser, credential);
        await syncCurrentAuthorName(result.user);
        showError('游客账号已注册为正式用户，当前记录已保留。');
        return;
      }
      await signInWithEmailAndPassword(auth, email, authPassword);
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        return;
      }
      if (error?.code === 'auth/credential-already-in-use' || error?.code === 'auth/email-already-in-use') {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        return;
      }
      console.error(error);
      showError(error?.message || '登录失败，请重试。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth || !authEmail.trim()) {
      showError('请先输入邮箱。');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, authEmail.trim());
      showError('密码重设邮件已发送。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '无法发送重设邮件。');
    }
  };

  const handleAnonymousLogin = async () => {
    if (!auth) return;
    setIsLoggingIn(true);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '游客登录失败，请重试。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      setIsSessionHydrated(true);
      return;
    }
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        void syncCurrentAuthorName(result.user);
      }
    }).catch((error) => {
      console.warn('Google redirect callback failed:', error);
      showError('Google 登录回调失败，请重试。');
    });
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      setStartupMessage(u
        ? (isEnglish ? 'Syncing fate records...' : '正在同步命运记录...')
        : (isEnglish ? 'Preparing entrance...' : '正在准备入口...'));
      setIsSessionHydrated(!u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const detectStandalone = () => {
      setIsStandaloneMode(
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', detectStandalone);
    detectStandalone();
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', detectStandalone);
    };
  }, []);

  const handleInstallApp = async () => {
    if (isStandaloneMode) {
      showError('当前已经在 App 模式中使用。');
      return;
    }
    if (isIosDevice()) {
      setShowIosInstallModal(true);
      return;
    }
    if (!installPromptEvent) {
      showError('如果浏览器没有弹出安装提示，请从浏览器菜单选择“安装应用”或“添加到主屏幕”。');
      return;
    }
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setInstallPromptEvent(null);
      setIsStandaloneMode(true);
      showError('已开始安装 App。');
    }
  };

  const copySharePayload = async (payload: ShareData) => {
    const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
    showError(copied ? '已复制分享内容到剪贴板。' : '分享内容已准备好，请手动复制浏览器地址。');
    return copied;
  };

  const openSystemShare = async (payload: ShareData) => {
    if (!navigator.share) {
      return copySharePayload(payload);
    }
    await navigator.share(payload);
    showError('已打开系统分享。');
    return true;
  };

  const deliverPreparedShare = async (payload: ShareData): Promise<boolean> => {
    if (!navigator.share) {
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      showError(copied ? '已复制分享内容到剪贴板。' : '分享链接已准备好，请手动复制浏览器地址。');
      return Boolean(copied);
    }
    try {
      const shared = await openSystemShare(payload);
      if (isIosDevice()) {
        void writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      }
      return shared;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return false;
      }
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      if (copied) {
        showError('系统分享未能打开，但分享内容已复制，可直接粘贴发送。');
        return true;
      }
      throw error;
    }
  };

  const shareArchiveListStory = async (story: any) => {
    if (!story) return;
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing share...' : '正在准备分享...');
      setGlobalLoadingDetail(isEnglish ? 'Checking archive visibility and preparing share content.' : '正在确认馆藏记录的可见范围，并准备分享内容。');
      if (story.archiveKind !== 'favorite' && story.visibility !== 'unlisted') {
        await handleArchiveVisibilityChange(story, 'unlisted');
      }
      const storyId = story.archiveKind === 'favorite' ? (story.sourceStoryId || story.id) : story.id;
      const shareUrl = story.archiveKind === 'favorite' ? buildOriginalStoryUrl(storyId) : buildSharedStoryUrl(storyId);
      const shareTitle = formatBookTitle(story.title || '未命名故事');
      const shareText = buildStoryShareText(shareTitle, story.chapters || []);
      if (await sharePayload({ title: shareTitle, text: shareText, url: shareUrl })) {
        await recordStoryShare(story.archiveKind === 'favorite' ? storyId : story.sourceStoryId);
      }
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享失败。');
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  useEffect(() => {
    setProfileDisplayName(getUserAuthorName(user));
  }, [user]);

  useEffect(() => {
    if (!db || !user?.isAnonymous) return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GUEST_ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    setDoc(doc(db, 'users', user.uid), {
      userId: user.uid,
      isAnonymous: true,
      lastActiveAt: serverTimestamp(),
      lastActiveAtIso: now.toISOString(),
      anonymousExpiresAtIso: expiresAt.toISOString(),
      anonymousRetentionDays: GUEST_ACCOUNT_RETENTION_DAYS,
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => {
      console.warn('Guest activity marker skipped:', error);
    });
  }, [user?.uid, user?.isAnonymous, db]);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    getAppSettings(db as any).then((data) => {
      if (cancelled) return;
      const settings = (data || {}) as Partial<AppFeatureSettings>;
      const nextSettings = {
        ...DEFAULT_FEATURE_SETTINGS,
        coverGenerationEnabled: Boolean(settings.coverGenerationEnabled),
      };
      setFeatureSettings(nextSettings);
      setAdminFeatureDraft(nextSettings);
    }).catch((error) => {
      if (error?.code !== 'permission-denied') {
        console.warn('Unable to read app feature settings:', error);
      }
      setFeatureSettings(DEFAULT_FEATURE_SETTINGS);
      setAdminFeatureDraft(DEFAULT_FEATURE_SETTINGS);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!authoringCartridge) return;
    setAuthoringDirty(buildAuthoringSnapshot(authoringCartridge) !== authoringSavedSnapshot);
  }, [authoringCartridge, authoringSavedSnapshot]);

  useEffect(() => {
    if (!authoringCartridge) {
      setAuthoringFindChapterNums([]);
      setAuthoringFindEndingIds([]);
      return;
    }
    const chapterNums = (authoringCartridge.chapters || [])
      .map((chapter: any) => Number(chapter.chapter_num))
      .filter((chapterNum: number) => Number.isFinite(chapterNum));
    const endingIds = (authoringCartridge.endings || [])
      .map((ending: any) => String(ending.id || ''))
      .filter(Boolean);
    setAuthoringFindChapterNums((prev) => prev.length > 0 ? prev.filter((chapterNum) => chapterNums.includes(chapterNum)) : chapterNums);
    setAuthoringFindEndingIds((prev) => prev.length > 0 ? prev.filter((endingId) => endingIds.includes(endingId)) : endingIds);
  }, [authoringCartridge?.storyId]);

  // Restore the current run from this device only. Firestore progress is read only when the user
  // explicitly opens a story that has saved progress.
  useEffect(() => {
    if (!isAuthReady) return;
    if (!user || !db) {
      setIsSessionHydrated(true);
      return;
    }

    setIsSessionHydrated(false);
    setStartupMessage(isEnglish ? 'Syncing fate records...' : '正在同步命运记录...');

    let cancelled = false;
    const loadSessionOnce = async () => {
      const cachedRun = await getLocalCache<any>(activeRunCacheKey());
      if (cancelled) return;
      void refreshFollowedAuthors();
      const userDoc = await getDoc(doc(db as any, 'users', user.uid)).catch(() => null);
      if (userDoc?.exists() && !cancelled) {
        setMyBio(userDoc.data()?.bio || '');
      }
      if (cachedRun?.value?.gameState === 'PLAYING') {
        await applyLocalRunSnapshot(cachedRun.value);
      } else {
        setSessionId(user.uid);
        resetToHome();
        setStartupMessage(isEnglish ? 'Reading story archive...' : '正在读取作品档案...');
        const loadedStories = await refreshStories().catch((error) => {
          console.warn('Initial story library load skipped:', error);
          return false;
        });
        hasLoadedInitialStoryListRef.current = Boolean(loadedStories);
      }
      setIsSessionHydrated(true);
    };

    loadSessionOnce().catch((error) => {
      if (cancelled) return;
      console.error(error);
      setIsSessionHydrated(true);
      resetToHome();
      showError('同步会话失败，请检查登录状态或服务器权限配置后重试。');
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!user || gameState !== 'PLAYING' || !blueprint) return;
    const snapshot = buildCurrentRunSnapshot();
    const timeout = window.setTimeout(() => {
      setLocalCache(activeRunCacheKey(), snapshot).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    user?.uid,
    gameState,
    blueprint,
    activeStoryId,
    activeStoryMeta,
    chapters,
    changeHighlights,
    interventionsLeft,
    endingValue,
    unlockedBranches,
    historicallyUnlockedBranches,
    intervenedChapters,
    naturalChapters,
    initialNaturalChapters,
    characterStatuses,
    storyConclusion,
    interventionHistory,
    worldStateDigest,
    deltaWorldStateByChapter,
    uiFeedback,
  ]);

  useEffect(() => {
    hasLoadedInitialStoryListRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (!db || !isAuthReady) return;
    const sharedStoryIdFromUrl = getSharedStoryIdFromUrl();
    if (!sharedStoryIdFromUrl) return;
    getCachedSharedStory(sharedStoryIdFromUrl)
      .then((cached) => {
        if (cached?.value) {
          setReadonlyStoryData({ meta: cached.value.meta, chapters: cached.value.chapters as any });
          setReadonlyCanGoBack(Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin);
          navigateTo('READONLY_STORY', { reset: !(Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin) });
        }
        return getSharedStoryRecord(db as any, sharedStoryIdFromUrl, user?.uid);
      })
      .then(async (record) => {
        if (!record) throw new Error('not-found');
        await cacheSharedStory(sharedStoryIdFromUrl, { meta: record.meta, chapters: record.chapters as any });
        setReadonlyStoryData({ meta: record.meta, chapters: record.chapters as any });
        setReadonlyCanGoBack(Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin);
        navigateTo('READONLY_STORY', { replace: true, reset: !(Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin) });
      })
      .catch(() => {
        showError('加载分享故事失败。');
      });
  }, [db, user, isSessionHydrated]);

  const handleSaveProgressAndReturn = async () => {
    if (!user || !activeStoryId || !blueprint) return;
    try {
      setGlobalLoadingMessage(isEnglish ? 'Saving progress...' : '正在保存进度...');
      setGlobalLoadingDetail(isEnglish ? 'Writing the current play progress to the cloud so this work can continue later.' : '正在把当前游玩进度写入云端，方便之后从同一作品继续。');
      await saveUserProgress(db as any, user.uid, activeStoryId, {
        userId: user.uid,
        storyId: activeStoryId,
        gameState: 'PLAYING',
        interventionsLeft,
        endingValue,
        unlockedBranches,
        historicallyUnlockedBranches,
        intervenedChapters,
        naturalChapters,
        initialNaturalChapters,
        characterStatuses,
        storyConclusion,
        interventionHistory,
        worldStateDigest,
        deltaWorldStateByChapter,
        currentChapters: chapters,
        changeHighlights,
        uiFeedback,
        ...buildEndingProgressSnapshot(endingValue, uiFeedback, Boolean(storyConclusion || interventionsLeft <= 0)),
      });
      await resetGame();
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
      setShowLeaveGameModal(false);
    } finally {
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleSaveWorkAndReturn = async () => {
    if (!user || !blueprint) return;
    try {
      setGlobalLoadingMessage(isEnglish ? 'Saving fate line...' : '正在收藏命运...');
      setGlobalLoadingDetail(isEnglish ? 'Checking whether the current story differs from the original. Only changed fate lines are saved as records.' : '正在确认当前故事是否与原作相同；只有变化后的命运线才会作为收藏命运记录。');
      if (activeStoryId && currentRunMatchesOriginal()) {
        await favoriteStory(db as any, activeStoryId, user.uid);
        showError('原作已加入馆藏，不会重复收藏一份相同文本。');
      } else {
        const { shareId, sharedRecord, cleanChapters } = await createCurrentStorySnapshot('unlisted', 'saved_run');
        cacheSharedSnapshotAfterCreate(shareId, sharedRecord, cleanChapters);
        showError('这段命运已加入收藏命运（非公开链接）。');
      }
      await resetGame();
      return;
    } catch (e) {
      console.error(e);
      showError("收藏命运失败");
      setShowLeaveGameModal(false);
    } finally {
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const GenerationProgressBar = () => {
    const percent = Math.max(0, Math.min(100, Math.round(generationProgress || 0)));
    return (
      <div className="mt-4 w-full max-w-xs">
        <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{percent}%</div>
      </div>
    );
  };

  const handleRegenerateQuickStory = () => {
    setBlueprint(null);
    setChapters([]);
    setChangeHighlights({});
    setNaturalChapters([]);
    setInitialNaturalChapters([]);
    setUnlockedBranches([]);
    setHistoricallyUnlockedBranches([]);
    setIntervenedChapters([]);
    setInterventionHistory([]);
    setStoryConclusion(null);
    setActiveStoryId(null);
    setActiveStoryMeta(null);
    setBackgroundGeneratingChapter(null);
    fetchingChapterRef.current = null;
    navigateTo('THEME_SELECTION');
  };

  const handleAdaptCurrentStory = async () => {
    if (!user) {
      showError('请先登录，再进行一键改编。');
      return;
    }
    if (!db || !blueprint) {
      showError('当前没有可改编的故事。');
      return;
    }
    if (!canAdaptCurrentStory()) {
      showError('原作者尚未开放这篇作品的一键改编权限。');
      return;
    }
    try {
      setIsLoadingStories(true);
      const blueprintAny = blueprint as any;
      const metaCarryover = buildSeriesCarryoverFromMeta(activeStoryMeta);
      const fallbackSeries = !blueprintAny.seriesContext && quickSeriesBindingId
        ? seriesWorlds.find((series) => series.id === quickSeriesBindingId) || null
        : null;
      const adaptContinuityNode = blueprintAny.continuityNode || metaCarryover.continuityNode || null;
      const adaptSeriesContext = blueprintAny.seriesContext
        || metaCarryover.seriesContext
        || buildAppliedSeriesContext(fallbackSeries, quickSeriesSelection, adaptContinuityNode)
        || null;
      const rawContinuityNodeId = String(adaptContinuityNode?.id || '');
      const continuityNodeId = rawContinuityNodeId && !rawContinuityNodeId.startsWith('anchor:')
        ? rawContinuityNodeId
        : null;
      const adaptedBlueprint = {
        ...blueprintAny,
        seriesContext: adaptSeriesContext,
        continuityNode: adaptContinuityNode,
        seriesSelection: blueprintAny.seriesSelection || metaCarryover.seriesSelection || (adaptSeriesContext ? quickSeriesSelection : null),
      };
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        blueprint: adaptedBlueprint,
        chapters: toDefaultArtstyleChapters(chapters),
        tags: normalizeTagList((blueprint.tags && blueprint.tags.length > 0 ? blueprint.tags : selectedThemes) || []),
        seriesId: adaptSeriesContext?.id || null,
        continuityNodeId,
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      navigateTo('AUTHORING');
      showError('已完成一键改编，正在进入作者编辑界面。');
    } catch (error) {
      console.error(error);
      showError(`一键改编失败：${error instanceof Error ? error.message : '请稍后再试。'}`);
    } finally {
      setIsLoadingStories(false);
    }
  };

  /*
  const InAppLoadingOverlay = ({ progress, status, variant }: { progress: number; status: string; variant: 'bless' | 'curse' | 'conclude' }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-8"
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="relative mx-auto h-32 w-32">
          <svg className="h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="60"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-zinc-900"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="60"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray="377"
              animate={{ strokeDashoffset: 377 - (377 * progress) / 100 }}
              transition={{ duration: 0.18, ease: 'linear' }}
              className={variant === 'bless' ? 'text-emerald-500' : variant === 'curse' ? 'text-rose-500' : 'text-indigo-500'}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {variant === 'bless' ? <Zap className="h-10 w-10 text-emerald-500" /> : 
             variant === 'curse' ? <Skull className="h-10 w-10 text-rose-500" /> : 
             <Sparkles className="h-10 w-10 text-indigo-500" />}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">{status}</h2>
          <p className="text-sm font-bold text-zinc-500 tracking-widest uppercase">进度 {Math.round(progress)}%</p>
        </div>
      </div>
    </motion.div>
  );
  */

  const showError = (msg: string) => {
    setErrorMsg(getFriendlyServerError(msg, msg));
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const dismissOnboardingGuide = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
    setShowOnboardingGuide(false);
  };

  const startQuickGenerationFromOnboarding = () => {
    dismissOnboardingGuide();
    navigateTo('THEME_SELECTION');
  };

  const dismissPushPermissionPrompt = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1');
    }
    setShowPushPermissionPrompt(false);
  };

  const enablePushNotificationsFromPrompt = async () => {
    await enablePushNotifications();
    dismissPushPermissionPrompt();
  };

  const applyQuickStoryTemplate = (template: typeof QUICK_STORY_TEMPLATES[number]) => {
    const nextTags = template.tags.slice(0, 4);
    setSelectedThemes(nextTags);
    setThemeInputText(nextTags.join('，'));
    setCustomOutline(template.outline);
    setNarrativePerson(template.person);
    setQuickEndingMode(template.endingMode);
    setQuickEndingBias(normalizeEndingBias(template.endingBias));
    showError(`已套用「${template.label}」模板，可继续微调。`);
  };

  const refreshNotificationCenter = async () => {
    if (!db || !user) {
      setNotificationItems([]);
      return;
    }
    try {
      setNotificationLoading(true);
      const rows = await listNotifications(db as any, 60);
      setNotificationItems((prev) => {
        const localRows = prev.filter((item) => item.local);
        const merged = new Map<string, typeof notificationItems[number]>();
        [...localRows, ...(rows || [])].forEach((item: any) => {
          if (!item?.id) return;
          merged.set(item.id, item);
        });
        return Array.from(merged.values()).sort((a, b) => getStoryUpdatedMs({ updatedAt: b.createdAt }) - getStoryUpdatedMs({ updatedAt: a.createdAt }));
      });
    } catch (error) {
      console.warn('notifications sync failed:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const openNotificationCenter = async () => {
    if (!user) {
      setIsAccountCenterOpen(true);
      return;
    }
    setNotificationCenterOpen(true);
    await refreshNotificationCenter();
  };

  const markAllNotificationsRead = async () => {
    try {
      if (db) await markNotificationsRead(db as any);
      const readAt = new Date().toISOString();
      setNotificationItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    } catch (error) {
      console.warn('mark notifications read failed:', error);
      showError('通知已读同步失败，请稍后再试。');
    }
  };

  const clearAllNotifications = async () => {
    const previousItems = notificationItems;
    const previousPulse = authorPulseNotifications;
    setNotificationItems([]);
    setAuthorPulseNotifications([]);
    try {
      if (db) await deleteAllNotifications(db as any);
      showError('通知已清空。');
    } catch (error) {
      console.warn('clear notifications failed:', error);
      setNotificationItems(previousItems);
      setAuthorPulseNotifications(previousPulse);
      showError('通知清空失败，请稍后再试。');
    }
  };

  const deleteNotificationItem = async (notificationId: string) => {
    setNotificationItems((prev) => prev.filter((item) => item.id !== notificationId));
    try {
      if (!notificationId.startsWith('author-pulse-') && db) {
        await deleteNotification(db as any, notificationId);
      }
    } catch (error) {
      console.warn('delete notification failed:', error);
      void refreshNotificationCenter();
      showError('通知删除失败，已重新同步。');
    }
  };

  const closeShareComposer = (success = false) => {
    const resolve = shareComposerResolveRef.current;
    shareComposerResolveRef.current = null;
    setShareComposer(null);
    setShareComposerText('');
    resolve?.(success);
  };

  const confirmShareComposer = async () => {
    if (!shareComposer) return;
    try {
      const payload = { ...shareComposer, text: shareComposerText } as ShareData;
      const shared = await deliverPreparedShare(payload);
      closeShareComposer(shared);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '分享失败。');
      closeShareComposer(false);
    }
  };

  const pushAuthorPulseNotification = (notification: Omit<typeof authorPulseNotifications[number], 'id'>) => {
    const id = `author-pulse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAuthorPulseNotifications((prev) => [
      { ...notification, id },
      ...prev.filter((item) => item.storyId !== notification.storyId || item.tone !== notification.tone).slice(0, 5),
    ].slice(0, 6));
    setNotificationItems((prev) => [
      {
        id,
        local: true,
        type: `author_${notification.tone}`,
        title: notification.title,
        body: notification.detail,
        storyId: notification.storyId,
        createdAt: new Date().toISOString(),
        readAt: null,
      },
      ...prev.filter((item) => item.id !== id),
    ].slice(0, 60));
  };

  const dismissAuthorPulseNotification = (id: string) => {
    setAuthorPulseNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const openAuthorProfile = async (authorId?: string | null, authorName?: string) => {
    if (!authorId) return;
    setAuthorProfileTarget({ authorId, authorName: authorName || `游客+${shortUserId(authorId)}` });
    setAuthorProfileStories([]);
    setAuthorProfileLoading(true);
    setAuthorProfileBio('');
    try {
      if (db) {
        const [stories, followState, userDoc] = await Promise.all([
          listAuthorStories(db as any, authorId, 50),
          user && authorId !== user.uid ? getAuthorFollowState(db as any, authorId) : Promise.resolve({ following: false }),
          getDoc(doc(db as any, 'users', authorId)).catch(() => null),
        ]);
        setAuthorProfileStories(stories || []);
        setAuthorProfileFollowing(Boolean(followState?.following));
        const bio = userDoc?.exists() ? (userDoc.data()?.bio || '') : '';
        setAuthorProfileBio(bio);
      }
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '作者资料载入失败。');
    } finally {
      setAuthorProfileLoading(false);
    }
  };

  const toggleAuthorFollow = async () => {
    if (!authorProfileTarget || !user || !db) {
      setIsAccountCenterOpen(true);
      return;
    }
    if (authorProfileTarget.authorId === user.uid) return;
    try {
      setAuthorProfileBusy(true);
      const result = authorProfileFollowing
        ? await unfollowAuthor(db as any, authorProfileTarget.authorId)
        : await followAuthor(db as any, authorProfileTarget.authorId, authorProfileTarget.authorName);
      setAuthorProfileFollowing(Boolean(result?.following));
      showError(result?.following ? '已追踪作者。' : '已取消追踪。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '追踪操作失败。');
    } finally {
      setAuthorProfileBusy(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  const enablePushNotifications = async () => {
    if (!user) {
      setIsAccountCenterOpen(true);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      showError('这个设备暂时不支持 PWA 推送通知。');
      return;
    }
    try {
      setPushSubscribeBusy(true);
      const config = await getPushConfig();
      if (!config.publicKey || !config.enabled) {
        showError('服务器还没有配置推送密钥，暂时只能使用 App 内通知。');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showError('通知权限尚未允许。');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      await savePushSubscription(subscription.toJSON());
      showError('手机通知已开启。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '开启手机通知失败。');
    } finally {
      setPushSubscribeBusy(false);
    }
  };

  const returnToStoryLibraryFallback = () => {
    setIsSidebarOpen(false);
    setIsActionMenuOpen(false);
    setIsStoryInfoOpen(false);
    setIsAccountCenterOpen(false);
    setShowLeaveGameModal(false);
    setPendingSummaryRequest(null);
    setActiveInterventionOverlay(null);
    setReadonlyStoryData(null);
    setReadonlyCanGoBack(false);
    resetToHome();
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  useEffect(() => {
    const handleFatalError = (event: ErrorEvent | PromiseRejectionEvent) => {
      console.error('Global app error fallback:', event);
      const rawMessage = 'reason' in event
        ? ((event.reason as any)?.message || String(event.reason || ''))
        : ((event.error as any)?.message || event.message || '');
      const detail = String(rawMessage || '').trim().slice(0, 140);
      returnToStoryLibraryFallback();
      showError(detail ? `发生错误：${detail}。已回到作品库。` : '发生错误，已回到作品库。');
    };
    window.addEventListener('error', handleFatalError as EventListener);
    window.addEventListener('unhandledrejection', handleFatalError as EventListener);
    return () => {
      window.removeEventListener('error', handleFatalError as EventListener);
      window.removeEventListener('unhandledrejection', handleFatalError as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isRecoveringInvalidGameState) return;
    const timer = window.setTimeout(() => {
      returnToStoryLibraryFallback();
      showError('页面资料没有完整载入，已回到作品库。');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isRecoveringInvalidGameState]);

  const markCurrentRunAbandoned = async () => {
    if (!user || !db || !activeStoryId) return;
    try {
      let existingProgress: any = null;
      try {
        existingProgress = await getUserProgress(db as any, user.uid, activeStoryId);
      } catch (error) {
        console.warn('[progress:load-before-abandon]', error);
      }
      await saveUserProgress(db as any, user.uid, activeStoryId, {
        ...(existingProgress || {}),
        userId: user.uid,
        storyId: activeStoryId,
        abandonedAt: new Date().toISOString(),
        interventionsLeft: 0,
        historicallyUnlockedBranches,
        unlockedBranches: [],
        currentChapters: [],
        naturalChapters: [],
        initialNaturalChapters: [],
        interventionHistory: [],
        storyConclusion: null,
      });
    } catch (error) {
      console.warn('[progress:abandon-run]', error);
    }
  };

  const resetGame = async (options: { discardCloudProgress?: boolean } = {}) => {
    if (!user || !db) return;
    try {
      setShowLeaveGameModal(false);
      if (options.discardCloudProgress) {
        void markCurrentRunAbandoned();
      }
      const shouldRestoreStorySelectScroll = gameState === 'PLAYING';
      resetToHome();
      setSelectedThemes([]);
      setBlueprint(null);
      setChapters([]);
      setChangeHighlights({});
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setHistoricallyUnlockedBranches([]);
      setIntervenedChapters([]);
      setNaturalChapters([]);
      setInitialNaturalChapters([]);
      setCharacterStatuses({});
      setStoryConclusion(null);
      setActiveStoryId(null);
      setActiveStoryMeta(null);
      setInterventionHistory([]);
      setWorldStateDigest(null);
      setDeltaWorldStateByChapter({});
      await deleteLocalCache(activeRunCacheKey());
      window.setTimeout(() => {
        window.scrollTo({
          top: shouldRestoreStorySelectScroll ? storySelectScrollYRef.current : 0,
          behavior: 'smooth',
        });
      }, 0);
    } catch (e) {
      console.error(e);
      showError("重置命运失败");
      setShowLeaveGameModal(false);
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  const restartCurrentStory = async () => {
    if (!user || !db || !activeStoryId) {
      // No active story to restart — fall back to full reset
      await resetGame();
      return;
    }
    const storyId = activeStoryId;
    try {
      const preservedHistoricalBranches = historicallyUnlockedBranches;
      setGlobalLoadingMessage(isEnglish ? 'Reloading story...' : '正在重新加载故事...');
      setShowLeaveGameModal(false);
      await deleteLocalCache(activeRunCacheKey());
      // Re-load the cartridge and apply with no progress data (fresh start)
      let cartridge = await getCachedStoryCartridge(storyId);
      if (!cartridge) {
        cartridge = await getStoryCartridge(db as any, storyId);
      }
      if (!cartridge) {
        showError(isEnglish ? 'Story reload failed. Returned to the library.' : '重新加载故事失败，已返回作品库。');
        await resetGame();
        return;
      }
      const sequelGate = await evaluateSequelGate({ ...cartridge, meta: { ...(cartridge.meta || {}), id: storyId } });
      if (!sequelGate.allowed) {
        setSequelGateModal(sequelGate.modal);
        return;
      }
      if ('eligibleRecords' in sequelGate && Array.isArray(sequelGate.eligibleRecords) && sequelGate.eligibleRecords.length > 0) {
        setPendingSequelInheritance({
          storyId,
          cartridge,
          progressData: { historicallyUnlockedBranches: preservedHistoricalBranches },
          requirement: (sequelGate as any).requirement,
          records: sequelGate.eligibleRecords as FateCompletionRecord[],
        });
        return;
      }
      applyStoryCartridgeForPlay(storyId, cartridge, { historicallyUnlockedBranches: preservedHistoricalBranches }); // fresh run, account history preserved
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showError(isEnglish ? 'Fate reset. Starting again from chapter 1.' : '命运已重置，从第一章重新开始。');
    } catch (e) {
      console.error(e);
      showError(isEnglish ? 'Restart failed.' : '重新干涉失败');
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  const buildBlueprintFromCartridge = (cartridge: any): Blueprint => ({
    title: cartridge.meta.title,
    main_axis: cartridge.meta.main_axis,
    left_mainline_default: 80,
    right_mainline_default: 40,
    endingMode: cartridge.meta.endingMode,
    endingBias: normalizeEndingBias(cartridge.meta.endingBias || cartridge.meta.endingRates),
    endingNames: cartridge.meta.endingNames,
    characters: cartridge.meta.characters || [],
    chapters: (() => {
      const baseChapters = (cartridge.chapters || []).map((chapter: any) => ({
        chapter_num: chapter.chapter_num,
        title: chapter.title,
        summary: chapter.summary,
        present_characters: Array.isArray(chapter.present_characters) ? chapter.present_characters : [],
        text: chapter.text || '',
      }));
      const chapterSeven = baseChapters.find((chapter: any) => chapter.chapter_num === 7);
      const defaultEnding = (cartridge.endings || []).find((ending: any) => ending.id === 'default');
      const defaultEndingText = (defaultEnding?.text || '').trim();
      if (chapterSeven && !chapterSeven.text.trim() && defaultEndingText) {
        chapterSeven.text = defaultEndingText;
        chapterSeven.title = chapterSeven.title || defaultEnding?.title || '第七章';
      }
      return baseChapters;
    })(),
    endings: [
      { type: 'normal', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'default')?.title || '第七章'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'default')?.text || '') },
      { type: 'good', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.title || '左域默认结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.text || '') },
      { type: 'bad', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.title || '右域默认结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.text || '') },
    ],
    tags: cartridge.meta.tags || [],
    branches: (cartridge.branches || []).map((branch: any) => {
      const condition = branch.trigger?.type === 'single'
        ? branch.trigger.single
        : { chapterNum: 2, charId: cartridge.meta.characters?.[0]?.id || 'c1', action: 'bless' as const };
      return {
        id: branch.id,
        name: branch.name,
        side: branch.side,
        condition_char: condition.charId,
        condition_action: condition.action,
        condition_chapter: condition.chapterNum,
        desc: branch.desc,
        is_hidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
        hint: branch.hint,
        trigger: branch.trigger,
        triggerGroups: branch.triggerGroups,
        tier: normalizeBranchTier(branch.tier),
        inject: branch.inject,
        sceneText: branch.sceneText,
      } as any;
    }),
  });

  const applyStoryCartridgeForPlay = (storyId: string, cartridge: any, progressData?: any) => {
    const nextBlueprint = buildBlueprintFromCartridge(cartridge);
    const baseChapters = progressData?.currentChapters || nextBlueprint.chapters;
    const historicalBranches = normalizeHistoricalUnlockedBranchesForBlueprint(
      progressData?.historicallyUnlockedBranches || progressData?.unlockedBranches || [],
      nextBlueprint
    );
    const initialStatuses: Record<string, { status: string; isDead: boolean }> = {};
    (nextBlueprint.characters || []).forEach((character: any) => {
      initialStatuses[character.id] = { status: '存活', isDead: false };
    });

    setBlueprint(nextBlueprint);
    setActiveStoryId(storyId);
    setActiveStoryMeta(cartridge.meta);
    setSelectedThemes(nextBlueprint.tags || []);
    setChapters(baseChapters);
    setChangeHighlights(progressData?.changeHighlights || {});
    setInterventionsLeft(progressData?.interventionsLeft ?? 3);
    setEndingValue(progressData?.endingValue || 0);
    setUnlockedBranches(normalizeUnlockedBranchesForBlueprint(progressData?.unlockedBranches || [], nextBlueprint));
    setHistoricallyUnlockedBranches(historicalBranches);
    setIntervenedChapters(progressData?.intervenedChapters || []);
    setNaturalChapters(progressData?.naturalChapters || nextBlueprint.chapters);
    setInitialNaturalChapters(progressData?.initialNaturalChapters || nextBlueprint.chapters);
    setCharacterStatuses(progressData?.characterStatuses || initialStatuses);
    setStoryConclusion(progressData?.storyConclusion || null);
    setInterventionHistory(progressData?.interventionHistory || []);
    setWorldStateDigest(progressData?.worldStateDigest || progressData?.[legacyWorldStateKey] || null);
    setDeltaWorldStateByChapter(progressData?.deltaWorldStateByChapter || {});
    setUiFeedback(progressData?.uiFeedback || { leftProgress: 0, rightProgress: 0, endingLabel: '中域' });
    navigateTo('PLAYING');
    scrollToTopAfterViewChange();
    if (storyId === 'tutorial-cartridge' && !progressData) {
      window.setTimeout(() => {
        setConfirmationModal({
          isOpen: true,
          title: '入门试玩已开启',
          message: '这是一段完整离线教学故事，不会消耗 AI 额度。先阅读到第 2 章末尾，点击“干涉命运”，选择林晓和一次庇佑或磨难。第 4 章、第 6 章也会出现干涉点；完成三次后即可查看最终命运。',
          onConfirm: () => {},
        });
      }, 250);
    }
  };

  const startStoryPlay = async (storyId: string) => {
    if (!user || !db) return;
    let launchProgress: number | null = null;
    try {
      launchProgress = startStoryLaunchProgress();
      setStoryLaunchOverlay({ progress: 10, status: isEnglish ? 'Preparing fate line...' : '正在准备命运线...' });
      setIsLoadingStories(true);
      if (gameState === 'STORY_SELECT') {
        storySelectScrollYRef.current = window.scrollY;
      }
      const expectedStory = [...publicStories, ...myStories].find((story: any) => story.id === storyId);
      let precheckedSequelGate: any = null;
      if (expectedStory) {
        precheckedSequelGate = await evaluateSequelGate({ meta: { ...expectedStory, id: storyId } });
        if (!precheckedSequelGate.allowed) {
          setSequelGateModal(precheckedSequelGate.modal);
          return;
        }
      }

      let cartridge = await getCachedStoryCartridge(storyId, expectedStory);
      if (cartridge) {
        setStoryLaunchOverlay({ progress: 34, status: isEnglish ? 'Local story archive loaded...' : '已读取本机故事档案...' });
      }
      if (!cartridge) {
        const staleCartridge = await getAnyCachedStoryCartridge(storyId);
        if (staleCartridge) {
          cartridge = staleCartridge;
          setStoryLaunchOverlay({ progress: 34, status: isEnglish ? 'Opening local story while checking cloud...' : '已先打开本机故事档案，并在后台校验云端版本...' });
          revalidateStoryCartridgeInBackground(storyId);
        }
      }
      if (!cartridge) {
        try {
          setStoryLaunchOverlay({ progress: 28, status: isEnglish ? 'Connecting to cloud story archive...' : '正在连接云端故事档案...' });
          cartridge = await getStoryCartridge(db as any, storyId);
          setStoryLaunchOverlay({ progress: 58, status: isEnglish ? 'Caching full story...' : '正在缓存完整故事...' });
          await cacheStoryCartridge(storyId, cartridge);
        } catch (error) {
          const staleCartridge = await getCachedStoryCartridge(storyId);
          if (!staleCartridge) throw error;
          cartridge = staleCartridge;
          showError('无法连接云端，已使用本机缓存打开故事。');
        }
      }
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      
      setStoryLaunchOverlay({ progress: 72, status: isEnglish ? 'Checking cloud progress...' : '正在检查云端进度...' });
      let progressData: any = null;
      try {
        progressData = await getUserProgress(db as any, user.uid, storyId);
      } catch (progressError: any) {
        console.warn('[story-progress:load]', progressError);
        showError(getFriendlyServerError(progressError, '云端进度暂时无法读取，已先开启原始故事。'));
      }
      
      setStoryLaunchOverlay({ progress: 82, status: isEnglish ? 'Checking sequel requirements...' : '正在检查续作前置条件...' });
      const sequelGate = precheckedSequelGate || await evaluateSequelGate({ ...cartridge, meta: { ...(cartridge.meta || {}), id: storyId } });
      if (!sequelGate.allowed) {
        setSequelGateModal(sequelGate.modal);
        return;
      }

      const canResumeProgress =
        progressData &&
        Number(progressData.interventionsLeft ?? 0) > 0 &&
        !progressData.storyConclusion &&
        !progressData.abandonedAt;

      if (canResumeProgress) {
        setStoryLaunchOverlay({ progress: 100, status: isEnglish ? 'Restorable fate line found' : '发现可继承的命运线' });
        setPendingProgressToLoad({ id: storyId, data: { ...progressData, cartridge } });
        return;
      }
      
      if ('eligibleRecords' in sequelGate && Array.isArray(sequelGate.eligibleRecords) && sequelGate.eligibleRecords.length > 0) {
        const records = sequelGate.eligibleRecords as FateCompletionRecord[];
        setPendingSequelInheritance({
          storyId,
          cartridge,
          progressData,
          requirement: (sequelGate as any).requirement,
          records,
        });
        return;
      }

      setStoryLaunchOverlay({ progress: 92, status: isEnglish ? 'Entering story...' : '正在进入故事...' });
      await startNewStoryPlay(storyId, cartridge, progressData);
    } catch (e) {
      console.error(e);
      showError("无法开启故事");
    } finally {
      if (launchProgress !== null) window.clearInterval(launchProgress);
      setStoryLaunchOverlay((prev) => prev ? { progress: 100, status: isEnglish ? 'Story ready' : '故事已就绪' } : prev);
      window.setTimeout(() => setStoryLaunchOverlay(null), 180);
      setIsLoadingStories(false);
    }
  };

  const startNewStoryPlay = async (storyId: string, loadedCartridge?: any, preservedProgressData?: any) => {
    if (!user || !db) return;
    try {
      const cartridge = loadedCartridge || await getCachedStoryCartridge(storyId) || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      await cacheStoryCartridge(storyId, cartridge);
      applyStoryCartridgeForPlay(storyId, cartridge, preservedProgressData ? {
        historicallyUnlockedBranches: preservedProgressData.historicallyUnlockedBranches || preservedProgressData.unlockedBranches || [],
      } : undefined);
    } catch (e) {
      console.error(e);
      showError("初始化故事失败");
    }
  };

  const buildInheritedFirstChapterText = (chapter: any, record: FateCompletionRecord, requirement: any) => {
    const branchNames = (record.unlockedBranches || [])
      .filter((branch) => requirement?.requiredBranchIds?.includes(branch.id))
      .map((branch) => branch.name || branch.id)
      .filter(Boolean);
    const branchDetails = asSafeArray<any>(requirement?.requiredBranches)
      .filter((branch) => requirement?.requiredBranchIds?.includes(String(branch.id || '')))
      .map((branch) => `${branch.name || branch.title || branch.id}：${branch.desc || branch.description || branch.sceneText || ''}`)
      .filter(Boolean);
    const statusLines = Object.entries(record.characterStatuses || {})
      .slice(0, 6)
      .map(([id, status]: any) => `${id}：${status?.status || '状态未明'}`)
      .join('；');
    const bridgeSummary = String(requirement?.bridgeSummary || '').trim();
    const repairRules = asSafeArray<any>(requirement?.repairRules)
      .map((rule) => String(rule?.rule || rule?.text || rule || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const previousArc = asSafeArray<any>(record?.chapterSummaries?.length ? record.chapterSummaries : requirement?.previousStorySummary)
      .slice(0, 7)
      .map((chapter) => `${chapter.chapterNum || chapter.chapter_num || ''}${chapter.title ? `.${chapter.title}` : ''} ${chapter.summary || ''}`.trim())
      .filter(Boolean)
      .join('；');
    const endingLabel = inheritedEndingDisplayLabel(record, requirement);
    const bridge = [
      `前作《${stripBookTitle(record.storyTitle || requirement?.sourceTitle || '前作')}》留下的命运并没有停在终章。${endingLabel}已经成为这段续作开始前无法抹去的事实。`,
      branchNames.length ? `那些曾经被拨动的支线仍在暗处延伸，尤其是${branchNames.join('、')}，它们让人物的选择、伤痕与牵挂都带着前作的余温。` : '',
      branchDetails.length ? `必须被记住的支线余波包括：${branchDetails.join('；')}。` : '',
      bridgeSummary ? `这条命运线通向续作时，最重要的接续脉络是：${bridgeSummary.slice(0, 220)}。` : '',
      previousArc ? `前作一路走来的轮廓仍然压在此刻之后：${previousArc.slice(0, 720)}。` : '',
      record.storyConclusion ? `终章之后的余波仍在发酵：${String(record.storyConclusion).slice(0, 520)}。` : '',
      statusLines ? `众人的状态也因此改变：${statusLines}。` : '',
      repairRules.length ? `而这段续作必须遵守的继承硬设定是：${repairRules.join('；')}。` : '',
      requirement?.continuityTitle ? `于是，续作从「${requirement.continuityTitle}」这个接续锚点重新启程。` : '于是，续作从这条已经被玩家走出的命运线重新启程。',
    ].filter(Boolean).join('\n');
    return {
      ...chapter,
      text: `${bridge}\n\n${String(chapter?.text || '')}`.trim(),
      summary: `${String(chapter?.summary || '').trim()} ${record.storyConclusion ? `继承前作余波：${String(record.storyConclusion).slice(0, 120)}` : ''}`.trim(),
    };
  };

  const startSequelWithInheritedRecord = async (storyId: string, cartridge: any, progressData: any, record: FateCompletionRecord, requirement: any) => {
    try {
      const baseBlueprint = buildBlueprintFromCartridge(cartridge);
      const originalChapterOne = asSafeArray<any>(baseBlueprint.chapters).find((chapter) => Number(chapter.chapter_num) === 1) || baseBlueprint.chapters?.[0] || {};
      const originalOpeningSize = appLanguage === 'en-US'
        ? String(originalChapterOne?.text || '').trim().split(/\s+/).filter(Boolean).length
        : String(originalChapterOne?.text || '').replace(/\s+/g, '').length;
      const inheritedOpeningTargetWordCount = Math.min(1600, Math.max(1000, targetWordCount, Math.round(originalOpeningSize * 0.9)));
      let inheritedChapterOne = buildInheritedFirstChapterText(originalChapterOne, record, requirement);
      try {
        setStoryLaunchOverlay({ progress: 88, status: isEnglish ? 'Binding fate lines...' : '正在衔接命运...' });
        const response = await apiFetch('/api/ai?action=generate-inherited-opening', {
          method: 'POST',
          body: JSON.stringify({
            blueprint: baseBlueprint,
            originalChapter: originalChapterOne,
            fateRecord: {
              ...record,
              selectedEndingTitle: inheritedEndingDisplayLabel(record, requirement),
            },
            requirement,
            targetWordCount: inheritedOpeningTargetWordCount,
            language: appLanguage,
          }),
        }, 55000);
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const rewritten = await response.json();
        inheritedChapterOne = {
          ...originalChapterOne,
          ...rewritten,
          chapter_num: 1,
          text: rewritten.text || inheritedChapterOne.text,
          summary: rewritten.summary || inheritedChapterOne.summary,
          present_characters: Array.isArray(rewritten.present_characters) ? rewritten.present_characters : originalChapterOne.present_characters || [],
        };
      } catch (error) {
        console.warn('[inherited-opening:rewrite-fallback]', error);
        showError('继承开场生成暂时失败，已使用本机接续文本进入续作。');
      }
      const inheritedChapters = asSafeArray<any>(baseBlueprint.chapters).map((chapter) =>
        Number(chapter.chapter_num) === 1 ? inheritedChapterOne : chapter
      );
      const inheritedProgress = {
        ...(progressData || {}),
        interventionsLeft: 3,
        currentChapters: inheritedChapters,
        naturalChapters: inheritedChapters,
        initialNaturalChapters: inheritedChapters,
        inheritedFromStoryId: record.sourceStoryId,
        inheritedRunId: record.runId,
        inheritedEndingId: record.selectedEndingId,
        inheritedBranchIds: record.unlockedBranchIds,
        inheritedFateRecord: record,
        inheritancePatchApplied: true,
      };
      setStoryLaunchOverlay({ progress: 96, status: isEnglish ? 'Opening the sequel...' : '命运已衔接，正在入场...' });
      await saveUserProgress(db as any, user!.uid, storyId, inheritedProgress).catch((error) => {
        console.warn('[progress:save-inherited-sequel]', error);
      });
      applyStoryCartridgeForPlay(storyId, cartridge, inheritedProgress);
      showError('已继承前作命运线，续作开场已按该记录调整。');
    } catch (error) {
      console.error('[inherited-sequel:start]', error);
      showError('续作继承失败，请稍后重试。');
    } finally {
      window.setTimeout(() => setStoryLaunchOverlay(null), 180);
    }
  };

  const resumeStoryPlay = async (storyId: string, progressData: any) => {
    if (!user || !db) return;
    try {
      setPendingProgressToLoad(null);
      setStoryLaunchOverlay({ progress: 16, status: isEnglish ? 'Restoring fate line...' : '正在继承命运线...' });
      const cartridge = progressData.cartridge || await getCachedStoryCartridge(storyId) || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      await cacheStoryCartridge(storyId, cartridge);
      applyStoryCartridgeForPlay(storyId, cartridge, progressData);
    } catch (e) {
      console.error(e);
      showError("恢复故事进度失败");
    } finally {
      window.setTimeout(() => setStoryLaunchOverlay(null), 180);
    }
  };

  const startFreshFromPendingProgress = async () => {
    const pendingProgress = pendingProgressToLoad;
    if (!pendingProgress) return;
    setPendingProgressToLoad(null);
    setStoryLaunchOverlay({ progress: 12, status: isEnglish ? 'Preparing a new fate line...' : '正在准备新的命运线...' });
    setIsLoadingStories(true);
    try {
      const cartridge = pendingProgress.data?.cartridge;
      if (cartridge) {
        setStoryLaunchOverlay({ progress: 36, status: isEnglish ? 'Checking sequel requirements...' : '正在检查续作前置条件...' });
        const sequelGate = await evaluateSequelGate({ ...cartridge, meta: { ...(cartridge.meta || {}), id: pendingProgress.id } });
        if (!sequelGate.allowed) {
          setSequelGateModal(sequelGate.modal);
          return;
        }
        if ('eligibleRecords' in sequelGate && Array.isArray(sequelGate.eligibleRecords) && sequelGate.eligibleRecords.length > 0) {
          setPendingSequelInheritance({
            storyId: pendingProgress.id,
            cartridge,
            progressData: pendingProgress.data,
            requirement: (sequelGate as any).requirement,
            records: sequelGate.eligibleRecords as FateCompletionRecord[],
          });
          return;
        }
      }
      setStoryLaunchOverlay({ progress: 82, status: isEnglish ? 'Entering story...' : '正在进入故事...' });
      await startNewStoryPlay(pendingProgress.id, pendingProgress.data?.cartridge, pendingProgress.data);
    } catch (error) {
      console.error('[pending-progress:start-fresh]', error);
      showError(isEnglish ? 'Unable to start a new fate line.' : '无法开始新的命运线。');
    } finally {
      setIsLoadingStories(false);
      window.setTimeout(() => setStoryLaunchOverlay(null), 180);
    }
  };

  const handleRandomQuickGeneration = () => {
    const randomAnswers = createRandomQuickQuizAnswers();
    const randomInput = buildQuickGenerationInputFromQuiz(randomAnswers, quickCharacterSeed);
    setQuickGenerationMode('quiz');
    setQuickQuizAnswers(randomAnswers);
    setQuickQuizStepIndex(0);
    void handleGenerateBlueprint(
      randomInput,
      quickGenerationSignature({ mode: 'quiz', answers: randomAnswers, characterSeed: quickCharacterSeed, input: randomInput })
    );
  };

  const selectedSeriesWorld = seriesWorlds.find((series) => series.id === selectedSeriesId) || null;
  const selectedContinuityNode = continuityNodes.find((node) => node.id === selectedContinuityNodeId) || null;

  const loadSeriesWorlds = async () => {
    if (!db || !user) return;
    try {
      const rows = await listMySeriesWorlds(db as any, 50);
      setSeriesWorlds(rows);
      if (!selectedSeriesId && rows[0]?.id) setSelectedSeriesId(rows[0].id);
      return rows;
    } catch (error) {
      console.error(error);
      showError(tr('世界观设定同步失败。', 'Failed to sync world settings.'));
    }
  };

  const loadContinuityNodesForSeries = async (seriesId: string) => {
    if (!db || !seriesId) return;
    try {
      const rows = await listContinuityNodes(db as any, seriesId, 50);
      setContinuityNodes(rows);
      if (!selectedContinuityNodeId && rows[0]?.id) setSelectedContinuityNodeId(rows[0].id);
    } catch (error) {
      console.error(error);
      setContinuityNodes([]);
    }
  };

  const openSeriesWorldView = async () => {
    navigateTo('SERIES_WORLD_LIST');
    await refreshStories({ force: true });
    await loadSeriesWorlds();
  };

  const openSeriesWorldCreateView = async () => {
    setSelectedSeriesId('');
    setSeriesForm({
      title: '',
      pitch: '',
      genreTags: [],
      worldBible: {},
      timelineNotes: '',
      ironLaws: [],
      futureDirections: [],
      visibility: 'private',
    });
    setSeriesWorldBibleText('{}');
    setSeriesIronLawsText('[]');
    setSeriesFutureDirectionsText('[]');
    setSeriesSourceStoryId('');
    setSelectedContinuityNodeId('');
    setContinuityNodes([]);
    navigateTo('SERIES_WORLD_GENERATE');
    await refreshStories({ force: true });
    await loadSeriesWorlds();
  };

  const handleGenerateSeriesWorld = async (mode: 'new' | 'extract') => {
    if (!user || !db) return;
    setSeriesGenerating(true);
    try {
      let sourceStory: any = null;
      if (mode === 'extract' && seriesSourceStoryId) {
        sourceStory = await getStoryCartridge(db as any, seriesSourceStoryId);
        const data = buildSeriesWorldDraftFromSourceStory(sourceStory);
        setSeriesForm(data);
        setSeriesWorldBibleText(JSON.stringify(data.worldBible || {}, null, 2));
        setSeriesIronLawsText('[]');
        setSeriesFutureDirectionsText('[]');
        setSelectedSeriesId('');
        navigateTo('SERIES_WORLD_EDIT');
        showError(tr('已从作品提取世界观概况、角色卡池、支线与结局素材。', 'Extracted overview, characters, branches, and endings from the story.'));
        return;
      }
      const response = await apiFetch('/api/ai?action=generate-series-world', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          genreTags: normalizeTagList(String(seriesForm.genreTags?.join?.('，') || '').split(/[,，]/).filter(Boolean)),
          authorSeed: `${seriesForm.title || ''}\n${(parseEditableJson<Record<string, any>>(seriesWorldBibleText, seriesForm.worldBible || {}).worldview || '')}`,
          sourceStory,
          language: appLanguage,
        }),
      }, 90000);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = await response.json();
      setSeriesForm({
        ...data,
        visibility: 'private',
      });
      setSeriesWorldBibleText(JSON.stringify(data.worldBible || {}, null, 2));
      setSeriesIronLawsText(JSON.stringify(data.ironLaws || [], null, 2));
      setSeriesFutureDirectionsText(JSON.stringify(data.futureDirections || [], null, 2));
      setSelectedSeriesId('');
      navigateTo('SERIES_WORLD_EDIT');
      showError(tr('世界观设定草稿已生成，可先编辑再保存。', 'World setting draft generated. Edit it before saving.'));
    } catch (error) {
      console.error(error);
      showError(`${tr('生成世界观设定失败', 'Failed to generate world setting')}: ${error instanceof Error ? error.message : tr('请稍后再试', 'please try again later')}`);
    } finally {
      setSeriesGenerating(false);
    }
  };

  const handleSaveSeriesWorld = async () => {
    if (!db || !user) return;
    setSeriesSaving(true);
    try {
      const parsedWorldBible = parseEditableJson(seriesWorldBibleText, seriesForm.worldBible || {});
      const id = await saveSeriesWorld(db as any, {
        ...seriesForm,
        id: selectedSeriesId || seriesForm.id,
        pitch: parsedWorldBible.worldview || seriesForm.pitch || '',
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        worldBible: parsedWorldBible,
        ironLaws: parseEditableJson(seriesIronLawsText, seriesForm.ironLaws || []),
        futureDirections: parseEditableJson(seriesFutureDirectionsText, seriesForm.futureDirections || []),
      });
      await loadSeriesWorlds();
      setSelectedSeriesId(id);
      showError(tr('世界观设定已保存。', 'World setting saved.'));
    } catch (error) {
      console.error(error);
      showError(tr('保存世界观设定失败。', 'Failed to save world setting.'));
    } finally {
      setSeriesSaving(false);
    }
  };

  const resetSeriesWorldDraft = () => {
    setSelectedSeriesId('');
    setSeriesForm({
      title: '',
      pitch: '',
      genreTags: [],
      worldBible: {},
      timelineNotes: '',
      ironLaws: [],
      futureDirections: [],
      visibility: 'private',
    });
    setSeriesWorldBibleText('{}');
    setSeriesIronLawsText('[]');
    setSeriesFutureDirectionsText('[]');
    setSelectedContinuityNodeId('');
    setContinuityNodes([]);
    navigateTo('SERIES_WORLD_EDIT');
  };

  const handleDeleteSeriesWorld = (seriesId = selectedSeriesId) => {
    if (!db || !seriesId) return;
    const target = seriesWorlds.find((series) => series.id === seriesId) || selectedSeriesWorld || seriesForm;
    setConfirmationModal({
      isOpen: true,
      title: tr('删除世界观设定', 'Delete world setting'),
      message: tr(
        `确认删除「${target?.title || '未命名世界观设定'}」吗？已套用到作品的旧记录不会自动删除，但这个世界观仓库和它的继承节点将无法继续被选择。`,
        `Delete "${target?.title || 'Untitled world setting'}"? Existing works that already applied it will remain, but this setting archive and its continuity nodes will no longer be selectable.`
      ),
      onConfirm: async () => {
        setSeriesSaving(true);
        try {
          await deleteSeriesWorld(db as any, seriesId);
          await loadSeriesWorlds();
          resetSeriesWorldDraft();
          navigateTo('SERIES_WORLD_LIST');
          showError(tr('世界观设定已删除。', 'World setting deleted.'));
        } catch (error) {
          console.error(error);
          showError(tr('删除世界观设定失败。', 'Failed to delete world setting.'));
        } finally {
          setSeriesSaving(false);
        }
      },
    });
  };

  const handleGenerateContinuityNode = async () => {
    if (!db || !selectedSeriesWorld || !seriesSourceStoryId) {
      showError(tr('请先选择世界观设定和来源作品。', 'Choose a world setting and a source story first.'));
      return;
    }
    setSeriesGenerating(true);
    try {
      const sourceStory = await getStoryCartridge(db as any, seriesSourceStoryId);
      const response = await apiFetch('/api/ai?action=generate-continuity-node', {
        method: 'POST',
        body: JSON.stringify({
          seriesWorld: selectedSeriesWorld,
          sourceStory,
          endingDomain: continuityForm.endingDomain || 'middle',
          endingId: continuityForm.endingId || 'default',
          requiredBranchIds: continuityForm.requiredBranchIds || [],
          language: appLanguage,
        }),
      }, 90000);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = await response.json();
      setContinuityForm({
        ...data,
        seriesId: selectedSeriesWorld.id,
        sourceStoryId: seriesSourceStoryId,
        visibility: 'private',
      });
      setContinuityLegacyText(JSON.stringify(data.legacyState || {}, null, 2));
      setContinuityRepairText(JSON.stringify(data.repairRules || [], null, 2));
      showError(tr('接续节点草稿已生成，可编辑后保存。', 'Continuity node draft generated. Edit it before saving.'));
    } catch (error) {
      console.error(error);
      showError(`${tr('生成接续节点失败', 'Failed to generate continuity node')}: ${error instanceof Error ? error.message : tr('请稍后再试', 'please try again later')}`);
    } finally {
      setSeriesGenerating(false);
    }
  };

  const handleSaveContinuityNode = async () => {
    if (!db || !selectedSeriesWorld) return;
    setSeriesSaving(true);
    try {
      const id = await saveContinuityNode(db as any, {
        ...continuityForm,
        id: continuityForm.id,
        seriesId: selectedSeriesWorld.id,
        sourceStoryId: continuityForm.sourceStoryId || seriesSourceStoryId || null,
        legacyState: parseEditableJson(continuityLegacyText, continuityForm.legacyState || {}),
        repairRules: parseEditableJson(continuityRepairText, continuityForm.repairRules || []),
      });
      await loadContinuityNodesForSeries(selectedSeriesWorld.id);
      setSelectedContinuityNodeId(id);
      showError(tr('接续节点已保存。', 'Continuity node saved.'));
    } catch (error) {
      console.error(error);
      showError(tr('保存接续节点失败。', 'Failed to save continuity node.'));
    } finally {
      setSeriesSaving(false);
    }
  };

  const generateStoryFromSeries = (role: 'main' | 'sequel') => {
    if (!selectedSeriesWorld) {
      showError(tr('请先选择或保存一个世界观设定。', 'Choose or save a world setting first.'));
      return;
    }
    const continuity = role === 'sequel' ? selectedContinuityNode : null;
    if (role === 'sequel' && !continuity) {
      showError(tr('请先选择或保存一个接续节点。', 'Choose or save a continuity node first.'));
      return;
    }
    const outline = role === 'sequel'
      ? (isEnglish
        ? `Generate a sequel based on the world setting "${selectedSeriesWorld.title}" and continuity node "${continuity?.title}". ${continuity?.sequelSeedPrompt || continuity?.bridgeSummary || ''}`
        : `请基于世界观设定《${selectedSeriesWorld.title}》和接续节点「${continuity?.title}」生成续作。${continuity?.sequelSeedPrompt || continuity?.bridgeSummary || ''}`)
      : (isEnglish
        ? `Generate the first installment based on the world setting "${selectedSeriesWorld.title}". ${selectedSeriesWorld.pitch || ''}`
        : `请基于世界观设定《${selectedSeriesWorld.title}》生成第一部作品。${selectedSeriesWorld.pitch || ''}`);
    const input: QuickGenerationInput = {
      selectedThemes: normalizeTagList(selectedSeriesWorld.genreTags || []).slice(0, 4),
      customOutline: outline,
      targetWordCount,
      narrativePerson,
      endingMode: quickEndingMode,
      endingBias: quickEndingBias,
      seriesContext: buildAppliedSeriesContext(selectedSeriesWorld, {
        baselineRuleIds: getSeriesBaselineRules(selectedSeriesWorld).map((rule) => rule.id),
        characterIds: getSeriesCharacterCards(selectedSeriesWorld).map((card) => card.id),
        useContinuity: role === 'sequel',
        sourceStoryId: seriesSourceStoryId,
        continuityNodeId: continuity?.id || '',
        requiredBranchIds: continuity?.requiredBranchIds || [],
        endingId: continuity?.endingId || '',
        hardSettings: continuity?.sequelSeedPrompt || '',
      }, continuity),
      continuityNode: continuity,
      seriesSelection: {
        baselineRuleIds: getSeriesBaselineRules(selectedSeriesWorld).map((rule) => rule.id),
        characterIds: getSeriesCharacterCards(selectedSeriesWorld).map((card) => card.id),
        useContinuity: role === 'sequel',
        sourceStoryId: seriesSourceStoryId,
        continuityNodeId: continuity?.id || '',
        requiredBranchIds: continuity?.requiredBranchIds || [],
        endingId: continuity?.endingId || '',
        hardSettings: continuity?.sequelSeedPrompt || '',
      },
    };
    void handleGenerateBlueprint(input, quickGenerationSignature({ input }));
  };

  const handleGenerateBlueprint = async (overrideInput?: QuickGenerationInput, overrideSignature?: string) => {
    if (!user || !db) return;
    let generationStage = appLanguage === 'en-US' ? 'preparing generation' : '准备生成';
    let activeGenerationInput: QuickGenerationInput | null = null;
    const hasOverrideInput = Boolean(
      overrideInput &&
      typeof overrideInput === 'object' &&
      Array.isArray((overrideInput as any).selectedThemes) &&
      'customOutline' in (overrideInput as any)
    );
    try {
      activeGenerationInput = hasOverrideInput ? overrideInput as QuickGenerationInput : getActiveQuickGenerationInput();
      const safeSelectedThemes = asSafeArray<string>(activeGenerationInput.selectedThemes);
      const safeOutline = String(activeGenerationInput.customOutline || '');
      activeGenerationInput = {
        ...activeGenerationInput,
        selectedThemes: safeSelectedThemes,
        customOutline: safeOutline,
      };
      const missingQuizStep = !hasOverrideInput && quickGenerationMode === 'quiz' ? getIncompleteQuickQuizStep() : null;
      if (missingQuizStep) {
        setQuickQuizStepIndex(Math.max(0, QUICK_QUIZ_STEPS.findIndex((step) => step.id === missingQuizStep.id)));
        showError(appLanguage === 'en-US' ? `Please complete: ${quickText(missingQuizStep.title)}` : `请先完成：${quickText(missingQuizStep.title)}`);
        return;
      }
      const hasSeriesContext = Boolean(activeGenerationInput.seriesContext);
      if (safeSelectedThemes.length < 1 && !safeOutline.trim() && !hasSeriesContext) {
        showError(appLanguage === 'en-US' ? 'Please choose at least one preference or enter a story outline.' : '请至少选择一个偏好或输入故事大纲。');
        return;
      }
      if (safeSelectedThemes.length > 4) {
        showError(appLanguage === 'en-US' ? 'Choose up to 4 story tags.' : '最多选择 4 个主题。');
        return;
      }
      if (quickGenerationMode === 'quiz' || hasOverrideInput) {
        setSelectedThemes(safeSelectedThemes);
        setCustomOutline(safeOutline);
        setTargetWordCount(activeGenerationInput.targetWordCount);
        setNarrativePerson(activeGenerationInput.narrativePerson);
        setQuickEndingMode(activeGenerationInput.endingMode);
        setQuickEndingBias(activeGenerationInput.endingBias);
      }
      if (!hasOverrideInput && quickGenerationMode === 'advanced' && selectedThemes.length < 1 && !customOutline.trim() && !quickSeriesBindingId) {
        showError(appLanguage === 'en-US' ? 'Please choose a theme, outline, or world setting.' : '请至少选择一个主题、故事大纲或世界观设定。');
        return;
      }
      if (!hasOverrideInput && quickGenerationMode === 'advanced' && selectedThemes.length > 4) {
        showError('最多选择 4 个主题。');
        return;
      }
    } catch (error) {
      console.error('quick generation input failed:', error);
      showError(appLanguage === 'en-US'
        ? 'The story preferences were not loaded correctly. Please reselect the quiz options and try again.'
        : '故事偏好没有完整载入，请重新选择问卷选项后再生成。');
      return;
    }
    if (!activeGenerationInput) return;
    if (activeGenerationInput.seriesSelection?.useContinuity && !activeGenerationInput.continuityNode) {
      showError(appLanguage === 'en-US'
        ? 'Please choose a previous story and required ending before generating a sequel.'
        : '生成续作前，请先选择前作和前置结局。');
      return;
    }

    navigateTo('GENERATING_BLUEPRINT');
    const progressInterval = startProgressSimulation(45000, isEnglish
      ? [
          'Shaping the world...',
          'Weaving the threads of fate...',
          'Designing key characters...',
          'Laying out the chapters...',
          'Refining narrative details...',
          'Adding emotion and momentum...',
          'The story is almost ready...',
        ]
      : [
          '正在构思宏大世界观...',
          '正在编织命运的丝线...',
          '正在塑造传奇英雄...',
          '正在铺设史诗篇章...',
          '正在雕琢文学细节...',
          '正在注入灵魂与情感...',
          '即将开启新的征程...',
        ]);

    try {
      const draftSignature = hasOverrideInput && overrideSignature ? overrideSignature : quickGenerationSignature();
      quickGenerationDraftSignatureRef.current = draftSignature;
      const cachedDraft = await getLocalCache<any>(quickGenerationDraftCacheKey());
      let data = cachedDraft?.value?.signature === draftSignature && cachedDraft.value?.blueprint
        ? cachedDraft.value.blueprint
        : null;
      if (!data) {
        generationStage = appLanguage === 'en-US' ? 'generating the story blueprint' : '生成故事蓝图';
        const response = await apiFetch('/api/ai?action=generate-blueprint', {
          method: 'POST',
          body: JSON.stringify({ ...activeGenerationInput, language: appLanguage }),
        }, 90000);
        if (!response.ok) throw new Error(await readErrorMessage(response));
        data = await response.json();
      }
      data.narrative_person = activeGenerationInput.narrativePerson;
      data.language = appLanguage;
      data.endingMode = data.endingMode === 'single' ? 'single' : activeGenerationInput.endingMode;
      data.endingBias = normalizeEndingBias(data.endingBias || activeGenerationInput.endingBias || { left: data.left_mainline_default, right: data.right_mainline_default });
      data.tags = normalizeTagList(data.tags || activeGenerationInput.selectedThemes);
      data.seriesContext = activeGenerationInput.seriesContext || data.seriesContext || null;
      data.continuityNode = activeGenerationInput.continuityNode || data.continuityNode || null;
      data.seriesSelection = activeGenerationInput.seriesSelection || data.seriesSelection || null;
      data.chapters = ensureSevenChapterShells(data.chapters || []);
      await setLocalCache(quickGenerationDraftCacheKey(), { signature: draftSignature, blueprint: data });

      const prefetchChapters = [1, 2, 3];
      for (const chapterNum of prefetchChapters) {
        if (isChapterTextReady((data.chapters || []).find((chapter: any) => chapter.chapter_num === chapterNum))) {
          continue;
        }
        generationStage = appLanguage === 'en-US' ? `generating chapter ${chapterNum}` : `生成第 ${chapterNum} 章`;
        setGenerationStatus(isEnglish ? `Writing chapter ${chapterNum} (${chapterNum}/3)...` : `正在具象化世界细节 (${chapterNum}/3)...`);
        setGenerationProgress(72 + chapterNum * 7);
        const chapterResponse = await withRetry(() => apiFetch('/api/ai?action=generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint: data,
            currentChapters: data.chapters,
            targetChapterNum: chapterNum,
            targetWordCount: activeGenerationInput.targetWordCount,
            narrativePerson: activeGenerationInput.narrativePerson,
            language: appLanguage,
          }),
        }, 90000), 3, 2500);
        if (!chapterResponse.ok) throw new Error(await readErrorMessage(chapterResponse));
        const chapterData = await chapterResponse.json();
        data.chapters = (data.chapters || []).map((chapter: any) => (
          chapter.chapter_num === chapterNum ? { ...chapter, text: chapterData.text || '' } : chapter
        ));
        await setLocalCache(quickGenerationDraftCacheKey(), { signature: draftSignature, blueprint: data });
      }

      data.branches = (data.branches || []).map((branch: any) => ({
        ...branch,
        id: branch.id || `b_${Math.random().toString(36).slice(2, 11)}`,
        sceneText: branch.sceneText || branch.desc || '',
        trigger: branch.trigger || {
          type: 'single',
          single: {
            chapterNum: branch.condition_chapter || 2,
            charId: branch.condition_char || data.characters?.[0]?.id || 'c1',
            action: branch.condition_action === 'curse' ? 'curse' : 'bless',
          },
        },
      }));

      const initialStatuses: Record<string, { status: string; isDead: boolean }> = {};
      (data.characters || []).forEach((character: any) => {
        initialStatuses[character.id] = { status: '存活', isDead: false };
      });

      setBlueprint(data);
      setChapters(data.chapters || []);
      setChangeHighlights({});
      setNaturalChapters(data.chapters || []);
      setInitialNaturalChapters((data.chapters || []).map((chapter: any) => ({
        ...chapter,
        present_characters: Array.isArray(chapter.present_characters) ? [...chapter.present_characters] : [],
        title: chapter.title || '',
        summary: chapter.summary || '',
        text: chapter.text || '',
      })));
      setCharacterStatuses(initialStatuses);
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setIntervenedChapters([]);
      setInterventionHistory([]);
      setActiveStoryId(null);
      setActiveStoryMeta(null);
      setSelectedThemes(activeGenerationInput.selectedThemes);
      setCustomOutline(activeGenerationInput.customOutline);
      setTargetWordCount(activeGenerationInput.targetWordCount);
      setNarrativePerson(activeGenerationInput.narrativePerson);
      setQuickEndingMode(activeGenerationInput.endingMode);
      setQuickEndingBias(activeGenerationInput.endingBias);
      navigateTo('PLAYING', { replace: true });
      scrollToTopAfterViewChange();
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error && error.message
        ? error.message
        : (appLanguage === 'en-US' ? 'Please check the network or try again later.' : '请检查网络或稍后重试。');
      showError(appLanguage === 'en-US'
        ? `Generation failed while ${generationStage}: ${detail}`
        : `${generationStage}时失败：${detail}`);
      goBack('THEME_SELECTION');
    } finally {
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  useEffect(() => {
    if (
      gameState !== 'PLAYING' ||
      !blueprint ||
      isRewriting ||
      activeInterventionOverlay ||
      !user ||
      !db
    ) {
      return;
    }

    const missingChapter = chapters
      .filter((chapter) => Number(chapter.chapter_num) > 1)
      .sort((a, b) => Number(a.chapter_num) - Number(b.chapter_num))
      .find((chapter) => !isChapterTextReady(chapter));

    if (!missingChapter) {
      setBackgroundGeneratingChapter(null);
      if (!activeStoryId && quickGenerationDraftSignatureRef.current) {
        quickGenerationDraftSignatureRef.current = null;
        deleteLocalCache(quickGenerationDraftCacheKey()).catch(() => {});
      }
      return;
    }
    if (fetchingChapterRef.current === missingChapter.chapter_num) return;

    fetchingChapterRef.current = missingChapter.chapter_num;
    setBackgroundGeneratingChapter(missingChapter.chapter_num);

    const generateRemainingChapter = async () => {
      try {
        const chapterResponse = await withRetry(() => apiFetch('/api/ai?action=generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint,
            currentChapters: chapters,
            targetChapterNum: missingChapter.chapter_num,
            targetWordCount: Number((missingChapter as any).word_target) || targetWordCount,
            narrativePerson: blueprint.narrative_person || narrativePerson,
            language: appLanguage,
          }),
        }, 90000), 3, 2500);
        if (!chapterResponse.ok) throw new Error(await readErrorMessage(chapterResponse));
        const chapterData = await chapterResponse.json();
        if (!chapterData?.text || typeof chapterData.text !== 'string' || chapterData.text.trim().length < 50) {
          throw new Error('Invalid generated chapter text');
        }

        setChapters((prev) => {
          const shouldUpdateQuickDraft = interventionsLeft >= 3;
          const nextChapters = ensureSevenChapterShells(prev).map((chapter) => (
            chapter.chapter_num === missingChapter.chapter_num
              ? {
                  ...chapter,
                  title: chapterData.title || chapter.title,
                  summary: chapterData.summary || chapter.summary,
                  present_characters: Array.isArray(chapterData.present_characters) ? chapterData.present_characters : chapter.present_characters,
                  text: stripGeneratedMarkup(chapterData.text),
                  word_target: undefined,
                }
              : chapter
          ));
          setNaturalChapters(nextChapters as any);
          if (shouldUpdateQuickDraft) {
            setInitialNaturalChapters(nextChapters.map((chapter: any) => ({
              ...chapter,
              present_characters: Array.isArray(chapter.present_characters) ? [...chapter.present_characters] : [],
            })) as any);
            setLocalCache(quickGenerationDraftCacheKey(), {
              signature: quickGenerationDraftSignatureRef.current || quickGenerationSignature(),
              blueprint: { ...blueprint, chapters: nextChapters },
            }).catch(() => {});
          }
          return nextChapters as any;
        });
      } catch (error) {
        console.warn('Background generation failed for chapter', missingChapter.chapter_num, error);
      } finally {
        fetchingChapterRef.current = null;
        setBackgroundGeneratingChapter(null);
      }
    };

    void generateRemainingChapter();
  }, [gameState, blueprint, chapters, interventionsLeft, isRewriting, activeInterventionOverlay, user, db, targetWordCount, narrativePerson, appLanguage]);

  const enterAuthoring = async () => {
    navigateTo('AUTHORING');
    setAuthoringStoryId(null);
    setAuthoringCartridge(null);
    setAuthoringTab('settings');
    await refreshStories({ force: true });
    await loadSeriesWorlds();
  };

  const selectAuthoringStory = async (storyId: string, options?: { keepTab?: boolean; keepBranchSelection?: boolean }) => {
    if (!db) return;
    const cartridge = await getStoryCartridge(db as any, storyId);
    if (!cartridge) {
      showError('无法载入该作品。');
      return;
    }
    const cartridgeSeriesId = String(cartridge.meta?.seriesId || '');
    if (cartridgeSeriesId) {
      if (!seriesWorlds.some((series) => series.id === cartridgeSeriesId)) {
        await loadSeriesWorlds();
      }
      setSelectedSeriesId(cartridgeSeriesId);
      if (cartridge.meta?.seriesRole === 'sequel' && cartridge.meta?.continuityNodeId) {
        void loadContinuityNodesForSeries(cartridgeSeriesId);
      }
    }
    setAuthoringStoryId(storyId);
    setAuthoringCartridge(cartridge);
    setAuthoringCustomTagsInput((cartridge.meta?.tags || []).join('，'));
    setAuthoringImportText('');
    if (!options?.keepBranchSelection) {
      setSelectedBranchId(null);
      setExpandedBranchId(null);
    }
    if (!options?.keepTab) {
      setAuthoringTab('settings');
    }
    markAuthoringSaved(cartridge);
  };

  const handleCreateAuthoringStory = async (confirmed = false) => {
    if (!db || !user) return;
    if (authoringDirty && !confirmed) {
      setConfirmationModal({
        isOpen: true,
        title: 'Discard unsaved changes',
        message: 'Create a new story and discard current unsaved changes?',
        onConfirm: () => {
          void handleCreateAuthoringStory(true);
        },
      });
      return;
    }
    try {
      setAuthoringSaving(true);
      const storyId = await createEmptyStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: '未命名作品',
        tags: [],
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      showError('新作品已创建。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '新建作品失败。');
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleDeleteAuthoringStory = async (confirmed = false) => {
    if (!db || !authoringStoryId) return;
    if (!confirmed) {
      setConfirmationModal({
        isOpen: true,
        title: 'Delete story',
        message: 'This story will be permanently deleted. This action cannot be undone.',
        onConfirm: () => { void handleDeleteAuthoringStory(true); },
      });
      return;
    }
    try {
      setAuthoringSaving(true);
      await deleteStoryCartridge(db as any, authoringStoryId);
      setAuthoringStoryId(null);
      setAuthoringCartridge(null);
      setSelectedBranchId(null);
      setExpandedBranchId(null);
      setAuthoringSavedSnapshot('');
      setAuthoringDirty(false);
      await refreshStories({ force: true });
      showError('作品已删除。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '删除作品失败。');
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleSaveSelectedBranch = async () => {
    if (!authoringStoryId || !selectedBranchId) {
      showError('请先选择需要保存的支线。');
      return;
    }
    try {
      setAuthoringSaving(true);
      setGlobalLoadingMessage(isEnglish ? 'Saving branch...' : '正在保存支线...');
      setGlobalLoadingDetail(isEnglish ? 'Syncing characters, conditions, hidden settings, and branch story content.' : '正在同步角色、条件、隐藏设置和支线情节。');
      await upsertStoryBranch(db as any, authoringStoryId, selectedBranchId, {
        id: selectedBranchId,
        side: branchForm.side,
        tier: normalizeBranchTier(branchForm.tier),
        is_hidden: branchForm.isHidden,
        endingId: branchForm.endingId || undefined,
        name: branchForm.name || '未命名支线',
        desc: branchForm.sceneText.slice(0, 80) || branchForm.name || '支线',
        common: false,
        hint: '',
        trigger: normalizeBranchConditionsForStorage(branchConditions)[0],
        triggerGroups: normalizeBranchConditionsForStorage(branchConditions),
        inject: {
          mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [],
          mustReveal: [],
          mustChange: [],
          hidden: branchForm.isHidden,
          endingId: branchForm.endingId || undefined,
        },
        sceneText: branchForm.sceneText,
      } as any);
      const latest = await getStoryCartridge(db as any, authoringStoryId);
      setAuthoringCartridge(latest);
      markAuthoringSaved(latest);
      setAuthoringSaveSuccessStory(latest);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '保存支线失败。');
    } finally {
      setAuthoringSaving(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleSaveAuthoringMainline = async () => {
    if (!authoringStoryId || !authoringCartridge || !db) return;
    try {
      setAuthoringSaving(true);
      setGlobalLoadingMessage(isEnglish ? 'Saving story changes...' : '正在保存作品更改...');
      setGlobalLoadingDetail(isEnglish ? 'Syncing story settings, chapters, endings, and story card data.' : '正在同步作品设置、章节、结局与作品卡资料。');
      const normalizedCharacters = normalizeCharacters(authoringCartridge.meta?.characters || []);
      const normalizedTags = parseTagInput(authoringCustomTagsInput || (authoringCartridge.meta?.tags || []).join('，'));
      const normalizedChapters = (authoringCartridge.chapters || []).map((chapter: any) => ({
        chapter_num: chapter.chapter_num,
        title: chapter.title || `第${chapter.chapter_num}章`,
        summary: chapter.summary || '',
        present_characters: Array.isArray(chapter.present_characters) && chapter.present_characters.length > 0
          ? chapter.present_characters
          : normalizedCharacters.map((character: any) => character.id),
        text: chapter.text || '',
      }));
      await saveStoryMainlineBundle(db as any, authoringStoryId, {
        metaPatch: {
          ...authoringCartridge.meta,
          title: stripBookTitle(authoringCartridge.meta?.title || ''),
          tags: normalizedTags,
          characters: normalizedCharacters,
          averageChapterWords: getAverageChapterWords(normalizedChapters),
          chapterCount: getReadyChapterCount(normalizedChapters),
          cardExcerpt: getStoryCardExcerpt(authoringCartridge.meta?.main_axis, normalizedChapters),
        } as any,
        chapters: normalizedChapters,
        endings: (authoringCartridge.endings || [])
          .filter((ending: any) => authoringCartridge.meta?.endingMode === 'single' ? endingDomainFromId(String(ending.id || '')) === 'middle' : true)
          .map((ending: any) => ({
            id: ending.id,
            title: ending.title || endingIdToLabel(ending.id),
            text: ending.text || '',
          })),
      });
      const latest = await getStoryCartridge(db as any, authoringStoryId);
      setAuthoringCartridge(latest);
      setAuthoringCustomTagsInput(normalizedTags.join('，'));
      markAuthoringSaved(latest);
      await refreshStories({ force: true });
      setAuthoringSaveSuccessStory(latest);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '保存作品失败。');
    } finally {
      setAuthoringSaving(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleSaveAuthoringChanges = async () => {
    if (authoringTab === 'branches' && selectedBranchId) {
      await handleSaveSelectedBranch();
      return;
    }
    await handleSaveAuthoringMainline();
  };

  const applyAuthoringCover = (coverUrl: string) => {
    setAuthoringCartridge((prev: any) => prev ? ({
      ...prev,
      meta: {
        ...prev.meta,
        coverUrl,
      },
    }) : prev);
  };

  const handleAuthoringCoverUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('请上传图片文件。');
      return;
    }
    try {
      const coverUrl = await compressImageToSquareDataUrl(file);
      applyAuthoringCover(coverUrl);
      showError('封面已载入，记得点击“保存更改”。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '封面处理失败。');
    }
  };

  const handleAuthoringCoverPaste = async (event: React.ClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData?.files || []) as File[];
    const clipboardItems = Array.from(event.clipboardData?.items || []) as DataTransferItem[];
    const itemFiles = clipboardItems
      .map((item) => item.kind === 'file' ? item.getAsFile() : null)
      .filter(Boolean) as File[];
    const imageFile = [...files, ...itemFiles].find((file) => file.type.startsWith('image/'));
    if (!imageFile) return;
    event.preventDefault();
    await handleAuthoringCoverUpload(imageFile);
  };

  const handleGenerateAuthoringCover = async () => {
    if (!authoringCartridge) return;
    if (!canUseCoverGeneration) {
      showError('AI 图片生成暂未开放。');
      return;
    }
    if (!authoringCoverPrompt.trim()) {
      showError('请先输入封面生成提示。');
      return;
    }
    let quotaReserved = false;
    try {
      setIsGeneratingCover(true);
      const remaining = await reserveCoverGenerationQuota();
      quotaReserved = true;
      const response = await apiFetch('/api/ai?action=generate-cover', {
        method: 'POST',
        body: JSON.stringify({
          prompt: authoringCoverPrompt,
          title: stripBookTitle(authoringCartridge.meta?.title || ''),
          mainAxis: authoringCartridge.meta?.main_axis || '',
          tags: normalizeTagList(authoringCartridge.meta?.tags || []),
        }),
      }, 90000);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = await response.json();
      const coverUrl = await compressImageToSquareDataUrl(data.imageDataUrl);
      applyAuthoringCover(coverUrl);
      setCoverGenerationRemaining(remaining);
      quotaReserved = false;
      showError(`AI 封面已生成，记得点击“保存更改”。今日还可生成 ${remaining} 张。`);
    } catch (error: any) {
      console.error(error);
      if (quotaReserved) {
        await refundCoverGenerationQuota().catch((refundError) => console.error(refundError));
      }
      showError(error?.message || 'AI 封面生成失败。');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleSaveAdminSettings = async () => {
    if (!db || !user || !isAdminUser) return;
    try {
      setIsSavingAdminSettings(true);
      const nextSettings = {
        coverGenerationEnabled: Boolean(adminFeatureDraft.coverGenerationEnabled),
      };
      await saveAppSettings(db as any, user.uid, nextSettings, isAdminUser);
      setFeatureSettings(nextSettings);
      setAdminFeatureDraft(nextSettings);
      showError('管理设置已保存。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '保存管理设置失败。');
    } finally {
      setIsSavingAdminSettings(false);
    }
  };

  const handleUpdateBio = async () => {
    if (!user || !db) return;
    try {
      setBioSaving(true);
      await setDoc(doc(db as any, 'users', user.uid), { bio: editingBio.trim() }, { merge: true });
      setMyBio(editingBio.trim());
      showError('个人签名更新成功！');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '个人签名保存失败。');
    } finally {
      setBioSaving(false);
    }
  };

  useEffect(() => {
    setEditingBio(myBio);
  }, [myBio, isAccountCenterOpen, gameState]);

  const handleUpdateProfileDisplayName = async () => {
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      showError('游客请先注册为正式用户后再修改名称。');
      return;
    }
    const nextName = limitFiveChars(profileDisplayName);
    if (!nextName) {
      showError('请输入新的显示名称。');
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: nextName });
      setUser({ ...auth.currentUser } as FirebaseUser);
      await syncCurrentAuthorName(auth.currentUser);
      await refreshStories({ force: true });
      showError('显示名称已更新。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '更新名称失败。');
    }
  };

  const handleUpdateAccountPassword = async () => {
    if (!auth?.currentUser || !auth.currentUser.email) {
      showError('当前账号无法直接修改密码。');
      return;
    }
    if (!profileCurrentPassword || profileNewPassword.length < 6) {
      showError('请输入当前密码，以及至少 6 位的新密码。');
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, profileCurrentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, profileNewPassword);
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      showError('账户密码已更新。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '修改密码失败。');
    }
  };

  const handlePasswordResetForEmail = async (email: string) => {
    if (!auth || !String(email || '').trim()) {
      showError('请输入邮箱。');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, String(email || '').trim());
      showError('密码重设邮件已发送。');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '无法发送重设邮件。');
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setIsAccountCenterOpen(false);
      setShowLeaveGameModal(false);
      setIsActionMenuOpen(false);
      setIsStoryInfoOpen(false);
      resetToHome();
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '登出失败，请重试。');
    }
  };

  const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse', confirmedEarlierRewrite = false) => {
    if (interventionsLeft <= 0 || isRewriting || !blueprint || !user) return;
    const willRewriteEarlierThanPastIntervention = interventionHistory.some((item) => Number(item.chapterNum) > chapterNum);
    if (willRewriteEarlierThanPastIntervention && !confirmedEarlierRewrite) {
      const affectedChapters = Array.from(new Set(interventionHistory.filter((item) => item.chapterNum > chapterNum).map((item) => Number(item.chapterNum)))).sort((a, b) => Number(a) - Number(b));
      setConfirmationModal({
        isOpen: true,
        title: '确认回溯干涉？',
        message: `当前将从第 ${chapterNum} 章重新干涉命运，这会重写第 ${chapterNum} 章到第 7 章。此前在第 ${affectedChapters.join('、')} 章造成的剧情变化，以及由这些较晚章节单次触发的当前支线，可能会被取消；但“曾解锁”记录和用于累计触发支线的干涉计数会保留，已消耗的干涉次数不会返还。`,
        onConfirm: () => { void handleIntervene(chapterNum, charId, action, true); },
      });
      return;
    }

    let simulation: ReturnType<typeof setInterval> | null = null;
    const effectiveUnlockedBranches = willRewriteEarlierThanPastIntervention
      ? unlockedBranches.filter((branch: any) => getBranchTriggerChapter(branch) < chapterNum)
      : unlockedBranches;
    
    try {
      setIsRewriting(true);
      setActiveInterventionChapter(null);
      setInterventionEffect(action);
      setActiveInterventionOverlay({ type: action, targetChapter: chapterNum, statusRaw: "因果重塑中..." });
      
      const charName = blueprint.characters.find(c => c.id === charId)?.name || "未知角色";
      simulation = startProgressSimulation(12000, isEnglish
        ? [
            `Observing ${charName}'s fate line...`,
            `Weaving the cause and effect of ${action === 'bless' ? 'grace' : 'ordeal'}...`,
            `Reshaping chapter ${chapterNum} and its ripple effects...`,
            'The wheel of fate is turning...',
          ]
        : [
            `正在观测 ${charName} 的命运线...`,
            `正在编织 ${action === 'bless' ? '庇佑' : '磨难'} 的因果...`,
            `正在重塑第 ${chapterNum} 章及后续情节...`,
            '命运之轮已经转动...',
          ]);

      let result;
      if (activeStoryId === 'tutorial-cartridge' || blueprint?.id === 'tutorial-cartridge') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        result = getTutorialInterventionResult(chapterNum, charId, action, endingValue, effectiveUnlockedBranches);
        if (simulation) {
          clearInterval(simulation);
          simulation = null;
        }
      } else {
        const response = await apiFetch('/api/ai?action=intervene', {
          method: 'POST',
          body: JSON.stringify({
            blueprint,
            chapters,
            chapterNum,
            charId,
            action,
            currentEndingValue: endingValue,
            currentUnlockedBranches: effectiveUnlockedBranches,
            targetWordCount,
            interventionHistory: [...interventionHistory, { chapterNum, charId, action }],
            worldState: buildWorldStateForPrompt(chapterNum, endingValue),
            language: appLanguage,
          })
        });

        if (simulation) {
          clearInterval(simulation);
          simulation = null;
        }

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        result = await response.json();
      }
      const aiData = result?.aiData || {};
      
      const newHistory = [...interventionHistory, { chapterNum, charId, action }];
      const nextInterventionsLeft = Math.max(0, interventionsLeft - 1);
      const nextEndingValue = typeof result?.newEndingValue === 'number' ? result.newEndingValue : endingValue;
      let nextChapters = chapters;
      let nextCharacterStatuses = { ...(characterStatuses || {}) } as Record<string, { status: string; isDead: boolean }>;
      let nextChangeHighlights = { ...(changeHighlights || {}) } as Record<number, string[]>;
      setInterventionHistory(newHistory);
      setInterventionsLeft(nextInterventionsLeft);
      
      if (Array.isArray(aiData?.chapters) && aiData.chapters.length > 0) {
        const previousByNum = new Map<number, any>((chapters || []).map((chapter) => [chapter.chapter_num, chapter as any]));
        const rewrittenByNum = new Map<number, any>();
        aiData.chapters.forEach((chapter: any) => {
          const previous = (previousByNum.get(chapter.chapter_num) || {}) as any;
          rewrittenByNum.set(chapter.chapter_num, {
            chapter_num: chapter.chapter_num,
            title: chapter.title || previous.title || `第${chapter.chapter_num}章`,
            summary: chapter.summary || previous.summary || '',
            present_characters: Array.isArray(chapter.present_characters) ? chapter.present_characters : (previous.present_characters || []),
            text: stripGeneratedMarkup(chapter.text || previous.text || ''),
          });
        });
        let mergedChapters = (chapters || []).map((chapter) => rewrittenByNum.get(chapter.chapter_num) || chapter);
        rewrittenByNum.forEach((chapter, chapterNum) => {
          if (!previousByNum.has(chapterNum)) {
            mergedChapters.push(chapter);
          }
        });
        const futureOutlines = Array.isArray(aiData.future_outlines) ? aiData.future_outlines : [];
        if (futureOutlines.length > 0) {
          const outlineByNum = new Map<number, any>();
          futureOutlines.forEach((outline: any) => {
            const outlineChapterNum = Number(outline?.chapter_num ?? outline?.chapterNum);
            if (Number.isFinite(outlineChapterNum) && outlineChapterNum > chapterNum) {
              outlineByNum.set(outlineChapterNum, outline);
            }
          });
          mergedChapters = ensureSevenChapterShells(mergedChapters as any).map((chapter: any) => {
            const outline = outlineByNum.get(Number(chapter.chapter_num));
            if (!outline) return chapter;
            return {
              ...chapter,
              summary: String(outline.summary || chapter.summary || ''),
              text: '',
              word_target: Number(outline.word_target) || undefined,
            };
          });
        }
        mergedChapters.sort((a: any, b: any) => a.chapter_num - b.chapter_num);
        nextChapters = mergedChapters as any;
        setChapters(nextChapters as any);
        const returnedChapterNums = new Set<number>(aiData.chapters.map((chapter: any) => Number(chapter.chapter_num)).filter(Number.isFinite));
        const normalizedHighlights = normalizeChangeHighlightsForClient(aiData.change_highlights);
        returnedChapterNums.forEach((chapterNum) => {
          if (normalizedHighlights[chapterNum]?.length) {
            nextChangeHighlights[chapterNum] = normalizedHighlights[chapterNum];
          } else {
            delete nextChangeHighlights[chapterNum];
          }
        });
        setChangeHighlights(nextChangeHighlights);
      }

      const characterNameById = new Map((blueprint.characters || []).map((character: any) => [character.id, character.name]));
      const changedStatusUpdates: Array<{ id: string; name: string; status: string; isDead: boolean }> = [];
      if (Array.isArray(aiData?.character_updates) && aiData.character_updates.length > 0) {
        aiData.character_updates.forEach((update: any) => {
          if (!update?.id) return;
          const previous = nextCharacterStatuses[update.id];
          const nextStatus = String(update.status || previous?.status || '存活');
          const nextIsDead = Boolean(update.is_dead);
          if (!previous || previous.status !== nextStatus || Boolean(previous.isDead) !== nextIsDead) {
            changedStatusUpdates.push({
              id: update.id,
              name: String(characterNameById.get(update.id) || update.name || update.id),
              status: nextStatus,
              isDead: nextIsDead,
            });
          }
          nextCharacterStatuses[update.id] = {
            status: nextStatus,
            isDead: nextIsDead,
          };
        });
        setCharacterStatuses(nextCharacterStatuses);
      }
      setEndingValue(nextEndingValue);
      const nextUnlockedBranches = Array.isArray(result?.newUnlockedBranches)
        ? result.newUnlockedBranches
        : unlockedBranches;
      setUnlockedBranches(nextUnlockedBranches);
      const historicalBranchById = new Map<string, any>();
      (historicallyUnlockedBranches || []).forEach((branch: any) => {
        if (branch?.id) historicalBranchById.set(branch.id, branch);
      });
      (nextUnlockedBranches || []).forEach((branch: any) => {
        if (branch?.id) historicalBranchById.set(branch.id, branch);
      });
      if (result?.unlockedBranch) {
        setBranchUnlockNotice(result.unlockedBranch);
        if (result.unlockedBranch.id) historicalBranchById.set(result.unlockedBranch.id, result.unlockedBranch);
      }
      const nextHistoricalBranches = normalizeHistoricalUnlockedBranchesForBlueprint(Array.from(historicalBranchById.values()), blueprint);
      setHistoricallyUnlockedBranches(nextHistoricalBranches);
      if (result?.uiFeedback) {
        setUiFeedback(result.uiFeedback);
      }
      
      if (result.worldState) {
        setWorldStateDigest(result.worldState.canonical);
        setDeltaWorldStateByChapter(prev => ({
          ...prev,
          [chapterNum]: result.worldState.delta
        }));
      }

      const nextIntervenedChapters = [...intervenedChapters, chapterNum];
      setIntervenedChapters(nextIntervenedChapters);
      if (activeStoryId && db) {
        const progressPayload = {
          ...buildCurrentRunSnapshot(),
          interventionsLeft: nextInterventionsLeft,
          endingValue: nextEndingValue,
          unlockedBranches: nextUnlockedBranches,
          historicallyUnlockedBranches: nextHistoricalBranches,
          intervenedChapters: nextIntervenedChapters,
          characterStatuses: nextCharacterStatuses,
          interventionHistory: newHistory,
          currentChapters: nextChapters,
          changeHighlights: nextChangeHighlights,
          uiFeedback: result?.uiFeedback || uiFeedback,
          ...buildEndingProgressSnapshot(nextEndingValue, result?.uiFeedback || uiFeedback, nextIntervenedChapters.length >= 3),
        };
        void saveUserProgress(db as any, user.uid, activeStoryId, progressPayload).catch((error) => {
          console.warn('[progress:auto-save-after-intervention]', error);
        });
      }
      if (nextIntervenedChapters.length >= 3) {
        setPendingSummaryRequest('auto_interventions');
      } else {
        setInterventionStatusNotice({ updates: changedStatusUpdates });
      }
      
      setActiveInterventionOverlay(null);
      setIsRewriting(false);
      setActiveInterventionChapter(null);
      setInterventionEffect(null);
      scrollToChapter(chapterNum);

    } catch (e) {
      console.error(e);
      showError(e.message || "干涉失败，请重试");
      setIsRewriting(false);
      setActiveInterventionOverlay(null);
    } finally {
      if (simulation) {
        clearInterval(simulation);
      }
    }
  };

  const incrementStoryCounter = async (storyId: string, field: 'favoriteCount' | 'reportCount' | 'interventionCount') => {
    if (!db) return;
    await incrementStoryMetric(db as any, storyId, field);
  };

  const storyActionCacheKey = (kind: 'like' | 'favorite') => `3t-story-${kind}s:${user?.uid || 'anonymous'}`;

  const readStoryActionCache = (kind: 'like' | 'favorite'): Set<string> => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const raw = window.localStorage.getItem(storyActionCacheKey(kind));
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set<string>();
    }
  };

  const writeStoryActionCache = (kind: 'like' | 'favorite', ids: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storyActionCacheKey(kind), JSON.stringify(Array.from(ids)));
    } catch {
      // Local cache is only a UX hint; backend remains authoritative.
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setOptimisticLikedStoryIds(new Set());
      setOptimisticFavoritedStoryIds(new Set());
      return;
    }
    setOptimisticLikedStoryIds(readStoryActionCache('like'));
    setOptimisticFavoritedStoryIds(readStoryActionCache('favorite'));
  }, [user?.uid]);

  const setStoryActionState = (kind: 'like' | 'favorite', storyId: string, active: boolean) => {
    const setter = kind === 'like' ? setOptimisticLikedStoryIds : setOptimisticFavoritedStoryIds;
    setter((prev) => {
      const next = new Set<string>(prev);
      if (active) next.add(storyId);
      else next.delete(storyId);
      writeStoryActionCache(kind, next);
      return next;
    });
  };

  const applyStoryActionFlag = (kind: 'like' | 'favorite', storyId: string, active: boolean) => {
    const patchStory = (story: any) => {
      if (!story || (story.id !== storyId && story.storyId !== storyId && story.sourceStoryId !== storyId)) return story;
      const flagPatch = kind === 'like'
        ? { likedByMe: active, isLiked: active }
        : { favoritedByMe: active, isFavorited: active };
      return {
        ...story,
        ...flagPatch,
        meta: story.meta ? { ...story.meta, ...flagPatch } : story.meta,
      };
    };
    setPublicStories((prev) => prev.map(patchStory));
    setMyStories((prev) => prev.map(patchStory));
    setMySharedStories((prev) => prev.map(patchStory));
    setStoryDetailStory((prev) => patchStory(prev));
    setActiveStoryMeta((prev: any) => patchStory(prev));
  };

  const patchCachedStoryAction = async (
    kind: 'like' | 'favorite',
    storyId: string,
    active: boolean,
    field: 'likeCount' | 'favoriteCount',
    delta: number
  ) => {
    const cached = await getStoryListCache();
    if (!cached?.value) return;
    const flagPatch = kind === 'like'
      ? { likedByMe: active, isLiked: active }
      : { favoritedByMe: active, isFavorited: active };
    const patchStory = (story: any) => {
      if (!story || (story.id !== storyId && story.storyId !== storyId && story.sourceStoryId !== storyId)) return story;
      const current = Number(story[field] ?? story.meta?.[field] ?? 0);
      const nextValue = Math.max(0, current + delta);
      return {
        ...story,
        ...flagPatch,
        [field]: nextValue,
        meta: story.meta ? { ...story.meta, ...flagPatch, [field]: nextValue } : story.meta,
      };
    };
    await setLocalCache(storyListCacheKey(), {
      ...cached.value,
      pub: Array.isArray(cached.value.pub) ? cached.value.pub.map(patchStory) : [],
      mine: Array.isArray(cached.value.mine) ? cached.value.mine.map(patchStory) : [],
      shared: Array.isArray(cached.value.shared)
        ? cached.value.shared
            .filter((story: any) => !(kind === 'favorite' && !active && story?.archiveKind === 'favorite' && (story.id === storyId || story.storyId === storyId || story.sourceStoryId === storyId)))
            .map(patchStory)
        : [],
    });
  };

  const hasOptimisticStoryAction = (kind: 'like' | 'favorite', storyId?: string | null) => {
    if (!storyId) return false;
    return kind === 'like' ? optimisticLikedStoryIds.has(storyId) : optimisticFavoritedStoryIds.has(storyId);
  };

  const hasStoryCardAction = (kind: 'like' | 'favorite', story: any) => {
    const storyId = story?.id || story?.storyId || story?.sourceStoryId;
    if (!storyId) return false;
    if (hasOptimisticStoryAction(kind, storyId)) return true;
    if (kind === 'like') {
      return Boolean(story?.likedByMe || story?.isLiked || story?.meta?.likedByMe || story?.meta?.isLiked);
    }
    if (story?.favoritedByMe || story?.isFavorited || story?.meta?.favoritedByMe || story?.meta?.isFavorited) return true;
    return mySharedStories.some((item: any) => (
      item?.archiveKind === 'favorite' &&
      (item?.id === storyId || item?.storyId === storyId || item?.sourceStoryId === storyId)
    ));
  };

  const isCurrentStoryActive = (kind: 'like' | 'favorite') => {
    if (activeStoryMeta) return hasStoryCardAction(kind, activeStoryMeta);
    return hasOptimisticStoryAction(kind, activeStoryId);
  };

  const applyStoryCountDelta = (storyId: string, field: 'likeCount' | 'favoriteCount' | 'shareCount', delta: number) => {
    const patchStory = (story: any) => {
      if (!story || (story.id !== storyId && story.storyId !== storyId && story.sourceStoryId !== storyId)) return story;
      const current = Number(story[field] ?? story.meta?.[field] ?? 0);
      const nextValue = Math.max(0, current + delta);
      return {
        ...story,
        [field]: nextValue,
        meta: story.meta ? { ...story.meta, [field]: nextValue } : story.meta,
      };
    };
    setPublicStories((prev) => prev.map(patchStory));
    setMyStories((prev) => prev.map(patchStory));
    setMySharedStories((prev) => prev.map(patchStory));
    setStoryDetailStory((prev) => patchStory(prev));
    setActiveStoryMeta((prev: any) => patchStory(prev));
  };

  const recordStoryShare = async (storyId?: string | null) => {
    if (!storyId || !db || !user) return;
    applyStoryCountDelta(storyId, 'shareCount', 1);
    try {
      await incrementShareMetric(db as any, storyId);
    } catch (error) {
      console.warn('increment share metric failed:', error);
      applyStoryCountDelta(storyId, 'shareCount', -1);
    }
  };

  const handleGenerateSummary = async (source: 'auto_interventions' | 'manual') => {
    if (!activeStoryId || isGeneratingConclusion || !blueprint) return;
    if (storyConclusion) {
      setShowSummaryModal(true);
      return;
    }
    let simulation: ReturnType<typeof setInterval> | null = null;
    
    try {
      setIsGeneratingConclusion(true);
      setSummaryEntrySource(source);
      setActiveInterventionOverlay({ type: 'ending', targetChapter: 7, statusRaw: '终局演绎中...' });
      
      simulation = startProgressSimulation(8000, isEnglish
        ? [
            'Gathering the remaining causes...',
            'Reading the final direction of fate...',
            'Writing the fate summary...',
          ]
        : [
            '正在收束因果残片...',
            '正在推演时空最终走向...',
            '正在铭刻命运总结...',
          ]);

      let conclusionText;
      if (activeStoryId === 'tutorial-cartridge' || blueprint?.id === 'tutorial-cartridge') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        conclusionText = getTutorialEndingText(endingValue);
        if (simulation) {
          clearInterval(simulation);
          simulation = null;
        }
      } else {
        const response = await apiFetch('/api/ai?action=generate-summary', {
          method: 'POST',
          body: JSON.stringify({
            blueprint,
            endingValue,
            chapters,
            language: appLanguage,
          })
        });

        if (simulation) {
          clearInterval(simulation);
          simulation = null;
        }

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const result = await response.json();
        conclusionText = result.text || result.conclusion || '';
      }
      setStoryConclusion(conclusionText);
      setShowSummaryModal(true);
      if (db && user) {
        const completionRecord = createFateCompletionRecord({ storyConclusion: conclusionText });
        const finalPayload = {
          ...buildCurrentRunSnapshot(),
          storyConclusion: conclusionText,
          interventionsLeft,
          ...buildEndingProgressSnapshot(endingValue, uiFeedback, true),
        };
        void saveUserProgress(db as any, user.uid, activeStoryId, {
          ...appendCompletedRunToProgress(finalPayload, completionRecord),
        }).catch((error) => console.warn('[progress:save-final-ending]', error));
      }
      try {
        await incrementStoryCounter(activeStoryId, 'interventionCount');
      } catch (counterError) {
        console.error(counterError);
      }
    } catch (e: any) {
      console.error(e);
      showError(e.message || "生成总结失败");
      navigateTo('PLAYING', { replace: true });
    } finally {
      if (simulation) {
        clearInterval(simulation);
      }
      setIsGeneratingConclusion(false);
      setActiveInterventionOverlay(null);
    }
  };

  useEffect(() => {
    if (!pendingSummaryRequest || isRewriting || isGeneratingConclusion || !activeStoryId || !blueprint) return;
    const source = pendingSummaryRequest;
    setPendingSummaryRequest(null);
    handleGenerateSummary(source);
  }, [pendingSummaryRequest, isRewriting, isGeneratingConclusion, activeStoryId, blueprint, chapters]);

  const handleShareStory = async () => {
    if (!user || !blueprint) return;
    let shareStage = 'start';
    let createdShareId = '';
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing share...' : '正在准备分享...');
      setGlobalLoadingDetail(isEnglish ? 'Choosing whether to share the original or current fate line, then opening the system share sheet.' : '正在判断分享原作还是当前命运线，并尽快调用系统分享。');
      const shareTitle = formatBookTitle(blueprint?.title || "未命名故事");
      const cleanChapters = getCleanCurrentRunChapters();
      const shareText = buildStoryShareText(shareTitle, cleanChapters);
      if (activeStoryId && currentRunMatchesOriginal()) {
        shareStage = 'deliverOriginalShare';
        setGlobalLoadingDetail('正在调用设备的分享功能。');
        if (await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(activeStoryId) })) {
          await recordStoryShare(activeStoryId);
        }
        return;
      }
      shareStage = 'createStorySnapshot';
      setGlobalLoadingDetail('当前故事已发生变化，正在加入收藏命运并准备非公开链接。');
      const { shareId, sharedRecord, cleanChapters: snapshotChapters } = await createCurrentStorySnapshot('unlisted', 'intervened');
      createdShareId = shareId;
      setSharedStoryId(shareId);
      shareStage = 'deliverPreparedShare';
      setGlobalLoadingDetail('分享记录已准备好，正在调用设备的分享功能。');
      const didShare = await sharePayload({ title: shareTitle, text: shareText, url: buildSharedStoryUrl(shareId) });
      if (didShare) {
        await recordStoryShare(activeStoryId || sharedRecord?.sourceStoryId);
        showError(t('share.snapshotReady'));
      } else {
        showError(t('share.snapshotCanceled'));
      }
      cacheSharedSnapshotAfterCreate(shareId, sharedRecord, snapshotChapters);
      if ((globalThis as any).__legacyShareRecord__) {
      shareStage = 'resolveProvenance';
      const provenance = await resolveActiveStoryProvenance();
      shareStage = 'createSharedStoryRecord';
      const legacyCleanChapters = getCleanCurrentRunChapters();
      const shareId = await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint?.title || "未命名故事",
        main_axis: blueprint?.main_axis || "",
        tags: selectedThemes,
        characters: blueprint?.characters || [],
        chapters: legacyCleanChapters as any,
        averageChapterWords: getAverageChapterWords(legacyCleanChapters),
        coverUrl: activeStoryMeta?.coverUrl || '',
        sourceStoryId: activeStoryId,
        originalAuthorId: provenance.originalAuthorId,
        originalAuthorName: provenance.originalAuthorName,
        intervenerId: user.uid,
        intervenerName: getUserAuthorName(user),
        allowAdaptation: getActiveStoryAllowAdaptation(),
        visibility: 'unlisted',
      });
      createdShareId = shareId;
      const sharedRecord = {
        id: shareId,
        title: blueprint?.title || "æœªå‘½åæ•…äº‹",
        main_axis: blueprint?.main_axis || "",
        tags: selectedThemes,
        characters: blueprint?.characters || [],
        chapters: legacyCleanChapters,
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        originalAuthorId: provenance.originalAuthorId,
        originalAuthorName: provenance.originalAuthorName,
        intervenerId: user.uid,
        intervenerName: getUserAuthorName(user),
        coverUrl: activeStoryMeta?.coverUrl || '',
        sourceStoryId: activeStoryId,
        averageChapterWords: getAverageChapterWords(legacyCleanChapters),
        chapterCount: getReadyChapterCount(legacyCleanChapters),
        cardExcerpt: getStoryCardExcerpt(blueprint?.main_axis || '', legacyCleanChapters),
        allowAdaptation: getActiveStoryAllowAdaptation(),
        visibility: 'unlisted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMySharedStories((prev) => [sharedRecord, ...prev.filter((story: any) => story.id !== shareId)]);
      shareStage = 'cacheSharedStory';
      await cacheSharedStory(shareId, { meta: { ...sharedRecord, sharedStoryId: shareId }, chapters: legacyCleanChapters as any })
        .catch((error) => console.warn('share cacheSharedStory failed:', error));
      shareStage = 'cacheStoryLists';
      await cacheStoryLists(publicStories, myStories, [sharedRecord, ...mySharedStories.filter((story: any) => story.id !== shareId)])
        .catch((error) => console.warn('share cacheStoryLists failed:', error));
      setSharedStoryId(shareId);
      const shareUrl = buildSharedStoryUrl(shareId);
      const shareTitle = formatBookTitle(blueprint?.title || "未命名故事");
      const shareText = buildStoryShareText(shareTitle, legacyCleanChapters);
      shareStage = 'deliverPreparedShare';
      await deliverPreparedShare({ title: shareTitle, text: shareText, url: shareUrl });
      }
    } catch (e) {
      const error = e as any;
      console.error('share story failed:', {
        stage: shareStage,
        shareId: createdShareId || null,
        name: error?.name,
        message: error?.message,
        error,
      });
      if ((e as any)?.name === 'AbortError') {
        showError(createdShareId ? t('share.snapshotCanceled') : t('share.canceled'));
        return;
      }
      const hasShareId = Boolean(createdShareId);
      const stageLabel = ({
        resolveProvenance: '确认原作者',
        createStorySnapshot: '创建故事快照',
        createSharedStoryRecord: '创建分享记录',
        cacheSharedStory: '缓存分享故事',
        cacheStoryLists: '更新本机列表缓存',
        deliverOriginalShare: '打开原作分享',
        deliverPreparedShare: '打开系统分享',
      } as Record<string, string>)[shareStage] || '准备分享';
      showError(`${hasShareId ? '分享记录已创建，但' : ''}${stageLabel}失败：${error?.name || error?.message || '未知错误'}`);
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleStoryInteraction = async (kind: 'like' | 'favorite' | 'report', targetId?: string, targetMeta?: any) => {
    const idToUse = targetId || activeStoryId;
    if (!idToUse || !db || !user) { if (!user) setIsAccountCenterOpen(true); return; }
    if (idToUse === 'tutorial-cartridge') {
      const wasActionActive = kind === 'like' || kind === 'favorite'
        ? (targetMeta
            ? hasStoryCardAction(kind, targetMeta)
            : (idToUse === activeStoryId ? isCurrentStoryActive(kind) : hasOptimisticStoryAction(kind, idToUse)))
        : false;
      if (kind === 'like') {
        const isActive = wasActionActive;
        setStoryActionState('like', idToUse, !isActive);
        applyStoryActionFlag('like', idToUse, !isActive);
        applyStoryCountDelta(idToUse, 'likeCount', isActive ? -1 : 1);
        showError(isActive ? '已取消点赞。' : '已点赞。');
      } else if (kind === 'favorite') {
        const isActive = wasActionActive;
        setStoryActionState('favorite', idToUse, !isActive);
        applyStoryActionFlag('favorite', idToUse, !isActive);
        applyStoryCountDelta(idToUse, 'favoriteCount', isActive ? -1 : 1);
        showError(isActive ? '已取消收藏。' : '已收藏。');
      } else if (kind === 'report') {
        showError('不能举报系统教学卡带！');
      }
      return;
    }
    const wasActionActive = kind === 'like' || kind === 'favorite'
      ? (targetMeta
          ? hasStoryCardAction(kind, targetMeta)
          : (idToUse === activeStoryId ? isCurrentStoryActive(kind) : hasOptimisticStoryAction(kind, idToUse)))
      : false;
    try {
      if (kind === 'like') {
        const isActive = wasActionActive;
        if (isActive) {
          setStoryActionState('like', idToUse, false);
          applyStoryActionFlag('like', idToUse, false);
          applyStoryCountDelta(idToUse, 'likeCount', -1);
          void patchCachedStoryAction('like', idToUse, false, 'likeCount', -1);
          const result = await unlikeStory(db as any, idToUse, user.uid);
          if (!result?.removed) {
            applyStoryCountDelta(idToUse, 'likeCount', 1);
            void patchCachedStoryAction('like', idToUse, false, 'likeCount', 1);
          }
          showError('已取消点赞。');
          return;
        }
        setStoryActionState('like', idToUse, true);
        applyStoryActionFlag('like', idToUse, true);
        applyStoryCountDelta(idToUse, 'likeCount', 1);
        void patchCachedStoryAction('like', idToUse, true, 'likeCount', 1);
        const result = await likeStory(db as any, idToUse, user.uid);
        if (result?.alreadyExists) {
          applyStoryCountDelta(idToUse, 'likeCount', -1);
          void patchCachedStoryAction('like', idToUse, true, 'likeCount', -1);
          return;
        }
        showError('已点赞。');
        return;
      }
      if (kind === 'favorite') {
        const isActive = wasActionActive;
        if (isActive) {
          setStoryActionState('favorite', idToUse, false);
          applyStoryActionFlag('favorite', idToUse, false);
          applyStoryCountDelta(idToUse, 'favoriteCount', -1);
          setMySharedStories((prev) => prev.filter((story: any) => !(
            story?.archiveKind === 'favorite' &&
            (story.id === idToUse || story.storyId === idToUse || story.sourceStoryId === idToUse)
          )));
          void patchCachedStoryAction('favorite', idToUse, false, 'favoriteCount', -1);
          const result = await unfavoriteStory(db as any, idToUse, user.uid);
          if (!result?.removed) {
            applyStoryCountDelta(idToUse, 'favoriteCount', 1);
            void patchCachedStoryAction('favorite', idToUse, false, 'favoriteCount', 1);
          }
          showError('已取消收藏。');
          return;
        }
        setStoryActionState('favorite', idToUse, true);
        applyStoryActionFlag('favorite', idToUse, true);
        applyStoryCountDelta(idToUse, 'favoriteCount', 1);
        void patchCachedStoryAction('favorite', idToUse, true, 'favoriteCount', 1);
        const favoriteResult = await favoriteStory(db as any, idToUse, user.uid);
        const alreadyFavorited = Boolean(favoriteResult?.alreadyExists);
        if (alreadyFavorited) {
          applyStoryCountDelta(idToUse, 'favoriteCount', -1);
          void patchCachedStoryAction('favorite', idToUse, true, 'favoriteCount', -1);
        }
        const sourceMeta = targetMeta || activeStoryMeta || await getStoryMeta(db as any, idToUse).catch(() => null);
        if (sourceMeta) {
          setMySharedStories((prev) => {
            if (prev.some((story: any) => story.archiveKind === 'favorite' && (story.id === idToUse || story.sourceStoryId === idToUse))) return prev;
            return [{
              ...sourceMeta,
              id: idToUse,
              archiveKind: 'favorite',
              sourceStoryId: idToUse,
              originalAuthorId: sourceMeta.authorId,
              originalAuthorName: sourceMeta.authorName,
              intervenerId: null,
              intervenerName: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, ...prev];
          });
        }
        showError(alreadyFavorited ? '已在馆藏中。' : '已收藏并加入馆藏。');
        if ((globalThis as any).__legacyFavoriteArchive__) {

        const cartridge = await getStoryCartridge(db as any, idToUse);
        if (!cartridge) {
          throw new Error('story-not-found-or-denied');
        }
        const archiveSourceStoryId = idToUse;
        const alreadyInArchive = mySharedStories.some((story: any) => (
          story.sourceStoryId === archiveSourceStoryId ||
          story.sourceStoryId === idToUse ||
          story.id === archiveSourceStoryId
        ));
        if (!alreadyInArchive) {
          const title = cartridge.meta?.title || '收藏作品';
          const mainAxis = cartridge.meta?.main_axis || '';
          const averageChapterWords = cartridge.meta?.averageChapterWords || getAverageChapterWords(cartridge.chapters as any);
          const archiveId = await createSharedStoryRecord(db as any, {
            authorId: user.uid,
            authorName: getUserAuthorName(user),
            title,
            main_axis: mainAxis,
            tags: cartridge.meta?.tags || [],
            characters: cartridge.meta?.characters || [],
            chapters: cartridge.chapters as any,
            averageChapterWords,
            coverUrl: cartridge.meta?.coverUrl || '',
            sourceStoryId: archiveSourceStoryId,
            originalAuthorId: cartridge.meta?.authorId || archiveSourceStoryId,
            originalAuthorName: getStoryAuthorName(cartridge.meta),
            intervenerId: null,
            intervenerName: '',
            allowAdaptation: Boolean(cartridge.meta?.allowAdaptation),
            visibility: 'private',
          });
          setMySharedStories((prev) => [{
            id: archiveId,
            title,
            main_axis: mainAxis,
            tags: cartridge.meta?.tags || [],
            characters: cartridge.meta?.characters || [],
            chapters: cartridge.chapters,
            authorId: user.uid,
            authorName: getUserAuthorName(user),
            originalAuthorId: cartridge.meta?.authorId || archiveSourceStoryId,
            originalAuthorName: getStoryAuthorName(cartridge.meta),
            intervenerId: null,
            intervenerName: '',
            sourceStoryId: archiveSourceStoryId,
            averageChapterWords,
            allowAdaptation: Boolean(cartridge.meta?.allowAdaptation),
            visibility: 'private',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, ...prev]);
        }
        showError(alreadyFavorited || alreadyInArchive ? '已在馆藏中。' : '已收藏并加入馆藏。');
        return;
        }
        return;
      }
      await reportStory(db as any, idToUse, user.uid);
      showError('已收到举报。');
      return;
    } catch (error) {
      if ((error as any)?.message === 'already-liked') {
        showError('该作品已经点过赞。');
        return;
      }
      console.error(error);
      if (kind === 'like') {
        setStoryActionState('like', idToUse, wasActionActive);
        applyStoryActionFlag('like', idToUse, wasActionActive);
        applyStoryCountDelta(idToUse, 'likeCount', wasActionActive ? 1 : -1);
        void patchCachedStoryAction('like', idToUse, wasActionActive, 'likeCount', wasActionActive ? 1 : -1);
      }
      if (kind === 'favorite') {
        setStoryActionState('favorite', idToUse, wasActionActive);
        applyStoryActionFlag('favorite', idToUse, wasActionActive);
        applyStoryCountDelta(idToUse, 'favoriteCount', wasActionActive ? 1 : -1);
        void patchCachedStoryAction('favorite', idToUse, wasActionActive, 'favoriteCount', wasActionActive ? 1 : -1);
      }
      showError('操作失败，请稍后再试。');
    }
  };

  const handleAuthoringSave = async () => {
    if (!user || !authoringCartridge || !authoringStoryId) return;
    try {
      setAuthoringSaving(true);
      await saveStoryMainlineBundle(db as any, authoringStoryId, {
        metaPatch: {
          ...authoringCartridge.meta,
          averageChapterWords: getAverageChapterWords(authoringCartridge.chapters),
          chapterCount: getReadyChapterCount(authoringCartridge.chapters),
          cardExcerpt: getStoryCardExcerpt(authoringCartridge.meta?.main_axis, authoringCartridge.chapters),
        },
        chapters: authoringCartridge.chapters,
        endings: authoringCartridge.endings,
      });
      setAuthoringSavedSnapshot(JSON.stringify(authoringCartridge));
      setAuthoringDirty(false);
      setAuthoringSaveSuccessStory({
        storyId: authoringStoryId,
        meta: authoringCartridge.meta,
        chapters: authoringCartridge.chapters,
      });
    } catch (e) {
      console.error(e);
      showError("保存失败");
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleAuthoringImport = async () => {
    if (!authoringImportText.trim() || !authoringCartridge) return;
    try {
      const parsed = parseImportedAuthoringText(authoringImportText);
      const nextCartridge = { ...authoringCartridge };
      
      nextCartridge.meta.title = parsed.title || nextCartridge.meta.title;
      nextCartridge.meta.main_axis = parsed.mainAxis || nextCartridge.meta.main_axis;
      
      if (parsed.characters.length > 0) {
        nextCartridge.meta.characters = normalizeCharacters(parsed.characters);
      }
      
      if (parsed.chapters.length > 0) {
        nextCartridge.chapters = parsed.chapters.map(c => ({
          chapter_num: c.chapter_num,
          title: c.title,
          summary: c.summary,
          present_characters: nextCartridge.meta.characters.map((cc: any) => cc.id),
          text: c.text,
        }));
      }

      nextCartridge.endings = [
        { id: 'default', title: '终局', text: parsed.endings.default },
        { id: 'left', title: '左域默认结局', text: parsed.endings.left },
        { id: 'right', title: '右域默认结局', text: parsed.endings.right },
      ];

      if (authoringImportReplaceBranches && parsed.branches.length > 0) {
        // Handle branch import logic...
        showError("已导入主线内容；支线内容请在「角色和支线」中继续确认。");
      }

      setAuthoringCartridge(nextCartridge);
      setAuthoringImportText('');
      setAuthoringTab('settings');
    } catch (e) {
      console.error(e);
      showError("解析导入文本失败");
    }
  };

  useEffect(() => {
    if (gameState === 'STORY_SELECT' && user && db) {
      if (hasLoadedInitialStoryListRef.current) return;
      hasLoadedInitialStoryListRef.current = true;
      refreshStories().then((ok) => {
        if (!ok) hasLoadedInitialStoryListRef.current = false;
      }).catch(() => {
        hasLoadedInitialStoryListRef.current = false;
      });
    }
  }, [gameState, user, db]);

  useEffect(() => {
    if (gameState !== 'ARCHIVE' || !user || !db) return;
    void refreshArchiveStories();
  }, [gameState, user, db]);

  useEffect(() => {
    let activeTextarea: HTMLTextAreaElement | null = null;
    let startY = 0;
    let startHeight = 0;
    const resizeGripSize = 44;

    const isInTextareaResizeGrip = (event: PointerEvent | MouseEvent, textarea: HTMLTextAreaElement) => {
      const rect = textarea.getBoundingClientRect();
      return event.clientX >= rect.right - resizeGripSize && event.clientY >= rect.bottom - resizeGripSize;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('authoring-resizable-textarea')) return;
      if (!isInTextareaResizeGrip(event, target)) return;
      activeTextarea = target;
      startY = event.clientY;
      startHeight = target.getBoundingClientRect().height;
      target.classList.add('authoring-resizing');
      target.setPointerCapture?.(event.pointerId);
      window.getSelection()?.removeAllRanges();
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!activeTextarea) return;
      const nextHeight = Math.max(80, startHeight + event.clientY - startY);
      activeTextarea.style.height = `${nextHeight}px`;
      event.preventDefault();
    };

    const stopResizing = () => {
      activeTextarea?.classList.remove('authoring-resizing');
      activeTextarea = null;
    };

    const preventGripTextSelection = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLTextAreaElement &&
        target.classList.contains('authoring-resizable-textarea') &&
        isInTextareaResizeGrip(event, target)
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', stopResizing, true);
    document.addEventListener('pointercancel', stopResizing, true);
    document.addEventListener('selectstart', preventGripTextSelection, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', stopResizing, true);
      document.removeEventListener('pointercancel', stopResizing, true);
      document.removeEventListener('selectstart', preventGripTextSelection, true);
    };
  }, []);

  useEffect(() => {
    if (!isSessionHydrated || !user) return;
    if (gameState === 'READONLY_STORY' && !readonlyStoryData) {
      console.warn('Recovered invalid READONLY_STORY state without readonly story data.');
      resetToHome();
      showError('页面状态已恢复，请重新打开故事记录。');
      return;
    }
    if ((gameState === 'PLAYING' || gameState === 'SUMMARY') && !blueprint) {
      console.warn('Recovered invalid story runtime state without blueprint.');
      resetToHome();
      showError('游玩状态已恢复，请重新进入故事。');
    }
  }, [isSessionHydrated, user, gameState, readonlyStoryData, blueprint]);

  useEffect(() => {
    const handleResize = () => {
      setIsTallNarrowViewport(window.innerWidth < 640 && window.innerHeight > 700);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTopButton(window.scrollY > Math.max(420, window.innerHeight * 0.75));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderConfirmationModal = () => (
    <AnimatePresence>
      {confirmationModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5000] bg-black/80 backdrop-blur-md`}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-800 p-5 shadow-2xl sm:p-6"
          >
            <h3 className="mb-2 text-xl font-black text-white">{confirmationModal.title}</h3>
            <p className="mb-6 text-sm text-zinc-400 leading-relaxed">{confirmationModal.message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-zinc-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  confirmationModal.onConfirm();
                  setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-black"
              >
                确认
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAuthoringSaveSuccessModal = () => {
    const story = authoringSaveSuccessStory;
    const isPrivate = (story?.meta?.visibility || 'private') === 'private';
    const title = story ? formatBookTitle(story.meta?.title || '未命名作品') : '';
    return (
      <AnimatePresence>
        {story && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${safeModalBackdropClass} z-[5300] bg-black/80 backdrop-blur-md`}
          >
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-emerald-500/25 p-5 shadow-2xl sm:p-6"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">作品已保存</div>
              <h3 className="mt-2 break-words text-2xl font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                更改已经写入作品档案。可以马上分享作品，或回到首页继续查看作品库。
              </p>
              {isPrivate && (
                <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-bold leading-relaxed text-amber-100/80">
                  当前作品仍是私人状态；点击分享时会先改为“非公开链接”，这样收到链接的人才能阅读，但作品不会出现在公开列表。
                </p>
              )}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleShareSavedAuthoringStory}
                  disabled={isSharing}
                  className={semanticButtonClass('primary', { fullWidth: true })}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  分享作品
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthoringSaveSuccessStory(null);
                    setAuthoringStoryId(null);
                    setAuthoringCartridge(null);
                    resetToHome();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={semanticButtonClass('secondary', { fullWidth: true })}
                >
                  <BookOpen className="h-4 w-4" />
                  回到首页
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAuthoringSaveSuccessStory(null)}
                className={`${semanticButtonClass('ghost', { fullWidth: true })} mt-3`}
              >
                继续编辑
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderResumePromptModal = () => (
    <AnimatePresence>
      {pendingProgressToLoad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5000] bg-black/90 backdrop-blur-lg`}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2.5rem] border border-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
              <RefreshCcw className="h-8 w-8" />
            </div>
            <h3 className="mb-3 text-2xl font-black text-white">检测到现有进度</h3>
            <p className="mb-8 text-zinc-400 leading-relaxed">
              您之前在这个故事中有尚未完成的干涉。是否要继承上次的进度继续游玩？
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => resumeStoryPlay(pendingProgressToLoad.id, pendingProgressToLoad.data)}
                className="w-full rounded-2xl bg-white py-4 text-sm font-black text-black shadow-lg shadow-white/5"
              >
                继承并继续
              </button>
              <button
                type="button"
                onClick={() => { void startFreshFromPendingProgress(); }}
                className="w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-zinc-400"
              >
                开始新干涉
              </button>
              <button
                type="button"
                onClick={() => setPendingProgressToLoad(null)}
                className="w-full py-2 text-xs font-medium text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                暂不处理
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderSequelInheritanceModal = () => (
    <AnimatePresence>
      {pendingSequelInheritance && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5050] bg-black/85 backdrop-blur-lg`}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6"
          >
            <div className="mb-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">续作继承</div>
              <h3 className="mt-2 text-2xl font-black text-white">选择要继承的前作命运线</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                找到多条符合前置条件的记录。选择其中一条后，续作第一章会根据该记录做开场调节，之后再回到本作的既定轨道。
              </p>
            </div>
            <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1">
              {pendingSequelInheritance.records.map((record) => (
                <button
                  key={record.runId}
                  type="button"
                  onClick={() => {
                    const pending = pendingSequelInheritance;
                    setPendingSequelInheritance(null);
                    void startSequelWithInheritedRecord(pending.storyId, pending.cartridge, pending.progressData, record, pending.requirement);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:border-indigo-400/45 hover:bg-indigo-500/10 active:scale-[0.99]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="font-black text-zinc-100">{inheritedEndingDisplayLabel(record, pendingSequelInheritance.requirement)}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${record.sourceType === 'archived' ? 'bg-amber-500/15 text-amber-200' : 'bg-zinc-800 text-zinc-400'}`}>
                        {record.sourceType === 'archived' ? '收藏命运' : '自动记录'}
                      </span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {record.completedAt ? new Date(record.completedAt).toLocaleString() : '完成记录'}
                    </div>
                  </div>
                  {record.unlockedBranches.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.unlockedBranches.slice(0, 5).map((branch) => (
                        <span key={branch.id} className="rounded-full bg-indigo-500/12 px-2.5 py-1 text-[11px] font-black text-indigo-100">
                          {branch.name || branch.id}
                        </span>
                      ))}
                    </div>
                  )}
                  {record.storyConclusion && (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">{record.storyConclusion}</p>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setPendingSequelInheritance(null)} className={semanticButtonClass('ghost', { fullWidth: true })}>
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = pendingSequelInheritance;
                  setPendingSequelInheritance(null);
                  void startNewStoryPlay(pending.storyId, pending.cartridge, pending.progressData);
                }}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                使用标准开场
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderLeaveGameModal = () => (
    <AnimatePresence>
      {showLeaveGameModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5000] bg-black/80 backdrop-blur-md`}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2.5rem] border border-zinc-800 p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h3 className="mb-3 text-2xl font-black text-white">确定要离开吗？</h3>
            <p className="mb-8 text-zinc-400 leading-relaxed">
              当前干涉尚未保存。离开游玩页后，未保存的游玩进度将会丢失。
            </p>
            <div className="flex flex-col gap-3">
              {interventionsLeft > 0 && (
                <button
                  type="button"
                  onClick={() => resetGame({ discardCloudProgress: true })}
                  className="w-full rounded-2xl bg-rose-500 py-4 text-sm font-black text-white shadow-lg shadow-rose-500/20"
                >
                  放弃干涉并返回
                </button>
              )}
              {interventionsLeft < 3 && interventionsLeft > 0 && (
                <button
                  type="button"
                  onClick={handleSaveProgressAndReturn}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-600/20"
                >
                  保存进度并返回
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveWorkAndReturn}
                className="w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20"
              >
                收藏命运并返回
              </button>
              <button
                type="button"
                onClick={() => resetGame({ discardCloudProgress: true })}
                className="w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-zinc-400"
              >
                确认返回
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveGameModal(false)}
                className="mt-2 w-full py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300"
              >
                继续游玩
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderBranchUnlockModal = () => (
    <AnimatePresence>
      {branchUnlockNotice && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5200] bg-black/75 backdrop-blur-md`}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-indigo-500/30 p-5 text-center shadow-2xl sm:p-7"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-indigo-300">支线解锁</div>
            <h3 className="text-2xl font-black text-white">{branchUnlockNotice.name || '新的命运支线'}</h3>
            {(branchUnlockNotice.desc || branchUnlockNotice.hint) && (
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                {branchUnlockNotice.desc || branchUnlockNotice.hint}
              </p>
            )}
            <button
              type="button"
              onClick={() => setBranchUnlockNotice(null)}
              className={`${semanticButtonClass('primary', { fullWidth: true })} mt-7`}
            >
              <Check className="h-4 w-4" />
              继续阅读
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderInterventionStatusNotice = () => (
    <AnimatePresence>
      {interventionStatusNotice && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5250] bg-black/65 backdrop-blur-md`}
          onClick={() => setInterventionStatusNotice(null)}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.96 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">命运涟漪</div>
            {interventionStatusNotice.updates.length > 0 ? (
              <>
                <h3 className="mt-2 text-2xl font-black text-white">众人的命运因干涉而有了变化...</h3>
                <div className="mt-5 grid gap-3">
                  {interventionStatusNotice.updates.map((update) => (
                    <div key={update.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-zinc-100">{update.name}</div>
                        <div className={`rounded-full px-2.5 py-1 text-[11px] font-black ${update.isDead ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {update.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="mt-2 text-2xl font-black text-white">干涉的涟漪似乎没能碰触到众人...</h3>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  这次变化更多停留在情节与命运走向之中，角色状态暂未出现可记录的改变。
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => setInterventionStatusNotice(null)}
              className={`${semanticButtonClass('primary', { fullWidth: true })} mt-7`}
            >
              <Check className="h-4 w-4" />
              关闭
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const getCurrentBranchExplorationStats = () => {
    const total = (blueprint?.branches || []).length;
    const runById = new Map<string, any>();
    (unlockedBranches || []).forEach((branch: any) => {
      const id = String(branch?.id || branch?.name || '');
      if (id) runById.set(id, branch);
    });
    const historicalById = new Map<string, any>();
    (historicallyUnlockedBranches || []).forEach((branch: any) => {
      const id = String(branch?.id || branch?.name || '');
      if (id) historicalById.set(id, branch);
    });
    runById.forEach((branch, id) => historicalById.set(id, branch));
    return {
      total,
      runUnlocked: Array.from(runById.values()),
      historicalUnlockedCount: historicalById.size,
    };
  };

  const renderSummaryModal = () => {
    const domain = endingDomainFromValue(endingValue);
    const singleEnding = isSingleEndingStory(blueprint);
    const branchStats = getCurrentBranchExplorationStats();
    return (
    <AnimatePresence>
      {showSummaryModal && storyConclusion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5200] bg-black/75 backdrop-blur-md`}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-amber-500/25 p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-amber-300">命运结算</div>
                <h3 className="text-3xl font-black text-white">最终命运总结</h3>
              </div>
              <button type="button" onClick={() => setShowSummaryModal(false)} className={semanticIconButtonClass('ghost')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {singleEnding && (
              <div className="mb-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm font-black text-indigo-100">
                {tr('当前走向：唯一走向', 'Current path: Fixed-ending path')}
              </div>
            )}
            {!singleEnding && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-black ${endingDomainToneClass(domain)}`}>
              当前结局归属：{endingDomainUserLabel(domain)}
            </div>
            )}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">本次解锁</div>
                <div className="mt-1 text-2xl font-black text-white">{branchStats.runUnlocked.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">解锁统计</div>
                <div className="mt-1 text-2xl font-black text-white">{branchStats.historicalUnlockedCount}/{branchStats.total}</div>
              </div>
            </div>
            {branchStats.runUnlocked.length > 0 && (
              <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">本次触及支线</div>
                <div className="flex flex-wrap gap-2">
                  {branchStats.runUnlocked.map((branch: any) => (
                    <span key={branch.id || branch.name} className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-black text-indigo-200">
                      {branch.name || '未命名支线'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-lg font-medium leading-relaxed text-amber-100">
              {String(storyConclusion || '').split('\n').filter(Boolean).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setShowSummaryModal(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
                <BookOpen className="h-4 w-4" />
                回去阅读完整故事
              </button>
              <button type="button" onClick={handleShareStory} disabled={isSharing} className={semanticButtonClass('primary', { fullWidth: true })}>
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                分享故事
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    );
  };

  const getStoryStats = (story: any) => {
    const isLiked = hasStoryCardAction('like', story);
    const isFavorited = hasStoryCardAction('favorite', story);
    const singleEnding = isSingleEndingStory(story);
    const stats = [
      { key: 'like', label: '点赞', activeLabel: '已点赞', value: getStoryLikeCount(story), icon: Heart, active: isLiked, tone: 'like' },
      { key: 'favorite', label: '收藏', activeLabel: '已收藏', value: getStoryFavoriteCount(story), icon: Bookmark, active: isFavorited, tone: 'favorite' },
      { key: 'share', label: '分享', value: getStoryShareCount(story), icon: ExternalLink },
      { key: 'intervention', label: '干涉', value: getStoryInterventionCount(story), icon: Sparkles },
      { key: 'branches', label: '支线', value: `${getStoryUnlockedBranchCount(story)}/${getStoryBranchCount(story) || 0}`, icon: GitBranch },
      { key: 'endings', label: '结局', value: `${getStoryUnlockedEndingCount(story)}/${getStoryEndingCount(story) || 0}`, icon: Trophy },
      { key: 'words', label: '均字', detailLabel: '均字', value: getStoryAverageChapterWords(story) || '未知', valueSuffix: ' 字', icon: BookOpen },
    ];
    return singleEnding
      ? stats.map((stat) => stat.key === 'endings' ? { ...stat, label: '唯一', value: getStoryEndingCount(story) || 1 } : stat)
      : stats;
  };

  const renderStoryStats = (
    story: any,
    variant: 'card' | 'detail' | 'compact-row',
    actions?: {
      storyId?: string;
      onLike?: () => void;
      onFavorite?: () => void;
      onShare?: () => void;
    }
  ) => {
    const stats = getStoryStats(story);
    if (variant === 'compact-row') {
      return (
        <div className="story-compact-stats-row flex flex-wrap gap-x-3.5 gap-y-1.5 py-1">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
                disabled={!onClick}
                data-active={stat.active ? 'true' : undefined}
                data-tone={stat.tone}
                className={`story-compact-stat flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-95 disabled:pointer-events-none ${
                  stat.active && stat.tone === 'like'
                    ? 'text-pink-400'
                    : stat.active && stat.tone === 'favorite'
                    ? 'text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.active ? 'fill-current' : ''}`} />
                <span className="font-heading tracking-wide">{stat.value}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (variant === 'card') {
      return (
        <div className="story-card-stat-list">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
                disabled={!onClick}
                data-active={stat.active ? 'true' : undefined}
                data-tone={stat.tone}
                className="story-card-stat text-left transition-colors disabled:cursor-default"
              >
                <div className="story-card-stat-label">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.active ? 'fill-current' : ''}`} />
                  <span className="truncate">{stat.active ? stat.activeLabel || stat.label : stat.label}</span>
                </div>
                <div className="story-card-stat-value">{stat.value}</div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="story-detail-stat-grid sm:grid-cols-1">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isAction = stat.key === 'like' || stat.key === 'favorite' || stat.key === 'share';
          const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
          const content = (
            <>
              <div className={`story-detail-stat-label transition-colors ${stat.active && stat.tone === 'like' ? 'text-pink-300' : stat.active && stat.tone === 'favorite' ? 'text-amber-300' : ''}`}>
                {stat.active ? stat.activeLabel || stat.label : stat.detailLabel || stat.label}
                <Icon className={`h-3.5 w-3.5 transition-transform ${stat.active ? 'scale-110 fill-current' : ''}`} />
              </div>
              <div className="story-detail-stat-value">{stat.value}{stat.valueSuffix && stat.value !== '未知' ? stat.valueSuffix : ''}</div>
            </>
          );

          if (isAction && onClick) {
            return (
              <button
                key={stat.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
                data-active={stat.active ? 'true' : undefined}
                data-tone={stat.tone}
                className="story-detail-stat group text-left transition-all active:scale-[0.98]"
              >
                {content}
              </button>
            );
          }

          return (
            <div key={stat.key} className="story-detail-stat">
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStoryBiasBar = (story: any) => {
    if (isSingleEndingStory(story)) {
      return (
        <div className="story-bias-bar story-bias-single" aria-label="唯一走向结构">
          <div className="story-bias-side story-bias-center" data-active="true">
            <span>{tr('唯一走向', 'Fixed-ending path')}</span>
          </div>
        </div>
      );
    }
    const labels = endingBiasStoryCardLabels(story);
    const left = labels.find((bias) => bias.side === 'left');
    const right = labels.find((bias) => bias.side === 'right');
    if (!left && !right) return null;
    return (
      <div className="story-bias-bar" aria-label="作品结局倾向">
        <div className="story-bias-side story-bias-left" data-active={left?.active ? 'true' : undefined}>
          <span>{left?.label || '左域'}</span>
          <strong>{left?.value || '普通'}</strong>
        </div>
        <div className="story-bias-divider" />
        <div className="story-bias-side story-bias-right" data-active={right?.active ? 'true' : undefined}>
          <strong>{right?.value || '普通'}</strong>
          <span>{right?.label || '右域'}</span>
        </div>
      </div>
    );
  };

  const renderStoryCard = (story: any, isPublic: boolean) => {
    const coverUrl = getStoryCoverUrl(story);
    const tags = getStoryTags(story);
    const storyId = story?.id || story?.storyId || story?.sourceStoryId;
    const isLiked = hasStoryCardAction('like', story);
    const isFavorited = hasStoryCardAction('favorite', story);
    const sequelRequirement = getSequelRequirementFromMeta(story);
    return (
      <motion.div
        key={storyId || story.id}
        whileHover={{ y: -4, scale: 1.01 }}
        onClick={() => setStoryDetailStory(story)}
        className={`story-library-card group p-4 transition-all cursor-pointer ${
          isLiked ? 'ring-1 ring-pink-500/18' : isFavorited ? 'ring-1 ring-amber-500/18' : ''
        }`}
      >
        <div className="relative flex gap-4">
          <div className="w-28 shrink-0 sm:w-32">
            <button type="button" onClick={(e) => { e.stopPropagation(); setStoryDetailStory(story); }} className="story-library-cover h-28 w-28 cursor-pointer transition-all hover:ring-2 hover:ring-indigo-400/70 hover:ring-offset-2 hover:ring-offset-zinc-950 sm:h-32 sm:w-32">
              {coverUrl ? (
                <img src={coverUrl} alt={`${formatBookTitle(getStoryTitle(story))} 封面`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  3T NOVEL
                </div>
              )}
            </button>
            {renderStoryStats(story, 'card', {
              storyId,
              onLike: () => handleStoryInteraction('like', storyId, story),
              onFavorite: () => handleStoryInteraction('favorite', storyId, story),
              onShare: () => void shareStoryCardWithFeedback(story),
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {renderStoryBiasBar(story)}
            <h3 className="mb-1 whitespace-normal break-words text-[1.45rem] font-black leading-tight text-white transition-colors group-hover:text-indigo-200 sm:text-2xl">
              {formatBookTitle(getStoryTitle(story))}
            </h3>
            <div className="mb-2 text-sm font-bold text-zinc-400/85">
              <AuthorNameButton authorId={story.authorId || story.meta?.authorId} authorName={getStoryAuthorName(story)} />
            </div>
            {/* Middle zone: flexes to fill remaining space, shrinks when needed */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <p className="story-library-desc-fade mb-2 flex-1 text-[0.98rem] leading-relaxed text-zinc-300/85 transition-colors group-hover:text-zinc-200">
                {getStoryMainAxis(story)}
              </p>
              {sequelRequirement && (
                <div className="mb-2 shrink-0 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
                  续作：需完成前作条件
                </div>
              )}
            </div>
            <div className="mb-3 flex min-w-0 shrink-0 flex-wrap gap-1.5">
              {(tags.length > 0 ? tags.slice(0, 3) : ['未标签']).map((tag: string) => (
                <span key={tag} className="rounded-lg border border-indigo-400/15 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-black text-indigo-200">
                  {tag}
                </span>
              ))}
            </div>
            <div className="shrink-0 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); setStoryDetailStory(story); }} className={`${semanticButtonClass('secondary', { fullWidth: true, compact: true })} text-sm`}>
                <BookOpen className="h-4 w-4" />
                {t('library.details')}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); startStoryPlay(story.id); }} className={`${semanticButtonClass('primary', { fullWidth: true, compact: true })} text-sm`}>
                <Sparkles className="h-4 w-4" />
                {t('library.intervene')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStoryDetailModal = () => {
    const coverUrl = storyDetailStory ? getStoryCoverUrl(storyDetailStory) : '';
    const tags = storyDetailStory ? getStoryTags(storyDetailStory) : [];
    const title = storyDetailStory ? formatBookTitle(getStoryTitle(storyDetailStory)) : '';
    const detailStoryId = storyDetailStory?.id || storyDetailStory?.storyId || storyDetailStory?.sourceStoryId;
    const detailSequelRequirement = storyDetailStory ? getSequelRequirementFromMeta(storyDetailStory) : null;
    const handlePlayFromDetail = () => {
      const targetStoryId = detailStoryId;
      if (!targetStoryId) return;
      setStoryDetailStory(null);
      void startStoryPlay(targetStoryId);
    };
    const handleShareFromDetail = async () => {
      if (!storyDetailStory) return;
      try {
        setIsSharing(true);
        setGlobalLoadingMessage(isEnglish ? 'Preparing story share...' : '正在准备分享作品...');
        setGlobalLoadingDetail(isEnglish ? 'Creating the story link and opening the system share sheet.' : '正在生成作品链接，并尝试调用系统分享。');
        await shareOriginalStoryByCard(storyDetailStory);
      } catch (error: any) {
        console.error(error);
        showError(error?.message || '分享失败。');
      } finally {
        setIsSharing(false);
        setGlobalLoadingMessage(null);
        setGlobalLoadingDetail(null);
      }
    };
    const handleAdminDeleteFromDetail = () => {
      if (!isAdminUser || !detailStoryId) return;
      setStoryDetailStory(null);
      setConfirmationModal({
        isOpen: true,
        title: '删除作品',
        message: `确认删除《${stripBookTitle(title)}》吗？管理员删除会移除这部正式作品，建议只在违规或明显错误时使用。`,
        onConfirm: () => {
          void (async () => {
            try {
              setGlobalLoadingMessage(isEnglish ? 'Deleting story...' : '正在删除作品...');
              await deleteStoryCartridge(db as any, detailStoryId);
              setPublicStories((prev) => prev.filter((story: any) => story.id !== detailStoryId));
              setMyStories((prev) => prev.filter((story: any) => story.id !== detailStoryId));
              setMySharedStories((prev) => prev.filter((story: any) => story.sourceStoryId !== detailStoryId && story.id !== detailStoryId));
              setStoryDetailStory(null);
              showError('作品已删除。');
            } catch (error: any) {
              console.error(error);
              showError(error?.message || '删除作品失败。');
            } finally {
              setGlobalLoadingMessage(null);
            }
          })();
        },
      });
    };

    return (
      <AnimatePresence>
        {storyDetailStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5400] bg-black/70 backdrop-blur-md`}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height relative mt-[env(safe-area-inset-top)] w-full max-w-3xl overflow-y-auto rounded-[2rem] p-5 backdrop-blur-xl sm:p-7"
          >
            <button
              type="button"
              onClick={() => setStoryDetailStory(null)}
              aria-label="关闭作品详情"
              className={`${semanticIconButtonClass('ghost')} absolute right-4 top-4 z-10`}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <div className="aspect-square overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950 shadow-xl">
                  {coverUrl ? (
                    <img src={coverUrl} alt={`${title} 封面`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-5 text-center text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                      3T NOVEL
                    </div>
                  )}
                </div>
                {renderStoryStats(storyDetailStory, 'detail', {
                  storyId: detailStoryId,
                  onLike: () => handleStoryInteraction('like', detailStoryId, storyDetailStory),
                  onFavorite: () => handleStoryInteraction('favorite', detailStoryId, storyDetailStory),
                  onShare: handleShareFromDetail,
                })}
              </div>

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(tags.length > 0 ? tags : ['未标签']).map((tag: string) => (
                    <span key={tag} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-black text-indigo-300">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="break-words text-3xl font-black leading-tight text-white">{title}</h3>
                <div className="mt-2 text-sm font-bold text-zinc-500">
                  <AuthorNameButton authorId={storyDetailStory.authorId || storyDetailStory.meta?.authorId} authorName={getStoryAuthorName(storyDetailStory)} />
                </div>
                <div className="mt-5 max-h-[40vh] overflow-y-auto rounded-3xl border border-zinc-800/60 bg-zinc-900/25 p-4 text-base leading-relaxed text-zinc-300">
                  {getStoryMainAxis(storyDetailStory) || '这部作品暂时还没有填写完整介绍。'}
                </div>
                {detailSequelRequirement && (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
                    <div className="font-black">续作前置条件</div>
                    <p className="mt-1 text-amber-100/80">
                      干涉前需先完成《{stripBookTitle(detailSequelRequirement.sourceTitle || '前作')}》的指定结局与支线。
                    </p>
                  </div>
                )}
                <div className="mt-5 grid gap-3">
                  <button type="button" onClick={handlePlayFromDetail} className={semanticButtonClass('primary', { fullWidth: true })}>
                    <Sparkles className="h-4 w-4" />
                    {t('library.intervene')}
                  </button>
                  {isAdminUser && detailStoryId && (
                    <button type="button" onClick={handleAdminDeleteFromDetail} className={semanticButtonClass('danger', { fullWidth: true })}>
                      <Trash2 className="h-4 w-4" />
                      管理员删除作品
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleShareFromDetail} disabled={isSharing} className={semanticButtonClass('secondary', { fullWidth: true })}>
                      {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      分享作品
                    </button>
                    <button type="button" onClick={() => setStoryDetailStory(null)} className={semanticButtonClass('ghost', { fullWidth: true })}>
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderSequelGateModal = () => (
    <AnimatePresence>
      {sequelGateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5600] bg-black/70 backdrop-blur-md`}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] p-6"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/15 p-3 text-amber-200">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">续作尚未解锁</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  这部续作需要先在《{stripBookTitle(sequelGateModal.sourceTitle || '前作')}》完成指定前置情节，才可继承记录并干涉命运。
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              {sequelGateModal.missingEnding && (
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">需要结局</div>
                  <div className="mt-1 text-sm font-bold text-zinc-200">{sequelGateModal.missingEnding.name}</div>
                </div>
              )}
              {sequelGateModal.missingBranches.length > 0 && (
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">需要支线</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sequelGateModal.missingBranches.map((branch) => (
                      <span key={branch.id} className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-black text-indigo-100">
                        {branch.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  const sourceStoryId = sequelGateModal.sourceStoryId;
                  if (!sourceStoryId) return;
                  setSequelGateModal(null);
                  void startStoryPlay(sourceStoryId);
                }}
                disabled={!sequelGateModal.sourceStoryId}
                className={semanticButtonClass('primary', { fullWidth: true })}
              >
                前往前作
              </button>
              <button
                type="button"
                onClick={() => {
                  const sourceStory = findStoryListItemById(sequelGateModal.sourceStoryId);
                  if (sourceStory) setStoryDetailStory(sourceStory);
                  setSequelGateModal(null);
                }}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                查看详情
              </button>
              <button type="button" onClick={() => setSequelGateModal(null)} className={semanticButtonClass('ghost', { fullWidth: true })}>
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const getVisibleStoryLibraryItems = () => {
    let source = storyLibraryTab === 'mine' ? myStories : publicStories;
    const keyword = storyLibrarySearch.trim().toLowerCase();
    return [...source]
      .filter((story: any) => {
        if (!storyMatchesLanguage(story, appLanguage)) return false;
        if (storyLibraryTab === 'mine' && storyLibraryVisibilityFilter !== 'all' && story.visibility !== storyLibraryVisibilityFilter) return false;
        if (!keyword) return true;
        const haystack = `${getStoryTitle(story)}\n${getStoryAuthorName(story)}\n${getStoryMainAxis(story)}\n${getStoryTags(story).join(' ')}`.toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a: any, b: any) => {
        if (storyLibrarySort === 'likes') return getStoryLikeCount(b) - getStoryLikeCount(a);
        if (storyLibrarySort === 'interventions') return getStoryInterventionCount(b) - getStoryInterventionCount(a);
        if (storyLibrarySort === 'favorites') return getStoryFavoriteCount(b) - getStoryFavoriteCount(a);
        if (storyLibrarySort === 'shares') return getStoryShareCount(b) - getStoryShareCount(a);
        if (storyLibrarySort === 'words') return getStoryAverageChapterWords(b) - getStoryAverageChapterWords(a);
        return getStoryUpdatedMs(b) - getStoryUpdatedMs(a);
      });
  };

  const handleStoryLibrarySortChange = (nextSort: StoryLibrarySort) => {
    setStoryLibrarySort(nextSort);
    if (storyLibraryTab === 'public') {
      void refreshStories({ force: true, publicSort: nextSort });
    }
  };

  const renderStorySelectView = () => {
    const visibleStories = getVisibleStoryLibraryItems();
    const languagePublicCount = publicStories.filter((story) => storyMatchesLanguage(story, appLanguage)).length;
    const languageMineCount = myStories.filter((story) => storyMatchesLanguage(story, appLanguage)).length;
    return (
    <div className="story-library-page mx-auto max-w-7xl px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(3rem,calc(env(safe-area-inset-top)+3rem))] sm:px-6 lg:px-8">
      <div className="story-library-hero relative mb-10 p-2 sm:p-4 lg:p-6">
        <div className="max-w-3xl">
          <h2 className="story-library-title text-4xl font-black leading-[1.15] sm:text-5xl lg:text-6xl">
            {t('library.titleA')}<br />
            <span className="story-library-title-accent">{t('library.titleB')}</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-zinc-400 sm:text-lg">
            {t('library.subtitle')}
          </p>
        </div>
      </div>

      {user?.isAnonymous && (
        <div className="mb-10 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="mb-4">
            <div className="text-sm font-black text-amber-100">注册成用户</div>
              <div className="mt-1 text-xs leading-relaxed text-amber-100/70">
                当前游客记录会保留在同一个账号下，注册后可在其他设备继续游玩和查看作品。
              </div>
              <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-50/80">
                {GUEST_RETENTION_NOTICE}
              </div>
            </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="邮箱"
              className="rounded-xl border border-amber-500/20 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-400"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="密码（至少 6 位）"
              className="rounded-xl border border-amber-500/20 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleEmailPasswordLogin}
              disabled={isLoggingIn}
              className={semanticButtonClass('primary', { compact: true })}
            >
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              注册
            </button>
          </div>
          {!isIosDevice() && (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`${semanticButtonClass('secondary', { compact: true })} mt-3`}
            >
              <LogIn className="h-4 w-4" />
              用 Google 绑定当前游客记录
            </button>
          )}
        </div>
      )}

      <section className="space-y-5">
        <div className="story-library-toolbar flex flex-col gap-4 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="story-library-tabbar">
            {[
              { id: 'public', label: t('library.publicWorks'), count: languagePublicCount },
              { id: 'mine', label: t('library.myWorks'), count: languageMineCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStoryLibraryTab(tab.id as 'public' | 'mine')}
                data-active={storyLibraryTab === tab.id ? 'true' : undefined}
                className="story-library-tab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                {tab.label} <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="search"
              value={storyLibrarySearch}
              onChange={(event) => setStoryLibrarySearch(event.target.value)}
              placeholder={isEnglish ? 'Search title, author, tags, or premise' : '搜索标题、作者、标签或主轴'}
              className="story-library-control min-w-0 px-3 py-2 text-sm sm:w-72"
            />
            {storyLibraryTab === 'mine' && (
              <select
                value={storyLibraryVisibilityFilter}
                onChange={(event) => setStoryLibraryVisibilityFilter(event.target.value as any)}
                className="story-library-control px-3 py-2 text-sm"
              >
                <option value="all">{isEnglish ? 'All visibility' : '全部权限'}</option>
                <option value="private">{isEnglish ? 'Private' : '私密'}</option>
                <option value="public">{isEnglish ? 'Public' : '公开'}</option>
                <option value="unlisted">{isEnglish ? 'Unlisted link' : '非公开链接'}</option>
              </select>
            )}
            <select
              value={storyLibrarySort}
              onChange={(event) => handleStoryLibrarySortChange(event.target.value as StoryLibrarySort)}
              className="story-library-control px-3 py-2 text-sm"
            >
              <option value="updated">{isEnglish ? 'Recently updated' : '最近更新'}</option>
              <option value="interventions">{isEnglish ? 'Most intervened' : '干涉最多'}</option>
              <option value="likes">{isEnglish ? 'Most liked' : '点赞最多'}</option>
              <option value="favorites">{isEnglish ? 'Most favorited' : '收藏最多'}</option>
              <option value="shares">{isEnglish ? 'Most shared' : '分享最多'}</option>
              <option value="words">{isEnglish ? 'Avg. words' : '平均字数'}</option>
            </select>
            <button
              type="button"
              onClick={() => refreshStories({ force: true })}
              disabled={isLoadingStories}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              <RefreshCcw className={`h-4 w-4 ${isLoadingStories ? 'animate-spin' : ''}`} />
              {isEnglish ? 'Refresh' : '刷新'}
            </button>
          </div>
        </div>
        {isLoadingStories && visibleStories.length === 0 ? (
          <ListSkeleton count={6} />
        ) : storyListLoadError && visibleStories.length === 0 ? (
          <InlineSyncState
            tone="error"
            title={isEnglish ? 'Story list could not sync' : '作品列表暂时无法同步'}
            detail={storyListLoadError}
            actionLabel={isEnglish ? 'Reload library' : '重新读取作品库'}
            onAction={() => refreshStories({ force: true })}
          />
        ) : visibleStories.length === 0 ? (
          <InlineSyncState
            tone="empty"
            title={isEnglish ? 'No matching stories' : '没有符合条件的作品'}
            detail={isEnglish ? 'Try changing the search, filters, or sorting.' : '可以调整搜索、筛选或排序条件后再试。'}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStories.map((story) => renderStoryCard(story, storyLibraryTab === 'public'))}
          </div>
        )}
      </section>

      <div className="hidden">
        {myStories.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">我的创作</h3>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {myStories.map(s => renderStoryCard(s, false))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">最新作品</h3>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          {isLoadingStories ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-700" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {publicStories.map(s => renderStoryCard(s, true))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
  };

  const renderArchiveView = () => {
    const keyword = archiveSearch.trim().toLowerCase();
    const archiveStories = Array.isArray(mySharedStories) ? mySharedStories.filter(Boolean) : [];
    const archiveSegment = storyListSyncState?.archive || { status: 'idle' as SyncStatus };
    const matchesKeyword = (story: any) => {
      if (!keyword) return true;
      const haystack = `${story.title || ''}\n${story.main_axis || ''}`.toLowerCase();
      return haystack.includes(keyword);
    };

    const favoriteStories = archiveStories.filter(
      (story: any) => story.archiveKind === 'favorite' && matchesKeyword(story)
    );
    const savedStories = archiveStories.filter((story: any) => {
      if (story.archiveKind === 'favorite') return false;
      if (archiveFilter !== 'all' && story.visibility !== archiveFilter) return false;
      return matchesKeyword(story);
    });
    const visibleFollowedAuthors = followedAuthors.filter((author) => {
      if (!keyword) return true;
      return `${author.authorName}\n${author.authorId}`.toLowerCase().includes(keyword);
    });
    const isArchiveSyncing = archiveSegment.status === 'loading' || archiveSegment.status === 'syncing';

    const handleUnfollowFromArchive = async (authorId: string) => {
      if (!db || !user) return;
      try {
        setFollowedAuthors((prev) => prev.filter((author) => author.authorId !== authorId));
        await unfollowAuthor(db as any, authorId);
        if (authorProfileTarget?.authorId === authorId) setAuthorProfileFollowing(false);
        showError('已取消追踪作者。');
      } catch (error: any) {
        console.error(error);
        showError(error?.message || '取消追踪失败。');
        void refreshFollowedAuthors();
      }
    };

    const renderFavoriteCard = (story: any) => {
      const isChoosingThis = archiveChoiceStoryId === story.id;
      return (
        <div key={story.id} className="app-card rounded-[1.5rem] p-5 transition-all duration-150">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="line-clamp-2 text-sm font-black text-white leading-snug">{formatBookTitle(story.title)}</div>
            <div className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-1 text-[10px] font-black text-indigo-300">收藏原作</div>
          </div>
          <div className="mb-3 text-[11px] font-bold text-zinc-500">
            <AuthorNameButton prefix="原作者：" authorId={story.originalAuthorId || story.sourceStoryId || story.authorId} authorName={getOriginalAuthorName(story)} />
          </div>
          <div className="line-clamp-3 text-xs leading-relaxed text-zinc-500 mb-4">{story.main_axis || '暂无主轴摘要。'}</div>

          {!isChoosingThis ? (
            <button
              type="button"
              onClick={() => setArchiveChoiceStoryId(story.id)}
              className={semanticButtonClass('secondary', { compact: true })}
            >
              <BookOpen className="h-4 w-4" />
              前往原作
            </button>
          ) : (
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/40 p-3 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-400 mb-2">选择进入方式</div>
              <button
                type="button"
                onClick={() => {
                  setArchiveChoiceStoryId(null);
                  void startStoryPlay(story.sourceStoryId || story.id);
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-indigo-600/90 px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-indigo-500 active:scale-[0.98]"
              >
                <Zap className="h-4 w-4 shrink-0" />
                <div>
                  <div>干涉命运</div>
                  <div className="text-[10px] font-normal text-indigo-200/80">进入游玩页，亲手改写这段故事</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setArchiveChoiceStoryId(null);
                  void openReadonlyStory(story.sourceStoryId || story.id, { allowBack: true, returnTarget: 'ARCHIVE' });
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-left text-sm font-bold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.98]"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <div>
                  <div>观看命运</div>
                  <div className="text-[10px] font-normal text-zinc-500">以只读方式阅读原版故事</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArchiveChoiceStoryId(null)}
                className="w-full rounded-xl px-3 py-1.5 text-center text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                取消
              </button>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={archiveUpdatingIds[story.id]}
              onClick={() => handleDeleteArchiveStory(story)}
              className={semanticButtonClass('danger', { compact: true })}
            >
              <Trash2 className="h-4 w-4" />
              取消收藏
            </button>
            <button
              type="button"
              disabled={isSharing || archiveUpdatingIds[story.id]}
              onClick={() => shareArchiveListStory(story)}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              分享原作
            </button>
          </div>
        </div>
      );
    };

    const visibilityClass = (v: string) =>
      v === 'public'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
        : v === 'unlisted'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
        : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-700';

    const renderSavedCard = (story: any) => (
      <div key={story.id} className="app-card flex flex-col rounded-[1.5rem] p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="line-clamp-2 text-sm font-black text-white leading-snug">{formatBookTitle(story.title)}</div>
          <div className="relative shrink-0">
            <select
              value={story.visibility || 'unlisted'}
              disabled={archiveUpdatingIds[story.id]}
              onChange={(e) => handleArchiveVisibilityChange(story, e.target.value as any)}
              title="点击切换可见范围"
              className={`block w-full appearance-none rounded-full border px-2.5 py-1 pr-6 text-[10px] font-black outline-none transition-colors cursor-pointer text-center ${visibilityClass(story.visibility)}`}
            >
              <option value="unlisted" className="bg-zinc-900 text-zinc-100">非公开链接</option>
              <option value="private" className="bg-zinc-900 text-zinc-100">私人</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1 text-inherit opacity-70">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </div>
          </div>
        </div>
        <div className="mb-3 grid gap-1 text-[11px] font-bold text-zinc-500">
          <div><AuthorNameButton prefix="原作者：" authorId={story.originalAuthorId || story.sourceStoryId || story.authorId} authorName={getOriginalAuthorName(story)} /></div>
          {getIntervenerName(story) && <div>干涉者：{getIntervenerName(story)}</div>}
        </div>
        <div className="line-clamp-3 text-xs leading-relaxed text-zinc-500 flex-1">{story.main_axis || '暂无主轴摘要。'}</div>
        <div className="mt-4 flex gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => openReadonlyStory(story.id, { allowBack: true, returnTarget: 'ARCHIVE' })}
            className={`${semanticButtonClass('secondary', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}
          >
            <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            观看命运
          </button>
          <button
            type="button"
            disabled={isSharing || archiveUpdatingIds[story.id]}
            onClick={() => shareArchiveListStory(story)}
            className={`${semanticButtonClass('secondary', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}
          >
            {isSharing ? <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" /> : <ExternalLink className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
            分享
          </button>
          <button
            type="button"
            disabled={archiveUpdatingIds[story.id]}
            onClick={() => handleDeleteArchiveStory(story)}
            className={`${semanticButtonClass('danger', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            删除
          </button>
        </div>
      </div>
    );

    const renderFollowedAuthorCard = (author: { authorId: string; authorName: string; followedAt: string }) => (
      <div key={author.authorId} className="app-card flex flex-col rounded-[1.5rem] p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">追踪作者</div>
            <div className="mt-1 truncate text-lg font-black text-white">{author.authorName || `游客+${shortUserId(author.authorId)}`}</div>
            <div className="mt-1 text-[11px] font-bold text-zinc-500">追踪于 {new Date(author.followedAt || Date.now()).toLocaleDateString()}</div>
          </div>
          <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 p-2 text-indigo-200">
            <Bell className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openAuthorProfile(author.authorId, author.authorName)}
            className={`${semanticButtonClass('secondary', { compact: true })} min-w-0 justify-center px-2 text-xs`}
          >
            <BookOpen className="h-4 w-4" />
            查看作者作品
          </button>
          <button
            type="button"
            onClick={() => void handleUnfollowFromArchive(author.authorId)}
            className={`${semanticButtonClass('ghost', { compact: true })} min-w-0 justify-center px-2 text-xs`}
          >
            <X className="h-4 w-4" />
            取消追踪
          </button>
        </div>
      </div>
    );

    return (
      <div className="relative mx-auto max-w-6xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
        <AnimatePresence>
          {isArchiveSyncing && archiveStories.length === 0 && (
            <BlockingSyncOverlay
              title={isEnglish ? 'Syncing fate archive' : '正在同步命运收藏馆'}
              detail={isEnglish ? 'If the network is slow, local cache stays available and the list updates when sync finishes.' : '如果网络较慢，会先保留本机缓存，完成后自动更新列表。'}
              zIndexClass="z-[3200]"
            />
          )}
        </AnimatePresence>
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white sm:text-4xl">{t('archive.title')}</h2>
            <p className="mt-2 text-sm text-zinc-500">{t('archive.subtitle')}</p>
          </div>
          <BackNavButton label={archiveReturnTarget === 'PLAYING' ? (isEnglish ? 'Back to play' : '返回游玩页') : (isEnglish ? 'Back to library' : '返回作品库')} onClick={leaveArchiveView} />
        </div>

        <section className="app-card-quiet relative overflow-hidden rounded-[2rem] p-4 sm:p-5">
          {isArchiveSyncing && archiveStories.length > 0 && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs font-bold text-indigo-100/85">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-300" />
              <span>{isEnglish ? 'Syncing archive. The current list stays usable.' : '正在同步收藏馆，当前列表会保持可用。'}</span>
            </div>
          )}
          {archiveSegment.status === 'error' && archiveStories.length > 0 && (
            <div className="mb-5 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100/85">
              <div className="font-black text-amber-100">{isEnglish ? 'Archive sync is not smooth right now' : '收藏馆同步暂时不顺利'}</div>
              <p className="mt-1 text-xs text-amber-100/70">{archiveSegment.error || (isEnglish ? 'Current content is kept. Try refreshing later.' : '已保留当前可用内容，可以稍后刷新重试。')}</p>
            </div>
          )}
          {/* Tab 切换栏 */}
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1 shrink-0">
              {([
                { id: 'favorite', label: t('archive.favoriteTab') },
                { id: 'saved', label: t('archive.savedTab') },
                { id: 'authors', label: isEnglish ? 'Following' : '追踪作者' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setArchiveTab(tab.id as 'favorite' | 'saved' | 'authors'); setArchiveChoiceStoryId(null); }}
                  className={`rounded-xl px-4 py-2 text-sm font-black transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                    archiveTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {tab.label} <span className="ml-1 text-[10px] opacity-70">{tab.id === 'authors' ? followedAuthors.length : archiveStories.filter((s: any) => tab.id === 'favorite' ? s.archiveKind === 'favorite' : s.archiveKind !== 'favorite').length}</span>
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="search"
                  value={archiveSearch}
                  onChange={(event) => { setArchiveSearch(event.target.value); setArchiveChoiceStoryId(null); }}
                  placeholder={isEnglish ? 'Search title or premise' : '搜索标题或主轴内容'}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => archiveTab === 'authors' ? refreshFollowedAuthors() : refreshArchiveStories({ force: true })}
                  disabled={archiveTab === 'authors' ? followedAuthorsLoading : isArchiveSyncing}
                  className={semanticButtonClass('ghost', { compact: true })}
                >
                  <RefreshCcw className={`h-4 w-4 ${(archiveTab === 'authors' ? followedAuthorsLoading : isArchiveSyncing) ? 'animate-spin' : ''}`} />
                  {isEnglish ? 'Refresh archive' : '刷新馆藏'}
                </button>
              </div>
              {archiveTab === 'saved' && (
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'all', label: isEnglish ? 'All' : '全部' },
                    { id: 'unlisted', label: isEnglish ? 'Unlisted link' : '非公开链接' },
                    { id: 'private', label: isEnglish ? 'Private' : '私人' },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setArchiveFilter(option.id as any)}
                      className={archiveFilter === option.id ? semanticButtonClass('primary', { compact: true }) : semanticButtonClass('ghost', { compact: true })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tab 内容 */}
          {archiveSegment.status === 'error' && archiveStories.length === 0 ? (
            <InlineSyncState
              tone="error"
              title={isEnglish ? 'Archive could not sync' : '收藏馆暂时无法同步'}
              detail={archiveSegment.error || (isEnglish ? 'No local cache is available. Reload, or return to the library for now.' : '没有可用的本机缓存。可以重新读取，或先返回作品库继续浏览。')}
              actionLabel={isEnglish ? 'Reload archive' : '重新读取收藏馆'}
              onAction={() => refreshArchiveStories({ force: true })}
            />
          ) : isArchiveSyncing && archiveStories.length === 0 ? (
            <ListSkeleton count={6} />
          ) : archiveTab === 'authors' ? (
            followedAuthorsLoading && visibleFollowedAuthors.length === 0 ? (
              <ListSkeleton count={3} />
            ) : visibleFollowedAuthors.length === 0 ? (
              <InlineSyncState
                tone="empty"
                title={keyword ? (isEnglish ? 'No followed authors match the search' : '没有符合搜索词的追踪作者') : (isEnglish ? 'No followed authors yet' : '还没有追踪任何作者')}
                detail={keyword ? (isEnglish ? 'Try another keyword, or clear the search.' : '换个关键词再试，或清空搜索条件。') : (isEnglish ? 'Open an author profile from an author name, then follow the author to view them here.' : '点击作者名字打开作者档案后，可以追踪作者并在这里集中查看。')}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleFollowedAuthors.map(renderFollowedAuthorCard)}
              </div>
            )
          ) : archiveTab === 'favorite' ? (
            favoriteStories.length === 0 ? (
              <InlineSyncState
                tone="empty"
                title={keyword ? (isEnglish ? 'No favorited originals match the search' : '没有符合搜索词的收藏原作') : (isEnglish ? 'No favorited originals yet' : '还没有收藏任何原作')}
                detail={keyword ? (isEnglish ? 'Try another keyword, or clear the search.' : '换个关键词再试，或清空搜索条件。') : (isEnglish ? 'Tap Favorite while reading to keep the original work here.' : '在游玩页点击「收藏」后，原作会出现在这里。')}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteStories.map(renderFavoriteCard)}
              </div>
            )
          ) : (
            savedStories.length === 0 ? (
              <InlineSyncState
                tone="empty"
                title={keyword || archiveFilter !== 'all' ? (isEnglish ? 'No saved fate lines match the filters' : '没有符合条件的收藏命运') : (isEnglish ? 'No saved fate lines yet' : '还没有收藏任何命运线')}
                detail={keyword || archiveFilter !== 'all' ? (isEnglish ? 'Try changing the search or visibility filter.' : '可以调整搜索或可见性筛选条件。') : (isEnglish ? 'Tap Save Fate while reading to keep the current fate line here.' : '在游玩页点击「收藏命运」后，当前命运线会出现在这里。')}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {savedStories.map(renderSavedCard)}
              </div>
            )
          )}
        </section>
      </div>
    );
  };

  const renderOnboardingGuide = () => (
    <AnimatePresence>
      {showOnboardingGuide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[3600] bg-black/70 backdrop-blur-md`}
          onClick={dismissOnboardingGuide}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-indigo-300/20 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  初次进入
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">欢迎来到命运故事台</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  这里不是普通阅读器：可阅读故事、干涉章节、收藏命运线，也可生成或改编作品。
                </p>
              </div>
              <button type="button" onClick={dismissOnboardingGuide} className={semanticIconButtonClass('ghost')} aria-label="关闭引导">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: '选一篇作品', desc: '从作品库点「干涉命运」进入游玩。' },
                { title: '干涉章节', desc: '每局最多三次，系统会重写相关命运线。' },
                { title: '收藏与分享', desc: '满意的命运可收藏到馆藏，或分享给其他读者。' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="text-sm font-black text-zinc-100">{item.title}</div>
                  <div className="mt-2 text-xs leading-relaxed text-zinc-500">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={dismissOnboardingGuide} className={semanticButtonClass('primary', { fullWidth: true })}>
                {tr('去作品库看看', 'Browse library')}
              </button>
              <button type="button" onClick={startQuickGenerationFromOnboarding} className={semanticButtonClass('secondary', { fullWidth: true })}>
                <Wand2 className="h-4 w-4" />
                {tr('快速生成故事', 'Quick generate')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderPushPermissionPrompt = () => (
    <AnimatePresence>
      {showPushPermissionPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[3550] bg-black/65 backdrop-blur-md`}
          onClick={dismissPushPermissionPrompt}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-indigo-200">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">接收作品动态提醒？</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  开启后，作者更新、作品被点赞收藏、追踪作者发布新作时，可以在手机收到提醒。也可以之后到个人中心的设置里开启。
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={dismissPushPermissionPrompt} className={semanticButtonClass('ghost', { fullWidth: true })}>
                稍后再说
              </button>
              <button type="button" onClick={() => void enablePushNotificationsFromPrompt()} disabled={pushSubscribeBusy} className={semanticButtonClass('primary', { fullWidth: true })}>
                {pushSubscribeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                开启手机通知
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderSeriesWorldView = () => {
    const seriesGenreText = (seriesForm.genreTags || []).join('，');
    const worldBibleDraft = parseEditableJson<Record<string, any>>(seriesWorldBibleText, seriesForm.worldBible || {});
    const baselineRuleDrafts = asSafeArray<any>(worldBibleDraft.baselineRules).length > 0
      ? asSafeArray<any>(worldBibleDraft.baselineRules)
      : asSafeArray<any>(worldBibleDraft.coreRules || worldBibleDraft.ironLaws).map((rule, index) => ({
          id: (rule as any)?.id || `rule_${index + 1}`,
          title: (rule as any)?.title || (rule as any)?.rule || `${tr('世界基准', 'Baseline rule')} ${index + 1}`,
          kind: (rule as any)?.kind || tr('世界', 'World'),
          detail: (rule as any)?.detail || (rule as any)?.rule || String(rule || ''),
        }));
    const characterCardDrafts = asSafeArray<any>(worldBibleDraft.characterPool).length > 0
      ? asSafeArray<any>(worldBibleDraft.characterPool)
      : (asSafeArray<any>(worldBibleDraft.characters).length > 0
          ? asSafeArray<any>(worldBibleDraft.characters)
          : asSafeArray<any>(worldBibleDraft.recurringCharacterSeeds)
        ).map((card, index) => ({
          id: (card as any)?.id || `char_${index + 1}`,
          name: (card as any)?.name || (card as any)?.title || `${tr('角色', 'Character')} ${index + 1}`,
          role: (card as any)?.role || (card as any)?.type || '',
          desc: (card as any)?.desc || (card as any)?.description || (card as any)?.profile || String(card || ''),
          status: (card as any)?.status || '',
        }));
    const plotNoteDrafts = asSafeArray<any>(worldBibleDraft.plotNotes).map(normalizeSeriesPlotMaterial);
    const updateWorldBibleDraft = (patch: Record<string, any>) => {
      setSeriesWorldBibleText(JSON.stringify({ ...worldBibleDraft, ...patch }, null, 2));
    };
    const updateBaselineRuleDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        baselineRules: baselineRuleDrafts.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
      });
    };
    const updateCharacterCardDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        characterPool: characterCardDrafts.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card),
      });
    };
    const updatePlotNoteDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        plotNotes: plotNoteDrafts.map((note, noteIndex) => noteIndex === index ? { ...note, ...patch } : note),
      });
    };
    const organizeSourceLabel = seriesSourceStoryId
      ? tr('提取世界观', 'Extract world setting')
      : tr('生成世界观', 'Generate world setting');
    const isSeriesWorldListPage = gameState === 'SERIES_WORLD_LIST';
    const isSeriesWorldGeneratePage = gameState === 'SERIES_WORLD_GENERATE';
    const isSeriesWorldEditPage = gameState === 'SERIES_WORLD_EDIT';
    const pageTitle = isSeriesWorldListPage
      ? tr('世界观列表', 'World Settings')
      : isSeriesWorldGeneratePage
        ? tr('生成 / 提取世界观设定', 'Generate / Extract World Setting')
        : tr('编辑世界观仓库', 'Edit World Setting Archive');
    const pageDescription = isSeriesWorldListPage
      ? tr('这里集中管理已经保存的世界观设定。选择一个进入编辑；新建或提取请进入生成页。', 'Manage saved world settings here. Choose one to edit, or open the generation page to create/extract a new one.')
      : isSeriesWorldGeneratePage
        ? tr('从基本概况生成全新的世界观仓库，或导入已有作品提取世界基准、角色卡池和情节素材。生成完成后会进入编辑页。', 'Generate a new setting archive from an overview, or import an existing story to extract baseline rules, character cards, and plot material. After generation, the editor opens.')
        : tr('这里只编辑世界观仓库条目。后续生成作品时，再到高级创作设置里选择要套用的世界观设定。', 'Edit archive items here. Later, apply the world setting from Advanced creation when generating a story.');
    return (
      <div className="mx-auto min-h-[100dvh] max-w-6xl px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(5rem,calc(env(safe-area-inset-top)+4rem))] sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <BackNavButton
            label={tr('返回上一页', 'Back')}
            onClick={() => goBack('STORY_SELECT')}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {!isSeriesWorldGeneratePage && (
              <button type="button" onClick={() => navigateTo('SERIES_WORLD_GENERATE')} className={semanticButtonClass('secondary', { compact: true })}>
                <Sparkles className="h-4 w-4" />
                {tr('生成 / 提取', 'Generate / Extract')}
              </button>
            )}
            <button type="button" onClick={() => void loadSeriesWorlds()} className={semanticButtonClass('ghost', { compact: true })}>
              <RefreshCcw className="h-4 w-4" />
              {tr('刷新', 'Refresh')}
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-[2rem] border border-indigo-300/15 bg-indigo-500/10 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
            <GitBranch className="h-3.5 w-3.5" />
            {tr('世界观设定', 'World Settings')}
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{pageTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {pageDescription}
          </p>
        </div>
        {isSeriesWorldGeneratePage && renderInlineHelp('world-generator', '世界观生成与提取指引', '在此页面，你可以让AI自动生成一套全新的世界观蓝图，或者通过提取已有故事的章节来抓取其中的人物设定、世界法则。生成好的世界观可以在后续创建『续作』或『新篇章』故事时在高级设置里套用。')}

        <div className="grid gap-6">
          <section className="space-y-4">
            {isSeriesWorldListPage && (
            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-white">{tr('已保存设定', 'Saved settings')}</div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('这是独立的收录页，只负责查找、进入编辑和删除后的管理。', 'This is a dedicated library page for finding, opening, and managing saved settings.')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigateTo('SERIES_WORLD_GENERATE')} className={semanticButtonClass('primary', { compact: true })}>
                    <Sparkles className="h-4 w-4" />
                    {tr('生成新世界观', 'Create new setting')}
                  </button>
                  <button type="button" onClick={resetSeriesWorldDraft} className={semanticButtonClass('secondary', { compact: true })}>
                    <PenSquare className="h-4 w-4" />
                    {tr('手动建立', 'Manual create')}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seriesWorlds.length === 0 && <div className="rounded-2xl bg-zinc-900/60 p-4 text-sm text-zinc-500 sm:col-span-2 lg:col-span-3">{tr('还没有世界观设定，可以先生成或手动建立一个。', 'No world setting yet. Generate one or create a manual draft first.')}</div>}
                {seriesWorlds.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => {
                      setSelectedSeriesId(series.id);
                      setSeriesForm(series);
                      setSeriesWorldBibleText(JSON.stringify(series.worldBible || {}, null, 2));
                      setSeriesIronLawsText(JSON.stringify(series.ironLaws || [], null, 2));
                      setSeriesFutureDirectionsText(JSON.stringify(series.futureDirections || [], null, 2));
                      navigateTo('SERIES_WORLD_EDIT');
                      void loadContinuityNodesForSeries(series.id);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${selectedSeriesId === series.id ? 'border-indigo-400 bg-indigo-500/15' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}
                  >
                    <div className="text-sm font-black text-white">{series.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{(series.worldBible as any)?.worldview || series.pitch || tr('尚未填写世界观概况', 'No world overview yet')}</div>
                  </button>
                ))}
              </div>
            </div>
            )}

            {isSeriesWorldGeneratePage && (
            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-4">
                <div className="text-lg font-black text-white">{tr('世界观生成', 'World setting generation')}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('填写世界观概况即可生成新设定；如果选择来源作品，则会直接从该作品提取世界观概况、角色卡池、支线和结局素材。', 'Write an overview to generate a new setting. If a source story is selected, the app extracts the overview, character cards, branches, and ending material from that story.')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={seriesForm.title || ''} onChange={(event) => setSeriesForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={tr('世界观设定名称', 'World setting title')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
                <input value={seriesGenreText} onChange={(event) => setSeriesForm((prev) => ({ ...prev, genreTags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }))} placeholder={tr('题材标签，以逗号分隔', 'Genre tags, comma-separated')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <textarea
                value={worldBibleDraft.worldview || ''}
                onChange={(event) => updateWorldBibleDraft({ worldview: event.target.value })}
                placeholder={tr('世界观概况：简单描述这个世界的核心感觉、规则、时代、冲突或创作方向。', 'World overview: briefly describe the world’s feel, rules, era, conflict, or creative direction.')}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('来源作品（可选）', 'Source story (optional)')}</label>
                <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                  {tr('不选择作品时，按上方概况生成世界观；选择作品后，主按钮会改为从该作品提取。', 'Without a story, the button generates from the overview. With a story selected, it extracts from that story.')}
                </p>
                <select
                  value={seriesSourceStoryId}
                  onChange={(event) => setSeriesSourceStoryId(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none"
                >
                  <option value="">{tr('不导入作品，生成全新世界观设定', 'No story import; generate a new world setting')}</option>
                  {myStories.map((story: any) => (
                    <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => void handleGenerateSeriesWorld(seriesSourceStoryId ? 'extract' : 'new')} disabled={seriesGenerating} className={semanticButtonClass('primary', { compact: true, fullWidth: true })}>
                  {seriesGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {organizeSourceLabel}
                </button>
                <button type="button" onClick={resetSeriesWorldDraft} className={semanticButtonClass('secondary', { compact: true, fullWidth: true })}>
                  <PenSquare className="h-4 w-4" />
                  {tr('手动建立空白仓库', 'Create blank archive')}
                </button>
              </div>
            </div>
            )}
          </section>

          <section className="space-y-6">
            {isSeriesWorldEditPage && (
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-black text-white">{tr('世界观设定草稿', 'World Setting Draft')}</div>
                  <div className="mt-1 text-xs text-zinc-500">{tr('所有内容都可以手动编辑，保存后才能用于绑定作品。', 'Everything can be edited manually. Save it before binding stories.')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSeriesId && (
                    <button type="button" onClick={() => handleDeleteSeriesWorld()} disabled={seriesSaving} className={semanticButtonClass('danger', { compact: true })}>
                      <Trash2 className="h-4 w-4" />
                      {tr('删除世界观', 'Delete setting')}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleSaveSeriesWorld()} disabled={seriesSaving} className={semanticButtonClass('primary', { compact: true })}>
                    {seriesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {tr('保存世界观设定', 'Save world setting')}
                  </button>
                </div>
              </div>
              {renderInlineHelp('world-editor', '世界观仓库编辑指引', '在此编辑世界观的关键要素。其中【世界基准规则】是AI创作故事时绝对遵守的铁律（例如：魔法在这个世界上已被禁止）；【角色卡池】存放该世界里登场的主要配角与背景；【故事大纲与素材】能为后续作品提供线索。修改完成后，切记点击最下方的『保存世界观』，才能让改动生效。')}
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={seriesForm.title || ''} onChange={(event) => setSeriesForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={tr('世界观设定名称', 'World setting title')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
                <input value={seriesGenreText} onChange={(event) => setSeriesForm((prev) => ({ ...prev, genreTags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }))} placeholder={tr('题材标签，以逗号分隔', 'Genre tags, comma-separated')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <textarea
                value={worldBibleDraft.worldview || ''}
                onChange={(event) => updateWorldBibleDraft({ worldview: event.target.value })}
                placeholder={tr('世界观概况：简单描述这个世界的核心感觉、规则、时代、冲突或创作方向，用来让 AI 整理下方三类仓库条目。', 'World overview: briefly describe the world’s feel, rules, era, conflict, or creative direction so AI can organize the archive items below.')}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <div className="mt-5 space-y-5">
                <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('世界基准', 'World baseline')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('一条一条记录这个世界允许什么、禁止什么、哪些设定必须被遵守。生成作品时可以按需勾选。', 'Record reusable rules one by one: what is allowed, forbidden, or must be obeyed. They can be selected during generation.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ baselineRules: [...baselineRuleDrafts, { id: `rule_${baselineRuleDrafts.length + 1}`, detail: '', tags: [] }] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增基准', 'Add rule')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {baselineRuleDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-xs leading-relaxed text-zinc-500">
                        {tr('还没有世界基准。可以手动新增，或点击左侧从零生成世界观。', 'No baseline rules yet. Add one manually or generate a world setting from scratch.')}
                      </div>
                    )}
                    {baselineRuleDrafts.map((rule, index) => (
                      <div key={rule.id || index} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">{tr('世界基准', 'Rule')} {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ baselineRules: baselineRuleDrafts.filter((_, ruleIndex) => ruleIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除基准', 'Delete rule')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="hidden">
                          <input
                            value={rule.title || ''}
                            onChange={(event) => updateBaselineRuleDraft(index, { title: event.target.value, id: rule.id || `rule_${index + 1}` })}
                            placeholder={tr('基准标题，例如：王都在第二部前不可陷落', 'Rule title, e.g. The capital cannot fall before Part 2')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            value={rule.kind || ''}
                            onChange={(event) => updateBaselineRuleDraft(index, { kind: event.target.value })}
                            placeholder={tr('类别', 'Kind')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <textarea
                          value={rule.detail || rule.rule || ''}
                          onChange={(event) => updateBaselineRuleDraft(index, { detail: event.target.value })}
                          placeholder={tr('具体说明：这条基准如何限制或保护后续作品生成。', 'Details: how this rule limits or protects later story generation.')}
                          className="min-h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                        />
                        <input
                          value={normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).join('，')}
                          onChange={(event) => updateBaselineRuleDraft(index, { tags: normalizeTagList(event.target.value.split(/[,，]/)), kind: '' })}
                          placeholder={tr('标签，可选，例如：角色限制，时间限制，势力规则', 'Tags, optional: character limit, timeline, faction rule')}
                          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('角色卡池', 'Character pool')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('保存系列内可复用角色。续作默认可以从这里沿用主要角色，不再每次重新发明。', 'Store reusable characters for the series. Sequels can inherit major characters from here by default.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ characterPool: [...characterCardDrafts, createEmptySeriesCharacterCard(characterCardDrafts.length)] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增角色卡', 'Add character')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {characterCardDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-xs leading-relaxed text-zinc-500">
                        {tr('还没有角色卡。可以加入主角、重要配角、势力代表或会贯穿多部作品的角色。', 'No character cards yet. Add protagonists, key supporting characters, faction representatives, or recurring figures.')}
                      </div>
                    )}
                    {characterCardDrafts.map((card, index) => (
                      <div key={card.id || index} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">{tr('角色卡', 'Character')} {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ characterPool: characterCardDrafts.filter((_, cardIndex) => cardIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除角色卡', 'Delete character card')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={card.name || ''}
                            onChange={(event) => updateCharacterCardDraft(index, { name: event.target.value, id: card.id || `char_${index + 1}` })}
                            placeholder={tr('角色名', 'Character name')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            value={card.role || ''}
                            onChange={(event) => updateCharacterCardDraft(index, { role: event.target.value })}
                            placeholder={tr('系列定位，例如：主角/导师/宿敌', 'Series role, e.g. protagonist / mentor / rival')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <textarea
                          value={card.desc || ''}
                          onChange={(event) => updateCharacterCardDraft(index, { desc: event.target.value })}
                          placeholder={tr('角色说明：身份、动机、矛盾点，以及后续作品可如何使用。', 'Profile: identity, motive, contradiction, and how later stories may use this character.')}
                          className="mt-3 min-h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                        />
                        <input
                          value={card.status || ''}
                          onChange={(event) => updateCharacterCardDraft(index, { status: event.target.value })}
                          placeholder={tr('默认状态，例如：仍在王都、失踪、被封印', 'Default status, e.g. in the capital / missing / sealed away')}
                          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('情节素材', 'Plot material')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('记录可复用的伏笔、历史事件、未解谜团或适合未来作品调用的情节素材。', 'Store reusable foreshadowing, historical events, unresolved mysteries, or plot material for future stories.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ plotNotes: [...plotNoteDrafts, createEmptySeriesPlotMaterial(plotNoteDrafts.length)] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增概况', 'Add note')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {plotNoteDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-xs leading-relaxed text-zinc-500">
                        {tr('还没有情节素材。可以记录“某场旧战争”“某个未解预言”“某角色的失踪原因”等。', 'No plot material yet. You can record old wars, unsolved prophecies, missing-character causes, and similar material.')}
                      </div>
                    )}
                    {plotNoteDrafts.map((note, index) => (
                      <div key={note.id || index} className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                          <input
                            value={note.title || ''}
                            onChange={(event) => updatePlotNoteDraft(index, { title: event.target.value, id: note.id || `plot_${index + 1}` })}
                            placeholder={tr('素材标题', 'Material title')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            value={note.tag || ''}
                            onChange={(event) => updatePlotNoteDraft(index, { tag: event.target.value })}
                            placeholder={tr('标签', 'Tag')}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ plotNotes: plotNoteDrafts.filter((_, noteIndex) => noteIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除情节素材', 'Delete plot material')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          value={note.detail || ''}
                          onChange={(event) => updatePlotNoteDraft(index, { detail: event.target.value })}
                          placeholder={tr('情节素材内容', 'Plot material details')}
                          className="min-h-20 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderThemeSelectionView = () => (
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-center px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] text-center lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <BackNavButton label={tr('返回上一页', 'Back')} onClick={() => goBack('STORY_SELECT')} />
        <div className="h-10 w-10" />
      </div>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
          <Wand2 className="h-4 w-4" />
          {tr('命运引擎', 'Fate Engine')}
        </div>
        <h1 className="text-4xl font-black text-white sm:text-5xl">{tr('快速生成故事', 'Quick Story Generation')}</h1>
        <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
          {tr('选择 1 到 4 个主题，或直接输入故事大纲。系统会先生成完整蓝图，再预先写好前 3 章供玩家开始干涉。', 'Choose 1 to 4 tags or enter an outline. The system creates a full blueprint, then writes the first 3 chapters so play can begin quickly.')}
        </p>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-xl rounded-full border border-zinc-800 bg-zinc-950/70 p-1 text-xs font-black">
        {([
          { id: 'quiz' as const, label: appLanguage === 'en-US' ? 'Play by quiz' : '想玩故事' },
          { id: 'advanced' as const, label: appLanguage === 'en-US' ? 'Advanced creation' : '高级创作设置' },
        ]).map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setQuickGenerationMode(mode.id)}
            className={`flex-1 rounded-full px-3 py-2 transition-colors ${quickGenerationMode === mode.id ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {quickGenerationMode === 'quiz' ? (() => {
        const step = QUICK_QUIZ_STEPS[Math.min(quickQuizStepIndex, QUICK_QUIZ_STEPS.length - 1)];
        const selected = asSafeArray<string>(quickQuizAnswers[step.id]);
        const isLastStep = quickQuizStepIndex >= QUICK_QUIZ_STEPS.length - 1;
        return (
          <div className="mx-auto mt-8 w-full max-w-4xl rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-5 text-left shadow-2xl shadow-black/10 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-amber-100">
                  {appLanguage === 'en-US' ? 'Want a surprise?' : '想来点惊喜？'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                  {appLanguage === 'en-US'
                    ? 'Randomly draw every preference layer and start generating immediately.'
                    : '从每一层偏好中随机抽取设定，并直接开始生成故事。'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRandomQuickGeneration}
                className={semanticButtonClass('secondary', { compact: true })}
              >
                <Sparkles className="h-4 w-4" />
                {appLanguage === 'en-US' ? 'Fully random' : '全随机生成'}
              </button>
            </div>
            <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4">
              <button
                type="button"
                onClick={() => setQuickCharacterSeed((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-black text-zinc-100">
                    {appLanguage === 'en-US' ? 'Use a character idea?' : '有想放进故事的人物吗？'}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {appLanguage === 'en-US'
                      ? 'Optional. Add a person, relationship, or character seed for the story to build around.'
                      : '可选。可以填一个人物、关系或人设需求，让故事围绕它自然展开。'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${quickCharacterSeed.enabled ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  {quickCharacterSeed.enabled ? (appLanguage === 'en-US' ? 'On' : '已开启') : (appLanguage === 'en-US' ? 'Skip' : '跳过')}
                </span>
              </button>
              {quickCharacterSeed.enabled && (
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={quickCharacterSeed.name}
                      onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder={appLanguage === 'en-US' ? 'Character name, e.g. my sister' : '人物名称，例如：妹妹'}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
                    />
                    <input
                      value={quickCharacterSeed.role}
                      onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, role: event.target.value }))}
                      placeholder={appLanguage === 'en-US' ? 'Identity or relationship' : '身份或关系，例如：主角的妹妹'}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { value: 'protagonist' as const, label: appLanguage === 'en-US' ? 'Protagonist' : '作为主角' },
                      { value: 'important' as const, label: appLanguage === 'en-US' ? 'Key character' : '重要角色' },
                      { value: 'mystery' as const, label: appLanguage === 'en-US' ? 'Mystery role' : '神秘人物' },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setQuickCharacterSeed((prev) => ({ ...prev, position: option.value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                          quickCharacterSeed.position === option.value
                            ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                            : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={quickCharacterSeed.note}
                    onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder={appLanguage === 'en-US' ? 'Optional note: personality, secret, wish, conflict...' : '可选补充：性格、秘密、愿望、矛盾点……'}
                    className="min-h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                  {appLanguage === 'en-US' ? `Step ${quickQuizStepIndex + 1}/${QUICK_QUIZ_STEPS.length}` : `第 ${quickQuizStepIndex + 1}/${QUICK_QUIZ_STEPS.length} 步`}
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">{quickText(step.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{quickText(step.subtitle)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800 sm:w-40">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${((quickQuizStepIndex + 1) / QUICK_QUIZ_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {step.options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleQuickQuizAnswer(step, option.id)}
                    className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                      active
                        ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{quickText(option.label)}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-indigo-200" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setQuickQuizStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={quickQuizStepIndex === 0}
                className={semanticButtonClass('ghost', { compact: true })}
              >
                <ChevronLeft className="h-4 w-4" />
                {appLanguage === 'en-US' ? 'Previous' : '上一步'}
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setQuickQuizStepIndex((prev) => Math.min(QUICK_QUIZ_STEPS.length - 1, prev + 1))}
                    disabled={selected.length < 1}
                    className={semanticButtonClass('primary', { compact: true })}
                  >
                    {appLanguage === 'en-US' ? 'Next' : '下一步'}
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateBlueprint}
                    disabled={selected.length < 1}
                    className={semanticButtonClass('primary', { compact: true })}
                  >
                    <Sparkles className="h-4 w-4" />
                    {appLanguage === 'en-US' ? 'Generate my story' : '生成想玩的故事'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })() : (
      <>
      <div className="mx-auto mt-8 grid w-full max-w-4xl gap-3 px-4 text-left md:grid-cols-3">
        {QUICK_STORY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyQuickStoryTemplate(template)}
            className="group rounded-[1.5rem] border border-zinc-800 bg-zinc-900/40 p-4 text-left transition-all hover:-translate-y-1 hover:border-indigo-400/50 hover:bg-indigo-500/10 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-black text-zinc-100 group-hover:text-white">{isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.label || template.label : template.label}</span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200">
                {isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.badge || template.badge : template.badge}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-300">{isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.hint || template.hint : template.hint}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.tags || template.tags : template.tags).map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-400">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 w-full max-w-2xl px-4 text-left">
        <label className="mb-3 block text-sm font-bold text-zinc-300">{tr('主题与标签（以逗号分隔）', 'Themes and tags, comma-separated')}</label>
        <input
          value={themeInputText}
          onChange={(event) => {
             const val = event.target.value;
             setThemeInputText(val);
             setSelectedThemes(val.split(/[,，]/).map(s => s.trim()).filter(Boolean));
          }}
          placeholder={tr('在此手动输入标签或点击下方快速添加', 'Enter tags here or tap quick tags below')}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {THEMES.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                 const current = themeInputText.trim();
                 const displayTag = isEnglish ? THEME_LABEL_EN[tag] || tag : tag;
                 let newText = current;
                 if (!current) newText = displayTag;
                 else if (!current.includes(displayTag)) newText = current + (current.endsWith('，') || current.endsWith(',') ? '' : (isEnglish ? ', ' : '，')) + displayTag;
                 setThemeInputText(newText);
                 setSelectedThemes(newText.split(/[,，]/).map(s => s.trim()).filter(Boolean));
              }}
              className="rounded-lg bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              + {isEnglish ? THEME_LABEL_EN[tag] || tag : tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-2xl px-4 text-left">
        <div className="mb-6 rounded-2xl border border-indigo-300/15 bg-indigo-500/10 p-4">
          <label className="mb-2 block text-sm font-black text-indigo-100">{tr('套用世界观设定', 'Apply world setting')}</label>
          <select
            value={quickSeriesBindingId}
            onChange={(event) => setQuickSeriesBindingId(event.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            <option value="">{tr('不套用世界观设定', 'No world setting')}</option>
            {seriesWorlds.map((series) => (
              <option key={series.id} value={series.id}>{series.title || tr('未命名世界观设定', 'Untitled world setting')}</option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-indigo-100/65">
                {tr('世界观设定是可复用设定仓库。可勾选本次生成要遵守的世界基准、沿用角色卡，并在续作时加入继承节点。', 'A world setting is a reusable setting archive. Pick the rules and character cards this generation should obey, and add a continuity node for sequels.')}
          </p>
          {quickSeriesBindingId && (() => {
            const selected = seriesWorlds.find((series) => series.id === quickSeriesBindingId) || null;
            const baselineRules = getSeriesBaselineRules(selected);
            const characterCards = getSeriesCharacterCards(selected);
            const seriesStoryOptions = myStories.filter((story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '') === quickSeriesBindingId);
            const continuityBranches = asSafeArray<any>(quickContinuitySourceStory?.branches);
            const continuityEndings = asSafeArray<any>(quickContinuitySourceStory?.endings);
            return (
              <div className="mt-4 space-y-4">
                <div className="border-t border-zinc-800 pt-4">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('世界基准', 'World baseline')}</div>
                  {baselineRules.length === 0 ? (
                    <div className="text-xs leading-relaxed text-zinc-500">{tr('该世界观设定还没有条目化基准；生成时只会参考世界观概况。', 'No itemized baseline rules yet; generation will only use the world overview as reference.')}</div>
                  ) : (
                    <div className="grid gap-2">
                      {baselineRules.map((rule) => (
                        <label key={rule.id} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={quickSeriesSelection.baselineRuleIds.includes(rule.id)}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({
                              ...prev,
                              baselineRuleIds: event.target.checked
                                ? [...new Set([...prev.baselineRuleIds, rule.id])]
                                : prev.baselineRuleIds.filter((id) => id !== rule.id),
                            }))}
                            className="mt-1 accent-indigo-500"
                          />
                          <span>
                            <span className="block font-black leading-relaxed text-zinc-100">{rule.detail || rule.title}</span>
                            {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).length > 0 && (
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).map((tag) => (
                                  <span key={tag} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-200">{tag}</span>
                                ))}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('角色卡池', 'Character pool')}</div>
                  {characterCards.length === 0 ? (
                    <div className="text-xs leading-relaxed text-zinc-500">{tr('该世界观设定还没有角色卡；生成时会根据本次情节重新设计角色。', 'No character cards yet; this story will create its own cast.')}</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {characterCards.map((card) => (
                        <label key={card.id} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={quickSeriesSelection.characterIds.includes(card.id)}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({
                              ...prev,
                              characterIds: event.target.checked
                                ? [...new Set([...prev.characterIds, card.id])]
                                : prev.characterIds.filter((id) => id !== card.id),
                            }))}
                            className="mt-1 accent-indigo-500"
                          />
                          <span>
                            <span className="block font-black text-zinc-100">{card.name}</span>
                            <span className="mt-1 block leading-relaxed text-zinc-500">{card.desc || card.role || tr('系列角色', 'Series character')}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <label className="flex items-center gap-2 text-sm font-black text-zinc-200">
                    <input
                      type="checkbox"
                      checked={quickSeriesSelection.useContinuity}
                      onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, useContinuity: event.target.checked }))}
                      className="accent-indigo-500"
                    />
                    {tr('作为续作生成，设置前作继承锚点', 'Generate as sequel with previous-story anchors')}
                  </label>
                  {quickSeriesSelection.useContinuity && (
                    <div className="mt-3 space-y-3">
                      <select
                        value={quickSeriesSelection.sourceStoryId}
                        onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, sourceStoryId: event.target.value, requiredBranchIds: [], endingId: '', continuityNodeId: '' }))}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none"
                      >
                        <option value="">{tr('选择前作', 'Choose previous story')}</option>
                        {seriesStoryOptions.map((story: any) => (
                          <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                        ))}
                      </select>
                      {seriesStoryOptions.length === 0 && (
                        <div className="text-xs leading-relaxed text-zinc-500">{tr('该世界观下还没有可作为前作的作品。请先生成或绑定第一部。', 'No previous story is bound to this world setting yet.')}</div>
                      )}
                      {quickContinuityLoading && (
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr('正在读取前作支线与结局...', 'Loading branches and endings...')}</div>
                      )}
                      {quickSeriesSelection.sourceStoryId && !quickContinuityLoading && (
                        <div className="grid gap-3">
                          <div>
                            <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('前置支线，可复选', 'Required branches')}</div>
                            {continuityBranches.length === 0 ? (
                              <div className="text-xs leading-relaxed text-zinc-500">{tr('该前作没有可选支线。', 'This previous story has no branches.')}</div>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {continuityBranches.map((branch: any) => {
                                  const branchId = String(branch.id || '');
                                  return (
                                    <label key={branchId} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={quickSeriesSelection.requiredBranchIds.includes(branchId)}
                                        onChange={(event) => setQuickSeriesSelection((prev) => ({
                                          ...prev,
                                          requiredBranchIds: event.target.checked
                                            ? [...new Set([...prev.requiredBranchIds, branchId])]
                                            : prev.requiredBranchIds.filter((id) => id !== branchId),
                                        }))}
                                        className="mt-1 accent-indigo-500"
                                      />
                                      <span className="font-bold text-zinc-100">{branch.name || branch.title || branchId}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('前置结局，单选', 'Required ending')}</div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {continuityEndings.map((ending: any) => {
                                const endingId = String(ending.id || '');
                                return (
                                  <label key={endingId} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                    <input
                                      type="radio"
                                      name="quick-continuity-ending"
                                      checked={quickSeriesSelection.endingId === endingId}
                                      onChange={() => setQuickSeriesSelection((prev) => ({ ...prev, endingId }))}
                                      className="mt-1 accent-indigo-500"
                                    />
                                    <span className="font-bold text-zinc-100">{ending.title || endingId}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <textarea
                            value={quickSeriesSelection.hardSettings}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, hardSettings: event.target.value }))}
                            placeholder={tr('继承硬设定：一行一条，例如「前作中阵亡的人物不能无解释复活」或「第二部开场必须承认王都已陷落」。', 'Continuity hard rules: one per line, e.g. “Dead characters cannot return without explanation.”')}
                            className="min-h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <label className="mb-3 block text-sm font-bold text-zinc-300">{tr('专属故事大纲', 'Custom story outline')}</label>
        <textarea
          value={customOutline}
          onChange={(event) => setCustomOutline(event.target.value)}
          placeholder={tr('例如：一位在现代都市经营神秘书店的青年，某夜遇见来自未来的顾客，自此被卷入一场会改写现实的命运试炼。', 'Example: A young bookseller in a modern city meets a customer from the future and is drawn into a fate trial that can rewrite reality.')}
          className="min-h-[140px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-400">{tr('叙事人称', 'Narrative voice')}</span>
              <span className="text-xs font-black text-indigo-300">
                {quickText(NARRATIVE_PERSON_OPTIONS.find((option) => option.value === narrativePerson)?.label)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {NARRATIVE_PERSON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNarrativePerson(option.value)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                    narrativePerson === option.value
                      ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-sm font-black">{quickText(option.label)}</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-70">{quickText(option.hint)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-400">{tr('结局结构', 'Ending structure')}</span>
              <span className="text-xs font-black text-indigo-300">
                {quickEndingMode === 'single' ? tr('唯一走向', 'Fixed-ending path') : tr('三域走向', 'Three-domain path')}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                {
                  value: 'single',
                  label: tr('唯一走向', 'Fixed-ending path'),
                  hint: tr('所有干涉最终都会自然收束到唯一结局，重点在过程变化、角色经历与支线展开。', 'All interference naturally converges to one fixed ending; the focus is path changes, character experience, and branches.'),
                },
                {
                  value: 'dual',
                  label: tr('三域走向', 'Three-domain path'),
                  hint: tr('使用中域、左域、右域三类收束，并为每一域保留扩展更多具体结局的空间。', 'Uses middle, left, and right domains while leaving room for more concrete endings later.'),
                },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQuickEndingMode(option.value)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                    quickEndingMode === option.value
                      ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-sm font-black">{option.label}</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                </button>
              ))}
            </div>
            {quickEndingMode === 'dual' && (
              <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs font-bold text-zinc-400">
                {(() => {
                  const axis = endingBiasAxisFromBias(quickEndingBias);
                  const bias = endingBiasFromAxis(axis);
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span>{tr('主线倾向', 'Mainline tendency')}</span>
                        <span className="text-sm font-black text-indigo-200">{endingBiasAxisLabel(axis)}</span>
                      </div>
                      <input
                        type="range"
                        min={-70}
                        max={70}
                        step={10}
                        value={axis}
                        onChange={(event) => setQuickEndingBias(endingBiasFromAxis(Number(event.target.value)))}
                        className="mt-3 w-full accent-indigo-500"
                      />
                      <div className="mt-2 flex justify-between text-[10px] font-black text-zinc-600">
                        <span>{tr('右域强', 'Right strong')}</span>
                        <span>{tr('中性', 'Neutral')}</span>
                        <span>{tr('左域强', 'Left strong')}</span>
                      </div>
                      <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                        {tr(`左域 ${bias.leftBaseWeight}% / 右域 ${bias.rightBaseWeight}%；支线会瓜分各自剩余空间来撬动走向。`, `Left ${bias.leftBaseWeight}% / Right ${bias.rightBaseWeight}%. Branches use each side's remaining room to shift the path.`)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-400">{tr('每章目标字数', 'Target words per chapter')}</span>
            <span className="font-black text-indigo-300">{targetWordCount} {tr('字', 'words')}</span>
          </div>
          <input
            type="range"
            min="600"
            max="1200"
            step="100"
            value={targetWordCount}
            onChange={(event) => setTargetWordCount(parseInt(event.target.value, 10))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            <span>{tr('精简', 'Lean')}</span>
            <span>{tr('宏大', 'Epic')}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateBlueprint}
          disabled={
            (selectedThemes.length < 1 && customOutline.trim().length === 0 && !quickSeriesBindingId) ||
            selectedThemes.length > 4 ||
            (quickSeriesSelection.useContinuity && (!quickSeriesSelection.sourceStoryId || !quickSeriesSelection.endingId))
          }
          className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
        >
          <Sparkles className="h-4 w-4" />
          {tr('生成世界蓝图', 'Generate story blueprint')}
        </button>
      </div>
      </>
      )}
    </div>
  );

  const isSystemSettingsMode = accountCenterMode === 'settings';
  const renderAccountCenterContent = (mode: 'page' | 'modal' = 'modal') => {
    const assetStats = [
      {
        label: tr('收藏原作', 'Favorited originals'),
        value: mySharedStories.filter((story: any) => story.archiveKind === 'favorite').length,
        onClick: () => {
          setArchiveTab('favorite');
          openArchiveView(mode === 'page' ? 'STORY_SELECT' : 'ACCOUNT_CENTER');
        }
      },
      {
        label: tr('收藏命运', 'Saved fate lines'),
        value: mySharedStories.filter((story: any) => story.archiveKind !== 'favorite').length,
        onClick: () => {
          setArchiveTab('saved');
          openArchiveView(mode === 'page' ? 'STORY_SELECT' : 'ACCOUNT_CENTER');
        }
      },
      {
        label: tr('追踪作者', 'Followed authors'),
        value: followedAuthors.length,
        onClick: () => {
          setArchiveTab('authors');
          openArchiveView(mode === 'page' ? 'STORY_SELECT' : 'ACCOUNT_CENTER');
        }
      },
      {
        label: tr('我的作品', 'My works'),
        value: myStories.length,
        onClick: () => {
          setIsAccountCenterOpen(false);
          void enterAuthoring();
        }
      },
    ];

    return (
      <>
        {isSystemSettingsMode && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
                {tr('设置', 'Settings')}
              </div>
              <h2 className="mt-1 text-2xl font-black text-white">
                {tr('系统设置', 'System Settings')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => mode === 'page' ? goBack('STORY_SELECT') : setIsAccountCenterOpen(false)}
              className={semanticIconButtonClass('ghost')}
              aria-label={tr('关闭', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {!isSystemSettingsMode && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
                {tr('个人中心', 'Account Center')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => mode === 'page' ? goBack('STORY_SELECT') : setIsAccountCenterOpen(false)}
              className={semanticIconButtonClass('ghost')}
              aria-label={tr('返回', 'Back')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        )}

        {!isSystemSettingsMode && (
          <div className="mb-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/10 p-5 space-y-4">
            {/* 名字与Email */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-2xl font-black text-white">
                  <span>{getUserAuthorName(user)}</span>
                  {!user?.isAnonymous && (
                    <button
                      type="button"
                      onClick={() => setIsEditNameModalOpen(true)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-95"
                      title={tr('修改名称', 'Edit name')}
                    >
                      <PenSquare className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-1 text-sm text-zinc-500">{user?.email || tr('游客账号', 'Guest account')}</div>
              </div>
            </div>

            {/* 游客提示 */}
            {user?.isAnonymous && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-50/80">
                {GUEST_RETENTION_NOTICE}
              </div>
            )}

            {/* 个性签名 */}
            <div className="border-t border-zinc-800/40 pt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-500 mb-1">{tr('个人签名', 'Bio')}</div>
                  <div 
                    onClick={() => setIsEditBioModalOpen(true)}
                    className="text-sm text-zinc-300 hover:text-white cursor-pointer transition-colors line-clamp-3 italic leading-relaxed"
                  >
                    {myBio.trim() ? `「 ${myBio} 」` : tr('点击设置您的个性签名...', 'Click to set your bio...')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditBioModalOpen(true)}
                  className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-95"
                  title={tr('修改签名', 'Edit bio')}
                >
                  <PenSquare className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 安全设置与修改密码入口 (非游客账号) */}
            {!user?.isAnonymous && (
              <div className="border-t border-zinc-800/40 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(true)}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-zinc-400" />
                    <span>{tr('账户安全设置', 'Account Security Settings')}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </button>
              </div>
            )}
          </div>
        )}

        {!isSystemSettingsMode && (
          <section className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black text-white">{tr('我的资产', 'My Library')}</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {tr('收藏、命运线、追踪和创作集中查看，方便快速找到相关内容。', 'Favorites, fate lines, follows, and works are gathered here for quick access.')}
                </div>
              </div>
              <BarChart3 className="h-5 w-5 text-indigo-200" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {assetStats.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="group text-left rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                >
                  <div className="text-2xl font-black text-white group-hover:text-indigo-200 transition-colors">{item.value}</div>
                  <div className="mt-1 text-xs font-bold text-zinc-500 group-hover:text-zinc-400 transition-colors">{item.label}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-6">
          <section className="p-0">
            <div className="space-y-3">
              {isSystemSettingsMode && (
                <div className="overflow-hidden rounded-2xl border border-zinc-800/60">
                  {/* 语言 */}
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-zinc-100">{t('language.switch')}</div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {appLanguage === 'en-US'
                            ? 'This setting is saved on this device until it is changed here again.'
                            : '语言设置会保存在当前设备，之后默认沿用，直到回到这里再次改变。'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['zh-CN', 'en-US'] as AppLanguage[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAppLanguage(option)}
                          className={`rounded-xl border px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                            appLanguage === option
                              ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                          }`}
                        >
                          {option === 'zh-CN' ? t('language.zh') : t('language.en')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 主题 */}
                  <div className="border-t border-zinc-800/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-zinc-100">{tr('界面主题', 'Theme')}</div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {tr('浅色主题使用柔和低疲劳配色，暗色主题保留原本氛围。', 'Light theme uses softer low-fatigue colors; dark theme keeps the original atmosphere.')}
                        </div>
                      </div>
                      {appTheme === 'light' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-300" />}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'dark' as const, label: tr('暗色', 'Dark') },
                        { value: 'light' as const, label: tr('浅色', 'Light') },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAppTheme(option.value)}
                          className={`rounded-xl border px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                            appTheme === option.value
                              ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 通知 */}
                  <div className="border-t border-zinc-800/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-zinc-100">{tr('手机通知', 'Mobile notifications')}</div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {tr('接收作者更新、作品互动 and 系统提醒。若曾在系统弹窗中拒绝，需要到浏览器或手机设置里重新允许。', 'Receive author updates, story interactions, and system reminders. If blocked before, re-enable it in browser or phone settings.')}
                        </div>
                      </div>
                      <Bell className="h-5 w-5 text-indigo-300" />
                    </div>
                    <button type="button" onClick={enablePushNotifications} disabled={pushSubscribeBusy} className={semanticButtonClass('secondary', { fullWidth: true })}>
                      {pushSubscribeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                      {tr('开启手机通知', 'Enable mobile notifications')}
                    </button>
                  </div>
                  {/* 版本 */}
                  <div className="border-t border-zinc-800/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-zinc-100">{tr('版本', 'Version')}</div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {tr('用于确认当前安装的 App 是否已经更新。', 'Use this to confirm whether the installed app is up to date.')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-indigo-200">{APP_VERSION_LABEL}</div>
                        {APP_BUILD_LABEL && <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">{APP_BUILD_LABEL}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-zinc-800/60 p-4">
                    <div className="mb-3">
                      <div className="text-sm font-black text-zinc-100">{tr('帮助中心', 'Help center')}</div>
                      <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                        {tr('查看作品、创作、世界观与续作功能的简明说明。', 'Read short guides for stories, creation, world settings, and sequels.')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (mode === 'modal') setIsAccountCenterOpen(false);
                        setIsHelpDrawerOpen(true);
                      }}
                      className={semanticButtonClass('secondary', { fullWidth: true })}
                    >
                      <BookOpen className="h-4 w-4" />
                      {tr('打开帮助中心', 'Open help center')}
                    </button>
                  </div>
                </div>
              )}
              {!isSystemSettingsMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'modal') setIsAccountCenterOpen(false);
                    handleLogout();
                  }}
                  className={semanticButtonClass('danger', { fullWidth: true })}
                >
                  <LogOut className="h-4 w-4" />
                  {tr('退出登录', 'Log out')}
                </button>
              )}
            </div>
          </section>

        {!isSystemSettingsMode && (
        <section className="p-0">
          <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Archive className="h-5 w-5 text-indigo-300" />
            {t('archive.title')}
          </div>
          <div className="space-y-3">
            <div className="text-sm text-zinc-400">
              {tr('收藏命运和分享记录现在集中在独立页面管理。', 'Saved fate lines and share records are managed on a separate page.')}
            </div>
            <button
              type="button"
              onClick={() => openArchiveView('ACCOUNT_CENTER')}
              className={semanticButtonClass('secondary', { fullWidth: true })}
            >
              <Archive className="h-4 w-4" />
              {tr('打开命运收藏馆页', 'Open fate archive')}
            </button>
          </div>
        </section>
        )}

        {!isSystemSettingsMode && (
          <section className="p-0">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <BookOpen className="h-5 w-5 text-indigo-300" />
              {tr('入门教学', 'Tutorial')}
            </div>
            <div className="space-y-3">
              <div className="text-sm leading-relaxed text-zinc-400">
                {tr('用一段短篇试玩熟悉阅读、干涉、结算与收藏命运的基本流程。', 'Try a short guided story to learn reading, intervention, endings, and saved fate lines.')}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'modal') setIsAccountCenterOpen(false);
                  void startStoryPlay('tutorial-cartridge');
                }}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                <Sparkles className="h-4 w-4" />
                {tr('开始入门试玩', 'Start tutorial')}
              </button>
            </div>
          </section>
        )}

        {isSystemSettingsMode && isAdminUser && (
          <section className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <Settings className="h-5 w-5 text-amber-300" />
              管理目录
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-white">AI 图片生成功能</div>
                  <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                    关闭时，普通用户不会看到封面 AI 生成入口；管理员自己始终保留最新功能入口。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminFeatureDraft((prev) => ({ ...prev, coverGenerationEnabled: !prev.coverGenerationEnabled }))}
                  className={adminFeatureDraft.coverGenerationEnabled ? semanticButtonClass('primary', { compact: true }) : semanticButtonClass('ghost', { compact: true })}
                >
                  {adminFeatureDraft.coverGenerationEnabled ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {adminFeatureDraft.coverGenerationEnabled ? '已开放给所有用户' : '仅管理员可见'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveAdminSettings}
                disabled={isSavingAdminSettings}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                {isSavingAdminSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                保存管理设置
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
};


  const accountCenterModal = (
    <AnimatePresence>
      {isAccountCenterOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} ${isSystemSettingsMode ? 'z-[3200] bg-black/80' : 'z-[2400] bg-black/45'} backdrop-blur-md`}
          style={!isSystemSettingsMode ? { paddingBottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 6.1rem)' } : undefined}
          onClick={() => setIsAccountCenterOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className={`app-modal-surface app-modal-safe-height w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6`}
            onClick={(event) => event.stopPropagation()}
          >
            {renderAccountCenterContent('modal')}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderInlineHelp = (key: string, title: string, content: React.ReactNode) => {
    if (dismissedHelpCards[key]) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6 flex gap-3 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-indigo-200/90 shadow-[inset_0_1px_1px_rgba(99,102,241,0.05)] transition-all"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-indigo-400" />
        <div className="flex-1 leading-relaxed">
          <div className="font-black text-indigo-100">{title}</div>
          <div className="mt-1 text-xs text-indigo-200/80">{content}</div>
        </div>
        <button
          type="button"
          onClick={() => dismissHelpCard(key)}
          className="h-8 w-8 shrink-0 rounded-lg border border-indigo-500/10 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400/30 hover:text-white transition-all flex items-center justify-center focus-visible:ring-1 focus-visible:ring-indigo-400"
          title={isEnglish ? "Dismiss" : "我知道了"}
          aria-label={isEnglish ? "Dismiss" : "我知道了"}
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    );
  };

  const renderTourOverlay = () => {
    if (tourStep === null || !authoringCartridge) return null;

    const steps = [
      {
        tab: 'settings',
        title: '第一步：配置故事基础 (Settings)',
        text: '在这个选项卡下，你可以设置故事标题、主轴（如“自由 VS 妥协”）、题材标签，以及添加或修改故事的登场人物。人物卡是触发干涉的实体，请务必先在此处配置角色。',
      },
      {
        tab: 'mainline',
        title: '第二步：编写正史主线 (Mainline)',
        text: '在这里编写故事的主线章节（第 1 到第 7 章）。这是整个世界线的基础架构。第 7 章还可以设置双向模式下的左域/右域终章结局名称。',
      },
      {
        tab: 'branches',
        title: '第三步：编织命运分支 (Branches & Rules)',
        text: '在此处添加命运支线规则。你可以绑定某个角色在特定章节（第 2-6 章）遭遇庇佑(Bless)或磨难(Curse)作为触发器。一旦触发，分支的注入条件（mustHappen 等）将改写下游章节的正文走向。',
      },
      {
        tab: 'settings',
        title: '第四步：保存并发布 (Save & Publish)',
        text: '编辑完所有规则与文本后，请记得点击右上角的『保存更改』以保存至云端。当作品开发完毕，修改其可见性为“公开”即可发布在书库中！',
      }
    ];

    const guidedSteps = [
      {
        tab: 'settings',
        title: '第一步：整理作品门面',
        text: '先确认作品名、简介、封面、标签、可见性与改编权限。这里决定读者在作品库看到什么，也决定作品是否公开、非公开链接访问，或只保留给作者自己。',
        placement: 'right',
      },
      {
        tab: 'series',
        title: '第二步：套用世界观设定',
        text: '如果作品属于长篇系列，可以在这里选择世界观设定、角色卡和继承条件。世界观负责约束“什么可以发生”，本作主线负责讲“这一次发生什么”。',
        placement: 'right',
      },
      {
        tab: 'mainline',
        title: '第三步：编排主线与结局',
        text: '在这里编辑七章基础正文和结局域。左域、右域代表故事可能走向的两种倾向；中域代表没有明显偏向时的收束。作者可以设置左右两域的默认倾向，让读者大致理解作品的命运气质。',
        placement: 'left',
      },
      {
        tab: 'branches',
        title: '第四步：设计角色与支线',
        text: '支线条件决定玩家在某章、对某个角色行动时，可能触发怎样的隐藏情节、伏笔或转折。提示应该帮助玩家判断方向，但不需要揭开全部答案。',
        placement: 'left',
      },
      {
        tab: 'settings',
        title: '第五步：保存与发布',
        text: '确认内容后，使用“保存更改”。如果要让读者在首页发现作品，可把可见性设为公开；若只想给特定读者访问，可使用非公开链接。',
        placement: 'right',
      },
    ];

    const currentStep = guidedSteps[tourStep];
    if (!currentStep) return null;
    const tourPlacementClass = currentStep.placement === 'left'
      ? 'left-[max(1rem,env(safe-area-inset-left))] top-[max(5.5rem,calc(env(safe-area-inset-top)+4rem))]'
      : 'right-[max(1rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+4rem))]';

    const handleNext = () => {
      if (tourStep < guidedSteps.length - 1) {
        const nextStep = tourStep + 1;
        setTourStep(nextStep);
        setAuthoringTab(guidedSteps[nextStep].tab as any);
      } else {
        setTourStep(null);
        localStorage.setItem('completed-authoring-tour', 'true');
        showError('向导完成！祝你创作愉快！');
      }
    };

    const handleSkip = () => {
      setTourStep(null);
      localStorage.setItem('completed-authoring-tour', 'true');
    };

    return (
      <div className="pointer-events-none fixed inset-0 z-[9999] p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`pointer-events-auto fixed w-[min(24rem,calc(100vw-2rem))] ${tourPlacementClass} rounded-[2rem] border border-indigo-500/25 bg-zinc-900/92 p-5 shadow-2xl backdrop-blur-md`}
        >
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
            <Sparkles className="h-3 w-3" />
            创作者引导 ({tourStep + 1} / {guidedSteps.length})
          </div>
          <h3 className="text-xl font-black text-white">{currentStep.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            {currentStep.text}
          </p>
          <div className="mt-6 flex justify-between gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              跳过引导
            </button>
            <button
              type="button"
              onClick={handleNext}
              className={semanticButtonClass('primary', { compact: true })}
            >
              {tourStep === guidedSteps.length - 1 ? '完成' : '下一步'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderHelpFloatingButton = () => {
    return null;
    if (gameState === 'PLAYING' || gameState === 'GENERATING_BLUEPRINT' || tourStep !== null) return null;
    return (
      <button
        type="button"
        onClick={() => setIsHelpDrawerOpen(true)}
        className="fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+5rem)] right-8 z-[1500] flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/30 bg-zinc-950/80 text-indigo-300 shadow-2xl backdrop-blur-md transition-all hover:border-indigo-400 hover:text-white hover:scale-105 active:scale-95 animate-pulse"
        title={isEnglish ? "Help Center" : "帮助中心"}
        aria-label={isEnglish ? "Help Center" : "帮助中心"}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="relative text-lg font-black leading-none">?</span>
        </span>
      </button>
    );
  };

  const renderHelpCenterDrawer = () => {
    const qas = [
      {
        q: '什么是干涉值（Ending Value）与命运走向？',
        a: '在命运馆中，每一部双向结局的作品都有【左域】和【右域】两条因果走向。玩家在第 2 至第 6 章中，对登场角色施加的「庇佑 (Bless)」或「磨难 (Curse)」会让故事逐渐偏向不同结局域。最终在第 7 章，系统会根据本局走向推演出对应的终章故事。',
        tags: '干涉 庇佑 磨难 命运走向 结局 ending value bless curse'
      },
      {
        q: '怎么让故事分支（Branch）被成功解锁？',
        a: '每个分支都有其『触发条件』。触发条件由作者在创作故事时指定（例如：林晓在第 2 章遭遇庇佑）。当你在游玩过程中做出了符合条件的干涉时，该分支就会即时解锁。解锁的分支会通过“注入动作（inject）”强制改写下游章节的故事内容，展示出非同寻常的历史细节。一些高阶分支甚至有『多重干涉组合条件』。',
        tags: '分支 解锁 条件 触发器 注入 剧情改动 trigger inject'
      },
      {
        q: '如何使用世界观设定（World Bible）创作续作？',
        a: '世界观仓库是多部作品共用的因果基座。当你生成或手动创建了一套世界观（包含世界基准规则、角色卡池和故事大纲素材）后，你可以新建作品，并在『系列/世界观设置』中选择该世界观。AI 在生成故事章节时，会绝对遵守世界观中的【世界基准规则】（例如：魔法在这个世界上已被禁止），并自动从角色池中引入人物。',
        tags: '世界观 世界基准 角色池 续作 创作 创作者 world bible rules'
      },
      {
        q: '续作是如何“继承前作”结局和设定状态的？',
        a: '当你在创作者后台为一部作品勾选了『此作品是续作』，并关联了前作时，系统会在续作开始时自动建立【命运继承规则】。续作的第 1 章会静默继承你在前作中走出的结局文本、曾解锁的分支以及人物的死活存留状态。AI 将自动分析这些前置因果，作为续作开篇的剧情前奏，实现真正的内容传承。',
        tags: '继承 续作 前作 结局 人物状态 关联 命运继承 inheritance sequel'
      },
      {
        q: 'AI 快速生成故事的流程是怎样的？',
        a: '当你输入故事标题和主轴概念后，系统将先为你生成一份『世界线蓝图 (Blueprint)』，里面包含 7 个章节的大纲梗概、初始登场人物和若干预置分支规则。在蓝图建立后，你可以自由调整其章节或分支设置。点击『开发/干涉』时，系统将根据你当前的配置，渲染并填充前几章 of 初始主干正文。后续的重写也是基于此蓝图逻辑展开的。',
        tags: '快速生成 世界蓝图 创作 章节大纲 ai 流程 blueprint'
      }
    ];

    const safeHelpQas = [
      {
        q: '玩家应该怎样开始一部作品？',
        a: '从作品库选择感兴趣的作品，点击“干涉命运”进入阅读。读到可干涉章节时，选择角色和行动；完成后可以继续阅读变化后的故事，并在结算后收藏命运或分享。',
        tags: '玩家 作品库 干涉命运 阅读 收藏 分享',
      },
      {
        q: '作者如何设计一部可玩的故事？',
        a: '先在作品设置里整理标题、简介、封面、标签和可见性；再写好主线章节与结局域；最后在角色和支线里设置哪些角色、章节和条件会开启特殊情节。',
        tags: '作者 作品设置 主线 结局 支线 角色',
      },
      {
        q: '支线条件有什么作用？',
        a: '支线条件用于告诉作品：玩家在某章对某个角色做出特定行动时，可以开启一段隐藏情节、伏笔、关系变化或结局铺垫。提示应该帮助玩家判断方向，但不需要剧透全部内容。',
        tags: '支线 条件 提示 隐藏情节 伏笔',
      },
      {
        q: '世界观设定怎样连接多部作品？',
        a: '世界观设定像系列仓库，可以保存世界基准、角色卡池和情节素材。创作新作或续作时，作者可以勾选要套用的条目，让不同作品共享同一套世界规则和角色基础。',
        tags: '世界观 系列 角色卡 世界基准 续作',
      },
      {
        q: '续作的前置条件应该怎么设？',
        a: '在系列设置里选择前作，再指定需要完成的结局和支线。这样玩家进入续作前，会先确认是否已经经历过对应前情；作者也可以补充继承硬设定，让续作开场衔接更自然。',
        tags: '续作 前作 继承 结局 支线',
      },
    ];

    const keyword = helpSearch.trim().toLowerCase();
    const filteredQas = safeHelpQas.filter(item => {
      if (!keyword) return true;
      return `${item.q}\n${item.a}\n${item.tags}`.toLowerCase().includes(keyword);
    });

    return (
      <AnimatePresence>
        {isHelpDrawerOpen && (
          <div className="fixed inset-0 z-[6500] flex justify-end bg-zinc-950/60 backdrop-blur-[1px]">
            <div className="absolute inset-0" onClick={() => setIsHelpDrawerOpen(false)} />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
              className="relative z-10 flex h-full w-full flex-col border-l border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-md sm:max-w-md"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-white">{tr('命运馆帮助中心', 'Help Center')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpDrawerOpen(false)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  aria-label={isEnglish ? "Close Help Center" : "关闭帮助中心"}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  value={helpSearch}
                  onChange={(event) => setHelpSearch(event.target.value)}
                  placeholder={tr('搜索您想知道的规则或名词...', 'Search terms, rules...')}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-9 pr-4 text-xs font-semibold text-zinc-100 outline-none transition-colors focus:border-indigo-400/70"
                />
              </div>

              <div className="mt-6 flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
                {filteredQas.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    {tr('没有找到匹配的内容，换个词试试吧？', 'No matches found. Try another search term.')}
                  </div>
                ) : (
                  filteredQas.map((qa, index) => (
                    <div key={index} className="rounded-2xl border border-zinc-800/80 bg-zinc-950/20 p-4 transition-colors hover:border-zinc-800">
                      <h3 className="text-sm font-black text-zinc-100 flex gap-2">
                        <span className="text-indigo-400">Q:</span>
                        {qa.q}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                        {qa.a}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {Object.keys(dismissedHelpCards).length > 0 && (
                <div className="mt-4 shrink-0 px-2">
                  <button
                    type="button"
                    onClick={restoreHelpCards}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2.5 text-xs font-semibold text-zinc-400 hover:border-indigo-500/30 hover:text-indigo-300 transition-colors"
                  >
                    {tr('恢复所有被折叠的教学提示', 'Restore All Dismissed Tips')}
                  </button>
                </div>
              )}

              <div className="mt-4 border-t border-zinc-800 pt-4 text-center">
                <p className="text-[10px] text-zinc-600">
                  {tr('命运馆执行官专用工具集 · 离线引导版本', 'Fate interference toolkit · Offline version')}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  const renderEditNameModal = () => (
    <AnimatePresence>
      {isEditNameModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsEditNameModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改昵称', 'Change Display Name')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{tr('修改后，您生成的作品和干涉记录都会显示新昵称（最多5字）。', 'After change, your works and records will display the new name (max 5 chars).')}</p>
              </div>
              <button type="button" onClick={() => setIsEditNameModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={profileDisplayName}
                onChange={(event) => setProfileDisplayName(event.target.value)}
                placeholder={tr('输入新昵称', 'New display name')}
                maxLength={5}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsEditNameModalOpen(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateProfileDisplayName();
                    setIsEditNameModalOpen(false);
                  }}
                  className={semanticButtonClass('primary', { fullWidth: true })}
                >
                  {tr('确认修改', 'Save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderEditBioModal = () => (
    <AnimatePresence>
      {isEditBioModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsEditBioModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改个性签名', 'Edit Bio')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{tr('用于展示在您的作者档案中，告诉大家关于您的一两件事（最多120字）。', 'Displayed on your author profile to tell others a bit about yourself (max 120 chars).')}</p>
              </div>
              <button type="button" onClick={() => setIsEditBioModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <textarea
                value={editingBio}
                onChange={(e) => setEditingBio(e.target.value)}
                placeholder={tr('写点什么向别人介绍自己吧...', 'Write something to introduce yourself...')}
                maxLength={120}
                className="w-full h-28 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsEditBioModalOpen(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateBio();
                    setIsEditBioModalOpen(false);
                  }}
                  className={semanticButtonClass('primary', { fullWidth: true })}
                >
                  {tr('确认修改', 'Save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderSecurityModal = () => (
    <AnimatePresence>
      {isSecurityModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsSecurityModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改账户密码', 'Security Settings')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{tr('修改账户登录密码或发送密码重设邮件。', 'Change account password or send reset email.')}</p>
              </div>
              <button type="button" onClick={() => setIsSecurityModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                value={profileCurrentPassword}
                onChange={(event) => setProfileCurrentPassword(event.target.value)}
                placeholder={tr('当前密码', 'Current password')}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                value={profileNewPassword}
                onChange={(event) => setProfileNewPassword(event.target.value)}
                placeholder={tr('新密码（至少 6 位）', 'New password (at least 6 characters)')}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={async () => {
                  await handleUpdateAccountPassword();
                  if (!profileNewPassword) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                <Lock className="h-4 w-4" />
                {tr('确认修改密码', 'Confirm change password')}
              </button>
              
              <div className="border-t border-zinc-800/60 my-2"></div>
              
              <button
                type="button"
                onClick={async () => {
                  await handlePasswordResetForEmail(user?.email || '');
                  setIsSecurityModalOpen(false);
                }}
                className={semanticButtonClass('ghost', { fullWidth: true })}
              >
                <Mail className="h-4 w-4" />
                {tr('发送重设密码邮件', 'Send reset email')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAccountCenterView = () => (
    <div className="mx-auto max-w-4xl px-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
      {renderAccountCenterContent('page')}
    </div>
  );

  const renderReadonlyStoryView = () => {
    const story = readonlyStoryData;
    if (!story) return null;
    const readonlyArchiveId = story.meta?.sharedStoryId;
    const isReadonlyOwner = Boolean(user && readonlyArchiveId && story.meta?.authorId === user.uid);
    const isReadonlyUpdating = Boolean(readonlyArchiveId && archiveUpdatingIds[readonlyArchiveId]);
    return (
      <div className="reading-page mx-auto max-w-4xl rounded-b-[2.5rem] px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] sm:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            {story.meta?.coverUrl && (
              <img src={story.meta.coverUrl} alt={`${formatBookTitle(story.meta?.title)} ${tr('封面', 'cover')}`} className="h-24 w-24 shrink-0 rounded-2xl border border-zinc-800 object-cover sm:h-32 sm:w-32" />
            )}
            <div className="min-w-0 space-y-3">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">{tr('故事记录', 'Story Record')}</div>
              <h1 className="break-words text-4xl font-black text-white">{formatBookTitle(story.meta?.title)}</h1>
              <div className="space-y-1 text-sm font-bold text-zinc-500">
                <div><AuthorNameButton prefix={tr('原作者：', 'Original author: ')} authorId={story.meta?.originalAuthorId || story.meta?.sourceStoryId || story.meta?.authorId} authorName={getOriginalAuthorName(story.meta)} /></div>
                {getIntervenerName(story.meta) && <div>{tr('干涉者：', 'Intervener: ')}{getIntervenerName(story.meta)}</div>}
              </div>
            </div>
          </div>
          {readonlyCanGoBack && <BackNavButton label={tr('返回上一页', 'Back')} onClick={leaveReadonlyStory} />}
        </div>
        <div className="app-card-quiet mb-10 rounded-[2rem] p-6 text-sm leading-relaxed text-zinc-300">
          {story.meta?.main_axis || tr('暂无故事主轴摘要。', 'No story premise summary yet.')}
        </div>
        <div className="mb-8 flex justify-end">
          <ReadingTextControls />
        </div>
        {isReadonlyOwner && (
          <div className="app-card-quiet mb-8 rounded-[2rem] p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">{tr('馆藏管理', 'Archive Management')}</div>
                <div className="mt-1 text-sm font-bold text-zinc-300">
                  {tr('当前状态：', 'Current status: ')}{story.meta?.visibility === 'unlisted' ? tr('非公开链接，可通过链接访问', 'Unlisted link, accessible by URL') : tr('私人，仅当前账号可见', 'Private, only visible to this account')}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isReadonlyUpdating || story.meta?.visibility === 'private'}
                  onClick={() => handleArchiveVisibilityChange({ id: readonlyArchiveId }, 'private')}
                  className={semanticButtonClass('ghost', { compact: true })}
                >
                  <Lock className="h-4 w-4" />
                  {tr('设为私人', 'Set private')}
                </button>
                <button
                  type="button"
                  disabled={isReadonlyUpdating || story.meta?.visibility === 'unlisted'}
                  onClick={() => handleArchiveVisibilityChange({ id: readonlyArchiveId }, 'unlisted')}
                  className={semanticButtonClass('secondary', { compact: true })}
                >
                  <ExternalLink className="h-4 w-4" />
                  {tr('设为非公开链接', 'Set unlisted link')}
                </button>
                <button
                  type="button"
                  disabled={isSharing || isReadonlyUpdating}
                  onClick={shareExistingArchiveStory}
                  className={semanticButtonClass('primary', { compact: true })}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  {tr('分享', 'Share')}
                </button>
                <button
                  type="button"
                  disabled={isReadonlyUpdating}
                  onClick={deleteReadonlyArchiveStory}
                  className={semanticButtonClass('danger', { compact: true })}
                >
                  <Trash2 className="h-4 w-4" />
                  {tr('删除', 'Delete')}
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              {tr('分享会使用当前这条馆藏记录本身，不会重复创建新的通篇馆藏作品。', 'Sharing uses this archive record itself and will not create another full duplicate.')}
            </p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-14">
          {(story.chapters || []).map((chapter) => (
            <section key={chapter.chapter_num} className="reading-chapter relative">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-950/45 text-xs font-black text-zinc-500">
                  {chapter.chapter_num}
                </div>
                <h2 className="text-xl font-black text-zinc-100">{chapter.title || (isEnglish ? `Chapter ${chapter.chapter_num}` : `第${chapter.chapter_num}章`)}</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
              </div>
              <div className="space-y-5 text-zinc-300">
                {(chapter.text || '').split('\n').filter(Boolean).map((paragraph, idx) => (
                  <p key={idx} style={readingParagraphStyle} className="leading-relaxed">{renderReadingParagraph(paragraph, story.meta?.characters || [])}</p>
                ))}
              </div>
              <div className="reading-divider mt-12" />
            </section>
          ))}
        </div>
        <div className="app-card mt-12 rounded-[2rem] p-6 text-center">
          <h3 className="text-2xl font-black text-white">{tr('想亲手改变这条命运线吗？', 'Want to change this fate line?')}</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {tr('这页是只读故事记录。注册或登录后，可从原版故事开始干涉命运；若作者开放权限，也可一键改编成个人作品。', 'This is a read-only story record. After signing in, start from the original story to interfere with fate; if adaptation is allowed, it can also become a personal work.')}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={user ? handleInterveneFromReadonly : () => {
                setReadonlyStoryData(null);
                window.history.replaceState({}, '', window.location.pathname);
                resetToHome();
                showError(tr('请先注册或登录，然后再干涉故事。', 'Please sign in before interfering with the story.'));
              }}
              disabled={user ? !story.meta?.sourceStoryId : false}
              className={semanticButtonClass('primary', { compact: true })}
            >
              <Zap className="h-4 w-4" />
              {user ? tr('干涉原版故事', 'Interfere with original') : tr('登录后干涉', 'Sign in to interfere')}
            </button>
            <button
              type="button"
              onClick={user ? handleAdaptFromReadonly : () => {
                setReadonlyStoryData(null);
                window.history.replaceState({}, '', window.location.pathname);
                resetToHome();
                showError(tr('请先注册或登录，然后再改编故事。', 'Please sign in before adapting this story.'));
              }}
              className={semanticButtonClass('secondary', { compact: true })}
            >
              <Wand2 className="h-4 w-4" />
              {user ? (canAdaptReadonlyStory(story.meta) ? tr('一键改编', 'Adapt') : tr('未开放改编', 'Adaptation unavailable')) : tr('注册成用户', 'Create account')}
            </button>
            <button
              type="button"
              onClick={() => {
                setReadonlyStoryData(null);
                window.history.replaceState({}, '', window.location.pathname);
                resetToHome();
              }}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              <BookOpen className="h-4 w-4" />
              {tr('浏览故事库', 'Browse library')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const storyInfoPanel = (
    <AnimatePresence>
      {isStoryInfoOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 z-[2200] w-full max-w-sm border-l border-zinc-800 bg-zinc-950/90 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 pb-6 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))]">
              <h3 className="text-xl font-black text-white">{tr('故事信息', 'Story Info')}</h3>
              <button
                type="button"
                onClick={() => setIsStoryInfoOpen(false)}
                className={semanticIconButtonClass('ghost')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {blueprint && (
                <>
                  <section className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{tr('故事背景', 'Story Background')}</h4>
                    <p className="text-sm leading-relaxed text-zinc-300">{blueprint.main_axis}</p>
                  </section>
                  <section className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{tr('作者预设倾向', 'Author Tendency')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {endingBiasStoryCardLabels(blueprint).map((bias) => (
                        <div
                          key={bias.side}
                          className={`rounded-2xl border p-4 ${
                            bias.side === 'left'
                              ? 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100'
                              : bias.side === 'right'
                                ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                                : 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100'
                          }`}
                        >
                          <div className="text-[11px] font-black text-zinc-400">{bias.label}</div>
                          <div className="mt-1 text-lg font-black">{bias.value}</div>
                        </div>
                      ))}
                    </div>
                    {isSingleEndingStory(blueprint) && (
                      <p className="text-xs leading-relaxed text-zinc-500">
                        {tr('本作采用唯一走向，干涉会改变过程、角色经历与支线展开，但最终会自然收束到唯一结局。', 'This work uses a fixed-ending path; interference changes the journey, character experience, and branches, but ultimately converges to one ending.')}
                      </p>
                    )}
                    {!isSingleEndingStory(blueprint) && (
                    <p className="text-xs leading-relaxed text-zinc-500">
                      {tr('这是作者为左域与右域设置的基础倾向，只作为命运走向参考，不代表最终结局必然落点。', 'This is the author’s base tendency for left/right ending domains. It is a reference, not a guaranteed final outcome.')}
                    </p>
                    )}
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{tr('登场角色', 'Characters')}</h4>
                    <div className="grid gap-3">
                      {blueprint.characters.map(char => (
                        <div key={char.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                          <div className="mb-1 flex items-start justify-between">
                            <div className="font-bold text-indigo-300">{char.name}</div>
                            {characterStatuses[char.id] && (
                              <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {characterStatuses[char.id].status || tr('在场', 'Present')}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 leading-relaxed">{char.desc}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{tr('命运支线', 'Fate Branches')}</h4>
                    <div className="grid gap-3">
                      {(blueprint.branches || []).length === 0 ? (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
                          {tr('暂无支线记录。', 'No branch records yet.')}
                        </div>
                      ) : (
                        (blueprint.branches || []).filter((branch: any) => {
                          const isUnlocked = unlockedBranches.some((item: any) => item.id === branch.id);
                          const wasUnlocked = historicallyUnlockedBranches.some((item: any) => item.id === branch.id);
                          const isHidden = branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden;
                          return !isHidden || isUnlocked || wasUnlocked;
                        }).map((branch: any) => {
                          const isUnlocked = unlockedBranches.some((item: any) => item.id === branch.id);
                          const wasUnlocked = historicallyUnlockedBranches.some((item: any) => item.id === branch.id);
                          const isHidden = branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden;
                          const canRevealBranchContent = isUnlocked || wasUnlocked;
                          const visibleName = isHidden && !canRevealBranchContent ? tr('隐藏支线', 'Hidden branch') : branch.name;
                          const visibleDesc = canRevealBranchContent
                            ? (branch.desc || branch.sceneText || branch.hint || tr('尚无支线描述。', 'No branch description yet.'))
                            : (branch.hint || tr('继续干涉命运，寻找这条支线的触发契机。', 'Keep interfering with fate to find the trigger for this branch.'));
                          return (
                            <div
                              key={branch.id || branch.name}
                              className={`rounded-2xl border p-4 ${
                                isUnlocked
                                  ? 'border-indigo-500/40 bg-indigo-950/30'
                                  : wasUnlocked
                                    ? 'border-zinc-700 bg-zinc-900/60'
                                    : 'border-zinc-800 bg-zinc-900/30'
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="font-bold text-zinc-100">{visibleName}</div>
                                <div className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                  isUnlocked
                                    ? 'bg-indigo-500/20 text-indigo-200'
                                    : wasUnlocked
                                      ? 'bg-zinc-700/60 text-zinc-300'
                                      : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                  {isUnlocked ? tr('已解锁', 'Unlocked') : wasUnlocked ? tr('曾解锁', 'Previously unlocked') : tr('待解锁', 'Locked')}
                                </div>
                              </div>
                              <div className="text-xs leading-relaxed text-zinc-500">{visibleDesc}</div>
                              {canRevealBranchContent && (
                                <div className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5 space-y-1">
                                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                                    {tr('解锁方法：', 'Unlock Method: ')}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                                    {(() => {
                                      const triggers = branch.triggerGroups || (branch.trigger ? [branch.trigger] : []);
                                      if (triggers.length === 0) return <div className="italic text-zinc-650">{tr('无判定条件', 'No trigger conditions')}</div>;
                                      return triggers.map((tg: any, tIdx: number) => (
                                        <div key={tIdx} className="flex items-start gap-1">
                                          <span className="text-zinc-600">•</span>
                                          <span>{formatTriggerCondition(tg, blueprint.characters || [], isEnglish)}</span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              )}
                              {canRevealBranchContent && (
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">
                                    {branch.side === 'left' ? tr('左域支线', 'Left branch') : tr('右域支线', 'Right branch')}
                                  </span>
                                  <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-200">
                                    {tr('影响：', 'Impact: ')}{branchTierLabel(branch.tier)}
                                  </span>
                                  <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-200">
                                    {tr('导向', 'Leads to')} {authoringEndingIdToLabel(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || branch.side)}
                                  </span>
                                  {(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden) && (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">{tr('隐藏支线', 'Hidden branch')}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const notificationUnreadCount = notificationItems.filter((item) => !item.readAt).length;

  const notificationBellButton = (size: 'sm' | 'md' = 'sm') => (
    <button
      type="button"
      onClick={() => void openNotificationCenter()}
      aria-label={tr('打开通知', 'Open notifications')}
      className={`relative inline-flex ${size === 'md' ? 'h-12 w-12' : 'h-11 w-11'} items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 transition-colors hover:border-indigo-400/60 hover:text-white backdrop-blur-md`}
    >
      <Bell className="h-5 w-5" />
      {notificationUnreadCount > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full border border-zinc-950 bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg">
          {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
        </span>
      )}
    </button>
  );

  const actionMenuButton = (
    <div className="play-top-bar flex items-center justify-between gap-3">
      {gameState === 'PLAYING' && (
        <button
          type="button"
          onClick={() => setShowLeaveGameModal(true)}
          aria-label={tr('返回作品库', 'Back to library')}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="flex items-center gap-2">
        {gameState === 'PLAYING' && (
          <button
            type="button"
            onClick={() => setIsStoryInfoOpen(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 text-sm font-bold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
          >
            <BookOpen className="h-4 w-4" />
            {tr('故事信息', 'Story Info')}
          </button>
        )}
        <button
          type="button"
          onClick={openSystemSettings}
          aria-label={tr('打开系统设置', 'Open system settings')}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <Settings className="h-5 w-5" />
        </button>
        {notificationBellButton('md')}
        <button
          type="button"
          onClick={() => setIsActionMenuOpen(true)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </div>
  );

  const accountEntryButton = user && gameState !== 'PLAYING' ? (
    <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[2100] flex items-center gap-2 sm:right-6">
      {notificationBellButton('sm')}
      <button
        type="button"
        onClick={openSystemSettings}
        aria-label={tr('打开系统设置', 'Open system settings')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  ) : null;

  const shouldShowPrimaryBottomDock = Boolean(user && !['PLAYING', 'READONLY_STORY', 'GENERATING_BLUEPRINT', 'SUMMARY'].includes(gameState));
  const primaryBottomDock = shouldShowPrimaryBottomDock && typeof document !== 'undefined'
    ? createPortal(
      <div className="primary-bottom-dock-wrap">
        <AnimatePresence>
          {isCreationDockOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="primary-bottom-dock-menu"
            >
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreationDockOpen(false);
                    navigateTo('THEME_SELECTION');
                  }}
                  className={semanticMenuButtonClass('primary')}
                >
                  <Wand2 className="h-4 w-4" />
                  {tr('快速生成故事', 'Quick story')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreationDockOpen(false);
                    void openSeriesWorldCreateView();
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <GitBranch className="h-4 w-4" />
                  {tr('创建世界观', 'Create world setting')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreationDockOpen(false);
                    void enterAuthoring();
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <PenSquare className="h-4 w-4" />
                  {tr('作者后台', 'Author studio')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="primary-bottom-dock-shell">
          <button
            type="button"
            onClick={() => {
              setIsCreationDockOpen(false);
              resetToHome();
            }}
            className={`primary-bottom-dock-item ${gameState === 'STORY_SELECT' ? 'is-active' : ''}`}
          >
            <BookOpen className="h-4 w-4" />
            {tr('作品首页', 'Library')}
          </button>
          <button
            type="button"
            onClick={() => setIsCreationDockOpen((prev) => !prev)}
            className={`primary-bottom-dock-item is-default ${isCreationDockOpen || ['THEME_SELECTION', 'AUTHORING', 'SERIES_WORLD_GENERATE', 'SERIES_WORLD_EDIT', 'SERIES_WORLD_LIST'].includes(gameState) ? 'is-active' : ''}`}
          >
            <Sparkles className="h-4 w-4" />
            {tr('创作工台', 'Create')}
          </button>
          <button
            type="button"
            onClick={openPersonalCenter}
            className={`primary-bottom-dock-item ${gameState === 'ACCOUNT_CENTER' ? 'is-active' : ''}`}
          >
            <UserIcon className="h-4 w-4" />
            {tr('个人中心', 'Profile')}
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  const floatingInterventionPanel = blueprint && gameState === 'PLAYING' && typeof document !== 'undefined'
    ? createPortal(
      <div className="destiny-dock play-destiny-dock rounded-full px-3 py-1.5 backdrop-blur-xl">
        <div className="flex min-h-9 items-center justify-between gap-2 px-1">
          <div className="shrink-0 text-xs font-black text-zinc-300 sm:text-sm">
            {interventionsLeft}/3 {tr('干涉数', 'interventions')}
          </div>
          <div className="min-w-0 flex-1 text-center text-xs font-black sm:text-sm">
            {(() => {
              if (isSingleEndingStory(blueprint)) {
                return <span className="text-indigo-300/90">{tr('唯一走向', 'Fixed-ending path')}</span>;
              }
              if (storyConclusion || interventionsLeft <= 0) {
                const domain = endingDomainFromValue(endingValue);
                return <span className={domain === 'left' ? 'text-indigo-300/90' : domain === 'right' ? 'text-rose-300/90' : 'text-zinc-300'}>{endingDomainUserLabel(domain)}</span>;
              }
              const left = Math.round(uiFeedback.leftProgress || 0);
              const right = Math.round(uiFeedback.rightProgress || 0);
              if (left <= 0 && right <= 0) return <span className="text-zinc-400">{tr('中域', 'Middle domain')}</span>;
              if (left >= right) return <span className="text-indigo-300/85">{isEnglish ? `Left ${left}%` : `左${left}%`}</span>;
              return <span className="text-rose-300/85">{isEnglish ? `Right ${right}%` : `右${right}%`}</span>;
            })()}
          </div>
          <button
            type="button"
            onClick={() => handleGenerateSummary(interventionsLeft > 0 ? 'manual' : 'auto_interventions')}
            disabled={isRewriting || isGeneratingConclusion || !activeStoryId}
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-9 ${
              storyConclusion || interventionsLeft <= 0
                ? 'border border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-zinc-500'
                : 'bg-zinc-100 text-zinc-950 hover:bg-white'
            }`}
          >
            {isGeneratingConclusion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {storyConclusion || interventionsLeft <= 0 ? t('play.finalFate') : t('play.confirmFate')}
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  const renderPlayingView = () => (
    <div className="reading-page relative mx-auto max-w-4xl rounded-b-[2.5rem] px-6 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] sm:px-8 sm:pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      {blueprint && (
        <div className="mb-10 space-y-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-full bg-indigo-500/10 px-4 py-1 text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase"
          >
            {tr('正在干涉世界线', 'Interfering with the timeline')}
          </motion.div>
          <h1 className="text-4xl font-black text-white sm:text-6xl">{formatBookTitle(blueprint.title)}</h1>
          <div className="text-sm font-bold text-zinc-500">
            <AuthorNameButton
              authorId={(activeStoryMeta || { authorId: user?.uid }).authorId}
              authorName={getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedThemes.map(tag => (
              <span key={tag} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8 flex justify-end">
        <ReadingTextControls />
      </div>

      <div className="mx-auto max-w-3xl space-y-10">
        {chapters.map((chapter, idx) => (
          <motion.section
            id={`chapter-${chapter.chapter_num}`}
            key={chapter.chapter_num || idx}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="reading-chapter group relative"
          >
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-950/45 text-xs font-black text-zinc-500 transition-colors group-hover:border-indigo-500/40 group-hover:text-indigo-300">
                {chapter.chapter_num}
              </div>
              <h2 className="text-xl font-bold text-zinc-100">{chapter.title || (isEnglish ? `Chapter ${chapter.chapter_num}` : `第${chapter.chapter_num}章`)}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
            </div>
            
            <div className="relative leading-relaxed text-zinc-300">
              <div className="prose prose-invert max-w-none space-y-6">
                {isChapterTextReady(chapter) ? (
                  String(chapter.text || '').split('\n').filter(Boolean).map((p, pIdx) => (
                    <p key={pIdx} style={readingParagraphStyle} className={`leading-relaxed ${isEnglish ? '' : 'first-letter:text-3xl first-letter:font-black first-letter:text-indigo-400 first-letter:mr-1'}`}>
                      {renderReadingParagraph(p, blueprint?.characters, changeHighlights[chapter.chapter_num] || [])}
                    </p>
                  ))
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5 text-sm font-bold text-indigo-100">
                    <Loader2 className={`h-5 w-5 ${backgroundGeneratingChapter === chapter.chapter_num ? 'animate-spin' : ''}`} />
                    {backgroundGeneratingChapter === chapter.chapter_num
                      ? (isEnglish ? `Chapter ${chapter.chapter_num} is generating and will appear when ready.` : `第${chapter.chapter_num}章正在生成中，完成后会自动出现。`)
                      : (isEnglish ? `Chapter ${chapter.chapter_num} is queued for generation.` : `第${chapter.chapter_num}章已排入生成队列。`)}
                  </div>
                )}
              </div>

              {(() => {
                if (gameState !== 'PLAYING' || !blueprint) return null;

                const availableCharacters = getChapterAvailableCharacters(chapter, blueprint);

                const canInterveneInChapter =
                  chapter.chapter_num >= 2 &&
                  chapter.chapter_num <= 6 &&
                  interventionsLeft > 0 &&
                  !storyConclusion &&
                  availableCharacters.length > 0;

                if (!canInterveneInChapter) return null;

                const isExpanded = activeInterventionChapter === chapter.chapter_num;
                const isAlreadyIntervened = intervenedChapters.includes(chapter.chapter_num);

                return (
                  <div className="mt-10">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setActiveInterventionChapter(isExpanded ? null : chapter.chapter_num)}
                        disabled={isRewriting || isGeneratingConclusion || activeInterventionOverlay !== null}
                        className={`${semanticButtonClass(isAlreadyIntervened ? 'secondary' : 'primary', { compact: true })} rounded-full px-5`}
                      >
                        <Sparkles className="h-4 w-4" />
                        {isAlreadyIntervened ? (appLanguage === 'en-US' ? 'Interfere again' : '再次干涉') : t('library.intervene')}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`intervention-${chapter.chapter_num}`}
                          initial={{ opacity: 0, height: 0, y: 8 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-6 flex w-full flex-col items-center gap-6 rounded-[1.75rem] border border-zinc-800/70 bg-zinc-950/40 p-5 sm:p-6">
                            <div className="max-w-xl text-center">
                              <div className="mb-1 text-sm font-black text-zinc-100">{tr('因果节点已就绪', 'Causal node ready')}</div>
                              <div className="text-xs leading-relaxed text-zinc-500">
                                {tr('请选择本章登场角色，再决定施加庇佑或磨难。支线提示只作为命运走向的参考，不会直接写进故事表面。', 'Choose a character in this chapter, then apply blessing or hardship. Branch hints guide fate direction but are not written directly into the story surface.')}
                              </div>
                            </div>
                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {availableCharacters.map((char) => {
                                  const branchHints = Array.from(new Set(
                                    (blueprint.branches || []).flatMap((branch) => {
                                      const triggers = branch.triggerGroups || (branch.trigger ? [branch.trigger] : []);
                                      if (triggers.length === 0) {
                                        if (branch.condition_chapter === chapter.chapter_num && branch.condition_char === char.id && branch.hint) {
                                          return [branch.hint];
                                        }
                                        return [];
                                      }
                                      const matched: string[] = [];
                                      for (const tg of triggers) {
                                        let isMatch = false;
                                        if (tg.type === 'single' || (!tg.type && tg.single)) {
                                          const s = tg.single || {};
                                          if (s.chapterNum === chapter.chapter_num && s.charId === char.id) {
                                            isMatch = true;
                                          }
                                        } else if (tg.type === 'count' || (!tg.type && tg.count)) {
                                          const c = tg.count || {};
                                          if (c.charId === char.id && chapter.chapter_num <= (c.upToChapterNum || 6)) {
                                            isMatch = true;
                                          }
                                        }
                                        if (isMatch) {
                                          const h = tg.hint || branch.hint;
                                          if (h) matched.push(h);
                                        }
                                      }
                                      return matched;
                                    })
                                  )).filter(Boolean).slice(0, 2);

                                return (
                                  <div key={char.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                                    <div className="mb-3">
                                      <div className="flex items-start justify-between">
                                        <div className="text-sm font-black text-zinc-100">{char.name}</div>
                                        {characterStatuses[char.id] && (
                                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {characterStatuses[char.id].status || tr('在场', 'Present')}
                                          </div>
                                        )}
                                      </div>
                                      {branchHints.length > 0 && (
                                        <div className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
                                          {branchHints.map((hint, hintIdx) => (
                                            <div key={`${char.id}-hint-${hintIdx}`}>{hint}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleIntervene(chapter.chapter_num, char.id, 'bless')}
                                        disabled={interventionsLeft <= 0 || isRewriting}
                                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm font-black text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15 disabled:opacity-30"
                                      >
                                        <Zap className="h-4 w-4" />
                                        {tr('庇佑', 'Bless')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleIntervene(chapter.chapter_num, char.id, 'curse')}
                                        disabled={interventionsLeft <= 0 || isRewriting}
                                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm font-black text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/15 disabled:opacity-30"
                                      >
                                        <Skull className="h-4 w-4" />
                                        {tr('磨难', 'Hardship')}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}
              {idx < chapters.length - 1 && <div className="reading-divider mt-8" />}
            </div>
          </motion.section>
        ))}
      </div>

      {gameState === 'PLAYING' && intervenedChapters.length >= 3 && (
        <div className="mt-12 text-center">
          <button
            onClick={() => handleGenerateSummary('auto_interventions')}
            className="group relative inline-flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-lg font-black text-black shadow-2xl transition-all hover:scale-105"
          >
            <Sparkles className="h-6 w-6 text-indigo-500 group-hover:animate-pulse" />
            {t('play.finalFate')}
          </button>
        </div>
      )}
      {blueprint && (
        <div className="app-card-quiet mt-10 rounded-3xl p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-white">{formatBookTitle(blueprint.title)}</div>
              <div className="text-xs font-bold text-zinc-500">
                <AuthorNameButton
                  authorId={(activeStoryMeta || { authorId: user?.uid }).authorId}
                  authorName={getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}
                />
              </div>
            </div>
            <div className="text-xs text-zinc-600">{tr('平均每章', 'Avg. per chapter')} {getAverageChapterWords(chapters) || tr('未知', 'unknown')} {tr('字', 'words')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => handleStoryInteraction('like')} className={`${semanticButtonClass(isCurrentStoryActive('like') ? 'secondary' : 'ghost', { compact: true })} ${isCurrentStoryActive('like') ? 'text-pink-200' : ''}`}>
              <Heart className={`h-4 w-4 ${isCurrentStoryActive('like') ? 'fill-current' : ''}`} /> {tr('点赞', 'Like')}
            </button>
            <button type="button" onClick={() => handleStoryInteraction('favorite')} className={`${semanticButtonClass(isCurrentStoryActive('favorite') ? 'secondary' : 'ghost', { compact: true })} ${isCurrentStoryActive('favorite') ? 'text-amber-200' : ''}`}>
              <Bookmark className={`h-4 w-4 ${isCurrentStoryActive('favorite') ? 'fill-current' : ''}`} /> {tr('收藏原作', 'Favorite original')}
            </button>
            <button type="button" onClick={handleShareStory} disabled={isSharing || !blueprint} className={semanticButtonClass('secondary', { compact: true })}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} {tr('分享', 'Share')}
            </button>
            <button type="button" onClick={handleSaveWorkAndReturn} className={semanticButtonClass('secondary', { compact: true })}>
              <Archive className="h-4 w-4" /> {t('play.archiveFate')}
            </button>
            {!activeStoryId && (
              <button type="button" onClick={handleRegenerateQuickStory} className={semanticButtonClass('ghost', { compact: true })}>
                <RefreshCcw className="h-4 w-4" /> {tr('重新生成', 'Regenerate')}
              </button>
            )}
            <button type="button" onClick={handleAdaptCurrentStory} disabled={isAdaptCurrentStoryUnavailable()} className={semanticButtonClass('secondary', { compact: true })}>
              {isLoadingStories ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {canAdaptCurrentStory() ? tr('一键改编', 'Adapt') : tr('未开放改编', 'Adaptation unavailable')}
            </button>
            <button type="button" onClick={() => handleStoryInteraction('report')} className={semanticButtonClass('danger', { compact: true })}>
              <Flag className="h-4 w-4" /> {tr('举报', 'Report')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSummaryView = () => (
    <div className="mx-auto max-w-4xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] sm:px-8">
      <div className="mb-10 text-center space-y-4">
        <div className="inline-block rounded-full bg-amber-500/10 px-4 py-1 text-[10px] font-bold tracking-[0.2em] text-amber-500 uppercase">
          {tr('命运之卷已封存', 'Fate volume sealed')}
        </div>
        <h1 className="text-4xl font-black text-white sm:text-6xl">{tr('最终命运总结', 'Final Fate Summary')}</h1>
      </div>

      <div className="relative rounded-[3rem] border border-zinc-800 bg-zinc-900/30 p-10 shadow-2xl backdrop-blur-xl sm:p-12">
        {isGeneratingConclusion ? (
          <div className="flex h-64 flex-col items-center justify-center gap-6">
            <Loader2 className="h-10 w-10 animate-spin text-zinc-700" />
            <p className="text-sm font-bold text-zinc-500">{generationStatus}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-800" />
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">时空回响</h2>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <div className="prose prose-invert max-w-none text-xl font-medium leading-relaxed italic text-amber-200/90">
                {String(storyConclusion || '').split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <button
                onClick={handleShareStory}
                disabled={isSharing}
                className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:scale-[1.02]"
              >
                {isSharing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Copy className="h-6 w-6" />}
                分享这段命运
              </button>
              <button
                onClick={resetGame}
                className="flex items-center justify-center gap-3 rounded-2xl bg-zinc-800 py-5 text-lg font-black text-zinc-200 transition-all hover:bg-zinc-700 hover:scale-[1.02]"
              >
                <RefreshCcw className="h-6 w-6" />
                开启新轮回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderBranchForm = (isNew: boolean) => (
    <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black text-white">{isNew ? tr('新建支线', 'New branch') : tr('编辑支线', 'Edit branch')}</div>
        <button type="button" onClick={() => setExpandedBranchId(null)} className={semanticButtonClass('ghost', { compact: true })}>
          <X className="h-4 w-4" />
          {tr('取消', 'Cancel')}
        </button>
      </div>
      <div>
        <input value={branchForm.name} onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder={tr('支线名', 'Branch name')} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={branchForm.side} onChange={(event) => setBranchForm((prev) => ({ ...prev, side: event.target.value as 'left' | 'right' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
          <option value="left">{tr('左域支线', 'Left-domain branch')}</option>
          <option value="right">{tr('右域支线', 'Right-domain branch')}</option>
        </select>
        <select value={branchForm.tier} onChange={(event) => setBranchForm((prev) => ({ ...prev, tier: event.target.value as 'small' | 'medium' | 'large' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
          <option value="small">{tr('影响：小', 'Impact: small')}</option>
          <option value="medium">{tr('影响：中', 'Impact: medium')}</option>
          <option value="large">{tr('影响：大', 'Impact: large')}</option>
        </select>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={branchForm.isHidden}
          onChange={(event) => setBranchForm((prev) => ({ ...prev, isHidden: event.target.checked }))}
          className="mt-1 h-4 w-4 accent-amber-500"
        />
        <span>
          <span className="block font-black text-amber-200">{tr('隐藏支线', 'Hidden branch')}</span>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{tr('隐藏支线不会提前暴露完整内容；玩家需要在游玩中触发后，才会看到这条支线的具体情节。', 'Hidden branches do not reveal full content early. Players see the details only after triggering them during play.')}</span>
        </span>
      </label>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <label className="block space-y-2 text-sm font-bold text-zinc-300">
          <span>{tr('导向结局绑定', 'Ending binding')}</span>
          <select
            value={branchForm.endingId}
            onChange={(event) => setBranchForm((prev) => ({ ...prev, endingId: event.target.value }))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">{tr('自动进入该域的默认结局', 'Auto-use the default ending in this domain')}</option>
            {(authoringCartridge?.endings || []).map((ending: any) => (
              <option key={ending.id} value={ending.id}>
                {tr('绑定', 'Bind')} {ending.title || authoringEndingIdToLabel(ending.id)}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tr('支线可以只影响左域/右域走向，也可以进一步绑定到某个具体结局。没有绑定时，会自动进入该域的默认结局。', 'A branch can affect only left/right direction, or bind to a specific ending. Without a binding, it uses that domain’s default ending.')}</p>
      </div>
      <textarea value={branchForm.sceneText} onChange={(event) => setBranchForm((prev) => ({ ...prev, sceneText: event.target.value }))} className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500" placeholder={tr('支线情节（300 字以内）', 'Branch scene (within 300 words)')} />
      <div className="space-y-3">
        <div className="text-sm font-black text-white">{tr('触发条件', 'Trigger Conditions')}</div>
        {branchConditions.map((condition, idx) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-black text-zinc-500">{tr('条件组', 'Condition group')} {idx + 1}</div>
              {branchConditions.length > 1 && (
                <button type="button" onClick={() => setBranchConditions((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))} className={semanticButtonClass('danger', { compact: true })}>
                  <Trash2 className="h-4 w-4" />
                  {tr('删除条件', 'Delete condition')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select value={condition.kind} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, kind: event.target.value as 'single' | 'count' } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 min-w-[120px]">
                <option value="single">{tr('单次判定', 'Single check')}</option>
                <option value="count">{tr('累计判定', 'Cumulative check')}</option>
              </select>
              <select value={condition.kind === 'single' ? condition.singleChapterNum : condition.upToChapterNum} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleChapterNum: Number(event.target.value) } : { ...item, upToChapterNum: Number(event.target.value) }) : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 min-w-[100px]">
                {chapterOptions.map((chapterNum) => <option key={chapterNum} value={chapterNum}>{isEnglish ? `Chapter ${chapterNum}` : `第${chapterNum}章`}</option>)}
              </select>
              <select value={condition.kind === 'single' ? condition.singleCharId : condition.countCharId} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleCharId: event.target.value } : { ...item, countCharId: event.target.value }) : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 min-w-[140px]">
                <option value="">{tr('选择角色', 'Choose character')}</option>
                {normalizeCharacters(authoringCartridge?.meta?.characters || []).map((character: any) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
              {condition.kind === 'single' ? (
                <select value={condition.singleAction} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, singleAction: event.target.value as 'bless' | 'curse' } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 min-w-[100px]">
                  <option value="bless">{tr('庇佑', 'Bless')}</option>
                  <option value="curse">{tr('磨难', 'Hardship')}</option>
                </select>
              ) : (
                <>
                  <select value={condition.countAction} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, countAction: event.target.value as 'bless' | 'curse' } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 min-w-[100px]">
                    <option value="bless">{tr('庇佑', 'Bless')}</option>
                    <option value="curse">{tr('磨难', 'Hardship')}</option>
                  </select>
                  <input type="number" min={1} value={condition.minCount} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, minCount: Math.max(1, Number(event.target.value) || 1) } : item))} className="w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" placeholder={tr('累计次数', 'Count')} />
                </>
              )}
            </div>
            <div>
              <input
                type="text"
                value={condition.hint || ''}
                onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, hint: event.target.value } : item))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-white outline-none focus:border-indigo-500"
                placeholder={tr('提示（可选，在触发条件中设置，多条件时可针对不同条件设置提示）', 'Hint (optional, set in trigger conditions. Multi-conditions can have different hints)')}
              />
            </div>
            <div className="text-xs text-indigo-300">
              {triggerPreview({
                triggerType: condition.kind,
                singleChapterNum: condition.singleChapterNum,
                singleCharId: condition.singleCharId,
                singleAction: condition.singleAction,
                countCharId: condition.countCharId,
                countAction: condition.countAction,
                minCount: condition.minCount,
                upToChapterNum: condition.upToChapterNum,
                characters: normalizeCharacters(authoringCartridge?.meta?.characters || []),
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setBranchConditions((prev) => prev.length >= 3 ? prev : [...prev, { kind: 'single', singleChapterNum: 2, singleCharId: '', singleAction: 'bless', countCharId: '', countAction: 'bless', minCount: 1, upToChapterNum: 6 }])} className={semanticButtonClass('ghost', { compact: true })}>
          {tr('新增条件组', 'Add condition group')}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!authoringStoryId || !branchForm.name.trim()) {
              showError(tr('请先填写支线名。', 'Please enter a branch name first.'));
              return;
            }
            const payload = {
              side: branchForm.side,
              tier: normalizeBranchTier(branchForm.tier),
              is_hidden: branchForm.isHidden,
              endingId: branchForm.endingId || undefined,
              name: branchForm.name,
              desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
              common: false,
              hint: '',
              trigger: normalizeBranchConditionsForStorage(branchConditions)[0],
              triggerGroups: normalizeBranchConditionsForStorage(branchConditions),
              inject: { mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [], mustReveal: [], mustChange: [], hidden: branchForm.isHidden, endingId: branchForm.endingId || undefined },
              sceneText: branchForm.sceneText,
            } as any;
            if (isNew) {
              const newId = await createStoryBranch(db as any, authoringStoryId, payload);
              await selectAuthoringStory(authoringStoryId, { keepTab: true, keepBranchSelection: false });
              setExpandedBranchId(null);
              showError(tr('支线已创建。', 'Branch created.'));
            } else {
              await upsertStoryBranch(db as any, authoringStoryId, branchForm.id, payload);
              await selectAuthoringStory(authoringStoryId, { keepTab: true, keepBranchSelection: true });
              showError(tr('支线已保存。', 'Branch saved.'));
            }
          }}
          className={semanticButtonClass('primary', { compact: true })}
        >
          {isNew ? tr('创建支线', 'Create branch') : tr('保存修改', 'Save changes')}
        </button>
      </div>
    </div>
  );

  const getFilteredAuthoringStories = () => {
    const query = authoringListSearch.trim().toLowerCase();
    const getAuthoringStorySeriesId = (story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '').trim();
    return [...myStories]
      .filter((story: any) => {
        const seriesId = getAuthoringStorySeriesId(story);
        if (authoringSeriesKindFilter === 'standalone' && seriesId) return false;
        if (authoringSeriesKindFilter === 'series' && !seriesId) return false;
        if (authoringSeriesWorldFilter !== 'all' && seriesId !== authoringSeriesWorldFilter) return false;
        if (authoringListVisibilityFilter !== 'all' && (story.visibility || 'private') !== authoringListVisibilityFilter) return false;
        if (authoringCreatedFilter !== 'all') {
          const createdAt = getStoryCreatedMs(story);
          const maxAgeMs = authoringCreatedFilter === '7d'
            ? 7 * 24 * 60 * 60 * 1000
            : authoringCreatedFilter === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : 365 * 24 * 60 * 60 * 1000;
          if (!createdAt || Date.now() - createdAt > maxAgeMs) return false;
        }
        if (!query) return true;
        const haystack = [
          getStoryTitle(story),
          story?.authorName,
          story?.mainAxis,
          ...(story?.tags || story?.meta?.tags || []),
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .sort((a: any, b: any) => {
        if (authoringListSort === 'created') return getStoryCreatedMs(b) - getStoryCreatedMs(a);
        if (authoringListSort === 'likes') return getStoryLikeCount(b) - getStoryLikeCount(a);
        if (authoringListSort === 'favorites') return getStoryFavoriteCount(b) - getStoryFavoriteCount(a);
        if (authoringListSort === 'shares') return getStoryShareCount(b) - getStoryShareCount(a);
        if (authoringListSort === 'interventions') return getStoryInterventionCount(b) - getStoryInterventionCount(a);
        return getStoryUpdatedMs(b) - getStoryUpdatedMs(a);
      });
  };

  const getAuthoringStorySeriesId = (story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '').trim();
  const getAuthoringStorySeriesName = (story: any) => {
    const seriesId = getAuthoringStorySeriesId(story);
    if (!seriesId) return tr('单独作品', 'Standalone');
    return seriesWorlds.find((series) => series.id === seriesId)?.title || tr('世界观作品', 'World setting work');
  };

  const renderAuthoringStatChip = (label: string, value: string | number, Icon: any, tone = 'text-zinc-300') => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/55 px-2.5 py-1 text-[11px] font-black text-zinc-300">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-100">{value}</span>
    </span>
  );

  const renderAuthorPulsePanel = () => {
    if (authorPulseNotifications.length === 0) return null;
    return (
      <div className="mb-5 grid gap-2">
        {authorPulseNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`app-card flex items-start justify-between gap-3 rounded-2xl px-4 py-3 ${
              notification.tone === 'like'
                ? 'border-rose-400/25 bg-rose-500/10'
                : notification.tone === 'favorite'
                ? 'border-amber-400/25 bg-amber-500/10'
                : notification.tone === 'share'
                ? 'border-cyan-400/25 bg-cyan-500/10'
                : notification.tone === 'intervention'
                ? 'border-indigo-400/25 bg-indigo-500/10'
                : 'border-emerald-400/25 bg-emerald-500/10'
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-full border border-white/10 bg-white/10 p-2">
                <Bell className="h-4 w-4 text-zinc-100" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{notification.title}</div>
                <div className="mt-1 text-xs font-semibold leading-relaxed text-zinc-300">{notification.detail}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissAuthorPulseNotification(notification.id)}
              className="rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 active:scale-95"
              aria-label="关闭通知"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const AuthorNameButton = ({ authorId, authorName, prefix = '作者：' }: { authorId?: string | null; authorName?: string; prefix?: string }) => (
    <span className="inline-flex items-center gap-1">
      {prefix}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openAuthorProfile(authorId, authorName);
        }}
        className="font-black text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-indigo-200 hover:decoration-indigo-300"
      >
        {authorName || (authorId ? `游客+${shortUserId(authorId)}` : '未知作者')}
      </button>
    </span>
  );

  const renderAuthorProfileModal = () => (
    <AnimatePresence>
      {authorProfileTarget && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5400] bg-black/65 backdrop-blur-md`}
          onClick={() => setAuthorProfileTarget(null)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-xl overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('作者档案', 'Author Profile')}</div>
                <h3 className="mt-2 text-2xl font-black text-white">{authorProfileTarget.authorName}</h3>
                {authorProfileBio && (
                  <p className="mt-1.5 text-xs text-indigo-200/90 italic">
                    「 {authorProfileBio} 」
                  </p>
                )}
                <p className="mt-2 text-xs font-semibold text-zinc-500">{tr('查看这个作者公开或非公开链接作品，并决定是否追踪后续更新。', 'View this author’s public or unlisted works, and decide whether to follow future updates.')}</p>
              </div>
              <button type="button" onClick={() => setAuthorProfileTarget(null)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭作者档案', 'Close author profile')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {authorProfileTarget.authorId !== user?.uid && (
                <button type="button" onClick={toggleAuthorFollow} disabled={authorProfileBusy} className={semanticButtonClass(authorProfileFollowing ? 'secondary' : 'primary', { compact: true })}>
                  {authorProfileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  {authorProfileFollowing ? tr('已追踪', 'Following') : tr('追踪作者', 'Follow author')}
                </button>
              )}
            </div>
            {authorProfileLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-sm font-black text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                {isEnglish ? 'Loading author works...' : '正在读取作者作品...'}
              </div>
            ) : authorProfileStories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm font-semibold text-zinc-500">
                {tr('暂时没有可查看的作者作品。', 'No viewable works from this author yet.')}
              </div>
            ) : (
              <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1">
                {authorProfileStories.map((story: any) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => {
                      setAuthorProfileTarget(null);
                      void startStoryPlay(story.id);
                    }}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-left transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/10"
                  >
                    <div className="font-black text-zinc-100">{formatBookTitle(getStoryTitle(story))}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black text-zinc-500">
                      <span>{tr('点赞', 'Likes')} {getStoryLikeCount(story)}</span>
                      <span>{tr('收藏', 'Favorites')} {getStoryFavoriteCount(story)}</span>
                      <span>{tr('分享', 'Shares')} {getStoryShareCount(story)}</span>
                      <span>{tr('干涉', 'Interventions')} {getStoryInterventionCount(story)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderNotificationCenter = () => (
    <AnimatePresence>
      {notificationCenterOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5500] bg-black/65 backdrop-blur-md`}
          onClick={() => setNotificationCenterOpen(false)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('通知', 'Notifications')}</div>
                <h3 className="mt-2 text-2xl font-black text-white">{tr('命运动态', 'Fate Updates')}</h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500">{tr('点赞、收藏、分享、追踪作者更新和创作提醒都会集中在这里。', 'Likes, favorites, shares, followed author updates, and creation nudges gather here.')}</p>
              </div>
              <button type="button" onClick={() => setNotificationCenterOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭通知', 'Close notifications')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => void refreshNotificationCenter()} className={semanticButtonClass('ghost', { compact: true })} disabled={notificationLoading}>
                {notificationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {tr('刷新通知', 'Refresh')}
              </button>
              <button type="button" onClick={() => void markAllNotificationsRead()} className={semanticButtonClass('secondary', { compact: true })} disabled={notificationLoading || notificationItems.every((item) => item.readAt)}>
                <CheckCircle2 className="h-4 w-4" />
                {tr('全部已读', 'Mark all read')}
              </button>
              <button type="button" onClick={() => void clearAllNotifications()} className={semanticButtonClass('danger', { compact: true })} disabled={notificationLoading || notificationItems.length === 0}>
                <Trash2 className="h-4 w-4" />
                {tr('清空', 'Clear')}
              </button>
            </div>
            <div className="flex min-h-[420px] flex-col">
              {notificationLoading && notificationItems.length === 0 ? (
                <ListSkeleton count={4} compact />
              ) : notificationItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm font-semibold text-zinc-500">
                  {tr('暂时没有新的通知。', 'No new notifications yet.')}
                </div>
              ) : (
                <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1">
                  {notificationItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded-2xl border p-3 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/10 ${
                        item.readAt ? 'border-zinc-800 bg-zinc-900/30' : 'border-indigo-400/30 bg-indigo-500/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationCenterOpen(false);
                          if (item.storyId) void startStoryPlay(item.storyId);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <div className="mt-0.5 rounded-full border border-white/10 bg-white/10 p-2">
                          <Bell className="h-4 w-4 text-indigo-200" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-zinc-100">{item.title || tr('新的通知', 'New notification')}</div>
                          <div className="mt-1 text-xs font-semibold leading-relaxed text-zinc-400">{item.body || tr('有新的命运动态。', 'There is a new fate update.')}</div>
                          <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                            {new Date(item.createdAt || Date.now()).toLocaleString()}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteNotificationItem(item.id)}
                        className="shrink-0 rounded-full p-2 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-200 active:scale-95"
                        aria-label={tr('删除通知', 'Delete notification')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderShareComposer = () => (
    <AnimatePresence>
      {shareComposer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5600] bg-black/70 backdrop-blur-md`}
          onClick={() => closeShareComposer(false)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('分享前确认', 'Share Preview')}</div>
                <h3 className="mt-2 text-2xl font-black text-white">{String(shareComposer.title || t('play.share'))}</h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500">{tr('可以先调整要发出去的文字；确认分享后才会调用设备分享功能，并在成功后计入分享数。', 'Edit the share text first. The device share sheet opens only after confirmation, and successful shares count toward stats.')}</p>
              </div>
              <button type="button" onClick={() => closeShareComposer(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭分享编辑', 'Close share editor')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-3 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{tr('分享文字', 'Share text')}</label>
            <textarea
              value={shareComposerText}
              onChange={(event) => setShareComposerText(event.target.value)}
              className="min-h-44 w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm font-semibold leading-relaxed text-zinc-100 outline-none transition-colors focus:border-indigo-400/70"
            />
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3 text-xs font-semibold leading-relaxed text-zinc-400 break-all">
              {String(shareComposer.url || '')}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => closeShareComposer(false)} className={semanticButtonClass('ghost', { fullWidth: true })}>
                {tr('取消', 'Cancel')}
              </button>
              <button type="button" onClick={() => void confirmShareComposer()} className={semanticButtonClass('primary', { fullWidth: true })}>
                <ExternalLink className="h-4 w-4" />
                {tr('确认分享', 'Share now')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAuthoringView = () => (
    <div className="authoring-studio mx-auto max-w-5xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
      {!authoringCartridge ? (
        <>
          {renderInlineHelp('authoring-list', '创作者后台指引', '欢迎来到命运馆的作者工坊。在这里你可以新建单独的叙事卡带，或者建立并绑定自定义的世界观体系。你发布的作品将展示在公共书库中。数据面板可以帮你评估哪些命运走向和分支吸引了最多执行官的干涉。')}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <BackNavButton label={tr('返回上一页', 'Back')} onClick={() => goBack('STORY_SELECT')} />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => handleCreateAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('secondary', { compact: true })}>
                <Sparkles className="h-4 w-4" />
                {tr('新建作品', 'New work')}
              </button>
              <button type="button" onClick={() => void openSeriesWorldView()} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
                <GitBranch className="h-4 w-4" />
                {tr('世界观设定', 'World settings')}
              </button>
              <button type="button" onClick={() => refreshStories({ force: true })} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
                <RefreshCcw className="h-4 w-4" />
                {tr('刷新列表', 'Refresh list')}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-2xl font-black text-white">
                  <BarChart3 className="h-5 w-5 text-indigo-300" />
                  {tr('我的作品', 'My Works')}
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-500">{tr('用数据判断哪些命运线值得继续扩写、改版或推广。', 'Use stats to decide which fate lines deserve expansion, revision, or promotion.')}</div>
              </div>
              <div className="text-xs font-black text-zinc-500">{myStories.length} {tr('部作品', 'works')}</div>
            </div>
            <div className="mb-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.2fr_auto_auto_auto_auto_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={authoringListSearch}
                  onChange={(event) => setAuthoringListSearch(event.target.value)}
                  placeholder={tr('搜索作品、标签或主轴', 'Search works, tags, or premise')}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 py-3 pl-10 pr-4 text-sm font-semibold text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400/70"
                />
              </label>
              <select
                value={authoringSeriesKindFilter}
                onChange={(event) => {
                  const value = event.target.value as typeof authoringSeriesKindFilter;
                  setAuthoringSeriesKindFilter(value);
                  if (value !== 'series') setAuthoringSeriesWorldFilter('all');
                }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-black text-zinc-200 outline-none focus:border-indigo-400/70"
              >
                <option value="all">{tr('全部作品', 'All works')}</option>
                <option value="standalone">{tr('单独作品', 'Standalone')}</option>
                <option value="series">{tr('世界观作品', 'World setting')}</option>
              </select>
              <select
                value={authoringSeriesWorldFilter}
                onChange={(event) => {
                  setAuthoringSeriesWorldFilter(event.target.value);
                  if (event.target.value !== 'all') setAuthoringSeriesKindFilter('series');
                }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-black text-zinc-200 outline-none focus:border-indigo-400/70"
              >
                <option value="all">{tr('全部世界观', 'All settings')}</option>
                {seriesWorlds.map((series) => (
                  <option key={series.id} value={series.id}>{series.title || tr('未命名世界观', 'Untitled setting')}</option>
                ))}
              </select>
              <select
                value={authoringListVisibilityFilter}
                onChange={(event) => setAuthoringListVisibilityFilter(event.target.value as typeof authoringListVisibilityFilter)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-black text-zinc-200 outline-none focus:border-indigo-400/70"
              >
                <option value="all">{tr('全部可见性', 'All visibility')}</option>
                <option value="public">{tr('公开', 'Public')}</option>
                <option value="unlisted">{tr('非公开链接', 'Unlisted link')}</option>
                <option value="private">{tr('私人', 'Private')}</option>
              </select>
              <select
                value={authoringCreatedFilter}
                onChange={(event) => setAuthoringCreatedFilter(event.target.value as typeof authoringCreatedFilter)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-black text-zinc-200 outline-none focus:border-indigo-400/70"
              >
                <option value="all">{tr('全部创作日期', 'All creation dates')}</option>
                <option value="7d">{tr('近 7 天', 'Last 7 days')}</option>
                <option value="30d">{tr('近 30 天', 'Last 30 days')}</option>
                <option value="365d">{tr('近 1 年', 'Last year')}</option>
              </select>
              <select
                value={authoringListSort}
                onChange={(event) => setAuthoringListSort(event.target.value as AuthoringListSort)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-black text-zinc-200 outline-none focus:border-indigo-400/70"
              >
                <option value="updated">{tr('最近更新', 'Recently updated')}</option>
                <option value="created">{tr('创作日期', 'Creation date')}</option>
                <option value="likes">{tr('点赞最多', 'Most liked')}</option>
                <option value="favorites">{tr('收藏最多', 'Most favorited')}</option>
                <option value="shares">{tr('分享最多', 'Most shared')}</option>
                <option value="interventions">{tr('干涉最多', 'Most intervened')}</option>
              </select>
            </div>
            {myStories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
                {tr('还没有作品，点击“新建作品”开始创作。', 'No works yet. Click “New work” to start creating.')}
              </div>
            ) : getFilteredAuthoringStories().length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-sm font-semibold text-zinc-500">
                {tr('没有符合当前筛选的作品。', 'No works match the current filters.')}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {getFilteredAuthoringStories().map((story: any) => (
                  <button
                    key={story.id}
                    type="button"
                    disabled={authoringLoadingStoryId === story.id}
                    onClick={async () => {
                      setAuthoringLoadingStoryId(story.id);
                      await selectAuthoringStory(story.id);
                      setAuthoringLoadingStoryId(null);
                    }}
                    className={`app-card relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:shadow-xl active:scale-[0.98] ${authoringLoadingStoryId === story.id ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    {authoringLoadingStoryId === story.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      </div>
                    )}
                    <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur-md ${
                      story.visibility === 'public'
                        ? 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200'
                        : story.visibility === 'unlisted'
                        ? 'border-sky-400/25 bg-sky-500/15 text-sky-200'
                        : 'border-zinc-700 bg-zinc-900/80 text-zinc-300'
                    }`}>
                      {getVisibilityLabel(story.visibility)}
                    </span>
                    <div className="pr-24">
                      <div className="line-clamp-3 text-lg font-black text-white leading-tight">{formatBookTitle(getStoryTitle(story))}</div>
                      <div className="mt-2 text-xs font-semibold text-zinc-500">{tr('创作', 'Created')} {formatShortDate(getStoryCreatedMs(story))} · {tr('更新', 'Updated')} {formatShortDate(getStoryUpdatedMs(story))}</div>
                      <div className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                        getAuthoringStorySeriesId(story)
                          ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200'
                          : 'border-zinc-700 bg-zinc-900/70 text-zinc-400'
                      }`}>
                        <GitBranch className="h-3 w-3 shrink-0" />
                        <span className="truncate">{getAuthoringStorySeriesName(story)}</span>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {renderAuthoringStatChip(tr('点赞', 'Likes'), getStoryLikeCount(story), Heart, 'text-rose-300')}
                      {renderAuthoringStatChip(tr('收藏', 'Favorites'), getStoryFavoriteCount(story), Bookmark, 'text-amber-300')}
                      {renderAuthoringStatChip(tr('分享', 'Shares'), getStoryShareCount(story), ExternalLink, 'text-cyan-300')}
                      {renderAuthoringStatChip(tr('干涉', 'Interventions'), getStoryInterventionCount(story), Sparkles, 'text-indigo-300')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {renderInlineHelp('authoring-editor', '故事编辑器指南', '这里是故事的核心编织区。你可以设置【作品设置】里的题材与登场人物，编写【主线和结局】（第 1 至第 7 章基础正文与结局名称）。通过【角色和支线】选项卡，你可以配置“命运分支规则”，设定玩家施加庇佑（Bless）或磨难（Curse）时被解锁，并注入改动覆盖指定章节，引导出截然相异的终章结局。')}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <BackNavButton
              label={tr('返回列表', 'Back to list')}
              onClick={() => {
                if (authoringDirty) {
                  setConfirmationModal({
                    isOpen: true,
                    title: tr('放弃未保存的更改', 'Discard unsaved changes'),
                    message: tr('退出编辑模式将丢失当前未保存的内容，确定要离开吗？', 'Leaving the editor will discard unsaved changes. Continue?'),
                    onConfirm: () => {
                      setAuthoringDirty(false);
                      setAuthoringStoryId(null);
                      setAuthoringCartridge(null);
                    },
                  });
                } else {
                  setAuthoringStoryId(null);
                  setAuthoringCartridge(null);
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="authoring-save-pill inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
                data-state={authoringSaving ? 'saving' : authoringDirty ? 'dirty' : 'saved'}
              >
                {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : authoringDirty ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {authoringSaving ? tr('保存中', 'Saving') : authoringDirty ? tr('有未保存更改', 'Unsaved changes') : tr('已保存', 'Saved')}
              </div>
              <button type="button" onClick={() => handleDeleteAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('danger', { compact: true })}>
                <Trash2 className="h-4 w-4" />
                {tr('删除作品', 'Delete work')}
              </button>
              <button type="button" onClick={handleSaveAuthoringChanges} disabled={authoringSaving} className={semanticButtonClass('primary', { compact: true })}>
                {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {tr('保存更改', 'Save changes')}
              </button>
            </div>
          </div>

          <div className="authoring-tabbar mb-8">
            <button type="button" onClick={() => setAuthoringTab('settings')} className={`authoring-tab-button ${authoringTab === 'settings' ? 'is-active' : ''}`}>
              <Copy className="mb-1 h-4 w-4 shrink-0" />{tr('作品设置', 'Settings')}
            </button>
            <button type="button" onClick={() => setAuthoringTab('series')} className={`authoring-tab-button ${authoringTab === 'series' ? 'is-active' : ''}`}>
              <GitBranch className="mb-1 h-4 w-4 shrink-0" />{tr('系列设置', 'Series')}
            </button>
            <button type="button" onClick={() => setAuthoringTab('mainline')} className={`authoring-tab-button ${authoringTab === 'mainline' ? 'is-active' : ''}`}>
              <BookOpen className="mb-1 h-4 w-4 shrink-0" />{tr('主线和结局', 'Mainline & Endings')}
            </button>
            <button type="button" onClick={() => setAuthoringTab('branches')} className={`authoring-tab-button ${authoringTab === 'branches' ? 'is-active' : ''}`}>
              <Sparkles className="mb-1 h-4 w-4 shrink-0" />{tr('角色和支线', 'Characters & Branches')}
            </button>
          </div>

          <div className="fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+5rem)] left-8 z-[1700]">
            <button
              type="button"
              onClick={() => {
                if (authoringFindCompact) {
                  setAuthoringFindCompact(false);
                  setAuthoringFindReplaceOpen(true);
                  return;
                }
                setAuthoringFindReplaceOpen((prev) => !prev);
              }}
              aria-label={tr('查找 / 替换', 'Find / Replace')}
              className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl backdrop-blur-md transition-all hover:-translate-y-0.5 active:scale-95 ${
                authoringFindReplaceOpen || authoringFindCompact
                  ? 'border-indigo-400 bg-indigo-500 text-white'
                  : 'border-zinc-800 bg-zinc-950/90 text-zinc-200 hover:border-indigo-500 hover:text-white'
              }`}
            >
              {authoringFindCompact ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            {authoringFindCompact && (
              <div className="absolute bottom-16 left-0 grid w-44 gap-1.5 rounded-[1.25rem] border border-indigo-500/30 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <button type="button" onClick={() => moveAuthoringFindMatch(-1)} className={semanticButtonClass('ghost', { compact: true, fullWidth: true })}>
                  {tr('上一个', 'Previous')}
                </button>
                <button type="button" onClick={() => moveAuthoringFindMatch(1)} className={semanticButtonClass('ghost', { compact: true, fullWidth: true })}>
                  {tr('下一个', 'Next')}
                </button>
                <button
                  type="button"
                  onClick={replaceCurrentAuthoringMatch}
                  disabled={!authoringFindQuery}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 transition-all hover:border-amber-300 hover:bg-amber-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tr('替换', 'Replace')}
                </button>
                <div className="px-1 text-center text-[10px] font-bold text-zinc-500">
                  {tr('点击左下角 X 返回设置', 'Tap the X to return to settings')}
                </div>
              </div>
            )}
            {authoringFindReplaceOpen && (
              <div className="absolute bottom-16 left-0 grid max-h-[min(76dvh,680px)] w-[min(92vw,44rem)] gap-3 overflow-y-auto rounded-[1.75rem] border border-indigo-500/30 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{tr('查找 / 替换', 'Find / Replace')}</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('可指定章节、结局或角色范围，避免误改其他段落。', 'Choose chapter, ending, or character scope to avoid changing unrelated text.')}</p>
                  </div>
                  <button type="button" onClick={() => setAuthoringFindReplaceOpen(false)} className={semanticIconButtonClass('ghost')}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-bold text-zinc-400">
                    <span>{tr('查找文字', 'Find text')}</span>
                    <input
                      value={authoringFindQuery}
                      onChange={(event) => setAuthoringFindQuery(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder={tr('输入要查找的文字', 'Enter text to find')}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-zinc-400">
                    <span>{tr('替换成', 'Replace with')}</span>
                    <input
                      value={authoringReplaceQuery}
                      onChange={(event) => setAuthoringReplaceQuery(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder={tr('留空则删除查找文字', 'Leave blank to delete matched text')}
                    />
                  </label>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['chapters', tr('章节', 'Chapters')],
                      ['endings', tr('结局', 'Endings')],
                      ['characters', tr('角色', 'Characters')],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-bold text-zinc-300">
                        <input
                          type="checkbox"
                          checked={authoringFindScope[key]}
                          onChange={(event) => setAuthoringFindScope((prev) => ({ ...prev, [key]: event.target.checked }))}
                          className="accent-indigo-500"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {authoringFindScope.chapters && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{tr('章节范围', 'Chapter scope')}</div>
                        <button
                          type="button"
                          onClick={() => setAuthoringFindChapterNums((authoringCartridge.chapters || []).map((chapter: any) => Number(chapter.chapter_num)).filter((chapterNum: number) => Number.isFinite(chapterNum)))}
                          className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                        >
                          {tr('全选章节', 'Select all chapters')}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(authoringCartridge.chapters || []).map((chapter: any) => {
                          const chapterNum = Number(chapter.chapter_num);
                          const selected = authoringFindChapterNums.includes(chapterNum);
                          return (
                            <label key={chapterNum} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100' : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => setAuthoringFindChapterNums((prev) => event.target.checked ? [...new Set([...prev, chapterNum])].sort((a, b) => a - b) : prev.filter((item) => item !== chapterNum))}
                                className="accent-indigo-500"
                              />
                              {isEnglish ? `Chapter ${chapterNum}` : `第${chapterNum}章`}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {authoringFindScope.endings && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{tr('结局范围', 'Ending scope')}</div>
                        <button
                          type="button"
                          onClick={() => setAuthoringFindEndingIds((authoringCartridge.endings || []).map((ending: any) => String(ending.id || '')).filter(Boolean))}
                          className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                        >
                          {tr('全选结局', 'Select all endings')}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(authoringCartridge.endings || []).map((ending: any) => {
                          const endingId = String(ending.id || '');
                          const selected = authoringFindEndingIds.includes(endingId);
                          return (
                            <label key={endingId} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100' : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => setAuthoringFindEndingIds((prev) => event.target.checked ? [...new Set([...prev, endingId])] : prev.filter((item) => item !== endingId))}
                                className="accent-indigo-500"
                              />
                              {ending.title || authoringEndingIdToLabel(ending.id)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={openCompactFindMode}
                    disabled={
                      !authoringFindQuery ||
                      !(
                        (authoringFindScope.chapters && authoringFindChapterNums.length > 0) ||
                        (authoringFindScope.endings && authoringFindEndingIds.length > 0) ||
                        authoringFindScope.characters
                      )
                    }
                    className={semanticButtonClass('secondary', { compact: true })}
                  >
                    {tr('查找', 'Find')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAuthoringReplaceAll}
                    disabled={
                      !authoringFindQuery ||
                      !(
                        (authoringFindScope.chapters && authoringFindChapterNums.length > 0) ||
                        (authoringFindScope.endings && authoringFindEndingIds.length > 0) ||
                        authoringFindScope.characters
                      )
                    }
                    className={semanticButtonClass('primary', { compact: true })}
                  >
                    {tr('全部替换', 'Replace all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthoringFindQuery('');
                      setAuthoringReplaceQuery('');
                    }}
                    className={semanticButtonClass('ghost', { compact: true })}
                  >
                    {tr('清空', 'Clear')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
              {authoringTab === 'settings' && (
                <section className="space-y-4">

                  <div className="border-t border-zinc-800 pt-6">
                    <h3 className="text-xl font-black text-white">{tr('作品设置', 'Story Settings')}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('正式作品可选择私人、非公开链接或公开；收藏命运记录不会出现在这里。', 'Formal works can be private, unlisted, or public. Saved fate records do not appear here.')}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-zinc-400">
                      <div>{tr('作品标题', 'Story title')}</div>
                      <input
                        value={stripBookTitle(authoringCartridge.meta?.title || '')}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, title: event.target.value } }))}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-400">
                      <div>{tr('标签（以中文逗号分隔）', 'Tags (comma-separated)')}</div>
                      <input
                        value={authoringCustomTagsInput}
                        onChange={(event) => setAuthoringCustomTagsInput(event.target.value)}
                        placeholder={tr('在此手动输入标签或点击下方快速添加', 'Type tags here, or use quick tags below')}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {['生存', '末日', '异界', '恋爱', '悬疑', '推理', '赛博朋克', '奇幻', '惊悚', '治愈'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                               const current = authoringCustomTagsInput.trim();
                               if (!current) setAuthoringCustomTagsInput(tag);
                               else if (!current.includes(tag)) setAuthoringCustomTagsInput(current + (current.endsWith('，') || current.endsWith(',') ? '' : '，') + tag);
                            }}
                            className="rounded-lg bg-zinc-800/50 px-3 py-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                  <section className="app-card-quiet rounded-2xl p-4" tabIndex={0} onPaste={handleAuthoringCoverPaste}>
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row">
                      <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950">
                        {authoringCartridge.meta?.coverUrl ? (
                          <img src={authoringCartridge.meta.coverUrl} alt={tr('作品封面预览', 'Story cover preview')} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                            NO COVER
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <h4 className="text-lg font-black text-white">{tr('作品封面', 'Story Cover')}</h4>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('用于作品卡和分享预览，建议 1:1。可上传图片，或直接粘贴剪贴板图片。', 'Used for story cards and share previews. 1:1 is recommended. Upload an image or paste from clipboard.')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className={`${semanticButtonClass('secondary', { compact: true })} cursor-pointer`}>
                            <BookOpen className="h-4 w-4" />
                            {tr('上传封面', 'Upload cover')}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                void handleAuthoringCoverUpload(event.target.files?.[0]);
                                event.currentTarget.value = '';
                              }}
                            />
                          </label>
                          {authoringCartridge.meta?.coverUrl && (
                            <button type="button" onClick={() => applyAuthoringCover('')} className={semanticButtonClass('ghost', { compact: true })}>
                              <X className="h-4 w-4" />
                              {tr('移除封面', 'Remove cover')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {canUseCoverGeneration && (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={authoringCoverPrompt}
                          onChange={(event) => setAuthoringCoverPrompt(event.target.value)}
                          placeholder={tr('描述封面画面...', 'Describe the cover image...')}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                        />
                        <button type="button" onClick={handleGenerateAuthoringCover} disabled={isGeneratingCover} className={semanticButtonClass('primary', { compact: true })}>
                          {isGeneratingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {tr('AI 生成', 'AI Generate')}
                        </button>
                      </div>
                    )}
                  </section>
                  <label className="block space-y-2 text-sm text-zinc-400">
                    <div>{tr('故事主轴', 'Story premise')}</div>
                    <textarea
                      value={authoringCartridge.meta?.main_axis || ''}
                      onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, main_axis: event.target.value } }))}
                      className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <section className="app-card-quiet rounded-2xl p-4">
                    <div className="mb-3 text-sm font-black text-zinc-100">{tr('结局结构', 'Ending Structure')}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        {
                          value: 'single',
                          label: tr('唯一走向', 'Fixed-ending path'),
                          hint: tr('所有干涉最终都会自然收束到唯一结局，适合宿命感或强主线作品。', 'All interventions naturally converge to one fixed ending. Best for fated or strong-mainline stories.'),
                        },
                        {
                          value: 'dual',
                          label: tr('三域走向', 'Three-domain path'),
                          hint: tr('使用中域、左域、右域三类收束，每一域都可以继续扩展具体结局。', 'Uses middle, left, and right domains. Each domain can later expand into specific endings.'),
                        },
                      ] as const).map((option) => {
                        const selected = (authoringCartridge.meta?.endingMode || 'dual') === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, endingMode: option.value } }))}
                            className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                              selected
                                ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                            }`}
                          >
                            <div className="text-sm font-black">{option.label}</div>
                            <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                    {(authoringCartridge.meta?.endingMode || 'dual') !== 'single' && (
                    <div className="app-card-quiet mt-4 rounded-2xl p-4">
                      <div className="text-sm font-black text-zinc-100">{tr('故事倾向', 'Story Tendency')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('设置作品本身比较容易走向哪一种收束。读者只会感受到故事倾向，不会看到具体数值。', 'Set which ending direction the work naturally leans toward. Readers feel the tendency but do not see exact values.')}</p>
                      <div className="mt-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/45 p-3 text-xs font-bold text-zinc-400">
                        {(() => {
                          const axis = endingBiasAxisFromBias(authoringCartridge.meta?.endingBias || authoringCartridge.meta?.endingRates);
                          const bias = endingBiasFromAxis(axis);
                          return (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <span>{tr('主线倾向', 'Mainline tendency')}</span>
                                <span className="text-sm font-black text-zinc-100">{endingBiasAxisLabel(axis)}</span>
                              </div>
                              <input
                                type="range"
                                min={-70}
                                max={70}
                                step={10}
                                value={axis}
                                onChange={(event) => {
                                  const nextBias = endingBiasFromAxis(Number(event.target.value));
                                  setAuthoringCartridge((prev: any) => ({
                                    ...prev,
                                    meta: { ...prev.meta, endingBias: nextBias, endingRates: nextBias },
                                  }));
                                }}
                                className="mt-3 w-full accent-indigo-400"
                              />
                              <div className="mt-2 flex justify-between text-[10px] font-black text-zinc-600">
                                <span>{tr('右域强', 'Right strong')}</span>
                                <span>{tr('中性', 'Neutral')}</span>
                                <span>{tr('左域强', 'Left strong')}</span>
                              </div>
                              <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                                {tr(`左域 ${bias.leftBaseWeight}% / 右域 ${bias.rightBaseWeight}%；主线越偏一侧，另一侧越需要靠支线撬动。`, `Left ${bias.leftBaseWeight}% / Right ${bias.rightBaseWeight}%. The stronger one side's mainline is, the more the other side relies on branches to push back.`)}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{tr('如果不确定，保持中性即可；支线与玩家干涉会继续影响故事最终走向。', 'If unsure, keep it neutral. Branches and player interventions still affect the final direction.')}</p>
                    </div>
                    )}
                  </section>
                  <section className="app-card-quiet rounded-2xl p-4">
                    <div className="mb-3 text-sm font-black text-zinc-100">{tr('作品可见性', 'Visibility')}</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        { value: 'private', label: tr('私人', 'Private'), hint: tr('只有作者自己可见。', 'Only the author can view it.') },
                        { value: 'unlisted', label: tr('非公开链接', 'Unlisted link'), hint: tr('不进公开列表，但链接可读。', 'Not listed publicly, but readable by link.') },
                        { value: 'public', label: tr('公开', 'Public'), hint: tr('会出现在公开作品库。', 'Appears in the public library.') },
                      ].map((option) => {
                        const selected = (authoringCartridge.meta?.visibility || 'private') === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, visibility: option.value } }))}
                            className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                              selected
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                            }`}
                          >
                            <div className="text-sm font-black">{option.label}</div>
                            <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={Boolean(authoringCartridge.meta?.allowAdaptation)}
                      onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, allowAdaptation: event.target.checked } }))}
                      className="mt-1 h-4 w-4 accent-indigo-500"
                    />
                    <span>
                      <span className="block font-black text-zinc-100">{tr('开放一键改编权限', 'Allow one-click adaptation')}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{tr('开启后，其他已登录用户可以把这篇作品改编成个人草稿继续创作。', 'When enabled, other logged-in users can adapt this work into their own draft.')}</span>
                    </span>
                  </label>
                  
                  <div className="border-t border-zinc-800 pt-6">
                    <h3 className="text-xl font-black text-white">{tr('一键导入', 'One-click Import')}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('支持按“主线设置 / 支线设置”范本格式自动解析并写入当前作品。', 'Parse and import text using the “Mainline / Branch Settings” template format.')}</p>
                  </div>
                  <textarea
                    value={authoringImportText}
                    onChange={(event) => setAuthoringImportText(event.target.value)}
                    placeholder={tr('把其他 AI 生成的完整文本粘贴到这里...', 'Paste a complete generated story here...')}
                    className="authoring-resizable-textarea min-h-[320px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300 outline-none transition-colors focus:border-indigo-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={authoringImportReplaceBranches}
                      onChange={(event) => setAuthoringImportReplaceBranches(event.target.checked)}
                    />
                    {tr('导入时尝试覆盖支线结构', 'Try replacing branch structure during import')}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button type="button" onClick={handleAuthoringImport} className={semanticButtonClass('primary', { fullWidth: true })}>
                      <Copy className="h-4 w-4" />
                      {tr('解析并导入', 'Parse and import')}
                    </button>
                    <button type="button" onClick={() => {
                        const template = `# 主线设置\n## 标题\n作品名称\n\n## 主轴\n一句话描述故事核心冲突\n\n## 主要角色\n### 角色1\n- 名字: 角色名A\n- 简介: 角色A的简介\n\n### 角色2\n- 名字: 角色名B\n- 简介: 角色B的简介\n\n## 默认故事\n### 第 1 章 标题一\n第一章大纲或正文\n\n### 第 2 章 标题二\n第二章大纲或正文\n\n## 结局设置\n### 中域默认结局\n中域默认结局正文\n### 左域默认结局\n左域默认结局正文\n### 右域默认结局\n右域默认结局正文\n\n# 支线设置\n## 支线1\n- 支线名: 支线名称\n- 倾向: 左域\n- 影响: 中\n- 隐藏: 否\n- 导向结局: 左域默认结局\n- 提示短句: 留意这里的变化\n- 支线情节: 这里写支线发生时的具体剧情\n- 条件组1: 第 2 章 角色名A 庇佑`;
                        navigator.clipboard.writeText(template);
                        showError(tr('蓝本格式已复制到剪贴板！', 'Template format copied to clipboard.'));
                    }} className={semanticButtonClass('secondary', { fullWidth: true })}>
                      <Copy className="h-4 w-4" />
                      {tr('拷贝蓝本格式', 'Copy template format')}
                    </button>
                  </div>
                </section>
              )}

              {authoringTab === 'series' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-white">{tr('系列设置', 'Series Settings')}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('管理本作套用的世界观设定、角色卡和继承节点。这里记录的是系列层级的限制，不是本作情节主轴。', 'Manage the world setting, character cards, and continuity node used by this work. These are series-level constraints, not this story premise.')}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-indigo-300/15 bg-indigo-500/10 p-4">
                    <label className="mb-2 block text-sm font-black text-indigo-100">{tr('套用世界观设定', 'Apply world setting')}</label>
                    <select
                      value={authoringCartridge.meta?.seriesId || ''}
                      onChange={(event) => {
                        const seriesId = event.target.value;
                        const series = seriesWorlds.find((item) => item.id === seriesId) || null;
                        const baselineRuleIds = series ? getSeriesBaselineRules(series).map((rule) => rule.id) : [];
                        const characterIds = series ? getSeriesCharacterCards(series).map((card) => card.id) : [];
                        setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          meta: {
                            ...prev.meta,
                            seriesId: seriesId || null,
                            seriesRole: seriesId ? (prev.meta?.seriesRole === 'sequel' ? 'sequel' : 'main') : 'standalone',
                            seriesConstraints: seriesId ? {
                              ...(prev.meta?.seriesConstraints || {}),
                              seriesTitle: series?.title || '',
                              baselineRuleIds,
                              characterIds,
                              selectedBaselineRules: getSeriesBaselineRules(series),
                              selectedCharacterCards: getSeriesCharacterCards(series),
                            } : {},
                          },
                        }));
                      }}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                    >
                      <option value="">{tr('不套用世界观设定', 'No world setting')}</option>
                      {seriesWorlds.map((series) => (
                        <option key={series.id} value={series.id}>{series.title || tr('未命名世界观设定', 'Untitled world setting')}</option>
                      ))}
                    </select>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void openSeriesWorldView()} className={semanticButtonClass('ghost', { compact: true })}>
                        <GitBranch className="h-4 w-4" />
                        {tr('管理世界观设定', 'Manage world settings')}
                      </button>
                      <button type="button" onClick={() => void loadSeriesWorlds()} className={semanticButtonClass('ghost', { compact: true })}>
                        <RefreshCcw className="h-4 w-4" />
                        {tr('刷新', 'Refresh')}
                      </button>
                    </div>
                  </div>
                  {authoringCartridge.meta?.seriesId ? (() => {
                    const selected = seriesWorlds.find((series) => series.id === authoringCartridge.meta?.seriesId) || null;
                    const baselineRules = getSeriesBaselineRules(selected);
                    const characterCards = getSeriesCharacterCards(selected);
                    const constraints = authoringCartridge.meta?.seriesConstraints || {};
                    const selectedRuleIds = asSafeArray<string>(constraints.baselineRuleIds);
                    const selectedCharacterIds = asSafeArray<string>(constraints.characterIds);
                    const authoringSeriesStoryOptions = myStories.filter((story: any) => String(story?.id || '') !== String(authoringStoryId || '') && String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '') === String(authoringCartridge.meta?.seriesId || ''));
                    const authoringContinuityBranches = asSafeArray<any>(authoringContinuitySourceStory?.branches);
                    const authoringContinuityEndings = asSafeArray<any>(authoringContinuitySourceStory?.endings);
                    const updateSeriesConstraints = (patch: Record<string, any>) => setAuthoringCartridge((prev: any) => ({
                      ...prev,
                      meta: {
                        ...prev.meta,
                        seriesConstraints: {
                          ...(prev.meta?.seriesConstraints || {}),
                          ...patch,
                        },
                      },
                    }));
                    const updateAuthoringSourceStory = (sourceStoryId: string) => {
                      const sourceStory = authoringSeriesStoryOptions.find((story: any) => String(story.id || '') === sourceStoryId);
                      setAuthoringCartridge((prev: any) => ({
                        ...prev,
                        meta: {
                          ...prev.meta,
                          continuityNodeId: null,
                          seriesConstraints: {
                            ...(prev.meta?.seriesConstraints || {}),
                            continuityNodeId: '',
                            continuityTitle: '',
                            sourceStoryId: sourceStoryId || '',
                            sourceTitle: sourceStory ? getStoryTitle(sourceStory) : '',
                            endingId: '',
                            endingTitle: '',
                            endingDomain: '',
                            requiredBranchIds: [],
                            requiredBranches: [],
                            bridgeSummary: '',
                            previousStorySummary: [],
                            previousCharacters: [],
                          },
                        },
                      }));
                    };
                    return (
                      <>
                        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4">
                          <div className="mb-3 text-sm font-black text-white">{tr('本作套用的世界基准', 'World baseline used by this work')}</div>
                          {baselineRules.length === 0 ? (
                            <p className="text-xs leading-relaxed text-zinc-500">{tr('该世界观设定还没有条目化基准。', 'This world setting has no itemized baseline rules yet.')}</p>
                          ) : (
                            <div className="grid gap-2">
                              {baselineRules.map((rule) => (
                                <label key={rule.id} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={selectedRuleIds.includes(rule.id)}
                                    onChange={(event) => {
                                      const nextIds = event.target.checked
                                        ? [...new Set([...selectedRuleIds, rule.id])]
                                        : selectedRuleIds.filter((id) => id !== rule.id);
                                      updateSeriesConstraints({
                                        baselineRuleIds: nextIds,
                                        selectedBaselineRules: baselineRules.filter((item) => nextIds.includes(item.id)),
                                      });
                                    }}
                                    className="mt-1 accent-indigo-500"
                                  />
                                  <span>
                                    <span className="block font-black leading-relaxed text-zinc-100">{rule.detail || rule.title}</span>
                                    {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).length > 0 && (
                                      <span className="mt-2 flex flex-wrap gap-1.5">
                                        {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).map((tag) => (
                                          <span key={tag} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-200">{tag}</span>
                                        ))}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-white">{tr('角色卡池', 'Character pool')}</div>
                              <p className="mt-1 text-xs text-zinc-500">{tr('勾选后可导入到本作角色列表；续作默认沿用主要角色。', 'Selected cards can be imported into this work; sequels inherit major characters by default.')}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAuthoringCartridge((prev: any) => {
                                const existing = asSafeArray(prev.meta?.characters);
                                const existingNames = new Set(existing.map((character: any) => String(character.name || '').trim()).filter(Boolean));
                                const imported = characterCards
                                  .filter((card) => selectedCharacterIds.includes(card.id))
                                  .filter((card) => !existingNames.has(card.name))
                                  .map((card, index) => ({
                                    id: `c${existing.length + index + 1}`,
                                    name: card.name,
                                    desc: card.desc || card.role || '系列角色',
                                  }));
                                return {
                                  ...prev,
                                  meta: {
                                    ...prev.meta,
                                    characters: [...existing, ...imported].slice(0, 8),
                                  },
                                };
                              })}
                              disabled={characterCards.length === 0}
                              className={semanticButtonClass('secondary', { compact: true })}
                            >
                              <Sparkles className="h-4 w-4" />
                              {tr('导入勾选角色', 'Import selected')}
                            </button>
                          </div>
                          {characterCards.length === 0 ? (
                            <p className="text-xs leading-relaxed text-zinc-500">{tr('该世界观设定还没有角色卡。', 'This world setting has no character cards yet.')}</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {characterCards.map((card) => (
                                <label key={card.id} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={selectedCharacterIds.includes(card.id)}
                                    onChange={(event) => {
                                      const nextIds = event.target.checked
                                        ? [...new Set([...selectedCharacterIds, card.id])]
                                        : selectedCharacterIds.filter((id) => id !== card.id);
                                      updateSeriesConstraints({
                                        characterIds: nextIds,
                                        selectedCharacterCards: characterCards.filter((item) => nextIds.includes(item.id)),
                                      });
                                    }}
                                    className="mt-1 accent-indigo-500"
                                  />
                                  <span>
                                    <span className="block font-black text-zinc-100">{card.name}</span>
                                    <span className="mt-1 block leading-relaxed text-zinc-500">{card.desc || card.role || tr('系列角色', 'Series character')}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4">
                          <div className="mb-3">
                            <div className="text-sm font-black text-white">{tr('续作开启条件', 'Sequel unlock conditions')}</div>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tr('如果本作是续作，可指定需要先完成哪一部前作、哪一个结局，以及哪些支线，玩家才可以干涉本作。', 'If this work is a sequel, choose the previous story, ending, and branches required before players can interfere with it.')}</p>
                          </div>
                          <select
                            value={authoringCartridge.meta?.seriesRole || 'main'}
                            onChange={(event) => setAuthoringCartridge((prev: any) => ({
                              ...prev,
                              meta: {
                                ...prev.meta,
                                seriesRole: event.target.value,
                                ...(event.target.value !== 'sequel' ? { continuityNodeId: null } : {}),
                              },
                            }))}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none"
                          >
                            <option value="main">{tr('第一部 / 正篇', 'First installment')}</option>
                            <option value="sequel">{tr('续作', 'Sequel')}</option>
                            <option value="side">{tr('外传', 'Side story')}</option>
                          </select>
                          {authoringCartridge.meta?.seriesRole === 'sequel' && (
                            <div className="mt-4 space-y-4">
                              <select
                                value={constraints.sourceStoryId || ''}
                                onChange={(event) => updateAuthoringSourceStory(event.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none"
                              >
                                <option value="">{tr('选择前作', 'Choose previous story')}</option>
                                {authoringSeriesStoryOptions.map((story: any) => (
                                  <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                                ))}
                              </select>
                              {authoringSeriesStoryOptions.length === 0 && (
                                <p className="text-xs leading-relaxed text-zinc-500">{tr('该世界观下还没有其他作品可作为前作。', 'No other work in this world setting can be used as the previous story yet.')}</p>
                              )}
                              {authoringContinuityLoading && (
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr('正在读取前作支线与结局...', 'Loading previous branches and endings...')}</div>
                              )}
                              {constraints.sourceStoryId && !authoringContinuityLoading && (
                                <div className="grid gap-4">
                                  <div>
                                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('可开启续作的前作支线', 'Required previous-story branches')}</div>
                                    {authoringContinuityBranches.length === 0 ? (
                                      <p className="text-xs leading-relaxed text-zinc-500">{tr('该前作没有可选择的支线。', 'This previous story has no selectable branches.')}</p>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {authoringContinuityBranches.map((branch: any) => {
                                          const branchId = String(branch.id || '');
                                          const checked = asSafeArray<string>(constraints.requiredBranchIds).includes(branchId);
                                          return (
                                            <label key={branchId} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(event) => {
                                                  const currentIds = asSafeArray<string>(constraints.requiredBranchIds);
                                                  const nextIds = event.target.checked
                                                    ? [...new Set([...currentIds, branchId])]
                                                    : currentIds.filter((id) => id !== branchId);
                                                  updateSeriesConstraints({
                                                    requiredBranchIds: nextIds,
                                                    requiredBranches: authoringContinuityBranches.filter((item) => nextIds.includes(String(item.id || ''))).map((item) => ({
                                                      id: String(item.id || ''),
                                                      name: item.name || item.title || item.id || '',
                                                      desc: item.desc || item.description || '',
                                                    })),
                                                  });
                                                }}
                                                className="mt-1 accent-indigo-500"
                                              />
                                              <span>
                                                <span className="block font-bold text-zinc-100">{branch.name || branch.title || branchId}</span>
                                                {(branch.desc || branch.description) && <span className="mt-1 block leading-relaxed text-zinc-500">{branch.desc || branch.description}</span>}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{tr('可开启续作的前作结局', 'Required previous-story ending')}</div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                      {authoringContinuityEndings.map((ending: any) => {
                                        const endingId = String(ending.id || '');
                                        return (
                                          <label key={endingId} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                                            <input
                                              type="radio"
                                              name="authoring-continuity-ending"
                                              checked={constraints.endingId === endingId}
                                              onChange={() => updateSeriesConstraints({
                                                endingId,
                                                endingTitle: ending.title || endingId,
                                                endingDomain: endingDomainFromId(endingId),
                                              })}
                                              className="mt-1 accent-indigo-500"
                                            />
                                            <span className="font-bold text-zinc-100">{ending.title || endingId}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <textarea
                                    value={constraints.sequelSeedPrompt || asSafeArray<any>(constraints.repairRules).map((rule) => rule?.rule || rule?.text || rule).filter(Boolean).join('\n')}
                                    onChange={(event) => {
                                      const lines = event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
                                      updateSeriesConstraints({
                                        sequelSeedPrompt: event.target.value,
                                        repairRules: lines.map((rule) => ({ rule })),
                                      });
                                    }}
                                    placeholder={tr('继承硬设定：一行一条，例如「前作中阵亡的人物不能无解释复活」。', 'Continuity hard rules: one per line, e.g. dead characters cannot return without explanation.')}
                                    className="authoring-resizable-textarea min-h-[120px] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })() : (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-sm leading-relaxed text-zinc-500">
                      {tr('本作尚未套用世界观设定。普通单篇作品可以保持为空；若是系列作品，请先选择一个世界观设定。', 'This work is not using a world setting. Standalone stories can leave this empty; choose one for series works.')}
                    </div>
                  )}
                </section>
              )}

              {authoringTab === 'mainline' && (
                <div className="relative">
                  {authoringTocOpen && (
                    <div className="fixed inset-0 z-[99]" onClick={() => setAuthoringTocOpen(false)} />
                  )}
                  <div className={`fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+13.5rem)] left-8 z-[1600] max-h-[min(52dvh,26rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-2xl backdrop-blur-md transition-all ${authoringTocOpen ? 'flex' : 'hidden'}`}>
                     <div className="mb-1 text-center text-[10px] font-black text-zinc-500">目录导航</div>
                     {(authoringCartridge.chapters || []).map((c: any) => (
                        <button type="button" key={c.chapter_num} onClick={() => { setAuthoringTocOpen(false); document.getElementById(`authoring-chapter-${c.chapter_num}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                           第 {c.chapter_num} 章
                        </button>
                     ))}
                     <div className="mx-2 my-1 h-px bg-zinc-800" />
                        <button type="button" onClick={() => { setAuthoringTocOpen(false); document.getElementById('authoring-endings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                       结局设置
                     </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAuthoringTocOpen(!authoringTocOpen)}
                    className="fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+9.5rem)] left-8 z-[1601] flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 active:scale-95"
                  >
                    {authoringTocOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                  </button>

                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-white">主线与结局</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">这里负责章节正文与结局的编写。其他基本设定请前往「作品设置」修改。</p>
                  </div>

                  <div className="space-y-4">
                    <div className="text-lg font-black text-white">章节正文</div>
                    {(authoringCartridge.chapters || []).map((chapter: any) => (
                      <div id={`authoring-chapter-${chapter.chapter_num}`} key={chapter.chapter_num} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                        <div className="text-sm font-black text-white">{formatStoryHeading(chapter)}</div>
                        <input
                          id={`authoring-chapter-${chapter.chapter_num}-title`}
                          value={chapter.title || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, title: event.target.value } : item),
                          }))}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="章节标题"
                        />
                        <textarea
                          id={`authoring-chapter-${chapter.chapter_num}-text`}
                          value={chapter.text || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, text: event.target.value } : item),
                          }))}
                          className="authoring-resizable-textarea min-h-[240px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder={`第${chapter.chapter_num}章正文`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div id="authoring-endings" className="text-lg font-black text-white">结局设置</div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {endingDomainCards(authoringCartridge.meta).map((domain) => (
                        <div key={domain.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{domain.title}</div>
                          <div className="mt-2 text-sm font-black text-zinc-100">{domain.label}</div>
                          <p className="mt-3 text-xs leading-relaxed text-zinc-500">{domain.hint}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-indigo-100/75">
                      可先编辑“中域默认 / 左域默认 / 右域默认”三个结局原型。每一域都可承载更多具体结局，并可由支线绑定来决定最终收束；已设置的支线倾向会继续沿用。
                    </div>
                    {authoringCartridge.meta?.endingMode === 'single' && (
                      (() => {
                        const hiddenEndings = (authoringCartridge.endings || []).filter(
                          (e: any) => e.id !== 'default' && (e.title || e.text)
                        );
                        return hiddenEndings.length > 0 ? (
                          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-300/80">
                            <span className="mt-0.5 shrink-0">⚠️</span>
                            <span>其他结局的内容已暂时保留在内存中（共 {hiddenEndings.length} 个结局有未保存的内容）。如需取回，请在离开此页前切换回“多线结局”。</span>
                          </div>
                        ) : null;
                      })()
                    )}
                    {(['middle', 'left', 'right'] as const)
                      .filter((domain) => authoringCartridge.meta?.endingMode === 'single' ? domain === 'middle' : true)
                      .map((domain) => {
                        const endingsInDomain = (authoringCartridge.endings || []).filter((ending: any) => endingDomainFromId(String(ending.id || '')) === domain);
                        const defaultEndingId = domain === 'middle' ? 'default' : domain;
                        const visibleEndings = endingsInDomain.length > 0
                          ? endingsInDomain
                          : [{ id: defaultEndingId, title: '', text: '' }];
                        return (
                          <div key={domain} className="space-y-3 rounded-[1.5rem] border border-zinc-800 bg-zinc-950/25 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-base font-black text-white">{endingDomainTitle(domain)}</div>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                                  {domain === 'middle' ? '故事没有明显偏向左右时，会进入中结局域；可设置多个余韵型具体结局。' : `故事偏向${endingDomainTitle(domain)}后，会根据已触发支线绑定选择具体结局。`}
                                </p>
                              </div>
                              {authoringCartridge.meta?.endingMode !== 'single' && (
                                <button
                                  type="button"
                                  onClick={() => setAuthoringCartridge((prev: any) => {
                                    const endings = [...(prev.endings || [])];
                                    endings.push({
                                      id: createEndingIdForDomain(domain),
                                      chapter_num: 7,
                                      title: `${endingDomainTitle(domain)}的新结局`,
                                      text: '',
                                    });
                                    return { ...prev, endings };
                                  })}
                                  className={semanticButtonClass('secondary', { compact: true })}
                                >
                                  <Sparkles className="h-4 w-4" />
                                  新增具体结局
                                </button>
                              )}
                            </div>

                            {visibleEndings.map((ending: any) => (
                              <div id={`authoring-ending-${ending.id}`} key={ending.id} className="rounded-[1.25rem] border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                                <div className="text-sm font-black text-white">{authoringEndingIdToLabel(ending.id)}</div>
                                <input
                                  id={`authoring-ending-${ending.id}-title`}
                                  value={ending.title || ''}
                                  onChange={(event) => setAuthoringCartridge((prev: any) => ({
                                    ...prev,
                                    endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, title: event.target.value } : item),
                                  }))}
                                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                                  placeholder="结局标题"
                                />
                                <textarea
                                  id={`authoring-ending-${ending.id}-text`}
                                  value={ending.text || ''}
                                  onChange={(event) => setAuthoringCartridge((prev: any) => ({
                                    ...prev,
                                    endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, text: event.target.value } : item),
                                  }))}
                                  className="authoring-resizable-textarea min-h-[240px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500"
                                  placeholder="结局正文"
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                  </div>
                </section>
              </div>
              )}

              {authoringTab === 'branches' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-white">角色和支线</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">角色会作为干涉对象和支线条件基础；支线会根据触发条件在游玩时被判定解锁。</p>
                  </div>

                  <div className="space-y-3 rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-black text-white">角色设定</div>
                      <button
                        type="button"
                        onClick={() => setAuthoringCartridge((prev: any) => {
                          const characters = [...(prev.meta?.characters || [])];
                          if (characters.length >= 5) return prev;
                          characters.push({ name: `角色${characters.length + 1}`, desc: '（待填写简介）' });
                          return { ...prev, meta: { ...prev.meta, characters } };
                        })}
                        className={semanticButtonClass('ghost', { compact: true })}
                      >
                        <Sparkles className="h-4 w-4" />
                        新增角色
                      </button>
                    </div>
                    {(authoringCartridge.meta?.characters || []).map((character: any, index: number) => (
                      <div id={`authoring-character-${index}`} key={index} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
                        <input
                          id={`authoring-character-${index}-name`}
                          value={character.name || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            meta: {
                              ...prev.meta,
                              characters: prev.meta.characters.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, name: event.target.value } : item),
                            },
                          }))}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="角色名"
                        />
                        <textarea
                          id={`authoring-character-${index}-desc`}
                          value={character.desc || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            meta: {
                              ...prev.meta,
                              characters: prev.meta.characters.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, desc: event.target.value } : item),
                            },
                          }))}
                          className="authoring-resizable-textarea min-h-[96px] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="角色简介"
                        />
                        <button
                          type="button"
                          onClick={() => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            meta: { ...prev.meta, characters: prev.meta.characters.filter((_: any, itemIndex: number) => itemIndex !== index) },
                          }))}
                          disabled={(authoringCartridge.meta?.characters || []).length <= 1}
                          className={semanticButtonClass('danger', { compact: true })}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-white">支线列表</div>
                    {expandedBranchId !== 'NEW' && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedBranchId('NEW');
                          setBranchForm({
                            id: '',
                            name: '',
                            side: 'left',
                            tier: 'small',
                            isHidden: false,
                            endingId: '',
                            triggerType: 'single',
                            singleChapterNum: 2,
                            singleCharId: '',
                            singleAction: 'bless',
                            countCharId: '',
                            countAction: 'bless',
                            minCount: 1,
                            upToChapterNum: 6,
                            hint: '',
                            sceneText: '',
                          });
                          setBranchConditions([{
                            kind: 'single',
                            singleChapterNum: 2,
                            singleCharId: '',
                            singleAction: 'bless',
                            countCharId: '',
                            countAction: 'bless',
                            minCount: 1,
                            upToChapterNum: 6,
                            hint: '',
                          }]);
                        }}
                        className={semanticButtonClass('secondary', { compact: true })}
                      >
                        <Sparkles className="h-4 w-4" />
                        新增支线
                      </button>
                    )}
                  </div>

                  {expandedBranchId === 'NEW' && renderBranchForm(true)}

                  <div className="space-y-3">
                    {(authoringCartridge.branches || []).map((branch: any) => (
                      <div key={branch.id} className="transition-all">
                        {expandedBranchId === branch.id ? (
                          renderBranchForm(false)
                        ) : (
                          <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-white">{branch.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                                <span>{branch.side === 'left' ? '左域' : '右域'} / 影响：{branchTierLabel(branch.tier)}</span>
                                {(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden) && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-black text-amber-200">隐藏支线</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-indigo-300">
                                导向：{authoringEndingIdToLabel(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || branch.side)}
                              </div>
                              <div className="mt-2 text-xs leading-relaxed text-zinc-400 max-w-xl line-clamp-2">{branch.sceneText || branch.hint || '暂无内容'}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBranchId(branch.id);
                                  setExpandedBranchId(branch.id);
                                  setBranchForm({
                                    id: branch.id,
                                    name: branch.name || '',
                                    side: branch.side || 'left',
                                    tier: normalizeBranchTier(branch.tier || 'small'),
                                    isHidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
                                    endingId: branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || '',
                                    triggerType: 'single',
                                    singleChapterNum: branch.trigger?.single?.chapterNum || 2,
                                    singleCharId: branch.trigger?.single?.charId || '',
                                    singleAction: branch.trigger?.single?.action || 'bless',
                                    countCharId: branch.trigger?.count?.charId || '',
                                    countAction: branch.trigger?.count?.action || 'bless',
                                    minCount: branch.trigger?.count?.minCount || 1,
                                    upToChapterNum: branch.trigger?.count?.upToChapterNum || 6,
                                    hint: branch.hint || '',
                                    sceneText: branch.sceneText || '',
                                  });
                                  const rawGroups = (branch.triggerGroups && branch.triggerGroups.length > 0)
                                    ? branch.triggerGroups
                                    : (branch.trigger ? [branch.trigger] : []);
                                  setBranchConditions(rawGroups.length > 0
                                    ? rawGroups.map((group: any) => group.type === 'count'
                                      ? {
                                          kind: 'count',
                                          singleChapterNum: 2,
                                          singleCharId: '',
                                          singleAction: 'bless',
                                          countCharId: group.count?.charId || '',
                                          countAction: group.count?.action || 'bless',
                                          minCount: group.count?.minCount || 1,
                                          upToChapterNum: group.count?.upToChapterNum || 6,
                                          hint: group.hint || branch.hint || '',
                                        }
                                      : {
                                          kind: 'single',
                                          singleChapterNum: group.single?.chapterNum || 2,
                                          singleCharId: group.single?.charId || '',
                                          singleAction: group.single?.action || 'bless',
                                          countCharId: '',
                                          countAction: 'bless',
                                          minCount: 1,
                                          upToChapterNum: 6,
                                          hint: group.hint || branch.hint || '',
                                        })
                                    : [{
                                        kind: 'single',
                                        singleChapterNum: 2,
                                        singleCharId: '',
                                        singleAction: 'bless',
                                        countCharId: '',
                                        countAction: 'bless',
                                        minCount: 1,
                                        upToChapterNum: 6,
                                        hint: branch.hint || '',
                                      }]
                                  );
                                }}
                                className={semanticButtonClass('secondary', { compact: true })}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!authoringStoryId) return;
                                  await deleteStoryBranch(db as any, authoringStoryId, branch.id);
                                  await selectAuthoringStory(authoringStoryId);
                                  showError('支线已删除。');
                                }}
                                className={semanticButtonClass('danger', { compact: true })}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </div>
        </>
      )}
    </div>
  );

  const actionMenuOverlay = (
    <AnimatePresence>
      {isActionMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[2100] bg-black/60 backdrop-blur-sm`}
          onClick={() => setIsActionMenuOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="app-modal-surface app-modal-safe-height grid w-full max-w-md gap-4 overflow-y-auto rounded-3xl border border-zinc-800 p-5 shadow-2xl sm:p-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white">{tr('时空菜单', 'Time Menu')}</h3>
              <button
                onClick={() => setIsActionMenuOpen(false)}
                className={semanticIconButtonClass('ghost')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[min(72vh,34rem)] gap-5 overflow-y-auto pr-1">
              <section className="grid gap-2">
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{tr('阅读与资料', 'Reading & Info')}</div>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    setIsStoryInfoOpen(true);
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <BookOpen className="h-5 w-5" />
                  {tr('故事信息', 'Story Info')}
                </button>
                <button
                  onClick={() => openArchiveView('PLAYING')}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <Archive className="h-5 w-5" />
                  {t('archive.title')}
                </button>
              </section>
              {gameState === 'PLAYING' && (
                <>
                  <section className="grid gap-2">
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{tr('作品互动', 'Story Actions')}</div>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('like'); }} className={`${semanticMenuButtonClass('ghost')} ${isCurrentStoryActive('like') ? 'bg-zinc-900/60 text-pink-300' : ''}`}>
                      <Heart className={`h-5 w-5 ${isCurrentStoryActive('like') ? 'fill-current text-pink-300' : ''}`} /> {tr('点赞', 'Like')}
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('favorite'); }} className={`${semanticMenuButtonClass('ghost')} ${isCurrentStoryActive('favorite') ? 'bg-zinc-900/60 text-amber-300' : ''}`}>
                      <Bookmark className={`h-5 w-5 ${isCurrentStoryActive('favorite') ? 'fill-current text-amber-300' : ''}`} /> {tr('收藏原作', 'Favorite original')}
                    </button>
                    <button
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        void handleShareStory();
                      }}
                      disabled={isSharing || !blueprint}
                      className={semanticMenuButtonClass('secondary')}
                    >
                      {isSharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                      {t('play.share')}
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); handleSaveWorkAndReturn(); }} className={semanticMenuButtonClass('ghost')}>
                      <Archive className="h-5 w-5" /> {t('play.archiveFate')}
                    </button>
                  </section>
                  <section className="grid gap-2">
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{tr('创作与重开', 'Create & Restart')}</div>
                    {!activeStoryId && (
                      <button onClick={() => { setIsActionMenuOpen(false); handleRegenerateQuickStory(); }} className={semanticMenuButtonClass('ghost')}>
                        <RefreshCcw className="h-5 w-5" /> {tr('重新生成', 'Regenerate')}
                      </button>
                    )}
                    <button onClick={() => { setIsActionMenuOpen(false); handleAdaptCurrentStory(); }} disabled={isAdaptCurrentStoryUnavailable()} className={semanticMenuButtonClass('secondary')}>
                      <Wand2 className="h-5 w-5" /> {canAdaptCurrentStory() ? tr('一键改编', 'Adapt') : tr('未开放改编', 'Adaptation unavailable')}
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); restartCurrentStory(); }} className={semanticMenuButtonClass('ghost')}>
                      <RefreshCcw className="h-5 w-5" /> {tr('重新干涉', 'Restart play')}
                    </button>
                  </section>
                </>
              )}
              <section className="grid gap-2">
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{tr('离开', 'Leave')}</div>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    resetToHome();
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <LogIn className="h-5 w-5" />
                  {tr('退出游玩', 'Exit play')}
                </button>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAuthView = () => (
    <Suspense fallback={<StartupShell message={appLanguage === 'en-US' ? 'Loading account entry...' : '正在准备账号入口...'} title={t('app.name')} subtitle={t('startup.default')} />}>
      <AuthView
        isIos={isIosDevice()}
        isStandaloneMode={isStandaloneMode}
        isLoggingIn={isLoggingIn}
        authEmail={authEmail}
        authPassword={authPassword}
        showSafariGuide={showSafariGuide}
        onAuthEmailChange={setAuthEmail}
        onAuthPasswordChange={setAuthPassword}
        onEmailPasswordLogin={handleEmailPasswordLogin}
        onPasswordReset={handlePasswordReset}
        onGoogleLogin={handleGoogleLogin}
        onAnonymousLogin={handleAnonymousLogin}
        onInstallApp={handleInstallApp}
        onSafariGuideOpen={() => setShowSafariGuide(true)}
        onSafariGuideClose={() => setShowSafariGuide(false)}
        t={t}
      />
    </Suspense>
  );
  const renderScrollToTopButton = () => (
    <AnimatePresence>
      {showScrollTopButton && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`play-float-button ${gameState === 'PLAYING' ? 'play-scroll-top-button' : 'app-scroll-top-button'}`}
          aria-label={tr('返回顶端', 'Back to top')}
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );

  const renderPlayingQuickNav = () => (
    <AnimatePresence>
      {gameState === 'PLAYING' && chapters.length > 0 && (
        <>
          {playingTocOpen && (
            <motion.div
              key="playing-toc-panel"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className="play-quick-panel p-2"
            >
              <div className="px-2 pb-1 pt-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{tr('快速浏览', 'Quick Nav')}</div>
              {chapters.map((chapter) => {
                const ready = isChapterTextReady(chapter);
                return (
                  <button
                    type="button"
                    key={chapter.chapter_num}
                    onClick={() => {
                      setPlayingTocOpen(false);
                      scrollToChapter(chapter.chapter_num);
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${ready ? 'bg-indigo-500/15 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>
                      {chapter.chapter_num}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{isEnglish ? `Chapter ${chapter.chapter_num}` : `第${chapter.chapter_num}章`}</span>
                    {!ready && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-600" />}
                  </button>
                );
              })}
            </motion.div>
          )}
          <motion.button
            type="button"
            key="playing-toc-button"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            onClick={() => setPlayingTocOpen((prev) => !prev)}
            className="play-float-button play-quick-button"
            aria-label={playingTocOpen ? tr('关闭快速浏览', 'Close quick nav') : tr('打开快速浏览', 'Open quick nav')}
          >
            {playingTocOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );

  const installGuideModal = (
    <AnimatePresence>
      {showIosInstallModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6200] bg-black/80 backdrop-blur-md`}
          onClick={() => setShowIosInstallModal(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-800 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">{tr('下载 App', 'Install App')}</div>
                <h2 className="mt-1 text-xl font-black text-white">{tr('添加到手机桌面', 'Add to home screen')}</h2>
              </div>
              <button type="button" onClick={() => setShowIosInstallModal(false)} className={semanticIconButtonClass('ghost')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
              <p>{tr('在 iPhone/iPad：点击浏览器底部的分享按钮，然后选择“添加到主屏幕”。', 'On iPhone/iPad: tap the browser share button, then choose “Add to Home Screen”.')}</p>
              <p>{tr('在 Android/桌面浏览器：如果没有自动弹出安装窗口，请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。', 'On Android/desktop: if no install prompt appears, open the browser menu and choose “Install app” or “Add to Home Screen”.')}</p>
            </div>
            <button type="button" onClick={() => setShowIosInstallModal(false)} className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}>
              {tr('明白了', 'Got it')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const segmentError = (['archive', 'mine', 'public'] as StoryListSegment[])
    .map((segment) => storyListSyncState?.[segment])
    .find((segment) => segment?.status === 'error');
  const computedConnectivityState: ConnectivityDrawerState | null = !isOnline
    ? {
        tone: 'offline',
        title: isEnglish ? 'Offline mode' : '当前处于离线状态',
        detail: isEnglish ? 'Available cached stories can still be read. Cloud actions will resume after reconnecting.' : '仍可阅读本机缓存内容；需要云端的操作会在网络恢复后再继续。',
      }
    : manualConnectivityNotice
      ? manualConnectivityNotice
      : segmentError
        ? {
            tone: 'error',
            title: isEnglish ? 'Some content failed to sync' : '部分内容同步失败',
            detail: segmentError.error || (isEnglish ? 'Cached content is kept on screen. Retry when the connection is stable.' : '页面会保留可用缓存；网络稳定后可重试同步。'),
          }
        : null;
  const connectivityDrawerState = computedConnectivityState && Date.now() - connectivityDismissedAt > 60000
    ? computedConnectivityState
    : null;

  return (
    <div data-theme={appTheme} className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <GlobalError errorMsg={errorMsg} />
      {installGuideModal}
      <ConnectivityDrawer
        state={connectivityDrawerState}
        onRetry={() => {
          setConnectivityDismissedAt(0);
          setManualConnectivityNotice(null);
          void refreshStories({ force: true });
          if (gameState === 'ARCHIVE') void refreshArchiveStories({ force: true });
        }}
        onHome={() => {
          setConnectivityDismissedAt(Date.now());
          resetToHome();
        }}
        onDismiss={() => setConnectivityDismissedAt(Date.now())}
      />
      
      {!isSessionHydrated ? (
        <StartupShell message={startupMessage} title={t('app.name')} subtitle={t('startup.default')} />
      ) : gameState === 'READONLY_STORY' && readonlyStoryData ? (
        <>
          {renderReadonlyStoryView()}
          {renderScrollToTopButton()}
          {accountEntryButton}
          {renderAuthorProfileModal()}
          {renderNotificationCenter()}
          {renderShareComposer()}
          {accountCenterModal}
        </>
      ) : !user ? (
        renderAuthView()
      ) : isRecoveringInvalidGameState ? (
        <StartupShell message={appLanguage === 'en-US' ? 'Restoring page state...' : '正在恢复页面状态...'} title={t('app.name')} subtitle={t('startup.default')} />
      ) : (
        <>
          {gameState === 'STORY_SELECT' && renderStorySelectView()}
          {gameState === 'ACCOUNT_CENTER' && renderAccountCenterView()}
          {gameState === 'ARCHIVE' && renderArchiveView()}
          {(gameState === 'SERIES_WORLD_LIST' || gameState === 'SERIES_WORLD_GENERATE' || gameState === 'SERIES_WORLD_EDIT') && renderSeriesWorldView()}
          {gameState === 'THEME_SELECTION' && renderThemeSelectionView()}
          {gameState === 'GENERATING_BLUEPRINT' && (
            <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-zinc-950 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="mb-8 h-12 w-12 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-500"
              />
              <h2 className="text-2xl font-black text-white">{generationStatus || (isEnglish ? 'Generating story blueprint...' : '正在生成世界蓝图...')}</h2>
              <GenerationProgressBar />
            </div>
          )}
          {gameState === 'PLAYING' && renderPlayingView()}
          {gameState === 'SUMMARY' && renderSummaryView()}
          {gameState === 'AUTHORING' && renderAuthoringView()}
          {gameState === 'READONLY_STORY' && renderReadonlyStoryView()}

          {gameState === 'PLAYING' && actionMenuButton}
          {renderPlayingQuickNav()}
          {renderScrollToTopButton()}
          {accountEntryButton}
          {primaryBottomDock}
          {floatingInterventionPanel}
          {actionMenuOverlay}
          {storyInfoPanel}
          {renderStoryDetailModal()}
          {renderSequelGateModal()}
          {renderAuthorProfileModal()}
          {renderNotificationCenter()}
          {renderShareComposer()}
          {accountCenterModal}
          {renderEditNameModal()}
          {renderEditBioModal()}
          {renderSecurityModal()}
          {renderOnboardingGuide()}
          {renderPushPermissionPrompt()}
          {renderConfirmationModal()}
          {renderAuthoringSaveSuccessModal()}
          {renderResumePromptModal()}
          {renderSequelInheritanceModal()}
          {renderLeaveGameModal()}
          {renderBranchUnlockModal()}
          {renderInterventionStatusNotice()}
          {renderSummaryModal()}
          {renderTourOverlay()}
          {renderHelpCenterDrawer()}
          {renderHelpFloatingButton()}
          
          <AnimatePresence>
            {storyLaunchOverlay && (
              <LoadingOverlay
                progress={storyLaunchOverlay.progress}
                status={storyLaunchOverlay.status}
                subtext={isEnglish ? 'Preparing an interactive story page.' : '正在准备可干涉的故事页面'}
                language={appLanguage}
              />
            )}
            {activeInterventionOverlay && (
              <LoadingOverlay 
                progress={generationProgress}
                status={generationStatus}
                variant={activeInterventionOverlay.type}
                language={appLanguage}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isGlobalBlockingLoading && (
              <BlockingSyncOverlay
                title={globalBlockingLoadingMessage}
                detail={globalBlockingLoadingDetail}
                zIndexClass="z-[9999]"
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
