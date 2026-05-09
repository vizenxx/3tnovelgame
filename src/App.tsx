import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft, Heart, Bookmark, Flag, Settings, PenSquare, Archive, ExternalLink, ArrowUp, Download, Sun, Moon, Search } from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { createEmptyStory, createSharedStoryRecord, createStorySnapshot, adaptBlueprintToStory, createStoryBranch, deleteSharedStoryRecord, deleteStoryBranch, deleteStoryCartridge, favoriteStory, unfavoriteStory, getAppSettings, getSharedStoryRecord, getStoryCartridge, getStoryMeta, getUserProgress, incrementStoryMetric, likeStory, listMySharedStories, listMyStories, listPublicStories, refundCoverGenerationUsage, reportStory, reserveCoverGenerationUsage, saveAppSettings, saveStoryMainlineBundle, saveStoryMeta, saveUserProgress, updateAuthorNameEverywhere, updateSharedStoryVisibility, upsertStoryBranch } from './storyStore';
import { branchEffectiveWeight, isBranchUnlockedByHistory, normalizeEndingBias } from './storyCartridge';
import { deleteLocalCache, getLocalCache, setLocalCache } from './localCache';
import { useAppNavigation } from './navigation/useAppNavigation';
import { evaluateStoryRunAfterIntervention } from './storyRunEngine';
import { createIdleStoryListSyncState, updateStoryListSegmentState, type StoryListSegment, type SyncStatus } from './storySyncTypes';
import { StartupShell } from './components/StartupShell';
import { BackNavButton } from './components/BackNavButton';
import { AuthView } from './components/AuthView';
import { semanticButtonClass, semanticIconButtonClass, semanticMenuButtonClass } from './components/semanticClasses';
import { areStoryChaptersEquivalent, hashStoryChapters } from './storyContentHash';
import { getFriendlyServerError } from './friendlyErrors';
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
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---
type GameState = 'STORY_SELECT' | 'AUTHORING' | 'THEME_SELECTION' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY' | 'READONLY_STORY' | 'ARCHIVE';
type NarrativePerson = 'first' | 'second' | 'third';
type EndingMode = 'single' | 'dual';
type AppTheme = 'dark' | 'light';
type StoryLibrarySort = 'updated' | 'likes' | 'interventions' | 'favorites' | 'words';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";
const PUBLIC_STORY_LIST_LIMIT = 100;
const MY_STORY_LIST_LIMIT = 80;
const ARCHIVE_STORY_LIST_LIMIT = 80;

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
  score: number; // This will be the weight: 1, 2, 3, or 5
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

const NARRATIVE_PERSON_OPTIONS: Array<{ value: NarrativePerson; label: string; hint: string }> = [
  { value: 'third', label: '第三人称', hint: '以他/她/他们叙述，适合群像与史诗感。' },
  { value: 'first', label: '第一人称', hint: '以我/我们叙述，更贴近主角内心。' },
  { value: 'second', label: '第二人称', hint: '以你叙述，适合沉浸式命运体验。' },
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
const parseTagInput = (value: string) => normalizeTagList(String(value || '').split('，'));
const formatStoryHeading = (chapter: Pick<Chapter, 'chapter_num' | 'title'>) => {
  const title = String(chapter.title || '').trim();
  return title ? `第${chapter.chapter_num}章：${title}` : `第${chapter.chapter_num}章`;
};
const endingIdToLabel = (id: 'default' | 'left' | 'right' | string) => {
  if (id === 'left') return '左向默认结局';
  if (id === 'right') return '右向默认结局';
  return '默认结局';
};

const authoringEndingIdToLabel = (id: 'default' | 'left' | 'right' | string) => {
  if (id === 'default') return '默认结局';
  if (id === 'left') return '左向默认结局';
  if (id === 'right') return '右向默认结局';
  if (id.startsWith('left-')) return '左向具体结局';
  if (id.startsWith('right-')) return '右向具体结局';
  if (id.startsWith('middle-')) return '默认线具体结局';
  return `具体结局 ${id}`;
};

const endingDomainFromId = (id: string): 'middle' | 'left' | 'right' => {
  if (id === 'left' || id.startsWith('left-')) return 'left';
  if (id === 'right' || id.startsWith('right-')) return 'right';
  return 'middle';
};

const endingDomainTitle = (domain: 'middle' | 'left' | 'right') => {
  if (domain === 'left') return '左向结局';
  if (domain === 'right') return '右向结局';
  return '默认收束';
};

const createEndingIdForDomain = (domain: 'middle' | 'left' | 'right') =>
  `${domain}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const buildSharedStoryUrl = (storyId: string) =>
  `${window.location.origin}/api/share?share=${encodeURIComponent(storyId)}`;

const buildOriginalStoryUrl = (storyId: string) =>
  `${window.location.origin}/api/share?story=${encodeURIComponent(storyId)}`;

const buildAppSharedStoryUrl = (storyId: string) =>
  `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(storyId)}`;

const buildAppOriginalStoryUrl = (storyId: string) =>
  `${window.location.origin}${window.location.pathname}?story=${encodeURIComponent(storyId)}`;

const ADMIN_USER_IDS = new Set(['LWgIE31RtCTZBiMNF7S9viNE7Aw2']);
type AppFeatureSettings = {
  coverGenerationEnabled: boolean;
};
const DEFAULT_FEATURE_SETTINGS: AppFeatureSettings = {
  coverGenerationEnabled: false,
};
const GUEST_ACCOUNT_RETENTION_DAYS = 180;
const STORY_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const GUEST_RETENTION_NOTICE =
  '游客账号如果连续 180 天没有登录或打开 app 保持活跃，可能会被系统自动清理。注册成正式账号后，当前作品和记录会继续保留。';

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
    return true;
  } catch {
    return false;
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderCharacterHighlights = (text: string, keyPrefix: string, characters: Character[] = []) => {
  if (characters.length > 0) {
    const names = characters.map(c => c.name).filter(Boolean);
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
  const parts = String(text || '').split(/(<mark>.*?<\/mark>)/g);
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
        className="fixed left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-[6100] w-[min(92vw,28rem)] -translate-x-1/2 rounded-[1.5rem] border border-zinc-700/70 bg-zinc-950/92 px-5 py-4 text-center text-sm font-bold leading-relaxed text-zinc-100 shadow-2xl shadow-black/40 backdrop-blur-xl"
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
          className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 space-y-5 shadow-2xl"
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
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const LoadingOverlay = ({ progress, status, subtext, variant = 'default' }: { progress: number, status: string, subtext?: string, variant?: 'default' | 'bless' | 'curse' | 'ending' }) => (
  <div className={`fixed inset-0 z-[6000] backdrop-blur-xl flex flex-col items-center justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center transition-colors duration-700 ${
    variant === 'bless' ? 'bg-emerald-950/90' : 
    variant === 'curse' ? 'bg-rose-950/90' : 
    variant === 'ending' ? 'bg-amber-950/90' :
    'bg-zinc-950/90'
  }`}>
    <motion.div 
      animate={{ rotate: variant === 'ending' ? 180 : -360, scale: [1, 1.1, 1] }}
      transition={{ rotate: { repeat: Infinity, duration: variant === 'ending' ? 8 : 3, ease: 'linear' }, scale: { repeat: Infinity, duration: 2 } }}
      className="mb-8 relative"
    >
      {variant === 'bless' ? (
        <Zap className="w-20 h-20 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
      ) : variant === 'curse' ? (
        <Skull className="w-20 h-20 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
      ) : variant === 'ending' ? (
        <Sparkles className="w-20 h-20 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
      ) : (
        <RefreshCcw className="w-16 h-16 text-indigo-500" />
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
    {subtext && <p className="text-zinc-400 text-sm mb-8 max-w-md italic">{subtext}</p>}
    
    <div className="w-full max-w-md bg-zinc-900 h-3 rounded-full overflow-hidden mb-4 border border-zinc-800 shadow-inner">
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
      <span>{variant === 'default' ? '正在编织因果' : variant === 'ending' ? '终局演绎中' : '因果链条重塑中'}</span>
      <span>{Math.round(progress)}%</span>
    </div>
  </div>
);

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
    className={`${safeModalBackdropClass} ${zIndexClass} bg-zinc-950/60 backdrop-blur-sm`}
  >
    <motion.div
      initial={{ y: 14, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 10, opacity: 0, scale: 0.98 }}
      className="w-full max-w-sm rounded-[1.75rem] border border-indigo-500/25 bg-zinc-950/90 p-5 text-center shadow-2xl shadow-black/40"
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

const countChars = (text: string) => text?.trim()?.length || 0;

function summaryEndingCategoryLabel(args: {
  endingMode: 'dual' | 'single' | undefined;
  endingNames: { left?: string; right?: string } | undefined;
  endingLabel: string;
}) {
  const mode = args.endingMode ?? 'dual';
  if (mode === 'single') return '默认结局';
  const left = String(args.endingNames?.left || '左').trim().slice(0, 5) || '左';
  const right = String(args.endingNames?.right || '右').trim().slice(0, 5) || '右';
  if (args.endingLabel === '秩序律') return `${left}结局`;
  if (args.endingLabel === '混沌终') return `${right}结局`;
  return '默认结局';
}

const getEndingBias = (source?: any) => normalizeEndingBias(source?.endingBias || source?.endingRates || {
  left: source?.left_mainline_default,
  right: source?.right_mainline_default,
});

const endingBiasPresets = [
  { value: 1, label: '很弱' },
  { value: 3, label: '轻微' },
  { value: 5, label: '普通' },
  { value: 9, label: '明显' },
  { value: 13, label: '强烈' },
] as const;

const nearestEndingBiasPreset = (value: number) =>
  endingBiasPresets.reduce((closest, preset) =>
    Math.abs(preset.value - value) < Math.abs(closest.value - value) ? preset : closest
  , endingBiasPresets[0]).value;

const endingDomainCards = (source?: any) => {
  const names = source?.endingNames || {};
  return [
    {
      id: 'middle',
      title: '默认收束',
      label: '默认结局',
      hint: '命运没有明显偏向左右时，会回到作品的默认收束；作者也可以为默认线设置不同的具体结局。',
    },
    {
      id: 'left',
      title: `${names.left || '左向'}结局`,
      label: '左向默认结局',
      hint: '命运明显偏向左侧时进入。左向支线可绑定到不同具体结局。',
    },
    {
      id: 'right',
      title: `${names.right || '右向'}结局`,
      label: '右向默认结局',
      hint: '命运明显偏向右侧时进入。右向支线可绑定到不同具体结局。',
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

const buildStoryShareText = (title?: string, chapters?: Array<{ text?: string }>) => {
  const safeTitle = stripBookTitle(title || '未命名故事');
  const excerpt = (chapters || [])
    .map((chapter) => String(chapter?.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .find((text) => text.length > 40);
  return excerpt
    ? `《${safeTitle}》\n${excerpt.slice(0, 120)}${excerpt.length > 120 ? '...' : ''}\n\n有人改写了命运，而这一页，留下了它偏离原轨的瞬间。`
    : `《${safeTitle}》\n故事已经开场，命运还没有落笔。来看看它会把你带向哪里。`;
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
const getStoryUpdatedMs = (story: any) => {
  const value = story?.updatedAt?.toDate?.() || story?.updatedAt || story?.createdAt?.toDate?.() || story?.createdAt;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
};

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
  .replace(/<\s*\/?\s*mark\s*>/gi, '')
  .replace(/```(?:json|html|xml|markdown|md)?/gi, '')
  .replace(/<\/?(?:span|strong|em|b|i)>/gi, '')
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

type ConditionForm = {
  kind: 'single' | 'count';
  singleChapterNum: number;
  singleCharId: string;
  singleAction: 'bless' | 'curse';
  countCharId: string;
  countAction: 'bless' | 'curse';
  minCount: number;
  upToChapterNum: number;
};

type ParsedImportCondition = {
  type: 'single' | 'count';
  single?: { chapterNum: number; charName: string; action: 'bless' | 'curse' };
  count?: { upToChapterNum: number; charName: string; action: 'bless' | 'curse'; minCount: number };
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

  const defaultEnding = extractSection(mainline, /###\s*默认结局[^\n]*\n/i, /###\s*(左结局|右结局)/i).trim();
  const leftEnding = extractSection(mainline, /###\s*左结局[^\n]*\n/i, /###\s*右结局/i).trim();
  const rightEnding = extractSection(mainline, /###\s*右结局[^\n]*\n/i).trim();

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
      conditions: (conditions.length > 0 ? conditions : [fallbackCondition]).slice(0, 3),
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [startupMessage, setStartupMessage] = useState('正在连接时空枢纽...');
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
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState<string | null>(null);
  const [themeInputText, setThemeInputText] = useState('');
  useEffect(() => {
    if (selectedThemes.length > 0 && !themeInputText) {
      setThemeInputText(selectedThemes.join('，'));
    }
  }, [selectedThemes, themeInputText]);
  const [customOutline, setCustomOutline] = useState<string>('');
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
  const [uiFeedback, setUiFeedback] = useState<{leftProgress: number, rightProgress: number, endingLabel: string}>({leftProgress: 0, rightProgress: 0, endingLabel: "均衡道"});
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
  const [quickEndingBias, setQuickEndingBias] = useState({ leftBaseWeight: 1, rightBaseWeight: 1 });
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
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [isAccountCenterOpen, setIsAccountCenterOpen] = useState(false);
  const [showLeaveGameModal, setShowLeaveGameModal] = useState(false);
  const [pendingProgressToLoad, setPendingProgressToLoad] = useState<{ id: string, data: any } | null>(null);


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
  const [archiveTab, setArchiveTab] = useState<'favorite' | 'saved'>('favorite');
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [readonlyReturnTarget, setReadonlyReturnTarget] = useState<GameState>('STORY_SELECT');
  const [archiveReturnTarget, setArchiveReturnTarget] = useState<GameState>('STORY_SELECT');
  const [storyLibraryTab, setStoryLibraryTab] = useState<'mine' | 'public'>('public');
  const [storyLibrarySearch, setStoryLibrarySearch] = useState('');
  const [storyLibraryVisibilityFilter, setStoryLibraryVisibilityFilter] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
  const [storyLibrarySort, setStoryLibrarySort] = useState<StoryLibrarySort>('updated');
  const [storyDetailStory, setStoryDetailStory] = useState<any | null>(null);
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
  const [authoringTab, setAuthoringTab] = useState<'settings' | 'mainline' | 'branches'>('settings');
  const [authoringTocOpen, setAuthoringTocOpen] = useState(false);
  const [authoringFindReplaceOpen, setAuthoringFindReplaceOpen] = useState(false);
  const [authoringFindQuery, setAuthoringFindQuery] = useState('');
  const [authoringReplaceQuery, setAuthoringReplaceQuery] = useState('');
  const [authoringFindScope, setAuthoringFindScope] = useState({ chapters: true, endings: true, characters: true });
  const [authoringFindChapterNums, setAuthoringFindChapterNums] = useState<number[]>([]);
  const [authoringFindEndingIds, setAuthoringFindEndingIds] = useState<string[]>([]);
  const [authoringFindCompact, setAuthoringFindCompact] = useState(false);
  const [authoringFindMatchIndex, setAuthoringFindMatchIndex] = useState(0);

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
  const fetchingChapterRef = useRef<number | null>(null);
  const [backgroundGeneratingChapter, setBackgroundGeneratingChapter] = useState<number | null>(null);

  // World State system
  const [canonicalWorldState, setCanonicalWorldState] = useState<any>(null);
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
    isSharing ||
    isGeneratingCover
  );
  const globalBlockingLoadingMessage = globalLoadingMessage ||
    (authoringSaving
      ? '正在保存...'
      : isSharing
      ? '正在生成分享链接...'
      : isGeneratingCover
      ? '正在绘制封面...'
      : '正在处理...');
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

  const currentRunContentHash = () => hashStoryChapters(chapters);

  const currentRunMatchesOriginal = () => (
    Boolean(activeStoryId) &&
    initialNaturalChapters.length > 0 &&
    areStoryChaptersEquivalent(chapters, initialNaturalChapters)
  );

  const cacheSharedSnapshotAfterCreate = (shareId: string, sharedRecord: any) => {
    void cacheSharedStory(shareId, { meta: { ...sharedRecord, sharedStoryId: shareId }, chapters: chapters as any })
      .catch((error) => console.warn('share cacheSharedStory failed:', error));
    void cacheStoryLists(publicStories, myStories, [sharedRecord, ...mySharedStories.filter((story: any) => story.id !== shareId)])
      .catch((error) => console.warn('share cacheStoryLists failed:', error));
  };

  const createCurrentStorySnapshot = async (visibility: 'private' | 'unlisted', snapshotKind: 'intervened' | 'saved_run') => {
    if (!user || !blueprint) throw new Error('请先进入故事后再继续。');
    const provenance = await resolveActiveStoryProvenance();
    const contentHash = currentRunContentHash();
    const shareId = await createStorySnapshot(db as any, {
      authorId: user.uid,
      authorName: getUserAuthorName(user),
      title: blueprint.title || '未命名故事',
      main_axis: blueprint.main_axis || '',
      tags: selectedThemes,
      characters: blueprint.characters || [],
      chapters: chapters as any,
      averageChapterWords: getAverageChapterWords(chapters),
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
      chapters,
      authorId: user.uid,
      authorName: getUserAuthorName(user),
      originalAuthorId: provenance.originalAuthorId,
      originalAuthorName: provenance.originalAuthorName,
      intervenerId: user.uid,
      intervenerName: getUserAuthorName(user),
      coverUrl: activeStoryMeta?.coverUrl || '',
      sourceStoryId: activeStoryId,
      averageChapterWords: getAverageChapterWords(chapters),
      chapterCount: getReadyChapterCount(chapters),
      cardExcerpt: getStoryCardExcerpt(blueprint.main_axis || '', chapters),
      allowAdaptation: getActiveStoryAllowAdaptation(),
      visibility,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMySharedStories((prev) => [sharedRecord, ...prev.filter((story: any) => story.id !== shareId)]);
    return { shareId, sharedRecord };
  };

  const sharePayload = async (payload: ShareData) => {
    await deliverPreparedShare(payload);
  };

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
      shareText = `《${stripBookTitle(shareTitle)}》\n${String(mainAxis).slice(0, 120)}${mainAxis.length > 120 ? '...' : ''}\n\n故事已经开场，命运还没有落笔。来看看它会把你带向哪里。`;
    } else {
      shareText = buildStoryShareText(shareTitle, []);
    }
    await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(storyId) });
  };

  const handleShareSavedAuthoringStory = async () => {
    const storyId = authoringSaveSuccessStory?.storyId || authoringStoryId;
    if (!storyId || !authoringSaveSuccessStory) return;
    try {
      setIsSharing(true);
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
      await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(storyId) });
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享作品失败。');
    } finally {
      setIsSharing(false);
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
    if (!db || !user) return;
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
    const messages = [
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
          }
        : {
            type: 'count' as const,
            count: {
              charId: condition.countCharId || '',
              action: condition.countAction,
              minCount: Math.max(1, condition.minCount),
              upToChapterNum: Math.max(2, Math.min(6, condition.upToChapterNum)),
            },
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
      setGlobalLoadingMessage('正在保存进度...');
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
      setGlobalLoadingMessage('正在保存至馆藏...');
      const sourceChapters = naturalChapters.length > 0 ? naturalChapters : chapters;
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
      showError("保存作品失败");
    } finally {
      setGlobalLoadingMessage(null);
      setAuthoringSaving(false);
    }
  };

  const buildWorldStateForPrompt = (upToChapter: number, currentEndingValue: number) => {
    const canonical = canonicalWorldState;
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
  const quickGenerationSignature = () => JSON.stringify({
    selectedThemes,
    customOutline: customOutline.trim(),
    targetWordCount,
    narrativePerson,
    quickEndingMode,
    quickEndingBias,
  });

  const applyStoryListCache = (data: any) => {
    setPublicStories(Array.isArray(data?.pub) ? data.pub : []);
    setMyStories(Array.isArray(data?.mine) ? data.mine : []);
    setMySharedStories(Array.isArray(data?.shared) ? data.shared : []);
  };

  const cacheStoryLists = async (pub: any[], mine: any[], shared: any[], publicSort: StoryLibrarySort = storyLibrarySort) => {
    await setLocalCache(storyListCacheKey(), { pub, mine, shared, publicSort });
  };

  const getStoryListCache = async () => getLocalCache<{ pub: any[]; mine: any[]; shared: any[]; publicSort?: StoryLibrarySort }>(storyListCacheKey());

  const getCachedStoryCartridge = async (storyId: string, expectedStory?: any) => {
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
    canonicalWorldState,
    deltaWorldStateByChapter,
    currentChapters: chapters,
    changeHighlights,
    uiFeedback,
    savedLocallyAt: Date.now(),
  });

  const applyLocalRunSnapshot = async (snapshot: any) => {
    if (!snapshot?.blueprint) return false;
    navigateTo(snapshot.gameState === 'SUMMARY' ? 'PLAYING' : snapshot.gameState || 'PLAYING', { reset: true });
    setSelectedThemes(snapshot.selectedThemes || []);
    setBlueprint(snapshot.blueprint);
    setChapters(snapshot.currentChapters || []);
    setChangeHighlights(snapshot.changeHighlights || {});
    setInterventionsLeft(snapshot.interventionsLeft ?? 3);
    setEndingValue(snapshot.endingValue || 0);
    setUnlockedBranches(snapshot.unlockedBranches || []);
    setHistoricallyUnlockedBranches(snapshot.historicallyUnlockedBranches || []);
    setIntervenedChapters(snapshot.intervenedChapters || []);
    setNaturalChapters(snapshot.naturalChapters || []);
    setInitialNaturalChapters(snapshot.initialNaturalChapters || []);
    setCharacterStatuses(snapshot.characterStatuses || {});
    setStoryConclusion(snapshot.storyConclusion || null);
    setActiveStoryId(snapshot.storyId || null);
    setActiveStoryMeta(snapshot.activeStoryMeta || null);
    setInterventionHistory(snapshot.interventionHistory || []);
    setCanonicalWorldState(snapshot.canonicalWorldState || null);
    setDeltaWorldStateByChapter(snapshot.deltaWorldStateByChapter || {});
    if (snapshot.uiFeedback) setUiFeedback(snapshot.uiFeedback);
    if (snapshot.storyId && snapshot.cartridge) {
      await cacheStoryCartridge(snapshot.storyId, snapshot.cartridge);
    }
    setSessionId(user?.uid || null);
    return true;
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
        withTimeout(listPublicStories(db as any, PUBLIC_STORY_LIST_LIMIT, requestedPublicSort), 8500, '公开作品同步超时。'),
        withTimeout(listMyStories(db as any, user.uid, MY_STORY_LIST_LIMIT), 8500, '我的作品同步超时。'),
      ]);
      const pub = publicResult.status === 'fulfilled'
        ? publicResult.value
        : (cached?.value?.pub || publicStories);
      const mine = mineResult.status === 'fulfilled'
        ? mineResult.value
        : (cached?.value?.mine || myStories);
      if (publicResult.status === 'rejected') markStoryListSegment('public', 'error', String(publicResult.reason?.message || publicResult.reason || '公开作品同步失败'));
      else markStoryListSegment('public', 'idle');
      if (mineResult.status === 'rejected') markStoryListSegment('mine', 'error', String(mineResult.reason?.message || mineResult.reason || '我的作品同步失败'));
      else markStoryListSegment('mine', 'idle');

      let shared = cached?.value?.shared || mySharedStories;
      if (options.includeArchive) {
        markStoryListSegment('archive', 'syncing');
        try {
          shared = await withTimeout(listMySharedStories(db as any, user.uid, ARCHIVE_STORY_LIST_LIMIT), 12000, '连接收藏馆超时，稍后进入收藏馆时会继续同步。');
          markStoryListSegment('archive', 'idle');
        } catch (archiveError: any) {
          markStoryListSegment('archive', 'error', String(archiveError?.message || archiveError || '收藏馆同步失败'));
        }
      }
      setPublicStories(pub);
      setMyStories(mine);
      setMySharedStories(shared);
      await cacheStoryLists(pub, mine, shared, requestedPublicSort);
      const segmentErrors = [publicResult, mineResult].filter((result) => result.status === 'rejected');
      if (segmentErrors.length === 2 && !cached?.value) {
        const message = '作品库同步失败，请稍后重试。';
        setStoryListLoadError(message);
        showError(message);
        return false;
      }
      setStoryListLoadError(segmentErrors.length ? '部分作品列表同步失败，已保留可用内容。' : null);
      if (segmentErrors.length) showError('部分作品列表同步失败，已保留可用内容。');
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
        setMySharedStories(cached.value.shared);
        if (!options.force && Date.now() - cached.updatedAt < STORY_LIST_CACHE_TTL_MS) {
          markStoryListSegment('archive', 'stale');
          return;
        }
      }
      markStoryListSegment('archive', 'syncing');
      const shared = await withTimeout(
        listMySharedStories(db as any, user.uid, ARCHIVE_STORY_LIST_LIMIT),
        14000,
        '连接收藏馆超时，已先显示本机缓存。'
      );
      setMySharedStories(shared);
      await cacheStoryLists(publicStories, myStories, shared);
      markStoryListSegment('archive', 'idle');
    } catch (error: any) {
      console.error(error);
      const cached = await getStoryListCache();
      if (cached?.value?.shared) setMySharedStories(cached.value.shared);
      const message = getFriendlyServerError(error, '收藏馆同步失败，已先显示本机缓存。');
      markStoryListSegment('archive', 'error', message);
      showError(message);
    } finally {
      setIsLoadingStories(false);
    }
  };

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
      const cached = await getCachedSharedStory(storyId);
      if (cached?.value) {
        setReadonlyStoryData({ meta: cached.value.meta, chapters: cached.value.chapters as any });
        setReadonlyCanGoBack(Boolean(options?.allowBack));
        setReadonlyReturnTarget(options?.returnTarget || 'STORY_SELECT');
        navigateTo('READONLY_STORY', { reset: !options?.allowBack });
      }
      const record = await getSharedStoryRecord(db as any, storyId, user?.uid);
      if (!record) {
        showError('未找到这份故事记录，或你没有访问权限。');
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
        endingBias: { leftBaseWeight: 1, rightBaseWeight: 1 },
      };
      const resetArtstyleChapters = toDefaultArtstyleChapters(readonlyStoryData.chapters);
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        blueprint,
        chapters: resetArtstyleChapters,
        tags: readonlyStoryData.meta.tags || [],
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      navigateTo('AUTHORING');
      showError('已完成一键改编，已带你进入作者编辑界面。');
      setReadonlyStoryData(null);
      setReadonlyCanGoBack(false);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error(error);
      showError('一键改编失败，请稍后再试。');
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
      message: `这只会删除你馆藏里的《${stripBookTitle(story.title || '未命名故事')}》记录，不会删除原作者的作品，也不会影响其他人已拥有的分享链接记录。此操作无法撤销。`,
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
      if (archiveId && story.meta?.visibility !== 'unlisted') {
        await handleArchiveVisibilityChange({ id: archiveId }, 'unlisted');
      }
      const shareUrl = archiveId ? buildSharedStoryUrl(archiveId) : buildOriginalStoryUrl(sourceStoryId);
      const shareTitle = formatBookTitle(story.meta?.title || '未命名故事');
      const shareText = buildStoryShareText(shareTitle, story.chapters);
      await sharePayload({ title: shareTitle, text: shareText, url: shareUrl });
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享失败。');
    } finally {
      setIsSharing(false);
    }
  };

  const deleteReadonlyArchiveStory = () => {
    const story = readonlyStoryData;
    const archiveId = story?.meta?.sharedStoryId;
    if (!db || !user || !story || !archiveId || story.meta?.authorId !== user.uid) return;
    setConfirmationModal({
      isOpen: true,
      title: '删除馆藏记录？',
      message: `这会删除你馆藏里的《${stripBookTitle(story.meta?.title || '未命名故事')}》记录。原作者作品不会被删除，但这条记录的分享链接将无法继续访问。此操作无法撤销。`,
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
    setArchiveChoiceStoryId(null);
    markStoryListSegment('archive', 'loading');
    navigateTo('ARCHIVE');
    void refreshArchiveStories({ force: true });
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
      setStartupMessage(u ? '正在同步命运记录...' : '正在准备入口...');
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
      showError('你已经在 App 模式中使用。');
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
  };

  const openSystemShare = async (payload: ShareData) => {
    if (!navigator.share) {
      await copySharePayload(payload);
      return;
    }
    await navigator.share(payload);
    showError('已打开系统分享。');
  };

  const deliverPreparedShare = async (payload: ShareData) => {
    if (!navigator.share) {
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      showError(copied ? '已复制分享内容到剪贴板。' : '分享链接已准备好，请手动复制浏览器地址。');
      return;
    }
    try {
      await openSystemShare(payload);
      if (isIosDevice()) {
        void writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      const copied = await writeClipboardText(buildShareClipboardText(String(payload.text || ''), String(payload.url || '')));
      if (copied) {
        showError('系统分享未能打开，但分享内容已复制，可直接粘贴发送。');
        return;
      }
      throw error;
    }
  };

  const shareArchiveListStory = async (story: any) => {
    if (!story) return;
    try {
      setIsSharing(true);
      if (story.archiveKind !== 'favorite' && story.visibility !== 'unlisted') {
        await handleArchiveVisibilityChange(story, 'unlisted');
      }
      const storyId = story.archiveKind === 'favorite' ? (story.sourceStoryId || story.id) : story.id;
      const shareUrl = story.archiveKind === 'favorite' ? buildOriginalStoryUrl(storyId) : buildSharedStoryUrl(storyId);
      const shareTitle = formatBookTitle(story.title || '未命名故事');
      const shareText = buildStoryShareText(shareTitle, story.chapters || []);
      await sharePayload({ title: shareTitle, text: shareText, url: shareUrl });
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError(error?.message || '分享失败。');
    } finally {
      setIsSharing(false);
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
    setStartupMessage('正在同步命运记录...');

    let cancelled = false;
    const loadSessionOnce = async () => {
      const cachedRun = await getLocalCache<any>(activeRunCacheKey());
      if (cancelled) return;
      if (cachedRun?.value?.gameState === 'PLAYING') {
        await applyLocalRunSnapshot(cachedRun.value);
      } else {
        setSessionId(user.uid);
        resetToHome();
        setStartupMessage('正在读取作品档案...');
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
    canonicalWorldState,
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
      setGlobalLoadingMessage('正在保存进度...');
      await saveUserProgress(db as any, user.uid, activeStoryId, {
        userId: user.uid,
        storyId: activeStoryId,
        gameState: 'PLAYING',
        interventionsLeft,
        endingValue,
        unlockedBranches,
        intervenedChapters,
        naturalChapters,
        initialNaturalChapters,
        characterStatuses,
        storyConclusion,
        interventionHistory,
        canonicalWorldState,
        deltaWorldStateByChapter,
        currentChapters: chapters,
      });
      await resetGame();
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
      setShowLeaveGameModal(false);
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  const handleSaveWorkAndReturn = async () => {
    if (!user || !blueprint) return;
    try {
      setGlobalLoadingMessage('正在保存至馆藏...');
      if (activeStoryId && currentRunMatchesOriginal()) {
        await favoriteStory(db as any, activeStoryId, user.uid);
        showError('原作已加入馆藏，不会重复保存一份相同文本。');
      } else {
        const { shareId, sharedRecord } = await createCurrentStorySnapshot('unlisted', 'saved_run');
        cacheSharedSnapshotAfterCreate(shareId, sharedRecord);
        showError('当前故事已保存至个人馆藏（非公开链接）。');
      }
      await resetGame();
      return;
      showError("作品已保存至个人馆藏（非公开链接）");
    } catch (e) {
      console.error(e);
      showError("保存作品失败");
      setShowLeaveGameModal(false);
    } finally {
      setGlobalLoadingMessage(null);
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
    if (!user || !db || !blueprint) return;
    if (!canAdaptCurrentStory()) {
      showError('原作者尚未开放这篇作品的一键改编权限。');
      return;
    }
    try {
      setIsLoadingStories(true);
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        blueprint,
        chapters: toDefaultArtstyleChapters(chapters),
        tags: normalizeTagList((blueprint.tags && blueprint.tags.length > 0 ? blueprint.tags : selectedThemes) || []),
      });
      await refreshStories({ force: true });
      await selectAuthoringStory(storyId);
      navigateTo('AUTHORING');
      showError('已完成一键改编，已带你进入作者编辑界面。');
    } catch (error) {
      console.error(error);
      showError('一键改编失败，请稍后再试。');
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
      returnToStoryLibraryFallback();
      showError('发生错误，已带你回到作品库。');
    };
    window.addEventListener('error', handleFatalError as EventListener);
    window.addEventListener('unhandledrejection', handleFatalError as EventListener);
    return () => {
      window.removeEventListener('error', handleFatalError as EventListener);
      window.removeEventListener('unhandledrejection', handleFatalError as EventListener);
    };
  }, []);

  const resetGame = async () => {
    if (!user || !db) return;
    try {
      setShowLeaveGameModal(false);
      const shouldRestoreStorySelectScroll = gameState === 'PLAYING';
      resetToHome();
      setSelectedThemes([]);
      setBlueprint(null);
      setChapters([]);
      setChangeHighlights({});
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setIntervenedChapters([]);
      setNaturalChapters([]);
      setInitialNaturalChapters([]);
      setCharacterStatuses({});
      setStoryConclusion(null);
      setActiveStoryId(null);
      setActiveStoryMeta(null);
      setInterventionHistory([]);
      setCanonicalWorldState(null);
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
      setGlobalLoadingMessage('正在重新加载故事...');
      setShowLeaveGameModal(false);
      await deleteLocalCache(activeRunCacheKey());
      // Re-load the cartridge and apply with no progress data (fresh start)
      let cartridge = await getCachedStoryCartridge(storyId);
      if (!cartridge) {
        cartridge = await getStoryCartridge(db as any, storyId);
      }
      if (!cartridge) {
        showError('重新加载故事失败，已返回作品库。');
        await resetGame();
        return;
      }
      applyStoryCartridgeForPlay(storyId, cartridge); // no progressData = fresh start
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showError('命运已重置，从第一章重新开始。');
    } catch (e) {
      console.error(e);
      showError('重新干涉失败');
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
      { type: 'good', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.title || '左向默认结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.text || '') },
      { type: 'bad', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.title || '右向默认结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.text || '') },
    ],
    tags: cartridge.meta.tags || [],
    branches: (cartridge.branches || []).map((branch: any) => {
      const condition = branch.trigger?.type === 'single'
        ? branch.trigger.single
        : { chapterNum: 2, charId: cartridge.meta.characters?.[0]?.id || 'c1', action: 'bless' as const };
      return {
        id: branch.id,
        name: branch.name,
        score: branchEffectiveWeight(branch),
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
    setUnlockedBranches(progressData?.unlockedBranches || []);
    setHistoricallyUnlockedBranches(progressData?.historicallyUnlockedBranches || progressData?.unlockedBranches || []);
    setIntervenedChapters(progressData?.intervenedChapters || []);
    setNaturalChapters(progressData?.naturalChapters || nextBlueprint.chapters);
    setInitialNaturalChapters(progressData?.initialNaturalChapters || nextBlueprint.chapters);
    setCharacterStatuses(progressData?.characterStatuses || initialStatuses);
    setStoryConclusion(progressData?.storyConclusion || null);
    setInterventionHistory(progressData?.interventionHistory || []);
    setCanonicalWorldState(progressData?.canonicalWorldState || null);
    setDeltaWorldStateByChapter(progressData?.deltaWorldStateByChapter || {});
    setUiFeedback(progressData?.uiFeedback || { leftProgress: 0, rightProgress: 0, endingLabel: '均衡道' });
    navigateTo('PLAYING');
  };

  const startStoryPlay = async (storyId: string) => {
    if (!user || !db) return;
    const launchProgress = startStoryLaunchProgress();
    try {
      if (gameState === 'STORY_SELECT') {
        storySelectScrollYRef.current = window.scrollY;
      }
      setIsLoadingStories(true);
      const expectedStory = [...publicStories, ...myStories].find((story: any) => story.id === storyId);
      let cartridge = await getCachedStoryCartridge(storyId, expectedStory);
      if (!cartridge) {
        try {
          cartridge = await getStoryCartridge(db as any, storyId);
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
      
      const progressData = await getUserProgress(db as any, user.uid, storyId);
      
      const canResumeProgress =
        progressData &&
        Number(progressData.interventionsLeft ?? 0) > 0 &&
        !progressData.storyConclusion;

      if (canResumeProgress) {
        setPendingProgressToLoad({ id: storyId, data: { ...progressData, cartridge } });
        return;
      }
      
      await startNewStoryPlay(storyId, cartridge);
    } catch (e) {
      console.error(e);
      showError("无法开启故事");
    } finally {
      window.clearInterval(launchProgress);
      setStoryLaunchOverlay((prev) => prev ? { progress: 100, status: '故事已就绪' } : prev);
      window.setTimeout(() => setStoryLaunchOverlay(null), 180);
      setIsLoadingStories(false);
    }
  };

  const startNewStoryPlay = async (storyId: string, loadedCartridge?: any) => {
    if (!user || !db) return;
    try {
      const cartridge = loadedCartridge || await getCachedStoryCartridge(storyId) || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      await cacheStoryCartridge(storyId, cartridge);
      applyStoryCartridgeForPlay(storyId, cartridge);
    } catch (e) {
      console.error(e);
      showError("初始化故事失败");
    }
  };

  const resumeStoryPlay = async (storyId: string, progressData: any) => {
    if (!user || !db) return;
    try {
      const cartridge = progressData.cartridge || await getCachedStoryCartridge(storyId) || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      await cacheStoryCartridge(storyId, cartridge);
      applyStoryCartridgeForPlay(storyId, cartridge, progressData);
      setPendingProgressToLoad(null);
    } catch (e) {
      console.error(e);
      showError("恢复故事进度失败");
    }
  };

  const handleGenerateBlueprint = async () => {
    if (!user || !db) return;
    if (selectedThemes.length < 1 && !customOutline.trim()) {
      showError('请至少选择一个主题或输入故事大纲。');
      return;
    }
    if (selectedThemes.length > 4) {
      showError('最多选择 4 个主题。');
      return;
    }

    navigateTo('GENERATING_BLUEPRINT');
    const progressInterval = startProgressSimulation(45000, [
      "正在构思宏大世界观...",
      "正在编织命运的丝线...",
      "正在塑造传奇英雄...",
      "正在铺设史诗篇章...",
      "正在雕琢文学细节...",
      "正在注入灵魂与情感...",
      "即将开启新的征程..."
    ]);

    try {
      const draftSignature = quickGenerationSignature();
      const cachedDraft = await getLocalCache<any>(quickGenerationDraftCacheKey());
      let data = cachedDraft?.value?.signature === draftSignature && cachedDraft.value?.blueprint
        ? cachedDraft.value.blueprint
        : null;
      if (!data) {
      const response = await apiFetch('/api/generate-blueprint', {
        method: 'POST',
        body: JSON.stringify({ selectedThemes, customOutline, targetWordCount, narrativePerson, endingMode: quickEndingMode, endingBias: quickEndingBias }),
      }, 90000);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      data = await response.json();
      }
      data.narrative_person = narrativePerson;
      data.endingMode = data.endingMode === 'single' ? 'single' : quickEndingMode;
      data.endingBias = normalizeEndingBias(data.endingBias || quickEndingBias || { left: data.left_mainline_default, right: data.right_mainline_default });
      data.chapters = ensureSevenChapterShells(data.chapters || []);
      await setLocalCache(quickGenerationDraftCacheKey(), { signature: draftSignature, blueprint: data });

      const prefetchChapters = [1, 2, 3];
      for (const chapterNum of prefetchChapters) {
        if (isChapterTextReady((data.chapters || []).find((chapter: any) => chapter.chapter_num === chapterNum))) {
          continue;
        }
        setGenerationStatus(`正在具象化世界细节 (${chapterNum}/3)...`);
        setGenerationProgress(72 + chapterNum * 7);
        const chapterResponse = await withRetry(() => apiFetch('/api/generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint: data,
            currentChapters: data.chapters,
            targetChapterNum: chapterNum,
            targetWordCount,
            narrativePerson,
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
      await deleteLocalCache(quickGenerationDraftCacheKey());
      navigateTo('PLAYING', { replace: true });
    } catch (error) {
      console.error(error);
      showError(error instanceof Error && error.message ? error.message : '生成失败，请检查网络或稍后重试。');
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
      interventionsLeft < 3 ||
      isRewriting ||
      activeInterventionOverlay ||
      !user ||
      !db
    ) {
      return;
    }

    const missingChapter = chapters
      .filter((chapter) => Number(chapter.chapter_num) > 3)
      .sort((a, b) => Number(a.chapter_num) - Number(b.chapter_num))
      .find((chapter) => !isChapterTextReady(chapter));

    if (!missingChapter) {
      setBackgroundGeneratingChapter(null);
      return;
    }
    if (fetchingChapterRef.current === missingChapter.chapter_num) return;

    fetchingChapterRef.current = missingChapter.chapter_num;
    setBackgroundGeneratingChapter(missingChapter.chapter_num);

    const generateRemainingChapter = async () => {
      try {
        const chapterResponse = await withRetry(() => apiFetch('/api/generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint,
            currentChapters: chapters,
            targetChapterNum: missingChapter.chapter_num,
            targetWordCount,
            narrativePerson: blueprint.narrative_person || narrativePerson,
          }),
        }, 90000), 3, 2500);
        if (!chapterResponse.ok) throw new Error(await readErrorMessage(chapterResponse));
        const chapterData = await chapterResponse.json();
        if (!chapterData?.text || typeof chapterData.text !== 'string' || chapterData.text.trim().length < 50) {
          throw new Error('Invalid generated chapter text');
        }

        setChapters((prev) => {
          if (interventionsLeft < 3) return prev;
          const nextChapters = ensureSevenChapterShells(prev).map((chapter) => (
            chapter.chapter_num === missingChapter.chapter_num
              ? {
                  ...chapter,
                  title: chapterData.title || chapter.title,
                  summary: chapterData.summary || chapter.summary,
                  present_characters: Array.isArray(chapterData.present_characters) ? chapterData.present_characters : chapter.present_characters,
                  text: stripGeneratedMarkup(chapterData.text),
                }
              : chapter
          ));
          setNaturalChapters(nextChapters as any);
          setInitialNaturalChapters(nextChapters.map((chapter: any) => ({
            ...chapter,
            present_characters: Array.isArray(chapter.present_characters) ? [...chapter.present_characters] : [],
          })) as any);
          setLocalCache(quickGenerationDraftCacheKey(), {
            signature: quickGenerationSignature(),
            blueprint: { ...blueprint, chapters: nextChapters },
          }).catch(() => {});
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
  }, [gameState, blueprint, chapters, interventionsLeft, isRewriting, activeInterventionOverlay, user, db, targetWordCount, narrativePerson]);

  const enterAuthoring = async () => {
    navigateTo('AUTHORING');
    setAuthoringStoryId(null);
    setAuthoringCartridge(null);
    setAuthoringTab('settings');
    await refreshStories();
  };

  const selectAuthoringStory = async (storyId: string) => {
    if (!db) return;
    const cartridge = await getStoryCartridge(db as any, storyId);
    if (!cartridge) {
      showError('无法载入该作品。');
      return;
    }
    setAuthoringStoryId(storyId);
    setAuthoringCartridge(cartridge);
    setAuthoringCustomTagsInput((cartridge.meta?.tags || []).join('，'));
    setAuthoringImportText('');
    setSelectedBranchId(null);
    setExpandedBranchId(null);
    setAuthoringTab('settings');
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
      await upsertStoryBranch(db as any, authoringStoryId, selectedBranchId, {
        id: selectedBranchId,
        side: branchForm.side,
        tier: normalizeBranchTier(branchForm.tier),
        is_hidden: branchForm.isHidden,
        endingId: branchForm.endingId || undefined,
        name: branchForm.name || '未命名支线',
        hint: branchForm.hint || `留意${branchForm.name || '支线变化'}`,
        desc: branchForm.sceneText.slice(0, 80) || branchForm.name || '支线',
        common: false,
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
    }
  };

  const handleSaveAuthoringMainline = async () => {
    if (!authoringStoryId || !authoringCartridge || !db) return;
    try {
      setAuthoringSaving(true);
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
          .filter((ending: any) => authoringCartridge.meta?.endingMode === 'single' ? ending.id === 'default' : true)
          .map((ending: any) => ({
            id: ending.id,
            title: ending.title || endingIdToLabel(ending.id),
            text: ending.text || '',
          })),
      });
      const latest = await getStoryCartridge(db as any, authoringStoryId);
      // In single-ending mode, the server only has the default ending.
      // Merge back any locally-cached non-default endings so the author
      // can still see them if they switch back to multi-ending mode before leaving.
      if (authoringCartridge.meta?.endingMode === 'single') {
        const cachedOtherEndings = (authoringCartridge.endings || []).filter((e: any) => e.id !== 'default');
        if (cachedOtherEndings.length > 0 && latest) {
          latest.endings = [...(latest.endings || []), ...cachedOtherEndings];
        }
      }
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
      const response = await apiFetch('/api/generate-cover', {
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
    const runDecision = evaluateStoryRunAfterIntervention({
      branches: (blueprint.branches || []) as any,
      history: interventionHistory,
      previousUnlockedBranches: unlockedBranches as any,
      previousHistoricalBranches: historicallyUnlockedBranches as any,
      intervention: { chapterNum, charId, action },
      previousIntervenedChapters: intervenedChapters,
      currentEndingValue: endingValue,
      endingBias: blueprint?.endingBias || { left: blueprint?.left_mainline_default, right: blueprint?.right_mainline_default },
      endingMode: blueprint?.endingMode === 'single' ? 'single' : 'dual',
    });
    const willRewriteEarlierThanPastIntervention = runDecision.shouldWarnAboutRewriteRisk;
    if (willRewriteEarlierThanPastIntervention && !confirmedEarlierRewrite) {
      const affectedChapters = Array.from(new Set(interventionHistory.filter((item) => item.chapterNum > chapterNum).map((item) => Number(item.chapterNum)))).sort((a, b) => Number(a) - Number(b));
      setConfirmationModal({
        isOpen: true,
        title: '确认回溯干涉？',
        message: `你正在从第 ${chapterNum} 章重新干涉命运，这会重写第 ${chapterNum} 章到第 7 章。此前在第 ${affectedChapters.join('、')} 章造成的剧情变化，以及由这些较晚章节单次触发的当前支线，可能会被取消；但“曾解锁”记录和用于累计触发支线的干涉计数会保留，已消耗的干涉次数不会返还。`,
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
      simulation = startProgressSimulation(12000, [
        `正在观测 ${charName} 的命运线...`,
        `正在编织 ${action === 'bless' ? '庇佑' : '磨难'} 的因果...`,
        `正在重塑第 ${chapterNum} 章及后续情节...`,
        `命运之轮已经转动...`
      ]);

      const response = await apiFetch('/api/intervene', {
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
        const mergedChapters = (chapters || []).map((chapter) => rewrittenByNum.get(chapter.chapter_num) || chapter);
        rewrittenByNum.forEach((chapter, chapterNum) => {
          if (!previousByNum.has(chapterNum)) {
            mergedChapters.push(chapter);
          }
        });
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
      const nextHistoricalBranches = Array.from(historicalBranchById.values());
      setHistoricallyUnlockedBranches(nextHistoricalBranches);
      if (result?.uiFeedback) {
        setUiFeedback(result.uiFeedback);
      }
      
      if (result.worldState) {
        setCanonicalWorldState(result.worldState.canonical);
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

  const setStoryActionState = (kind: 'like' | 'favorite', storyId: string, active: boolean) => {
    const setter = kind === 'like' ? setOptimisticLikedStoryIds : setOptimisticFavoritedStoryIds;
    setter((prev) => {
      const next = new Set(prev);
      if (active) next.add(storyId);
      else next.delete(storyId);
      return next;
    });
  };

  const hasOptimisticStoryAction = (kind: 'like' | 'favorite', storyId?: string | null) => {
    if (!storyId) return false;
    return kind === 'like' ? optimisticLikedStoryIds.has(storyId) : optimisticFavoritedStoryIds.has(storyId);
  };

  const applyStoryCountDelta = (storyId: string, field: 'likeCount' | 'favoriteCount', delta: number) => {
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
      
      simulation = startProgressSimulation(8000, [
        "正在收束因果残片...",
        "正在推演时空最终走向...",
        "正在铭刻命运总结..."
      ]);

      const response = await apiFetch('/api/generate-summary', {
        method: 'POST',
        body: JSON.stringify({
          blueprint,
          endingValue,
          chapters,
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
      setStoryConclusion(result.text || result.conclusion || '');
      setShowSummaryModal(true);
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
      const shareTitle = formatBookTitle(blueprint?.title || "未命名故事");
      const shareText = buildStoryShareText(shareTitle, chapters);
      if (activeStoryId && currentRunMatchesOriginal()) {
        shareStage = 'deliverOriginalShare';
        await sharePayload({ title: shareTitle, text: shareText, url: buildOriginalStoryUrl(activeStoryId) });
        return;
      }
      shareStage = 'createStorySnapshot';
      const { shareId, sharedRecord } = await createCurrentStorySnapshot('unlisted', 'intervened');
      createdShareId = shareId;
      setSharedStoryId(shareId);
      shareStage = 'deliverPreparedShare';
      await sharePayload({ title: shareTitle, text: shareText, url: buildSharedStoryUrl(shareId) });
      cacheSharedSnapshotAfterCreate(shareId, sharedRecord);
      if ((globalThis as any).__legacyShareRecord__) {
      shareStage = 'resolveProvenance';
      const provenance = await resolveActiveStoryProvenance();
      shareStage = 'createSharedStoryRecord';
      const shareId = await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint?.title || "未命名故事",
        main_axis: blueprint?.main_axis || "",
        tags: selectedThemes,
        characters: blueprint?.characters || [],
        chapters: chapters as any,
        averageChapterWords: getAverageChapterWords(chapters),
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
        chapters,
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        originalAuthorId: provenance.originalAuthorId,
        originalAuthorName: provenance.originalAuthorName,
        intervenerId: user.uid,
        intervenerName: getUserAuthorName(user),
        coverUrl: activeStoryMeta?.coverUrl || '',
        sourceStoryId: activeStoryId,
        averageChapterWords: getAverageChapterWords(chapters),
        chapterCount: getReadyChapterCount(chapters),
        cardExcerpt: getStoryCardExcerpt(blueprint?.main_axis || '', chapters),
        allowAdaptation: getActiveStoryAllowAdaptation(),
        visibility: 'unlisted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMySharedStories((prev) => [sharedRecord, ...prev.filter((story: any) => story.id !== shareId)]);
      shareStage = 'cacheSharedStory';
      await cacheSharedStory(shareId, { meta: { ...sharedRecord, sharedStoryId: shareId }, chapters: chapters as any })
        .catch((error) => console.warn('share cacheSharedStory failed:', error));
      shareStage = 'cacheStoryLists';
      await cacheStoryLists(publicStories, myStories, [sharedRecord, ...mySharedStories.filter((story: any) => story.id !== shareId)])
        .catch((error) => console.warn('share cacheStoryLists failed:', error));
      setSharedStoryId(shareId);
      const shareUrl = buildSharedStoryUrl(shareId);
      const shareTitle = formatBookTitle(blueprint?.title || "未命名故事");
      const shareText = buildStoryShareText(shareTitle, chapters);
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
        showError('已取消分享。');
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
    }
  };

  const handleStoryInteraction = async (kind: 'like' | 'favorite' | 'report', targetId?: string, targetMeta?: any) => {
    const idToUse = targetId || activeStoryId;
    if (!idToUse || !db || !user) { if (!user) setIsAccountCenterOpen(true); return; }
    if ((kind === 'like' || kind === 'favorite') && hasOptimisticStoryAction(kind, idToUse)) {
      showError(kind === 'like' ? '你已经点过赞了。' : '已在馆藏中。');
      return;
    }
    try {
      if (kind === 'like') {
        setStoryActionState('like', idToUse, true);
        applyStoryCountDelta(idToUse, 'likeCount', 1);
        const result = await likeStory(db as any, idToUse, user.uid);
        if (result?.alreadyExists) {
          applyStoryCountDelta(idToUse, 'likeCount', -1);
          showError('你已经点过赞了。');
          return;
        }
        showError('已点赞。');
        return;
      }
      if (kind === 'favorite') {
        setStoryActionState('favorite', idToUse, true);
        applyStoryCountDelta(idToUse, 'favoriteCount', 1);
        const favoriteResult = await favoriteStory(db as any, idToUse, user.uid);
        const alreadyFavorited = Boolean(favoriteResult?.alreadyExists);
        if (alreadyFavorited) {
          applyStoryCountDelta(idToUse, 'favoriteCount', -1);
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
        showError('你已经点过赞了。');
        return;
      }
      console.error(error);
      if (kind === 'like') {
        setStoryActionState('like', idToUse, false);
        applyStoryCountDelta(idToUse, 'likeCount', -1);
      }
      if (kind === 'favorite') {
        setStoryActionState('favorite', idToUse, false);
        applyStoryCountDelta(idToUse, 'favoriteCount', -1);
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
        { id: 'left', title: '左向默认结局', text: parsed.endings.left },
        { id: 'right', title: '右向默认结局', text: parsed.endings.right },
      ];

      if (authoringImportReplaceBranches && parsed.branches.length > 0) {
        // Handle branch import logic...
        showError("支线导入逻辑暂未完全实现，已更新主线内容");
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
            className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
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
                onClick={() => {
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
              className="w-full max-w-md rounded-[2rem] border border-emerald-500/25 bg-zinc-950 p-6 shadow-2xl"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">作品已保存</div>
              <h3 className="mt-2 break-words text-2xl font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                更改已经写入作品档案。你可以马上分享作品，或回到首页继续查看作品库。
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
            className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-zinc-950/50 p-8 shadow-2xl backdrop-blur-2xl"
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
                onClick={() => {
                  setPendingProgressToLoad(null);
                  startNewStoryPlay(pendingProgressToLoad.id);
                }}
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
            className="w-full max-w-md rounded-[2.5rem] border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h3 className="mb-3 text-2xl font-black text-white">确定要离开吗？</h3>
            <p className="mb-8 text-zinc-400 leading-relaxed">
              您当前的干涉尚未保存。离开游玩页后，未保存的作品进度将会丢失。
            </p>
            <div className="flex flex-col gap-3">
              {interventionsLeft > 0 && (
                <button
                  type="button"
                  onClick={resetGame}
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
                保存作品并返回
              </button>
              <button
                type="button"
                onClick={resetGame}
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
            className="w-full max-w-md rounded-[2rem] border border-indigo-500/30 bg-zinc-950 p-7 text-center shadow-2xl"
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
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
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

  const renderSummaryModal = () => (
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
            className="w-full max-w-2xl rounded-[2rem] border border-amber-500/25 bg-zinc-950 p-7 shadow-2xl"
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

  const renderStoryCard = (story: any, isPublic: boolean) => {
    const coverUrl = getStoryCoverUrl(story);
    const tags = getStoryTags(story);
    const storyStats = [
      { label: '点赞', value: getStoryLikeCount(story), icon: Heart },
      { label: '干涉', value: getStoryInterventionCount(story), icon: Sparkles },
      { label: '收藏', value: getStoryFavoriteCount(story), icon: Bookmark },
      { label: '均章', value: `${getStoryAverageChapterWords(story) || '未知'} 字`, icon: BookOpen },
    ];
    return (
      <motion.div
        key={story.id}
        whileHover={{ y: -4, scale: 1.01 }}
        className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-xl transition-all hover:border-indigo-500/50 hover:bg-zinc-900"
      >
        <div className="flex gap-4">
          <div className="w-28 shrink-0 sm:w-32">
            <button type="button" onClick={() => setStoryDetailStory(story)} className="relative h-28 w-28 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950 sm:h-32 sm:w-32 cursor-pointer transition-all hover:ring-2 hover:ring-indigo-500 hover:ring-offset-2 hover:ring-offset-zinc-950">
              {coverUrl ? (
                <img src={coverUrl} alt={`${formatBookTitle(getStoryTitle(story))} 封面`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  3T NOVEL
                </div>
              )}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] font-black text-zinc-500">
              {storyStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-zinc-600" />
                    <span className="text-zinc-200">{stat.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-2 flex min-w-0 flex-wrap gap-1.5">
              {(tags.length > 0 ? tags.slice(0, 2) : ['未标签']).map((tag: string) => (
                <span key={tag} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-black text-indigo-300">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="mb-1 whitespace-normal break-words text-xl font-black leading-tight text-white transition-colors group-hover:text-indigo-300 sm:text-2xl">
              {formatBookTitle(getStoryTitle(story))}
            </h3>
            <div className="mb-2 text-sm font-bold text-zinc-500">
              作者：{getStoryAuthorName(story)}
            </div>
            <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300">
              {getStoryMainAxis(story)}
            </p>
            <div className="mt-auto grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setStoryDetailStory(story)} className={`${semanticButtonClass('secondary', { fullWidth: true, compact: true })} text-sm`}>
                <BookOpen className="h-4 w-4" />
                查看详情
              </button>
              <button type="button" onClick={() => startStoryPlay(story.id)} className={`${semanticButtonClass('primary', { fullWidth: true, compact: true })} text-sm`}>
                <Sparkles className="h-4 w-4" />
                干涉命运
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
    const handlePlayFromDetail = () => {
      const targetStoryId = storyDetailStory?.id || storyDetailStory?.storyId;
      if (!targetStoryId) return;
      setStoryDetailStory(null);
      void startStoryPlay(targetStoryId);
    };
    const handleShareFromDetail = async () => {
      if (!storyDetailStory) return;
      try {
        setIsSharing(true);
        await shareOriginalStoryByCard(storyDetailStory);
      } catch (error: any) {
        console.error(error);
        showError(error?.message || '分享失败。');
      } finally {
        setIsSharing(false);
      }
    };

    return (
      <AnimatePresence>
        {storyDetailStory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[5400] bg-black/75 backdrop-blur-md`}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="relative mt-[env(safe-area-inset-top)] max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-7"
          >
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
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-1">
                  <button type="button" onClick={() => handleStoryInteraction('like', storyDetailStory?.id || storyDetailStory?.storyId, storyDetailStory)} className={`group flex flex-col justify-between rounded-2xl border px-3 py-2 text-left transition-all active:scale-[0.98] ${hasOptimisticStoryAction('like', storyDetailStory?.id || storyDetailStory?.storyId) ? 'border-pink-500/40 bg-pink-500/10' : 'border-zinc-800 bg-zinc-900/60 hover:border-pink-500/30 hover:bg-pink-500/10'}`}>
                    <div className={`flex w-full items-center justify-between text-[11px] font-black transition-colors ${hasOptimisticStoryAction('like', storyDetailStory?.id || storyDetailStory?.storyId) ? 'text-pink-300' : 'text-zinc-500 group-hover:text-pink-400'}`}>
                      点赞 <Heart className={`h-3.5 w-3.5 transition-transform ${hasOptimisticStoryAction('like', storyDetailStory?.id || storyDetailStory?.storyId) ? 'scale-110 fill-current' : ''}`} />
                    </div>
                    <div className="mt-0.5 text-sm font-black text-zinc-100">{storyDetailStory ? getStoryLikeCount(storyDetailStory) : 0}</div>
                  </button>
                  <button type="button" onClick={() => handleStoryInteraction('favorite', storyDetailStory?.id || storyDetailStory?.storyId, storyDetailStory)} className={`group flex flex-col justify-between rounded-2xl border px-3 py-2 text-left transition-all active:scale-[0.98] ${hasOptimisticStoryAction('favorite', storyDetailStory?.id || storyDetailStory?.storyId) ? 'border-amber-500/40 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/60 hover:border-amber-500/30 hover:bg-amber-500/10'}`}>
                    <div className={`flex w-full items-center justify-between text-[11px] font-black transition-colors ${hasOptimisticStoryAction('favorite', storyDetailStory?.id || storyDetailStory?.storyId) ? 'text-amber-300' : 'text-zinc-500 group-hover:text-amber-400'}`}>
                      收藏 <Bookmark className={`h-3.5 w-3.5 transition-transform ${hasOptimisticStoryAction('favorite', storyDetailStory?.id || storyDetailStory?.storyId) ? 'scale-110 fill-current' : ''}`} />
                    </div>
                    <div className="mt-0.5 text-sm font-black text-zinc-100">{storyDetailStory ? getStoryFavoriteCount(storyDetailStory) : 0}</div>
                  </button>
                  <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                    <div className="flex w-full items-center justify-between text-[11px] font-black text-zinc-500">
                      干涉 <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="mt-0.5 text-sm font-black text-zinc-100">{storyDetailStory ? getStoryInterventionCount(storyDetailStory) : 0}</div>
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                    <div className="flex w-full items-center justify-between text-[11px] font-black text-zinc-500">
                      均章字数 <BookOpen className="h-3.5 w-3.5" />
                    </div>
                    <div className="mt-0.5 text-sm font-black text-zinc-100">{storyDetailStory ? getStoryAverageChapterWords(storyDetailStory) || '未知' : '未知'} 字</div>
                  </div>
                </div>
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
                <div className="mt-2 text-sm font-bold text-zinc-500">作者：{getStoryAuthorName(storyDetailStory)}</div>
                <div className="mt-5 max-h-[40vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900/45 p-4 text-base leading-relaxed text-zinc-300">
                  {getStoryMainAxis(storyDetailStory) || '这部作品暂时还没有填写完整介绍。'}
                </div>
                <div className="mt-5 grid gap-3">
                  <button type="button" onClick={handlePlayFromDetail} className={semanticButtonClass('primary', { fullWidth: true })}>
                    <Sparkles className="h-4 w-4" />
                    干涉命运
                  </button>
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

  const getVisibleStoryLibraryItems = () => {
    const source = storyLibraryTab === 'mine' ? myStories : publicStories;
    const keyword = storyLibrarySearch.trim().toLowerCase();
    return [...source]
      .filter((story: any) => {
        if (storyLibraryTab === 'mine' && storyLibraryVisibilityFilter !== 'all' && story.visibility !== storyLibraryVisibilityFilter) return false;
        if (!keyword) return true;
        const haystack = `${getStoryTitle(story)}\n${getStoryAuthorName(story)}\n${getStoryMainAxis(story)}\n${getStoryTags(story).join(' ')}`.toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a: any, b: any) => {
        if (storyLibrarySort === 'likes') return getStoryLikeCount(b) - getStoryLikeCount(a);
        if (storyLibrarySort === 'interventions') return getStoryInterventionCount(b) - getStoryInterventionCount(a);
        if (storyLibrarySort === 'favorites') return getStoryFavoriteCount(b) - getStoryFavoriteCount(a);
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
    return (
    <div className="mx-auto max-w-7xl px-6 pb-12 pt-[max(3rem,calc(env(safe-area-inset-top)+3rem))] lg:px-8">
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white sm:text-4xl">选择命运篇章</h2>
          <p className="mt-2 text-zinc-500">挑选一个世界，或直接生成新世界、进入作者后台与个人馆藏。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!isStandaloneMode && (
            <button
              type="button"
              onClick={handleInstallApp}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              <Download className="h-4 w-4" />
              下载 App
            </button>
          )}
          <button
            onClick={() => navigateTo('THEME_SELECTION')}
            className={semanticButtonClass('primary', { compact: true })}
          >
            <Wand2 className="h-4 w-4" />
            快速生成故事
          </button>
          <button
            onClick={() => enterAuthoring()}
            className={semanticButtonClass('secondary', { compact: true })}
          >
            <Sparkles className="h-4 w-4" />
            作者后台
          </button>
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1">
            {[
              { id: 'public', label: '作品列表', count: publicStories.length },
              { id: 'mine', label: '我的作品', count: myStories.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStoryLibraryTab(tab.id as 'public' | 'mine')}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                  storyLibraryTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
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
              placeholder="搜索标题、作者、标签或主轴"
              className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 sm:w-72"
            />
            {storyLibraryTab === 'mine' && (
              <select
                value={storyLibraryVisibilityFilter}
                onChange={(event) => setStoryLibraryVisibilityFilter(event.target.value as any)}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
              >
                <option value="all">全部权限</option>
                <option value="private">私密</option>
                <option value="public">公开</option>
                <option value="unlisted">非公开链接</option>
              </select>
            )}
            <select
              value={storyLibrarySort}
              onChange={(event) => handleStoryLibrarySortChange(event.target.value as StoryLibrarySort)}
              className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
            >
              <option value="updated">最近更新</option>
              <option value="interventions">干涉最多</option>
              <option value="likes">点赞最多</option>
              <option value="favorites">收藏最多</option>
              <option value="words">平均字数</option>
            </select>
            <button
              type="button"
              onClick={() => refreshStories({ force: true })}
              disabled={isLoadingStories}
              className={semanticButtonClass('ghost', { compact: true })}
            >
              <RefreshCcw className={`h-4 w-4 ${isLoadingStories ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
        {isLoadingStories ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-700" />
          </div>
        ) : storyListLoadError && visibleStories.length === 0 ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <div className="text-sm font-black text-amber-100">作品列表暂时无法同步</div>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-amber-100/75">
              {storyListLoadError}
            </p>
            <button
              type="button"
              onClick={() => refreshStories({ force: true })}
              className={`${semanticButtonClass('primary', { compact: true })} mt-5`}
            >
              <RefreshCcw className="h-4 w-4" />
              重新读取作品库
            </button>
          </div>
        ) : visibleStories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm font-bold text-zinc-500">
            没有符合条件的作品。
          </div>
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
    const isArchiveSyncing = archiveSegment.status === 'loading' || archiveSegment.status === 'syncing';

    const renderFavoriteCard = (story: any) => {
      const isChoosingThis = archiveChoiceStoryId === story.id;
      return (
        <div key={story.id} className="rounded-[1.5rem] border border-indigo-500/20 bg-indigo-500/5 p-5 transition-all duration-150">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="line-clamp-2 text-sm font-black text-white leading-snug">{formatBookTitle(story.title)}</div>
            <div className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-1 text-[10px] font-black text-indigo-300">收藏原作</div>
          </div>
          <div className="mb-3 text-[11px] font-bold text-zinc-500">
            原作者：{getOriginalAuthorName(story)}
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
      <div key={story.id} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5 flex flex-col">
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
          <div>原作者：{getOriginalAuthorName(story)}</div>
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

    return (
      <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
        <AnimatePresence>
          {isArchiveSyncing && (
            <BlockingSyncOverlay
              title="正在同步命运收藏馆"
              detail="如果网络较慢，会先保留本机缓存，完成后自动更新列表。"
              zIndexClass="z-[3200]"
            />
          )}
        </AnimatePresence>
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white sm:text-4xl">命运收藏馆</h2>
            <p className="mt-2 text-sm text-zinc-500">管理你收藏的原作与保存的干涉记录。</p>
          </div>
          <BackNavButton label={archiveReturnTarget === 'PLAYING' ? '返回游玩页' : '返回作品库'} onClick={leaveArchiveView} />
        </div>

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-4 sm:p-5">
          {archiveSegment.status === 'error' && (
            <div className="mb-5 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100/85">
              <div className="font-black text-amber-100">收藏馆同步暂时不顺利</div>
              <p className="mt-1 text-xs text-amber-100/70">{archiveSegment.error || '已保留当前可用内容，你可以稍后刷新重试。'}</p>
            </div>
          )}
          {/* Tab 切换栏 */}
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1 shrink-0">
              {([
                { id: 'favorite', label: '收藏原作' },
                { id: 'saved', label: '保存记录' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setArchiveTab(tab.id); setArchiveChoiceStoryId(null); }}
                  className={`rounded-xl px-4 py-2 text-sm font-black transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                    archiveTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {tab.label} <span className="ml-1 text-[10px] opacity-70">{archiveStories.filter((s: any) => tab.id === 'favorite' ? s.archiveKind === 'favorite' : s.archiveKind !== 'favorite').length}</span>
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="search"
                  value={archiveSearch}
                  onChange={(event) => { setArchiveSearch(event.target.value); setArchiveChoiceStoryId(null); }}
                  placeholder="搜索标题或主轴内容"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => refreshArchiveStories({ force: true })}
                  disabled={isArchiveSyncing}
                  className={semanticButtonClass('ghost', { compact: true })}
                >
                  <RefreshCcw className={`h-4 w-4 ${isArchiveSyncing ? 'animate-spin' : ''}`} />
                  刷新馆藏
                </button>
              </div>
              {archiveTab === 'saved' && (
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'all', label: '全部' },
                    { id: 'unlisted', label: '非公开链接' },
                    { id: 'private', label: '私人' },
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
          {archiveTab === 'favorite' ? (
            favoriteStories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm font-bold text-zinc-500">
                {keyword ? '没有符合搜索词的收藏原作' : '还没有收藏任何原作。在游玩页点击「收藏」后会出现在这里。'}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteStories.map(renderFavoriteCard)}
              </div>
            )
          ) : (
            savedStories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm font-bold text-zinc-500">
                {keyword || archiveFilter !== 'all' ? '没有符合条件的保存记录' : '还没有保存任何干涉记录。在游玩页点击「保存作品」后会出现在这里。'}
              </div>
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
  const renderThemeSelectionView = () => (
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-center px-6 pb-20 pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] text-center lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <BackNavButton label="返回上一页" onClick={() => goBack('STORY_SELECT')} />
        <div className="h-10 w-10" />
      </div>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
          <Wand2 className="h-4 w-4" />
          命运引擎
        </div>
        <h1 className="text-4xl font-black text-white sm:text-5xl">快速生成故事</h1>
        <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
          选择 1 到 4 个主题，或直接输入你的故事大纲。系统会先生成完整蓝图，再预先写好前 3 章供你开始干涉。
        </p>
      </div>

      <div className="mx-auto mt-6 w-full max-w-2xl px-4 text-left">
        <label className="mb-3 block text-sm font-bold text-zinc-300">主题与标签（以中文逗号分隔）</label>
        <input
          value={themeInputText}
          onChange={(event) => {
             const val = event.target.value;
             setThemeInputText(val);
             setSelectedThemes(val.split(/[,，]/).map(s => s.trim()).filter(Boolean));
          }}
          placeholder="在此手动输入标签或点击下方快速添加"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {THEMES.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                 const current = themeInputText.trim();
                 let newText = current;
                 if (!current) newText = tag;
                 else if (!current.includes(tag)) newText = current + (current.endsWith('，') || current.endsWith(',') ? '' : '，') + tag;
                 setThemeInputText(newText);
                 setSelectedThemes(newText.split(/[,，]/).map(s => s.trim()).filter(Boolean));
              }}
              className="rounded-lg bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-2xl rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-6 text-left">
        <label className="mb-3 block text-sm font-bold text-zinc-300">专属故事大纲</label>
        <textarea
          value={customOutline}
          onChange={(event) => setCustomOutline(event.target.value)}
          placeholder="例如：一位在现代都市经营神秘书店的青年，某夜遇见来自未来的顾客，自此被卷入一场会改写现实的命运试炼。"
          className="min-h-[140px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-400">叙事人称</span>
              <span className="text-xs font-black text-indigo-300">
                {NARRATIVE_PERSON_OPTIONS.find((option) => option.value === narrativePerson)?.label}
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
                  <div className="text-sm font-black">{option.label}</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-400">结局结构</span>
              <span className="text-xs font-black text-indigo-300">
                {quickEndingMode === 'single' ? '单一结局' : '多线结局'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                {
                  value: 'single',
                  label: '单一结局',
                  hint: '所有干涉最终收束到同一个终局，重点在过程变化与圆回主线。',
                },
                {
                  value: 'dual',
                  label: '多线结局',
                  hint: '使用默认、左向、右向三类收束，并为每类保留扩展更多具体结局的空间。',
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
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-400">每章目标字数</span>
            <span className="font-black text-indigo-300">{targetWordCount} 字</span>
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
            <span>精简</span>
            <span>宏大</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateBlueprint}
          disabled={(selectedThemes.length < 1 && customOutline.trim().length === 0) || selectedThemes.length > 4}
          className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
        >
          <Sparkles className="h-4 w-4" />
          生成世界蓝图
        </button>
      </div>
    </div>
  );

  const accountCenterModal = (
    <AnimatePresence>
      {isAccountCenterOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[3200] bg-black/80 backdrop-blur-md`}
          onClick={() => setIsAccountCenterOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="max-h-[82dvh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">个人中心</div>
                <div className="mt-1 text-2xl font-black text-white">{getUserAuthorName(user)}</div>
                <div className="text-sm text-zinc-500">{user?.email || '游客账号'}</div>
                {user?.isAnonymous && (
                  <div className="mt-3 max-w-xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-50/80">
                    {GUEST_RETENTION_NOTICE}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setIsAccountCenterOpen(false)} className={semanticIconButtonClass('ghost')} aria-label="返回">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                  <Settings className="h-5 w-5 text-indigo-300" />
                  账号设置
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-zinc-100">界面主题</div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                          浅色主题使用柔和低疲劳配色，暗色主题保留原本氛围。
                        </div>
                      </div>
                      {appTheme === 'light' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-300" />}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'dark' as const, label: '暗色' },
                        { value: 'light' as const, label: '浅色' },
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
                  <input
                    value={profileDisplayName}
                    onChange={(event) => setProfileDisplayName(event.target.value)}
                    placeholder="显示名称"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                  <button type="button" onClick={handleUpdateProfileDisplayName} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    <PenSquare className="h-4 w-4" />
                    更新名称
                  </button>
                  {!user?.isAnonymous && (
                    <>
                      <input
                        type="password"
                        value={profileCurrentPassword}
                        onChange={(event) => setProfileCurrentPassword(event.target.value)}
                        placeholder="当前密码"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      />
                      <input
                        type="password"
                        value={profileNewPassword}
                        onChange={(event) => setProfileNewPassword(event.target.value)}
                        placeholder="新密码（至少 6 位）"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      />
                      <button type="button" onClick={handleUpdateAccountPassword} className={semanticButtonClass('ghost', { fullWidth: true })}>
                        <Lock className="h-4 w-4" />
                        修改密码
                      </button>
                      <button type="button" onClick={() => handlePasswordResetForEmail(user?.email || '')} className={semanticButtonClass('ghost', { fullWidth: true })}>
                        <Mail className="h-4 w-4" />
                        发送重设邮件
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountCenterOpen(false);
                      handleLogout();
                    }}
                    className={semanticButtonClass('danger', { fullWidth: true })}
                  >
                    <LogOut className="h-4 w-4" />
                    登出
                  </button>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                  <Archive className="h-5 w-5 text-indigo-300" />
                  命运收藏馆
                </div>
                <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="text-sm text-zinc-400">
                    已保存/已分享的故事记录现在集中在独立页面管理。
                  </div>
                  <button
                    type="button"
                    onClick={() => openArchiveView('STORY_SELECT')}
                    className={semanticButtonClass('secondary', { fullWidth: true })}
                  >
                    <Archive className="h-4 w-4" />
                    打开命运收藏馆页
                  </button>
                </div>
              </section>

              {isAdminUser && (
                <section className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-5 lg:col-span-2">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                    <Settings className="h-5 w-5 text-amber-300" />
                    管理目录
                  </div>
                  <div className="space-y-4 rounded-2xl border border-amber-500/20 bg-zinc-950/60 p-4">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderReadonlyStoryView = () => {
    const story = readonlyStoryData;
    if (!story) return null;
    const readonlyArchiveId = story.meta?.sharedStoryId;
    const isReadonlyOwner = Boolean(user && readonlyArchiveId && story.meta?.authorId === user.uid);
    const isReadonlyUpdating = Boolean(readonlyArchiveId && archiveUpdatingIds[readonlyArchiveId]);
    return (
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] sm:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            {story.meta?.coverUrl && (
              <img src={story.meta.coverUrl} alt={`${formatBookTitle(story.meta?.title)} 封面`} className="h-24 w-24 shrink-0 rounded-2xl border border-zinc-800 object-cover sm:h-32 sm:w-32" />
            )}
            <div className="min-w-0 space-y-3">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">故事记录</div>
              <h1 className="break-words text-4xl font-black text-white">{formatBookTitle(story.meta?.title)}</h1>
              <div className="space-y-1 text-sm font-bold text-zinc-500">
                <div>原作者：{getOriginalAuthorName(story.meta)}</div>
                {getIntervenerName(story.meta) && <div>干涉者：{getIntervenerName(story.meta)}</div>}
              </div>
            </div>
          </div>
          {readonlyCanGoBack && <BackNavButton label="返回上一页" onClick={leaveReadonlyStory} />}
        </div>
        <div className="mb-10 rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-6 text-sm leading-relaxed text-zinc-300">
          {story.meta?.main_axis || '暂无故事主轴摘要。'}
        </div>
        <div className="mb-8 flex justify-end">
          <ReadingTextControls />
        </div>
        {isReadonlyOwner && (
          <div className="mb-8 rounded-[2rem] border border-zinc-800 bg-zinc-900/35 p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">馆藏管理</div>
                <div className="mt-1 text-sm font-bold text-zinc-300">
                  当前状态：{story.meta?.visibility === 'unlisted' ? '非公开链接，可通过链接访问' : '私人，仅你可见'}
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
                  设为私人
                </button>
                <button
                  type="button"
                  disabled={isReadonlyUpdating || story.meta?.visibility === 'unlisted'}
                  onClick={() => handleArchiveVisibilityChange({ id: readonlyArchiveId }, 'unlisted')}
                  className={semanticButtonClass('secondary', { compact: true })}
                >
                  <ExternalLink className="h-4 w-4" />
                  设为非公开链接
                </button>
                <button
                  type="button"
                  disabled={isSharing || isReadonlyUpdating}
                  onClick={shareExistingArchiveStory}
                  className={semanticButtonClass('primary', { compact: true })}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  分享
                </button>
                <button
                  type="button"
                  disabled={isReadonlyUpdating}
                  onClick={deleteReadonlyArchiveStory}
                  className={semanticButtonClass('danger', { compact: true })}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              分享会使用当前这条馆藏记录本身，不会重复创建新的通篇馆藏作品。
            </p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-14">
          {(story.chapters || []).map((chapter) => (
            <section key={chapter.chapter_num} className="relative scroll-mt-28">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-950/45 text-xs font-black text-zinc-500">
                  {chapter.chapter_num}
                </div>
                <h2 className="text-xl font-black text-zinc-100">{chapter.title || `第${chapter.chapter_num}章`}</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
              </div>
              <div className="space-y-5 text-zinc-300">
                {(chapter.text || '').split('\n').filter(Boolean).map((paragraph, idx) => (
                  <p key={idx} style={readingParagraphStyle} className="leading-relaxed">{renderParagraphWithHighlights(paragraph, story.meta?.characters || [])}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-[2rem] border border-indigo-500/20 bg-indigo-500/10 p-6 text-center">
          <h3 className="text-2xl font-black text-white">想亲手改变这条命运线吗？</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            这页是只读故事记录。注册或登录后，你可以从原版故事开始干涉命运，也可以一键改编成自己的版本。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={user ? handleInterveneFromReadonly : () => {
                setReadonlyStoryData(null);
                window.history.replaceState({}, '', window.location.pathname);
                resetToHome();
                showError('请先注册或登录，然后再干涉故事。');
              }}
              disabled={user ? !story.meta?.sourceStoryId : false}
              className={semanticButtonClass('primary', { compact: true })}
            >
              <Zap className="h-4 w-4" />
              {user ? '干涉原版故事' : '登录后干涉'}
            </button>
            <button
              type="button"
              onClick={user ? handleAdaptFromReadonly : () => {
                setReadonlyStoryData(null);
                window.history.replaceState({}, '', window.location.pathname);
                resetToHome();
                showError('请先注册或登录，然后再改编故事。');
              }}
              className={semanticButtonClass('secondary', { compact: true })}
            >
              <Wand2 className="h-4 w-4" />
              {user ? (canAdaptReadonlyStory(story.meta) ? '一键改编' : '未开放改编') : '注册成用户'}
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
              浏览故事库
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
              <h3 className="text-xl font-black text-white">故事信息</h3>
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
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">故事背景</h4>
                    <p className="text-sm leading-relaxed text-zinc-300">{blueprint.main_axis}</p>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">登场角色</h4>
                    <div className="grid gap-3">
                      {blueprint.characters.map(char => (
                        <div key={char.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                          <div className="mb-1 flex items-start justify-between">
                            <div className="font-bold text-indigo-300">{char.name}</div>
                            {characterStatuses[char.id] && (
                              <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {characterStatuses[char.id].status || '在场'}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 leading-relaxed">{char.desc}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">命运支线</h4>
                    <div className="grid gap-3">
                      {(blueprint.branches || []).length === 0 ? (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
                          暂无支线记录。
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
                          const visibleName = isHidden && !canRevealBranchContent ? '隐藏支线' : branch.name;
                          const visibleDesc = canRevealBranchContent
                            ? (branch.desc || branch.sceneText || branch.hint || '尚无支线描述。')
                            : (branch.hint || '继续干涉命运，寻找这条支线的触发契机。');
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
                                  {isUnlocked ? '已解锁' : wasUnlocked ? '曾解锁' : '待解锁'}
                                </div>
                              </div>
                              <div className="text-xs leading-relaxed text-zinc-500">{visibleDesc}</div>
                              {canRevealBranchContent && (
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">
                                    {branch.side === 'left' ? '左向支线' : '右向支线'}
                                  </span>
                                  <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-200">
                                    影响：{branchTierLabel(branch.tier)}
                                  </span>
                                  <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-200">
                                    导向 {authoringEndingIdToLabel(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || branch.side)}
                                  </span>
                                  {(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden) && (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">隐藏支线</span>
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

  const actionMenuButton = (
    <div className="fixed left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] z-[2000] flex items-center justify-between gap-3 sm:left-auto sm:right-6">
      {gameState === 'PLAYING' && (
        <button
          type="button"
          onClick={() => setShowLeaveGameModal(true)}
          aria-label="返回作品库"
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
            故事信息
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsAccountCenterOpen(true)}
          aria-label="打开个人中心"
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <UserIcon className="h-5 w-5" />
        </button>
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
      <button
        type="button"
        onClick={() => openArchiveView('STORY_SELECT')}
        aria-label="打开命运收藏馆"
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
      >
        <Archive className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setIsAccountCenterOpen(true)}
        aria-label="打开个人中心"
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
      >
        <UserIcon className="h-5 w-5" />
      </button>
    </div>
  ) : null;

  const floatingInterventionPanel = blueprint && gameState === 'PLAYING' && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1900] rounded-full border border-zinc-700/45 bg-zinc-900/78 px-3 py-2 shadow-xl backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[24rem]">
        <div className="flex min-h-10 items-center justify-between gap-3 px-1">
          <div className="shrink-0 text-sm font-black text-zinc-300">
            {interventionsLeft}/3 干涉数
          </div>
          <div className="min-w-0 flex-1 text-center text-sm font-black">
            {(() => {
              const left = Math.round(uiFeedback.leftProgress || 0);
              const right = Math.round(uiFeedback.rightProgress || 0);
              if (left <= 0 && right <= 0) return <span className="text-zinc-400">均衡</span>;
              if (left >= right) return <span className="text-indigo-300/85">左{left}%</span>;
              return <span className="text-rose-300/85">右{right}%</span>;
            })()}
          </div>
          <button
            type="button"
            onClick={() => handleGenerateSummary(interventionsLeft > 0 ? 'manual' : 'auto_interventions')}
            disabled={isRewriting || isGeneratingConclusion || !activeStoryId}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
              storyConclusion || interventionsLeft <= 0
                ? 'border border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-zinc-500'
                : 'bg-zinc-100 text-zinc-950 hover:bg-white'
            }`}
          >
            {isGeneratingConclusion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {storyConclusion || interventionsLeft <= 0 ? '查看最终命运' : '命运确定'}
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  const renderPlayingView = () => (
    <div className="relative mx-auto max-w-4xl px-6 pb-40 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] sm:px-8 sm:pb-32">
      {blueprint && (
        <div className="mb-16 space-y-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-full bg-indigo-500/10 px-4 py-1 text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase"
          >
            正在干涉世界线
          </motion.div>
          <h1 className="text-4xl font-black text-white sm:text-6xl">{formatBookTitle(blueprint.title)}</h1>
          <div className="text-sm font-bold text-zinc-500">作者：{getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}</div>
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

      <div className="mx-auto max-w-3xl space-y-16">
        {chapters.map((chapter, idx) => (
          <motion.section
            id={`chapter-${chapter.chapter_num}`}
            key={chapter.chapter_num || idx}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="group relative"
          >
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-950/45 text-xs font-black text-zinc-500 transition-colors group-hover:border-indigo-500/40 group-hover:text-indigo-300">
                {chapter.chapter_num}
              </div>
              <h2 className="text-xl font-bold text-zinc-100">{chapter.title || `第${chapter.chapter_num}章`}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
            </div>
            
            <div className="relative leading-relaxed text-zinc-300">
              <div className="prose prose-invert max-w-none space-y-6">
                {isChapterTextReady(chapter) ? (
                  String(chapter.text || '').split('\n').filter(Boolean).map((p, pIdx) => (
                    <p key={pIdx} style={readingParagraphStyle} className="leading-relaxed first-letter:text-3xl first-letter:font-black first-letter:text-indigo-400 first-letter:mr-1">
                      {renderParagraphWithHighlights(p, blueprint?.characters, changeHighlights[chapter.chapter_num] || [])}
                    </p>
                  ))
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5 text-sm font-bold text-indigo-100">
                    <Loader2 className={`h-5 w-5 ${backgroundGeneratingChapter === chapter.chapter_num ? 'animate-spin' : ''}`} />
                    {backgroundGeneratingChapter === chapter.chapter_num
                      ? `第${chapter.chapter_num}章正在生成中，完成后会自动出现。`
                      : `第${chapter.chapter_num}章已排入生成队列。`}
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
                        {isAlreadyIntervened ? '再次干涉' : '干涉命运'}
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
                              <div className="mb-1 text-sm font-black text-zinc-100">因果节点已就绪</div>
                              <div className="text-xs leading-relaxed text-zinc-500">
                                请选择本章登场角色，再决定施加庇佑或磨难。支线提示只作为命运走向的参考，不会直接写进故事表面。
                              </div>
                            </div>
                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {availableCharacters.map((char) => {
                                const branchHints = (blueprint.branches || [])
                                  .filter((branch) => branch.condition_chapter === chapter.chapter_num && branch.condition_char === char.id)
                                  .map((branch) => branch.hint)
                                  .filter((hint): hint is string => Boolean(hint))
                                  .slice(0, 2);

                                return (
                                  <div key={char.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                                    <div className="mb-3">
                                      <div className="flex items-start justify-between">
                                        <div className="text-sm font-black text-zinc-100">{char.name}</div>
                                        {characterStatuses[char.id] && (
                                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {characterStatuses[char.id].status || '在场'}
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
                                        庇佑
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleIntervene(chapter.chapter_num, char.id, 'curse')}
                                        disabled={interventionsLeft <= 0 || isRewriting}
                                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm font-black text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/15 disabled:opacity-30"
                                      >
                                        <Skull className="h-4 w-4" />
                                        磨难
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
              {idx < chapters.length - 1 && (
                <div className="mt-12 h-px bg-gradient-to-r from-transparent via-zinc-800/80 to-transparent" />
              )}
            </div>
          </motion.section>
        ))}
      </div>

      {gameState === 'PLAYING' && intervenedChapters.length >= 3 && (
        <div className="mt-24 text-center">
          <button
            onClick={() => handleGenerateSummary('auto_interventions')}
            className="group relative inline-flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-lg font-black text-black shadow-2xl transition-all hover:scale-105"
          >
            <Sparkles className="h-6 w-6 text-indigo-500 group-hover:animate-pulse" />
            查看最终命运
          </button>
        </div>
      )}
      {blueprint && (
        <div className="mt-16 rounded-3xl border border-zinc-800 bg-zinc-900/30 p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-white">{formatBookTitle(blueprint.title)}</div>
              <div className="text-xs font-bold text-zinc-500">作者：{getStoryAuthorName(activeStoryMeta || { authorId: user?.uid, authorName: getUserAuthorName(user) })}</div>
            </div>
            <div className="text-xs text-zinc-600">平均每章 {getAverageChapterWords(chapters) || '未知'} 字</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => handleStoryInteraction('like')} className={`${semanticButtonClass(hasOptimisticStoryAction('like', activeStoryId) ? 'secondary' : 'ghost', { compact: true })} ${hasOptimisticStoryAction('like', activeStoryId) ? 'text-pink-200' : ''}`}>
              <Heart className={`h-4 w-4 ${hasOptimisticStoryAction('like', activeStoryId) ? 'fill-current' : ''}`} /> 点赞
            </button>
            <button type="button" onClick={() => handleStoryInteraction('favorite')} className={`${semanticButtonClass(hasOptimisticStoryAction('favorite', activeStoryId) ? 'secondary' : 'ghost', { compact: true })} ${hasOptimisticStoryAction('favorite', activeStoryId) ? 'text-amber-200' : ''}`}>
              <Bookmark className={`h-4 w-4 ${hasOptimisticStoryAction('favorite', activeStoryId) ? 'fill-current' : ''}`} /> 收藏
            </button>
            <button type="button" onClick={handleShareStory} disabled={isSharing || !blueprint} className={semanticButtonClass('secondary', { compact: true })}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} 分享
            </button>
            <button type="button" onClick={handleSaveWorkAndReturn} className={semanticButtonClass('secondary', { compact: true })}>
              <Archive className="h-4 w-4" /> 保存当前故事
            </button>
            {!activeStoryId && (
              <button type="button" onClick={handleRegenerateQuickStory} className={semanticButtonClass('ghost', { compact: true })}>
                <RefreshCcw className="h-4 w-4" /> 重新生成
              </button>
            )}
            <button type="button" onClick={handleAdaptCurrentStory} disabled={!canAdaptCurrentStory() || isLoadingStories} className={semanticButtonClass('secondary', { compact: true })}>
              {isLoadingStories ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {canAdaptCurrentStory() ? '一键改编' : '未开放改编'}
            </button>
            <button type="button" onClick={() => handleStoryInteraction('report')} className={semanticButtonClass('danger', { compact: true })}>
              <Flag className="h-4 w-4" /> 举报
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSummaryView = () => (
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] sm:px-8">
      <div className="mb-16 text-center space-y-4">
        <div className="inline-block rounded-full bg-amber-500/10 px-4 py-1 text-[10px] font-bold tracking-[0.2em] text-amber-500 uppercase">
          命运之卷已封存
        </div>
        <h1 className="text-4xl font-black text-white sm:text-6xl">最终命运总结</h1>
      </div>

      <div className="relative rounded-[3rem] border border-zinc-800 bg-zinc-900/30 p-10 shadow-2xl backdrop-blur-xl sm:p-12">
        {isGeneratingConclusion ? (
          <div className="flex h-64 flex-col items-center justify-center gap-6">
            <Loader2 className="h-10 w-10 animate-spin text-zinc-700" />
            <p className="text-sm font-bold text-zinc-500">{generationStatus}</p>
          </div>
        ) : (
          <div className="space-y-12">
            <section className="space-y-6">
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
        <div className="text-sm font-black text-white">{isNew ? '新建支线' : '编辑支线'}</div>
        <button type="button" onClick={() => setExpandedBranchId(null)} className={semanticButtonClass('ghost', { compact: true })}>
          <X className="h-4 w-4" />
          取消
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={branchForm.name} onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="支线名" />
        <input value={branchForm.hint} onChange={(event) => setBranchForm((prev) => ({ ...prev, hint: event.target.value }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="提示短句" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={branchForm.side} onChange={(event) => setBranchForm((prev) => ({ ...prev, side: event.target.value as 'left' | 'right' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
          <option value="left">左倾支线</option>
          <option value="right">右倾支线</option>
        </select>
        <select value={branchForm.tier} onChange={(event) => setBranchForm((prev) => ({ ...prev, tier: event.target.value as 'small' | 'medium' | 'large' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
          <option value="small">影响：小</option>
          <option value="medium">影响：中</option>
          <option value="large">影响：大</option>
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
          <span className="block font-black text-amber-200">隐藏支线</span>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">隐藏支线不会提前暴露完整内容；玩家需要在游玩中触发后，才会看到这条支线的具体情节。</span>
        </span>
      </label>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <label className="block space-y-2 text-sm font-bold text-zinc-300">
          <span>导向结局绑定</span>
          <select
            value={branchForm.endingId}
            onChange={(event) => setBranchForm((prev) => ({ ...prev, endingId: event.target.value }))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">自动进入该方向的域内默认结局</option>
            {(authoringCartridge?.endings || []).map((ending: any) => (
              <option key={ending.id} value={ending.id}>
                绑定{ending.title || authoringEndingIdToLabel(ending.id)}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">支线可以只影响左/右走向，也可以进一步绑定到某个具体结局。没有绑定时，会自动进入该方向的默认结局。</p>
      </div>
      <textarea value={branchForm.sceneText} onChange={(event) => setBranchForm((prev) => ({ ...prev, sceneText: event.target.value }))} className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500" placeholder="支线情节（300 字以内）" />
      <div className="space-y-3">
        <div className="text-sm font-black text-white">触发条件</div>
        {branchConditions.map((condition, idx) => (
          <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-black text-zinc-500">条件组 {idx + 1}</div>
              {branchConditions.length > 1 && (
                <button type="button" onClick={() => setBranchConditions((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))} className={semanticButtonClass('danger', { compact: true })}>
                  <Trash2 className="h-4 w-4" />
                  删除条件
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <select value={condition.kind} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, kind: event.target.value as 'single' | 'count' } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500">
                <option value="single">单次判定</option>
                <option value="count">累计判定</option>
              </select>
              <select value={condition.kind === 'single' ? condition.singleChapterNum : condition.upToChapterNum} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleChapterNum: Number(event.target.value) } : { ...item, upToChapterNum: Number(event.target.value) }) : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500">
                {chapterOptions.map((chapterNum) => <option key={chapterNum} value={chapterNum}>第{chapterNum}章</option>)}
              </select>
              <select value={condition.kind === 'single' ? condition.singleCharId : condition.countCharId} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleCharId: event.target.value } : { ...item, countCharId: event.target.value }) : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500">
                <option value="">选择角色</option>
                {normalizeCharacters(authoringCartridge?.meta?.characters || []).map((character: any) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
              {condition.kind === 'single' ? (
                <select value={condition.singleAction} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, singleAction: event.target.value as 'bless' | 'curse' } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500">
                  <option value="bless">庇佑</option>
                  <option value="curse">磨难</option>
                </select>
              ) : (
                <input type="number" min={1} value={condition.minCount} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, minCount: Math.max(1, Number(event.target.value) || 1) } : item))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" placeholder="累计次数" />
              )}
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
          新增条件组
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!authoringStoryId || !branchForm.name.trim()) {
              showError('请先填写支线名。');
              return;
            }
            const payload = {
              side: branchForm.side,
              tier: normalizeBranchTier(branchForm.tier),
              is_hidden: branchForm.isHidden,
              endingId: branchForm.endingId || undefined,
              name: branchForm.name,
              hint: branchForm.hint || `留意${branchForm.name}`,
              desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
              common: false,
              trigger: normalizeBranchConditionsForStorage(branchConditions)[0],
              triggerGroups: normalizeBranchConditionsForStorage(branchConditions),
              inject: { mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [], mustReveal: [], mustChange: [], hidden: branchForm.isHidden, endingId: branchForm.endingId || undefined },
              sceneText: branchForm.sceneText,
            } as any;
            if (isNew) {
              const newId = await createStoryBranch(db as any, authoringStoryId, payload);
              await selectAuthoringStory(authoringStoryId);
              setExpandedBranchId(null);
              showError('支线已创建。');
            } else {
              await upsertStoryBranch(db as any, authoringStoryId, branchForm.id, payload);
              await selectAuthoringStory(authoringStoryId);
              setExpandedBranchId(null);
              showError('支线已保存。');
            }
          }}
          className={semanticButtonClass('primary', { compact: true })}
        >
          {isNew ? '创建支线' : '保存修改'}
        </button>
      </div>
    </div>
  );

  const renderAuthoringView = () => (
    <div className="mx-auto max-w-5xl px-6 pb-12 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
      {!authoringCartridge ? (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <BackNavButton label="返回上一页" onClick={() => goBack('STORY_SELECT')} />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => handleCreateAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('secondary', { compact: true })}>
                <Sparkles className="h-4 w-4" />
                新建作品
              </button>
              <button type="button" onClick={() => refreshStories({ force: true })} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
                <RefreshCcw className="h-4 w-4" />
                刷新列表
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8">
            <div className="mb-6 text-2xl font-black text-white">我的作品</div>
            {myStories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
                还没有作品，点击“新建作品”开始创作。
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myStories.map((story: any) => (
                  <button
                    key={story.id}
                    type="button"
                    disabled={authoringLoadingStoryId === story.id}
                    onClick={async () => {
                      setAuthoringLoadingStoryId(story.id);
                      await selectAuthoringStory(story.id);
                      setAuthoringLoadingStoryId(null);
                    }}
                    className={`relative overflow-hidden flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-left transition-all hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:shadow-xl active:scale-[0.98] ${authoringLoadingStoryId === story.id ? 'opacity-70 pointer-events-none' : ''}`}
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
                      {story.visibility === 'public' ? '公开' : story.visibility === 'unlisted' ? '非公开链接' : '私人'}
                    </span>
                    <div className="pr-24">
                      <div className="line-clamp-3 text-lg font-black text-white leading-tight">{formatBookTitle(getStoryTitle(story))}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <BackNavButton
              label="返回列表"
              onClick={() => {
                if (authoringDirty) {
                  setConfirmationModal({
                    isOpen: true,
                    title: '放弃未保存的更改',
                    message: '退出编辑模式将丢失当前未保存的内容，确定要离开吗？',
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
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => handleDeleteAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('danger', { compact: true })}>
                <Trash2 className="h-4 w-4" />
                删除作品
              </button>
              <button type="button" onClick={handleSaveAuthoringChanges} disabled={authoringSaving} className={semanticButtonClass('primary', { compact: true })}>
                {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                保存更改
              </button>
            </div>
          </div>

          <div className="mb-6 flex gap-1 overflow-x-auto whitespace-nowrap rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1">
            <button type="button" onClick={() => setAuthoringTab('settings')} className={`flex-1 flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] sm:text-[11px] font-black transition-colors ${authoringTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
              <Copy className="mb-1 h-4 w-4 shrink-0" />作品设置
            </button>
            <button type="button" onClick={() => setAuthoringTab('mainline')} className={`flex-1 flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] sm:text-[11px] font-black transition-colors ${authoringTab === 'mainline' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
              <BookOpen className="mb-1 h-4 w-4 shrink-0" />主线和结局
            </button>
            <button type="button" onClick={() => setAuthoringTab('branches')} className={`flex-1 flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] sm:text-[11px] font-black transition-colors ${authoringTab === 'branches' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
              <Sparkles className="mb-1 h-4 w-4 shrink-0" />角色和支线
            </button>
          </div>

          <div className="fixed bottom-8 left-8 z-[1700]">
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
              aria-label="查找 / 替换"
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
                  上一个
                </button>
                <button type="button" onClick={() => moveAuthoringFindMatch(1)} className={semanticButtonClass('ghost', { compact: true, fullWidth: true })}>
                  下一个
                </button>
                <button
                  type="button"
                  onClick={replaceCurrentAuthoringMatch}
                  disabled={!authoringFindQuery}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 transition-all hover:border-amber-300 hover:bg-amber-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  替换
                </button>
                <div className="px-1 text-center text-[10px] font-bold text-zinc-500">
                  点击左下角 X 返回设置
                </div>
              </div>
            )}
            {authoringFindReplaceOpen && (
              <div className="absolute bottom-16 left-0 grid max-h-[min(76dvh,680px)] w-[min(92vw,44rem)] gap-3 overflow-y-auto rounded-[1.75rem] border border-indigo-500/30 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">查找 / 替换</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">可指定章节、结局或角色范围，避免误改其他段落。</p>
                  </div>
                  <button type="button" onClick={() => setAuthoringFindReplaceOpen(false)} className={semanticIconButtonClass('ghost')}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-bold text-zinc-400">
                    <span>查找文字</span>
                    <input
                      value={authoringFindQuery}
                      onChange={(event) => setAuthoringFindQuery(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="输入要查找的文字"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-zinc-400">
                    <span>替换成</span>
                    <input
                      value={authoringReplaceQuery}
                      onChange={(event) => setAuthoringReplaceQuery(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="留空则删除查找文字"
                    />
                  </label>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['chapters', '章节'],
                      ['endings', '结局'],
                      ['characters', '角色'],
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
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">章节范围</div>
                        <button
                          type="button"
                          onClick={() => setAuthoringFindChapterNums((authoringCartridge.chapters || []).map((chapter: any) => Number(chapter.chapter_num)).filter((chapterNum: number) => Number.isFinite(chapterNum)))}
                          className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                        >
                          全选章节
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
                              第{chapterNum}章
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {authoringFindScope.endings && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">结局范围</div>
                        <button
                          type="button"
                          onClick={() => setAuthoringFindEndingIds((authoringCartridge.endings || []).map((ending: any) => String(ending.id || '')).filter(Boolean))}
                          className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                        >
                          全选结局
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
                    查找
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
                    全部替换
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthoringFindQuery('');
                      setAuthoringReplaceQuery('');
                    }}
                    className={semanticButtonClass('ghost', { compact: true })}
                  >
                    清空
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-6 sm:p-8">
            <div className="space-y-8">
              {authoringTab === 'settings' && (
                <section className="space-y-4">

                  <div className="border-t border-zinc-800 pt-6">
                    <h3 className="text-xl font-black text-white">作品设置</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">正式作品可选择私人、非公开链接或公开；保存区记录不会出现在这里。</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-zinc-400">
                      <div>作品标题</div>
                      <input
                        value={stripBookTitle(authoringCartridge.meta?.title || '')}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, title: event.target.value } }))}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-400">
                      <div>标签（以中文逗号分隔）</div>
                      <input
                        value={authoringCustomTagsInput}
                        onChange={(event) => setAuthoringCustomTagsInput(event.target.value)}
                        placeholder="在此手动输入标签或点击下方快速添加"
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
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row">
                      <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950">
                        {authoringCartridge.meta?.coverUrl ? (
                          <img src={authoringCartridge.meta.coverUrl} alt="作品封面预览" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                            NO COVER
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <h4 className="text-lg font-black text-white">作品封面</h4>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">用于作品卡和分享预览，建议 1:1。</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className={`${semanticButtonClass('secondary', { compact: true })} cursor-pointer`}>
                            <BookOpen className="h-4 w-4" />
                            上传封面
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
                              移除封面
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
                          placeholder="描述你想要的封面画面..."
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                        />
                        <button type="button" onClick={handleGenerateAuthoringCover} disabled={isGeneratingCover} className={semanticButtonClass('primary', { compact: true })}>
                          {isGeneratingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          AI 生成
                        </button>
                      </div>
                    )}
                  </section>
                  <label className="block space-y-2 text-sm text-zinc-400">
                    <div>故事主轴</div>
                    <textarea
                      value={authoringCartridge.meta?.main_axis || ''}
                      onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, main_axis: event.target.value } }))}
                      className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="mb-3 text-sm font-black text-zinc-100">结局结构</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        {
                          value: 'single',
                          label: '单一结局',
                          hint: '所有干涉都需要自然收束到同一个默认结局，适合宿命感或强主线作品。',
                        },
                        {
                          value: 'dual',
                          label: '多线结局',
                          hint: '使用默认、左向、右向三类收束，每一类都可以继续扩展具体结局。',
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
                    <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                      <div className="text-sm font-black text-zinc-100">故事倾向</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">设置作品本身比较容易走向哪一种收束。读者只会感受到故事倾向，不会看到这些后台设定。</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {([
                          { key: 'leftBaseWeight', label: '左向结局' },
                          { key: 'rightBaseWeight', label: '右向结局' },
                        ] as const).map((option) => {
                          const bias = normalizeEndingBias(authoringCartridge.meta?.endingBias || authoringCartridge.meta?.endingRates);
                          return (
                            <label key={option.key} className="block space-y-2 text-xs font-bold text-zinc-400">
                              <span>{option.label}</span>
                              <select
                                value={nearestEndingBiasPreset(bias[option.key])}
                                onChange={(event) => {
                                  const raw = Number(event.target.value) || 1;
                                  setAuthoringCartridge((prev: any) => {
                                    const prevBias = normalizeEndingBias(prev.meta?.endingBias || prev.meta?.endingRates);
                                    return { ...prev, meta: { ...prev.meta, endingBias: { ...prevBias, [option.key]: raw } } };
                                  });
                                }}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                              >
                                {endingBiasPresets.map((preset) => (
                                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">如果不确定，保持两边相同即可；支线与玩家干涉会继续影响故事最终走向。</p>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="mb-3 text-sm font-black text-zinc-100">作品可见性</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        { value: 'private', label: '私人', hint: '只有作者自己可见。' },
                        { value: 'unlisted', label: '非公开链接', hint: '不进公开列表，但链接可读。' },
                        { value: 'public', label: '公开', hint: '会出现在公开作品库。' },
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
                      <span className="block font-black text-zinc-100">开放一键改编权限</span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-500">开启后，其他已登录用户可以把这篇作品改编成自己的私人作品。</span>
                    </span>
                  </label>
                  
                  <div className="border-t border-zinc-800 pt-6">
                    <h3 className="text-xl font-black text-white">一键导入</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">支持按“主线设置 / 支线设置”范本格式自动解析并写入当前作品。</p>
                  </div>
                  <textarea
                    value={authoringImportText}
                    onChange={(event) => setAuthoringImportText(event.target.value)}
                    placeholder="把其他 AI 生成的完整文本粘贴到这里..."
                    className="authoring-resizable-textarea min-h-[320px] w-full resize-y rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300 outline-none transition-colors focus:border-indigo-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={authoringImportReplaceBranches}
                      onChange={(event) => setAuthoringImportReplaceBranches(event.target.checked)}
                    />
                    导入时尝试覆盖支线结构
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button type="button" onClick={handleAuthoringImport} className={semanticButtonClass('primary', { fullWidth: true })}>
                      <Copy className="h-4 w-4" />
                      解析并导入
                    </button>
                    <button type="button" onClick={() => {
                        const template = `# 主线设置\n## 标题\n作品名称\n\n## 主轴\n一句话描述故事核心冲突\n\n## 主要角色\n### 角色1\n- 名字: 角色名A\n- 简介: 角色A的简介\n\n### 角色2\n- 名字: 角色名B\n- 简介: 角色B的简介\n\n## 默认故事\n### 第 1 章 标题一\n第一章大纲或正文\n\n### 第 2 章 标题二\n第二章大纲或正文\n\n## 结局设置\n### 默认结局\n默认结局正文\n### 左向默认结局\n左向默认结局正文\n### 右向默认结局\n右向默认结局正文\n\n# 支线设置\n## 支线1\n- 支线名: 支线名称\n- 倾向: 左倾\n- 影响: 中\n- 隐藏: 否\n- 导向结局: 左向默认结局\n- 提示短句: 留意这里的变化\n- 支线情节: 这里写支线发生时的具体剧情\n- 条件组1: 第 2 章 角色名A 庇佑`;
                        navigator.clipboard.writeText(template);
                        showError('蓝本格式已复制到剪贴板！');
                    }} className={semanticButtonClass('secondary', { fullWidth: true })}>
                      <Copy className="h-4 w-4" />
                      拷贝蓝本格式
                    </button>
                  </div>
                </section>
              )}

              {authoringTab === 'mainline' && (
                <div className="relative">
                  {authoringTocOpen && (
                    <div className="fixed inset-0 z-[99]" onClick={() => setAuthoringTocOpen(false)} />
                  )}
                  <div className={`fixed bottom-40 left-8 z-[1600] max-h-[min(52dvh,26rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-2xl backdrop-blur-md transition-all ${authoringTocOpen ? 'flex' : 'hidden'}`}>
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
                    className="fixed bottom-24 left-8 z-[1601] flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 active:scale-95"
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
                      你可以先编辑“默认 / 左向默认 / 右向默认”三个结局原型。每一类收束都可承载更多具体结局，并可由支线绑定来决定最终收束；已设置的支线倾向会继续沿用。
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
                                  {domain === 'middle' ? '故事没有明显偏向左右时，会回到默认收束；可设置多个平衡/余韵型结局。' : `故事偏向${endingDomainTitle(domain)}后，会根据已触发支线绑定选择具体结局。`}
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
                                <span>{branch.side === 'left' ? '左倾' : '右倾'} / 影响：{branchTierLabel(branch.tier)}</span>
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
                                  setBranchConditions((branch.triggerGroups && branch.triggerGroups.length > 0)
                                    ? branch.triggerGroups.map((group: any) => group.type === 'count'
                                      ? {
                                          kind: 'count',
                                          singleChapterNum: 2,
                                          singleCharId: '',
                                          singleAction: 'bless',
                                          countCharId: group.count?.charId || '',
                                          countAction: group.count?.action || 'bless',
                                          minCount: group.count?.minCount || 1,
                                          upToChapterNum: group.count?.upToChapterNum || 6,
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
            className="grid w-full max-w-md gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white">时空菜单</h3>
              <button
                onClick={() => setIsActionMenuOpen(false)}
                className={semanticIconButtonClass('ghost')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[min(72vh,34rem)] gap-5 overflow-y-auto pr-1">
              <section className="grid gap-2">
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">阅读与资料</div>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    setIsStoryInfoOpen(true);
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <BookOpen className="h-5 w-5" />
                  故事信息
                </button>
                <button
                  onClick={() => openArchiveView('PLAYING')}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <Archive className="h-5 w-5" />
                  命运收藏馆
                </button>
              </section>
              {gameState === 'PLAYING' && (
                <>
                  <section className="grid gap-2">
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">作品互动</div>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('like'); }} className={semanticMenuButtonClass('ghost')}>
                      <Heart className={`h-5 w-5 ${hasOptimisticStoryAction('like', activeStoryId) ? 'fill-current text-pink-300' : ''}`} /> 点赞
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); handleStoryInteraction('favorite'); }} className={semanticMenuButtonClass('ghost')}>
                      <Bookmark className={`h-5 w-5 ${hasOptimisticStoryAction('favorite', activeStoryId) ? 'fill-current text-amber-300' : ''}`} /> 收藏
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
                      分享故事
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); handleSaveWorkAndReturn(); }} className={semanticMenuButtonClass('ghost')}>
                      <Archive className="h-5 w-5" /> 保存当前故事
                    </button>
                  </section>
                  <section className="grid gap-2">
                    <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">创作与重开</div>
                    {!activeStoryId && (
                      <button onClick={() => { setIsActionMenuOpen(false); handleRegenerateQuickStory(); }} className={semanticMenuButtonClass('ghost')}>
                        <RefreshCcw className="h-5 w-5" /> 重新生成
                      </button>
                    )}
                    <button onClick={() => { setIsActionMenuOpen(false); handleAdaptCurrentStory(); }} disabled={!canAdaptCurrentStory() || isLoadingStories} className={semanticMenuButtonClass('secondary')}>
                      <Wand2 className="h-5 w-5" /> {activeStoryMeta?.authorId === user?.uid ? '改变命运' : '创作同人'}
                    </button>
                    <button onClick={() => { setIsActionMenuOpen(false); restartCurrentStory(); }} className={semanticMenuButtonClass('ghost')}>
                      <RefreshCcw className="h-5 w-5" /> 重新干涉
                    </button>
                  </section>
                </>
              )}
              <section className="grid gap-2">
                <div className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">离开</div>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    resetToHome();
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <LogIn className="h-5 w-5" />
                  退出游玩
                </button>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAuthView = () => (
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
    />
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
          className={`fixed right-4 z-[1800] flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/90 text-zinc-200 shadow-2xl backdrop-blur-xl transition-colors hover:border-indigo-400 hover:text-white sm:right-6 ${
            gameState === 'PLAYING'
              ? 'bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:right-[27.5rem]'
              : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
          }`}
          aria-label="返回顶端"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
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
            className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">下载 App</div>
                <h2 className="mt-1 text-xl font-black text-white">添加到手机桌面</h2>
              </div>
              <button type="button" onClick={() => setShowIosInstallModal(false)} className={semanticIconButtonClass('ghost')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
              <p>在 iPhone/iPad：点击浏览器底部的分享按钮，然后选择“添加到主屏幕”。</p>
              <p>在 Android/桌面浏览器：如果没有自动弹出安装窗口，请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</p>
            </div>
            <button type="button" onClick={() => setShowIosInstallModal(false)} className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}>
              明白了
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div data-theme={appTheme} className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <GlobalError errorMsg={errorMsg} />
      {installGuideModal}
      
      {!isSessionHydrated ? (
        <StartupShell message={startupMessage} />
      ) : gameState === 'READONLY_STORY' && readonlyStoryData ? (
        <>
          {renderReadonlyStoryView()}
          {renderScrollToTopButton()}
          {accountEntryButton}
          {accountCenterModal}
        </>
      ) : !user ? (
        renderAuthView()
      ) : isRecoveringInvalidGameState ? (
        <StartupShell message="正在恢复页面状态..." />
      ) : (
        <>
          {gameState === 'STORY_SELECT' && renderStorySelectView()}
          {gameState === 'ARCHIVE' && renderArchiveView()}
          {gameState === 'THEME_SELECTION' && renderThemeSelectionView()}
          {gameState === 'GENERATING_BLUEPRINT' && (
            <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-zinc-950 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="mb-8 h-12 w-12 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-500"
              />
              <h2 className="text-2xl font-black text-white">{generationStatus || '正在生成世界蓝图...'}</h2>
              <GenerationProgressBar />
            </div>
          )}
          {gameState === 'PLAYING' && renderPlayingView()}
          {gameState === 'SUMMARY' && renderSummaryView()}
          {gameState === 'AUTHORING' && renderAuthoringView()}
          {gameState === 'READONLY_STORY' && renderReadonlyStoryView()}

          {gameState === 'PLAYING' && actionMenuButton}
          {renderScrollToTopButton()}
          {accountEntryButton}
          {floatingInterventionPanel}
          {actionMenuOverlay}
          {storyInfoPanel}
          {renderStoryDetailModal()}
          {accountCenterModal}
          {renderConfirmationModal()}
          {renderAuthoringSaveSuccessModal()}
          {renderResumePromptModal()}
          {renderLeaveGameModal()}
          {renderBranchUnlockModal()}
          {renderInterventionStatusNotice()}
          {renderSummaryModal()}
          
          <AnimatePresence>
            {storyLaunchOverlay && (
              <LoadingOverlay
                progress={storyLaunchOverlay.progress}
                status={storyLaunchOverlay.status}
                subtext="正在准备可干涉的故事页面"
              />
            )}
            {activeInterventionOverlay && (
              <LoadingOverlay 
                progress={generationProgress}
                status={generationStatus}
                variant={activeInterventionOverlay.type}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isGlobalBlockingLoading && (
              <BlockingSyncOverlay
                title={globalBlockingLoadingMessage}
                detail="正在处理当前操作，请稍候。"
                zIndexClass="z-[9999]"
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
