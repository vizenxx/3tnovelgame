import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, ChevronRight, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft, Heart, Bookmark, Flag, Settings, PenSquare, Archive, ExternalLink, Download, Sun, Moon, Search, GitBranch, Trophy, Bell, BarChart3, WifiOff } from 'lucide-react';
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
import { GlobalError, InstallAppBanner, PwaUpdateModal } from './components/AppChrome';
import { DevMetricsPanel } from './components/DevMetricsPanel';
import { AccountProfileModals } from './components/AccountModals';
import { StoryLibraryCard } from './components/StoryLibraryCard';
import { StorySelectView } from './components/StorySelectView';
import { StoryDetailModal } from './components/StoryDetailModal';
import { StoryLibraryView } from './components/StoryLibraryView';
import { SocialOverlayLayer } from './components/SocialOverlayLayer';
import { AccountCenterLayer } from './components/AccountCenterLayer';
import { StoryInfoPanelLayer } from './components/StoryInfoPanelLayer';
import { PrimaryBottomDock } from './components/PrimaryBottomDock';
import { AccountCenterContent } from './components/AccountCenterView';
import { GameplayModals } from './components/GameplayModals';
import { AuthoringSaveSuccessModal, ConfirmationModal, SequelGateModal, type SequelGateModalState } from './components/GeneralModals';
import { AuthorProfileModal, NotificationCenterModal, ShareComposerModal } from './components/SocialModals';
import {
  AuthoringTourOverlay,
  HelpCenterDrawer,
  HelpFloatingButton,
  InlineHelpCard,
  OnboardingGuide,
  PushPermissionPrompt,
} from './components/HelpAndOnboarding';
import { HelpOverlayLayer } from './components/HelpOverlayLayer';
import { OnboardingPromptLayer } from './components/OnboardingPromptLayer';
import { ScrollToTopButton } from './components/FloatingControls';
import {
  BlockingSyncOverlay,
  ConnectivityDrawer,
  InlineSyncState,
  ListSkeleton,
  LoadingOverlay,
  type ConnectivityDrawerState,
} from './components/AppFeedback';
import { semanticButtonClass, semanticIconButtonClass, semanticMenuButtonClass } from './components/semanticClasses';
import { recordApiMetric } from './devMetrics';
import { areStoryChaptersEquivalent, hashStoryChapters } from './storyContentHash';
import { getFriendlyServerError } from './friendlyErrors';
import { createTranslator, getInitialLanguage, LANGUAGE_STORAGE_KEY, type AppLanguage } from './i18n';
import { dictionaries } from './i18n/dictionaries';

const AuthView = lazy(() => import('./components/AuthView').then((module) => ({ default: module.AuthView })));
const ArchiveView = lazy(() => import('./components/ArchiveView').then((m) => ({ default: m.ArchiveView })));
const ReadonlyStoryView = lazy(() => import('./components/ReadonlyStoryView').then((m) => ({ default: m.ReadonlyStoryView })));
const SeriesWorldView = lazy(() => import('./components/SeriesWorldView').then((m) => ({ default: m.SeriesWorldView })));
const ThemeSelectionView = lazy(() => import('./components/ThemeSelectionView').then((m) => ({ default: m.ThemeSelectionView })));
const AuthoringView = lazy(() => import('./components/AuthoringView').then((m) => ({ default: m.AuthoringView })));
const SummaryView = lazy(() => import('./components/SummaryView').then((m) => ({ default: m.SummaryView })));
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
type QuickQuizStepId = 'worlds' | 'moods' | 'conflict' | 'relationships' | 'interference' | 'ending' | 'length';
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
const VIEW_INTROS_STORAGE_KEY = '3t-view-intros';
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
      { id: 'gentle', label: { 'zh-CN': '温和改写', 'en-US': 'Gentle rewrite' }, outline: { 'zh-CN': '干涉更偏向温和改写，重视过程变化与人物理解', 'en-US': 'interference should gently reshape the path, character understanding, and consequences' } },
      { id: 'branching', label: { 'zh-CN': '明显分歧', 'en-US': 'Clear branches' }, outline: { 'zh-CN': '干涉会制造明显分歧', 'en-US': 'interference should create clear branches' } },
      { id: 'butterfly', label: { 'zh-CN': '蝴蝶效应', 'en-US': 'Butterfly effect' }, outline: { 'zh-CN': '小选择会逐步引发蝴蝶效应', 'en-US': 'small choices should gradually create butterfly effects' } },
      { id: 'darkcost', label: { 'zh-CN': '黑暗代价', 'en-US': 'Dark cost' }, outline: { 'zh-CN': '每次改变都要有清晰代价', 'en-US': 'every change should carry a visible cost' } },
      { id: 'defy', label: { 'zh-CN': '逆天改命', 'en-US': 'Defy fate' }, outline: { 'zh-CN': '干涉应有逆天改命的强烈张力', 'en-US': 'interference should feel like defying fate' } },
      { id: 'hiddenTruth', label: { 'zh-CN': '隐藏真相', 'en-US': 'Hidden truth' }, outline: { 'zh-CN': '干涉会逐步揭开隐藏真相', 'en-US': 'interference should uncover hidden truths' } },
    ],
  },
  {
    id: 'ending',
    title: { 'zh-CN': '想要怎样的终局结构？', 'en-US': 'What ending structure do you want?' },
    subtitle: { 'zh-CN': '选择故事最终收束方式。唯一走向更像同一终点的不同旅程；三域走向更强调不可兼得的分歧。', 'en-US': 'Choose how the story resolves. Fixed ending focuses on different routes to one finale; three-domain path emphasizes mutually exclusive outcomes.' },
    maxSelections: 1,
    options: [
      { id: 'single', label: { 'zh-CN': '唯一走向', 'en-US': 'Fixed ending' }, outline: { 'zh-CN': '最终收束到同一个核心终局，干涉改变过程、代价与理解', 'en-US': 'the story converges on one core finale while interference changes the route, cost, and understanding' }, endingMode: 'single' },
      { id: 'dual', label: { 'zh-CN': '三域走向', 'en-US': 'Three-domain path' }, outline: { 'zh-CN': '故事保留左域、中域、右域的分歧收束', 'en-US': 'the story keeps left, middle, and right domains as distinct resolutions' }, endingMode: 'dual' },
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
  ending: ['dual'],
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
  return 'text-app-text bg-zinc-500/12 border-zinc-400/20';
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

// Compute change highlights locally by diffing the chapter's previous text against the
// rewritten text — the sentences that newly appear are what the intervention changed.
// (Replaces having the AI output change_highlights, which slowed the rewrite down.)
const computeLocalChangeHighlights = (oldText: string, newText: string): string[] => {
  const splitSentences = (text: string) => String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/(?<=[。！？!?…\n])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4);
  const oldSentences = new Set(splitSentences(oldText));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sentence of splitSentences(newText)) {
    if (oldSentences.has(sentence) || seen.has(sentence)) continue;
    seen.add(sentence);
    if (sentence.length <= 160) result.push(sentence);
    if (result.length >= 12) break;
  }
  return result;
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
  // Chapter-by-chapter reveal: the highest chapter number the player has unlocked for reading.
  // Chapters beyond this are generated in the background but hidden, so interventions happen
  // without the player having seen the next chapter's outcome.
  const [unlockedChapterNum, setUnlockedChapterNum] = useState<number>(1);
  // When set, the observe/interfere gate modal is open for this chapter number.
  const [interventionGateChapter, setInterventionGateChapter] = useState<number | null>(null);
  // Gate modal stage: 'choose' = observe/interfere; 'select' = pick a character in-modal.
  const [interventionGateStage, setInterventionGateStage] = useState<'choose' | 'select'>('choose');
  // Revealed Threads (知因): ids of hidden cause-lines that have surfaced. Kept once revealed.
  const [revealedThreadIds, setRevealedThreadIds] = useState<string[]>([]);
  // Threads revealed in the latest batch, shown in a modal like a branch unlock.
  const [threadRevealNotice, setThreadRevealNotice] = useState<Array<{ title: string; content: string }> | null>(null);
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

  const [completedViewIntros, setCompletedViewIntros] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(VIEW_INTROS_STORAGE_KEY) || '[]'));
    } catch { return new Set<string>(); }
  });
  const [activeViewIntroKey, setActiveViewIntroKey] = useState<string | null>(null);

  const markViewIntroDone = (key: string) => {
    setCompletedViewIntros((prev) => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem(VIEW_INTROS_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
    setActiveViewIntroKey(null);
  };

  // When the authoring tour finishes, mark authoring intro as done so ViewIntroOverlay never fires for it
  const onAuthoringTourDone = () => markViewIntroDone('authoring');



  // Cartridge platform state
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [activeStoryMeta, setActiveStoryMeta] = useState<any | null>(null);

  useEffect(() => {
    if (!isSessionHydrated || !user) return;
    const isTutorialPlay = gameState === 'PLAYING' && activeStoryId === 'tutorial-cartridge';
    const key =
      isTutorialPlay ? 'playing-tutorial'
      : gameState === 'PLAYING' ? 'playing'
      : gameState === 'SUMMARY' ? 'summary'
      : gameState === 'STORY_SELECT' ? 'story-select'
      : gameState === 'THEME_SELECTION' ? 'theme-selection'
      : gameState === 'ARCHIVE' ? 'archive'
      : (gameState === 'SERIES_WORLD_LIST' || gameState === 'SERIES_WORLD_GENERATE' || gameState === 'SERIES_WORLD_EDIT') ? 'series-world'
      : gameState === 'READONLY_STORY' ? 'readonly'
      : gameState === 'ACCOUNT_CENTER' ? 'account-center'
      : null;
    if (!key || completedViewIntros.has(key)) {
      setActiveViewIntroKey(null);
      return;
    }
    const timer = window.setTimeout(() => setActiveViewIntroKey(key), 700);
    return () => window.clearTimeout(timer);
  }, [gameState, activeStoryId, isSessionHydrated, user?.uid, completedViewIntros]);
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
    if (matches.length === 0) showError(tr('没有找到匹配内容。', 'No matches found.'));
  };

  const moveAuthoringFindMatch = (direction: 1 | -1) => {
    const matches = getAuthoringFindMatches();
    if (matches.length === 0) {
      showError(tr('没有找到匹配内容。', 'No matches found.'));
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
    showError(tr('替换完成！', 'Replace complete.'));
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

    // Dynamic theme-color meta tag
    const themeColor = appTheme === 'light' ? '#f3eee6' : '#050508';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', themeColor);
    }

    // Dynamic PWA webmanifest link
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', appTheme === 'light' ? '/manifest-light.webmanifest' : '/manifest.webmanifest');
    }
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
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const action = (() => {
      try {
        return new URL(url, window.location.origin).searchParams.get('action') || undefined;
      } catch {
        return undefined;
      }
    })();
    try {
      const headers = await getAuthHeaders(init.headers);
      const response = await fetchWithTimeout(url, { ...init, headers }, ms);
      recordApiMetric({
        kind: url.includes('/api/ai') ? 'ai' : 'other',
        endpoint: url.split('?')[0] || url,
        action,
        stage: action,
        ok: response.ok,
        status: response.status,
        durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
      });
      return response;
    } catch (e: any) {
      const isTimeout = e.name === 'AbortError' || /abort/i.test(e.message);
      recordApiMetric({
        kind: url.includes('/api/ai') ? 'ai' : 'other',
        endpoint: url.split('?')[0] || url,
        action,
        stage: action,
        ok: false,
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
      });
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
        showError(tr('已取消分享。', 'Share canceled.'));
        return;
      }
      showError(error?.message || tr('分享失败。', 'Share failed.'));
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
        showError(tr('已取消分享。', 'Share canceled.'));
        return;
      }
      showError(error?.message || tr('分享作品失败。', 'Failed to share story.'));
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

  // Reveal the next chapter (observe / continue). Closes the gate modal and scrolls to it.
  const advanceChapter = (fromChapterNum: number) => {
    setInterventionGateChapter(null);
    setInterventionGateStage('choose');
    const nextChapterNum = Math.min(7, fromChapterNum + 1);
    setUnlockedChapterNum((prev) => Math.max(prev, nextChapterNum));
    scrollToChapter(nextChapterNum);
  };

  // Thread (知因) reveal engine: surface hidden cause-lines as their conditions are met.
  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'SUMMARY') return;
    const threads = Array.isArray(blueprint?.threads) ? blueprint.threads : [];
    if (threads.length === 0) return;
    const alreadyRevealed = new Set(revealedThreadIds);
    const endingDomain = endingValue > 5 ? 'left' : endingValue < -5 ? 'right' : 'default';
    const branchUnlockedIds = new Set<string>([
      ...unlockedBranches.map((branch: any) => String(branch.id)),
      ...historicallyUnlockedBranches.map((branch: any) => String(branch.id)),
    ]);
    const newlyRevealed: string[] = [];
    for (const thread of threads) {
      const id = String(thread?.id || '');
      if (!id || alreadyRevealed.has(id)) continue;
      let reveal = false;
      if (thread.revealType === 'branch') {
        reveal = branchUnlockedIds.has(String(thread.revealBranchId));
      } else if (thread.revealType === 'ending') {
        reveal = Boolean(storyConclusion) && (thread.revealEndingId === endingDomain || thread.revealEndingId === 'default');
      } else {
        // chapter_pristine: reached this chapter having NOT interfered at or before it.
        const ch = Number(thread.revealChapter) || 0;
        const pristineUpToHere = intervenedChapters.every((c: number) => Number(c) > ch);
        reveal = unlockedChapterNum >= ch && pristineUpToHere;
      }
      if (reveal) newlyRevealed.push(id);
    }
    if (newlyRevealed.length > 0) {
      setRevealedThreadIds((prev) => Array.from(new Set([...prev, ...newlyRevealed])));
      const revealedObjs = newlyRevealed
        .map((id) => threads.find((thread: any) => String(thread?.id) === id))
        .filter(Boolean)
        .map((thread: any) => ({ title: String(thread.title || ''), content: String(thread.content || '') }));
      if (revealedObjs.length > 0) setThreadRevealNotice(revealedObjs);
    }
  }, [gameState, blueprint, unlockedChapterNum, intervenedChapters, unlockedBranches, historicallyUnlockedBranches, storyConclusion, endingValue, revealedThreadIds]);

  // Pristine threads bound to a chapter: the root causes a chapter should weave in, but only
  // when the player reaches it WITHOUT having interfered at or before it (else the cause changed).
  const pristineThreadsForChapter = (chapterNum: number, threadsSource: any, intervenedSource: any) => {
    const threads = Array.isArray(threadsSource) ? threadsSource : [];
    const pristine = (Array.isArray(intervenedSource) ? intervenedSource : []).every((c: any) => Number(c) > chapterNum);
    if (!pristine) return [];
    return threads
      .filter((thread: any) => thread?.revealType === 'chapter_pristine' && Number(thread?.revealChapter) === chapterNum)
      .map((thread: any) => ({ title: thread.title, content: thread.content }));
  };

  // Character-selection grid shown inside the gate modal when the player chooses to interfere.
  const renderInterventionCharacterGrid = (chapter: any) => {
    if (!blueprint || !chapter) return null;
    const availableCharacters = getChapterAvailableCharacters(chapter, blueprint);
    return (
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {availableCharacters.map((char: any) => {
          const branchHints = Array.from(new Set(
            (blueprint.branches || []).flatMap((branch: any) => {
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
                  if (s.chapterNum === chapter.chapter_num && s.charId === char.id) isMatch = true;
                } else if (tg.type === 'count' || (!tg.type && tg.count)) {
                  const c = tg.count || {};
                  if (c.charId === char.id && chapter.chapter_num <= (c.upToChapterNum || 6)) isMatch = true;
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
            <div key={char.id} className="rounded-2xl border border-app-border bg-app-bg/60 p-4 text-left">
              <div className="mb-3">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-black text-app-text">{char.name}</div>
                  {characterStatuses[char.id] && (
                    <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {characterStatuses[char.id].status || tr('在场', 'Present')}
                    </div>
                  )}
                </div>
                {branchHints.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs leading-relaxed text-app-muted">
                    {branchHints.map((hint: string, hintIdx: number) => (
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
    );
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
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-app-border/45 bg-app-bg/45 p-1 text-xs font-bold text-app-muted backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setReadingTextScale((value) => Math.max(0.9, Number((value - 0.1).toFixed(1))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-app-surface-soft hover:text-white active:scale-95"
      >
        A-
      </button>
      <span className="min-w-12 text-center text-app-muted">{Math.round(readingTextScale * 100)}%</span>
      <button
        type="button"
        onClick={() => setReadingTextScale((value) => Math.min(1.4, Number((value + 0.1).toFixed(1))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-app-surface-soft hover:text-white active:scale-95"
      >
        A+
      </button>
      <span className="mx-1 h-5 w-px bg-app-surface-soft" />
      <button
        type="button"
        onClick={() => setReadingTextOpacity((value) => Math.max(0.7, Number((value - 0.05).toFixed(2))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-app-surface-soft hover:text-white active:scale-95"
      >
        亮-
      </button>
      <span className="min-w-12 text-center text-app-muted">{Math.round(readingTextOpacity * 100)}%</span>
      <button
        type="button"
        onClick={() => setReadingTextOpacity((value) => Math.min(1, Number((value + 0.05).toFixed(2))))}
        className="rounded-xl px-3 py-2 transition-colors hover:bg-app-surface-soft hover:text-white active:scale-95"
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
      showError(tr('保存进度失败', 'Failed to save progress.'));
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
      showError(tr('收藏命运失败', 'Failed to collect fate.'));
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
    showError(tr('数据库操作失败，请检查权限或网络。', 'Database operation failed. Check permissions or network.'));
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
    const endingOption = asSafeArray(answers.ending)
      .map((id) => getQuickQuizOption('ending', id))
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
      endingMode: endingOption?.endingMode || 'dual',
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
    unlockedChapterNum,
    revealedThreadIds,
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
    // Chapter-by-chapter is the only mode now. Old saves predate the unlock pointer: resume at
    // their highest intervened chapter (already-generated chapters unlock instantly as the player
    // continues), never the old all-at-once layout. A finished run reveals all chapters.
    const snapshotMaxIntervened = asSafeArray<any>(snapshot.intervenedChapters)
      .reduce((max, chapter) => Math.max(max, Number(chapter) || 0), 0);
    setUnlockedChapterNum(snapshot.storyConclusion ? 7 : (Number(snapshot.unlockedChapterNum) || Math.max(1, snapshotMaxIntervened)));
    setRevealedThreadIds(asSafeArray(snapshot.revealedThreadIds));
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
    // Only show the loading skeleton when there is no content to show yet.
    // When stories are already on screen, refresh silently in the background.
    const hasExistingContent = publicStories.length > 0 || myStories.length > 0;
    if (!hasExistingContent) {
      setIsLoadingStories(true);
    }
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
      // Committed to a network fetch — show loading if not already showing.
      if (hasExistingContent) {
        setIsLoadingStories(true);
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
      showError(tr('追踪作者列表同步失败，请稍后再试。', 'Failed to sync followed authors. Please try again later.'));
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
    }
  }, [user?.uid, db]);

  useEffect(() => {
    if (gameState !== 'AUTHORING' || authoringCartridge || !user || !db) return;
    void loadSeriesWorlds();
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
        showError(tr('未找到这份故事记录，或当前账号没有访问权限。', 'This story record was not found, or the current account cannot access it.'));
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
      showError(tr('载入故事记录失败。', 'Failed to load story record.'));
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
      showError(tr('该分享记录未关联原始故事，无法直接干涉。', 'This shared record is not linked to an original story, so it cannot be interfered with directly.'));
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
      showError(tr('原作者尚未开放这篇作品的一键改编权限。', 'The original creator has not enabled one-click adaptation for this story.'));
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
      showError(tr('已完成一键改编，正在进入作者编辑界面。', 'Adaptation created. Opening the creator editor.'));
      setReadonlyStoryData(null);
      setReadonlyCanGoBack(false);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error(error);
      showError(`${tr('一键改编失败', 'Adaptation failed')}: ${error instanceof Error ? error.message : tr('请稍后再试。', 'Please try again later.')}`);
    } finally {
      setIsLoadingStories(false);
    }
  };

  const handleArchiveVisibilityChange = async (story: any, visibility: 'private' | 'unlisted') => {
    if (!db || !user || !story?.id) return;
    if (story.archiveKind === 'favorite') {
      showError(tr('收藏原作的公开状态由原作者决定。', 'The original creator controls visibility for saved original works.'));
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
      showError(tr('更新公开设置失败，请稍后再试。', 'Failed to update visibility. Please try again later.'));
    } finally {
      setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: false }));
    }
  };

  const handleDeleteArchiveStory = (story: any) => {
    if (!db || !user || !story?.id) return;
    setConfirmationModal({
      isOpen: true,
      title: tr('删除馆藏记录？', 'Delete archive record?'),
      message: tr(
        `这只会删除当前账号馆藏里的《${stripBookTitle(story.title || '未命名故事')}》记录，不会删除原作者的作品，也不会影响其他人已拥有的分享链接记录。此操作无法撤销。`,
        `This only removes “${stripBookTitle(story.title || 'Untitled story')}” from the current archive. It will not delete the original creator's work or affect share links already owned by others. This cannot be undone.`
      ),
      onConfirm: async () => {
        try {
          setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: true }));
          if (story.archiveKind === 'favorite') {
            await unfavoriteStory(db as any, story.sourceStoryId || story.id, user.uid);
          } else {
            await deleteSharedStoryRecord(db as any, story.id, user.uid);
          }
          setMySharedStories((prev) => prev.filter((item: any) => item.id !== story.id));
          showError(tr('馆藏记录已删除。', 'Archive record deleted.'));
        } catch (error: any) {
          console.error(error);
          showError(error?.message || tr('删除馆藏记录失败。', 'Failed to delete archive record.'));
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
        showError(tr('已取消分享。', 'Share canceled.'));
        return;
      }
      showError(error?.message || tr('分享失败。', 'Share failed.'));
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
      title: tr('删除馆藏记录？', 'Delete archive record?'),
      message: tr(
        `这会删除当前账号馆藏里的《${stripBookTitle(story.meta?.title || '未命名故事')}》记录。原作者作品不会被删除，但这条记录的分享链接将无法继续访问。此操作无法撤销。`,
        `This removes “${stripBookTitle(story.meta?.title || 'Untitled story')}” from the current archive. The original story will not be deleted, but this record's share link will stop working. This cannot be undone.`
      ),
      onConfirm: async () => {
        try {
          setArchiveUpdatingIds((prev) => ({ ...prev, [archiveId]: true }));
          await deleteSharedStoryRecord(db as any, archiveId, user.uid);
          setMySharedStories((prev) => prev.filter((item: any) => item.id !== archiveId));
          setReadonlyStoryData(null);
          setReadonlyCanGoBack(false);
          window.history.replaceState({}, '', window.location.pathname);
          goBack(readonlyReturnTarget === 'ARCHIVE' ? 'ARCHIVE' : 'STORY_SELECT');
          showError(tr('馆藏记录已删除。', 'Archive record deleted.'));
        } catch (error: any) {
          console.error(error);
          showError(error?.message || tr('删除馆藏记录失败。', 'Failed to delete archive record.'));
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
        showError(tr('Google 登录窗口已关闭，请重新操作。', 'Google sign-in was closed. Please try again.'));
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
      showError(error?.message || tr('Google 登录失败，请重试。', 'Google sign-in failed. Please try again.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailPasswordLogin = async () => {
    if (!auth || !authEmail.trim() || authPassword.length < 6) {
      showError(tr('请输入有效邮箱和至少 6 位密码。', 'Enter a valid email and a password with at least 6 characters.'));
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
        showError(tr('游客账号已注册为正式用户，当前记录已保留。', 'Guest account upgraded. Current records were kept.'));
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
      showError(error?.message || tr('登录失败，请重试。', 'Sign-in failed. Please try again.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth || !authEmail.trim()) {
      showError(tr('请先输入邮箱。', 'Enter an email first.'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, authEmail.trim());
      showError(tr('密码重设邮件已发送。', 'Password reset email sent.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('无法发送重设邮件。', 'Unable to send reset email.'));
    }
  };

  const handleAnonymousLogin = async () => {
    if (!auth) return;
    setIsLoggingIn(true);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('游客登录失败，请重试。', 'Guest sign-in failed. Please try again.'));
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
      showError(tr('Google 登录回调失败，请重试。', 'Google sign-in callback failed. Please try again.'));
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
      showError(tr('当前已经在 App 模式中使用。', 'Already running in app mode.'));
      return;
    }
    if (isIosDevice()) {
      setShowIosInstallModal(true);
      return;
    }
    if (!installPromptEvent) {
      showError(tr('如果浏览器没有弹出安装提示，请从浏览器菜单选择“安装应用”或“添加到主屏幕”。', 'If no install prompt appears, choose “Install app” or “Add to Home Screen” from the browser menu.'));
      return;
    }
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setInstallPromptEvent(null);
      setIsStandaloneMode(true);
      showError(tr('已开始安装 App。', 'App installation started.'));
    }
  };

  const copySharePayload = async (payload: ShareData) => {
    const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
    showError(copied ? tr('已复制分享内容到剪贴板。', 'Share content copied to clipboard.') : tr('分享内容已准备好，请手动复制浏览器地址。', 'Share content is ready. Please copy the browser address manually.'));
    return copied;
  };

  const openSystemShare = async (payload: ShareData) => {
    if (!navigator.share) {
      return copySharePayload(payload);
    }
    await navigator.share(payload);
    showError(tr('已打开系统分享。', 'System share sheet opened.'));
    return true;
  };

  const deliverPreparedShare = async (payload: ShareData): Promise<boolean> => {
    if (!navigator.share) {
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      showError(copied ? tr('已复制分享内容到剪贴板。', 'Share content copied to clipboard.') : tr('分享链接已准备好，请手动复制浏览器地址。', 'Share link is ready. Please copy the browser address manually.'));
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
        showError(tr('已取消分享。', 'Share canceled.'));
        return false;
      }
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      if (copied) {
        showError(tr('系统分享未能打开，但分享内容已复制，可直接粘贴发送。', 'System sharing did not open, but the share content was copied.'));
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
        showError(tr('已取消分享。', 'Share canceled.'));
        return;
      }
      showError(error?.message || tr('分享失败。', 'Share failed.'));
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
      const userDoc = await withTimeout(
        getDoc(doc(db as any, 'users', user.uid)),
        3500,
        '用户资料读取超时。'
      ).catch((error) => {
        console.warn('User profile load skipped:', error);
        return null;
      });
      if (userDoc?.exists() && !cancelled) {
        setMyBio(userDoc.data()?.bio || '');
      }
      if (cachedRun?.value?.gameState === 'PLAYING') {
        await applyLocalRunSnapshot(cachedRun.value);
      } else {
        setSessionId(user.uid);
        resetToHome();
        setStartupMessage(isEnglish ? 'Reading story archive...' : '正在读取作品档案...');
        const loadedStories = await withTimeout(
          refreshStories(),
          8000,
          '首页作品同步超时，已先进入首页。'
        ).catch((error) => {
          // The 8s budget only means "enter the home page without waiting" — it does NOT cancel
          // refreshStories, which keeps running in the background and populates the list when it
          // returns. Cached content (if any) is already on screen, so stay silent rather than
          // showing a sync notice that just reads as an error.
          console.warn('Initial story library sync still in flight:', error);
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
      showError(tr('同步会话失败，请检查登录状态或服务器权限配置后重试。', 'Session sync failed. Check sign-in status or server permissions, then try again.'));
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
        showError(tr('加载分享故事失败。', 'Failed to load shared story.'));
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
      showError(tr('保存进度失败', 'Failed to save progress.'));
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
        showError(tr('原作已加入馆藏，不会重复收藏一份相同文本。', 'The original story is already in the archive, so the same text will not be saved again.'));
      } else {
        const { shareId, sharedRecord, cleanChapters } = await createCurrentStorySnapshot('unlisted', 'saved_run');
        cacheSharedSnapshotAfterCreate(shareId, sharedRecord, cleanChapters);
        showError(tr('这段命运已加入收藏命运（非公开链接）。', 'This fate line has been added to Fate Archive as an unlisted link.'));
      }
      await resetGame();
      return;
    } catch (e) {
      console.error(e);
      showError(tr('收藏命运失败', 'Failed to collect fate.'));
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
        <div className="h-1 overflow-hidden rounded-full bg-app-surface">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-app-muted">{percent}%</div>
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
      showError(tr('请先登录，再进行一键改编。', 'Please sign in before using one-click adaptation.'));
      return;
    }
    if (!db || !blueprint) {
      showError(tr('当前没有可改编的故事。', 'No adaptable story is available.'));
      return;
    }
    if (!canAdaptCurrentStory()) {
      showError(tr('原作者尚未开放这篇作品的一键改编权限。', 'The original creator has not enabled one-click adaptation for this story.'));
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
      showError(tr('已完成一键改编，正在进入作者编辑界面。', 'Adaptation created. Opening the creator editor.'));
    } catch (error) {
      console.error(error);
      showError(`${tr('一键改编失败', 'Adaptation failed')}: ${error instanceof Error ? error.message : tr('请稍后再试。', 'Please try again later.')}`);
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
          <p className="text-sm font-bold text-app-muted tracking-widest uppercase">进度 {Math.round(progress)}%</p>
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

  const startTutorialFromOnboarding = () => {
    dismissOnboardingGuide();
    void startStoryPlay('tutorial-cartridge');
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
    showError(tr(`已套用「${template.label}」模板，可继续微调。`, `“${template.label}” template applied. Fine-tune as needed.`));
  };

  const refreshNotificationCenter = async () => {
    if (!db || !user) {
      setNotificationItems([]);
      return;
    }
    try {
      setNotificationLoading(true);
      const rows = await listNotifications(db as any, 30);
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
      showError(tr('通知已读同步失败，请稍后再试。', 'Failed to mark notifications as read. Please try again later.'));
    }
  };

  const clearAllNotifications = async () => {
    const previousItems = notificationItems;
    const previousPulse = authorPulseNotifications;
    setNotificationItems([]);
    setAuthorPulseNotifications([]);
    try {
      if (db) await deleteAllNotifications(db as any);
      showError(tr('通知已清空。', 'Notifications cleared.'));
    } catch (error) {
      console.warn('clear notifications failed:', error);
      setNotificationItems(previousItems);
      setAuthorPulseNotifications(previousPulse);
      showError(tr('通知清空失败，请稍后再试。', 'Failed to clear notifications. Please try again later.'));
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
      showError(tr('通知删除失败，已重新同步。', 'Failed to delete notification. Synced again.'));
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
      showError(error?.message || tr('分享失败。', 'Share failed.'));
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
      showError(error?.message || tr('作者资料载入失败。', 'Failed to load author profile.'));
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
      showError(result?.following ? tr('已追踪作者。', 'Author followed.') : tr('已取消追踪。', 'Author unfollowed.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('追踪操作失败。', 'Follow action failed.'));
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
      showError(tr('这个设备暂时不支持 PWA 推送通知。', 'This device does not support PWA push notifications.'));
      return;
    }
    try {
      setPushSubscribeBusy(true);
      const config = await getPushConfig();
      if (!config.publicKey || !config.enabled) {
        showError(tr('服务器还没有配置推送密钥，暂时只能使用 App 内通知。', 'Push keys are not configured yet. In-app notifications are still available.'));
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showError(tr('通知权限尚未允许。', 'Notification permission was not granted.'));
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      await savePushSubscription(subscription.toJSON());
      showError(tr('手机通知已开启。', 'Mobile notifications enabled.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('开启手机通知失败。', 'Failed to enable mobile notifications.'));
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
      showError(detail ? tr(`发生错误：${detail}。已回到作品库。`, `An error occurred: ${detail}. Returned to the library.`) : tr('发生错误，已回到作品库。', 'An error occurred. Returned to the library.'));
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
      showError(tr('页面资料没有完整载入，已回到作品库。', 'Page data did not fully load. Returned to the library.'));
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
      showError(tr('重置命运失败', 'Failed to reset fate.'));
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
    // New run: start at chapter 1, reveal one chapter at a time (the only mode).
    // Resumed run: saved unlock pointer; old saves resume at their highest intervened chapter.
    const resumeMaxIntervened = asSafeArray<any>(progressData?.intervenedChapters)
      .reduce((max, chapter) => Math.max(max, Number(chapter) || 0), 0);
    setUnlockedChapterNum(
      progressData?.storyConclusion
        ? 7
        : progressData
          ? (Number(progressData.unlockedChapterNum) || Math.max(1, resumeMaxIntervened))
          : 1
    );
    setInterventionGateChapter(null);
    setRevealedThreadIds(progressData?.revealedThreadIds || []);
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
          showError(tr('无法连接云端，已使用本机缓存打开故事。', 'Cloud connection failed. Opened the story from local cache.'));
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
        showError(getFriendlyServerError(progressError, tr('云端进度暂时无法读取，已先开启原始故事。', 'Cloud progress cannot be read right now. Opened the original story first.')));
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
      showError(tr('无法开启故事', 'Unable to open story.'));
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
      showError(tr('初始化故事失败', 'Failed to initialize story.'));
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
        showError(tr('继承开场生成暂时失败，已使用本机接续文本进入续作。', 'Inherited opening generation failed for now. Entered the sequel with local continuity text.'));
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
      showError(tr('已继承前作命运线，续作开场已按该记录调整。', 'Previous fate line inherited. The sequel opening has been adjusted.'));
    } catch (error) {
      console.error('[inherited-sequel:start]', error);
      showError(tr('续作继承失败，请稍后重试。', 'Sequel inheritance failed. Please try again later.'));
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
      showError(tr('恢复故事进度失败', 'Failed to restore story progress.'));
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
        showError(appLanguage === 'en-US' ? 'Choose up to 4 story tags.' : '最多选择 4 个主题。');
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

      // Chapter-by-chapter mode: only chapter 1 needs to be ready before entering. The rest are
      // generated in the background as the player advances, so a long prefetch queue here just
      // makes quick-generation slower and more failure-prone. Pre-generate only the opening chapter.
      // Show-one / prepare-one: pre-generate the first TWO chapters so that observing after
      // chapter 1 reveals chapter 2 with no wait. From there the background generator stays one
      // chapter ahead as the player advances. (The blueprint route's maxDuration is the real fix
      // for generation failures, so a 2-chapter prefetch is safe again.)
      const prefetchChapters = [1, 2];
      for (const chapterNum of prefetchChapters) {
        if (isChapterTextReady((data.chapters || []).find((chapter: any) => chapter.chapter_num === chapterNum))) {
          continue;
        }
        generationStage = appLanguage === 'en-US' ? `generating chapter ${chapterNum}` : `生成第 ${chapterNum} 章`;
        setGenerationStatus(isEnglish ? `Writing chapter ${chapterNum}...` : `正在具象化第 ${chapterNum} 章...`);
        setGenerationProgress(72 + chapterNum * 9);
        const chapterResponse = await withRetry(() => apiFetch('/api/ai?action=generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint: data,
            currentChapters: data.chapters,
            targetChapterNum: chapterNum,
            targetWordCount: activeGenerationInput.targetWordCount,
            narrativePerson: activeGenerationInput.narrativePerson,
            boundThreads: pristineThreadsForChapter(chapterNum, data.threads, []),
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
        name: branch.name || branch.theme || (appLanguage === 'en-US' ? 'Untitled Branch' : '未命名支线'),
        sceneText: branch.sceneText || branch.desc || '',
        trigger: branch.trigger || {
          type: 'single',
          single: {
            chapterNum: branch.condition_chapter || 2,
            charId: branch.condition_char || data.characters?.[0]?.id || 'c1',
            action: branch.condition_action === 'curse' ? 'curse' : 'bless',
          },
        },
      })).map((branch: any) => {
        const triggerGroups = Array.isArray(branch.triggerGroups) && branch.triggerGroups.length > 0
          ? branch.triggerGroups
          : (branch.trigger ? [branch.trigger] : []);
        const publicHint = String(
          branch.hint
          || triggerGroups.map((group: any) => group?.hint).find(Boolean)
          || '',
        ).trim();
        return {
          ...branch,
          hint: publicHint,
          triggerGroups,
        };
      });

      const initialStatuses: Record<string, { status: string; isDead: boolean }> = {};
      (data.characters || []).forEach((character: any) => {
        initialStatuses[character.id] = { status: appLanguage === 'en-US' ? 'Present' : '存活', isDead: false };
      });

      setBlueprint(data);
      setChapters(data.chapters || []);
      setUnlockedChapterNum(1);
      setRevealedThreadIds([]);
      setInterventionGateChapter(null);
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
      setUiFeedback({ leftProgress: 0, rightProgress: 0, endingLabel: '中域' });
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

    // Generate at most one chapter ahead of what the player has unlocked. An early
    // intervention discards later chapters, so generating them eagerly wastes work —
    // and revealing chapters one at a time is what makes interventions a blind bet.
    // Generate two chapters ahead of what's unlocked so "observe" never waits: when the
    // player reveals the next chapter, the one after it is already being prepared.
    const generationCeiling = unlockedChapterNum + 2;
    const missingChapter = chapters
      .filter((chapter) => Number(chapter.chapter_num) > 1 && Number(chapter.chapter_num) <= generationCeiling)
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
            boundThreads: pristineThreadsForChapter(Number(missingChapter.chapter_num), blueprint?.threads, intervenedChapters),
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
  }, [gameState, blueprint, chapters, interventionsLeft, isRewriting, activeInterventionOverlay, user, db, targetWordCount, narrativePerson, appLanguage, unlockedChapterNum]);

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
      showError(tr('无法载入该作品。', 'Unable to load this story.'));
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
        title: tr('放弃未保存更改？', 'Discard unsaved changes?'),
        message: tr('创建新作品会放弃当前未保存的更改。确定继续吗？', 'Creating a new story will discard current unsaved changes. Continue?'),
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
        title: tr('未命名作品', 'Untitled story'),
        tags: [],
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      showError(tr('新作品已创建。', 'New story created.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('新建作品失败。', 'Failed to create story.'));
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleDeleteAuthoringStory = async (confirmed = false) => {
    if (!db || !authoringStoryId) return;
    if (!confirmed) {
      setConfirmationModal({
        isOpen: true,
        title: tr('删除作品？', 'Delete story?'),
        message: tr('这部作品会被永久删除，此操作无法撤销。', 'This story will be permanently deleted. This cannot be undone.'),
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
      showError(tr('作品已删除。', 'Story deleted.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('删除作品失败。', 'Failed to delete story.'));
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleSaveSelectedBranch = async () => {
    if (!authoringStoryId || !selectedBranchId) {
      showError(tr('请先选择需要保存的支线。', 'Choose a branch to save first.'));
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
      showError(error?.message || tr('保存支线失败。', 'Failed to save branch.'));
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
      showError(error?.message || tr('保存作品失败。', 'Failed to save story.'));
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
      showError(tr('请上传图片文件。', 'Please upload an image file.'));
      return;
    }
    try {
      const coverUrl = await compressImageToSquareDataUrl(file);
      applyAuthoringCover(coverUrl);
      showError(tr('封面已载入，记得点击“保存更改”。', 'Cover loaded. Remember to click “Save Changes”.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('封面处理失败。', 'Failed to process cover.'));
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

  const handleAuthoringCoverClipboardRead = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      showError(tr('当前浏览器不支持直接读取剪贴板图片。可以使用 Ctrl/Cmd+V 粘贴，或上传图片文件。', 'This browser cannot read clipboard images directly. Use Ctrl/Cmd+V paste, or upload an image file.'));
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const extension = imageType.split('/')[1] || 'png';
        const file = new File([blob], `pasted-cover.${extension}`, { type: imageType });
        await handleAuthoringCoverUpload(file);
        return;
      }
      showError(tr('剪贴板里没有可用的图片。', 'No usable image found in the clipboard.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('读取剪贴板图片失败。请确认浏览器授权，或改用 Ctrl/Cmd+V 粘贴。', 'Failed to read the clipboard image. Check browser permission, or use Ctrl/Cmd+V paste.'));
    }
  };

  const handleGenerateAuthoringCover = async () => {
    if (!authoringCartridge) return;
    if (!canUseCoverGeneration) {
      showError(tr('AI 图片生成暂未开放。', 'AI image generation is not open yet.'));
      return;
    }
    if (!authoringCoverPrompt.trim()) {
      showError(tr('请先输入封面生成提示。', 'Enter a cover prompt first.'));
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
      showError(tr(`AI 封面已生成，记得点击“保存更改”。今日还可生成 ${remaining} 张。`, `AI cover generated. Remember to click “Save Changes”. ${remaining} generation(s) left today.`));
    } catch (error: any) {
      console.error(error);
      if (quotaReserved) {
        await refundCoverGenerationQuota().catch((refundError) => console.error(refundError));
      }
      showError(error?.message || tr('AI 封面生成失败。', 'AI cover generation failed.'));
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
      showError(tr('管理设置已保存。', 'Admin settings saved.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('保存管理设置失败。', 'Failed to save admin settings.'));
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
      showError(tr('个人签名更新成功！', 'Bio updated.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('个人签名保存失败。', 'Failed to save bio.'));
    } finally {
      setBioSaving(false);
    }
  };

  useEffect(() => {
    setEditingBio(myBio);
  }, [myBio, isAccountCenterOpen, gameState]);

  const handleUpdateProfileDisplayName = async () => {
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      showError(tr('游客请先注册为正式用户后再修改名称。', 'Guest accounts must register before changing display name.'));
      return;
    }
    const nextName = limitFiveChars(profileDisplayName);
    if (!nextName) {
      showError(tr('请输入新的显示名称。', 'Enter a new display name.'));
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: nextName });
      setUser({ ...auth.currentUser } as FirebaseUser);
      await syncCurrentAuthorName(auth.currentUser);
      await refreshStories({ force: true });
      showError(tr('显示名称已更新。', 'Display name updated.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('更新名称失败。', 'Failed to update name.'));
    }
  };

  const handleUpdateAccountPassword = async () => {
    if (!auth?.currentUser || !auth.currentUser.email) {
      showError(tr('当前账号无法直接修改密码。', 'This account cannot change password directly.'));
      return;
    }
    if (!profileCurrentPassword || profileNewPassword.length < 6) {
      showError(tr('请输入当前密码，以及至少 6 位的新密码。', 'Enter the current password and a new password with at least 6 characters.'));
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, profileCurrentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, profileNewPassword);
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      showError(tr('账户密码已更新。', 'Password updated.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('修改密码失败。', 'Failed to change password.'));
    }
  };

  const handlePasswordResetForEmail = async (email: string) => {
    if (!auth || !String(email || '').trim()) {
      showError(tr('请输入邮箱。', 'Enter an email.'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, String(email || '').trim());
      showError(tr('密码重设邮件已发送。', 'Password reset email sent.'));
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('无法发送重设邮件。', 'Unable to send reset email.'));
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
      showError(error?.message || tr('登出失败，请重试。', 'Sign-out failed. Please try again.'));
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
      setInterventionGateChapter(null);
      setInterventionGateStage('choose');
      setInterventionEffect(action);
      setActiveInterventionOverlay({ type: action, targetChapter: chapterNum, statusRaw: "因果重塑中..." });
      
      const charName = blueprint.characters.find(c => c.id === charId)?.name || "未知角色";
      simulation = startProgressSimulation(25000, isEnglish
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
            // Keep every chapter's summary so the rewrite can re-plan the ripple (future_outlines)
            // against the author's original later beats — but drop the full prose of later chapters
            // to trim the prompt. Chapters up to the intervened one keep their full text as context.
            blueprint,
            chapters: chapters.map((chapterItem) => (
              Number(chapterItem.chapter_num) > chapterNum ? { ...chapterItem, text: '' } : chapterItem
            )),
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
        returnedChapterNums.forEach((num) => {
          const oldText = String(previousByNum.get(num)?.text || '');
          const newText = String(aiData.chapters.find((chapter: any) => Number(chapter.chapter_num) === num)?.text || '');
          const localHighlights = computeLocalChangeHighlights(oldText, newText);
          if (localHighlights.length) {
            nextChangeHighlights[num] = localHighlights;
          } else {
            delete nextChangeHighlights[num];
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
      // Stay on the intervened chapter to read the rewrite. For a back-intervention this pulls
      // the unlock pointer back, washing out the later chapters that have to be re-read.
      setUnlockedChapterNum(chapterNum);
      if (activeStoryId && db) {
        const progressPayload = {
          ...buildCurrentRunSnapshot(),
          interventionsLeft: nextInterventionsLeft,
          endingValue: nextEndingValue,
          unlockedBranches: nextUnlockedBranches,
          historicallyUnlockedBranches: nextHistoricalBranches,
          intervenedChapters: nextIntervenedChapters,
          unlockedChapterNum: chapterNum,
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
      // Chapter-by-chapter mode: running out of interventions never jumps to the ending.
      // The player keeps reading to the final chapter, where the ending is revealed.
      setInterventionStatusNotice({ updates: changedStatusUpdates });
      
      setActiveInterventionOverlay(null);
      setIsRewriting(false);
      setActiveInterventionChapter(null);
      setInterventionEffect(null);
      scrollToChapter(chapterNum);

    } catch (e) {
      console.error(e);
      showError(e.message || tr('干涉失败，请重试', 'Intervention failed. Please try again.'));
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
    // activeStoryId is null for an unsaved quick-generated story — the summary must still
    // generate. Only the progress save further down depends on activeStoryId.
    if (isGeneratingConclusion || !blueprint) return;
    if (storyConclusion) {
      setShowSummaryModal(true);
      return;
    }
    let simulation: ReturnType<typeof setInterval> | null = null;
    
    try {
      setIsGeneratingConclusion(true);
      setSummaryEntrySource(source);
      setActiveInterventionOverlay({ type: 'ending', targetChapter: 7, statusRaw: '终局演绎中...' });
      
      simulation = startProgressSimulation(18000, isEnglish
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
      if (db && user && activeStoryId) {
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
      showError(e.message || tr('生成总结失败', 'Failed to generate summary.'));
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

  // Out of interventions and the final chapter is unlocked → auto-settle, so the reader sees
  // the fate summary before reading the finale. Wait until chapter 7's prose is ready so the
  // summary covers the whole story, finale included. (With interventions left we never
  // auto-settle — the player keeps the right to interfere and must choose "Seal this fate".)
  useEffect(() => {
    if (gameState !== 'PLAYING' || !blueprint || isRewriting || isGeneratingConclusion) return;
    const finaleChapter = chapters.find((chapter) => Number(chapter.chapter_num) === 7);
    if (unlockedChapterNum >= 7 && interventionsLeft <= 0 && !storyConclusion && isChapterTextReady(finaleChapter)) {
      void handleGenerateSummary('auto_interventions');
    }
  }, [gameState, blueprint, chapters, unlockedChapterNum, interventionsLeft, storyConclusion, isRewriting, isGeneratingConclusion]);

  const handleShareStory = async () => {
    if (!user || !blueprint) return;
    let shareStage = 'start';
    let createdShareId = '';
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing share...' : '正在准备分享...');
      setGlobalLoadingDetail(isEnglish ? 'Choosing whether to share the original or current fate line, then opening the system share sheet.' : '正在判断分享原作还是当前命运线，并尽快调用系统分享。');
      const shareTitle = formatBookTitle(blueprint?.title || tr('未命名故事', 'Untitled story'));
      const cleanChapters = getCleanCurrentRunChapters();
      const shareText = buildStoryShareText(shareTitle, cleanChapters);
      if (activeStoryId && currentRunMatchesOriginal()) {
        shareStage = 'deliverOriginalShare';
        setGlobalLoadingDetail(tr('正在调用设备的分享功能。', 'Opening the device share sheet.'));
        if (await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(activeStoryId) })) {
          await recordStoryShare(activeStoryId);
        }
        return;
      }
      shareStage = 'createStorySnapshot';
      setGlobalLoadingDetail(tr('当前故事已发生变化，正在加入收藏命运并准备非公开链接。', 'The current story has changed. Adding it to Fate Archive and preparing an unlisted link.'));
      const { shareId, sharedRecord, cleanChapters: snapshotChapters } = await createCurrentStorySnapshot('unlisted', 'intervened');
      createdShareId = shareId;
      setSharedStoryId(shareId);
      shareStage = 'deliverPreparedShare';
      setGlobalLoadingDetail(tr('分享记录已准备好，正在调用设备的分享功能。', 'Share record ready. Opening the device share sheet.'));
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
        title: blueprint?.title || "未命名故事",
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
        resolveProvenance: tr('确认原作者', 'checking original creator'),
        createStorySnapshot: tr('创建故事快照', 'creating story snapshot'),
        createSharedStoryRecord: tr('创建分享记录', 'creating share record'),
        cacheSharedStory: tr('缓存分享故事', 'caching shared story'),
        cacheStoryLists: tr('更新本机列表缓存', 'updating local list cache'),
        deliverOriginalShare: tr('打开原作分享', 'opening original share'),
        deliverPreparedShare: tr('打开系统分享', 'opening system share'),
      } as Record<string, string>)[shareStage] || tr('准备分享', 'preparing share');
      showError(`${hasShareId ? tr('分享记录已创建，但', 'Share record was created, but ') : ''}${stageLabel}${tr('失败', ' failed')}: ${error?.name || error?.message || tr('未知错误', 'Unknown error')}`);
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
        showError(isActive ? tr('已取消点赞。', 'Like removed.') : tr('已点赞。', 'Liked.'));
      } else if (kind === 'favorite') {
        const isActive = wasActionActive;
        setStoryActionState('favorite', idToUse, !isActive);
        applyStoryActionFlag('favorite', idToUse, !isActive);
        applyStoryCountDelta(idToUse, 'favoriteCount', isActive ? -1 : 1);
        showError(isActive ? tr('已取消收藏。', 'Save removed.') : tr('已收藏。', 'Saved.'));
      } else if (kind === 'report') {
        showError(tr('不能举报系统教学卡带！', 'The tutorial cartridge cannot be reported.'));
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
          showError(tr('已取消点赞。', 'Like removed.'));
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
        showError(tr('已点赞。', 'Liked.'));
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
          showError(tr('已取消收藏。', 'Save removed.'));
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
        showError(alreadyFavorited ? tr('已在馆藏中。', 'Already in archive.') : tr('已收藏并加入馆藏。', 'Saved and added to archive.'));
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
        showError(alreadyFavorited || alreadyInArchive ? tr('已在馆藏中。', 'Already in archive.') : tr('已收藏并加入馆藏。', 'Saved and added to archive.'));
        return;
        }
        return;
      }
      await reportStory(db as any, idToUse, user.uid);
      showError(tr('已收到举报。', 'Report received.'));
      return;
    } catch (error) {
      if ((error as any)?.message === 'already-liked') {
        showError(tr('该作品已经点过赞。', 'This story has already been liked.'));
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
      showError(tr('操作失败，请稍后再试。', 'Action failed. Please try again later.'));
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
      showError(tr('保存失败', 'Save failed.'));
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
        showError(tr('已导入主线内容；支线内容请在「角色和支线」中继续确认。', 'Mainline imported. Please review branch content in “Characters and Branches”.'));
      }

      setAuthoringCartridge(nextCartridge);
      setAuthoringImportText('');
      setAuthoringTab('settings');
    } catch (e) {
      console.error(e);
      showError(tr('解析导入文本失败', 'Failed to parse imported text.'));
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
      showError(tr('页面状态已恢复，请重新打开故事记录。', 'Page state recovered. Please open the story record again.'));
      return;
    }
    if ((gameState === 'PLAYING' || gameState === 'SUMMARY') && !blueprint) {
      console.warn('Recovered invalid story runtime state without blueprint.');
      resetToHome();
      showError(tr('游玩状态已恢复，请重新进入故事。', 'Play state recovered. Please enter the story again.'));
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

  const renderGameplayModals = () => (
    <GameplayModals
      ctx={{
        confirmationModal,
        setConfirmationModal,
        tr,
        t,
        shareOriginalStoryByCard,
        myStories,
        resetToHome,
        branchUnlockNotice,
        setBranchUnlockNotice,
        interventionStatusNotice,
        setInterventionStatusNotice,
        activeStoryId,
        blueprint,
        handleShareStory,
        isSharing,
        endingDomainUserLabel,
        endingDomainToneClass,
        semanticIconButtonClass,
        storyConclusion,
        setShowSummaryModal,
        showSummaryModal,
        isSingleEndingStory,
        endingValue,
        endingDomainFromValue,
        historicallyUnlockedBranches,
        unlockedBranches,
        handleSaveWorkAndReturn,
        handleSaveProgressAndReturn,
        resetGame,
        interventionsLeft,
        setShowLeaveGameModal,
        showLeaveGameModal,
        startNewStoryPlay,
        inheritedEndingDisplayLabel,
        startSequelWithInheritedRecord,
        setPendingSequelInheritance,
        pendingSequelInheritance,
        startFreshFromPendingProgress,
        resumeStoryPlay,
        safeModalBackdropClass,
        setPendingProgressToLoad,
        pendingProgressToLoad,
        setAuthoringCartridge,
        setAuthoringStoryId,
        handleShareSavedAuthoringStory,
        formatBookTitle,
        setAuthoringSaveSuccessStory,
        authoringSaveSuccessStory,
      }}
    />
  );

  const renderArchiveView = () => (
    <ArchiveView
      archiveSearch={archiveSearch}
      setArchiveSearch={setArchiveSearch}
      archiveFilter={archiveFilter}
      setArchiveFilter={setArchiveFilter}
      archiveTab={archiveTab}
      setArchiveTab={setArchiveTab}
      archiveChoiceStoryId={archiveChoiceStoryId}
      setArchiveChoiceStoryId={setArchiveChoiceStoryId}
      archiveUpdatingIds={archiveUpdatingIds}
      archiveReturnTarget={archiveReturnTarget}
      mySharedStories={mySharedStories}
      followedAuthors={followedAuthors}
      followedAuthorsLoading={followedAuthorsLoading}
      storyListSyncState={storyListSyncState}
      isEnglish={isEnglish}
      isSharing={isSharing}
      t={t}
      formatBookTitle={formatBookTitle}
      getOriginalAuthorName={getOriginalAuthorName}
      getIntervenerName={getIntervenerName}
      shortUserId={shortUserId}
      AuthorNameButton={AuthorNameButton}
      onLeave={leaveArchiveView}
      onRefreshArchive={refreshArchiveStories}
      onRefreshFollowedAuthors={refreshFollowedAuthors}
      onStartStory={startStoryPlay}
      onOpenReadonlyStory={openReadonlyStory}
      onDeleteArchiveStory={handleDeleteArchiveStory}
      onShareArchiveStory={shareArchiveListStory}
      onArchiveVisibilityChange={handleArchiveVisibilityChange}
      onOpenAuthorProfile={openAuthorProfile}
      onUnfollowAuthor={async (authorId) => {
        if (!db || !user) return;
        try {
          setFollowedAuthors((prev) => prev.filter((author) => author.authorId !== authorId));
          await unfollowAuthor(db as any, authorId);
          if (authorProfileTarget?.authorId === authorId) setAuthorProfileFollowing(false);
          showError(tr('已取消追踪作者。', 'Author unfollowed.'));
        } catch (error: any) {
          console.error(error);
          showError(error?.message || tr('取消追踪失败。', 'Failed to unfollow author.'));
          void refreshFollowedAuthors();
        }
      }}
    />
  );
  const renderOnboardingPromptLayer = () => (
    <OnboardingPromptLayer
      ctx={{
        showOnboardingGuide,
        tr,
        dismissOnboardingGuide,
        startTutorialFromOnboarding,
        startQuickGenerationFromOnboarding,
        showPushPermissionPrompt,
        pushSubscribeBusy,
        dismissPushPermissionPrompt,
        enablePushNotificationsFromPrompt,
      }}
    />
  );

  const renderSeriesWorldView = () => (
    <SeriesWorldView
      seriesForm={seriesForm}
      seriesWorldBibleText={seriesWorldBibleText}
      parseEditableJson={parseEditableJson}
      asSafeArray={asSafeArray}
      tr={tr}
      normalizeSeriesPlotMaterial={normalizeSeriesPlotMaterial}
      setSeriesWorldBibleText={setSeriesWorldBibleText}
      seriesSourceStoryId={seriesSourceStoryId}
      gameState={gameState}
      goBack={goBack}
      navigateTo={navigateTo}
      loadSeriesWorlds={loadSeriesWorlds}
      renderInlineHelp={renderInlineHelp}
      seriesWorlds={seriesWorlds}
      resetSeriesWorldDraft={resetSeriesWorldDraft}
      selectedSeriesId={selectedSeriesId}
      setSelectedSeriesId={setSelectedSeriesId}
      setSeriesForm={setSeriesForm}
      setSeriesIronLawsText={setSeriesIronLawsText}
      setSeriesFutureDirectionsText={setSeriesFutureDirectionsText}
      loadContinuityNodesForSeries={loadContinuityNodesForSeries}
      myStories={myStories}
      getStoryTitle={getStoryTitle}
      setSeriesSourceStoryId={setSeriesSourceStoryId}
      handleGenerateSeriesWorld={handleGenerateSeriesWorld}
      seriesGenerating={seriesGenerating}
      handleDeleteSeriesWorld={handleDeleteSeriesWorld}
      seriesSaving={seriesSaving}
      handleSaveSeriesWorld={handleSaveSeriesWorld}
      createEmptySeriesCharacterCard={createEmptySeriesCharacterCard}
      normalizeTagList={normalizeTagList}
      createEmptySeriesPlotMaterial={createEmptySeriesPlotMaterial}
    />
  );
  const renderThemeSelectionView = () => (
    <ThemeSelectionView
      tr={tr}
      goBack={goBack}
      appLanguage={appLanguage}
      quickGenerationMode={quickGenerationMode}
      setQuickGenerationMode={setQuickGenerationMode}
      QUICK_QUIZ_STEPS={QUICK_QUIZ_STEPS}
      quickQuizStepIndex={quickQuizStepIndex}
      asSafeArray={asSafeArray}
      quickQuizAnswers={quickQuizAnswers}
      handleRandomQuickGeneration={handleRandomQuickGeneration}
      quickCharacterSeed={quickCharacterSeed}
      setQuickCharacterSeed={setQuickCharacterSeed}
      quickText={quickText}
      setQuickQuizStepIndex={setQuickQuizStepIndex}
      toggleQuickQuizAnswer={toggleQuickQuizAnswer}
      handleGenerateBlueprint={handleGenerateBlueprint}
      QUICK_STORY_TEMPLATES={QUICK_STORY_TEMPLATES}
      applyQuickStoryTemplate={applyQuickStoryTemplate}
      isEnglish={isEnglish}
      QUICK_STORY_TEMPLATE_EN={QUICK_STORY_TEMPLATE_EN}
      themeInputText={themeInputText}
      setThemeInputText={setThemeInputText}
      setSelectedThemes={setSelectedThemes}
      THEMES={THEMES}
      THEME_LABEL_EN={THEME_LABEL_EN}
      quickSeriesBindingId={quickSeriesBindingId}
      setQuickSeriesBindingId={setQuickSeriesBindingId}
      seriesWorlds={seriesWorlds}
      getSeriesBaselineRules={getSeriesBaselineRules}
      getSeriesCharacterCards={getSeriesCharacterCards}
      myStories={myStories}
      quickContinuitySourceStory={quickContinuitySourceStory}
      quickSeriesSelection={quickSeriesSelection}
      setQuickSeriesSelection={setQuickSeriesSelection}
      quickContinuityLoading={quickContinuityLoading}
      getStoryTitle={getStoryTitle}
      authoringEndingIdToLabel={authoringEndingIdToLabel}
      customOutline={customOutline}
      setCustomOutline={setCustomOutline}
      narrativePerson={narrativePerson}
      NARRATIVE_PERSON_OPTIONS={NARRATIVE_PERSON_OPTIONS}
      setNarrativePerson={setNarrativePerson}
      quickEndingMode={quickEndingMode}
      setQuickEndingMode={setQuickEndingMode}
      quickEndingBias={quickEndingBias}
      endingBiasAxisFromBias={endingBiasAxisFromBias}
      endingBiasFromAxis={endingBiasFromAxis}
      endingBiasAxisLabel={endingBiasAxisLabel}
      setQuickEndingBias={setQuickEndingBias}
      targetWordCount={targetWordCount}
      setTargetWordCount={setTargetWordCount}
      selectedThemes={selectedThemes}
      normalizeTagList={normalizeTagList}
    />
  );
  const accountCenterCtx = {
        accountCenterMode,
        user,
        myBio,
        mySharedStories,
        followedAuthors,
        myStories,
        appLanguage,
        appTheme,
        pushSubscribeBusy,
        isAdminUser,
        adminFeatureDraft,
        isSavingAdminSettings,
        APP_VERSION_LABEL,
        APP_BUILD_LABEL,
        GUEST_RETENTION_NOTICE,
        tr,
        t,
        getUserAuthorName,
        setIsAccountCenterOpen,
        goBack,
        setIsEditNameModalOpen,
        setIsEditBioModalOpen,
        setIsSecurityModalOpen,
        setArchiveTab,
        openArchiveView,
        enterAuthoring,
        setAppLanguage,
        setAppTheme,
        enablePushNotifications,
        setIsHelpDrawerOpen,
        handleLogout,
        startStoryPlay,
        setAdminFeatureDraft,
        handleSaveAdminSettings,
        isAccountCenterOpen,
        safeModalBackdropClass,
      };

  const accountCenterModal = <AccountCenterLayer ctx={accountCenterCtx} />;

  const renderAccountCenterView = () => <AccountCenterLayer ctx={accountCenterCtx} part="page" />;

  const renderInlineHelp = (key: string, title: string, content: React.ReactNode) => (
    <InlineHelpCard
      hidden={Boolean(dismissedHelpCards[key])}
      title={title}
      content={content}
      isEnglish={isEnglish}
      onDismiss={() => dismissHelpCard(key)}
    />
  );
  const renderHelpOverlayLayer = () => (
    <HelpOverlayLayer
      ctx={{
        authoringCartridge,
        tourStep,
        setTourStep,
        setAuthoringTab,
        showError,
        isHelpDrawerOpen,
        helpSearch,
        dismissedHelpCards,
        tr,
        setHelpSearch,
        setIsHelpDrawerOpen,
        restoreHelpCards,
        activeViewIntroKey,
        markViewIntroDone,
        onAuthoringTourDone,
      }}
    />
  );

  const renderReadonlyStoryView = () => (
    <ReadonlyStoryView
      story={readonlyStoryData}
      user={user}
      archiveUpdatingIds={archiveUpdatingIds}
      readonlyCanGoBack={readonlyCanGoBack}
      isEnglish={isEnglish}
      isSharing={isSharing}
      readingParagraphStyle={readingParagraphStyle}
      ReadingTextControls={ReadingTextControls}
      AuthorNameButton={AuthorNameButton}
      tr={tr}
      formatBookTitle={formatBookTitle}
      getOriginalAuthorName={getOriginalAuthorName}
      getIntervenerName={getIntervenerName}
      renderReadingParagraph={renderReadingParagraph}
      canAdaptReadonlyStory={canAdaptReadonlyStory}
      onBack={leaveReadonlyStory}
      onArchiveVisibilityChange={handleArchiveVisibilityChange}
      onShareExistingArchiveStory={shareExistingArchiveStory}
      onDeleteReadonlyArchiveStory={deleteReadonlyArchiveStory}
      onInterveneFromReadonly={handleInterveneFromReadonly}
      onAdaptFromReadonly={handleAdaptFromReadonly}
      onRequireSignInIntervene={() => {
        setReadonlyStoryData(null);
        window.history.replaceState({}, '', window.location.pathname);
        resetToHome();
        showError(tr('请先注册或登录，然后再干涉故事。', 'Please sign in before interfering with the story.'));
      }}
      onRequireSignInAdapt={() => {
        setReadonlyStoryData(null);
        window.history.replaceState({}, '', window.location.pathname);
        resetToHome();
        showError(tr('请先注册或登录，然后再改编故事。', 'Please sign in before adapting this story.'));
      }}
      onBrowseLibrary={() => {
        setReadonlyStoryData(null);
        window.history.replaceState({}, '', window.location.pathname);
        resetToHome();
      }}
    />
  );
  const storyInfoPanel = (
    <StoryInfoPanelLayer
      ctx={{
        isStoryInfoOpen,
        setIsStoryInfoOpen,
        tr,
        blueprint,
        endingBiasStoryCardLabels,
        isSingleEndingStory,
        characterStatuses,
        unlockedBranches,
        historicallyUnlockedBranches,
        authoringEndingIdToLabel,
        branchTierLabel,
        isEnglish,
        formatTriggerCondition,
        revealedThreadIds,
      }}
    />
  );

  const notificationUnreadCount = notificationItems.filter((item) => !item.readAt).length;

  const notificationBellButton = (size: 'sm' | 'md' = 'sm') => (
    <button
      type="button"
      onClick={() => void openNotificationCenter()}
      aria-label={tr('打开通知', 'Open notifications')}
      className={`relative inline-flex ${size === 'md' ? 'h-12 w-12' : 'h-11 w-11'} items-center justify-center rounded-2xl border border-app-border bg-app-bg/85 text-app-text transition-colors hover:border-indigo-400/60 hover:text-white backdrop-blur-md`}
    >
      <Bell className="h-5 w-5" />
      {notificationUnreadCount > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full border border-app-border bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg">
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
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-app-border bg-app-bg/80 text-app-text transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="flex items-center gap-2">
        {gameState === 'PLAYING' && (
          <button
            type="button"
            onClick={() => setIsStoryInfoOpen(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-app-border bg-app-bg/80 px-4 text-sm font-bold text-app-text transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
          >
            <BookOpen className="h-4 w-4" />
            {tr('故事信息', 'Story Info')}
          </button>
        )}
        <button
          type="button"
          onClick={openSystemSettings}
          aria-label={tr('打开系统设置', 'Open system settings')}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-app-border bg-app-bg/80 text-app-text transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <Settings className="h-5 w-5" />
        </button>
        {notificationBellButton('md')}
        <button
          type="button"
          onClick={() => setIsActionMenuOpen(true)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-app-border bg-app-bg/80 text-app-text transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
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
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-app-border bg-app-bg/85 text-app-text transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  ) : null;

  const primaryBottomDock = (
    <PrimaryBottomDock
      ctx={{
        user,
        gameState,
        isCreationDockOpen,
        setIsCreationDockOpen,
        navigateTo,
        openSeriesWorldCreateView,
        enterAuthoring,
        resetToHome,
        tr,
        openPersonalCenter,
      }}
    />
  );

  const floatingInterventionPanel = blueprint && gameState === 'PLAYING' && typeof document !== 'undefined'
    ? createPortal(
      <div className="destiny-dock play-destiny-dock rounded-full px-3 py-1.5 backdrop-blur-xl">
        <div className="flex min-h-9 items-center justify-between gap-2 px-1">
          <div className="shrink-0 text-xs font-black text-app-text sm:text-sm">
            {interventionsLeft}/3 {tr('干涉数', 'interventions')}
          </div>
          <div className="min-w-0 flex-1 text-center text-xs font-black sm:text-sm">
            {(() => {
              if (isSingleEndingStory(blueprint)) {
                return <span className="text-indigo-300/90">{tr('唯一走向', 'Fixed-ending path')}</span>;
              }
              if (storyConclusion || interventionsLeft <= 0) {
                const domain = endingDomainFromValue(endingValue);
                return <span className={domain === 'left' ? 'text-indigo-300/90' : domain === 'right' ? 'text-rose-300/90' : 'text-app-text'}>{endingDomainUserLabel(domain)}</span>;
              }
              const left = Math.round(uiFeedback.leftProgress || 0);
              const right = Math.round(uiFeedback.rightProgress || 0);
              if (left <= 0 && right <= 0) return <span className="text-app-muted">{tr('中域', 'Middle domain')}</span>;
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
                ? 'border border-app-border bg-app-surface/80 text-app-text hover:border-zinc-500'
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

  const interventionGateModal = (
    <AnimatePresence>
      {interventionGateChapter !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[3600] bg-black/80 backdrop-blur-md`}
          onClick={() => setInterventionGateChapter(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-indigo-400/25 p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {interventionGateStage === 'choose' ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr('命运的岔路', 'A fork in fate')}
                </div>
                <h3 className="mt-3 text-2xl font-black text-app-text">{tr('下一章即将展开', 'The next chapter awaits')}</h3>
                <p className="mt-2 text-sm leading-relaxed text-app-muted">
                  {tr('你还看不到下一章的走向。此刻要出手干涉，还是静观其变？', 'You cannot yet see where the next chapter leads. Interfere now, or watch it unfold?')}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-app-surface/60 px-4 py-1.5 text-xs font-black text-app-text">
                  {tr('剩余干涉', 'Interventions left')}
                  <span className="text-indigo-300">{interventionsLeft} / 3</span>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => { if (interventionGateChapter !== null) advanceChapter(interventionGateChapter); }}
                    className={semanticButtonClass('secondary', { fullWidth: true })}
                  >
                    <BookOpen className="h-4 w-4" />
                    {tr('观望，继续', 'Watch & continue')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterventionGateStage('select')}
                    className={semanticButtonClass('primary', { fullWidth: true })}
                  >
                    <Sparkles className="h-4 w-4" />
                    {tr('干涉', 'Interfere')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-app-text">{tr('选择干涉对象', 'Choose who to affect')}</h3>
                  <div className="rounded-full bg-app-surface/60 px-3 py-1 text-xs font-black text-app-text">{interventionsLeft} / 3</div>
                </div>
                <p className="mb-4 mt-1 text-left text-xs leading-relaxed text-app-muted">
                  {tr('选择本章登场的角色，决定施加庇佑或磨难。', 'Pick a character in this chapter, then bless or burden them.')}
                </p>
                {interventionGateChapter !== null && renderInterventionCharacterGrid(chapters.find((chapterItem) => Number(chapterItem.chapter_num) === interventionGateChapter))}
                <button
                  type="button"
                  onClick={() => setInterventionGateStage('choose')}
                  disabled={isRewriting}
                  className="mt-4 text-xs font-bold text-app-muted underline decoration-app-border underline-offset-4 transition-colors hover:text-app-text disabled:opacity-40"
                >
                  {tr('返回', 'Back')}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
          <div className="text-sm font-bold text-app-muted">
            <AuthorNameButton
              authorId={(activeStoryMeta || { authorId: user?.uid }).authorId}
              authorName={getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedThemes.map(tag => (
              <span key={tag} className="rounded-lg border border-app-border bg-app-surface/50 px-3 py-1 text-xs font-medium text-app-muted">
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
        {chapters
          .filter((chapter) => Number(chapter.chapter_num) <= unlockedChapterNum)
          .map((chapter, idx) => (
          <motion.section
            id={`chapter-${chapter.chapter_num}`}
            key={chapter.chapter_num || idx}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="reading-chapter group relative"
          >
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border/60 bg-app-bg/45 text-xs font-black text-app-muted transition-colors group-hover:border-indigo-500/40 group-hover:text-indigo-300">
                {chapter.chapter_num}
              </div>
              <h2 className="text-xl font-bold text-app-text">{chapter.title || (isEnglish ? `Chapter ${chapter.chapter_num}` : `第${chapter.chapter_num}章`)}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
            </div>
            
            <div className="relative leading-relaxed text-app-text">
              <div className="prose prose-invert max-w-none space-y-6">
                {isChapterTextReady(chapter) ? (
                  String(chapter.text || '').split('\n').filter(Boolean).map((p, pIdx) => (
                    <p key={pIdx} style={readingParagraphStyle} className={`leading-relaxed ${isEnglish ? '' : 'first-letter:text-3xl first-letter:font-black first-letter:mr-1'}`}>
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

                const isExpanded = activeInterventionChapter === chapter.chapter_num;
                const isAlreadyIntervened = intervenedChapters.includes(chapter.chapter_num);
                const isLatest = Number(chapter.chapter_num) === unlockedChapterNum;
                const isReady = isChapterTextReady(chapter);
                // Re-interference reaches back at most two chapters. Once the player moves on
                // past them, earlier chapters lock for this run.
                const withinReinterveneWindow = Number(chapter.chapter_num) >= unlockedChapterNum - 2;
                const canReintervene = canInterveneInChapter && withinReinterveneWindow;

                // Latest chapter still generating — no controls yet.
                if (isLatest && !isReady) return null;
                // Earlier read chapter outside the re-interfere window — render nothing.
                if (!isLatest && !canReintervene && !isExpanded) return null;

                return (
                  <div className="mt-10">
                    {/* Earlier, already-read chapter: re-interfere entry. Costs a turn and rewrites later chapters. */}
                    {!isLatest && canReintervene && !isExpanded && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => { setInterventionGateChapter(chapter.chapter_num); setInterventionGateStage('select'); }}
                          disabled={isRewriting || isGeneratingConclusion || activeInterventionOverlay !== null}
                          className={`${semanticButtonClass('secondary', { compact: true })} rounded-full px-5`}
                        >
                          <Sparkles className="h-4 w-4" />
                          {appLanguage === 'en-US' ? 'Interfere again' : '再次干涉'}
                        </button>
                      </div>
                    )}
                    {/* Latest chapter, not the finale: continue (a blind choice at intervenable chapters). */}
                    {isLatest && !isExpanded && chapter.chapter_num < 7 && (
                      <div className="flex justify-center">
                        {canInterveneInChapter && !isAlreadyIntervened ? (
                          <button
                            type="button"
                            onClick={() => setInterventionGateChapter(chapter.chapter_num)}
                            disabled={isRewriting || isGeneratingConclusion || activeInterventionOverlay !== null}
                            className={`${semanticButtonClass('primary', { compact: true })} rounded-full px-6`}
                          >
                            {tr('继续 →', 'Continue →')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => advanceChapter(chapter.chapter_num)}
                            disabled={isRewriting || isGeneratingConclusion}
                            className={`${semanticButtonClass('secondary', { compact: true })} rounded-full px-6`}
                          >
                            {tr('继续阅读 →', 'Continue →')}
                          </button>
                        )}
                      </div>
                    )}
                    {/* Finale (chapter 7): accept the fate, or spend a remaining turn to rewrite. */}
                    {isLatest && !isExpanded && chapter.chapter_num >= 7 && (
                      <div className="mt-2 rounded-[1.75rem] border border-amber-500/25 bg-amber-500/10 p-6 text-center">
                        {interventionsLeft > 0 ? (
                          <>
                            <div className="text-lg font-black text-app-text">{tr('故事已抵达终点', 'The story has reached its end')}</div>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-app-muted">
                              {tr(`你还有 ${interventionsLeft} 次干涉机会——可以回到尚可改写的篇章再搏一次，或就此让命运落定。`, `You still have ${interventionsLeft} intervention${interventionsLeft > 1 ? 's' : ''} left — return to a chapter you can still rewrite, or let fate settle as it stands.`)}
                            </p>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                              <button
                                type="button"
                                onClick={() => setConfirmationModal({
                                  isOpen: true,
                                  title: tr('让命运就此落定？', 'Let fate settle now?'),
                                  message: tr(`你还剩 ${interventionsLeft} 次干涉机会。选择「命运已定」会放弃这些机会、直接进行结算，且无法再回头改写。确定吗？`, `You still have ${interventionsLeft} intervention${interventionsLeft > 1 ? 's' : ''} left. Sealing fate gives them up and goes straight to the summary — you won't be able to rewrite anything afterward. Continue?`),
                                  onConfirm: () => handleGenerateSummary('manual'),
                                })}
                                disabled={isRewriting || isGeneratingConclusion}
                                className={`${semanticButtonClass('primary', { compact: true })} rounded-full px-6`}
                              >
                                <Sparkles className="h-4 w-4" />
                                {tr('命运已定', 'Seal this fate')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmationModal({
                                  isOpen: true,
                                  title: tr('重新生成一个新故事？', 'Generate a brand new story?'),
                                  message: tr('当前这条命运线将被舍弃，回到快速生成页重新设定主题，再生成一个全新的故事。', 'This fate line will be discarded — you return to the quick-generation page to set a theme and generate a brand new story.'),
                                  onConfirm: () => { setActiveStoryId(null); navigateTo('THEME_SELECTION'); },
                                })}
                                disabled={isRewriting || isGeneratingConclusion || activeInterventionOverlay !== null}
                                className={`${semanticButtonClass('secondary', { compact: true })} rounded-full px-6`}
                              >
                                <RefreshCcw className="h-4 w-4" />
                                {tr('重新生成', 'Generate new')}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-black text-app-text">{tr('命运已定', 'Fate is sealed')}</div>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-app-muted">
                              {tr('三次干涉皆已落定。下方便是这条命运线的结局。', 'All three interventions are spent. Below is how this fate line ends.')}
                            </p>
                            <div className="mt-5 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleGenerateSummary('manual')}
                                disabled={isGeneratingConclusion}
                                className={`${semanticButtonClass('secondary', { compact: true })} rounded-full px-6`}
                              >
                                <Sparkles className="h-4 w-4" />
                                {tr('重看命运结算', 'View the summary again')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

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
                          <div className="mt-6 flex w-full flex-col items-center gap-6 rounded-[1.75rem] border border-app-border/70 bg-app-bg/40 p-5 sm:p-6">
                            <div className="max-w-xl text-center">
                              <div className="mb-1 text-sm font-black text-app-text">{tr('因果节点已就绪', 'Causal node ready')}</div>
                              <div className="text-xs leading-relaxed text-app-muted">
                                {tr('选择本章登场的角色，决定施加庇佑或磨难。', 'Pick a character in this chapter, then bless or burden them.')}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveInterventionChapter(null)}
                                disabled={isRewriting}
                                className="mt-3 text-xs font-bold text-app-muted underline decoration-app-border underline-offset-4 transition-colors hover:text-app-text disabled:opacity-40"
                              >
                                {isLatest ? tr('返回（重新选择观望或干涉）', 'Back (choose watch or interfere)') : tr('取消', 'Cancel')}
                              </button>
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
                                  <div key={char.id} className="rounded-2xl border border-app-border bg-app-bg/60 p-4">
                                    <div className="mb-3">
                                      <div className="flex items-start justify-between">
                                        <div className="text-sm font-black text-app-text">{char.name}</div>
                                        {characterStatuses[char.id] && (
                                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {characterStatuses[char.id].status || tr('在场', 'Present')}
                                          </div>
                                        )}
                                      </div>
                                      {branchHints.length > 0 && (
                                        <div className="mt-2 space-y-1 text-xs leading-relaxed text-app-muted">
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

      {/* Ending is reached by reading through to the final chapter (chapter-by-chapter mode). */}
      {blueprint && (
        <div className="app-card-quiet mt-10 rounded-3xl p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-white">{formatBookTitle(blueprint.title)}</div>
              <div className="text-xs font-bold text-app-muted">
                <AuthorNameButton
                  authorId={(activeStoryMeta || { authorId: user?.uid }).authorId}
                  authorName={getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}
                />
              </div>
            </div>
            <div className="text-xs text-zinc-600">{tr('平均每章', 'Avg. per chapter')} {getAverageChapterWords(chapters) || tr('未知', 'unknown')} {tr('字', 'words')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => handleStoryInteraction('like')} className={`${semanticButtonClass(isCurrentStoryActive('like') ? 'secondary' : 'ghost', { compact: true })} ${isCurrentStoryActive('like') ? 'text-pink-200 app-button-liked' : ''}`}>
              <Heart className={`h-4 w-4 ${isCurrentStoryActive('like') ? 'fill-current' : ''}`} /> {tr('点赞', 'Like')}
            </button>
            <button type="button" onClick={() => handleStoryInteraction('favorite')} className={`${semanticButtonClass(isCurrentStoryActive('favorite') ? 'secondary' : 'ghost', { compact: true })} ${isCurrentStoryActive('favorite') ? 'text-amber-200 app-button-favorited' : ''}`}>
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
    <SummaryView
      ctx={{
        tr,
        isGeneratingConclusion,
        generationStatus,
        storyConclusion,
        handleShareStory,
        isSharing,
        resetGame,
      }}
    />
  );

  const AuthorNameButton = ({ authorId, authorName, prefix = '作者：' }: { authorId?: string | null; authorName?: string; prefix?: string }) => (
    <span className="inline-flex items-center gap-1">
      {prefix}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openAuthorProfile(authorId, authorName);
        }}
        className="font-black text-app-text underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-indigo-200 hover:decoration-indigo-300"
      >
        {authorName || (authorId ? `游客+${shortUserId(authorId)}` : '未知作者')}
      </button>
    </span>
  );

  const renderSocialOverlayLayer = () => (
    <SocialOverlayLayer
      ctx={{
        authorProfileTarget,
        authorProfileBio,
        authorProfileLoading,
        authorProfileStories,
        user,
        authorProfileFollowing,
        authorProfileBusy,
        isEnglish,
        tr,
        shortUserId,
        formatBookTitle,
        getStoryTitle,
        getStoryLikeCount,
        getStoryFavoriteCount,
        getStoryShareCount,
        getStoryInterventionCount,
        setAuthorProfileTarget,
        toggleAuthorFollow,
        startStoryPlay,
        notificationCenterOpen,
        notificationLoading,
        notificationItems,
        setNotificationCenterOpen,
        refreshNotificationCenter,
        markAllNotificationsRead,
        clearAllNotifications,
        deleteNotificationItem,
        shareComposer,
        shareComposerText,
        t,
        setShareComposerText,
        closeShareComposer,
        confirmShareComposer,
      }}
    />
  );

  const renderAuthoringView = () => (
    <AuthoringView
      ctx={{
        tr,
        t,
        isEnglish,
        renderInlineHelp,
        goBack,
        handleCreateAuthoringStory,
        authoringSaving,
        dismissAuthorPulseNotification,
        authorPulseNotifications,
        openSeriesWorldView,
        refreshStories,
        authoringListSearch,
        setAuthoringListSearch,
        authoringSeriesKindFilter,
        setAuthoringSeriesKindFilter,
        seriesWorlds,
        authoringSeriesWorldFilter,
        setAuthoringSeriesWorldFilter,
        authoringListVisibilityFilter,
        setAuthoringListVisibilityFilter,
        authoringCreatedFilter,
        setAuthoringCreatedFilter,
        authoringListSort,
        setAuthoringListSort,
        setAuthoringLoadingStoryId,
        selectAuthoringStory,
        authoringLoadingStoryId,
        formatShortDate,
        getStoryTitle,
        getStoryLikeCount,
        getStoryFavoriteCount,
        getStoryShareCount,
        getStoryInterventionCount,
        handleDeleteAuthoringStory,
        authoringCartridge,
        setAuthoringCartridge,
        authoringStoryId,
        setAuthoringStoryId,
        authoringDirty,
        authoringTab,
        setAuthoringTab,
        handleSaveAuthoringChanges,
        authoringFindReplaceOpen,
        setAuthoringFindReplaceOpen,
        authoringTocOpen,
        setAuthoringTocOpen,
        authoringFindCompact,
        setAuthoringFindCompact,
        getAuthoringFindMatches,
        authoringFindMatchIndex,
        moveAuthoringFindMatch,
        replaceCurrentAuthoringMatch,
        authoringFindQuery,
        setAuthoringFindQuery,
        authoringReplaceQuery,
        setAuthoringReplaceQuery,
        authoringFindScope,
        setAuthoringFindScope,
        authoringFindChapterNums,
        setAuthoringFindChapterNums,
        authoringFindEndingIds,
        setAuthoringFindEndingIds,
        handleAuthoringReplaceAll,
        stripBookTitle,
        authoringCustomTagsInput,
        setAuthoringCustomTagsInput,
        parseTagInput,
        authoringCoverPrompt,
        setAuthoringCoverPrompt,
        handleAuthoringCoverPaste,
        handleAuthoringCoverClipboardRead,
        handleAuthoringCoverUpload,
        applyAuthoringCover,
        isGeneratingCover,
        handleGenerateAuthoringCover,
        canUseCoverGeneration,
        endingBiasAxisFromBias,
        endingBiasFromAxis,
        endingBiasAxisLabel,
        handleAuthoringImport,
        authoringImportText,
        setAuthoringImportText,
        authoringImportReplaceBranches,
        setAuthoringImportReplaceBranches,
        showError,
        getSeriesBaselineRules,
        getSeriesCharacterCards,
        authoringContinuitySourceStory,
        authoringContinuityLoading,
        normalizeTagList,
        asSafeArray,
        loadContinuityNodesForSeries,
        authoringEndingIdToLabel,
        endingDomainFromId,
        endingDomainCards,
        expandedBranchId,
        setExpandedBranchId,
        branchForm,
        setBranchForm,
        branchConditions,
        setBranchConditions,
        myStories,
        getVisibilityLabel,
        formatBookTitle,
        getStoryCreatedMs,
        getStoryUpdatedMs,
        setConfirmationModal,
        setAuthoringDirty,
        openCompactFindMode,
        loadSeriesWorlds,
        formatStoryHeading,
        endingDomainTitle,
        createEndingIdForDomain,
        setSelectedBranchId,
        normalizeBranchTier,
        db,
        chapterOptions,
        normalizeCharacters,
        triggerPreview,
        normalizeBranchConditionsForStorage,
        branchTierLabel,
        formatTriggerCondition,
        setIsActionMenuOpen,
        handleStoryInteraction,
        user,
        isCurrentStoryActive,
        isSharing,
        endingDomainUserLabel,
        endingDomainToneClass,
        semanticIconButtonClass,
        setShowSummaryModal,
        showSummaryModal,
        endingDomainFromValue,
        handleSaveWorkAndReturn,
        handleSaveProgressAndReturn,
        resetGame,
        setShowLeaveGameModal,
        showLeaveGameModal,
        startNewStoryPlay,
        inheritedEndingDisplayLabel,
        startSequelWithInheritedRecord,
        setPendingSequelInheritance,
        pendingSequelInheritance,
        startFreshFromPendingProgress,
        resumeStoryPlay,
        safeModalBackdropClass,
        setPendingProgressToLoad,
        pendingProgressToLoad,
        handleShareSavedAuthoringStory,
        setAuthoringSaveSuccessStory,
        authoringSaveSuccessStory,
        handleShareStory,
      }}
    />
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
            className="app-modal-surface app-modal-safe-height grid w-full max-w-md gap-4 overflow-y-auto rounded-3xl border border-app-border p-5 shadow-2xl sm:p-8"
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
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-app-muted">{tr('阅读与资料', 'Reading & Info')}</div>
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
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-app-muted">{tr('作品互动', 'Story Actions')}</div>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('like'); }} className={`${semanticMenuButtonClass('ghost')} ${isCurrentStoryActive('like') ? 'bg-app-surface/60 text-pink-300 app-button-liked' : ''}`}>
                      <Heart className={`h-5 w-5 ${isCurrentStoryActive('like') ? 'fill-current text-pink-300' : ''}`} /> {tr('点赞', 'Like')}
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('favorite'); }} className={`${semanticMenuButtonClass('ghost')} ${isCurrentStoryActive('favorite') ? 'bg-app-surface/60 text-amber-300 app-button-favorited' : ''}`}>
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
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-app-muted">{tr('创作与重开', 'Create & Restart')}</div>
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
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-app-muted">{tr('离开', 'Leave')}</div>
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

  const storyLibraryCtx = {
        tr,
        t,
        isEnglish,
        db,
        appLanguage,
        publicStories,
        myStories,
        storyLibraryTab,
        setStoryLibraryTab,
        storyLibrarySearch,
        setStoryLibrarySearch,
        storyLibraryVisibilityFilter,
        setStoryLibraryVisibilityFilter,
        storyLibrarySort,
        setStoryLibrarySort,
        isLoadingStories,
        storyListLoadError,
        refreshStories,
        storyMatchesLanguage,
        formatBookTitle,
        stripBookTitle,
        getStoryCoverUrl,
        getStoryTags,
        getStoryTitle,
        getStoryAuthorName,
        getStoryMainAxis,
        getSequelRequirementFromMeta,
        hasStoryCardAction,
        getStoryLikeCount,
        getStoryFavoriteCount,
        getStoryShareCount,
        getStoryInterventionCount,
        getStoryUnlockedBranchCount,
        getStoryBranchCount,
        getStoryUnlockedEndingCount,
        getStoryEndingCount,
        getStoryAverageChapterWords,
        getStoryUpdatedMs,
        isSingleEndingStory,
        endingBiasStoryCardLabels,
        AuthorNameButton,
        setStoryDetailStory,
        startStoryPlay,
        handleStoryInteraction,
        shareStoryCardWithFeedback,
        storyDetailStory,
        setIsSharing,
        setGlobalLoadingMessage,
        setGlobalLoadingDetail,
        shareOriginalStoryByCard,
        showError,
        isSharing,
        endingDomainUserLabel,
        endingDomainToneClass,
        semanticIconButtonClass,
        setShowSummaryModal,
        showSummaryModal,
        endingDomainFromValue,
        handleSaveWorkAndReturn,
        handleSaveProgressAndReturn,
        resetGame,
        setShowLeaveGameModal,
        showLeaveGameModal,
        startNewStoryPlay,
        inheritedEndingDisplayLabel,
        startSequelWithInheritedRecord,
        setPendingSequelInheritance,
        pendingSequelInheritance,
        startFreshFromPendingProgress,
        resumeStoryPlay,
        safeModalBackdropClass,
        setPendingProgressToLoad,
        pendingProgressToLoad,
        handleShareSavedAuthoringStory,
        setAuthoringSaveSuccessStory,
        authoringSaveSuccessStory,
        isAdminUser,
        setConfirmationModal,
        setPublicStories,
        setMyStories,
        setMySharedStories,
        sequelGateModal,
        setSequelGateModal,
        findStoryListItemById,
      };

  const renderStoryDetailModal = () => <StoryLibraryView ctx={storyLibraryCtx} part="detail" />;

  const renderSequelGateModal = () => <StoryLibraryView ctx={storyLibraryCtx} part="sequel" />;

  const renderStorySelectView = () => <StoryLibraryView ctx={storyLibraryCtx} />;

  const renderAuthView = () => (
    <Suspense fallback={<StartupShell message={tr('正在准备账号入口...', 'Loading account entry...')} title={t('app.name')} subtitle={t('startup.default')} tagline={tr('可分享 · 可改写的互动故事引擎', 'Shareable · Rewritable interactive story engine')} />}>
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
    <ScrollToTopButton
      show={showScrollTopButton}
      isPlaying={gameState === 'PLAYING'}
      label={tr('返回顶部', 'Back to top')}
    />
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
              <div className="px-2 pb-1 pt-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{tr('快速浏览', 'Quick Nav')}</div>
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
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-app-muted transition-colors hover:bg-app-surface-soft hover:text-white"
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${ready ? 'bg-indigo-500/15 text-indigo-300' : 'bg-app-surface-soft text-app-muted'}`}>
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
            className="app-modal-surface app-modal-safe-height w-full max-w-sm overflow-y-auto rounded-3xl border border-app-border p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-app-muted">{tr('下载 App', 'Install App')}</div>
                <h2 className="mt-1 text-xl font-black text-white">{tr('添加到手机桌面', 'Add to home screen')}</h2>
              </div>
              <button type="button" onClick={() => setShowIosInstallModal(false)} className={semanticIconButtonClass('ghost')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-app-muted">
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
    <div data-theme={appTheme} className="min-h-screen bg-app-bg text-app-text selection:bg-indigo-500/30 selection:text-indigo-200">
      <DevMetricsPanel />
      <GlobalError errorMsg={errorMsg} />
      {installGuideModal}
      <ConnectivityDrawer
        state={connectivityDrawerState}
        isEnglish={isEnglish}
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
        <StartupShell message={startupMessage} title={t('app.name')} subtitle={t('startup.default')} tagline={tr('可分享 · 可改写的互动故事引擎', 'Shareable · Rewritable interactive story engine')} />
      ) : gameState === 'READONLY_STORY' && readonlyStoryData ? (
        <>
          <Suspense fallback={null}>{renderReadonlyStoryView()}</Suspense>
          {renderScrollToTopButton()}
          {accountEntryButton}
          {renderSocialOverlayLayer()}
          {accountCenterModal}
        </>
      ) : !user ? (
        renderAuthView()
      ) : isRecoveringInvalidGameState ? (
        <StartupShell message={tr('正在恢复页面状态...', 'Restoring page state...')} title={t('app.name')} subtitle={t('startup.default')} tagline={tr('可分享 · 可改写的互动故事引擎', 'Shareable · Rewritable interactive story engine')} />
      ) : (
        <>
          {gameState === 'STORY_SELECT' && renderStorySelectView()}
          {gameState === 'ACCOUNT_CENTER' && renderAccountCenterView()}
          {gameState === 'ARCHIVE' && <Suspense fallback={null}>{renderArchiveView()}</Suspense>}
          {(gameState === 'SERIES_WORLD_LIST' || gameState === 'SERIES_WORLD_GENERATE' || gameState === 'SERIES_WORLD_EDIT') && <Suspense fallback={null}>{renderSeriesWorldView()}</Suspense>}
          {gameState === 'THEME_SELECTION' && <Suspense fallback={null}>{renderThemeSelectionView()}</Suspense>}
          {gameState === 'GENERATING_BLUEPRINT' && (
            <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-app-bg px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
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
          {gameState === 'PLAYING' && interventionGateModal}
          <AnimatePresence>
            {threadRevealNotice && threadRevealNotice.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${safeModalBackdropClass} z-[3400] bg-black/80 backdrop-blur-md`}
                onClick={() => setThreadRevealNotice(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.97 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-amber-500/30 p-6 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    {threadRevealNotice.length > 1 ? tr(`揭露了 ${threadRevealNotice.length} 条知因`, `${threadRevealNotice.length} threads surface`) : tr('揭露知因', 'A thread surfaces')}
                  </div>
                  <div className="space-y-5">
                    {threadRevealNotice.map((thread, index) => (
                      <div key={index}>
                        <h3 className="text-xl font-black text-app-text">{thread.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-app-muted">{thread.content}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setThreadRevealNotice(null)}
                    className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
                  >
                    {tr('知道了', 'Got it')}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {gameState === 'SUMMARY' && <Suspense fallback={null}>{renderSummaryView()}</Suspense>}
          {gameState === 'AUTHORING' && <Suspense fallback={null}>{renderAuthoringView()}</Suspense>}
          {gameState === 'READONLY_STORY' && <Suspense fallback={null}>{renderReadonlyStoryView()}</Suspense>}

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
          {renderSocialOverlayLayer()}
          {accountCenterModal}
          <AccountProfileModals
            tr={tr}
            isEditNameModalOpen={isEditNameModalOpen}
            setIsEditNameModalOpen={setIsEditNameModalOpen}
            profileDisplayName={profileDisplayName}
            setProfileDisplayName={setProfileDisplayName}
            onSaveName={handleUpdateProfileDisplayName}
            isEditBioModalOpen={isEditBioModalOpen}
            setIsEditBioModalOpen={setIsEditBioModalOpen}
            editingBio={editingBio}
            setEditingBio={setEditingBio}
            onSaveBio={handleUpdateBio}
            isSecurityModalOpen={isSecurityModalOpen}
            setIsSecurityModalOpen={setIsSecurityModalOpen}
            profileCurrentPassword={profileCurrentPassword}
            setProfileCurrentPassword={setProfileCurrentPassword}
            profileNewPassword={profileNewPassword}
            setProfileNewPassword={setProfileNewPassword}
            onUpdatePassword={handleUpdateAccountPassword}
            onPasswordReset={() => handlePasswordResetForEmail(user?.email || '')}
          />
          {renderOnboardingPromptLayer()}
          {renderGameplayModals()}
          {renderHelpOverlayLayer()}
          
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
                subtext={activeInterventionOverlay.type === 'ending'
                  ? (isEnglish ? 'Weaving the finale — this usually takes 15-30 seconds.' : '正在收束终局，通常需要 15-30 秒，请稍候。')
                  : (isEnglish ? 'Rewriting the chapter and its ripples — this usually takes 15-30 seconds.' : '正在重塑章节与涟漪，通常需要 15-30 秒，请稍候。')}
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
