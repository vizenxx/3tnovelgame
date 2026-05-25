import React from 'react';
import { BookOpen, Copy, ExternalLink, Loader2, Lock, Trash2, Wand2, Zap } from 'lucide-react';
import { BackNavButton } from './BackNavButton';
import { semanticButtonClass } from './semanticClasses';

type AuthorNameButtonComponent = React.ComponentType<{
  authorId?: string | null;
  authorName?: string;
  prefix?: string;
}>;

type ReadonlyStoryViewProps = {
  story: { meta: any; chapters: any[] } | null;
  user: any;
  archiveUpdatingIds: Record<string, boolean>;
  readonlyCanGoBack: boolean;
  isEnglish: boolean;
  isSharing: boolean;
  readingParagraphStyle: React.CSSProperties;
  ReadingTextControls: React.ComponentType;
  AuthorNameButton: AuthorNameButtonComponent;
  tr: (zh: string, en: string) => string;
  formatBookTitle: (title?: string | null) => string;
  getOriginalAuthorName: (story: any) => string;
  getIntervenerName: (story: any) => string;
  renderReadingParagraph: (text: unknown, characters?: any[], changeQuotes?: string[]) => React.ReactNode;
  canAdaptReadonlyStory: (meta: any) => boolean;
  onBack: () => void;
  onArchiveVisibilityChange: (story: any, visibility: 'private' | 'unlisted') => void | Promise<any>;
  onShareExistingArchiveStory: () => void | Promise<any>;
  onDeleteReadonlyArchiveStory: () => void;
  onInterveneFromReadonly: () => void | Promise<any>;
  onAdaptFromReadonly: () => void | Promise<any>;
  onRequireSignInIntervene: () => void;
  onRequireSignInAdapt: () => void;
  onBrowseLibrary: () => void;
};

export const ReadonlyStoryView = ({
  story,
  user,
  archiveUpdatingIds,
  readonlyCanGoBack,
  isEnglish,
  isSharing,
  readingParagraphStyle,
  ReadingTextControls,
  AuthorNameButton,
  tr,
  formatBookTitle,
  getOriginalAuthorName,
  getIntervenerName,
  renderReadingParagraph,
  canAdaptReadonlyStory,
  onBack,
  onArchiveVisibilityChange,
  onShareExistingArchiveStory,
  onDeleteReadonlyArchiveStory,
  onInterveneFromReadonly,
  onAdaptFromReadonly,
  onRequireSignInIntervene,
  onRequireSignInAdapt,
  onBrowseLibrary,
}: ReadonlyStoryViewProps) => {
  if (!story) return null;

  const readonlyArchiveId = story.meta?.sharedStoryId;
  const isReadonlyOwner = Boolean(user && readonlyArchiveId && story.meta?.authorId === user.uid);
  const isReadonlyUpdating = Boolean(readonlyArchiveId && archiveUpdatingIds[readonlyArchiveId]);

  return (
    <div className="reading-page mx-auto max-w-4xl rounded-b-[2.5rem] px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] sm:px-8">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          {story.meta?.coverUrl && (
            <img
              src={story.meta.coverUrl}
              alt={`${formatBookTitle(story.meta?.title)} ${tr('封面', 'cover')}`}
              className="h-24 w-24 shrink-0 rounded-2xl border border-app-border object-cover sm:h-32 sm:w-32"
            />
          )}
          <div className="min-w-0 space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-app-muted">{tr('故事记录', 'Story Record')}</div>
            <h1 className="break-words text-4xl font-black text-app-text">{formatBookTitle(story.meta?.title)}</h1>
            <div className="space-y-1 text-sm font-bold text-app-muted">
              <div>
                <AuthorNameButton
                  prefix={tr('原作者：', 'Original author: ')}
                  authorId={story.meta?.originalAuthorId || story.meta?.sourceStoryId || story.meta?.authorId}
                  authorName={getOriginalAuthorName(story.meta)}
                />
              </div>
              {getIntervenerName(story.meta) && <div>{tr('干涉者：', 'Intervener: ')}{getIntervenerName(story.meta)}</div>}
            </div>
          </div>
        </div>
        {readonlyCanGoBack && <BackNavButton label={tr('返回上一页', 'Back')} onClick={onBack} />}
      </div>

      <div className="app-card-quiet mb-10 rounded-[2rem] p-6 text-sm leading-relaxed text-app-text">
        {story.meta?.main_axis || tr('暂无故事主轴摘要。', 'No story premise summary yet.')}
      </div>

      <div className="mb-8 flex justify-end">
        <ReadingTextControls />
      </div>

      {isReadonlyOwner && (
        <div className="app-card-quiet mb-8 rounded-[2rem] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-app-muted">{tr('馆藏管理', 'Archive Management')}</div>
              <div className="mt-1 text-sm font-bold text-app-text">
                {tr('当前状态：', 'Current status: ')}
                {story.meta?.visibility === 'unlisted'
                  ? tr('非公开链接，可通过链接访问', 'Unlisted link, accessible by URL')
                  : tr('私人，仅当前账号可见', 'Private, only visible to this account')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isReadonlyUpdating || story.meta?.visibility === 'private'}
                onClick={() => onArchiveVisibilityChange({ id: readonlyArchiveId }, 'private')}
                className={semanticButtonClass('ghost', { compact: true })}
              >
                <Lock className="h-4 w-4" />
                {tr('设为私人', 'Set private')}
              </button>
              <button
                type="button"
                disabled={isReadonlyUpdating || story.meta?.visibility === 'unlisted'}
                onClick={() => onArchiveVisibilityChange({ id: readonlyArchiveId }, 'unlisted')}
                className={semanticButtonClass('secondary', { compact: true })}
              >
                <ExternalLink className="h-4 w-4" />
                {tr('设为非公开链接', 'Set unlisted link')}
              </button>
              <button
                type="button"
                disabled={isSharing || isReadonlyUpdating}
                onClick={() => void onShareExistingArchiveStory()}
                className={semanticButtonClass('primary', { compact: true })}
              >
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {tr('分享', 'Share')}
              </button>
              <button
                type="button"
                disabled={isReadonlyUpdating}
                onClick={onDeleteReadonlyArchiveStory}
                className={semanticButtonClass('danger', { compact: true })}
              >
                <Trash2 className="h-4 w-4" />
                {tr('删除', 'Delete')}
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-app-muted">
            {tr('分享会使用当前这条馆藏记录本身，不会重复创建新的通篇馆藏作品。', 'Sharing uses this archive record itself and will not create another full duplicate.')}
          </p>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-14">
        {(story.chapters || []).map((chapter) => (
          <section key={chapter.chapter_num} className="reading-chapter relative">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border/60 bg-app-bg/45 text-xs font-black text-app-muted">
                {chapter.chapter_num}
              </div>
              <h2 className="text-xl font-black text-app-text">{chapter.title || (isEnglish ? `Chapter ${chapter.chapter_num}` : `第${chapter.chapter_num}章`)}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
            </div>
            <div className="space-y-5 text-app-text">
              {(chapter.text || '').split('\n').filter(Boolean).map((paragraph, index) => (
                <p key={index} style={readingParagraphStyle} className="leading-relaxed">
                  {renderReadingParagraph(paragraph, story.meta?.characters || [])}
                </p>
              ))}
            </div>
            <div className="reading-divider mt-12" />
          </section>
        ))}
      </div>

      <div className="app-card mt-12 rounded-[2rem] p-6 text-center">
        <h3 className="text-2xl font-black text-app-text">{tr('想亲手改变这条命运线吗？', 'Want to change this fate line?')}</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-app-muted">
          {tr('这页是只读故事记录。注册或登录后，可从原版故事开始干涉命运；若作者开放权限，也可一键改编成个人作品。', 'This is a read-only story record. After signing in, start from the original story to interfere with fate; if adaptation is allowed, it can also become a personal work.')}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={user ? () => void onInterveneFromReadonly() : onRequireSignInIntervene}
            disabled={user ? !story.meta?.sourceStoryId : false}
            className={semanticButtonClass('primary', { compact: true })}
          >
            <Zap className="h-4 w-4" />
            {user ? tr('干涉原版故事', 'Interfere with original') : tr('登录后干涉', 'Sign in to interfere')}
          </button>
          <button
            type="button"
            onClick={user ? () => void onAdaptFromReadonly() : onRequireSignInAdapt}
            className={semanticButtonClass('secondary', { compact: true })}
          >
            <Wand2 className="h-4 w-4" />
            {user ? (canAdaptReadonlyStory(story.meta) ? tr('一键改编', 'Adapt') : tr('未开放改编', 'Adaptation unavailable')) : tr('注册成用户', 'Create account')}
          </button>
          <button type="button" onClick={onBrowseLibrary} className={semanticButtonClass('ghost', { compact: true })}>
            <BookOpen className="h-4 w-4" />
            {tr('浏览故事库', 'Browse library')}
          </button>
        </div>
      </div>
    </div>
  );
};
