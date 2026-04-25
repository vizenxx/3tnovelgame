import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft, Heart, Bookmark, Flag } from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { createEmptyStory, createSharedStoryRecord, adaptBlueprintToStory, createStoryBranch, deleteStoryBranch, deleteStoryCartridge, getSharedStoryRecord, getStoryCartridge, listMyStories, listPublicStories, saveStoryMainlineBundle, saveStoryMeta, upsertStoryBranch } from './storyStore';
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
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  increment,
  serverTimestamp,
  onSnapshot,
  deleteField
} from 'firebase/firestore';

// --- Types ---
type GameState = 'STORY_SELECT' | 'AUTHORING' | 'THEME_SELECTION' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY' | 'READONLY_STORY';

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
  const base = `inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:opacity-50 ${
    options?.compact ? 'px-3 py-2 text-xs font-bold' : 'px-4 py-3 text-sm font-bold'
  } ${options?.fullWidth ? 'w-full' : ''}`;
  const variants = {
    primary: 'bg-white text-black hover:bg-zinc-200 shadow-lg',
    secondary: 'bg-zinc-900 border border-zinc-700 text-zinc-100 hover:border-zinc-500',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
    ghost: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
  };
  return `${base} ${variants[variant]}`;
};

const semanticIconButtonClass = (variant: 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    secondary: 'border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:border-zinc-500 hover:text-white',
    danger: 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-400/60',
    ghost: 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white',
  };
  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${variants[variant]}`;
};

const semanticMenuButtonClass = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    primary: 'text-indigo-100 hover:bg-indigo-950/60',
    secondary: 'text-emerald-100 hover:bg-emerald-950/60',
    danger: 'text-rose-100 hover:bg-rose-950/60',
    ghost: 'text-zinc-100 hover:bg-zinc-900',
  };
  return `flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-colors disabled:opacity-50 ${variants[variant]}`;
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
    className={`inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm font-bold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white ${className}`}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>{label}</span>
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
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-6 py-3 rounded-lg shadow-lg font-medium"
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
  useEffect(() => {
    // Mount to 85% smoothly
    const frame = requestAnimationFrame(() => {
      setTimeout(() => setWidth("85%"), 50);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="w-48 sm:w-64 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden mt-6 relative border border-white/5 shadow-inner">
      <div 
        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 rounded-full transition-all ease-out" 
        style={{ width, transitionDuration: '6000ms' }} 
      />
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
        className="fixed inset-0 z-[3600] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
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
  <div className={`fixed inset-0 z-[1000] backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center transition-colors duration-700 ${
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

const buildStoryPopularityPayload = () => ({
  popularity: increment(1),
});

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

const getStoryAverageChapterWords = (story: any) => story?.averageChapterWords || story?.meta?.averageChapterWords || 0;

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
  const [pendingSummaryRequest, setPendingSummaryRequest] = useState<'manual' | null>(null);
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
  const [showLeaveGameModal, setShowLeaveGameModal] = useState(false);
  const [pendingProgressToLoad, setPendingProgressToLoad] = useState<{ id: string, data: any } | null>(null);


  // Cartridge platform state
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [activeStoryMeta, setActiveStoryMeta] = useState<any | null>(null);
  const [publicStories, setPublicStories] = useState<any[]>([]);
  const [myStories, setMyStories] = useState<any[]>([]);
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
  const popularityCountedRef = useRef(false);
  const conclusionRequestedRef = useRef(false);
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
      const stories = await listMyStories(db as any, targetUser.uid);
      await Promise.all(stories.map((story: any) => saveStoryMeta(db as any, story.id, { authorName } as any)));
      setActiveStoryMeta((prev: any) => prev ? { ...prev, authorName } : prev);
    } catch (error) {
      console.error(error);
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
      if (code.includes('popup') || code.includes('cancelled') || code.includes('blocked')) {
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
      const gs = data.gameState === 'THEME_SELECTION'
        ? 'STORY_SELECT'
        : data.gameState === 'SUMMARY'
          ? 'PLAYING'
          : data.gameState;

      setGameState(gs);
      if (data.gameState === 'THEME_SELECTION') {
        updateDoc(sessionRef, { gameState: 'STORY_SELECT', updatedAt: new Date().toISOString() }).catch(() => {});
      }

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
        const cartridge = await getStoryCartridge(db as any, data.storyId);
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
      }

      if (nextBlueprint) {
        setBlueprint(nextBlueprint);
        setStartupMessage('正在重构命运织机...');
      }

      setIsSessionHydrated(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthReady, user]);

  const handleSaveProgressAndReturn = async () => {
    if (!user || !activeStoryId || !blueprint) return;
    try {
      const progressRef = doc(db, 'users', user.uid, 'progress', activeStoryId);
      await setDoc(progressRef, {
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
      setShowLeaveGameModal(false);
      resetGame();
    } catch (e) {
      console.error(e);
      showError("保存进度失败");
    }
  };

  const handleSaveWorkAndReturn = async () => {
    if (!user || !activeStoryId || !blueprint) return;
    try {
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
      setShowLeaveGameModal(false);
      resetGame();
      showError("作品已保存至个人馆藏（私密）");
    } catch (e) {
      console.error(e);
      showError("保存作品失败");
    }
  };

  const SimulatedProgressBar = () => (
    <div className="w-full max-w-xs h-1 bg-zinc-900 rounded-full overflow-hidden mt-4">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 5, ease: "easeInOut" }}
        className="h-full bg-indigo-500"
      />
    </div>
  );

  const LoadingOverlay = ({ progress, status, variant }: { progress: number; status: string; variant: 'bless' | 'curse' | 'conclude' }) => (
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

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const resetGame = async () => {
    if (!user || !db) return;
    try {
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
      popularityCountedRef.current = false;
      conclusionRequestedRef.current = false;

      const sessionRef = doc(db, 'sessions', user.uid);
      await updateDoc(sessionRef, {
        gameState: 'STORY_SELECT',
        selectedThemes: [],
        blueprintId: null,
        storyId: null,
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
      });
    } catch (e) {
      console.error(e);
      showError("重置命运失败");
    }
  };

  const startStoryPlay = async (storyId: string) => {
    if (!user || !db) return;
    try {
      setIsLoadingStories(true);
      
      const progressRef = doc(db, 'users', user.uid, 'progress', storyId);
      const progressSnap = await getDoc(progressRef);
      
      if (progressSnap.exists()) {
        setPendingProgressToLoad({ id: storyId, data: progressSnap.data() });
        return;
      }
      
      await startNewStoryPlay(storyId);
    } catch (e) {
      console.error(e);
      showError("无法开启故事");
    } finally {
      setIsLoadingStories(false);
    }
  };

  const startNewStoryPlay = async (storyId: string) => {
    if (!user || !db) return;
    try {
      setGameState('PLAYING');
      setActiveStoryId(storyId);
      setActiveStoryMeta(null);
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setIntervenedChapters([]);
      setNaturalChapters([]);
      setInitialNaturalChapters([]);
      setCharacterStatuses({});
      setStoryConclusion(null);
      setInterventionHistory([]);
      setCanonicalWorldState(null);
      setDeltaWorldStateByChapter({});
      popularityCountedRef.current = false;
      conclusionRequestedRef.current = false;

      const sessionRef = doc(db, 'sessions', user.uid);
      await setDoc(sessionRef, {
        gameState: 'PLAYING',
        storyId: storyId,
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
      });
    } catch (e) {
      console.error(e);
      showError("初始化故事失败");
    }
  };

  const resumeStoryPlay = async (storyId: string, progressData: any) => {
    if (!user || !db) return;
    try {
      const sessionRef = doc(db, 'sessions', user.uid);
      await setDoc(sessionRef, {
        ...progressData,
        updatedAt: serverTimestamp(),
      });
      setPendingProgressToLoad(null);
    } catch (e) {
      console.error(e);
      showError("恢复故事进度失败");
    }
  };

  const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
    if (interventionsLeft <= 0 || isRewriting || !blueprint || !user) return;
    
    try {
      setIsRewriting(true);
      setActiveInterventionChapter(chapterNum);
      setInterventionEffect(action);
      setActiveInterventionOverlay({ type: action, targetChapter: chapterNum, statusRaw: "因果重塑中..." });
      
      const charName = blueprint.characters.find(c => c.id === charId)?.name || "未知角色";
      const simulation = startProgressSimulation(12000, [
        `正在观测 ${charName} 的命运线...`,
        `正在编织 ${action === 'bless' ? '庇佑' : '磨难'} 的因果...`,
        `正在重塑第 ${chapterNum} 章及后续情节...`,
        `命运之轮已经转动...`
      ]);

      const response = await apiFetch('/api/intervene', {
        method: 'POST',
        body: JSON.stringify({
          storyId: activeStoryId,
          chapterNum,
          charId,
          action,
          interventionHistory: [...interventionHistory, { chapterNum, charId, action }],
          worldState: buildWorldStateForPrompt(chapterNum, endingValue),
          currentChapters: chapters
        })
      });

      clearInterval(simulation);

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = await response.json();
      
      const newHistory = [...interventionHistory, { chapterNum, charId, action }];
      setInterventionHistory(newHistory);
      setInterventionsLeft(prev => prev - 1);
      
      if (result.newChapters) {
        setChapters(result.newChapters);
      }
      
      if (result.worldState) {
        setCanonicalWorldState(result.worldState.canonical);
        setDeltaWorldStateByChapter(prev => ({
          ...prev,
          [chapterNum]: result.worldState.delta
        }));
      }

      setIntervenedChapters(prev => [...prev, chapterNum]);
      
      setActiveInterventionOverlay(null);
      setIsRewriting(false);
      setActiveInterventionChapter(null);
      setInterventionEffect(null);

    } catch (e) {
      console.error(e);
      showError(e.message || "干涉失败，请重试");
      setIsRewriting(false);
      setActiveInterventionOverlay(null);
    }
  };

  const handleGenerateSummary = async (source: 'auto_interventions' | 'manual') => {
    if (!activeStoryId || isGeneratingConclusion || !blueprint) return;
    
    try {
      setIsGeneratingConclusion(true);
      setSummaryEntrySource(source);
      setGameState('SUMMARY');
      
      const simulation = startProgressSimulation(8000, [
        "正在收束因果残片...",
        "正在推演时空最终走向...",
        "正在铭刻命运总结..."
      ]);

      const response = await apiFetch('/api/conclude', {
        method: 'POST',
        body: JSON.stringify({
          storyId: activeStoryId,
          interventionHistory,
          worldState: canonicalWorldState,
          endingValue,
          chapters: chapters
        })
      });

      clearInterval(simulation);

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = await response.json();
      setStoryConclusion(result.conclusion);
      setShowSummaryModal(true);
    } catch (e: any) {
      console.error(e);
      showError(e.message || "生成总结失败");
      setGameState('PLAYING');
    } finally {
      setIsGeneratingConclusion(false);
    }
  };

  const handleShareStory = async () => {
    if (!storyConclusion || !activeStoryId || !user) return;
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
      const success = await writeClipboardText(shareUrl);
      if (success) {
        showError("已复制分享链接到剪贴板");
      }
    } catch (e) {
      console.error(e);
      showError("分享失败");
    } finally {
      setIsSharing(false);
    }
  };

  const handleStoryInteraction = async (kind: 'like' | 'favorite' | 'report') => {
    if (!activeStoryId || !db) return;
    const field = kind === 'like' ? 'popularity' : kind === 'favorite' ? 'favoriteCount' : 'reportCount';
    try {
      await updateDoc(doc(db, 'stories', activeStoryId), {
        [field]: increment(1),
      } as any);
      showError(kind === 'like' ? '已点赞。' : kind === 'favorite' ? '已收藏。' : '已收到举报。');
    } catch (error) {
      console.error(error);
      showError('操作失败，请稍后再试。');
    }
  };

  const handleAuthoringSave = async () => {
    if (!user || !authoringCartridge || !authoringStoryId) return;
    try {
      setAuthoringSaving(true);
      await saveStoryMainlineBundle(db as any, authoringStoryId, {
        metaPatch: authoringCartridge.meta,
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
      setIsLoadingStories(true);
      Promise.all([
        listPublicStories(db as any),
        listMyStories(db as any, user.uid)
      ]).then(([pub, my]) => {
        setPublicStories(pub);
        setMyStories(my);
      }).finally(() => {
        setIsLoadingStories(false);
      });
    }
  }, [gameState, user]);

  useEffect(() => {
    const handleResize = () => {
      setIsTallNarrowViewport(window.innerWidth < 640 && window.innerHeight > 700);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderConfirmationModal = () => (
    <AnimatePresence>
      {confirmationModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
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
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4"
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
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
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

  const renderStoryCard = (story: any, isPublic: boolean) => (
    <motion.div
      key={story.id}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/50 hover:bg-zinc-900 shadow-xl"
      onClick={() => startStoryPlay(story.id)}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
          <BookOpen className="h-6 w-6" />
        </div>
        {(story.popularity || story.meta?.popularity || 0) > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 px-3 py-1 text-[10px] font-bold text-zinc-400">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            {story.popularity || story.meta?.popularity || 0}
          </div>
        )}
      </div>
      <h3 className="mb-2 line-clamp-1 text-lg font-black text-white group-hover:text-indigo-300 transition-colors">
        {formatBookTitle(getStoryTitle(story))}
      </h3>
      <div className="mb-3 text-[11px] font-bold text-zinc-500">
        作者：{getStoryAuthorName(story)}
      </div>
      <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400 transition-colors">
        {getStoryMainAxis(story)}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-zinc-500">
        <div className="rounded-lg bg-zinc-950/60 px-2 py-1">点赞 {story.popularity || story.meta?.popularity || 0}</div>
        <div className="rounded-lg bg-zinc-950/60 px-2 py-1">收藏 {story.favoriteCount || story.meta?.favoriteCount || 0}</div>
        <div className="col-span-2 rounded-lg bg-zinc-950/60 px-2 py-1">平均每章 {getStoryAverageChapterWords(story) || '未知'} 字</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {getStoryTags(story).slice(0, 3).map((tag: string) => (
          <span key={tag} className="rounded-lg bg-zinc-800/80 px-2 py-1 text-[10px] font-medium text-zinc-400 group-hover:bg-zinc-700/80">
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );

  const renderStorySelectView = () => (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white sm:text-4xl">选择命运篇章</h2>
          <p className="mt-2 text-zinc-500">挑选一个世界，开始您的干涉之旅</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setGameState('AUTHORING')}
            className={semanticButtonClass('secondary', { compact: true })}
          >
            <Sparkles className="h-4 w-4" />
            创作我的故事
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

      <div className="space-y-12">
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
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const actionMenuButton = (
    <div className="fixed top-6 right-6 z-[2000] flex items-center gap-3">
      {gameState === 'PLAYING' && (
        <button
          type="button"
          onClick={handleSaveProgressAndReturn}
          aria-label="返回作品库"
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setIsActionMenuOpen(true)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white backdrop-blur-md"
      >
        <Menu className="h-6 w-6" />
      </button>
    </div>
  );

  const renderPlayingView = () => (
    <div className="relative mx-auto max-w-4xl px-6 py-24 sm:px-8">
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
            key={idx}
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

              {gameState === 'PLAYING' && !intervenedChapters.includes(chapter.chapter_num) && chapter.chapter_num > 1 && (
                <div className="mt-12 flex justify-center border-t border-zinc-800/50 pt-10">
                  <div className="flex flex-col items-center gap-6">
                    <div className="text-center">
                      <div className="mb-1 text-sm font-black text-zinc-100">因果节点已就绪</div>
                      <div className="text-xs text-zinc-500">点击角色头像，干涉此章节的命运走向</div>
                    </div>
                    <div className="flex gap-4">
                      {blueprint?.characters.map(char => (
                        <div key={char.id} className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleIntervene(chapter.chapter_num, char.id, 'bless')}
                              disabled={interventionsLeft <= 0 || isRewriting}
                              className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 disabled:opacity-30"
                            >
                              <Zap className="h-6 w-6" />
                              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                庇佑 {char.name}
                              </div>
                            </button>
                            <button
                              onClick={() => handleIntervene(chapter.chapter_num, char.id, 'curse')}
                              disabled={interventionsLeft <= 0 || isRewriting}
                              className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-400 transition-all hover:border-rose-500/50 hover:bg-rose-500/10 disabled:opacity-30"
                            >
                              <Skull className="h-6 w-6" />
                              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                磨难 {char.name}
                              </div>
                            </button>
                          </div>
                          <div className="text-center text-[10px] font-bold text-zinc-500">{char.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
            <button type="button" onClick={() => handleStoryInteraction('like')} className={semanticButtonClass('ghost', { compact: true })}>
              <Heart className="h-4 w-4" /> 点赞
            </button>
            <button type="button" onClick={() => handleStoryInteraction('favorite')} className={semanticButtonClass('ghost', { compact: true })}>
              <Bookmark className="h-4 w-4" /> 收藏
            </button>
            <button type="button" onClick={handleShareStory} disabled={isSharing || !storyConclusion} className={semanticButtonClass('secondary', { compact: true })}>
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
    <div className="mx-auto max-w-4xl px-6 py-24 sm:px-8">
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
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      {/* Authoring Platform implementation... */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => setGameState('STORY_SELECT')}
          className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          返回选择页
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleAuthoringSave}
            disabled={authoringSaving}
            className={semanticButtonClass('primary', { compact: true })}
          >
            {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            保存作品
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-6">
          <nav className="space-y-1">
            <button
              onClick={() => setAuthoringTab('play')}
              className={semanticMenuButtonClass(authoringTab === 'play' ? 'primary' : 'ghost')}
            >
              <Wand2 className="h-4 w-4" />
              主线设定
            </button>
            <button
              onClick={() => setAuthoringTab('branches')}
              className={semanticMenuButtonClass(authoringTab === 'branches' ? 'secondary' : 'ghost')}
            >
              <Sparkles className="h-4 w-4" />
              支线编织
            </button>
          </nav>
        </aside>

        <main className="lg:col-span-9 rounded-[2rem] border border-zinc-800 bg-zinc-900/20 p-8">
          {authoringTab === 'play' && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-xl font-black text-white">主线内容</h3>
                <textarea
                  value={authoringImportText}
                  onChange={(e) => setAuthoringImportText(e.target.value)}
                  placeholder="粘贴作品内容（支持 Markdown 格式）"
                  className="h-96 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleAuthoringImport}
                  className={semanticButtonClass('secondary', { fullWidth: true })}
                >
                  解析并导入
                </button>
              </section>
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
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
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
      ) : !user ? (
        renderAuthView()
      ) : (
        <>
          {gameState === 'STORY_SELECT' && renderStorySelectView()}
          {gameState === 'PLAYING' && renderPlayingView()}
          {gameState === 'SUMMARY' && renderSummaryView()}
          {gameState === 'AUTHORING' && renderAuthoringView()}

          {actionMenuButton}
          {actionMenuOverlay}
          {storyInfoPanel}
          {renderConfirmationModal()}
          {renderResumePromptModal()}
          {renderLeaveGameModal()}
          
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
