import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Bell, BookOpen, ExternalLink, Loader2, RefreshCcw, Trash2, X, Zap } from 'lucide-react';
import { BackNavButton } from './BackNavButton';
import { BlockingSyncOverlay, InlineSyncState, ListSkeleton } from './AppFeedback';
import { semanticButtonClass } from './semanticClasses';

type ArchiveTab = 'favorite' | 'saved' | 'authors';
type ArchiveFilter = 'all' | 'private' | 'unlisted';

type AuthorNameButtonComponent = React.ComponentType<{
  authorId?: string | null;
  authorName?: string;
  prefix?: string;
}>;

type ArchiveViewProps = {
  archiveSearch: string;
  setArchiveSearch: (value: string) => void;
  archiveFilter: ArchiveFilter;
  setArchiveFilter: (value: ArchiveFilter) => void;
  archiveTab: ArchiveTab;
  setArchiveTab: (value: ArchiveTab) => void;
  archiveChoiceStoryId: string | null;
  setArchiveChoiceStoryId: (value: string | null) => void;
  archiveUpdatingIds: Record<string, boolean>;
  archiveReturnTarget?: string | null;
  mySharedStories: any[];
  followedAuthors: Array<{ authorId: string; authorName: string; followedAt: string }>;
  followedAuthorsLoading: boolean;
  storyListSyncState: any;
  isEnglish: boolean;
  isSharing: boolean;
  t: (key: string) => string;
  formatBookTitle: (title?: string | null) => string;
  getOriginalAuthorName: (story: any) => string;
  getIntervenerName: (story: any) => string;
  shortUserId: (value?: string | null) => string;
  AuthorNameButton: AuthorNameButtonComponent;
  onLeave: () => void;
  onRefreshArchive: (options?: { force?: boolean }) => void | Promise<any>;
  onRefreshFollowedAuthors: () => void | Promise<any>;
  onStartStory: (storyId: string) => void | Promise<any>;
  onOpenReadonlyStory: (storyId: string, options?: any) => void | Promise<any>;
  onDeleteArchiveStory: (story: any) => void | Promise<any>;
  onShareArchiveStory: (story: any) => void | Promise<any>;
  onArchiveVisibilityChange: (story: any, visibility: 'private' | 'unlisted') => void | Promise<any>;
  onOpenAuthorProfile: (authorId: string, authorName?: string) => void;
  onUnfollowAuthor: (authorId: string) => void | Promise<any>;
};

const visibilityClass = (value: string) =>
  value === 'unlisted'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
    : 'bg-app-surface-soft/80 border-app-border text-app-muted hover:bg-app-surface-soft';

export const ArchiveView = ({
  archiveSearch,
  setArchiveSearch,
  archiveFilter,
  setArchiveFilter,
  archiveTab,
  setArchiveTab,
  archiveChoiceStoryId,
  setArchiveChoiceStoryId,
  archiveUpdatingIds,
  archiveReturnTarget,
  mySharedStories,
  followedAuthors,
  followedAuthorsLoading,
  storyListSyncState,
  isEnglish,
  isSharing,
  t,
  formatBookTitle,
  getOriginalAuthorName,
  getIntervenerName,
  shortUserId,
  AuthorNameButton,
  onLeave,
  onRefreshArchive,
  onRefreshFollowedAuthors,
  onStartStory,
  onOpenReadonlyStory,
  onDeleteArchiveStory,
  onShareArchiveStory,
  onArchiveVisibilityChange,
  onOpenAuthorProfile,
  onUnfollowAuthor,
}: ArchiveViewProps) => {
  const keyword = archiveSearch.trim().toLowerCase();
  const archiveStories = Array.isArray(mySharedStories) ? mySharedStories.filter(Boolean) : [];
  const archiveSegment = storyListSyncState?.archive || { status: 'idle' };
  const isArchiveSyncing = archiveSegment.status === 'loading' || archiveSegment.status === 'syncing';

  const matchesKeyword = (story: any) => {
    if (!keyword) return true;
    const haystack = `${story.title || ''}\n${story.main_axis || ''}`.toLowerCase();
    return haystack.includes(keyword);
  };

  const favoriteStories = archiveStories.filter((story: any) => story.archiveKind === 'favorite' && matchesKeyword(story));
  const savedStories = archiveStories.filter((story: any) => {
    if (story.archiveKind === 'favorite') return false;
    if (archiveFilter !== 'all' && story.visibility !== archiveFilter) return false;
    return matchesKeyword(story);
  });
  const visibleFollowedAuthors = followedAuthors.filter((author) => {
    if (!keyword) return true;
    return `${author.authorName}\n${author.authorId}`.toLowerCase().includes(keyword);
  });

  const renderFavoriteCard = (story: any) => {
    const isChoosingThis = archiveChoiceStoryId === story.id;
    return (
      <div key={story.id} className="app-card rounded-[1.5rem] p-5 transition-all duration-150">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="line-clamp-2 text-sm font-black text-app-text leading-snug">{formatBookTitle(story.title)}</div>
          <div className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-1 text-[10px] font-black text-indigo-300">{isEnglish ? 'Original' : '收藏原作'}</div>
        </div>
        <div className="mb-3 text-[11px] font-bold text-app-muted">
          <AuthorNameButton prefix={isEnglish ? 'Original: ' : '原作者：'} authorId={story.originalAuthorId || story.sourceStoryId || story.authorId} authorName={getOriginalAuthorName(story)} />
        </div>
        <div className="mb-4 line-clamp-3 text-xs leading-relaxed text-app-muted">{story.main_axis || (isEnglish ? 'No premise summary yet.' : '暂无主轴摘要。')}</div>

        {!isChoosingThis ? (
          <button type="button" onClick={() => setArchiveChoiceStoryId(story.id)} className={semanticButtonClass('secondary', { compact: true })}>
            <BookOpen className="h-4 w-4" />
            {isEnglish ? 'Open original' : '前往原作'}
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-indigo-500/30 bg-indigo-950/40 p-3">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-400">{isEnglish ? 'Choose entry' : '选择进入方式'}</div>
            <button
              type="button"
              onClick={() => {
                setArchiveChoiceStoryId(null);
                void onStartStory(story.sourceStoryId || story.id);
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-indigo-600/90 px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-indigo-500 active:scale-[0.98]"
            >
              <Zap className="h-4 w-4 shrink-0" />
              <div>
                <div>{isEnglish ? 'Interfere' : '干涉命运'}</div>
                <div className="text-[10px] font-normal text-indigo-200/80">{isEnglish ? 'Enter play mode and reshape the story' : '进入游玩页，亲手改写这段故事'}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setArchiveChoiceStoryId(null);
                void onOpenReadonlyStory(story.sourceStoryId || story.id, { allowBack: true, returnTarget: 'ARCHIVE' });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface/80 px-3 py-2.5 text-left text-sm font-bold text-app-text transition-colors hover:border-zinc-500 hover:bg-app-surface-soft active:scale-[0.98]"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <div>
                <div>{isEnglish ? 'Read only' : '观看命运'}</div>
                <div className="text-[10px] font-normal text-app-muted">{isEnglish ? 'Read the original story without playing' : '以只读方式阅读原版故事'}</div>
              </div>
            </button>
            <button type="button" onClick={() => setArchiveChoiceStoryId(null)} className="w-full rounded-xl px-3 py-1.5 text-center text-xs font-bold text-app-muted transition-colors hover:text-app-text">
              {isEnglish ? 'Cancel' : '取消'}
            </button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button type="button" disabled={archiveUpdatingIds[story.id]} onClick={() => void onDeleteArchiveStory(story)} className={semanticButtonClass('danger', { compact: true })}>
            <Trash2 className="h-4 w-4" />
            {isEnglish ? 'Unsave' : '取消收藏'}
          </button>
          <button type="button" disabled={isSharing || archiveUpdatingIds[story.id]} onClick={() => void onShareArchiveStory(story)} className={semanticButtonClass('ghost', { compact: true })}>
            {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {isEnglish ? 'Share original' : '分享原作'}
          </button>
        </div>
      </div>
    );
  };

  const renderSavedCard = (story: any) => (
    <div key={story.id} className="app-card flex flex-col rounded-[1.5rem] p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="line-clamp-2 text-sm font-black text-app-text leading-snug">{formatBookTitle(story.title)}</div>
        <div className="relative shrink-0">
          <select
            value={story.visibility || 'unlisted'}
            disabled={archiveUpdatingIds[story.id]}
            onChange={(event) => void onArchiveVisibilityChange(story, event.target.value as 'private' | 'unlisted')}
            title={isEnglish ? 'Change visibility' : '点击切换可见范围'}
            className={`block w-full appearance-none rounded-full border px-2.5 py-1 pr-6 text-center text-[10px] font-black outline-none transition-colors ${visibilityClass(story.visibility)}`}
          >
            <option value="unlisted" className="bg-app-surface text-app-text">{isEnglish ? 'Unlisted' : '非公开链接'}</option>
            <option value="private" className="bg-app-surface text-app-text">{isEnglish ? 'Private' : '私人'}</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1 text-inherit opacity-70">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
          </div>
        </div>
      </div>
      <div className="mb-3 grid gap-1 text-[11px] font-bold text-app-muted">
        <div><AuthorNameButton prefix={isEnglish ? 'Original: ' : '原作者：'} authorId={story.originalAuthorId || story.sourceStoryId || story.authorId} authorName={getOriginalAuthorName(story)} /></div>
        {getIntervenerName(story) && <div>{isEnglish ? 'Intervener: ' : '干涉者：'}{getIntervenerName(story)}</div>}
      </div>
      <div className="line-clamp-3 flex-1 text-xs leading-relaxed text-app-muted">{story.main_axis || (isEnglish ? 'No premise summary yet.' : '暂无主轴摘要。')}</div>
      <div className="mt-4 flex gap-1.5 sm:gap-2">
        <button type="button" onClick={() => void onOpenReadonlyStory(story.id, { allowBack: true, returnTarget: 'ARCHIVE' })} className={`${semanticButtonClass('secondary', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}>
          <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          {isEnglish ? 'Read' : '观看命运'}
        </button>
        <button type="button" disabled={isSharing || archiveUpdatingIds[story.id]} onClick={() => void onShareArchiveStory(story)} className={`${semanticButtonClass('secondary', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}>
          {isSharing ? <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" /> : <ExternalLink className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
          {isEnglish ? 'Share' : '分享'}
        </button>
        <button type="button" disabled={archiveUpdatingIds[story.id]} onClick={() => void onDeleteArchiveStory(story)} className={`${semanticButtonClass('danger', { compact: true })} flex-1 justify-center whitespace-nowrap px-0.5 text-[10px] tracking-tighter sm:px-2 sm:text-xs`}>
          <Trash2 className="mr-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          {isEnglish ? 'Delete' : '删除'}
        </button>
      </div>
    </div>
  );

  const renderFollowedAuthorCard = (author: { authorId: string; authorName: string; followedAt: string }) => (
    <div key={author.authorId} className="app-card flex flex-col rounded-[1.5rem] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">{isEnglish ? 'Following' : '追踪作者'}</div>
          <div className="mt-1 truncate text-lg font-black text-app-text">{author.authorName || `${isEnglish ? 'Guest' : '游客'}+${shortUserId(author.authorId)}`}</div>
          <div className="mt-1 text-[11px] font-bold text-app-muted">{isEnglish ? 'Followed on ' : '追踪于 '}{new Date(author.followedAt || Date.now()).toLocaleDateString()}</div>
        </div>
        <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 p-2 text-indigo-200">
          <Bell className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onOpenAuthorProfile(author.authorId, author.authorName)} className={`${semanticButtonClass('secondary', { compact: true })} min-w-0 justify-center px-2 text-xs`}>
          <BookOpen className="h-4 w-4" />
          {isEnglish ? 'Works' : '查看作者作品'}
        </button>
        <button type="button" onClick={() => void onUnfollowAuthor(author.authorId)} className={`${semanticButtonClass('ghost', { compact: true })} min-w-0 justify-center px-2 text-xs`}>
          <X className="h-4 w-4" />
          {isEnglish ? 'Unfollow' : '取消追踪'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative mx-auto max-w-6xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
      <AnimatePresence>
        {isArchiveSyncing && archiveStories.length === 0 && (
          <BlockingSyncOverlay
            title={isEnglish ? 'Syncing fate archive' : '正在同步命运收藏馆'}
            detail={isEnglish ? 'If the network is slow, local cache stays available and the list updates when sync finishes.' : '如果网络较慢，会先保留本机缓存，完成后自动更新列表。'}
            zIndexClass="z-[3200]"
          />
        )}
      </AnimatePresence>

      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-app-text sm:text-4xl">{t('archive.title')}</h2>
          <p className="mt-2 text-sm text-app-muted">{t('archive.subtitle')}</p>
        </div>
        <BackNavButton label={archiveReturnTarget === 'PLAYING' ? (isEnglish ? 'Back to play' : '返回游玩页') : (isEnglish ? 'Back to library' : '返回作品库')} onClick={onLeave} />
      </div>

      <section className="app-card-quiet relative overflow-hidden rounded-[2rem] p-4 sm:p-5">
        {isArchiveSyncing && archiveStories.length > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs font-bold text-indigo-100/85">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-300" />
            <span>{isEnglish ? 'Syncing archive. The current list stays usable.' : '正在同步收藏馆，当前列表会保持可用。'}</span>
          </div>
        )}
        {archiveSegment.status === 'error' && archiveStories.length > 0 && (
          <div className="mb-5 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100/85">
            <div className="font-black text-amber-100">{isEnglish ? 'Archive sync is not smooth right now' : '收藏馆同步暂时不顺利'}</div>
            <p className="mt-1 text-xs text-amber-100/70">{archiveSegment.error || (isEnglish ? 'Current content is kept. Try refreshing later.' : '已保留当前可用内容，可以稍后刷新重试。')}</p>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex shrink-0 rounded-2xl border border-app-border bg-app-bg/70 p-1">
            {([
              { id: 'favorite', label: t('archive.favoriteTab'), count: archiveStories.filter((s: any) => s.archiveKind === 'favorite').length },
              { id: 'saved', label: t('archive.savedTab'), count: archiveStories.filter((s: any) => s.archiveKind !== 'favorite').length },
              { id: 'authors', label: isEnglish ? 'Following' : '追踪作者', count: followedAuthors.length },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setArchiveTab(tab.id);
                  setArchiveChoiceStoryId(null);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${archiveTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-app-muted hover:bg-app-surface hover:text-app-text'}`}
              >
                {tab.label} <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="search"
                value={archiveSearch}
                onChange={(event) => {
                  setArchiveSearch(event.target.value);
                  setArchiveChoiceStoryId(null);
                }}
                placeholder={isEnglish ? 'Search title or premise' : '搜索标题或主轴内容'}
                className="w-full rounded-xl border border-app-border bg-app-input-bg/80 px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => archiveTab === 'authors' ? void onRefreshFollowedAuthors() : void onRefreshArchive({ force: true })}
                disabled={archiveTab === 'authors' ? followedAuthorsLoading : isArchiveSyncing}
                className={semanticButtonClass('ghost', { compact: true })}
              >
                <RefreshCcw className={`h-4 w-4 ${(archiveTab === 'authors' ? followedAuthorsLoading : isArchiveSyncing) ? 'animate-spin' : ''}`} />
                {isEnglish ? 'Refresh archive' : '刷新馆藏'}
              </button>
            </div>
            {archiveTab === 'saved' && (
              <div className="flex flex-wrap gap-1.5">
                {([
                  { id: 'all', label: isEnglish ? 'All' : '全部' },
                  { id: 'unlisted', label: isEnglish ? 'Unlisted link' : '非公开链接' },
                  { id: 'private', label: isEnglish ? 'Private' : '私人' },
                ] as const).map((option) => (
                  <button key={option.id} type="button" onClick={() => setArchiveFilter(option.id)} className={archiveFilter === option.id ? semanticButtonClass('primary', { compact: true }) : semanticButtonClass('ghost', { compact: true })}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {archiveSegment.status === 'error' && archiveStories.length === 0 ? (
          <InlineSyncState
            tone="error"
            title={isEnglish ? 'Archive could not sync' : '收藏馆暂时无法同步'}
            detail={archiveSegment.error || (isEnglish ? 'No local cache is available. Reload, or return to the library for now.' : '没有可用的本机缓存。可以重新读取，或先返回作品库继续浏览。')}
            actionLabel={isEnglish ? 'Reload archive' : '重新读取收藏馆'}
            onAction={() => void onRefreshArchive({ force: true })}
          />
        ) : isArchiveSyncing && archiveStories.length === 0 ? (
          <ListSkeleton count={6} />
        ) : archiveTab === 'authors' ? (
          followedAuthorsLoading && visibleFollowedAuthors.length === 0 ? (
            <ListSkeleton count={3} />
          ) : visibleFollowedAuthors.length === 0 ? (
            <InlineSyncState
              tone="empty"
              title={keyword ? (isEnglish ? 'No followed authors match the search' : '没有符合搜索词的追踪作者') : (isEnglish ? 'No followed authors yet' : '还没有追踪任何作者')}
              detail={keyword ? (isEnglish ? 'Try another keyword, or clear the search.' : '换个关键词再试，或清空搜索条件。') : (isEnglish ? 'Open an author profile from an author name, then follow the author to view them here.' : '点击作者名字打开作者档案后，可以追踪作者并在这里集中查看。')}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{visibleFollowedAuthors.map(renderFollowedAuthorCard)}</div>
          )
        ) : archiveTab === 'favorite' ? (
          favoriteStories.length === 0 ? (
            <InlineSyncState
              tone="empty"
              title={keyword ? (isEnglish ? 'No favorited originals match the search' : '没有符合搜索词的收藏原作') : (isEnglish ? 'No favorited originals yet' : '还没有收藏任何原作')}
              detail={keyword ? (isEnglish ? 'Try another keyword, or clear the search.' : '换个关键词再试，或清空搜索条件。') : (isEnglish ? 'Tap Favorite while reading to keep the original work here.' : '在游玩页点击「收藏」后，原作会出现在这里。')}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{favoriteStories.map(renderFavoriteCard)}</div>
          )
        ) : savedStories.length === 0 ? (
          <InlineSyncState
            tone="empty"
            title={keyword || archiveFilter !== 'all' ? (isEnglish ? 'No saved fate lines match the filters' : '没有符合条件的收藏命运') : (isEnglish ? 'No saved fate lines yet' : '还没有收藏任何命运线')}
            detail={keyword || archiveFilter !== 'all' ? (isEnglish ? 'Try changing the search or visibility filter.' : '可以调整搜索或可见性筛选条件。') : (isEnglish ? 'Tap Save Fate while reading to keep the current fate line here.' : '在游玩页点击「收藏命运」后，当前命运线会出现在这里。')}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{savedStories.map(renderSavedCard)}</div>
        )}
      </section>
    </div>
  );
};
