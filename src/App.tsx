import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft, Heart, Bookmark, Flag, Settings, PenSquare, Archive, ExternalLink, ArrowUp } from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { createEmptyStory, createSharedStoryRecord, adaptBlueprintToStory, createStoryBranch, deleteStoryBranch, deleteStoryCartridge, getSharedStoryRecord, getStoryCartridge, listMySharedStories, listMyStories, listPublicStories, saveStoryMainlineBundle, saveStoryMeta, updateAuthorNameEverywhere, updateSharedStoryVisibility, upsertStoryBranch } from './storyStore';
import { isBranchUnlockedByHistory, tierToScore } from './storyCartridge';
import { 
  signInWithRedirect,
  signInWithPopup,
  linkWithPopup,
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
  updateDoc, 
  runTransaction,
  collection, 
  addDoc, 
  increment,
  serverTimestamp,
  onSnapshot,
  deleteField
} from 'firebase/firestore';

// --- Types ---
type GameState = 'STORY_SELECT' | 'AUTHORING' | 'THEME_SELECTION' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY' | 'READONLY_STORY' | 'ARCHIVE';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

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
  left_mainline_default: number; // e.g., 80
  right_mainline_default: number; // e.g., 40
  characters: Character[];
  chapters: Chapter[];
  endings: Ending[];
  branches: Branch[];
  endingMode?: 'dual' | 'single';
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
const endingIdToLabel = (id: 'default' | 'left' | 'right') => {
  if (id === 'left') return '左结局';
  if (id === 'right') return '右结局';
  return '默认结局';
};

const buildSharedStoryUrl = (storyId: string) =>
  `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(storyId)}`;

const getSharedStoryIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('share') || urlParams.get('story');
};

const buildStoryShareText = (title?: string) => {
  const safeTitle = stripBookTitle(title || '未命名故事');
  return `我在命运干涉里记录了《${safeTitle}》的时间线，来看看这篇故事会将你带到哪个结局。`;
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

const semanticButtonClass = (
  variant: 'primary' | 'secondary' | 'danger' | 'ghost',
  options?: { fullWidth?: boolean; compact?: boolean }
) => {
  const base = `inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:pointer-events-none disabled:opacity-50 ${
    options?.compact ? 'px-3 py-2 text-xs font-bold' : 'px-4 py-3 text-sm font-bold'
  } ${options?.fullWidth ? 'w-full' : ''}`;
  const variants = {
    primary: 'bg-white text-black shadow-lg hover:bg-zinc-200 hover:shadow-xl',
    secondary: 'bg-zinc-900 border border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800/90',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-950/30',
    ghost: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white',
  };
  return `${base} ${variants[variant]}`;
};

const semanticIconButtonClass = (variant: 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    secondary: 'border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:border-zinc-500 hover:text-white',
    danger: 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-400/60',
    ghost: 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white',
  };
  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${variants[variant]}`;
};

const semanticMenuButtonClass = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    primary: 'text-indigo-100 hover:bg-indigo-950/60',
    secondary: 'text-emerald-100 hover:bg-emerald-950/60',
    danger: 'text-rose-100 hover:bg-rose-950/60',
    ghost: 'text-zinc-100 hover:bg-zinc-900',
  };
  return `flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-all duration-150 hover:translate-x-1 active:translate-x-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]}`;
};

const BackNavButton = ({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[2300] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 shadow-xl backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 sm:left-6 ${className}`}
  >
    <ChevronLeft className="h-5 w-5" />
    <span className="sr-only">{label}</span>
  </button>
);

const renderParagraphWithHighlights = (text: string, characters: Character[] = []) => {
  const parts = text.split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <span key={i} className="text-amber-400 font-bold bg-amber-400/10 px-1 rounded">{part.slice(6, -7)}</span>;
    }
    
    if (characters.length > 0) {
      const names = characters.map(c => c.name).filter(Boolean);
      if (names.length > 0) {
        names.sort((a, b) => b.length - a.length);
        const regex = new RegExp(`(${names.join('|')})`, 'g');
        const subParts = part.split(regex);
        return (
          <span key={i}>
            {subParts.map((subPart, j) => {
              if (names.includes(subPart)) {
                return <span key={j} className="text-indigo-300 font-medium">{subPart}</span>;
              }
              return <span key={j}>{subPart}</span>;
            })}
          </span>
        );
      }
    }
    
    return <span key={i}>{part}</span>;
  });
};

const GlobalError = ({ errorMsg }: { errorMsg: string | null }) => (
  <AnimatePresence>
    {errorMsg && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        role="alert"
        aria-live="assertive"
        className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[6100] -translate-x-1/2 rounded-lg bg-rose-500 px-6 py-3 font-medium text-white shadow-lg"
      >
        {errorMsg}
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

const SimulatedProgressBar = () => {
  const [width, setWidth] = useState("0%");
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTimeout(() => setWidth("85%"), 50);
    });
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setPercent(Math.min(85, Math.round((elapsed / 6000) * 85)));
    }, 180);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);
  return (
    <div className="mt-6 w-48 sm:w-64">
      <div className="relative h-1.5 overflow-hidden rounded-full border border-white/5 bg-zinc-800/80 shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 transition-all ease-out"
          style={{ width, transitionDuration: '6000ms' }}
        />
      </div>
      <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{percent}%</div>
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
  <div className={`fixed inset-0 z-[6000] backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center transition-colors duration-700 ${
    variant === 'bless' ? 'bg-emerald-950/90' : 
    variant === 'curse' ? 'bg-rose-950/90' : 
    variant === 'ending' ? 'bg-amber-950/90' :
    'bg-zinc-950/90'
  }`}>
    <motion.div 
      animate={{ rotate: variant === 'ending' ? 180 : 360, scale: [1, 1.1, 1] }}
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

const getStoryTitle = (story: any) => story?.meta?.title || story?.title || '未命名故事';
const getStoryMainAxis = (story: any) => story?.meta?.main_axis || story?.main_axis || '';
const getStoryTags = (story: any) => story?.meta?.tags || story?.tags || [];

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

const withAverageChapterWords = (story: any, averageChapterWords: number) => ({
  ...story,
  averageChapterWords: Number(story?.averageChapterWords || 0) > 0 ? story.averageChapterWords : averageChapterWords,
  meta: story?.meta
    ? {
        ...story.meta,
        averageChapterWords: Number(story?.meta?.averageChapterWords || 0) > 0 ? story.meta.averageChapterWords : averageChapterWords,
      }
    : story?.meta,
});

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
  tier: 'small' | 'medium' | 'large' | 'hidden';
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

function parseTier(raw: string): 'small' | 'medium' | 'large' | 'hidden' {
  if (/hidden|隐/.test(raw)) return 'hidden';
  if (/large|大/.test(raw)) return 'large';
  if (/medium|中/.test(raw)) return 'medium';
  return 'small';
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
    const tier = parseTier(pickLabeledText(block, ['影响']));
    const hint = pickLabeledText(block, ['提示短句']) || `留意${name}`;
    const common = /true|是|1/.test(pickLabeledText(block, ['通用支线']).toLowerCase());
    const sceneText = extractSection(block, /-\s*支线情节\s*[：:]\s*/i, /\n-\s*(触发后剧情改变|支线名|倾向|影响|提示短句|通用支线|触发条件组)/i).trim().slice(0, 300);
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
  const [gameState, setGameState] = useState<GameState>('STORY_SELECT');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [customOutline, setCustomOutline] = useState<string>('');
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallModal, setShowIosInstallModal] = useState<boolean>(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
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
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'private' | 'public'>('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Record<string, boolean>>({});
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [readonlyReturnTarget, setReadonlyReturnTarget] = useState<GameState>('STORY_SELECT');
  const [archiveReturnTarget, setArchiveReturnTarget] = useState<GameState>('STORY_SELECT');
  const [storyLibraryTab, setStoryLibraryTab] = useState<'mine' | 'public'>('public');
  const [storyLibrarySearch, setStoryLibrarySearch] = useState('');
  const [storyLibraryVisibilityFilter, setStoryLibraryVisibilityFilter] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
  const [storyLibrarySort, setStoryLibrarySort] = useState<'updated' | 'likes' | 'interventions' | 'favorites' | 'words'>('updated');
  const storySelectScrollYRef = useRef(0);
  const [storyImportCode, setStoryImportCode] = useState('');
  const [authoringCustomTagsInput, setAuthoringCustomTagsInput] = useState('');
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [authoringStoryId, setAuthoringStoryId] = useState<string | null>(null);
  const [authoringCartridge, setAuthoringCartridge] = useState<any | null>(null);
  const [authoringSaving, setAuthoringSaving] = useState(false);
  const [authoringImportText, setAuthoringImportText] = useState('');
  const [authoringImportReplaceBranches, setAuthoringImportReplaceBranches] = useState(true);
  const [authoringTab, setAuthoringTab] = useState<'play' | 'mainline' | 'branches'>('play');
  const [branchForm, setBranchForm] = useState({
    id: '',
    name: '',
    side: 'left' as 'left' | 'right',
    tier: 'small' as 'small' | 'medium' | 'large' | 'hidden',
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
  const [interventionHistory, setInterventionHistory] = useState<Array<{ chapterNum: number; charId: string; action: 'bless' | 'curse' }>>([]);

  // World State system
  const [canonicalWorldState, setCanonicalWorldState] = useState<any>(null);
  const [deltaWorldStateByChapter, setDeltaWorldStateByChapter] = useState<Record<string, any>>({});

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
      const data = await response.json();
      return data?.error || `请求失败（${response.status}）`;
    } catch {
      return await response.text() || `请求失败（${response.status}）`;
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

  const apiFetch = async (url: string, init: RequestInit = {}, ms = 30000) => {
    const headers = await getAuthHeaders(init.headers);
    return fetchWithTimeout(url, { ...init, headers }, ms);
  };

  const scrollToChapter = (chapterNum: number) => {
    window.setTimeout(() => {
      const target = document.getElementById(`chapter-${chapterNum}`);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 80);
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
        visibility: cartridge.meta?.visibility || 'private',
        tags: normalizeTagList(cartridge.meta?.tags || []),
        endingMode: cartridge.meta?.endingMode || 'dual',
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
        tier: branch.tier || 'small',
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
    if (!user || !activeStoryId || !db) return;
    try {
      setAuthoringSaving(true);
      const sessionRef = doc(db, 'sessions', user.uid);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const progressRef = doc(db, 'users', user.uid, 'progress', activeStoryId);
        await setDoc(progressRef, {
          ...sessionSnap.data(),
          userId: user.uid,
          updatedAt: serverTimestamp()
        });
      }
      await resetGame();
      setShowLeaveGameModal(false);
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
    } finally {
      setAuthoringSaving(false);
    }
  };

  const handleSaveWorkAndReturnLegacy = async () => {
    if (!user || !blueprint) return;
    try {
      setAuthoringSaving(true);
      const sourceChapters = naturalChapters.length > 0 ? naturalChapters : chapters;
      await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint.title,
        main_axis: blueprint.main_axis,
        tags: selectedThemes,
        characters: blueprint.characters,
        chapters: sourceChapters as any,
        averageChapterWords: getAverageChapterWords(sourceChapters),
        sourceStoryId: activeStoryId,
        visibility: 'private',
      });
      await resetGame();
      setShowLeaveGameModal(false);
    } catch (e) {
      console.error(e);
      showError("保存作品失败");
    } finally {
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
      console.error(error);
    }
  };

  const hydrateMissingAverageWords = async (stories: any[]) => {
    const hydrated = await Promise.all((stories || []).map(async (story) => {
      if (getStoryAverageChapterWords(story) > 0 || !story?.id || !db) return story;
      try {
        const cartridge = await getStoryCartridge(db as any, story.id);
        const averageChapterWords = getAverageChapterWords(cartridge?.chapters as any);
        return averageChapterWords > 0 ? withAverageChapterWords(story, averageChapterWords) : story;
      } catch (error) {
        console.error(error);
        return story;
      }
    }));
    return hydrated;
  };

  const refreshStories = async () => {
    if (!user || !db) return;
    setIsLoadingStories(true);
    try {
      const [pub, mine, shared] = await withTimeout(
        Promise.all([
          listPublicStories(db as any, 30),
          listMyStories(db as any, user.uid, 50),
          listMySharedStories(db as any, user.uid, 50),
        ]),
        10000,
        "连接作品档案超时，请稍后重试。"
      );
      const [pubWithAverages, mineWithAverages] = await Promise.all([
        hydrateMissingAverageWords(pub),
        hydrateMissingAverageWords(mine),
      ]);
      setPublicStories(pubWithAverages);
      setMyStories(mineWithAverages);
      setMySharedStories(shared);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '作品库加载失败。');
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
      const record = await getSharedStoryRecord(db as any, storyId, user?.uid);
      if (!record) {
        showError('未找到这份故事记录，或你没有访问权限。');
        return;
      }
      setReadonlyStoryData({ meta: record.meta, chapters: record.chapters as any });
      setReadonlyCanGoBack(Boolean(options?.allowBack));
      setReadonlyReturnTarget(options?.returnTarget || 'STORY_SELECT');
      setGameState('READONLY_STORY');
      const nextUrl = buildSharedStoryUrl(storyId);
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
    setGameState(readonlyCanGoBack ? readonlyReturnTarget : 'STORY_SELECT');
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
      };
      const resetArtstyleChapters = toDefaultArtstyleChapters(readonlyStoryData.chapters);
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        blueprint,
        chapters: resetArtstyleChapters,
        tags: readonlyStoryData.meta.tags || [],
      });
      await refreshStories();
      showError('已完成一键改编，并重置为默认文面风格。');
      setReadonlyStoryData(null);
      setReadonlyCanGoBack(false);
      window.history.replaceState({}, '', window.location.pathname);
      await startStoryPlay(storyId);
    } catch (error) {
      console.error(error);
      showError('一键改编失败，请稍后再试。');
    } finally {
      setIsLoadingStories(false);
    }
  };

  const handleArchiveVisibilityChange = async (story: any, visibility: 'public' | 'private') => {
    if (!db || !user || !story?.id) return;
    try {
      setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: true }));
      await updateSharedStoryVisibility(db as any, story.id, {
        authorId: user.uid,
        visibility,
      });
      setMySharedStories((prev) =>
        prev.map((item) => (item.id === story.id ? { ...item, visibility } : item))
      );
    } catch (error) {
      console.error(error);
      showError('更新公开设置失败，请稍后再试。');
    } finally {
      setArchiveUpdatingIds((prev) => ({ ...prev, [story.id]: false }));
    }
  };

  const openArchiveView = (returnTarget: GameState = gameState === 'PLAYING' ? 'PLAYING' : 'STORY_SELECT') => {
    setArchiveReturnTarget(returnTarget);
    setIsActionMenuOpen(false);
    setIsAccountCenterOpen(false);
    setGameState('ARCHIVE');
  };

  const leaveArchiveView = () => {
    setGameState(archiveReturnTarget);
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
        const result = await linkWithPopup(currentUser, provider);
        await syncCurrentAuthorName(result.user);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showError('Google 登录窗口已关闭，请重新操作。');
        return;
      }
      if (code.includes('popup') || code.includes('blocked')) {
        await signInWithRedirect(auth, provider);
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

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      setIsSessionHydrated(true);
      return;
    }
    getRedirectResult(auth).catch((error) => {
      console.error(error);
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
    setProfileDisplayName(getUserAuthorName(user));
  }, [user]);

  useEffect(() => {
    if (!authoringCartridge) return;
    setAuthoringDirty(buildAuthoringSnapshot(authoringCartridge) !== authoringSavedSnapshot);
  }, [authoringCartridge, authoringSavedSnapshot]);

  // Sync session from Firestore
  useEffect(() => {
    if (!isAuthReady) return;
    if (!user || !db) {
      setIsSessionHydrated(true);
      return;
    }

    setIsSessionHydrated(false);
    setStartupMessage('正在同步命运记录...');

    let cancelled = false;
    const sessionRef = doc(db, 'sessions', user.uid);
    const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
      if (cancelled) return;

      if (!snapshot.exists()) {
        setSessionId(user.uid);
        setIsSessionHydrated(true);
        return;
      }

      const data = snapshot.data();
      const gs = data.gameState === 'SUMMARY'
        ? 'PLAYING'
        : data.gameState;

      setGameState(gs);
      setSelectedThemes(data.selectedThemes || []);
      setChapters(data.currentChapters || []);
      setInterventionsLeft(data.interventionsLeft ?? 3);
      setEndingValue(data.endingValue || 0);
      setUnlockedBranches(data.unlockedBranches || []);
      setIntervenedChapters(data.intervenedChapters || []);
      setNaturalChapters(data.naturalChapters || []);
      setInitialNaturalChapters(data.initialNaturalChapters || []);
      setCharacterStatuses(data.characterStatuses || {});
      setStoryConclusion(data.storyConclusion || null);
      setActiveStoryId(data.storyId || null);
      setActiveStoryMeta(null);
      setInterventionHistory(data.interventionHistory || []);
      setCanonicalWorldState(data.canonicalWorldState || null);
      setDeltaWorldStateByChapter(data.deltaWorldStateByChapter || {});
      setSessionId(user.uid);

      if (data.uiFeedback) {
        setUiFeedback(data.uiFeedback);
      }

      let nextBlueprint: Blueprint | null = null;

      if (data.blueprintId) {
        setStartupMessage('正在整理作品档案...');
        const bpSnap = await getDoc(doc(db, 'blueprints', data.blueprintId));
        if (cancelled) return;
        if (bpSnap.exists()) {
          nextBlueprint = bpSnap.data() as Blueprint;
        }
      }

      if (data.storyId) {
        setStartupMessage('正在恢复上次旅程...');
        let cartridge: any = null;
        try {
          cartridge = await getStoryCartridge(db as any, data.storyId);
        } catch (error) {
          console.error(error);
          showError('恢复故事失败，请从作品库重新打开。');
          setGameState('STORY_SELECT');
          setIsSessionHydrated(true);
          return;
        }
        if (cancelled) return;
        if (cartridge) {
          setActiveStoryMeta(cartridge.meta);
          nextBlueprint = {
            title: cartridge.meta.title,
            main_axis: cartridge.meta.main_axis,
            left_mainline_default: 80,
            right_mainline_default: 40,
            endingMode: cartridge.meta.endingMode,
            endingNames: cartridge.meta.endingNames,
            characters: cartridge.meta.characters,
            chapters: cartridge.chapters.map((c: any) => ({
              chapter_num: c.chapter_num,
              title: c.title,
              summary: c.summary,
              present_characters: c.present_characters,
              text: c.text,
            })),
            endings: [
              { type: 'normal', title: (cartridge.endings.find((e: any) => e.id === 'default')?.title || '第七章'), text: (cartridge.endings.find((e: any) => e.id === 'default')?.text || '') },
              { type: 'good', title: (cartridge.endings.find((e: any) => e.id === 'left')?.title || '左结局'), text: (cartridge.endings.find((e: any) => e.id === 'left')?.text || '') },
              { type: 'bad', title: (cartridge.endings.find((e: any) => e.id === 'right')?.title || '右结局'), text: (cartridge.endings.find((e: any) => e.id === 'right')?.text || '') },
            ],
            tags: cartridge.meta.tags || [],
            branches: cartridge.branches.map((b: any) => {
              const cond = b.trigger?.type === 'single' ? b.trigger.single : { chapterNum: 2, charId: cartridge.meta.characters[0]?.id || 'c1', action: 'bless' as const };
              return {
                id: b.id,
                name: b.name,
                score: tierToScore(b.tier),
                side: b.side,
                condition_char: cond.charId,
                condition_action: cond.action,
                condition_chapter: cond.chapterNum,
                desc: b.desc,
                is_hidden: b.tier === 'hidden',
                hint: b.hint,
                trigger: b.trigger,
                triggerGroups: b.triggerGroups,
                tier: b.tier,
                inject: b.inject,
                sceneText: b.sceneText,
              } as any;
            }),
          };
        }
      } else {
        setActiveStoryMeta(null);
      }

      if (nextBlueprint) {
        setBlueprint(nextBlueprint);
        setStartupMessage('正在重构命运织机...');
      }

      setIsSessionHydrated(true);
    }, (error) => {
      if (cancelled) return;
      console.error(error);
      setIsSessionHydrated(true);
      setGameState('STORY_SELECT');
      showError('同步会话失败，请检查 Firebase 权限配置后重试。');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!db || !isAuthReady) return;
    const sharedStoryIdFromUrl = getSharedStoryIdFromUrl();
    if (!sharedStoryIdFromUrl) return;
    getSharedStoryRecord(db as any, sharedStoryIdFromUrl, user?.uid)
      .then((record) => {
        if (!record) throw new Error('not-found');
        setReadonlyStoryData({ meta: record.meta, chapters: record.chapters as any });
        setReadonlyCanGoBack(Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin);
        setGameState('READONLY_STORY');
      })
      .catch(() => {
        showError('加载分享故事失败。');
      });
  }, [db, user, isSessionHydrated]);

  const handleSaveProgressAndReturn = async () => {
    if (!user || !activeStoryId || !blueprint) return;
    try {
      setShowLeaveGameModal(false);
      const progressRef = doc(db, 'users', user.uid, 'progress', activeStoryId);
      await setDoc(progressRef, {
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
        savedAt: serverTimestamp(),
      });
      await resetGame();
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
      setShowLeaveGameModal(false);
    }
  };

  const handleSaveWorkAndReturn = async () => {
    if (!user || !activeStoryId || !blueprint) return;
    try {
      setShowLeaveGameModal(false);
      await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint.title,
        main_axis: blueprint.main_axis,
        tags: selectedThemes,
        characters: blueprint.characters,
        chapters: chapters as any,
        averageChapterWords: getAverageChapterWords(chapters),
        sourceStoryId: activeStoryId,
        visibility: 'private',
      });
      await resetGame();
      showError("作品已保存至个人馆藏（私密）");
    } catch (e) {
      console.error(e);
      showError("保存作品失败");
      setShowLeaveGameModal(false);
    }
  };

  const SimulatedProgressBar = () => {
    const [percent, setPercent] = useState(0);
    useEffect(() => {
      const start = Date.now();
      const interval = setInterval(() => {
        setPercent(Math.min(95, Math.round(((Date.now() - start) / 5000) * 95)));
      }, 180);
      return () => clearInterval(interval);
    }, []);
    return (
      <div className="mt-4 w-full max-w-xs">
        <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full bg-indigo-500"
          />
        </div>
        <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{percent}%</div>
      </div>
    );
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
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const resetGame = async () => {
    if (!user || !db) return;
    try {
      setShowLeaveGameModal(false);
      const shouldRestoreStorySelectScroll = gameState === 'PLAYING';
      setGameState('STORY_SELECT');
      setSelectedThemes([]);
      setBlueprint(null);
      setChapters([]);
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

      const sessionRef = doc(db, 'sessions', user.uid);
      await setDoc(sessionRef, {
        userId: user.uid,
        gameState: 'STORY_SELECT',
        selectedThemes: [],
        blueprintId: deleteField(),
        storyId: deleteField(),
        currentChapters: [],
        interventionsLeft: 3,
        endingValue: 0,
        unlockedBranches: [],
        intervenedChapters: [],
        naturalChapters: [],
        initialNaturalChapters: [],
        characterStatuses: {},
        storyConclusion: null,
        interventionHistory: [],
        canonicalWorldState: null,
        deltaWorldStateByChapter: {},
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
    }
  };

  const buildBlueprintFromCartridge = (cartridge: any): Blueprint => ({
    title: cartridge.meta.title,
    main_axis: cartridge.meta.main_axis,
    left_mainline_default: 80,
    right_mainline_default: 40,
    endingMode: cartridge.meta.endingMode,
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
      { type: 'good', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.title || '左结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'left')?.text || '') },
      { type: 'bad', title: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.title || '右结局'), text: ((cartridge.endings || []).find((ending: any) => ending.id === 'right')?.text || '') },
    ],
    tags: cartridge.meta.tags || [],
    branches: (cartridge.branches || []).map((branch: any) => {
      const condition = branch.trigger?.type === 'single'
        ? branch.trigger.single
        : { chapterNum: 2, charId: cartridge.meta.characters?.[0]?.id || 'c1', action: 'bless' as const };
      return {
        id: branch.id,
        name: branch.name,
        score: tierToScore(branch.tier),
        side: branch.side,
        condition_char: condition.charId,
        condition_action: condition.action,
        condition_chapter: condition.chapterNum,
        desc: branch.desc,
        is_hidden: branch.tier === 'hidden',
        hint: branch.hint,
        trigger: branch.trigger,
        triggerGroups: branch.triggerGroups,
        tier: branch.tier,
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
    setInterventionsLeft(progressData?.interventionsLeft ?? 3);
    setEndingValue(progressData?.endingValue || 0);
    setUnlockedBranches(progressData?.unlockedBranches || []);
    setIntervenedChapters(progressData?.intervenedChapters || []);
    setNaturalChapters(progressData?.naturalChapters || nextBlueprint.chapters);
    setInitialNaturalChapters(progressData?.initialNaturalChapters || nextBlueprint.chapters);
    setCharacterStatuses(progressData?.characterStatuses || initialStatuses);
    setStoryConclusion(progressData?.storyConclusion || null);
    setInterventionHistory(progressData?.interventionHistory || []);
    setCanonicalWorldState(progressData?.canonicalWorldState || null);
    setDeltaWorldStateByChapter(progressData?.deltaWorldStateByChapter || {});
    setUiFeedback(progressData?.uiFeedback || { leftProgress: 0, rightProgress: 0, endingLabel: '均衡道' });
    setGameState('PLAYING');
  };

  const startStoryPlay = async (storyId: string) => {
    if (!user || !db) return;
    try {
      if (gameState === 'STORY_SELECT') {
        storySelectScrollYRef.current = window.scrollY;
      }
      setIsLoadingStories(true);
      const cartridge = await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      
      const progressRef = doc(db, 'users', user.uid, 'progress', storyId);
      const progressSnap = await getDoc(progressRef);
      
      if (progressSnap.exists()) {
        setPendingProgressToLoad({ id: storyId, data: { ...progressSnap.data(), cartridge } });
        return;
      }
      
      await startNewStoryPlay(storyId, cartridge);
    } catch (e) {
      console.error(e);
      showError("无法开启故事");
    } finally {
      setIsLoadingStories(false);
    }
  };

  const startNewStoryPlay = async (storyId: string, loadedCartridge?: any) => {
    if (!user || !db) return;
    try {
      const cartridge = loadedCartridge || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      applyStoryCartridgeForPlay(storyId, cartridge);

      const sessionRef = doc(db, 'sessions', user.uid);
      await setDoc(sessionRef, {
        userId: user.uid,
        gameState: 'PLAYING',
        storyId: storyId,
        selectedThemes: cartridge.meta?.tags || [],
        currentChapters: (cartridge.chapters || []).map((chapter: any) => ({
          chapter_num: chapter.chapter_num,
          title: chapter.title || '',
          summary: chapter.summary || '',
          present_characters: Array.isArray(chapter.present_characters) ? chapter.present_characters : [],
          text: chapter.text || '',
        })),
        interventionsLeft: 3,
        endingValue: 0,
        unlockedBranches: [],
        intervenedChapters: [],
        naturalChapters: (cartridge.chapters || []),
        initialNaturalChapters: (cartridge.chapters || []),
        characterStatuses: {},
        storyConclusion: null,
        interventionHistory: [],
        canonicalWorldState: null,
        deltaWorldStateByChapter: {},
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      showError("初始化故事失败");
    }
  };

  const resumeStoryPlay = async (storyId: string, progressData: any) => {
    if (!user || !db) return;
    try {
      const cartridge = progressData.cartridge || await getStoryCartridge(db as any, storyId);
      if (!cartridge) {
        throw new Error('story-not-found-or-denied');
      }
      applyStoryCartridgeForPlay(storyId, cartridge, progressData);
      const sessionRef = doc(db, 'sessions', user.uid);
      const { cartridge: _cartridge, ...sessionProgress } = progressData;
      await setDoc(sessionRef, {
        ...sessionProgress,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      });
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

    setGameState('GENERATING_BLUEPRINT');
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
      const response = await apiFetch('/api/generate-blueprint', {
        method: 'POST',
        body: JSON.stringify({ selectedThemes, customOutline, targetWordCount }),
      }, 90000);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      let data = await response.json();

      const prefetchChapters = [1, 2, 3];
      for (const chapterNum of prefetchChapters) {
        setGenerationStatus(`正在具象化世界细节 (${chapterNum}/3)...`);
        setGenerationProgress(72 + chapterNum * 7);
        const chapterResponse = await withRetry(() => apiFetch('/api/generate-next-chapter', {
          method: 'POST',
          body: JSON.stringify({
            blueprint: data,
            currentChapters: data.chapters,
            targetChapterNum: chapterNum,
            targetWordCount,
          }),
        }, 90000), 3, 2500);
        if (!chapterResponse.ok) throw new Error(await readErrorMessage(chapterResponse));
        const chapterData = await chapterResponse.json();
        data.chapters = (data.chapters || []).map((chapter: any) => (
          chapter.chapter_num === chapterNum ? { ...chapter, text: chapterData.text || '' } : chapter
        ));
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

      const blueprintRef = await addDoc(collection(db, 'blueprints'), {
        ...data,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });

      const initialStatuses: Record<string, { status: string; isDead: boolean }> = {};
      (data.characters || []).forEach((character: any) => {
        initialStatuses[character.id] = { status: '存活', isDead: false };
      });

      await setDoc(doc(db, 'sessions', user.uid), {
        userId: user.uid,
        blueprintId: blueprintRef.id,
        gameState: 'PLAYING',
        selectedThemes,
        currentChapters: data.chapters || [],
        naturalChapters: data.chapters || [],
        initialNaturalChapters: data.chapters || [],
        interventionsLeft: 3,
        endingValue: 0,
        unlockedBranches: [],
        intervenedChapters: [],
        characterStatuses: initialStatuses,
        storyConclusion: null,
        uiFeedback: { leftProgress: 0, rightProgress: 0, endingLabel: '均衡道' },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setBlueprint(data);
      setChapters(data.chapters || []);
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
      setGameState('PLAYING');
    } catch (error) {
      console.error(error);
      showError('生成失败，请检查网络或稍后重试。');
      setGameState('THEME_SELECTION');
    } finally {
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  const enterAuthoring = async () => {
    setGameState('AUTHORING');
    await refreshStories();
    if (!authoringStoryId && myStories.length > 0 && db) {
      const cartridge = await getStoryCartridge(db as any, myStories[0].id);
      if (cartridge) {
        setAuthoringStoryId(myStories[0].id);
        setAuthoringCartridge(cartridge);
        markAuthoringSaved(cartridge);
      }
    }
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
    setAuthoringTab('mainline');
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
      await refreshStories();
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
      await refreshStories();
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
        tier: branchForm.tier,
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
        },
        sceneText: branchForm.sceneText,
      } as any);
      const latest = await getStoryCartridge(db as any, authoringStoryId);
      setAuthoringCartridge(latest);
      markAuthoringSaved(latest);
      showError('支线已保存。');
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
      await saveStoryMainlineBundle(db as any, authoringStoryId, {
        metaPatch: {
          ...authoringCartridge.meta,
          title: stripBookTitle(authoringCartridge.meta?.title || ''),
          tags: normalizedTags,
          characters: normalizedCharacters,
        } as any,
        chapters: (authoringCartridge.chapters || []).map((chapter: any) => ({
          chapter_num: chapter.chapter_num,
          title: chapter.title || `第${chapter.chapter_num}章`,
          summary: chapter.summary || '',
          present_characters: Array.isArray(chapter.present_characters) && chapter.present_characters.length > 0
            ? chapter.present_characters
            : normalizedCharacters.map((character: any) => character.id),
          text: chapter.text || '',
        })),
        endings: (authoringCartridge.endings || []).map((ending: any) => ({
          id: ending.id,
          title: ending.title || endingIdToLabel(ending.id),
          text: ending.text || '',
        })),
      });
      const latest = await getStoryCartridge(db as any, authoringStoryId);
      setAuthoringCartridge(latest);
      setAuthoringCustomTagsInput(normalizedTags.join('，'));
      markAuthoringSaved(latest);
      await refreshStories();
      showError('作品更改已保存。');
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
      await refreshStories();
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
      setGameState('STORY_SELECT');
    } catch (error: any) {
      console.error(error);
      showError(error?.message || '登出失败，请重试。');
    }
  };

  const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
    if (interventionsLeft <= 0 || isRewriting || !blueprint || !user) return;
    let simulation: ReturnType<typeof setInterval> | null = null;
    
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
          currentUnlockedBranches: unlockedBranches,
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
      setInterventionHistory(newHistory);
      setInterventionsLeft(prev => prev - 1);
      
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
            text: chapter.text || previous.text || '',
          });
        });
        const mergedChapters = (chapters || []).map((chapter) => rewrittenByNum.get(chapter.chapter_num) || chapter);
        rewrittenByNum.forEach((chapter, chapterNum) => {
          if (!previousByNum.has(chapterNum)) {
            mergedChapters.push(chapter);
          }
        });
        mergedChapters.sort((a: any, b: any) => a.chapter_num - b.chapter_num);
        setChapters(mergedChapters as any);
      }

      if (Array.isArray(aiData?.character_updates) && aiData.character_updates.length > 0) {
        setCharacterStatuses((prev) => {
          const next = { ...(prev || {}) } as Record<string, { status: string; isDead: boolean }>;
          aiData.character_updates.forEach((update: any) => {
            if (!update?.id) return;
            next[update.id] = {
              status: String(update.status || next[update.id]?.status || '存活'),
              isDead: Boolean(update.is_dead),
            };
          });
          return next;
        });
      }

      if (typeof result?.newEndingValue === 'number') {
        setEndingValue(result.newEndingValue);
      }
      if (Array.isArray(result?.newUnlockedBranches)) {
        setUnlockedBranches(result.newUnlockedBranches);
      }
      if (result?.unlockedBranch) {
        setBranchUnlockNotice(result.unlockedBranch);
        setHistoricallyUnlockedBranches((prev) => {
          if ((prev || []).some((branch: any) => branch.id === result.unlockedBranch.id)) return prev;
          return [...(prev || []), result.unlockedBranch];
        });
      }
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
      if (nextIntervenedChapters.length >= 3) {
        setPendingSummaryRequest('auto_interventions');
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
    await updateDoc(doc(db, 'stories', storyId), {
      [field]: increment(1),
    } as any);
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
      setGameState('PLAYING');
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
    if (!activeStoryId || !user) return;
    try {
      setIsSharing(true);
      const shareId = await createSharedStoryRecord(db as any, {
        authorId: user.uid,
        authorName: getUserAuthorName(user),
        title: blueprint?.title || "未命名故事",
        main_axis: blueprint?.main_axis || "",
        tags: selectedThemes,
        characters: blueprint?.characters || [],
        chapters: chapters as any,
        averageChapterWords: getAverageChapterWords(chapters),
        sourceStoryId: activeStoryId,
        visibility: 'public',
      });
      setSharedStoryId(shareId);
      const shareUrl = buildSharedStoryUrl(shareId);
      const shareTitle = formatBookTitle(blueprint?.title || "未命名故事");
      const shareText = `${shareTitle}\n${blueprint?.main_axis || '我在这里留下了一份故事记录。'}\n\n${shareUrl}`;
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        showError("已打开系统分享。");
        return;
      }
      const success = await writeClipboardText(shareText);
      if (success) {
        showError("已复制分享链接到剪贴板");
      }
    } catch (e) {
      console.error(e);
      if ((e as any)?.name === 'AbortError') {
        showError('已取消分享。');
        return;
      }
      showError("分享失败");
    } finally {
      setIsSharing(false);
    }
  };

  const handleStoryInteraction = async (kind: 'like' | 'favorite' | 'report') => {
    if (!activeStoryId || !db || !user) return;
    try {
      if (kind === 'like') {
        const storyRef = doc(db, 'stories', activeStoryId);
        const likeRef = doc(db, 'stories', activeStoryId, 'likes', user.uid);
        await runTransaction(db as any, async (transaction: any) => {
          const likeSnap = await transaction.get(likeRef);
          if (likeSnap.exists()) {
            throw new Error('already-liked');
          }
          transaction.set(likeRef, {
            userId: user.uid,
            createdAt: serverTimestamp(),
            createdAtIso: new Date().toISOString(),
          });
          transaction.update(storyRef, {
            likeCount: increment(1),
          });
        });
        showError('已点赞。');
        return;
      }
      if (kind === 'favorite') {
        const storyRef = doc(db, 'stories', activeStoryId);
        const favoriteRef = doc(db, 'stories', activeStoryId, 'favorites', user.uid);
        let alreadyFavorited = false;
        await runTransaction(db as any, async (transaction: any) => {
          const favoriteSnap = await transaction.get(favoriteRef);
          if (favoriteSnap.exists()) {
            alreadyFavorited = true;
            return;
          }
          transaction.set(favoriteRef, {
            userId: user.uid,
            createdAt: serverTimestamp(),
            createdAtIso: new Date().toISOString(),
          });
          transaction.update(storyRef, {
            favoriteCount: increment(1),
          });
        });

        let record = await getSharedStoryRecord(db as any, activeStoryId, user.uid);
        if (!record) {
          const cartridge = await getStoryCartridge(db as any, activeStoryId);
          if (cartridge) {
            record = {
              storyId: activeStoryId,
              meta: {
                ...cartridge.meta,
                sourceStoryId: activeStoryId,
              },
              chapters: cartridge.chapters,
            };
          }
        }
        const archiveSourceStoryId = record?.meta?.sourceStoryId || activeStoryId;
        const alreadyInArchive = mySharedStories.some((story: any) => story.sourceStoryId === archiveSourceStoryId || story.sourceStoryId === activeStoryId);
        if (!alreadyInArchive) {
          if (record) {
            const title = record.meta?.title || '收藏作品';
            const mainAxis = record.meta?.main_axis || '';
            const averageChapterWords = record.meta?.averageChapterWords || getAverageChapterWords(record.chapters as any);
            const archiveId = await createSharedStoryRecord(db as any, {
              authorId: user.uid,
              authorName: getStoryAuthorName(record.meta),
              title,
              main_axis: mainAxis,
              tags: record.meta?.tags || [],
              characters: record.meta?.characters || [],
              chapters: record.chapters as any,
              averageChapterWords,
              sourceStoryId: archiveSourceStoryId,
              visibility: 'private',
            });
            setMySharedStories((prev) => [{
              id: archiveId,
              title,
              main_axis: mainAxis,
              tags: record.meta?.tags || [],
              characters: record.meta?.characters || [],
              chapters: record.chapters,
              authorId: user.uid,
              authorName: getStoryAuthorName(record.meta),
              sourceStoryId: archiveSourceStoryId,
              averageChapterWords,
              visibility: 'private',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, ...prev]);
          }
        }
        showError(alreadyFavorited || alreadyInArchive ? '已在馆藏中。' : '已收藏并加入馆藏。');
        return;
      }
      await updateDoc(doc(db, 'stories', activeStoryId), {
        reportCount: increment(1),
      } as any);
      showError('已收到举报。');
      return;
    } catch (error) {
      if ((error as any)?.message === 'already-liked') {
        showError('你已经点过赞了。');
        return;
      }
      console.error(error);
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
        },
        chapters: authoringCartridge.chapters,
        endings: authoringCartridge.endings,
      });
      setAuthoringSavedSnapshot(JSON.stringify(authoringCartridge));
      setAuthoringDirty(false);
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
        { id: 'left', title: '左结局', text: parsed.endings.left },
        { id: 'right', title: '右结局', text: parsed.endings.right },
      ];

      if (authoringImportReplaceBranches && parsed.branches.length > 0) {
        // Handle branch import logic...
        showError("支线导入逻辑暂未完全实现，已更新主线内容");
      }

      setAuthoringCartridge(nextCartridge);
      setAuthoringImportText('');
      setAuthoringTab('play');
    } catch (e) {
      console.error(e);
      showError("解析导入文本失败");
    }
  };

  useEffect(() => {
    if (gameState === 'STORY_SELECT' && user && db) {
      refreshStories().catch(() => {});
    }
  }, [gameState, user, db]);

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
              {storyConclusion.split('\n').filter(Boolean).map((paragraph, index) => (
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

  const renderStoryCard = (story: any, isPublic: boolean) => (
    <motion.div
      key={story.id}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl transition-all hover:border-indigo-500/50 hover:bg-zinc-900"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex flex-wrap gap-2">
          {(getStoryTags(story).length > 0 ? getStoryTags(story).slice(0, 3) : ['未标签']).map((tag: string) => (
            <span key={tag} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-black text-indigo-300">
              {tag}
            </span>
          ))}
        </div>
        {getStoryInterventionCount(story) > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 px-3 py-1 text-[10px] font-bold text-zinc-400">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            {getStoryInterventionCount(story)}
          </div>
        )}
      </div>
      <h3 className="mb-2 whitespace-normal break-words text-2xl font-black leading-tight text-white transition-colors group-hover:text-indigo-300">
        {formatBookTitle(getStoryTitle(story))}
      </h3>
      <div className="mb-3 text-sm font-bold text-zinc-500">
        作者：{getStoryAuthorName(story)}
      </div>
      <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300">
        {getStoryMainAxis(story)}
      </p>
      <div className="mb-5 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-500">
        <div className="rounded-lg bg-zinc-950/60 px-2 py-1">点赞 {getStoryLikeCount(story)}</div>
        <div className="rounded-lg bg-zinc-950/60 px-2 py-1">干涉 {getStoryInterventionCount(story)}</div>
        <div className="rounded-lg bg-zinc-950/60 px-2 py-1">收藏 {getStoryFavoriteCount(story)}</div>
        <div className="col-span-2 rounded-lg bg-zinc-950/60 px-2 py-1">平均每章 {getStoryAverageChapterWords(story) || '未知'} 字</div>
      </div>
      <div className="hidden">
        {getStoryTags(story).slice(0, 3).map((tag: string) => (
          <span key={tag} className="rounded-lg bg-zinc-800/80 px-2 py-1 text-[10px] font-medium text-zinc-400 group-hover:bg-zinc-700/80">
            {tag}
          </span>
        ))}
      </div>
      <button type="button" onClick={() => startStoryPlay(story.id)} className={semanticButtonClass('primary', { fullWidth: true })}>
        <Sparkles className="h-4 w-4" />
        干涉命运
      </button>
    </motion.div>
  );

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

  const renderStorySelectView = () => {
    const visibleStories = getVisibleStoryLibraryItems();
    return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white sm:text-4xl">选择命运篇章</h2>
          <p className="mt-2 text-zinc-500">挑选一个世界，或直接生成新世界、进入作者后台与个人馆藏。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setGameState('THEME_SELECTION')}
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

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1">
            {[
              { id: 'public', label: '热门作品', count: publicStories.length },
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
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
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
              onChange={(event) => setStoryLibrarySort(event.target.value as any)}
              className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
            >
              <option value="updated">最近更新</option>
              <option value="likes">点赞最多</option>
              <option value="interventions">干涉最多</option>
              <option value="favorites">收藏最多</option>
              <option value="words">平均字数</option>
            </select>
          </div>
        </div>
        {isLoadingStories ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-700" />
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
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">热门世界</h3>
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
    const filteredStories = mySharedStories.filter((story: any) => {
      if (archiveFilter !== 'all' && story.visibility !== archiveFilter) return false;
      if (!keyword) return true;
      const haystack = `${story.title || ''}\n${story.main_axis || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
    return (
      <div className="mx-auto max-w-6xl px-6 pb-12 pt-24 lg:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">故事馆藏</div>
            <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">保存与分享记录</h2>
            <p className="mt-2 text-sm text-zinc-500">在这里查看你保存过的私密馆藏与公开分享记录。</p>
          </div>
          <BackNavButton label={archiveReturnTarget === 'PLAYING' ? '返回游玩页' : '返回作品库'} onClick={leaveArchiveView} />
        </div>

        <div className="mb-6 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: '全部' },
              { id: 'private', label: '私密' },
              { id: 'public', label: '公开' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setArchiveFilter(option.id as 'all' | 'private' | 'public')}
                className={archiveFilter === option.id ? semanticButtonClass('primary', { compact: true }) : semanticButtonClass('ghost', { compact: true })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={archiveSearch}
            onChange={(event) => setArchiveSearch(event.target.value)}
            placeholder="搜索标题或主轴内容"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          />
        </div>

        {filteredStories.length === 0 ? (
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-10 text-center">
            <div className="text-lg font-bold text-zinc-300">{mySharedStories.length === 0 ? '还没有故事记录' : '没有符合筛选条件的记录'}</div>
            <div className="mt-2 text-sm text-zinc-500">你在游玩页点击“保存作品并返回”或“分享”后，记录会出现在这里。</div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStories.map((story: any) => (
              <div key={story.id} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="line-clamp-1 text-sm font-black text-white">{formatBookTitle(story.title)}</div>
                  <div className={`rounded-full px-2 py-1 text-[10px] font-black ${story.visibility === 'public' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                    {story.visibility === 'public' ? '公开分享' : '私密馆藏'}
                  </div>
                </div>
                <div className="line-clamp-3 text-xs leading-relaxed text-zinc-500">{story.main_axis || '暂无主轴摘要。'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openReadonlyStory(story.id, { allowBack: true, returnTarget: 'ARCHIVE' })} className={semanticButtonClass('secondary', { compact: true })}>
                    <BookOpen className="h-4 w-4" />
                    打开
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = buildSharedStoryUrl(story.id);
                      const copied = await writeClipboardText(url);
                      showError(copied ? '链接已复制。' : '复制失败，请手动复制地址栏链接。');
                    }}
                    className={semanticButtonClass('ghost', { compact: true })}
                  >
                    <ExternalLink className="h-4 w-4" />
                    复制链接
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={archiveUpdatingIds[story.id] || story.visibility === 'private'}
                    onClick={() => handleArchiveVisibilityChange(story, 'private')}
                    className={semanticButtonClass('ghost', { compact: true })}
                  >
                    设为私密
                  </button>
                  <button
                    type="button"
                    disabled={archiveUpdatingIds[story.id] || story.visibility === 'public'}
                    onClick={() => handleArchiveVisibilityChange(story, 'public')}
                    className={semanticButtonClass('ghost', { compact: true })}
                  >
                    设为公开
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderThemeSelectionView = () => (
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-center px-6 pb-20 pt-28 text-center lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <BackNavButton label="返回作品库" onClick={() => setGameState('STORY_SELECT')} />
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

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => toggleTheme(theme)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              selectedThemes.includes(theme)
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
            }`}
          >
            {theme}
          </button>
        ))}
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
              </div>
              <button type="button" onClick={() => setIsAccountCenterOpen(false)} className={semanticIconButtonClass('ghost')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                  <Settings className="h-5 w-5 text-indigo-300" />
                  账号设置
                </div>
                <div className="space-y-3">
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
                  故事馆藏
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
                    打开故事馆藏页
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderReadonlyStoryView = () => {
    const story = readonlyStoryData;
    if (!story) return null;
    return (
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-24 sm:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">故事记录</div>
            <h1 className="text-4xl font-black text-white">{formatBookTitle(story.meta?.title)}</h1>
            <div className="text-sm font-bold text-zinc-500">作者：{getStoryAuthorName(story.meta)}</div>
          </div>
          {readonlyCanGoBack && <BackNavButton label="返回上一页" onClick={leaveReadonlyStory} />}
        </div>
        <div className="mb-10 rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-6 text-sm leading-relaxed text-zinc-300">
          {story.meta?.main_axis || '暂无故事主轴摘要。'}
        </div>
        {user && (
          <div className="mb-10 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleInterveneFromReadonly}
              disabled={!story.meta?.sourceStoryId}
              className={semanticButtonClass('primary', { compact: true })}
            >
              <Zap className="h-4 w-4" />
              干涉故事
            </button>
            <button
              type="button"
              onClick={handleAdaptFromReadonly}
              className={semanticButtonClass('secondary', { compact: true })}
            >
              <Wand2 className="h-4 w-4" />
              一键改编
            </button>
          </div>
        )}
        <div className="space-y-8">
          {(story.chapters || []).map((chapter) => (
            <section key={chapter.chapter_num} className="rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-8">
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm font-black text-zinc-400">
                  {chapter.chapter_num}
                </div>
                <h2 className="text-xl font-black text-white">{chapter.title || `第${chapter.chapter_num}章`}</h2>
              </div>
              <div className="space-y-4 text-zinc-300">
                {(chapter.text || '').split('\n').filter(Boolean).map((paragraph, idx) => (
                  <p key={idx} className="leading-relaxed">{renderParagraphWithHighlights(paragraph, story.meta?.characters || [])}</p>
                ))}
              </div>
            </section>
          ))}
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
            <div className="flex items-center justify-between border-b border-zinc-800 p-6">
              <h3 className="text-xl font-black text-white">故事档案</h3>
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
                          <div className="mb-1 font-bold text-indigo-300">{char.name}</div>
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
                          const isHidden = branch.is_hidden || branch.tier === 'hidden';
                          return !isHidden || isUnlocked || wasUnlocked;
                        }).map((branch: any) => {
                          const isUnlocked = unlockedBranches.some((item: any) => item.id === branch.id);
                          const wasUnlocked = historicallyUnlockedBranches.some((item: any) => item.id === branch.id);
                          const isHidden = branch.is_hidden || branch.tier === 'hidden';
                          const visibleName = isHidden && !isUnlocked && !wasUnlocked ? '隐藏支线' : branch.name;
                          const visibleDesc = isHidden && !isUnlocked && !wasUnlocked
                            ? (branch.hint || '继续干涉命运，寻找这条支线的触发契机。')
                            : (branch.desc || branch.sceneText || branch.hint || '尚无支线描述。');
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
        aria-label="打开故事馆藏"
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
      <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[1900] rounded-3xl border border-zinc-800 bg-zinc-950/92 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[24rem]">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">干涉</div>
            <div className="text-lg font-black leading-none text-indigo-100">{interventionsLeft} / 3</div>
          </div>
          <div className="min-w-0 text-center text-xs font-bold sm:text-sm">
            <span className="text-indigo-300">左 {uiFeedback.leftProgress.toFixed(0)}%</span>
            <span className="mx-2 text-zinc-600">/</span>
            <span className="text-rose-300">右 {uiFeedback.rightProgress.toFixed(0)}%</span>
            <div className="mt-1 truncate text-[10px] font-bold text-zinc-500">{uiFeedback.endingLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateSummary(interventionsLeft > 0 ? 'manual' : 'auto_interventions')}
            disabled={isRewriting || isGeneratingConclusion || !activeStoryId}
            className={`${semanticButtonClass(storyConclusion ? 'secondary' : 'primary', { compact: true })} col-span-2 rounded-2xl whitespace-nowrap sm:col-span-1`}
          >
            {isGeneratingConclusion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {storyConclusion ? '查看结语' : '命运确定'}
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  const renderPlayingView = () => (
    <div className="relative mx-auto max-w-4xl px-6 py-24 pb-40 sm:px-8 sm:pb-32">
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

      <div className="space-y-12">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-black text-zinc-500 transition-colors group-hover:border-indigo-500/50 group-hover:text-indigo-400">
                {chapter.chapter_num}
              </div>
              <h2 className="text-xl font-bold text-zinc-100">{chapter.title || `第${chapter.chapter_num}章`}</h2>
              <div className="h-px flex-1 bg-zinc-900" />
            </div>
            
            <div className="relative rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-8 leading-relaxed text-zinc-300 shadow-2xl backdrop-blur-sm sm:p-10">
              <div className="prose prose-invert max-w-none space-y-6">
                {chapter.text.split('\n').filter(Boolean).map((p, pIdx) => (
                  <p key={pIdx} className="text-lg leading-relaxed first-letter:text-3xl first-letter:font-black first-letter:text-indigo-400 first-letter:mr-1">
                    {renderParagraphWithHighlights(p, blueprint?.characters)}
                  </p>
                ))}
              </div>

              {(() => {
                if (gameState !== 'PLAYING' || !blueprint) return null;

                const availableCharacters: Character[] = [];
                (chapter.present_characters || []).forEach((charIdOrName) => {
                  const matchedCharacter = blueprint.characters.find((char) => char.id === charIdOrName || char.name === charIdOrName);
                  if (matchedCharacter && !availableCharacters.some((char) => char.id === matchedCharacter.id)) {
                    availableCharacters.push(matchedCharacter);
                  }
                });

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
                  <div className="mt-12 border-t border-zinc-800/50 pt-8">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveInterventionChapter(isExpanded ? null : chapter.chapter_num)}
                        disabled={isRewriting || isGeneratingConclusion || activeInterventionOverlay !== null}
                        className={`${semanticButtonClass(isAlreadyIntervened ? 'secondary' : 'primary', { compact: true })} rounded-2xl`}
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
                                      <div className="text-sm font-black text-zinc-100">{char.name}</div>
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
            <button type="button" onClick={() => handleStoryInteraction('like')} className={semanticButtonClass('ghost', { compact: true })}>
              <Heart className="h-4 w-4" /> 点赞
            </button>
            <button type="button" onClick={() => handleStoryInteraction('favorite')} className={semanticButtonClass('ghost', { compact: true })}>
              <Bookmark className="h-4 w-4" /> 收藏
            </button>
            <button type="button" onClick={handleShareStory} disabled={isSharing || !activeStoryId} className={semanticButtonClass('secondary', { compact: true })}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} 分享
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
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-28 sm:px-8">
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
                {storyConclusion?.split('\n').map((p, i) => (
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

  const renderAuthoringView = () => (
    <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <BackNavButton label="返回作品库" onClick={() => setGameState('STORY_SELECT')} />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => handleCreateAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('secondary', { compact: true })}>
            <Sparkles className="h-4 w-4" />
            新建作品
          </button>
          <button type="button" onClick={() => handleDeleteAuthoringStory()} disabled={authoringSaving || !authoringStoryId} className={semanticButtonClass('danger', { compact: true })}>
            <Trash2 className="h-4 w-4" />
            删除当前
          </button>
          <button type="button" onClick={() => refreshStories()} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
            <RefreshCcw className="h-4 w-4" />
            刷新列表
          </button>
          <button type="button" onClick={handleSaveAuthoringChanges} disabled={authoringSaving || !authoringCartridge} className={semanticButtonClass('primary', { compact: true })}>
            {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            保存更改
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="mb-4 text-lg font-black text-white">我的作品</div>
            <div className="space-y-3">
              {myStories.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
                  还没有作品，点击“新建作品”开始创作。
                </div>
              ) : (
                myStories.map((story: any) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={async () => {
                      if (authoringStoryId !== story.id && authoringDirty) {
                        setConfirmationModal({
                          isOpen: true,
                          title: 'Discard unsaved changes',
                          message: 'Switch stories and discard current unsaved changes?',
                          onConfirm: () => {
                            setAuthoringDirty(false);
                            void selectAuthoringStory(story.id);
                          },
                        });
                        return;
                      }
                      await selectAuthoringStory(story.id);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      authoringStoryId === story.id
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-600'
                    }`}
                  >
                    <div className="text-sm font-black text-white">{formatBookTitle(getStoryTitle(story))}</div>
                    <div className="mt-1 text-xs text-zinc-500">{getStoryAuthorName(story)}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="mb-4 text-lg font-black text-white">创作入口</div>
            <nav className="space-y-2">
              <button type="button" onClick={() => setAuthoringTab('play')} className={semanticMenuButtonClass(authoringTab === 'play' ? 'primary' : 'ghost')}>
                <Copy className="h-4 w-4" />
                一键导入
              </button>
              <button type="button" onClick={() => setAuthoringTab('mainline')} className={semanticMenuButtonClass(authoringTab === 'mainline' ? 'primary' : 'ghost')}>
                <BookOpen className="h-4 w-4" />
                主线设定
              </button>
              <button type="button" onClick={() => setAuthoringTab('branches')} className={semanticMenuButtonClass(authoringTab === 'branches' ? 'secondary' : 'ghost')}>
                <Sparkles className="h-4 w-4" />
                支线设定
              </button>
            </nav>
          </div>
        </aside>

        <main className="lg:col-span-8 rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-6 sm:p-8">
          {!authoringCartridge ? (
            <div className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
              请选择一个作品，或新建作品后开始编辑。
            </div>
          ) : (
            <div className="space-y-8">
              {authoringTab === 'play' && (
                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white">一键导入</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">支持按“主线设置 / 支线设置”范本格式自动解析并写入当前作品。</p>
                  </div>
                  <textarea
                    value={authoringImportText}
                    onChange={(event) => setAuthoringImportText(event.target.value)}
                    placeholder="把其他 AI 生成的完整文本粘贴到这里..."
                    className="min-h-[260px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300 outline-none transition-colors focus:border-indigo-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={authoringImportReplaceBranches}
                      onChange={(event) => setAuthoringImportReplaceBranches(event.target.checked)}
                    />
                    导入时尝试覆盖支线结构
                  </label>
                  <button type="button" onClick={handleAuthoringImport} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    <Copy className="h-4 w-4" />
                    解析并导入
                  </button>
                </section>
              )}

              {authoringTab === 'mainline' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-white">主线设定</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">这里负责作品基本信息、角色、章节正文与结局。保存后会同步到作品库与游玩端。</p>
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
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm text-zinc-400">
                    <div>故事主轴</div>
                    <textarea
                      value={authoringCartridge.meta?.main_axis || ''}
                      onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, main_axis: event.target.value } }))}
                      className="min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white outline-none focus:border-indigo-500"
                    />
                  </label>

                  <div className="space-y-3">
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
                      <div key={index} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
                        <input
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
                        <input
                          value={character.desc || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            meta: {
                              ...prev.meta,
                              characters: prev.meta.characters.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, desc: event.target.value } : item),
                            },
                          }))}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
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

                  <div className="space-y-4">
                    <div className="text-lg font-black text-white">章节正文</div>
                    {(authoringCartridge.chapters || []).map((chapter: any) => (
                      <div key={chapter.chapter_num} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                        <div className="text-sm font-black text-white">{formatStoryHeading(chapter)}</div>
                        <input
                          value={chapter.title || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, title: event.target.value } : item),
                          }))}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="章节标题"
                        />
                        <textarea
                          value={chapter.text || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, text: event.target.value } : item),
                          }))}
                          className="min-h-[140px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder={`第${chapter.chapter_num}章正文`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="text-lg font-black text-white">结局设置</div>
                    {(authoringCartridge.endings || []).map((ending: any) => (
                      <div key={ending.id} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                        <div className="text-sm font-black text-white">{endingIdToLabel(ending.id)}</div>
                        <input
                          value={ending.title || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, title: event.target.value } : item),
                          }))}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="结局标题"
                        />
                        <textarea
                          value={ending.text || ''}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, text: event.target.value } : item),
                          }))}
                          className="min-h-[140px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500"
                          placeholder="结局正文"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {authoringTab === 'branches' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-white">支线设定</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">支线会根据触发条件在游玩时被判定解锁。提示短句会出现在干涉面板中。</p>
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-5 space-y-4">
                    <div className="text-sm font-black text-white">新建 / 编辑支线</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={branchForm.name} onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="支线名" />
                      <input value={branchForm.hint} onChange={(event) => setBranchForm((prev) => ({ ...prev, hint: event.target.value }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="提示短句" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <select value={branchForm.side} onChange={(event) => setBranchForm((prev) => ({ ...prev, side: event.target.value as 'left' | 'right' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
                        <option value="left">左倾支线</option>
                        <option value="right">右倾支线</option>
                      </select>
                      <select value={branchForm.tier} onChange={(event) => setBranchForm((prev) => ({ ...prev, tier: event.target.value as 'small' | 'medium' | 'large' | 'hidden' }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500">
                        <option value="small">影响：小</option>
                        <option value="medium">影响：中</option>
                        <option value="large">影响：大</option>
                        <option value="hidden">影响：隐</option>
                      </select>
                    </div>
                    <textarea value={branchForm.sceneText} onChange={(event) => setBranchForm((prev) => ({ ...prev, sceneText: event.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-indigo-500" placeholder="支线情节（300 字以内）" />
                    <div className="space-y-3">
                      <div className="text-sm font-black text-white">触发条件</div>
                      {branchConditions.map((condition, idx) => (
                        <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
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
                              {normalizeCharacters(authoringCartridge.meta?.characters || []).map((character: any) => <option key={character.id} value={character.id}>{character.name}</option>)}
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
                              characters: normalizeCharacters(authoringCartridge.meta?.characters || []),
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setBranchConditions((prev) => prev.length >= 3 ? prev : [...prev, {
                          kind: 'single',
                          singleChapterNum: 2,
                          singleCharId: '',
                          singleAction: 'bless',
                          countCharId: '',
                          countAction: 'bless',
                          minCount: 1,
                          upToChapterNum: 6,
                        }])}
                        className={semanticButtonClass('ghost', { compact: true })}
                      >
                        新增条件组
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!authoringStoryId || !branchForm.name.trim()) {
                            showError('请先填写支线名。');
                            return;
                          }
                          const newId = await createStoryBranch(db as any, authoringStoryId, {
                            side: branchForm.side,
                            tier: branchForm.tier,
                            name: branchForm.name,
                            hint: branchForm.hint || `留意${branchForm.name}`,
                            desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
                            common: false,
                            trigger: normalizeBranchConditionsForStorage(branchConditions)[0],
                            triggerGroups: normalizeBranchConditionsForStorage(branchConditions),
                            inject: { mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [], mustReveal: [], mustChange: [] },
                            sceneText: branchForm.sceneText,
                          } as any);
                          await selectAuthoringStory(authoringStoryId);
                          setSelectedBranchId(newId);
                          setExpandedBranchId(newId);
                          showError('支线已创建。');
                        }}
                        className={semanticButtonClass('primary', { compact: true })}
                      >
                        创建支线
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(authoringCartridge.branches || []).map((branch: any) => (
                      <div key={branch.id} className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{branch.name}</div>
                            <div className="text-xs text-zinc-500">{branch.side} / {branch.tier}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBranchId(branch.id);
                                setExpandedBranchId(expandedBranchId === branch.id ? null : branch.id);
                                setBranchForm({
                                  id: branch.id,
                                  name: branch.name || '',
                                  side: branch.side || 'left',
                                  tier: branch.tier || 'small',
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
                        {expandedBranchId === branch.id && (
                          <div className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
                            <div className="mb-2 font-bold text-zinc-300">{branch.hint || '暂无提示短句'}</div>
                            <div>{branch.sceneText || '暂无支线情节。'}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
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
            <div className="grid gap-3">
              <button
                onClick={() => {
                  setIsActionMenuOpen(false);
                  setIsStoryInfoOpen(true);
                }}
                className={semanticMenuButtonClass('ghost')}
              >
                <BookOpen className="h-5 w-5" />
                故事档案
              </button>
              <button
                onClick={() => openArchiveView('PLAYING')}
                className={semanticMenuButtonClass('ghost')}
              >
                <Archive className="h-5 w-5" />
                故事馆藏
              </button>
              {gameState === 'PLAYING' && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    resetGame();
                  }}
                  className={semanticMenuButtonClass('ghost')}
                >
                  <RefreshCcw className="h-5 w-5" />
                  重新干涉
                </button>
              )}
              <button
                onClick={() => {
                  setIsActionMenuOpen(false);
                  setGameState('STORY_SELECT');
                }}
                className={semanticMenuButtonClass('ghost')}
              >
                <LogIn className="h-5 w-5" />
                退出游玩
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderAuthView = () => {
    const isIos = isIosDevice();
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-indigo-300">
              <Wand2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">命运干涉</h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                使用邮箱和密码创建账户，之后在手机、PWA、桌面浏览器都能用同一方式进入。
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5">
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="邮箱"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-500"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="密码（至少 6 位）"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleEmailPasswordLogin}
              disabled={isLoggingIn}
              className={semanticButtonClass('primary', { fullWidth: true })}
            >
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              邮箱登录 / 创建账户
            </button>
            <button
              type="button"
              onClick={handlePasswordReset}
              className="w-full text-center text-xs font-bold text-zinc-500 transition-colors hover:text-zinc-300"
            >
              忘记密码
            </button>
          </div>

          {!isIos ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                <div className="h-px flex-1 bg-zinc-800" />
                快捷入口
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Google 快捷登录 / 绑定
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                <div className="h-px flex-1 bg-zinc-800" />
                Google 绑定
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <button
                type="button"
                onClick={() => setShowSafariGuide(true)}
                disabled={isLoggingIn}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                <LogIn className="h-4 w-4" />
                在 Safari 绑定 Google 账户
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
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
            }}
            disabled={isLoggingIn}
            className={semanticButtonClass('ghost', { fullWidth: true })}
          >
            <UserIcon className="h-4 w-4" />
            先以游客身份游玩
          </button>

          <AnimatePresence>
            {showSafariGuide && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${safeModalBackdropClass} z-[6000] bg-black/80 backdrop-blur-md`}
                onClick={() => setShowSafariGuide(false)}
              >
                <motion.div
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 16, opacity: 0 }}
                  className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-black text-white">iOS Google 绑定</h2>
                    <button type="button" onClick={() => setShowSafariGuide(false)} className={semanticIconButtonClass('ghost')}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
                    <p>请在 Safari 打开当前网页，使用 Google 登录完成账户绑定。</p>
                    <p>绑定后回到 PWA，就可以用同一邮箱密码登录并同步故事记录。</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
                  >
                    <LogIn className="h-4 w-4" />
                    继续 Google 登录
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

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
              ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+9.25rem)] sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+1rem)] sm:right-[27.5rem]'
              : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
          }`}
          aria-label="返回顶端"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <GlobalError errorMsg={errorMsg} />
      
      {!isSessionHydrated ? (
        <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="mb-8 h-12 w-12 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-500"
          />
          <h2 className="text-xl font-black text-white">{startupMessage}</h2>
          <SimulatedProgressBar />
        </div>
      ) : gameState === 'READONLY_STORY' && readonlyStoryData ? (
        <>
          {renderReadonlyStoryView()}
          {renderScrollToTopButton()}
          {accountEntryButton}
          {accountCenterModal}
        </>
      ) : !user ? (
        renderAuthView()
      ) : (
        <>
          {gameState === 'STORY_SELECT' && renderStorySelectView()}
          {gameState === 'ARCHIVE' && renderArchiveView()}
          {gameState === 'THEME_SELECTION' && renderThemeSelectionView()}
          {gameState === 'GENERATING_BLUEPRINT' && (
            <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="mb-8 h-12 w-12 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-500"
              />
              <h2 className="text-2xl font-black text-white">{generationStatus || '正在生成世界蓝图...'}</h2>
              <SimulatedProgressBar />
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
          {accountCenterModal}
          {renderConfirmationModal()}
          {renderResumePromptModal()}
          {renderLeaveGameModal()}
          {renderBranchUnlockModal()}
          {renderSummaryModal()}
          
          <AnimatePresence>
            {activeInterventionOverlay && (
              <LoadingOverlay 
                progress={generationProgress}
                status={generationStatus}
                variant={activeInterventionOverlay.type}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
