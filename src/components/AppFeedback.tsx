import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, BookOpen, Loader2, RefreshCcw, Skull, Sparkles, WifiOff, Zap } from 'lucide-react';
import { semanticButtonClass } from './semanticClasses';
import type { AppLanguage } from '../i18n';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

export type ConnectivityDrawerState = {
  tone: 'offline' | 'weak' | 'stale' | 'error';
  title: string;
  detail?: string;
};

export const LoadingOverlay = ({
  progress,
  status,
  subtext,
  variant = 'default',
  language = 'zh-CN',
}: {
  progress: number;
  status: string;
  subtext?: string;
  variant?: 'default' | 'bless' | 'curse' | 'ending';
  language?: AppLanguage;
}) => {
  const isEnglishOverlay = language === 'en-US';
  const footerLabel = variant === 'default'
    ? (isEnglishOverlay ? 'Weaving causality' : '正在编织因果')
    : variant === 'ending'
      ? (isEnglishOverlay ? 'Ending in motion' : '终局演绎中')
      : (isEnglishOverlay ? 'Reshaping the chain' : '因果链条重塑中');

  return (
    <div className={`fixed inset-0 z-[6000] backdrop-blur-xl flex flex-col items-center justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center transition-colors duration-700 ${
      variant === 'bless' ? 'bg-emerald-950/90'
        : variant === 'curse' ? 'bg-rose-950/90'
          : variant === 'ending' ? 'bg-amber-950/90'
            : 'bg-app-bg/90'
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
        variant === 'bless' ? 'text-emerald-400'
          : variant === 'curse' ? 'text-rose-500'
            : variant === 'ending' ? 'text-amber-400'
              : 'text-white'
      }`}>
        {status}
      </h2>
      {subtext && <p className="mb-8 max-w-md text-sm leading-relaxed text-app-muted">{subtext}</p>}

      <div className="mb-4 h-2 w-full max-w-md overflow-hidden rounded-full border border-app-border bg-app-surface shadow-inner">
        <motion.div
          className={`h-full transition-all duration-500 ${
            variant === 'bless' ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
              : variant === 'curse' ? 'bg-gradient-to-r from-rose-700 to-orange-500'
                : variant === 'ending' ? 'bg-gradient-to-r from-amber-600 to-yellow-400'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between w-full max-w-md text-[10px] font-mono text-app-muted uppercase tracking-[0.3em]">
        <span>{footerLabel}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export const BlockingSyncOverlay = ({
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
    className={`${safeModalBackdropClass} ${zIndexClass} bg-app-bg/55 backdrop-blur-md`}
  >
    <motion.div
      initial={{ y: 14, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 10, opacity: 0, scale: 0.98 }}
      className="app-modal-surface w-full max-w-sm rounded-[1.75rem] p-5 text-center backdrop-blur-xl"
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-300" />
      <div className="mt-4 text-sm font-black text-app-text">{title}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-surface-soft">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-300 to-indigo-500"
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          style={{ width: '55%' }}
        />
      </div>
      {detail && <p className="mt-3 text-xs leading-relaxed text-app-muted">{detail}</p>}
    </motion.div>
  </motion.div>
);

export const InlineSyncState = ({
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
      <BookOpen className="h-8 w-8 text-app-muted" />
    )}
    <div className={`mt-4 text-sm font-black ${tone === 'error' ? 'text-amber-100' : 'text-app-text'}`}>{title}</div>
    {tone === 'loading' && (
      <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-app-surface-soft">
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
      <p className={`mx-auto mt-3 max-w-xl text-xs leading-relaxed ${tone === 'error' ? 'text-amber-100/75' : 'text-app-muted'}`}>
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

export const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] ${className}`} />
);

export const StoryCardSkeleton = () => (
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

export const ListSkeleton = ({ count = 6, compact = false }: { count?: number; compact?: boolean }) => (
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

export const ConnectivityDrawer = ({
  state,
  isEnglish = false,
  onRetry,
  onHome,
  onDismiss,
}: {
  state: ConnectivityDrawerState | null;
  isEnglish?: boolean;
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
        className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.35rem)] z-[6200] mx-auto max-w-2xl rounded-[1.5rem] border border-white/10 bg-app-bg/92 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${state.tone === 'offline' ? 'bg-rose-500/15 text-rose-200' : state.tone === 'error' ? 'bg-amber-500/15 text-amber-200' : 'bg-indigo-500/15 text-indigo-200'}`}>
            {state.tone === 'offline' ? <WifiOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-app-text">{state.title}</div>
            {state.detail && <p className="mt-1 text-xs font-semibold leading-relaxed text-app-muted">{state.detail}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onRetry} className={semanticButtonClass('primary', { compact: true })}>
                <RefreshCcw className="h-4 w-4" />
                {isEnglish ? 'Retry sync' : '重试同步'}
              </button>
              <button type="button" onClick={onHome} className={semanticButtonClass('secondary', { compact: true })}>
                {isEnglish ? 'Home' : '回到首页'}
              </button>
              <button type="button" onClick={onDismiss} className={semanticButtonClass('ghost', { compact: true })}>
                {isEnglish ? 'Keep browsing' : '继续浏览'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
