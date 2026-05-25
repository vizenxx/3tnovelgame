import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { ListSkeleton } from './AppFeedback';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

type Translator = (zh: string, en: string) => string;

export const AuthorProfileModal = ({
  target,
  bio,
  loading,
  stories,
  currentUserId,
  following,
  busy,
  isEnglish,
  tr,
  shortUserId,
  formatBookTitle,
  getStoryTitle,
  getStoryLikeCount,
  getStoryFavoriteCount,
  getStoryShareCount,
  getStoryInterventionCount,
  onClose,
  onToggleFollow,
  onOpenStory,
}: {
  target: { authorId: string; authorName: string } | null;
  bio: string;
  loading: boolean;
  stories: any[];
  currentUserId?: string | null;
  following: boolean;
  busy: boolean;
  isEnglish: boolean;
  tr: Translator;
  shortUserId: (id?: string | null) => string;
  formatBookTitle: (title: string) => string;
  getStoryTitle: (story: any) => string;
  getStoryLikeCount: (story: any) => number;
  getStoryFavoriteCount: (story: any) => number;
  getStoryShareCount: (story: any) => number;
  getStoryInterventionCount: (story: any) => number;
  onClose: () => void;
  onToggleFollow: () => void;
  onOpenStory: (storyId: string) => void;
}) => (
  <AnimatePresence>
    {target && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5400] bg-black/65 backdrop-blur-md`}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 14, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-xl overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('作者档案', 'Author Profile')}</div>
              <h3 className="mt-2 text-2xl font-black text-white">{target.authorName || `游客+${shortUserId(target.authorId)}`}</h3>
              {bio && <p className="mt-1.5 text-xs italic text-indigo-200/90">「 {bio} 」</p>}
              <p className="mt-2 text-xs font-semibold text-app-muted">
                {tr('查看这个作者可阅读的作品，并决定是否追踪后续更新。', 'View this author’s available works and choose whether to follow future updates.')}
              </p>
            </div>
            <button type="button" onClick={onClose} className={semanticIconButtonClass('secondary')} aria-label={tr('关闭作者档案', 'Close author profile')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {target.authorId !== currentUserId && (
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={busy}
                className={`${semanticButtonClass(following ? 'secondary' : 'primary', { compact: true })} ${following ? 'app-button-followed' : ''}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {following ? tr('已追踪', 'Following') : tr('追踪作者', 'Follow author')}
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-app-border bg-app-surface/40 p-8 text-sm font-black text-app-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isEnglish ? 'Loading author works...' : '正在读取作者作品...'}
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface/30 p-8 text-center text-sm font-semibold text-app-muted">
              {tr('暂时没有可查看的作者作品。', 'No viewable works from this author yet.')}
            </div>
          ) : (
            <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1">
              {stories.map((story: any) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => onOpenStory(story.id)}
                  className="rounded-2xl border border-app-border bg-app-surface/40 p-4 text-left transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/10"
                >
                  <div className="font-black text-app-text">{formatBookTitle(getStoryTitle(story))}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black text-app-muted">
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

export const NotificationCenterModal = ({
  open,
  loading,
  items,
  tr,
  onClose,
  onRefresh,
  onMarkAllRead,
  onClearAll,
  onDelete,
  onOpenStory,
}: {
  open: boolean;
  loading: boolean;
  items: Array<{ id: string; title: string; body: string; storyId?: string | null; createdAt: string; readAt?: string | null }>;
  tr: Translator;
  onClose: () => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  onOpenStory: (storyId: string) => void;
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5500] bg-black/65 backdrop-blur-md`}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 14, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('通知', 'Notifications')}</div>
              <h3 className="mt-2 text-2xl font-black text-white">{tr('命运动态', 'Fate Updates')}</h3>
              <p className="mt-1 text-xs font-semibold text-app-muted">
                {tr('点赞、收藏、分享、追踪作者更新和创作提醒都会集中在这里。', 'Likes, favorites, shares, followed author updates, and creation nudges gather here.')}
              </p>
            </div>
            <button type="button" onClick={onClose} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭通知', 'Close notifications')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <button type="button" onClick={onRefresh} className={semanticButtonClass('ghost', { compact: true })} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {tr('刷新通知', 'Refresh')}
            </button>
            <button type="button" onClick={onMarkAllRead} className={semanticButtonClass('secondary', { compact: true })} disabled={loading || items.every((item) => item.readAt)}>
              <CheckCircle2 className="h-4 w-4" />
              {tr('全部已读', 'Mark all read')}
            </button>
            <button type="button" onClick={onClearAll} className={semanticButtonClass('danger', { compact: true })} disabled={loading || items.length === 0}>
              <Trash2 className="h-4 w-4" />
              {tr('清空', 'Clear')}
            </button>
          </div>
          <div className="flex min-h-[420px] flex-col">
            {loading && items.length === 0 ? (
              <ListSkeleton count={4} compact />
            ) : items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-app-border bg-app-surface/30 p-8 text-center text-sm font-semibold text-app-muted">
                {tr('暂时没有新的通知。', 'No new notifications yet.')}
              </div>
            ) : (
              <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 rounded-2xl border p-3 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/10 ${
                      item.readAt ? 'border-app-border bg-app-surface/30' : 'border-indigo-400/30 bg-indigo-500/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => item.storyId && onOpenStory(item.storyId)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <div className="mt-0.5 rounded-full border border-white/10 bg-white/10 p-2">
                        <Bell className="h-4 w-4 text-indigo-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-app-text">{item.title || tr('新的通知', 'New notification')}</div>
                        <div className="mt-1 text-xs font-semibold leading-relaxed text-app-muted">{item.body || tr('有新的命运动态。', 'There is a new fate update.')}</div>
                        <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                          {new Date(item.createdAt || Date.now()).toLocaleString()}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="shrink-0 rounded-full p-2 text-app-muted transition-colors hover:bg-rose-500/10 hover:text-rose-200 active:scale-95"
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

export const ShareComposerModal = ({
  shareComposer,
  text,
  tr,
  t,
  onTextChange,
  onClose,
  onConfirm,
}: {
  shareComposer: ShareData | null;
  text: string;
  tr: Translator;
  t: (key: string) => string;
  onTextChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <AnimatePresence>
    {shareComposer && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5600] bg-black/70 backdrop-blur-md`}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 14, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('分享前确认', 'Share Preview')}</div>
              <h3 className="mt-2 text-2xl font-black text-white">{String(shareComposer.title || t('play.share'))}</h3>
              <p className="mt-1 text-xs font-semibold text-app-muted">
                {tr('可以先调整要发出去的文字；确认分享后才会调用设备分享功能，并在成功后计入分享数。', 'Edit the share text first. The device share sheet opens only after confirmation, and successful shares count toward stats.')}
              </p>
            </div>
            <button type="button" onClick={onClose} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭分享编辑', 'Close share editor')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <label className="mb-3 block text-xs font-black uppercase tracking-[0.16em] text-app-muted">{tr('分享文字', 'Share text')}</label>
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            className="min-h-44 w-full resize-y rounded-2xl border border-app-border bg-app-surface/60 p-4 text-sm font-semibold leading-relaxed text-app-text outline-none transition-colors focus:border-indigo-400/70"
          />
          <div className="mt-3 break-all rounded-2xl border border-app-border bg-app-surface/35 p-3 text-xs font-semibold leading-relaxed text-app-muted">
            {String(shareComposer.url || '')}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className={semanticButtonClass('ghost', { fullWidth: true })}>
              {tr('取消', 'Cancel')}
            </button>
            <button type="button" onClick={onConfirm} className={semanticButtonClass('primary', { fullWidth: true })}>
              <ExternalLink className="h-4 w-4" />
              {tr('确认分享', 'Share now')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
