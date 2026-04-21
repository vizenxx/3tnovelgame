import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu, User as UserIcon, ChevronDown, ChevronUp, X, Check, Trash2, Copy, Sparkles, Loader2, Mail, ChevronLeft } from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { createEmptyStory, adaptBlueprintToStory, createStoryBranch, deleteStoryBranch, deleteStoryCartridge, getStoryCartridge, listMyStories, listPublicStories, saveStoryMainlineBundle, saveStoryMeta, upsertStoryBranch } from './storyStore';
import { isBranchUnlockedByHistory, tierToScore } from './storyCartridge';
import { 
  signInWithRedirect,
  signInWithPopup,
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
  getDocFromServer,
  deleteField
} from 'firebase/firestore';

// --- Types ---
type GameState = 'STORY_SELECT' | 'AUTHORING' | 'THEME_SELECTION' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY';

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

  const chapters: Array<{ chapter_num: number; title: string; text: string }> = [];
  const chapterRegex = /###\s*第\s*([1-6])\s*章[《「"]?([^\n》」"]*)[》」"]?\s*\n([\s\S]*?)(?=\n###\s*第\s*[1-6]\s*章|\n##\s*结局|$)/g;
  let chapterMatch: RegExpExecArray | null;
  while ((chapterMatch = chapterRegex.exec(mainline))) {
    const n = Number(chapterMatch[1]);
    const titleText = (chapterMatch[2] || `第${n}章`).trim() || `第${n}章`;
    const body = chapterMatch[3].replace(/^\s*（正文）\s*$/gm, '').trim();
    chapters.push({ chapter_num: n, title: titleText, text: body.slice(0, 1200) });
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>('STORY_SELECT');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
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
  const [fleshingOutChapters, setFleshingOutChapters] = useState<Record<number, boolean>>({});
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallModal, setShowIosInstallModal] = useState<boolean>(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [pwaUpdateInfo, setPwaUpdateInfo] = useState<PwaUpdateInfo | null>(null);
  const [isApplyingPwaUpdate, setIsApplyingPwaUpdate] = useState(false);

  // Email magic link state
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Email+Password login state
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [pwEmail, setPwEmail] = useState("");
  const [pwPassword, setPwPassword] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMode, setPwMode] = useState<'login' | 'register'>('login');

  // Account linking state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkPasswordConfirm, setLinkPasswordConfirm] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [showSafariGuide, setShowSafariGuide] = useState(false);


  // Cartridge platform state
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
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
  const [authoringTab, setAuthoringTab] = useState<'mainline' | 'branches'>('mainline');
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
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
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

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI 响应超时，请重试。")), ms);
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
      data.tags = normalizeTagList(selectedThemes);
      data.endings = (data.endings || []).map((ending: any, index: number) => ({
        ...ending,
        title: ending?.title || (index === 0 ? '第七章' : index === 1 ? '左结局' : '右结局'),
      }));
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

  const buildWorldStateForPrompt = (upToChapter: number, currentEndingValue: number) => {
    const canonical = canonicalWorldState;
    const deltas = Object.entries(deltaWorldStateByChapter || {})
      .filter(([n]) => parseInt(n) <= upToChapter)
      .map(([, d]) => d);
      
    // Calculate relative delta weight based on ending value strength
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

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          showError("Firebase 配置错误或客户端离线。");
        }
      }
    };
    testConnection();
  }, [user]);

  // Sync session from Firestore
  useEffect(() => {
    if (!user || !isAuthReady || !db) return;

    const sessionRef = doc(db, 'sessions', user.uid);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const gs = data.gameState === 'THEME_SELECTION'
          ? 'STORY_SELECT'
          : data.gameState === 'SUMMARY'
            ? 'PLAYING'
            : data.gameState;
        setGameState(gs);
        if (data.gameState === 'THEME_SELECTION' && user) {
          updateDoc(sessionRef, { gameState: 'STORY_SELECT', updatedAt: new Date().toISOString() }).catch(() => {});
        }
        setSelectedThemes(data.selectedThemes || []);
        setChapters(data.currentChapters || []);
        setInterventionsLeft(data.interventionsLeft ?? 3);
        setEndingValue(data.endingValue || 0);
        setUnlockedBranches(data.unlockedBranches || []);
        setIntervenedChapters(data.intervenedChapters || []);
        setNaturalChapters(data.naturalChapters || []);
        setUnlockedBranches(data.unlockedBranches || []);
        setCharacterStatuses(data.characterStatuses || {});
        setStoryConclusion(data.storyConclusion || null);
        setActiveStoryId(data.storyId || null);
        setInterventionHistory(data.interventionHistory || []);
        setCanonicalWorldState(data.canonicalWorldState || null);
        setDeltaWorldStateByChapter(data.deltaWorldStateByChapter || {});
        
        if (data.uiFeedback) {
          setUiFeedback(data.uiFeedback);
        }

        setSessionId(user.uid);
        
        // If we have a blueprintId, fetch it
        if (data.blueprintId) {
          getDoc(doc(db, 'blueprints', data.blueprintId)).then(bpSnap => {
            if (bpSnap.exists()) {
              setBlueprint(bpSnap.data() as Blueprint);
            }
          });
        }
        // Cartridge mode: load story cartridge and build blueprint if needed
        if (data.storyId) {
          getStoryCartridge(db as any, data.storyId).then((cartridge) => {
            if (!cartridge) return;
            const bp: Blueprint = {
              title: cartridge.meta.title,
              main_axis: cartridge.meta.main_axis,
              left_mainline_default: 80,
              right_mainline_default: 40,
              endingMode: cartridge.meta.endingMode,
              endingNames: cartridge.meta.endingNames,
              characters: cartridge.meta.characters,
              chapters: (() => {
                const baseChaps = cartridge.chapters.map((c: any) => ({
                  chapter_num: c.chapter_num,
                  title: c.title,
                  summary: c.summary,
                  present_characters: c.present_characters,
                  text: c.text,
                }));
                // Authored story: fill chapter 7 text from default ending if chapter 7 has no text
                const ch7 = baseChaps.find((c: any) => c.chapter_num === 7);
                const defaultEnding = cartridge.endings.find((e: any) => e.id === 'default');
                const defaultEndingText = (defaultEnding?.text || '').trim();
                if (ch7 && (!ch7.text || !ch7.text.trim()) && defaultEndingText) {
                  ch7.text = defaultEndingText;
                  ch7.title = ch7.title || defaultEnding?.title || '第七章';
                }
                return baseChaps;
              })(),
              endings: [
                { type: 'normal', title: (cartridge.endings.find((e: any) => e.id === 'default')?.title || '第七章'), text: (cartridge.endings.find((e: any) => e.id === 'default')?.text || '') },
                { type: 'good', title: (cartridge.endings.find((e: any) => e.id === 'left')?.title || '左结局'), text: (cartridge.endings.find((e: any) => e.id === 'left')?.text || '') },
                { type: 'bad', title: (cartridge.endings.find((e: any) => e.id === 'right')?.title || '右结局'), text: (cartridge.endings.find((e: any) => e.id === 'right')?.text || '') },
              ],
              tags: cartridge.meta.tags || [],
              branches: cartridge.branches.map((b: any) => {
                const score = tierToScore(b.tier);
                // default condition mapping for UI; real unlock can use trigger/history
                const cond = b.trigger?.type === 'single' ? b.trigger.single : { chapterNum: 2, charId: cartridge.meta.characters[0]?.id || 'c1', action: 'bless' as const };
                return {
                  id: b.id,
                  name: b.name,
                  score,
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
              authorAssets: {
                defaultChapters: cartridge.chapters.reduce((acc: any, c: any) => {
                  acc[c.chapter_num] = { text: c.text || '', title: c.title || '', summary: c.summary || '' };
                  return acc;
                }, {}),
                endingPrototypes: {
                  default: cartridge.endings.find((e: any) => e.id === 'default')?.text || '',
                  left: cartridge.endings.find((e: any) => e.id === 'left')?.text || '',
                  right: cartridge.endings.find((e: any) => e.id === 'right')?.text || '',
                }
              }
            };
            setBlueprint(bp);
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Firebase Auth Results Listener
  useEffect(() => {
    if (!auth) return;

    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt("检测到登录链接。请输入您的邮箱地址以确认您的身份：");
      }
      if (email) {
        setIsLoggingIn(true);
        signInWithEmailLink(auth, email, window.location.href)
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            setUser(result.user);
          })
          .catch((error) => {
            console.error("Email Link Sign In Error:", error);
            showError("免密登录链接已失效或不匹配。如果您从别的设备点击链接，请确保在同一设备/同个浏览器使用。也可以重新获取链接。");
          })
          .finally(() => setIsLoggingIn(false));
      }
      return;
    }

    getRedirectResult(auth).then((result) => {
      if (result) {
        setUser(result.user);
      }
    }).catch(err => console.error("Redirect Login Error:", err));
  }, []);

  useEffect(() => {
    setAuthoringCustomTagsInput((authoringCartridge?.meta?.tags || []).join('，'));
  }, [authoringCartridge?.storyId, authoringCartridge?.meta?.tags]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandalone = () => {
      setIsStandaloneMode(mediaQuery.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstallPromptEvent(null);
      updateStandalone();
    };

    updateStandalone();
    mediaQuery.addEventListener?.('change', updateStandalone);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isStandaloneMode || !import.meta.env.PROD) return;

    let isCancelled = false;
    const detectIos =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

    fetch(`/app-version.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isCancelled || !data?.buildId) return;
        if (String(data.buildId) === __APP_BUILD_ID__) return;
        setPwaUpdateInfo({
          latestVersion: String(data.version || '最新版'),
          latestBuildId: String(data.buildId),
          isIos: detectIos,
        });
      })
      .catch((error) => {
        console.error('PWA version check failed:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [isStandaloneMode]);

  useEffect(() => {
    const updateViewportShape = () => {
      setIsTallNarrowViewport(window.innerHeight / Math.max(window.innerWidth, 1) >= 1.5);
    };

    updateViewportShape();
    window.addEventListener('resize', updateViewportShape);
    return () => window.removeEventListener('resize', updateViewportShape);
  }, []);

  useEffect(() => {
    const closeActiveModal = confirmationModal.isOpen
      ? () => setConfirmationModal(prev => ({ ...prev, isOpen: false }))
      : showSummaryModal
        ? () => setShowSummaryModal(false)
        : null;

    if (!closeActiveModal) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modalRoot = document.querySelector<HTMLElement>('[data-modal-root="true"]');
    const focusables = modalRoot
      ? Array.from(modalRoot.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
      : [];

    const frame = window.requestAnimationFrame(() => {
      (focusables[0] || modalRoot)?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActiveModal();
        return;
      }

      if (event.key !== 'Tab' || !modalRoot) return;
      const currentFocusables = Array.from(modalRoot.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (currentFocusables.length === 0) {
        event.preventDefault();
        modalRoot.focus();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [confirmationModal.isOpen, showSummaryModal]);

  // Lazy flesh out chapters
  useEffect(() => {
    if (!blueprint || gameState !== 'PLAYING' || isRewriting || suppressChapterWritesRef.current) return;
    
    // Find chapters that have index but no content (except current generation in progress)
    const incompleteChapter = chapters.find(c => !c.text || c.text === '命运涟漪正在扩散，重写中...');
    // We only trigger flesh out if it's completely empty. If it's "命运涟漪正在扩散，重写中...", 
    // it's considered empty for generation purposes, but we also ensure we don't start duplicate requests 
    // via fleshingOutChapters state.
    const chapToFlesh = chapters.find(c => !c.text || (typeof c.text === 'string' && c.text.trim().length < 50 && c.text !== '命运涟漪正在扩散，重写中...'));
    if (chapToFlesh && !fleshingOutChapters[chapToFlesh.chapter_num]) {
      fleshOutChapter(chapToFlesh.chapter_num);
    }
  }, [chapters, gameState, isRewriting, blueprint, fleshingOutChapters]);

  // Monitor chapter generation to clear the active intervention overlay
  useEffect(() => {
    if (!activeInterventionOverlay || !blueprint) return;

    const overlay = activeInterventionOverlay;
    // Helper to check if a specific chapter effectively finished generating
    const isChapDone = (chapNum: number) => {
      const c = chapters.find(ch => ch.chapter_num === chapNum);
      return isChapterTextReady(c);
    };

    const isAllDone = chapters.every(c => isChapDone(c.chapter_num));

    if (overlay.type === 'ending') {
      if (isAllDone && overlay.statusRaw !== '命运定格：命运箴言推演中...') {
        // Change overlay text
        setActiveInterventionOverlay(prev => prev ? { ...prev, statusRaw: '命运定格：命运箴言推演中...' } : null);
        setSummaryEntrySource('auto_interventions');
        generateConclusion(chapters).then(() => {
          setActiveInterventionOverlay(null);
          setShowSummaryModal(true);
        });
      }
    } else {
      // bless or curse
      const targetDone = isChapDone(overlay.targetChapter);
      const nextExists = blueprint.chapters.some((c: any) => c.chapter_num === overlay.targetChapter + 1);
      const nextDone = isChapDone(overlay.targetChapter + 1);

      if (targetDone && (!nextExists || nextDone || isAllDone)) {
        setActiveInterventionOverlay(null);
      }
    }
  }, [chapters, activeInterventionOverlay, blueprint]);

  useEffect(() => {
    suppressChapterWritesRef.current = showSummaryModal || gameState === 'SUMMARY';
  }, [gameState, showSummaryModal]);

  useEffect(() => {
    if (pendingSummaryRequest !== 'manual' || !blueprint || isRewriting || isGeneratingConclusion) return;

    const hasPendingGeneration = Object.values(fleshingOutChapters).some(Boolean);
    const allChaptersReady = chapters.length > 0 && chapters.every((chapter) => isChapterTextReady(chapter));
    if (!allChaptersReady || hasPendingGeneration) return;

    if (activeInterventionOverlay?.type === 'ending' && activeInterventionOverlay.statusRaw !== '命运定格：命运箴言推演中...') {
      setActiveInterventionOverlay(prev => prev ? { ...prev, statusRaw: '命运定格：命运箴言推演中...' } : null);
    }

    setPendingSummaryRequest(null);
    setSummaryEntrySource('manual');
    generateConclusion(chapters).then(() => {
      setActiveInterventionOverlay(null);
      setShowSummaryModal(true);
    });
  }, [pendingSummaryRequest, blueprint, isRewriting, isGeneratingConclusion, fleshingOutChapters, chapters, activeInterventionOverlay]);

  const fleshOutChapter = async (targetChapterNum: number) => {
    if (suppressChapterWritesRef.current) {
      setFleshingOutChapters(prev => ({ ...prev, [targetChapterNum]: false }));
      return;
    }
    // Check if we already have a natural version of this chapter
    const naturalVersion = naturalChapters.find(c => c.chapter_num === targetChapterNum);
    if (naturalVersion && naturalVersion.text) {
      if (suppressChapterWritesRef.current) return;
      setChapters(prev => prev.map(c => c.chapter_num === targetChapterNum ? { ...c, text: naturalVersion.text } : c));
      return;
    }

    // Fallback: check blueprint for pre-authored text (e.g. chapter 7 = default ending from authored stories)
    const bpVersion = blueprint.chapters.find((bc: any) => bc.chapter_num === targetChapterNum);
    if (bpVersion && bpVersion.text && bpVersion.text.trim().length > 0) {
      if (suppressChapterWritesRef.current) return;
      setChapters(prev => prev.map(c => c.chapter_num === targetChapterNum ? { ...c, text: bpVersion.text } : c));
      return;
    }

    setFleshingOutChapters(prev => ({ ...prev, [targetChapterNum]: true }));
    try {
      const response = await withRetry(() => apiFetch('/api/generate-next-chapter', {
        method: 'POST',
        body: JSON.stringify({
          blueprint,
          chapters,
          targetChapterNum,
          targetWordCount,
          worldState: buildWorldStateForPrompt(targetChapterNum, endingValue)
        })
      }, 90000), 4, 3000);
      if (!response.ok) throw new Error("Flesh out failed");
      const newChapter = await response.json();
      
      const newText = newChapter.text;
      if (!newText || typeof newText !== 'string' || newText.trim().length < 50) {
        throw new Error("章节内容为空或过短");
      }
      if (suppressChapterWritesRef.current || !user) {
        return;
      }

      // To avoid stale closures overwriting handleIntervene changes, refetch from snapshot
      const sessionDoc = await getDoc(doc(db, 'sessions', user.uid));
      const sessionData = sessionDoc.exists() ? sessionDoc.data() : null;
      const latestChapters = sessionData?.currentChapters || chapters;
      const latestNatural = sessionData?.naturalChapters || naturalChapters;

      const updatedChapters = latestChapters.map((c: any) => c.chapter_num === targetChapterNum ? { ...c, text: newText } : c);
      setChapters(updatedChapters);

      // Save to naturalChapters for persistence
      const updatedNatural = [...latestNatural];
      const natIdx = updatedNatural.findIndex((c: any) => c.chapter_num === targetChapterNum);
      if (natIdx !== -1) {
        updatedNatural[natIdx] = { ...updatedNatural[natIdx], text: newText };
      } else {
        // Find chapter metadata from blueprint if possible
        const bpChapter = blueprint.chapters.find((bc: any) => bc.chapter_num === targetChapterNum);
        updatedNatural.push({
          chapter_num: targetChapterNum,
          title: bpChapter?.title || `第${targetChapterNum}章`,
          summary: bpChapter?.summary || '',
          text: newText
        });
      }
      setNaturalChapters(updatedNatural);

      await updateDoc(doc(db, 'sessions', user.uid), {
        currentChapters: updatedChapters,
        naturalChapters: updatedNatural,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      if (!suppressChapterWritesRef.current) {
        showError(`第 ${targetChapterNum} 章生成失败，可稍后重试。`);
      }
    } finally {
      setFleshingOutChapters(prev => ({ ...prev, [targetChapterNum]: false }));
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    if (!auth) {
      showError("Firebase 配置未完成，暂时无法登录。");
      return;
    }
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
        (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

      if (isIos && !isStandaloneMode) {
        // iOS Safari blocks 3rd party cookies heavily which breaks signInWithRedirect. Force popup.
        await signInWithPopup(auth, provider);
        return;
      }

      // Full screen PWA on iOS physically suppresses popups natively, MUST use redirect, or default to redirect on Android.
      const prefersRedirect = isStandaloneMode || window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
      if (prefersRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
        return;
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log("Previous login request was still pending.");
      } else {
        showError("登录失败，请稍后重试。");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async () => {
    if (isLoggingIn) return;
    if (!auth) {
      showError("Firebase 配置未完成，暂时无法登录。");
      return;
    }
    setIsLoggingIn(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
      await Promise.race([signInAnonymously(auth), timeoutPromise]);
    } catch (error: any) {
      console.error(error);
      if (error.message === 'TIMEOUT') {
        showError("连接超时。若您使用的是 iOS 桌面版，可尝试重启应用或点击右上角取消。");
      } else {
        showError("游客登录失败，请检查网络或重试。");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLinkLogin = async () => {
    if (isSendingEmail) return;
    if (!auth) {
      showError("Firebase 未初始化，请刷新页面。");
      return;
    }
    if (!emailInput || !emailInput.includes('@')) {
      showError("请先输入有效的邮箱地址！");
      return;
    }
    setIsSendingEmail(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, emailInput, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', emailInput);
      showError("免密链接已发送到您的邮箱 📨 请前往邮箱点击链接即可自动登入！(如果没收到，请查看垃圾邮件)");
      setShowEmailLogin(false);
      setEmailInput("");
    } catch (error: any) {
      console.error("Email Link Error:", error);
      const code = error?.code || 'unknown';
      const msg = error?.message || '';
      showError(`发送失败 [${code}]：${msg}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (isLoggingIn) return;
    if (!auth) { showError("Firebase 未初始化，请刷新页面重试。"); return; }
    const email = pwEmail.trim().toLowerCase();
    const password = pwPassword.trim();
    if (!email || !password) { showError("请填写邮箱和密码。"); return; }
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Password Login Error:", error);
      const code: string = error?.code ?? 'unknown';
      if (['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(code)) {
        showError("邮箱或密码错误，请重试。如未注册过密码，请先绑定。");
      } else if (code === 'auth/too-many-requests') {
        showError("尝试次数过多，账户已被临时锁定，请稍后再试。");
      } else {
        showError(`登录失败 [${code}] — 请截图发给开发者`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordRegister = async () => {
    if (!auth || isLoggingIn) return;
    const email = pwEmail.trim().toLowerCase();
    const password = pwPassword.trim();
    const confirm = pwConfirm.trim();
    if (!email || !password) { showError("请填写邮箱和密码。"); return; }
    if (password !== confirm) { showError("两次输入的密码不一致！"); return; }
    if (password.length < 6) { showError("密码至少需要 6 位。"); return; }
    setIsLoggingIn(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        showError("该邮箱已注册，请直接登录。");
        setPwMode('login');
      } else {
        showError(`注册失败 [${error.code}]`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLinkPassword = async () => {
    if (!auth?.currentUser || isLinking) return;
    if (!linkPassword) { showError("\u8bf7\u8f93\u5165\u5bc6\u7801\u3002"); return; }
    if (linkPassword !== linkPasswordConfirm) { showError("\u4e24\u6b21\u5bc6\u7801\u4e0d\u4e00\u81f4\uff01"); return; }
    if (linkPassword.length < 6) { showError("\u5bc6\u7801\u81f3\u5c11\u9700\u8981 6 \u4f4d\u3002"); return; }
    const email = auth.currentUser.email;
    if (!email) { showError("\u5f53\u524d\u8d26\u6237\u6ca1\u6709\u90ae\u7bb1\uff0c\u65e0\u6cd5\u7ed1\u5b9a\u5bc6\u7801\u3002"); return; }
    setIsLinking(true);
    try {
      const credential = EmailAuthProvider.credential(email, linkPassword);
      await linkWithCredential(auth.currentUser, credential);
      setShowLinkModal(false);
      setLinkPassword("");
      setLinkPasswordConfirm("");
      showError(`✅ 绑定成功！绑定邮箱：${email} — 今后在 iOS PWA 用此邮箱+刚设的密码登录即可同步账户。`);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/provider-already-linked') {
        showError("该账户已绑定密码登录，可直接在iOS使用邮箱+密码登录。");
        setShowLinkModal(false);
      } else if (error.code === 'auth/requires-recent-login') {
        showError("操作需要重新验证，请退出后重新登录 Google，再来绑定密码。");
      } else {
        showError(`绑定失败 [${error.code}]`);
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!auth) return;
    const email = pwEmail.trim().toLowerCase();
    if (!email) { showError("请先填写邮箱地址，再点「忘记密码」。"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      showError(`✉️ 重置密码邮件已发送到 ${email}，请在邮箱里点击链接（注意查看垃圾邮件）完成重置后再来登录。`);
    } catch (error: any) {
      const code: string = error?.code ?? 'unknown';
      if (code === 'auth/user-not-found') {
        showError("该邮箱尚未注册，请先注册或使用 Google 登录后绑定。");
      } else {
        showError(`发送失败 [${code}]`);
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) {
      resetGame();
      return;
    }
    try {
      await signOut(auth);
      resetGame();
    } catch (error) {
      console.error(error);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const toggleTheme = (theme: string) => {
    if (selectedThemes.includes(theme)) {
      setSelectedThemes(selectedThemes.filter(t => t !== theme));
    } else {
      if (selectedThemes.length < 4) {
        setSelectedThemes([...selectedThemes, theme]);
      }
    }
  };

  const toggleAuthoringTag = (tag: string) => {
    setAuthoringCartridge((prev: any) => {
      if (!prev) return prev;
      const tags = normalizeTagList(prev.meta?.tags || []);
      const nextTags = tags.includes(tag) ? tags.filter((item) => item !== tag) : normalizeTagList([...tags, tag]);
      return { ...prev, meta: { ...prev.meta, tags: nextTags } };
    });
  };

  const commitAuthoringCustomTags = (value: string) => {
    const parsedTags = parseTagInput(value);
    setAuthoringCustomTagsInput(parsedTags.join('，'));
    setAuthoringCartridge((prev: any) => {
      if (!prev) return prev;
      return { ...prev, meta: { ...prev.meta, tags: parsedTags } };
    });
  };

  const updateAuthoringEndingName = (
    side: 'left' | 'right',
    value: string,
    options?: { composing?: boolean }
  ) => {
    const nextValue = options?.composing ? value : limitFiveChars(value);
    setAuthoringCartridge((prev: any) => ({
      ...prev,
      meta: {
        ...prev.meta,
        endingNames: { ...(prev.meta.endingNames || {}), [side]: nextValue },
      },
    }));
  };

  const handleInstallApp = async () => {
    const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

    if (isIos) {
      setShowIosInstallModal(true);
      return;
    }

    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch (error) {
      console.error(error);
    } finally {
      setInstallPromptEvent(null);
    }
  };

  const handleApplyPwaUpdate = async () => {
    if (!pwaUpdateInfo || !('serviceWorker' in navigator)) return;

    setIsApplyingPwaUpdate(true);
    try {
      let hasReloaded = false;
      const reloadOnce = () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true } as AddEventListenerOptions);

      const registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(pwaUpdateInfo.latestBuildId)}`);
      await registration.update().catch(() => {});

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (registration.installing) {
        await new Promise<void>((resolve) => {
          const worker = registration.installing;
          const timeout = window.setTimeout(resolve, 4000);
          worker?.addEventListener('statechange', () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              window.clearTimeout(timeout);
              resolve();
            } else if (worker.state === 'activated') {
              window.clearTimeout(timeout);
              resolve();
            }
          });
        });
      }

      window.setTimeout(reloadOnce, 1200);
    } catch (error) {
      console.error(error);
      showError('升级失败，请稍后重试。');
      setIsApplyingPwaUpdate(false);
    }
  };

  const incrementStoryPopularityIfEligible = async (storyId: string | null, currentPopularity?: number) => {
    if (!storyId || popularityCountedRef.current) return;
    popularityCountedRef.current = true;
    try {
      await updateDoc(doc(db, 'stories', storyId), buildStoryPopularityPayload());
      setPublicStories((prev) => prev.map((story: any) => story.id === storyId ? { ...story, popularity: (story.popularity || 0) + 1 } : story));
      setMyStories((prev) => prev.map((story: any) => story.id === storyId ? { ...story, popularity: (story.popularity || 0) + 1 } : story));
      setAuthoringCartridge((prev: any) => prev && prev.storyId === storyId ? { ...prev, meta: { ...prev.meta, popularity: (prev.meta?.popularity || 0) + 1 } } : prev);
    } catch (error) {
      popularityCountedRef.current = false;
      console.error(error);
    }
  };

  const handleGenerateBlueprint = async () => {
    if (selectedThemes.length < 1 || selectedThemes.length > 4) return;
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
        body: JSON.stringify({ selectedThemes, targetWordCount })
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = await response.json();
      
      // NEW: Immediately flesh out Chapter 1 before entering game
      setGenerationStatus("正在撰写序章内容...");
      setGenerationProgress(85);
      
      const ch1Response = await withRetry(() => apiFetch('/api/generate-next-chapter', {
        method: 'POST',
        body: JSON.stringify({
          blueprint: data,
          currentChapters: [],
          targetChapterNum: 1,
          targetWordCount
        })
      }, 90000), 3, 2500);

      if (!ch1Response.ok) throw new Error(await readErrorMessage(ch1Response));
      const ch1Data = await ch1Response.json();
      if (!ch1Data?.text || typeof ch1Data.text !== 'string' || ch1Data.text.trim().length < 50) {
        throw new Error("第一章生成内容为空或过短");
      }
      const updatedChapters = data.chapters.map((c: any) =>
        c.chapter_num === 1 ? { ...c, text: ch1Data.text } : c
      );
      data.chapters = updatedChapters;

      // 修复核心逻辑：将大模型生成的平面支线条件映射为系统严格的 trigger 格式
      data.branches = (data.branches || []).map((b: any) => ({
        ...b,
        id: b.id || `b_${Math.random().toString(36).substring(2, 11)}`,
        sceneText: b.sceneText || b.desc,
        trigger: b.trigger || {
          type: 'single',
          single: {
            chapterNum: b.condition_chapter || 2,
            charId: b.condition_char || data.characters?.[0]?.id || 'c1',
            action: b.condition_action === 'curse' ? 'curse' : 'bless'
          }
        }
      }));

      let bpRef;
      try {
        bpRef = await addDoc(collection(db, 'blueprints'), {
          ...data,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'blueprints');
        throw error;
      }

      const initialStatuses: Record<string, { status: string, isDead: boolean }> = {};
      data.characters.forEach(c => {
        initialStatuses[c.id] = { status: '存活', isDead: false };
      });

      try {
        await setDoc(doc(db, 'sessions', user.uid), {
          userId: user.uid,
          blueprintId: bpRef.id,
          gameState: 'PLAYING',
          selectedThemes,
          currentChapters: data.chapters,
          naturalChapters: data.chapters,
          interventionsLeft: 3,
          endingValue: 0,
          unlockedBranches: [],
          intervenedChapters: [],
          characterStatuses: initialStatuses,
          storyConclusion: null,
          uiFeedback: {
            leftProgress: 0,
            rightProgress: 0,
            endingLabel: "均衡道"
          },
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `sessions/${user.uid}`);
        throw error;
      }

      setBlueprint(data);
      setChapters(data.chapters);
      setNaturalChapters(data.chapters);
      // 记录干涉前的“初始版本”，用于“重新干涉”回滚
      setInitialNaturalChapters(
        (data.chapters || []).map((c: any) => ({
          ...c,
          present_characters: Array.isArray(c.present_characters) ? [...c.present_characters] : [],
          title: c.title || '',
          summary: c.summary || '',
          text: c.text || '',
        }))
      );
      setCharacterStatuses(initialStatuses);
      popularityCountedRef.current = false;
      setActiveStoryId(null);
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setIntervenedChapters([]);
      setGameState('PLAYING');

      // Fire-and-forget: generate canonical world state for quick-generated stories
      apiFetch('/api/digest-chapter', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'canonical',
          blueprint: data,
          chapters: data.chapters,
          endings: { default: '', left: '', right: '' },
          branches: [],
        })
      }).then(r => r.json()).then(result => {
        if (result?.canonicalWorldState && user) {
          setCanonicalWorldState(result.canonicalWorldState);
          updateDoc(doc(db, 'sessions', user.uid), { canonicalWorldState: result.canonicalWorldState }).catch(() => {});
        }
      }).catch(() => {});

    } catch (error: any) {
      showError("生成失败，请检查网络或重试。");
      setGameState('THEME_SELECTION');
    } finally {
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  const refreshStories = async () => {
    if (!user) return;
    setIsLoadingStories(true);
    try {
      const [pub, mine] = await Promise.all([
        listPublicStories(db as any, 30),
        listMyStories(db as any, user.uid, 50),
      ]);
      setPublicStories(pub);
      setMyStories(mine);
    } catch (e) {
      console.error(e);
      showError('作品库加载失败。');
    } finally {
      setIsLoadingStories(false);
    }
  };

  const startStoryPlay = async (storyId: string) => {
    if (!user) return;
    setIsLoadingStories(true);
    try {
      const cartridge = await getStoryCartridge(db as any, storyId);
      if (!cartridge) throw new Error('story not found');

      const bp: Blueprint = {
        title: cartridge.meta.title,
        main_axis: cartridge.meta.main_axis,
        left_mainline_default: 80,
        right_mainline_default: 40,
        endingMode: cartridge.meta.endingMode,
        endingNames: cartridge.meta.endingNames,
        characters: cartridge.meta.characters,
        chapters: (() => {
          const baseChaps = cartridge.chapters.map((c: any) => ({
            chapter_num: c.chapter_num,
            title: c.title,
            summary: c.summary,
            present_characters: c.present_characters,
            text: c.text,
          }));
          // Authored story: fill chapter 7 text from default ending if chapter 7 has no text
          const ch7 = baseChaps.find((c: any) => c.chapter_num === 7);
          const defaultEnding = cartridge.endings.find((e: any) => e.id === 'default');
          const defaultEndingText = (defaultEnding?.text || '').trim();
          if (ch7 && (!ch7.text || !ch7.text.trim()) && defaultEndingText) {
            ch7.text = defaultEndingText;
            ch7.title = ch7.title || defaultEnding?.title || '第七章';
          }
          return baseChaps;
        })(),
        endings: [
          { type: 'normal', title: (cartridge.endings.find((e: any) => e.id === 'default')?.title || '第七章'), text: (cartridge.endings.find((e: any) => e.id === 'default')?.text || '') },
          { type: 'good', title: (cartridge.endings.find((e: any) => e.id === 'left')?.title || '左结局'), text: (cartridge.endings.find((e: any) => e.id === 'left')?.text || '') },
          { type: 'bad', title: (cartridge.endings.find((e: any) => e.id === 'right')?.title || '右结局'), text: (cartridge.endings.find((e: any) => e.id === 'right')?.text || '') },
        ],
        tags: cartridge.meta.tags || [],
        branches: cartridge.branches.map((b: any) => {
          const score = tierToScore(b.tier);
          const cond = b.trigger?.type === 'single' ? b.trigger.single : { chapterNum: 2, charId: cartridge.meta.characters[0]?.id || 'c1', action: 'bless' as const };
          return {
            id: b.id,
            name: b.name,
            score,
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
        authorAssets: {
          defaultChapters: cartridge.chapters.reduce((acc: any, c: any) => {
            acc[c.chapter_num] = { text: c.text || '', title: c.title || '', summary: c.summary || '' };
            return acc;
          }, {}),
          endingPrototypes: {
            default: cartridge.endings.find((e: any) => e.id === 'default')?.text || '',
            left: cartridge.endings.find((e: any) => e.id === 'left')?.text || '',
            right: cartridge.endings.find((e: any) => e.id === 'right')?.text || '',
          }
        }
      };

      const initialStatuses: Record<string, { status: string; isDead: boolean }> = {};
      bp.characters.forEach(c => (initialStatuses[c.id] = { status: '存活', isDead: false }));

      const initialHistory: Array<{ chapterNum: number; charId: string; action: 'bless' | 'curse' }> = [];
      const initialUnlocked: Branch[] = [];

      await setDoc(doc(db, 'sessions', user.uid), {
        userId: user.uid,
        storyId,
        gameState: 'PLAYING',
        selectedThemes: cartridge.meta.tags || [],
        currentChapters: bp.chapters,
        naturalChapters: bp.chapters,
        interventionsLeft: 3,
        endingValue: 0,
        unlockedBranches: initialUnlocked,
        intervenedChapters: [],
        interventionHistory: initialHistory,
        characterStatuses: initialStatuses,
        storyConclusion: null,
        uiFeedback: {
          leftProgress: 0,
          rightProgress: 0,
          endingLabel: "均衡道"
        },
        canonicalWorldState: (cartridge as any).canonicalWorldState || null,
        deltaWorldStateByChapter: {},
        updatedAt: new Date().toISOString()
      });

      setCanonicalWorldState((cartridge as any).canonicalWorldState || null);
      setDeltaWorldStateByChapter({});
      setBlueprint(bp);
      setSelectedThemes(cartridge.meta.tags || []);
      setChapters(bp.chapters);
      setNaturalChapters(bp.chapters);
      // 记录干涉前的“初始版本”，用于“重新干涉”回滚
      setInitialNaturalChapters(
        (bp.chapters || []).map((c: any) => ({
          ...c,
          present_characters: Array.isArray(c.present_characters) ? [...c.present_characters] : [],
          title: c.title || '',
          summary: c.summary || '',
          text: c.text || '',
        }))
      );
      setActiveStoryId(storyId);
      popularityCountedRef.current = false;
      setInterventionHistory(initialHistory);
      setUnlockedBranches(initialUnlocked);
      setIntervenedChapters([]);
      setCharacterStatuses(initialStatuses);
      setInterventionsLeft(3);
      setEndingValue(0);
      setShowSummaryModal(false);
      setSummaryEntrySource(null);
      setGameState('PLAYING');
    } catch (e: any) {
      console.error(e);
      if (e?.code === 'permission-denied' || String(e?.message || '').includes('permission')) {
        showError('该作品无权访问，可能是私有作品或分享 ID 无效。');
      } else {
        showError('导入作品失败。');
      }
      setGameState('STORY_SELECT');
    } finally {
      setIsLoadingStories(false);
    }
  };

  const enterAuthoring = async () => {
    setGameState('AUTHORING');
    await refreshStories();
  };

  const handleFastAdaptToAuthoring = async () => {
    if (!user || !blueprint) return;
    try {
      setGenerationStatus("正在为您构建创作母盘...");
      const storyId = await adaptBlueprintToStory(db as any, {
        authorId: user.uid,
        blueprint,
        chapters,
        tags: normalizeTagList((blueprint.tags && blueprint.tags.length > 0 ? blueprint.tags : selectedThemes) || []),
      });
      setAuthoringStoryId(storyId);
      await refreshStories();
      const st = (myStories || []).find((s) => s.id === storyId);
      if (st) setAuthoringCartridge(st as any);
      setGameState('AUTHORING');
      setShowSummaryModal(false);
    } catch (e) {
      console.error(e);
      showError('改编记录同步失败，请重试或检查网络。');
      setGenerationStatus("");
    }
  };

  const runOneClickImport = async () => {
    if (!authoringStoryId || !authoringCartridge) return;
    const payload = parseImportedAuthoringText(authoringImportText);
    if (!payload.title && payload.chapters.length === 0 && payload.branches.length === 0) {
      showError('未识别到可导入内容，请确认使用范本格式。');
      return;
    }

    const nextCharacters = (payload.characters.length > 0 ? payload.characters : (authoringCartridge.meta.characters || []))
      .slice(0, 5)
      .map((c) => ({ name: (c.name || '').trim(), desc: (c.desc || '').trim() || '（待填写简介）' }));
    const normalizedChars = normalizeCharacters(nextCharacters.length > 0 ? nextCharacters : [{ name: '角色1', desc: '（待填写简介）' }]);
    const charIdOfName = (name: string) => normalizedChars.find((c: any) => c.name === name)?.id || normalizedChars[0]?.id || 'c1';

    const chapterByNum = new Map<number, any>((authoringCartridge.chapters || []).map((c: any) => [c.chapter_num, c]));
    for (const c of payload.chapters) chapterByNum.set(c.chapter_num, { ...(chapterByNum.get(c.chapter_num) || {}), chapter_num: c.chapter_num, title: c.title || `第${c.chapter_num}章`, text: (c.text || '').slice(0, 1200) });
    const finalChapters = [1, 2, 3, 4, 5, 6].map((n) => {
      const old = chapterByNum.get(n) || {};
      return {
        chapter_num: n,
        title: old.title || `第${n}章`,
        summary: old.summary || '',
        present_characters: normalizedChars.map((x: any) => x.id),
        text: (old.text || '').slice(0, 1200),
      };
    });

    const hasDual = Boolean(payload.endings.left || payload.endings.right);
    const endingMode = hasDual ? 'dual' : (authoringCartridge.meta.endingMode || 'single');
    const oldEndings = new Map<string, any>((authoringCartridge.endings || []).map((e: any) => [e.id, e]));
    // Authored story: append chapter 7 from default ending if it has content
    const defaultEndingTitle = oldEndings.get('default')?.title || '第七章';
    const leftEndingTitle = oldEndings.get('left')?.title || '左结局';
    const rightEndingTitle = oldEndings.get('right')?.title || '右结局';
    const ch7Text = (payload.endings.default || oldEndings.get('default')?.text || '').trim();
    if (ch7Text) {
      finalChapters.push({
        chapter_num: 7,
        title: defaultEndingTitle,
        summary: '',
        present_characters: normalizedChars.map((x: any) => x.id),
        text: ch7Text.slice(0, 1200),
      });
    }
    const finalEndings = [
      { id: 'default', title: defaultEndingTitle, text: (payload.endings.default || oldEndings.get('default')?.text || '').slice(0, 1200) },
      { id: 'left', title: leftEndingTitle, text: (payload.endings.left || oldEndings.get('left')?.text || '').slice(0, 1200) },
      { id: 'right', title: rightEndingTitle, text: (payload.endings.right || oldEndings.get('right')?.text || '').slice(0, 1200) },
    ].filter((e) => endingMode === 'dual' ? true : e.id === 'default');

    setAuthoringSaving(true);
    try {
      await saveStoryMainlineBundle(db as any, authoringStoryId, {
        metaPatch: {
          ...authoringCartridge.meta,
          title: stripBookTitle(payload.title || authoringCartridge.meta.title || ''),
          main_axis: payload.mainAxis || authoringCartridge.meta.main_axis || '',
          tags: parseTagInput(authoringCustomTagsInput || (authoringCartridge.meta.tags || []).join('，')),
          endingMode,
          characters: normalizedChars,
          defaults: { ...authoringCartridge.meta.defaults, targetWordCount: 1200 },
        } as any,
        chapters: finalChapters,
        endings: finalEndings as any,
      });

      if (authoringImportReplaceBranches) {
        const oldBranches = authoringCartridge.branches || [];
        for (const b of oldBranches) {
          await deleteStoryBranch(db as any, authoringStoryId, b.id);
        }
      }

      for (const b of payload.branches) {
        const defaultImportCond: ParsedImportCondition = { type: 'single', single: { chapterNum: 2, charName: normalizedChars[0]?.name || '', action: 'bless' } };
        const triggerGroups = (b.conditions.length > 0 ? b.conditions : [defaultImportCond])
          .slice(0, 3)
          .map((cond: ParsedImportCondition) => cond.type === 'count'
            ? {
                type: 'count' as const,
                count: {
                  charId: charIdOfName(cond.count?.charName || ''),
                  action: cond.count?.action || 'bless',
                  minCount: Math.max(1, Number(cond.count?.minCount || 1)),
                  upToChapterNum: Math.max(2, Math.min(6, Number(cond.count?.upToChapterNum || 6))),
                },
              }
            : {
                type: 'single' as const,
                single: {
                  chapterNum: Math.max(2, Math.min(6, Number(cond.single?.chapterNum || 2))),
                  charId: charIdOfName(cond.single?.charName || ''),
                  action: cond.single?.action || 'bless',
                },
              });
        await createStoryBranch(db as any, authoringStoryId, {
          side: b.side,
          tier: b.tier,
          name: b.name || '未命名支线',
          hint: b.hint || `留意${b.name || '支线'}`,
          desc: (b.sceneText || b.name || '').slice(0, 80),
          common: Boolean(b.common),
          trigger: triggerGroups[0],
          triggerGroups,
          inject: {
            mustHappen: b.sceneText ? [b.sceneText.slice(0, 300)] : [],
            mustReveal: [],
            mustChange: [],
          },
          sceneText: (b.sceneText || '').slice(0, 300),
        } as any);
      }

      const latest = await getStoryCartridge(db as any, authoringStoryId);
      setAuthoringCartridge(latest);
      await refreshStories();
      showError(`导入完成：主线已填充，支线 ${payload.branches.length} 条${authoringImportReplaceBranches ? '（已覆盖旧支线）' : '（已追加）'}。`);

      // Fire-and-forget: generate canonical world state for this authored story
      apiFetch('/api/digest-chapter', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'canonical',
          blueprint: {
            main_axis: payload.mainAxis || authoringCartridge.meta.main_axis || '',
            characters: normalizedChars,
          },
          chapters: finalChapters,
          endings: {
            default: (payload.endings.default || '').slice(0, 800),
            left: (payload.endings.left || '').slice(0, 800),
            right: (payload.endings.right || '').slice(0, 800),
          },
          branches: payload.branches.map((b: any) => ({ name: b.name, side: b.side, desc: b.sceneText || b.name || '' })),
        })
      }).then(r => r.json()).then(result => {
        if (result?.canonicalWorldState && authoringStoryId) {
          import('./firebase').then(({ db: fbDb }) => {
            import('firebase/firestore').then(({ updateDoc, doc: fbDoc }) => {
              updateDoc(fbDoc(fbDb, 'stories', authoringStoryId), { canonicalWorldState: result.canonicalWorldState }).catch(() => {});
            });
          });
        }
      }).catch(() => {});
    } catch (e: any) {
      console.error(e);
      showError(`一键导入失败：${e?.message || String(e)}`);
    } finally {
      setAuthoringSaving(false);
    }
  };

  useEffect(() => {
    if (!user || !isAuthReady) return;
    if (gameState === 'STORY_SELECT') {
      refreshStories();
    }
  }, [user, isAuthReady, gameState]);

  const generateConclusion = async (storyChapters: Chapter[]) => {
    setIsGeneratingConclusion(true);
    try {
      const response = await apiFetch('/api/generate-summary', {
        method: 'POST',
        body: JSON.stringify({ blueprint, chapters: storyChapters, endingValue })
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = await response.json();
      setStoryConclusion(data.text);
    } catch (e) {
      showError("总结生成失败。");
      setStoryConclusion("命运的织机停下了运转，留下一地无言的叹息。");
    } finally {
      setIsGeneratingConclusion(false);
    }
  };

  const handleInterveneRequest = (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
    const hasFutureInterventions = interventionHistory.some(h => h.chapterNum > chapterNum);
    if (hasFutureInterventions) {
      setConfirmationModal({
        isOpen: true,
        title: '历史覆盖警告',
        message: '在此靠前章节干涉，会导致后续已干涉的全部记录作废（已触发支线保留）。注意：作废的干涉不返还次数！确定要逆转时空吗？',
        onConfirm: async () => {
          setConfirmationModal(prev => prev ? { ...prev, isOpen: false } : null);
          return handleIntervene(chapterNum, charId, action);
        }
      });
    } else {
      handleIntervene(chapterNum, charId, action);
    }
  };

  const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
    if (interventionsLeft <= 0 || isRewriting) return;
    
    setActiveInterventionChapter(null);
    setInterventionEffect(action);
    const overlayType = (interventionsLeft - 1 === 0) ? 'ending' : action;
    const initialStatus = overlayType === 'bless' ? "神迹降临" : overlayType === 'curse' ? "命运崩坏" : "终局裁定";
    setActiveInterventionOverlay({ type: overlayType, targetChapter: chapterNum, statusRaw: initialStatus });
    
    setIsRewriting(true);
    
    const progressInterval = startProgressSimulation(30000, [
      action === 'bless' ? "神迹降临，气运回升..." : "命运崩坏，厄运缠绕...",
      "因果律正在重组...",
      "蝴蝶效应正在扩散...",
      "时空涟漪正在平复...",
      "新的未来正在显现..."
    ]);

    try {
      setChapters(prev => prev.map(c => c.chapter_num >= chapterNum ? { ...c, text: '命运涟漪正在扩散，重写中...' } : c));
      
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
          interventionHistory: interventionHistory.filter(h => h.chapterNum <= chapterNum),
          worldState: buildWorldStateForPrompt(chapterNum, endingValue)
        })
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = await response.json();
      
      const responseData = data.aiData || {};
      const rewrittenChapters = responseData.chapters || [];
      const charUpdates = responseData.character_updates || [];
      const newEndingValue = data.newEndingValue;
      const newUnlockedBranches = data.newUnlockedBranches || unlockedBranches;
      const unlocked = data.unlockedBranch;
      
      if (unlocked) {
        showError(`【命运契机】已解锁支线：${unlocked.name}`);
        if (!historicallyUnlockedBranches.find(b => b.id === unlocked.id)) {
          setHistoricallyUnlockedBranches(prev => [...prev, unlocked]);
        }
      }
      
      setUnlockedBranches(newUnlockedBranches);
      setEndingValue(newEndingValue);
      if (data.uiFeedback) {
        setUiFeedback(data.uiFeedback);
      }
      
      const updatedChapters = chapters.map(c => ({ ...c }));
      rewrittenChapters.forEach((rc: any) => {
        const index = updatedChapters.findIndex(c => c.chapter_num === rc.chapter_num);
        if (index === -1) return;
        const existing = updatedChapters[index];
        const isFuture = rc.chapter_num > chapterNum;
        const hasNewText = typeof rc.text === 'string' && rc.text.trim().length > 0;
        const merged = { ...existing, ...rc } as any;
        merged.text = hasNewText ? rc.text : (isFuture ? '' : (existing.text || ''));
        if (typeof rc.summary !== 'string' || !rc.summary.trim()) {
          merged.summary = existing.summary || '';
        }
        if (!Array.isArray(rc.present_characters) || rc.present_characters.length === 0) {
          merged.present_characters = existing.present_characters;
        }
        updatedChapters[index] = merged;
      });
      setChapters(updatedChapters);

      const nextNatural = naturalChapters.map(n => {
        if (n.chapter_num === chapterNum) {
          const ch = updatedChapters.find(c => c.chapter_num === chapterNum);
          return ch ? { ...n, text: ch.text || '', summary: ch.summary ?? n.summary, title: ch.title ?? n.title } : n;
        }
        if (n.chapter_num > chapterNum) {
          return { ...n, text: '' };
        }
        return n;
      });
      setNaturalChapters(nextNatural);
      
      let finalStatuses = characterStatuses;
      if (charUpdates.length > 0) {
        finalStatuses = { ...characterStatuses };
        charUpdates.forEach((u: any) => {
          finalStatuses[u.id] = { status: u.status, isDead: u.is_dead };
        });
        setCharacterStatuses(finalStatuses);
      }
      
      const newInterventionsLeft = interventionsLeft - 1;
      const newIntervenedChapters = [...intervenedChapters.filter(c => c < chapterNum), chapterNum];
      
      // 核心业务验证：由于后次干涉位置比前次干涉位置靠前，作废之后章节的干涉记录
      // 但对于同章节的连续多次干涉，需要全部保留
      const newHistory = [
        ...interventionHistory.filter(h => h.chapterNum <= chapterNum),
        { chapterNum, charId, action }
      ];
      
      const updatePayload: any = {
        currentChapters: updatedChapters,
        naturalChapters: nextNatural,
        characterStatuses: finalStatuses,
        interventionsLeft: newInterventionsLeft,
        intervenedChapters: newIntervenedChapters,
        interventionHistory: newHistory,
        endingValue: newEndingValue,
        unlockedBranches: newUnlockedBranches,
        uiFeedback: data.uiFeedback || uiFeedback,
        updatedAt: new Date().toISOString(),
      };

      // 清理后次干涉导致作废的 delta
      const newDeltaState = { ...deltaWorldStateByChapter };
      let deltaDeleted = false;
      Object.keys(newDeltaState).forEach(k => {
        if (parseInt(k) > chapterNum) {
          delete newDeltaState[k];
          updatePayload[`deltaWorldStateByChapter.${k}`] = deleteField();
          deltaDeleted = true;
        }
      });
      if (deltaDeleted) {
        setDeltaWorldStateByChapter(newDeltaState);
      }
      
      if (user) {
        try {
          await updateDoc(doc(db, 'sessions', user.uid), updatePayload);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `sessions/${user.uid}`);
        }
      }

      // Fire-and-forget: generate delta world state for this intervention
      if (canonicalWorldState) {
        const rewrittenChText = updatedChapters.find(c => c.chapter_num === chapterNum)?.text || '';
        apiFetch('/api/digest-chapter', {
          method: 'POST',
          body: JSON.stringify({
            mode: 'delta',
            canonicalWorldState,
            rewrittenChapter: { chapter_num: chapterNum, text: rewrittenChText },
            endingValue: newEndingValue,
            interventionAction: action,
          })
        }).then(r => r.json()).then(result => {
          if (result?.deltaWorldState && user) {
            const newDelta = { ...deltaWorldStateByChapter, [String(chapterNum)]: result.deltaWorldState };
            setDeltaWorldStateByChapter(newDelta);
            updateDoc(doc(db, 'sessions', user.uid), {
              [`deltaWorldStateByChapter.${chapterNum}`]: result.deltaWorldState,
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      setInterventionsLeft(newInterventionsLeft);
      setIntervenedChapters(newIntervenedChapters);
      setInterventionHistory(newHistory);
      if (newInterventionsLeft === 0) {
        await incrementStoryPopularityIfEligible(activeStoryId, (publicStories.find((story: any) => story.id === activeStoryId)?.popularity ?? myStories.find((story: any) => story.id === activeStoryId)?.popularity ?? authoringCartridge?.meta?.popularity ?? 0));
      }
      
      // End of Intervention -> Background logic will automatically trigger to generate next blank Chapter.
      
    } catch (error: any) {
      showError("干涉失败，请重试。");
      // Revert loading chapters placeholder
      setChapters(chapters);
    } finally {
      setIsRewriting(false);
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  const handleEndGame = () => {
    if (interventionsLeft > 0) {
      setConfirmationModal({
        isOpen: true,
        title: '命运确定',
        message: '你还有剩余干涉次数。确定现在直接总结，并结束这次干涉吗？',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          handleEndGameConfirmed();
        }
      });
      return;
    }
    handleEndGameConfirmed();
  };

  const handleEndGameConfirmed = () => {
    // 剔除所有还没有生成完毕的章节，丢弃后续不必要的生成
    const finishedChapters = chapters.filter(ch => isChapterTextReady(ch));
    setChapters(finishedChapters);
    
    suppressChapterWritesRef.current = true;
    setSummaryEntrySource('manual');
    
    if (!storyConclusion) {
      setActiveInterventionOverlay({
        type: 'ending',
        targetChapter: finishedChapters[finishedChapters.length - 1]?.chapter_num || 7,
        statusRaw: '终局裁定：正在生成最终结语...',
      });
      generateConclusion(finishedChapters).then(() => {
        setActiveInterventionOverlay(null);
        setShowSummaryModal(true);
      });
    } else {
      setShowSummaryModal(true);
    }
    if (user) {
      updateDoc(doc(db, 'sessions', user.uid), {
        gameState: 'PLAYING',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  const resetGame = async () => {
    // Immediate local reset for responsiveness
    setGameState('STORY_SELECT');
    popularityCountedRef.current = false;
    setSelectedThemes([]);
    setBlueprint(null);
    setChapters([]);
    setUnlockedBranches([]);
    setHistoricallyUnlockedBranches([]);
    setInterventionsLeft(3);
    setIntervenedChapters([]);
    setCharacterStatuses({});
    setStoryConclusion(null);
    setEndingValue(0);
    setShowSummaryModal(false);
    setSummaryEntrySource(null);
    setIsRewriting(false);
    setGenerationProgress(100);
    setErrorMsg(null);
    setUiFeedback({
      leftProgress: 0,
      rightProgress: 0,
      endingLabel: "均衡道"
    });

    if (user) {
      try {
        await setDoc(doc(db, 'sessions', user.uid), {
          userId: user.uid,
          gameState: 'STORY_SELECT',
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `sessions/${user.uid}`);
      }
    }
  };

  const restartSameStory = async () => {
    if (!blueprint) return;

    const baseChapters = (initialNaturalChapters && initialNaturalChapters.length > 0) ? initialNaturalChapters : naturalChapters;

    // Immediate local reset for responsiveness
    setChapters(baseChapters);
    popularityCountedRef.current = false;
    setNaturalChapters(baseChapters);
    setUnlockedBranches([]);
    setInterventionsLeft(3);
    setIntervenedChapters([]);
    setInterventionHistory([]);
    setDeltaWorldStateByChapter({});
    setActiveInterventionOverlay(null);
    setPendingSummaryRequest(null);
    setStoryConclusion(null);
    setEndingValue(0);
    setGameState('PLAYING');
    setShowSummaryModal(false);
    setSummaryEntrySource(null);
    setIsRewriting(false);
    setGenerationProgress(100);
    setErrorMsg(null);
    setUiFeedback({
      leftProgress: 0,
      rightProgress: 0,
      endingLabel: "均衡道"
    });

    const initialStatuses: Record<string, { status: string, isDead: boolean }> = {};
    blueprint.characters.forEach(c => {
      initialStatuses[c.id] = { status: '存活', isDead: false };
    });
    setCharacterStatuses(initialStatuses);

    if (user) {
      try {
        await updateDoc(doc(db, 'sessions', user.uid), {
          gameState: 'PLAYING',
          currentChapters: baseChapters,
          naturalChapters: baseChapters,
          unlockedBranches: [],
          interventionsLeft: 3,
          intervenedChapters: [],
          interventionHistory: [],
          deltaWorldStateByChapter: {},
          characterStatuses: initialStatuses,
          storyConclusion: null,
          endingValue: 0,
          uiFeedback: {
            leftProgress: 0,
            rightProgress: 0,
            endingLabel: "均衡道"
          },
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `sessions/${user.uid}`);
      }
    }
  };

  const openRestartConfirmation = () => {
    setConfirmationModal({
      isOpen: true,
      title: '重新开始当前故事',
      message: '确定要放弃当前的干涉，回到故事最初的状态吗？',
      onConfirm: () => {
        restartSameStory();
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      }
    });
    setIsActionMenuOpen(false);
  };

  const openAbandonInterventionConfirmation = () => {
    setConfirmationModal({
      isOpen: true,
      title: '放弃干涉',
      message: '确定要结束这次干涉并离开当前故事吗？',
      onConfirm: () => {
        resetGame();
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      }
    });
    setIsActionMenuOpen(false);
  };

  const handleQuickAdapt = () => {
    setIsActionMenuOpen(false);
    handleFastAdaptToAuthoring();
  };

  const showCondensedStoryInfo = gameState === 'PLAYING' && isTallNarrowViewport;

  const storyInfoPanel = blueprint ? (
    <>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mt-8 lg:mt-0">
        <h2 className="text-2xl font-bold text-white mb-2">{blueprint.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          {(selectedThemes || []).map((theme, index) => (
            <span key={`${theme || 'theme'}-${index}`} className="px-2 py-1 bg-zinc-800 rounded-md">
              {theme}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          登场人物
        </h3>
        <div className="space-y-3">
          {blueprint.characters.map(char => {
            const statusObj = characterStatuses[char.id] || { status: '存活', isDead: false };
            return (
              <div key={char.id} className={`p-3 rounded-lg border transition-colors ${statusObj.isDead ? 'bg-zinc-950/50 border-zinc-900' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className={`font-bold text-base ${statusObj.isDead ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>{char.name}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium whitespace-nowrap ${
                    statusObj.isDead ? 'bg-zinc-800 text-zinc-500' :
                    statusObj.status === '存活' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {statusObj.status}
                  </span>
                </div>
                <div className="h-px bg-zinc-800 my-2" />
                <div className={`text-sm leading-relaxed ${statusObj.isDead ? 'text-zinc-700' : 'text-zinc-400'}`}>{char.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          命运支线
        </h3>
        <div className="space-y-3">
          {blueprint.branches.map((branch) => {
            const isUnlocked = unlockedBranches.some(b => b.id === branch.id);
            const isHistoricallyUnlocked = historicallyUnlockedBranches.some(b => b.id === branch.id);

            if (isUnlocked) {
              return (
                <div key={branch.id} className="p-3 bg-indigo-950/30 rounded-lg border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                  <div className="flex justify-between items-center mb-1 gap-3">
                    <span className="font-medium text-indigo-200">{branch.name}</span>
                    <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded whitespace-nowrap">已解锁</span>
                  </div>
                  <div className="text-sm text-indigo-200/70">{branch.desc}</div>
                </div>
              );
            }

            if (isHistoricallyUnlocked) {
              const charName = blueprint.characters.find(c => c.id === branch.condition_char)?.name || '未知角色';
              const actionName = branch.condition_action === 'bless' ? '庇佑' : '磨难';
              return (
                <div key={branch.id} className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-700 flex flex-col gap-1">
                  <div className="flex justify-between items-center gap-3">
                    <span className="font-medium text-zinc-300">{branch.name}</span>
                    <span className="text-xs font-bold px-2 py-1 bg-zinc-700/50 text-zinc-400 rounded flex items-center gap-1 whitespace-nowrap"><Lock className="w-3 h-3" /> 曾解锁</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    解锁条件：在第 {branch.condition_chapter} 章对 {charName} 施加{actionName}
                  </div>
                </div>
              );
            }

            if (!branch.is_hidden) {
              return (
                <div key={branch.id} className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-800 border-dashed flex items-center gap-3">
                  <Lock className="w-4 h-4 text-zinc-600" />
                  <span className="text-sm font-medium text-zinc-500">{branch.name}（待解锁）</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </>
  ) : null;

  const actionMenuOverlay = blueprint && (gameState === 'PLAYING' || gameState === 'SUMMARY') ? (
    <div className="fixed top-4 left-4 z-[320]">
      <button
        type="button"
        onClick={() => setIsActionMenuOpen((prev) => !prev)}
        aria-label={isActionMenuOpen ? '关闭目录' : '打开目录'}
        aria-expanded={isActionMenuOpen}
        className="flex items-center justify-center w-11 h-11 rounded-2xl border border-zinc-700 bg-zinc-900/90 backdrop-blur-md text-white shadow-xl"
      >
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isActionMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="mt-3 w-48 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={openRestartConfirmation}
              className="w-full px-3 py-3 rounded-xl text-left text-sm text-zinc-100 hover:bg-zinc-900 flex items-center gap-2"
            >
              <RefreshCcw className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} />
              重新干涉
            </button>
            <button
              type="button"
              onClick={openAbandonInterventionConfirmation}
              className="w-full px-3 py-3 rounded-xl text-left text-sm text-zinc-100 hover:bg-zinc-900 flex items-center gap-2"
            >
              <Star className="w-4 h-4 text-amber-400" />
              放弃干涉
            </button>
            <button
              type="button"
              onClick={handleQuickAdapt}
              disabled={isRewriting || isGeneratingConclusion}
              className="w-full px-3 py-3 rounded-xl text-left text-sm text-indigo-100 hover:bg-indigo-950/60 disabled:opacity-50 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-indigo-300" />
              一键改编
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null;

  const compactFloatingActionPanel = blueprint && gameState === 'PLAYING' ? (
    <div className="fixed left-4 right-4 bottom-4 z-[261] rounded-3xl border border-zinc-800 bg-zinc-950/92 backdrop-blur-xl shadow-2xl px-4 py-3 lg:right-auto lg:w-[22rem]">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="text-xl font-black leading-none text-indigo-200 whitespace-nowrap">{interventionsLeft} / 3</div>
        <div className="text-sm font-bold leading-tight text-center">
          <span className="text-indigo-300">左 {uiFeedback.leftProgress.toFixed(0)}%</span>
          <span className="mx-2 text-zinc-600">/</span>
          <span className="text-rose-300">右 {uiFeedback.rightProgress.toFixed(0)}%</span>
        </div>
        {interventionsLeft > 0 ? (
          <button
            type="button"
            onClick={handleEndGame}
            disabled={isRewriting}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            命运确定
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              suppressChapterWritesRef.current = true;
              setSummaryEntrySource('auto_interventions');
              setShowSummaryModal(true);
              if (!storyConclusion && !isGeneratingConclusion) {
                generateConclusion(chapters);
              }
            }}
            disabled={isRewriting}
            className="px-4 py-2 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 font-bold flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            命运确定
          </button>
        )}
      </div>
    </div>
  ) : null;

  const storyInfoOverlay = showCondensedStoryInfo ? (
    <>
      <div className="fixed top-4 right-4 z-[321]">
        <button
          type="button"
          onClick={() => setIsStoryInfoOpen(true)}
          className="px-4 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900/90 backdrop-blur-md text-white shadow-xl font-medium"
        >
          故事信息
        </button>
      </div>

      <AnimatePresence>
        {isStoryInfoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[330] bg-zinc-950 safe-top safe-bottom overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 pl-20 backdrop-blur-md">
              <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">故事信息</div>
              <button
                type="button"
                onClick={() => setIsStoryInfoOpen(false)}
                className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {storyInfoPanel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  ) : null;

  const pwaUpdateModal = (
    <>
      <PwaUpdateModal
        updateInfo={isStandaloneMode ? pwaUpdateInfo : null}
        isApplying={isApplyingPwaUpdate}
        onClose={() => {
          if (isApplyingPwaUpdate) return;
          setPwaUpdateInfo(null);
        }}
        onUpdate={handleApplyPwaUpdate}
      />
      <AnimatePresence>
        {showIosInstallModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm safe-top safe-bottom">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 mb-2">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white">添加到主屏幕</h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  点击底部工具栏的 <strong className="text-white">分享图标</strong>
                  <br />
                  然后选择 <strong className="text-white">「添加到主屏幕」</strong>
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setShowIosInstallModal(false)}
                    className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-400"
                  >
                    我知道了
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Global Action Loading Overlay */}
      <AnimatePresence>
        {(isLoggingIn || isLoadingStories || authoringSaving) && (
          <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] safe-top safe-bottom">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-5"
            >
              <div className="relative flex items-center justify-center h-16 w-16">
                <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-2 border-rose-500 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                <Loader2 className="w-6 h-6 text-white animate-pulse" />
              </div>
              <span className="text-white/90 font-bold tracking-widest text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5 shadow-2xl">
                {isLoggingIn ? "连结命运中..." : isLoadingStories ? "提取档案中..." : authoringSaving ? "保存世界线中..." : "请稍候..."}
              </span>
              {(isLoggingIn || isLoadingStories) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsLoggingIn(false);
                    setIsLoadingStories(false);
                  }}
                  className="mt-6 px-4 py-2 text-xs text-zinc-500 underline decoration-zinc-700 hover:text-white transition-colors"
                >
                  等待太久？点击此处取消
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Link Password Modal */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">绑定 iOS 密码登录</h3>
                  <p className="text-xs text-zinc-500 mt-1">为你的账户（{auth?.currentUser?.email}）设置一个密码，之后即可在 iOS PWA 用邮箱+密码登录同一账户数据。</p>
                </div>
                <input type="password" placeholder="设置密码（至少6位）" value={linkPassword} onChange={e => setLinkPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                <input type="password" placeholder="确认密码" value={linkPasswordConfirm} onChange={e => setLinkPasswordConfirm(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setShowLinkModal(false); setLinkPassword(""); setLinkPasswordConfirm(""); }}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition-colors">取消</button>
                  <button onClick={handleLinkPassword} disabled={isLinking}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认绑定"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Safari Guide Modal */}
      <AnimatePresence>
        {showSafariGuide && (
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowSafariGuide(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white">绑定 Google 账号 — 操作步骤</h3>
                  <p className="text-xs text-zinc-500 mt-1">iOS 限制无法在此直接开启浏览器，请按以下步骤操作：</p>
                </div>
                <ol className="space-y-3 text-sm text-zinc-300">
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">1</span><span>长按下方链接 → 选择<strong className="text-white">「在 Safari 中打开」</strong></span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">2</span><span>在 Safari 里点击 <strong className="text-white">「Google 同步登录」</strong>完成授权</span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">3</span><span>登录后点右上角 <strong className="text-white">📨 信封图标</strong> 设置一个密码</span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">4</span><span>回到桌面 App，用 <strong className="text-white">邮箱+密码</strong> 登录即可同步数据</span></li>
                </ol>
                <div className="bg-zinc-950 rounded-xl px-4 py-3 flex items-center gap-3 border border-zinc-800">
                  <span className="text-xs text-zinc-400 truncate flex-1 font-mono">{window.location.origin}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(window.location.origin); showError('链接已复制 ✅'); }}
                    className="text-xs text-indigo-400 font-bold whitespace-nowrap hover:text-indigo-300 transition-colors"
                  >复制链接</button>
                </div>
                <button
                  onClick={() => setShowSafariGuide(false)}
                  className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition-colors"
                >知道了</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  // --- Renderers ---

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <div className="text-zinc-500 text-sm animate-pulse">正在连接时空枢纽...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 py-6 sm:p-6 font-sans relative overflow-hidden safe-top safe-bottom">
        {pwaUpdateModal}
        <GlobalError errorMsg={errorMsg} />
        {/* Background effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[30%] sm:w-[40%] sm:h-[40%] bg-indigo-500/10 blur-[90px] sm:blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[30%] sm:w-[40%] sm:h-[40%] bg-rose-500/10 blur-[90px] sm:blur-[120px] rounded-full" />
        </div>

        <div className="max-w-sm sm:max-w-md w-full text-center space-y-8 sm:space-y-12 relative z-10">
          <div className="space-y-4 sm:space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white flex flex-col items-center gap-3 sm:gap-4">
                <Wand2 className="w-14 h-14 sm:w-20 sm:h-20 text-indigo-400 drop-shadow-[0_0_20px_rgba(129,140,248,0.5)]" />
                <span>命运干涉</span>
              </h1>
            </motion.div>
            <p className="text-zinc-400 text-sm sm:text-xl font-light tracking-wide leading-relaxed">编织丝线，逆转因果，见证你的史诗结局。</p>
          </div>

          <div className="space-y-5 pt-8 sm:pt-10 border-t border-zinc-900">
            <p className="text-[11px] sm:text-xs text-zinc-600 uppercase tracking-[0.3em] sm:tracking-[0.4em] font-bold">请选择登入命运的方式</p>
            <InstallAppBanner
              canInstall={Boolean(installPromptEvent)}
              isStandalone={isStandaloneMode}
              onInstall={handleInstallApp}
            />

            <div className="grid grid-cols-1 gap-3">
              {/* iOS PWA: Google login would fail, so show email+password first and guide instead */}
              {isStandaloneMode ? (
                <>
                  {/* Email+Password - Primary for iOS PWA */}
                  <div className="flex flex-col rounded-xl border border-indigo-700/50 overflow-hidden bg-indigo-950/30">
                    <button
                      onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                      className="py-3.5 text-indigo-200 hover:text-white hover:bg-indigo-900/40 font-bold text-sm transition-all flex items-center justify-center gap-2 active:bg-indigo-900"
                    >
                      <Mail className="w-5 h-5 text-indigo-400" />
                      {showPasswordLogin ? "收起" : "邮箱+密码登录"}
                    </button>
                    <AnimatePresence>
                      {showPasswordLogin && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 pt-2 space-y-3">
                            <div className="flex gap-2 text-xs">
                              <button onClick={() => setPwMode('login')} className={`flex-1 py-1.5 rounded-lg font-bold transition-colors ${pwMode==='login' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>已有账号→登录</button>
                              <button onClick={() => setPwMode('register')} className={`flex-1 py-1.5 rounded-lg font-bold transition-colors ${pwMode==='register' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>全新注册</button>
                            </div>
                            {pwMode === 'login' && (
                              <p className="text-[10px] text-indigo-400/80 leading-relaxed">
                                💡 已绑定Google账号的用户：填写Google邮箱 + 绑定时设的密码，点「已有账号→登录」
                              </p>
                            )}
                            <input type="email" placeholder="邮箱地址" value={pwEmail} onChange={e => setPwEmail(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            <input type="password" placeholder="密码（至少6位）" value={pwPassword} onChange={e => setPwPassword(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            {pwMode === 'register' && (
                              <input type="password" placeholder="确认密码" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            )}
                            <button
                              onClick={pwMode === 'login' ? handlePasswordLogin : handlePasswordRegister}
                              disabled={isLoggingIn}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : (pwMode === 'login' ? '登录' : '注册')}
                            </button>
                            {pwMode === 'login' && (
                              <button onClick={handleForgotPassword} type="button"
                                className="w-full text-center text-xs text-zinc-600 hover:text-indigo-400 transition-colors py-1">
                                忘记密码？发送重置邮件
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Guide: Already have Google account → show Safari instructions */}
                  <button
                    onClick={() => setShowSafariGuide(true)}
                    className="py-3 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-zinc-800 active:scale-95"
                  >
                    <LogIn className="w-4 h-4 text-zinc-500" />
                    绑定已有 Google 账号
                  </button>

                  {/* Guest */}
                  <button
                    onClick={handleGuestLogin}
                    disabled={isLoggingIn}
                    className="py-2.5 bg-zinc-950/50 text-zinc-600 hover:text-zinc-400 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-zinc-800/50 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <UserIcon className="w-4 h-4" />
                    以游客身份继续（数据不同步）
                  </button>
                </>
              ) : (
                <>
                  {/* Non-PWA: Google login works normally */}
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="group relative overflow-hidden py-3.5 sm:py-4 bg-white text-black rounded-xl font-black text-base sm:text-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-70 disabled:pointer-events-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 flex items-center gap-3">
                      <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
                      Google 同步登录
                    </span>
                  </button>

                  {/* Email + Password - alternative */}
                  <div className="flex flex-col rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
                    <button
                      onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                      className="py-3 sm:py-3.5 text-zinc-300 hover:text-white hover:bg-zinc-800 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 active:bg-zinc-700"
                    >
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                      {showPasswordLogin ? "收起" : "邮箱+密码登录"}
                    </button>
                    <AnimatePresence>
                      {showPasswordLogin && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 pt-2 space-y-3">
                            <div className="flex gap-2 text-xs">
                              <button onClick={() => setPwMode('login')} className={`flex-1 py-1.5 rounded-lg font-bold transition-colors ${pwMode==='login' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>登录</button>
                              <button onClick={() => setPwMode('register')} className={`flex-1 py-1.5 rounded-lg font-bold transition-colors ${pwMode==='register' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>注册新账号</button>
                            </div>
                            <input type="email" placeholder="邮箱地址" value={pwEmail} onChange={e => setPwEmail(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            <input type="password" placeholder="密码（至少6位）" value={pwPassword} onChange={e => setPwPassword(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            {pwMode === 'register' && (
                              <input type="password" placeholder="确认密码" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                            )}
                            <button
                              onClick={pwMode === 'login' ? handlePasswordLogin : handlePasswordRegister}
                              disabled={isLoggingIn}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : (pwMode === 'login' ? '登录' : '注册')}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Guest */}
                  <button
                    onClick={handleGuestLogin}
                    disabled={isLoggingIn}
                    className="py-3 sm:py-3.5 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-zinc-800/50 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    以游客身份继续
                  </button>
                </>
              )}
            </div>
            <p className="text-[10px] text-zinc-700 max-w-[18rem] mx-auto leading-relaxed">
              {isStandaloneMode
                ? "* iOS \u6850\u9762\u7248\u8bf7\u4f7f\u7528\u90ae\u7bb1+\u5bc6\u7801\u767b\u5f55\u4ee5\u540c\u6b65\u6570\u636e\u3002\u9996\u6b21\u4f7f\u7528Google\u8d26\u53f7\uff0c\u8bf7\u5148\u70b9\u51fb\u3010\u5728\u6d4f\u89c8\u5668\u4e2d\u767b\u5f55\u5e76\u7ed1\u5b9a\u5bc6\u7801\u3011\u3002"
                : "* 游客身份数据仅保留在当前设备。邮箱+密码或 Google 可同步多端进度。"
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (firestoreError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans safe-top safe-bottom">
        <div className="max-w-md w-full bg-zinc-900 border border-rose-500/30 rounded-2xl p-5 sm:p-8 text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">数据库连接异常</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            我们无法连接到命运数据库。这可能是由于权限配置或网络问题导致的。
          </p>
          <div className="bg-black/40 p-4 rounded-lg text-left text-[10px] font-mono text-rose-400 overflow-auto max-h-40">
            {JSON.stringify(firestoreError, null, 2)}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (firebaseInitError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans safe-top safe-bottom">
        <div className="max-w-md w-full bg-zinc-900 border border-amber-500/30 rounded-2xl p-5 sm:p-8 text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">本地配置未完成</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            应用已避免白屏，但当前缺少 Firebase 前端环境变量，所以登录和数据功能暂时不可用。
          </p>
          <div className="bg-black/40 p-4 rounded-lg text-left text-[11px] font-mono text-amber-300 overflow-auto">
            {firebaseInitError}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'STORY_SELECT') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative safe-top safe-bottom">
        {pwaUpdateModal}
        <GlobalError errorMsg={errorMsg} />
        <div className="absolute left-4 right-4 top-4 sm:left-auto sm:right-6 sm:top-6 flex items-center justify-end gap-2">
          <div className="text-right min-w-0 mr-1">
            <div className="text-xs text-zinc-500">已登录</div>
            <div className="text-sm font-medium text-zinc-300 truncate max-w-[120px]">{user.isAnonymous ? "游客用户" : (user.displayName || user.email)}</div>
          </div>
          {!user.isAnonymous && auth?.currentUser?.providerData?.some(p => p.providerId === 'google.com') && (
            <button
              onClick={() => setShowLinkModal(true)}
              title="绑定邮箱密码，实现iOS PWA同步"
              className="p-2 bg-zinc-900 border border-indigo-800/60 rounded-lg hover:border-indigo-500 transition-colors"
            >
              <Mail className="w-4 h-4 text-indigo-400" />
            </button>
          )}
          <button aria-label="退出登录" onClick={handleLogout} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
            <LogOut className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="max-w-4xl w-full space-y-6 sm:space-y-8 pt-14 sm:pt-0">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white">作品库</h1>
            <p className="text-zinc-400">像卡带一样导入作品，即刻游玩。</p>
          </div>

          <InstallAppBanner
            canInstall={Boolean(installPromptEvent)}
            isStandalone={isStandaloneMode}
            onInstall={handleInstallApp}
          />

          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <button
              onClick={() => { refreshStories(); }}
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 text-zinc-200 font-bold"
            >
              {isLoadingStories ? '加载中...' : '刷新作品库'}
            </button>
            <button
              onClick={() => setGameState('THEME_SELECTION')}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-black"
            >
              快速生成新故事
            </button>
            <button
              onClick={enterAuthoring}
              className="px-5 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-black"
            >
              作者后台
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="font-bold text-white">公开作品</div>
                <div className="text-xs text-zinc-500">点击即导入并开始游玩</div>
              </div>
              <div className="space-y-3">
                {(publicStories || []).length === 0 ? (
                  <div className="text-sm text-zinc-500">暂无公开作品。点击“刷新作品库”。</div>
                ) : (
                  publicStories.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => startStoryPlay(s.id)}
                      className="w-full text-left p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-indigo-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="font-bold text-zinc-100 break-words">{formatBookTitle(s.title)}</div>
                        <div className="text-xs text-zinc-500 whitespace-nowrap">人气 {s.popularity || 0}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(s.tags || []).slice(0, DISPLAY_TAG_LIMIT).map((t: string, index: number) => (
                          <span key={`${t || 'tag'}-${index}`} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">{t}</span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="font-bold text-white">分享码导入</div>
              <div className="text-xs text-zinc-500">MVP：暂用 storyId 作为分享码。仅公开或未列出的作品可被导入。</div>
              <input
                value={storyImportCode}
                onChange={(e) => setStoryImportCode(e.target.value)}
                placeholder="输入分享ID（storyId）"
                aria-label="输入分享故事 ID"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => storyImportCode.trim() && startStoryPlay(storyImportCode.trim())}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold"
              >
                导入并游玩
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'AUTHORING') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 font-sans">
        {pwaUpdateModal}
        <GlobalError errorMsg={errorMsg} />
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (blueprint) {
                    setGameState('PLAYING');
                  } else {
                    setGameState('STORY_SELECT');
                  }
                }} 
                className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors"
                aria-label="返回"
              >
                <ChevronLeft className="w-6 h-6 text-zinc-400 hover:text-white" />
              </button>
              <div>
                <div className="text-xs text-zinc-500">作者后台</div>
                <div className="text-2xl font-black text-white">作品编辑器</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={authoringSaving}
                onClick={async () => {
                  if (!user) return;
                  setAuthoringSaving(true);
                  try {
                    const id = await createEmptyStory(db as any, { authorId: user.uid, tags: [] });
                    await refreshStories();
                    setAuthoringStoryId(id);
                    const c = await getStoryCartridge(db as any, id);
                    setAuthoringCartridge(c);
                    showError('作品已创建。');
                  } catch (e: any) {
                    console.error(e);
                    showError(`新建作品失败：${e?.message || String(e)}`);
                  } finally {
                    setAuthoringSaving(false);
                  }
                }}
                className="px-4 py-2 bg-white text-black rounded-lg font-bold disabled:opacity-50"
              >
                {authoringSaving ? '创建中...' : '新建作品'}
              </button>
              <button
                disabled={!authoringStoryId || authoringSaving}
                onClick={async () => {
                  if (!authoringStoryId) return;
                  setAuthoringSaving(true);
                  try {
                    await deleteStoryCartridge(db as any, authoringStoryId);
                    showError('作品已删除。');
                    setAuthoringStoryId(null);
                    setAuthoringCartridge(null);
                    await refreshStories();
                  } catch (e: any) {
                    console.error(e);
                    showError(`删除失败：${e?.message || String(e)}`);
                  } finally {
                    setAuthoringSaving(false);
                  }
                }}
                className="px-4 py-2 bg-zinc-900 border border-rose-500/30 text-rose-300 rounded-lg text-sm disabled:opacity-50"
              >
                删除作品
              </button>
              <button onClick={refreshStories} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm">{isLoadingStories ? '加载中...' : '刷新'}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="font-bold text-white">我的作品</div>
              {(myStories || []).length === 0 ? (
                <div className="text-sm text-zinc-500">还没有作品。点击“新建作品”。</div>
              ) : (
                myStories.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      setAuthoringStoryId(s.id);
                      const c = await getStoryCartridge(db as any, s.id);
                      setAuthoringCartridge(c);
                      setAuthoringTab('mainline');
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${authoringStoryId === s.id ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-600'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-zinc-100 truncate">{formatBookTitle(s.title)}</div>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${s.visibility === 'public' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : s.visibility === 'unlisted' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                        {s.visibility === 'public' ? '公开' : s.visibility === 'unlisted' ? '未列出' : '私有'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {(s.tags || []).slice(0, DISPLAY_TAG_LIMIT).map((tag: string, index: number) => (
                          <span key={`${tag || 'tag'}-${index}`} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-700">{tag}</span>
                        ))}
                      </div>
                      <div className="text-[10px] text-zinc-500 whitespace-nowrap">人气 {s.popularity || 0}</div>
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">分享ID：{s.id}</div>
                  </button>
                ))
              )}
            </div>

            <div className="lg:col-span-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
              {!authoringCartridge ? (
                <div className="text-sm text-zinc-500">请选择左侧作品进行编辑。</div>
              ) : (
                <>
                  <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500">当前作品分享ID</div>
                      <div className="text-sm font-mono text-zinc-200 break-all">{authoringStoryId || '（未选择作品）'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!authoringStoryId) return;
                          try {
                            await navigator.clipboard.writeText(authoringStoryId);
                            showError('分享ID已复制。');
                          } catch {
                            showError('复制失败，请手动复制。');
                          }
                        }}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> 复制ID
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuthoringTab('mainline')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold ${authoringTab === 'mainline' ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}
                    >
                      Tab1 主线设置
                    </button>
                    <button
                      onClick={() => setAuthoringTab('branches')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold ${authoringTab === 'branches' ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}
                    >
                      Tab2 支线设置
                    </button>
                  </div>

                  {authoringTab === 'mainline' && (
                    <div className="space-y-6">
                      <div className="space-y-3 bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4">
                        <div className="font-bold text-white">一键导入（粘贴 AI 全文）</div>
                        <div className="text-xs text-zinc-500">支持按“主线设置 / 支线设置”范本格式自动解析并写入。导入后会自动保存到当前作品。</div>
                        <textarea
                          value={authoringImportText}
                          onChange={(e) => setAuthoringImportText(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm min-h-[220px]"
                          placeholder="把其他 AI 生成的完整文本粘贴到这里..."
                        />
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={authoringImportReplaceBranches}
                            onChange={(e) => setAuthoringImportReplaceBranches(e.target.checked)}
                          />
                          导入时覆盖当前所有支线（不勾选则追加）
                        </label>
                        <button
                          disabled={authoringSaving || !authoringImportText.trim()}
                          onClick={runOneClickImport}
                          className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50"
                        >
                          一键导入并自动填充
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="text-lg font-black text-white">主线设置</div>
                        <div className="text-xs text-zinc-500">每章字数限制：1200 字（超出部分不会阻止输入，但建议控制）。</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="text-xs text-zinc-400 space-y-1">
                            <div>作品公开状态</div>
                            <select
                              value={authoringCartridge.meta.visibility || 'private'}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, visibility: e.target.value } }))}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                            >
                              <option value="private">私有（仅自己可见）</option>
                              <option value="unlisted">未列出（知道分享 ID 才可访问）</option>
                              <option value="public">公开（出现在作品库）</option>
                            </select>
                          </label>
                          <div className="text-xs text-zinc-500 flex items-end">切换后请点击“一键保存主线+结局”生效。</div>
                        </div>
                        <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-indigo-500">
                          <span className="text-zinc-500">《</span>
                          <input
                            value={stripBookTitle(authoringCartridge.meta.title || '')}
                            onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, title: stripBookTitle(e.target.value) } }))}
                            className="w-full bg-transparent px-2 py-2 text-sm outline-none"
                            placeholder="作品标题"
                          />
                          <span className="text-zinc-500">》</span>
                        </div>
                        <textarea
                          value={authoringCartridge.meta.main_axis || ''}
                          onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, main_axis: e.target.value } }))}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 min-h-[80px]"
                          placeholder="主轴/命题"
                        />
                        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                          <div className="font-bold text-white">作品主题</div>
                          <div className="text-xs text-zinc-500">可点选推荐标签，也可手写补充。多个标签请用中文逗号“，”分隔。</div>
                          <div className="flex flex-wrap gap-2">
                            {THEMES.map((theme) => {
                              const active = (authoringCartridge.meta.tags || []).includes(theme);
                              return (
                                <button
                                  key={theme}
                                  type="button"
                                  onClick={() => toggleAuthoringTag(theme)}
                                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${active ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}
                                >
                                  {theme}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            value={authoringCustomTagsInput}
                            onChange={(e) => setAuthoringCustomTagsInput(e.target.value)}
                            onBlur={(e) => commitAuthoringCustomTags(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500"
                            placeholder="手写主题，例如：群像，成长，悬疑"
                          />
                        </div>
                        <button
                          disabled={authoringSaving}
                          onClick={async () => {
                            if (!authoringStoryId) return;
                            setAuthoringSaving(true);
                            try {
                              const normalizedChars = normalizeCharacters(authoringCartridge.meta.characters || []);
                              const endingMode = authoringCartridge.meta.endingMode || 'dual';
                              const normalizedTags = parseTagInput(authoringCustomTagsInput || (authoringCartridge.meta.tags || []).join('，'));
                              await saveStoryMainlineBundle(db as any, authoringStoryId, {
                                metaPatch: {
                                  ...authoringCartridge.meta,
                                  title: stripBookTitle(authoringCartridge.meta.title || ''),
                                  tags: normalizedTags,
                                  characters: normalizedChars,
                                  defaults: { ...authoringCartridge.meta.defaults, targetWordCount: 1200 },
                                } as any,
                                chapters: (authoringCartridge.chapters || []).filter((c: any) => c.chapter_num >= 1 && c.chapter_num <= 6).map((c: any) => ({
                                  chapter_num: c.chapter_num,
                                  title: c.title || `第${c.chapter_num}章`,
                                  summary: c.summary || '',
                                  present_characters: normalizedChars.map((x: any) => x.id),
                                  text: (c.text || '').slice(0, 1200),
                                })),
                                endings: (authoringCartridge.endings || [])
                                  .filter((e: any) => endingMode === 'dual' ? true : e.id === 'default')
                                  .map((e: any) => ({ id: e.id, title: e.title || endingIdToLabel(e.id), text: (e.text || '').slice(0, 1200) })),
                              });
                              setAuthoringCustomTagsInput(normalizedTags.join('，'));
                              showError('主线与结局已整体保存。');
                              const c = await getStoryCartridge(db as any, authoringStoryId);
                              setAuthoringCartridge(c);
                              await refreshStories();
                            } catch (e: any) {
                              console.error(e);
                              showError(`保存失败：${e?.message || String(e)}`);
                            } finally {
                              setAuthoringSaving(false);
                            }
                          }}
                          className="px-4 py-2 bg-white text-black rounded-lg font-bold disabled:opacity-50"
                        >
                          一键保存主线+结局
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="font-bold text-white">结局模式与主线结局率（0-80）</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select
                            value={authoringCartridge.meta.endingMode || 'dual'}
                            onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, endingMode: e.target.value } }))}
                            className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                          >
                            <option value="dual">双向结局创作（左/右）</option>
                            <option value="single">单一结局创作（仅默认）</option>
                          </select>
                          <div className="text-xs text-zinc-500 flex items-center">
                            双向模式下：用于决定左/右更易触发（0-80），并用于分配支线结局率。
                          </div>
                        </div>

                        {(authoringCartridge.meta.endingMode || 'dual') === 'dual' && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="text-xs text-zinc-400 space-y-1">
                                <div>左结局主线结局率（0-80）</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={80}
                                  value={authoringCartridge.meta.endingRates?.left ?? 40}
                                  onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, endingRates: { ...(prev.meta.endingRates || {}), left: Math.max(0, Math.min(80, Number(e.target.value) || 0)) } } }))}
                                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                                />
                              </label>
                              <label className="text-xs text-zinc-400 space-y-1">
                                <div>右结局主线结局率（0-80）</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={80}
                                  value={authoringCartridge.meta.endingRates?.right ?? 40}
                                  onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, endingRates: { ...(prev.meta.endingRates || {}), right: Math.max(0, Math.min(80, Number(e.target.value) || 0)) } } }))}
                                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                                />
                              </label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="text-xs text-zinc-400 space-y-1">
                                <div>左结局展示名（玩家总结「XX结局」，≤5字）</div>
                                <input
                                  value={authoringCartridge.meta.endingNames?.left || ''}
                                  onChange={(e) => updateAuthoringEndingName('left', e.target.value, { composing: (e.nativeEvent as any).isComposing })}
                                  onCompositionEnd={(e) => updateAuthoringEndingName('left', e.currentTarget.value)}
                                  onBlur={(e) => updateAuthoringEndingName('left', e.target.value)}
                                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                                  placeholder="如：黎明"
                                />
                              </label>
                              <label className="text-xs text-zinc-400 space-y-1">
                                <div>右结局展示名（玩家总结「XX结局」，≤5字）</div>
                                <input
                                  value={authoringCartridge.meta.endingNames?.right || ''}
                                  onChange={(e) => updateAuthoringEndingName('right', e.target.value, { composing: (e.nativeEvent as any).isComposing })}
                                  onCompositionEnd={(e) => updateAuthoringEndingName('right', e.currentTarget.value)}
                                  onBlur={(e) => updateAuthoringEndingName('right', e.target.value)}
                                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                                  placeholder="如：永夜"
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="font-bold text-white">主要角色（可干涉角色）</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAuthoringCartridge((prev: any) => {
                              const current = prev.meta.characters || [];
                              if (current.length <= 1) return prev;
                              return { ...prev, meta: { ...prev.meta, characters: current.slice(0, current.length - 1) } };
                            })}
                            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs"
                          >
                            - 角色
                          </button>
                          <button
                            onClick={() => setAuthoringCartridge((prev: any) => {
                              const current = prev.meta.characters || [];
                              if (current.length >= 5) return prev;
                              return { ...prev, meta: { ...prev.meta, characters: [...current, { name: `角色${current.length + 1}`, desc: '（待填写简介）' }] } };
                            })}
                            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs"
                          >
                            + 角色
                          </button>
                          <div className="text-xs text-zinc-500">默认 3 人，可减到 1，加到 5。</div>
                        </div>
                        {(authoringCartridge.meta.characters || []).map((ch: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              value={ch.name || ''}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, characters: prev.meta.characters.map((x: any, i: number) => i === idx ? { ...x, name: e.target.value } : x) } }))}
                              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                              placeholder="角色名"
                            />
                            <input
                              value={ch.desc || ''}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, characters: prev.meta.characters.map((x: any, i: number) => i === idx ? { ...x, desc: e.target.value } : x) } }))}
                              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                              placeholder="角色简介"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="font-bold text-white">默认故事（1-6章）</div>
                        {(authoringCartridge.chapters || []).filter((c: any) => c.chapter_num >= 1 && c.chapter_num <= 6).map((ch: any) => (
                          <div key={ch.chapter_num} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                            <div className="font-bold text-zinc-200">{formatStoryHeading(ch)}</div>
                            <input
                              value={ch.title || ''}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, chapters: prev.chapters.map((c: any) => c.chapter_num === ch.chapter_num ? { ...c, title: e.target.value } : c) }))}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                              placeholder="章节标题"
                            />
                            <textarea
                              value={ch.text || ''}
                              maxLength={1200}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, chapters: prev.chapters.map((c: any) => c.chapter_num === ch.chapter_num ? { ...c, text: e.target.value } : c) }))}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm min-h-[120px]"
                              placeholder="本章正文"
                            />
                            <div className="text-[10px] text-zinc-500">{countChars(ch.text || '')} / 1200</div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="font-bold text-white">结局设置（默认 / 左 / 右）</div>
                        {(authoringCartridge.endings || [])
                          .filter((ed: any) => (authoringCartridge.meta.endingMode || 'dual') === 'dual' ? true : ed.id === 'default')
                          .map((ed: any) => (
                          <div key={ed.id} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                            <div className="font-bold text-zinc-200">{endingIdToLabel(ed.id)}</div>
                            <input
                              value={ed.title || ''}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, endings: prev.endings.map((x: any) => x.id === ed.id ? { ...x, title: e.target.value } : x) }))}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                              placeholder={ed.id === 'default' ? '第七章标题' : `${endingIdToLabel(ed.id)}标题`}
                            />
                            <textarea
                              value={ed.text || ''}
                              maxLength={1200}
                              onChange={(e) => setAuthoringCartridge((prev: any) => ({ ...prev, endings: prev.endings.map((x: any) => x.id === ed.id ? { ...x, text: e.target.value } : x) }))}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm min-h-[120px]"
                            />
                            <div className="text-[10px] text-zinc-500">{countChars(ed.text || '')} / 1200</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {authoringTab === 'branches' && (
                    <div className="space-y-5">
                      <div className="text-lg font-black text-white">支线设置</div>
                      <div className="text-xs text-zinc-500">每条支线情节限制 300 字。后台结构由系统自动映射，不展示 JSON。</div>
                      <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-white">新建支线</div>
                          <div className="text-xs text-zinc-500">ID 后台自动生成</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input value={branchForm.name} onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="支线名" />
                          <label className="flex items-center gap-2 text-xs text-zinc-400 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg">
                            <input type="checkbox" checked={(branchForm as any).common || false} onChange={(e) => setBranchForm(prev => ({ ...(prev as any), common: e.target.checked }))} />
                            通用（未来可跨故事复用）
                          </label>
                          <select value={branchForm.side} onChange={(e) => setBranchForm(prev => ({ ...prev, side: e.target.value as any }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                            <option value="left">支线倾向：左</option>
                            <option value="right">支线倾向：右</option>
                          </select>
                          <select value={branchForm.tier} onChange={(e) => setBranchForm(prev => ({ ...prev, tier: e.target.value as any }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                            <option value="small">支线影响：小</option>
                            <option value="medium">支线影响：中</option>
                            <option value="large">支线影响：大</option>
                            <option value="hidden">支线影响：隐</option>
                          </select>
                          <input value={branchForm.hint} onChange={(e) => setBranchForm(prev => ({ ...prev, hint: e.target.value }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="提示短句（可选）" />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-zinc-300">触发条件（全部达成才触发，最多3组）</div>
                            <button
                              onClick={() => {
                                if (branchConditions.length >= 3) return;
                                setBranchConditions(prev => [...prev, {
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
                              className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs"
                            >
                              + 条件组
                            </button>
                          </div>
                          {branchConditions.map((cond, idx) => (
                            <div key={idx} className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-500">条件组 {idx + 1}</div>
                                {branchConditions.length > 1 && (
                                  <button
                                    onClick={() => setBranchConditions(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded"
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                              <select
                                value={cond.kind}
                                onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, kind: e.target.value as 'single' | 'count' } : c))}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"
                              >
                                <option value="single">指定章节+角色+干涉</option>
                                <option value="count">指定章节时累计次数达标</option>
                              </select>
                              {cond.kind === 'single' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <select value={cond.singleChapterNum} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleChapterNum: Number(e.target.value) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    {chapterOptions.map(n => <option key={n} value={n}>第{n}章</option>)}
                                  </select>
                                  <select value={cond.singleCharId} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleCharId: e.target.value } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="">选择角色</option>
                                    {normalizeCharacters(authoringCartridge.meta.characters || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <select value={cond.singleAction} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleAction: e.target.value as 'bless' | 'curse' } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="bless">庇佑</option>
                                    <option value="curse">磨难</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <select value={cond.upToChapterNum} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, upToChapterNum: Number(e.target.value) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    {chapterOptions.map(n => <option key={n} value={n}>第{n}章结算</option>)}
                                  </select>
                                  <select value={cond.countCharId} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, countCharId: e.target.value } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="">选择角色</option>
                                    {normalizeCharacters(authoringCartridge.meta.characters || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <select value={cond.countAction} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, countAction: e.target.value as 'bless' | 'curse' } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="bless">庇佑累计</option>
                                    <option value="curse">磨难累计</option>
                                  </select>
                                  <input type="number" min={1} value={cond.minCount} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, minCount: Math.max(1, Number(e.target.value) || 1) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="累计次数≥" />
                                </div>
                              )}
                              <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                {triggerPreview({
                                  triggerType: cond.kind,
                                  singleChapterNum: cond.singleChapterNum,
                                  singleCharId: cond.singleCharId,
                                  singleAction: cond.singleAction,
                                  countCharId: cond.countCharId,
                                  countAction: cond.countAction,
                                  minCount: cond.minCount,
                                  upToChapterNum: cond.upToChapterNum,
                                  characters: normalizeCharacters(authoringCartridge.meta.characters || []),
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-zinc-300">支线情节（300字）</div>
                          <textarea
                            value={branchForm.sceneText}
                            maxLength={300}
                            onChange={(e) => setBranchForm(prev => ({ ...prev, sceneText: e.target.value.slice(0, 300) }))}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm min-h-[120px]"
                            placeholder="填写支线情节"
                          />
                          <div className="text-[10px] text-zinc-500">{countChars(branchForm.sceneText)} / 300</div>
                        </div>

                        <button
                          onClick={async () => {
                            if (!authoringStoryId || !branchForm.name) {
                              showError('请填写支线名。');
                              return;
                            }
                            const normalizedConditions = branchConditions.slice(0, 3).map((c) =>
                              c.kind === 'single'
                                ? {
                                    type: 'single' as const,
                                    single: {
                                      chapterNum: Math.max(2, Math.min(6, c.singleChapterNum)),
                                      charId: c.singleCharId,
                                      action: c.singleAction,
                                    },
                                  }
                                : {
                                    type: 'count' as const,
                                    count: {
                                      charId: c.countCharId,
                                      action: c.countAction,
                                      minCount: Math.max(1, c.minCount),
                                      upToChapterNum: Math.max(2, Math.min(6, c.upToChapterNum)),
                                    },
                                  }
                            );
                            const trigger = normalizedConditions[0];
                            const branchDoc = {
                              side: branchForm.side,
                              tier: branchForm.tier,
                              name: branchForm.name,
                              hint: branchForm.hint || `留意${branchForm.name}`,
                              desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
                              common: (branchForm as any).common || false,
                              trigger,
                              triggerGroups: normalizedConditions,
                              inject: {
                                mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [],
                                mustReveal: [],
                                mustChange: [],
                              },
                              sceneText: branchForm.sceneText,
                            };
                            const newId = await createStoryBranch(db as any, authoringStoryId, branchDoc as any);
                            showError('支线已创建。');
                            const c = await getStoryCartridge(db as any, authoringStoryId);
                            setAuthoringCartridge(c);
                            setExpandedBranchId(newId);
                            setSelectedBranchId(newId);
                          }}
                          className="px-4 py-2 bg-white text-black rounded-lg font-bold"
                        >
                          创建支线
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(authoringCartridge.branches || []).map((b: any) => (
                          <div
                            key={b.id}
                            className="bg-zinc-950/50 border border-zinc-800 rounded-xl"
                          >
                            <div className="p-3 flex items-center justify-between">
                              <div className="font-bold text-zinc-200">{b.name} <span className="text-xs text-zinc-500">({b.side}/{b.tier})</span></div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setExpandedBranchId(expandedBranchId === b.id ? null : b.id);
                                    setSelectedBranchId(b.id);
                                    const loadedConditions: ConditionForm[] = (b.triggerGroups && Array.isArray(b.triggerGroups) && b.triggerGroups.length > 0
                                      ? b.triggerGroups
                                      : [b.trigger || { type: 'single', single: { chapterNum: 2, charId: '', action: 'bless' } }])
                                      .slice(0, 3)
                                      .map((t: any) => t.type === 'count'
                                        ? {
                                            kind: 'count',
                                            singleChapterNum: 2,
                                            singleCharId: '',
                                            singleAction: 'bless',
                                            countCharId: t.count?.charId || '',
                                            countAction: t.count?.action || 'bless',
                                            minCount: t.count?.minCount || 1,
                                            upToChapterNum: t.count?.upToChapterNum || 6,
                                          }
                                        : {
                                            kind: 'single',
                                            singleChapterNum: t.single?.chapterNum || 2,
                                            singleCharId: t.single?.charId || '',
                                            singleAction: t.single?.action || 'bless',
                                            countCharId: '',
                                            countAction: 'bless',
                                            minCount: 1,
                                            upToChapterNum: 6,
                                          });
                                    setBranchConditions(loadedConditions);
                                    setBranchForm((prev: any) => ({
                                      ...prev,
                                      name: b.name || '',
                                      side: b.side || 'left',
                                      tier: b.tier || 'small',
                                      hint: b.hint || '',
                                      sceneText: b.sceneText || '',
                                      common: Boolean(b.common),
                                    }));
                                  }}
                                  aria-label={expandedBranchId === b.id ? `收起支线 ${b.name}` : `展开支线 ${b.name}`}
                                  className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg"
                                  title="展开/收起"
                                >
                                  {expandedBranchId === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!authoringStoryId) return;
                                    await deleteStoryBranch(db as any, authoringStoryId, b.id);
                                    const c = await getStoryCartridge(db as any, authoringStoryId);
                                    setAuthoringCartridge(c);
                                    if (expandedBranchId === b.id) {
                                      setExpandedBranchId(null);
                                      setSelectedBranchId(null);
                                    }
                                    showError('支线已删除。');
                                  }}
                                  aria-label={`删除支线 ${b.name}`}
                                  className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg"
                                  title="删除支线"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-400" />
                                </button>
                              </div>
                            </div>

                            {expandedBranchId === b.id && (
                              <div className="px-3 pb-3 space-y-3">
                                <div className="text-xs text-zinc-500">在此展开编辑，确认或取消后自动收起。</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <input value={branchForm.name} onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="支线名" />
                                  <label className="flex items-center gap-2 text-xs text-zinc-400 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg">
                                    <input type="checkbox" checked={(branchForm as any).common || false} onChange={(e) => setBranchForm(prev => ({ ...(prev as any), common: e.target.checked }))} />
                                    通用（未来可跨故事复用）
                                  </label>
                                  <select value={branchForm.side} onChange={(e) => setBranchForm(prev => ({ ...prev, side: e.target.value as any }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="left">支线倾向：左</option>
                                    <option value="right">支线倾向：右</option>
                                  </select>
                                  <select value={branchForm.tier} onChange={(e) => setBranchForm(prev => ({ ...prev, tier: e.target.value as any }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                    <option value="small">支线影响：小</option>
                                    <option value="medium">支线影响：中</option>
                                    <option value="large">支线影响：大</option>
                                    <option value="hidden">支线影响：隐</option>
                                  </select>
                                  <input value={branchForm.hint} onChange={(e) => setBranchForm(prev => ({ ...prev, hint: e.target.value }))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="提示短句（可选）" />
                                </div>
                                <div className="space-y-3">
                                  <div className="text-sm text-zinc-300">触发条件（全部达成才触发，最多3组）</div>
                                  {branchConditions.map((cond, idx) => (
                                    <div key={idx} className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-3 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs text-zinc-500">条件组 {idx + 1}</div>
                                        {branchConditions.length > 1 && (
                                          <button onClick={() => setBranchConditions(prev => prev.filter((_, i) => i !== idx))} className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded">删除</button>
                                        )}
                                      </div>
                                      <select value={cond.kind} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, kind: e.target.value as 'single' | 'count' } : c))} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">
                                        <option value="single">指定章节+角色+干涉</option>
                                        <option value="count">指定章节时累计次数达标</option>
                                      </select>
                                      {cond.kind === 'single' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <select value={cond.singleChapterNum} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleChapterNum: Number(e.target.value) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">{chapterOptions.map(n => <option key={n} value={n}>第{n}章</option>)}</select>
                                          <select value={cond.singleCharId} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleCharId: e.target.value } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"><option value="">选择角色</option>{normalizeCharacters(authoringCartridge.meta.characters || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                          <select value={cond.singleAction} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, singleAction: e.target.value as 'bless' | 'curse' } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"><option value="bless">庇佑</option><option value="curse">磨难</option></select>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                          <select value={cond.upToChapterNum} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, upToChapterNum: Number(e.target.value) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm">{chapterOptions.map(n => <option key={n} value={n}>第{n}章结算</option>)}</select>
                                          <select value={cond.countCharId} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, countCharId: e.target.value } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"><option value="">选择角色</option>{normalizeCharacters(authoringCartridge.meta.characters || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                          <select value={cond.countAction} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, countAction: e.target.value as 'bless' | 'curse' } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm"><option value="bless">庇佑累计</option><option value="curse">磨难累计</option></select>
                                          <input type="number" min={1} value={cond.minCount} onChange={(e) => setBranchConditions(prev => prev.map((c, i) => i === idx ? { ...c, minCount: Math.max(1, Number(e.target.value) || 1) } : c))} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm" placeholder="累计次数≥" />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {branchConditions.length < 3 && (
                                    <button onClick={() => setBranchConditions(prev => [...prev, { kind: 'single', singleChapterNum: 2, singleCharId: '', singleAction: 'bless', countCharId: '', countAction: 'bless', minCount: 1, upToChapterNum: 6 }])} className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs">+ 条件组</button>
                                  )}
                                  <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                    {branchConditions.map((cond, idx) => (
                                      <div key={idx}>{idx + 1}. {triggerPreview({ triggerType: cond.kind, singleChapterNum: cond.singleChapterNum, singleCharId: cond.singleCharId, singleAction: cond.singleAction, countCharId: cond.countCharId, countAction: cond.countAction, minCount: cond.minCount, upToChapterNum: cond.upToChapterNum, characters: normalizeCharacters(authoringCartridge.meta.characters || []) })}</div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="text-sm text-zinc-300">支线情节（300字）</div>
                                  <textarea
                                    value={branchForm.sceneText}
                                    maxLength={300}
                                    onChange={(e) => setBranchForm(prev => ({ ...prev, sceneText: e.target.value.slice(0, 300) }))}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm min-h-[110px]"
                                  />
                                  <div className="text-[10px] text-zinc-500">{countChars(branchForm.sceneText)} / 300</div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => {
                                      setExpandedBranchId(null);
                                      setSelectedBranchId(null);
                                    }}
                                    className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs flex items-center gap-2"
                                  >
                                    <X className="w-4 h-4" /> 取消
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!authoringStoryId || !selectedBranchId) return;
                                      const normalizedConditions = branchConditions.slice(0, 3).map((c) =>
                                        c.kind === 'single'
                                          ? {
                                              type: 'single' as const,
                                              single: {
                                                chapterNum: Math.max(2, Math.min(6, c.singleChapterNum)),
                                                charId: c.singleCharId,
                                                action: c.singleAction,
                                              },
                                            }
                                          : {
                                              type: 'count' as const,
                                              count: {
                                                charId: c.countCharId,
                                                action: c.countAction,
                                                minCount: Math.max(1, c.minCount),
                                                upToChapterNum: Math.max(2, Math.min(6, c.upToChapterNum)),
                                              },
                                            }
                                      );
                                      const trigger = normalizedConditions[0];
                                      const patch = {
                                        id: selectedBranchId,
                                        side: branchForm.side,
                                        tier: branchForm.tier,
                                        name: branchForm.name,
                                        hint: branchForm.hint || `留意${branchForm.name}`,
                                        desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
                                        common: (branchForm as any).common || false,
                                        trigger,
                                        triggerGroups: normalizedConditions,
                                        inject: {
                                          mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [],
                                          mustReveal: [],
                                          mustChange: [],
                                        },
                                        sceneText: branchForm.sceneText,
                                      };
                                      await upsertStoryBranch(db as any, authoringStoryId, selectedBranchId, patch as any);
                                      const c = await getStoryCartridge(db as any, authoringStoryId);
                                      setAuthoringCartridge(c);
                                      showError('已更新支线。');
                                      setExpandedBranchId(null);
                                      setSelectedBranchId(null);
                                    }}
                                    className="px-3 py-2 bg-white text-black rounded-lg text-xs font-bold flex items-center gap-2"
                                  >
                                    <Check className="w-4 h-4" /> 确认
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'THEME_SELECTION') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative safe-top safe-bottom">
        {pwaUpdateModal}
        <GlobalError errorMsg={errorMsg} />
        <div className="absolute left-4 right-4 top-4 sm:left-auto sm:right-6 sm:top-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="text-left sm:text-right min-w-0">
            <div className="text-xs text-zinc-500">已登录</div>
            <div className="text-sm font-medium text-zinc-300 truncate">{user.isAnonymous ? "游客用户" : user.displayName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGameState('STORY_SELECT')} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 hover:border-zinc-600 transition-colors">
              返回作品库
            </button>
            <button aria-label="退出登录" onClick={handleLogout} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
              <LogOut className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>
        <div className="max-w-2xl w-full space-y-6 sm:space-y-8 text-center pt-16 sm:pt-0">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center justify-center gap-3">
              <Wand2 className="w-8 h-8 text-indigo-400" />
              命运引擎
            </h1>
            <p className="text-zinc-400">请选择 1 到 4 个主题，AI 将为你生成一个专属的互动世界。</p>
          </div>

          <InstallAppBanner
            canInstall={Boolean(installPromptEvent)}
            isStandalone={isStandaloneMode}
            onInstall={handleInstallApp}
          />
          
          <div className="flex flex-wrap justify-center gap-3">
            {THEMES.map(theme => (
              <button
                key={theme}
                onClick={() => toggleTheme(theme)}
                className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                  selectedThemes.includes(theme) 
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          <div className="pt-8 space-y-6">
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">每章目标字数</span>
                <span className="text-indigo-400 font-mono font-bold">{targetWordCount} 字</span>
              </div>
              <input 
                type="range" 
                min="600" 
                max="1200" 
                step="100"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(parseInt(e.target.value))}
                aria-label="设置每章目标字数"
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
                <span>精简 (600)</span>
                <span>宏大 (1200)</span>
              </div>
            </div>

            <button
              onClick={handleGenerateBlueprint}
              disabled={selectedThemes.length < 1 || selectedThemes.length > 4}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
            >
              {selectedThemes.length < 1 ? '请至少选择 1 个主题' : '生成世界蓝图'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'GENERATING_BLUEPRINT') {
    return (
      <>
        {pwaUpdateModal}
        <LoadingOverlay 
          progress={generationProgress} 
          status={generationStatus} 
          subtext="由于您选择了较高的字数，这可能需要 1 到 2 分钟，请耐心等候命运的降临。"
        />
      </>
    );
  }

  if (gameState === 'PLAYING' && blueprint) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-12 font-sans relative pb-36 sm:pb-28 safe-top safe-bottom">
        {pwaUpdateModal}
        {actionMenuOverlay}
        {compactFloatingActionPanel}
        {storyInfoOverlay}

        <AnimatePresence>
          {activeInterventionOverlay && (
            <motion.div
              key={`overlay-${activeInterventionOverlay.type}-${activeInterventionOverlay.targetChapter}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-[1100]"
            >
              <LoadingOverlay 
                progress={generationProgress} 
                status={activeInterventionOverlay.statusRaw} 
                variant={activeInterventionOverlay.type}
                subtext={
                  activeInterventionOverlay.type === 'ending' 
                    ? "历史的收束线已全部凝结，请静候终章回响..." 
                    : "命运之轮高速旋转，正在推演新的可能..."
                }
              />
            </motion.div>
          )}
          {errorMsg && (
            <motion.div
              key={`error-${errorMsg}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed left-4 right-4 top-4 sm:left-1/2 sm:right-auto sm:top-6 sm:-translate-x-1/2 z-[100] bg-rose-500 text-white px-4 sm:px-6 py-3 rounded-lg shadow-lg font-medium text-center"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmationModal.isOpen && (
            <motion.div
              key={`confirm-${confirmationModal.title}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    {confirmationModal.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {confirmationModal.message}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
                    className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmationModal.onConfirm}
                    className="py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-colors shadow-lg"
                  >
                    确认
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary modal (no separate SUMMARY page; always overlays on PLAYING) */}
        <AnimatePresence>
          {showSummaryModal && blueprint && (
            <motion.div 
              key={`summary-modal-${summaryEntrySource || 'default'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="presentation"
              className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowSummaryModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                role="dialog"
                aria-modal="true"
                data-modal-root="true"
                tabIndex={-1}
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 sm:p-6 max-w-lg w-[calc(100%-2rem)] shadow-2xl flex flex-col items-center text-center space-y-5 sm:space-y-6 relative overflow-hidden max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="space-y-1 text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tighter">命运已定</h2>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">结局类别</div>
                  <div className={`text-lg font-black ${
                    uiFeedback.endingLabel === '秩序律' ? 'text-indigo-400' :
                    uiFeedback.endingLabel === '混沌终' ? 'text-rose-500' :
                    'text-zinc-400'
                  }`}>
                    {summaryEndingCategoryLabel({
                      endingMode: blueprint.endingMode,
                      endingNames: blueprint.endingNames,
                      endingLabel: uiFeedback.endingLabel,
                    })}
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <div className="bg-zinc-950/50 rounded-2xl p-5 border border-zinc-800 space-y-4 shadow-inner">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-indigo-400">左倾</span>
                          <span className="text-indigo-200">{uiFeedback.leftProgress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${uiFeedback.leftProgress}%` }} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1 text-right">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-rose-200">{uiFeedback.rightProgress.toFixed(0)}%</span>
                          <span className="text-rose-400">右倾</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${uiFeedback.rightProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">支线解锁</div>
                      <div className="text-xl font-bold text-indigo-400">{unlockedBranches.length} / {blueprint.branches.length}</div>
                    </div>
                    <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">干涉次数</div>
                      <div className="text-xl font-bold text-zinc-300">{3 - interventionsLeft} / 3</div>
                    </div>
                  </div>
                </div>

                <div className="min-h-[80px] flex items-center justify-center w-full">
                  {isGeneratingConclusion ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-sm">正在凝结命运的结语...</span>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-lg sm:text-xl font-serif italic text-zinc-200 leading-relaxed">
                      "{storyConclusion}"
                    </motion.div>
                  )}
                </div>

                <button
                  onClick={() => setShowSummaryModal(false)}
                  disabled={isGeneratingConclusion}
                  className="w-full py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white rounded-lg font-bold text-lg transition-colors"
                >
                  查看故事档案
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Left Sidebar: Status */}
          <div className={`lg:col-span-4 space-y-6 ${showCondensedStoryInfo ? 'hidden lg:block' : isSidebarOpen ? 'fixed inset-0 z-[210] bg-zinc-950 p-4 sm:p-6 overflow-y-auto safe-top safe-bottom' : 'hidden lg:block relative z-[210]'}`}>
            {isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(false)}
                aria-label="关闭故事信息"
                className="lg:hidden absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors border border-zinc-700 z-[220]"
              >
                <X className="w-6 h-6" />
              </button>
            )}
            {storyInfoPanel}
          </div>

          {/* Right Content: Chapters */}
          <div className="lg:col-span-8 space-y-6">
            {showCondensedStoryInfo && (
              <div className="pt-10 sm:pt-12">
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl px-5 py-4">
                  <h2 className="text-2xl font-bold text-white break-words pr-6">{blueprint.title}</h2>
                </div>
              </div>
            )}

            {chapters.map((chapter) => (
              <div key={chapter.chapter_num} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-zinc-300">
                    {formatStoryHeading(chapter)}
                  </h3>
                  {intervenedChapters.includes(chapter.chapter_num) && !activeInterventionChapter && (
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 已干涉
                    </span>
                  )}
                </div>
                
                <div className="text-zinc-300 leading-relaxed space-y-4">
                  {chapter.text ? (
                    chapter.text.split('\n').map((paragraph, idx) => (
                      paragraph.trim() ? <p key={idx}>{renderParagraphWithHighlights(paragraph, blueprint.characters)}</p> : null
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 rounded-lg border border-zinc-800">
                      <RefreshCcw className="w-6 h-6 text-indigo-500 animate-spin mb-3" />
                      <p className="text-zinc-400 font-medium mb-1">正在撰写本章内容...</p>
                      <p className="text-xs text-zinc-600">剧情干要：{chapter.summary}</p>
                    </div>
                  )}
                </div>

                {/* Intervention Button Logic */}
                <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
                  {(() => {
                    const validChars = chapter.present_characters ? chapter.present_characters.map(idOrName => blueprint.characters.find(c => c.id === idOrName || c.name === idOrName)).filter(Boolean) : [];
                    const hasValidChars = validChars.length > 0;
                    const isIntervened = intervenedChapters.includes(chapter.chapter_num);
                    
                    if (chapter.chapter_num >= 2 && chapter.chapter_num <= 6 && interventionsLeft > 0 && hasValidChars) {
                      return (
                        <button
                          onClick={() => setActiveInterventionChapter(activeInterventionChapter === chapter.chapter_num ? null : chapter.chapter_num)}
                          disabled={isRewriting}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                            isIntervened 
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                              : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                          }`}
                        >
                          {isIntervened ? "再次干涉" : "干涉命运"}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Intervention Panel */}
                <AnimatePresence>
                  {activeInterventionChapter === chapter.chapter_num && (
                    <motion.div
                      key={`intervention-${chapter.chapter_num}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 pt-6 border-t border-zinc-800"
                    >
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">选择干涉对象与方式：</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(() => {
                          const uniqueChars = new Map();
                          if (chapter.present_characters) {
                            chapter.present_characters.forEach(charIdOrName => {
                              const char = blueprint.characters.find(c => c.id === charIdOrName || c.name === charIdOrName);
                              if (char && !uniqueChars.has(char.id)) {
                                uniqueChars.set(char.id, char);
                              }
                            });
                          }
                          return Array.from(uniqueChars.values()).map(char => {
                            const branchesForChar = blueprint.branches.filter(b => b.condition_chapter === chapter.chapter_num && b.condition_char === char.id);
                            return (
                              <div key={char.id} className="flex flex-col gap-2 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                <div>
                                  <div className="font-medium text-zinc-200">{char.name}</div>
                                  {branchesForChar.length > 0 && (
                                    <div className="text-xs text-zinc-500 mt-1 space-y-1">
                                      {branchesForChar
                                        .map(b => b.hint)
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((hint, idx) => (
                                          <div key={idx}>{hint}</div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                <button
                                  onClick={() => handleInterveneRequest(chapter.chapter_num, char.id, 'bless')}
                                  disabled={isRewriting}
                                  className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                >
                                  <Zap className="w-3 h-3" /> 庇佑
                                </button>
                                <button
                                  onClick={() => handleInterveneRequest(chapter.chapter_num, char.id, 'curse')}
                                  disabled={isRewriting}
                                  className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/30 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                >
                                  <Skull className="w-3 h-3" /> 磨难
                                </button>
                              </div>
                            </div>
                            );
                          });
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'SUMMARY' && blueprint) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-12 font-sans relative safe-top safe-bottom">
        {pwaUpdateModal}
        {actionMenuOverlay}
        
        <AnimatePresence>
          {showSummaryModal && (
            <motion.div 
              key={`summary-screen-modal-${summaryEntrySource || 'default'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="presentation"
              className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowSummaryModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="summary-modal-title"
                data-modal-root="true"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 sm:p-6 md:p-8 max-w-lg w-[calc(100%-2rem)] shadow-2xl flex flex-col items-center text-center space-y-5 sm:space-y-6 relative overflow-hidden max-h-[85vh] overflow-y-auto"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <div className="space-y-1 text-center">
                  <h2 id="summary-modal-title" className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tighter">命运已定</h2>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">结局类别</div>
                  <div className={`text-lg font-black ${
                    uiFeedback.endingLabel === '秩序律' ? 'text-indigo-400' : 
                    uiFeedback.endingLabel === '混沌终' ? 'text-rose-500' : 
                    'text-zinc-400'
                  }`}>
                    {summaryEndingCategoryLabel({
                      endingMode: blueprint.endingMode,
                      endingNames: blueprint.endingNames,
                      endingLabel: uiFeedback.endingLabel,
                    })}
                  </div>
                </div>
                
                <div className="w-full space-y-4">
                  <div className="bg-zinc-950/50 rounded-2xl p-5 border border-zinc-800 space-y-4 shadow-inner">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-indigo-400">左倾</span>
                          <span className="text-indigo-200">{uiFeedback.leftProgress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${uiFeedback.leftProgress}%` }} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1 text-right">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-rose-200">{uiFeedback.rightProgress.toFixed(0)}%</span>
                          <span className="text-rose-400">右倾</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 ml-auto shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: `${uiFeedback.rightProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">支线解锁</div>
                      <div className="text-xl font-bold text-indigo-400">{unlockedBranches.length} / {blueprint.branches.length}</div>
                    </div>
                    <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">干涉次数</div>
                      <div className="text-xl font-bold text-zinc-300">{3 - interventionsLeft} / 3</div>
                    </div>
                  </div>
                </div>

                <div className="min-h-[80px] flex items-center justify-center w-full">
                  {isGeneratingConclusion ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-sm">正在凝结命运的结语...</span>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-lg sm:text-xl font-serif italic text-zinc-200 leading-relaxed"
                    >
                      "{storyConclusion}"
                    </motion.div>
                  )}
                </div>

                <div className="w-full flex gap-3 mt-4">
                  <button
                    onClick={handleFastAdaptToAuthoring}
                    disabled={isGeneratingConclusion}
                    className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-5 h-5 text-indigo-200" />
                    一键改编
                  </button>
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    disabled={isGeneratingConclusion}
                    className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white rounded-lg font-bold text-lg transition-colors"
                  >
                    查看故事档案
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmationModal.isOpen && (
            <motion.div
              key={`summary-confirm-${confirmationModal.title}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
              role="presentation"
              onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                role="dialog"
                aria-modal="true"
                data-modal-root="true"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    {confirmationModal.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {confirmationModal.message}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
                    className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmationModal.onConfirm}
                    className="py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-colors shadow-lg"
                  >
                    确认
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-white break-words">{blueprint.title}</h1>
            <p className="text-zinc-400">命运已定，这是你创造的专属故事。</p>
            {!showSummaryModal && (
              <button
                type="button"
                onClick={() => setShowSummaryModal(true)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20"
              >
                查看命运总结
              </button>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-8 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center pb-6 border-b border-zinc-800">
              <div>
                <div className="text-sm text-zinc-500 mb-1">解锁支线</div>
                <div className="text-xl font-bold text-indigo-400">{unlockedBranches.length} / {blueprint.branches.length}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-500 mb-1">干涉次数</div>
                <div className="text-xl font-bold text-zinc-300">{3 - interventionsLeft} 次</div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Triggered Branches Section */}
              {unlockedBranches.length > 0 && (
                <div className="pb-8 border-b border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    本次达成的命运支线
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unlockedBranches.map(branch => (
                      <div key={branch.id} className="p-4 bg-zinc-950 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                        <div className="font-bold text-indigo-300 mb-1">{branch.name}</div>
                        <div className="text-sm text-zinc-500 leading-relaxed">{branch.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {chapters.map(c => (
                <div key={c.chapter_num}>
                  <h3 className="text-sm font-bold text-indigo-400 mb-3">
                    {formatStoryHeading(c)}
                  </h3>
                  <div className="text-zinc-300 leading-relaxed space-y-4">
                    {c.text ? (
                      c.text.split('\n').map((paragraph, idx) => (
                        paragraph.trim() ? <p key={idx}>{renderParagraphWithHighlights(paragraph, blueprint.characters)}</p> : null
                      ))
                    ) : (
                      <p className="text-zinc-500 italic">内容缺失 ({c.summary})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 结语：手动结束游玩时在档案页保留一份；三次干涉自动进入时仅在弹窗中展示，避免与「查看命运总结」重复 */}
            {summaryEntrySource !== 'auto_interventions' && (
              <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
                {isGeneratingConclusion ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    <span>正在凝结命运的结语...</span>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xl md:text-2xl font-serif italic text-zinc-300"
                  >
                    "{storyConclusion}"
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center pt-8 gap-4">
            <button
              onClick={() => {
                setConfirmationModal({
                  isOpen: true,
                  title: '再次挑战命运',
                  message: '确定要放弃当前的干涉结果，回到故事最初的状态吗？',
                  onConfirm: () => {
                    restartSameStory();
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                  }
                });
              }}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              重新干涉
            </button>
            <button
              onClick={() => {
                setConfirmationModal({
                  isOpen: true,
                  title: '书写新传奇',
                  message: '确定要彻底结束这段冒险，去开启全新的主题故事吗？',
                  onConfirm: () => {
                    resetGame();
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                  }
                });
              }}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Star className="w-5 h-5" />
              放弃干涉
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
