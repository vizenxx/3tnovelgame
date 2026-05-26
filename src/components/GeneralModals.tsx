import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, CheckCircle2, Copy, Loader2, Lock } from 'lucide-react';
import { semanticButtonClass } from './semanticClasses';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";
type Translator = (zh: string, en: string) => string;

export type ConfirmationModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

export type SequelGateModalState = {
  storyId: string;
  sourceStoryId: string;
  sourceTitle: string;
  missingBranches: Array<{ id: string; name: string }>;
  missingEnding?: { id: string; name: string };
};

export const ConfirmationModal = ({
  modal,
  tr,
  onClose,
}: {
  modal: ConfirmationModalState;
  tr: Translator;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {modal.isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5000] bg-black/80 backdrop-blur-md`}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-sm overflow-y-auto rounded-3xl border border-app-border p-5 shadow-2xl sm:p-6"
        >
          <h3 className="mb-2 text-xl font-black text-app-text">{modal.title}</h3>
          <p className="mb-6 text-sm leading-relaxed text-app-muted">{modal.message}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-app-surface py-3 text-sm font-bold text-app-muted"
            >
              {tr('取消', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                modal.onConfirm();
                onClose();
              }}
              className="flex-1 rounded-xl bg-app-text py-3 text-sm font-bold text-app-bg"
            >
              {tr('确认', 'Confirm')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const SequelGateModal = ({
  modal,
  tr,
  stripBookTitle,
  onGoSource,
  onShowSourceDetail,
  onClose,
}: {
  modal: SequelGateModalState | null;
  tr: Translator;
  stripBookTitle: (title: string) => string;
  onGoSource: (sourceStoryId: string) => void;
  onShowSourceDetail: (sourceStoryId: string) => void;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {modal && (
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
              <h3 className="text-xl font-black text-app-text">{tr('续作尚未解锁', 'Sequel Locked')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                {tr(
                  `这部续作需要先在《${stripBookTitle(modal.sourceTitle || '前作')}》完成指定前置情节，才可继承记录并干涉命运。`,
                  `This sequel requires specific events in ${stripBookTitle(modal.sourceTitle || 'the previous work')} before a fate record can be inherited.`
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 rounded-3xl border border-app-border bg-app-surface-soft/50 p-4">
            {modal.missingEnding && (
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-app-muted">{tr('需要结局', 'Required ending')}</div>
                <div className="mt-1 text-sm font-bold text-app-text">{modal.missingEnding.name}</div>
              </div>
            )}
            {modal.missingBranches.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-app-muted">{tr('需要支线', 'Required branches')}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {modal.missingBranches.map((branch) => (
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
              onClick={() => modal.sourceStoryId && onGoSource(modal.sourceStoryId)}
              disabled={!modal.sourceStoryId}
              className={semanticButtonClass('primary', { fullWidth: true })}
            >
              {tr('前往前作', 'Open prequel')}
            </button>
            <button
              type="button"
              onClick={() => onShowSourceDetail(modal.sourceStoryId)}
              className={semanticButtonClass('secondary', { fullWidth: true })}
            >
              {tr('查看详情', 'Details')}
            </button>
            <button type="button" onClick={onClose} className={semanticButtonClass('ghost', { fullWidth: true })}>
              {tr('关闭', 'Close')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const AuthoringSaveSuccessModal = ({
  story,
  tr,
  isSharing,
  formatBookTitle,
  onShare,
  onReturnHome,
  onClose,
}: {
  story: any | null;
  tr: Translator;
  isSharing: boolean;
  formatBookTitle: (title: string) => string;
  onShare: () => void;
  onReturnHome: () => void;
  onClose: () => void;
}) => {
  const isPrivate = (story?.meta?.visibility || 'private') === 'private';
  const title = story ? formatBookTitle(story.meta?.title || tr('未命名作品', 'Untitled story')) : '';

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
            <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{tr('作品已保存', 'Story Saved')}</div>
            <h3 className="mt-2 break-words text-2xl font-black text-app-text">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-app-muted">
              {tr(
                '更改已经写入作品档案。可以马上分享作品，或回到首页继续查看作品库。',
                'Changes have been saved. Share the story now, or return home to browse the library.'
              )}
            </p>
            {isPrivate && (
              <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-bold leading-relaxed text-amber-100/80">
                {tr(
                  '当前作品仍是私人状态；点击分享时会先改为“非公开链接”，这样收到链接的人才能阅读，但作品不会出现在公开列表。',
                  'This story is still private. Sharing will switch it to an unlisted link so readers can open it, without placing it in the public list.'
                )}
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onShare}
                disabled={isSharing}
                className={semanticButtonClass('primary', { fullWidth: true })}
              >
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {tr('分享作品', 'Share story')}
              </button>
              <button
                type="button"
                onClick={onReturnHome}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                <BookOpen className="h-4 w-4" />
                {tr('回到首页', 'Home')}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`${semanticButtonClass('ghost', { fullWidth: true })} mt-3`}
            >
              {tr('继续编辑', 'Keep editing')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
