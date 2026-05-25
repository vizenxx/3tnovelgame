import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

type Translator = (zh: string, en: string) => string;

export const StoryDetailModal = ({
  story,
  coverUrl,
  tags,
  title,
  mainAxis,
  authorId,
  authorName,
  isSharing,
  isAdmin,
  sequelRequirement,
  statsNode,
  tr,
  t,
  stripBookTitle,
  AuthorNameButton,
  onClose,
  onPlay,
  onShare,
  onAdminDelete,
}: {
  story: any | null;
  coverUrl: string;
  tags: string[];
  title: string;
  mainAxis: string;
  authorId?: string | null;
  authorName?: string;
  isSharing: boolean;
  isAdmin: boolean;
  sequelRequirement: any | null;
  statsNode: React.ReactNode;
  tr: Translator;
  t: (key: string) => string;
  stripBookTitle: (title: string) => string;
  AuthorNameButton: React.ComponentType<{ authorId?: string | null; authorName?: string }>;
  onClose: () => void;
  onPlay: () => void;
  onShare: () => void;
  onAdminDelete: () => void;
}) => (
  <AnimatePresence>
    {story && (
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
            onClick={onClose}
            aria-label={tr('关闭作品详情', 'Close story details')}
            className={`${semanticIconButtonClass('secondary')} absolute right-4 top-4 z-10`}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <div className="aspect-square overflow-hidden rounded-3xl border border-app-border bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950 shadow-xl">
                {coverUrl ? (
                  <img src={coverUrl} alt={`${title} ${tr('封面', 'cover')}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-5 text-center text-xs font-black uppercase tracking-[0.2em] text-app-muted">
                    3T NOVEL
                  </div>
                )}
              </div>
              {statsNode}
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                {(tags.length > 0 ? tags : [tr('未标签', 'Untagged')]).map((tag: string) => (
                  <span key={tag} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-black text-indigo-300">
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="break-words text-3xl font-black leading-tight text-white">{title}</h3>
              <div className="mt-2 text-sm font-bold text-app-muted">
                <AuthorNameButton authorId={authorId} authorName={authorName} />
              </div>
              <div className="mt-5 max-h-[40vh] overflow-y-auto rounded-3xl border border-app-border/60 bg-app-surface/25 p-4 text-base leading-relaxed text-app-text">
                {mainAxis || tr('这部作品暂时还没有填写完整介绍。', 'This story does not have a full introduction yet.')}
              </div>
              {sequelRequirement && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
                  <div className="font-black">{tr('续作前置条件', 'Sequel requirements')}</div>
                  <p className="mt-1 text-amber-100/80">
                    {tr('干涉前需先完成', 'Before intervening, complete')}{' '}
                    《{stripBookTitle(sequelRequirement.sourceTitle || tr('前作', 'Previous work'))}》
                    {tr('的指定结局与支线。', ' with the required ending and branches.')}
                  </p>
                </div>
              )}
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={onPlay} className={semanticButtonClass('primary', { fullWidth: true })}>
                  <Sparkles className="h-4 w-4" />
                  {t('library.intervene')}
                </button>
                {isAdmin && (
                  <button type="button" onClick={onAdminDelete} className={semanticButtonClass('danger', { fullWidth: true })}>
                    <Trash2 className="h-4 w-4" />
                    {tr('管理员删除作品', 'Admin delete story')}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={onShare} disabled={isSharing} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    {tr('分享作品', 'Share story')}
                  </button>
                  <button type="button" onClick={onClose} className={semanticButtonClass('ghost', { fullWidth: true })}>
                    {tr('关闭', 'Close')}
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
