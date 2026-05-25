import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { InlineSyncState, ListSkeleton } from './AppFeedback';
import { semanticButtonClass } from './semanticClasses';

type StoryLibraryTab = 'mine' | 'public';
type StoryLibrarySort = 'updated' | 'likes' | 'interventions' | 'favorites' | 'shares' | 'words';

export const StorySelectView = ({
  t,
  isEnglish,
  storyLibraryTab,
  setStoryLibraryTab,
  storyLibrarySearch,
  setStoryLibrarySearch,
  storyLibraryVisibilityFilter,
  setStoryLibraryVisibilityFilter,
  storyLibrarySort,
  onSortChange,
  isLoadingStories,
  storyListLoadError,
  visibleStories,
  languagePublicCount,
  languageMineCount,
  onRefresh,
  renderStoryCard,
}: {
  t: (key: string) => string;
  isEnglish: boolean;
  storyLibraryTab: StoryLibraryTab;
  setStoryLibraryTab: (tab: StoryLibraryTab) => void;
  storyLibrarySearch: string;
  setStoryLibrarySearch: (value: string) => void;
  storyLibraryVisibilityFilter: 'all' | 'public' | 'private' | 'unlisted';
  setStoryLibraryVisibilityFilter: (value: 'all' | 'public' | 'private' | 'unlisted') => void;
  storyLibrarySort: StoryLibrarySort;
  onSortChange: (sort: StoryLibrarySort) => void;
  isLoadingStories: boolean;
  storyListLoadError: string | null;
  visibleStories: any[];
  languagePublicCount: number;
  languageMineCount: number;
  onRefresh: () => void;
  renderStoryCard: (story: any, isPublic: boolean) => React.ReactNode;
}) => (
  <div className="story-library-page mx-auto max-w-7xl px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(3rem,calc(env(safe-area-inset-top)+3rem))] sm:px-6 lg:px-8">
    <div className="story-library-hero relative mb-10 p-2 sm:p-4 lg:p-6">
      <div className="max-w-3xl">
        <h2 className="story-library-title text-4xl font-black leading-[1.15] sm:text-5xl lg:text-6xl">
          {t('library.titleA')}<br />
          <span className="story-library-title-accent">{t('library.titleB')}</span>
        </h2>
        <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-app-muted sm:text-lg">
          {t('library.subtitle')}
        </p>
      </div>
    </div>

    <section className="story-library-content">
      <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-app-border/70 bg-app-surface/40 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'public', label: t('library.publicWorks'), count: languagePublicCount },
            { id: 'mine', label: t('library.myWorks'), count: languageMineCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStoryLibraryTab(tab.id as StoryLibraryTab)}
              data-active={storyLibraryTab === tab.id ? 'true' : undefined}
              className="story-library-tab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
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
            placeholder={isEnglish ? 'Search title, author, tags, or premise' : '搜索标题、作者、标签或主轴'}
            className="story-library-control min-w-0 px-3 py-2 text-sm sm:w-72"
          />
          {storyLibraryTab === 'mine' && (
            <select
              value={storyLibraryVisibilityFilter}
              onChange={(event) => setStoryLibraryVisibilityFilter(event.target.value as any)}
              className="story-library-control px-3 py-2 text-sm"
            >
              <option value="all">{isEnglish ? 'All visibility' : '全部权限'}</option>
              <option value="private">{isEnglish ? 'Private' : '私密'}</option>
              <option value="public">{isEnglish ? 'Public' : '公开'}</option>
              <option value="unlisted">{isEnglish ? 'Unlisted link' : '非公开链接'}</option>
            </select>
          )}
          <select
            value={storyLibrarySort}
            onChange={(event) => onSortChange(event.target.value as StoryLibrarySort)}
            className="story-library-control px-3 py-2 text-sm"
          >
            <option value="updated">{isEnglish ? 'Recently updated' : '最近更新'}</option>
            <option value="interventions">{isEnglish ? 'Most intervened' : '干涉最多'}</option>
            <option value="likes">{isEnglish ? 'Most liked' : '点赞最多'}</option>
            <option value="favorites">{isEnglish ? 'Most favorited' : '收藏最多'}</option>
            <option value="shares">{isEnglish ? 'Most shared' : '分享最多'}</option>
            <option value="words">{isEnglish ? 'Avg. words' : '平均字数'}</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingStories}
            className={semanticButtonClass('ghost', { compact: true })}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoadingStories ? 'animate-spin' : ''}`} />
            {isEnglish ? 'Refresh' : '刷新'}
          </button>
        </div>
      </div>

      {isLoadingStories && visibleStories.length === 0 ? (
        <ListSkeleton count={6} />
      ) : storyListLoadError && visibleStories.length === 0 ? (
        <InlineSyncState
          tone="error"
          title={isEnglish ? 'Story list could not sync' : '作品列表暂时无法同步'}
          detail={storyListLoadError}
          actionLabel={isEnglish ? 'Reload library' : '重新读取作品库'}
          onAction={onRefresh}
        />
      ) : visibleStories.length === 0 ? (
        <InlineSyncState
          tone="empty"
          title={isEnglish ? 'No matching stories' : '没有符合条件的作品'}
          detail={isEnglish ? 'Try changing the search, filters, or sorting.' : '可以调整搜索、筛选或排序条件后再试。'}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStories.map((story) => renderStoryCard(story, storyLibraryTab === 'public'))}
        </div>
      )}
    </section>
  </div>
);
