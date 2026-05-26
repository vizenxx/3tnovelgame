import React from 'react';
import { BookOpen, Bookmark, ExternalLink, GitBranch, Heart, Sparkles, Trophy } from 'lucide-react';
import { StoryLibraryCard } from './StoryLibraryCard';
import { StorySelectView } from './StorySelectView';
import { StoryDetailModal } from './StoryDetailModal';
import { SequelGateModal } from './GeneralModals';
import { deleteStoryCartridge } from '../storyStore';

type StoryLibraryPart = 'select' | 'detail' | 'sequel';
type StoryLibrarySort = 'updated' | 'likes' | 'interventions' | 'favorites' | 'shares' | 'words';

export function StoryLibraryView({ ctx, part = 'select' }: { ctx: any; part?: StoryLibraryPart }) {
  const {
    tr,
    t,
    isEnglish,
    db,
    appLanguage,
    publicStories,
    myStories,
    storyLibraryTab,
    setStoryLibraryTab,
    storyLibrarySearch,
    setStoryLibrarySearch,
    storyLibraryVisibilityFilter,
    setStoryLibraryVisibilityFilter,
    storyLibrarySort,
    setStoryLibrarySort,
    isLoadingStories,
    storyListLoadError,
    refreshStories,
    storyMatchesLanguage,
    formatBookTitle,
    stripBookTitle,
    getStoryCoverUrl,
    getStoryTags,
    getStoryTitle,
    getStoryAuthorName,
    getStoryMainAxis,
    getSequelRequirementFromMeta,
    hasStoryCardAction,
    getStoryLikeCount,
    getStoryFavoriteCount,
    getStoryShareCount,
    getStoryInterventionCount,
    getStoryUnlockedBranchCount,
    getStoryBranchCount,
    getStoryUnlockedEndingCount,
    getStoryEndingCount,
    getStoryAverageChapterWords,
    getStoryUpdatedMs,
    isSingleEndingStory,
    endingBiasStoryCardLabels,
    AuthorNameButton,
    setStoryDetailStory,
    startStoryPlay,
    handleStoryInteraction,
    shareStoryCardWithFeedback,
    storyDetailStory,
    setIsSharing,
    setGlobalLoadingMessage,
    setGlobalLoadingDetail,
    shareOriginalStoryByCard,
    showError,
    isSharing,
    isAdminUser,
    setConfirmationModal,
    setPublicStories,
    setMyStories,
    setMySharedStories,
    sequelGateModal,
    setSequelGateModal,
    findStoryListItemById,
  } = ctx;

const getStoryStats = (story: any) => {
  const isLiked = hasStoryCardAction('like', story);
  const isFavorited = hasStoryCardAction('favorite', story);
  const singleEnding = isSingleEndingStory(story);
  const unknownLabel = tr('未知', 'Unknown');
  const stats = [
    { key: 'like', label: tr('点赞', 'Likes'), activeLabel: tr('已点赞', 'Liked'), value: getStoryLikeCount(story), icon: Heart, active: isLiked, tone: 'like' },
    { key: 'favorite', label: tr('收藏', 'Saves'), activeLabel: tr('已收藏', 'Saved'), value: getStoryFavoriteCount(story), icon: Bookmark, active: isFavorited, tone: 'favorite' },
    { key: 'share', label: tr('分享', 'Shares'), value: getStoryShareCount(story), icon: ExternalLink },
    { key: 'intervention', label: tr('干涉', 'Plays'), value: getStoryInterventionCount(story), icon: Sparkles },
    { key: 'branches', label: tr('支线', 'Branches'), value: `${getStoryUnlockedBranchCount(story)}/${getStoryBranchCount(story) || 0}`, icon: GitBranch },
    { key: 'endings', label: tr('结局', 'Endings'), value: `${getStoryUnlockedEndingCount(story)}/${getStoryEndingCount(story) || 0}`, icon: Trophy },
    { key: 'words', label: tr('均字', 'Avg'), detailLabel: tr('均字', 'Avg words'), value: getStoryAverageChapterWords(story) || unknownLabel, valueSuffix: isEnglish ? ' words' : ' 字', icon: BookOpen },
  ];
  return singleEnding
    ? stats.map((stat) => stat.key === 'endings' ? { ...stat, label: tr('唯一', 'Fixed'), value: getStoryEndingCount(story) || 1 } : stat)
    : stats;
};

const renderStoryStats = (
  story: any,
  variant: 'card' | 'detail' | 'compact-row',
  actions?: {
    storyId?: string;
    onLike?: () => void;
    onFavorite?: () => void;
    onShare?: () => void;
  }
) => {
  const stats = getStoryStats(story);
  if (variant === 'compact-row') {
    return (
      <div className="story-compact-stats-row flex flex-wrap gap-x-3.5 gap-y-1.5 py-1">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              disabled={!onClick}
              data-active={stat.active ? 'true' : undefined}
              data-tone={stat.tone}
              className={`story-compact-stat flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-95 disabled:pointer-events-none ${
                stat.active && stat.tone === 'like'
                  ? 'text-pink-400'
                  : stat.active && stat.tone === 'favorite'
                  ? 'text-amber-400'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.active ? 'fill-current' : ''}`} />
              <span className="font-heading tracking-wide">{stat.value}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="story-card-stat-list">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              disabled={!onClick}
              data-active={stat.active ? 'true' : undefined}
              data-tone={stat.tone}
              className="story-card-stat text-left transition-colors disabled:cursor-default"
            >
              <div className="story-card-stat-label">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.active ? 'fill-current' : ''}`} />
                <span className="truncate">{stat.active ? stat.activeLabel || stat.label : stat.label}</span>
              </div>
              <div className="story-card-stat-value">{stat.value}</div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="story-detail-stat-grid sm:grid-cols-1">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isAction = stat.key === 'like' || stat.key === 'favorite' || stat.key === 'share';
        const onClick = stat.key === 'like' ? actions?.onLike : stat.key === 'favorite' ? actions?.onFavorite : stat.key === 'share' ? actions?.onShare : undefined;
        const content = (
          <>
            <div className={`story-detail-stat-label transition-colors ${stat.active && stat.tone === 'like' ? 'text-pink-300' : stat.active && stat.tone === 'favorite' ? 'text-amber-300' : ''}`}>
              {stat.active ? stat.activeLabel || stat.label : stat.detailLabel || stat.label}
              <Icon className={`h-3.5 w-3.5 transition-transform ${stat.active ? 'scale-110 fill-current' : ''}`} />
            </div>
            <div className="story-detail-stat-value">{stat.value}{stat.valueSuffix && stat.value !== tr('未知', 'Unknown') ? stat.valueSuffix : ''}</div>
          </>
        );

        if (isAction && onClick) {
          return (
            <button
              key={stat.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              data-active={stat.active ? 'true' : undefined}
              data-tone={stat.tone}
              className="story-detail-stat group text-left transition-all active:scale-[0.98]"
            >
              {content}
            </button>
          );
        }

        return (
          <div key={stat.key} className="story-detail-stat">
            {content}
          </div>
        );
      })}
    </div>
  );
};

const renderStoryBiasBar = (story: any) => {
  const biasText = (value?: string) => {
    if (!isEnglish) return value || '';
    return ({
      '唯一走向': 'Fixed',
      '左域': 'Left',
      '右域': 'Right',
      '极强': 'Very strong',
      '强': 'Strong',
      '明显': 'Clear',
      '普通': 'Even',
      '轻微': 'Slight',
      '较弱': 'Weak',
      '极弱': 'Very weak',
    } as Record<string, string>)[String(value || '')] || value || '';
  };
  if (isSingleEndingStory(story)) {
    return (
      <div className="story-bias-bar story-bias-single" aria-label={tr('唯一走向结构', 'Fixed-ending structure')}>
        <div className="story-bias-side story-bias-center" data-active="true">
          <span>{tr('唯一走向', 'Fixed-ending path')}</span>
        </div>
      </div>
    );
  }
  const labels = endingBiasStoryCardLabels(story);
  const left = labels.find((bias) => bias.side === 'left');
  const right = labels.find((bias) => bias.side === 'right');
  if (!left && !right) return null;
  return (
    <div className="story-bias-bar" aria-label={tr('作品结局倾向', 'Story ending tendency')}>
      <div className="story-bias-side story-bias-left" data-active={left?.active ? 'true' : undefined}>
        <span>{biasText(left?.label) || tr('左域', 'Left')}</span>
        <strong>{biasText(left?.value) || tr('普通', 'Even')}</strong>
      </div>
      <div className="story-bias-divider" />
      <div className="story-bias-side story-bias-right" data-active={right?.active ? 'true' : undefined}>
        <strong>{biasText(right?.value) || tr('普通', 'Even')}</strong>
        <span>{biasText(right?.label) || tr('右域', 'Right')}</span>
      </div>
    </div>
  );
};

const renderStoryCard = (story: any, isPublic: boolean) => (
  <StoryLibraryCard
    story={story}
    tr={tr}
    t={t}
    formatBookTitle={formatBookTitle}
    getStoryCoverUrl={getStoryCoverUrl}
    getStoryTags={getStoryTags}
    getStoryTitle={getStoryTitle}
    getStoryAuthorName={getStoryAuthorName}
    getStoryMainAxis={getStoryMainAxis}
    hasStoryCardAction={hasStoryCardAction}
    getSequelRequirementFromMeta={getSequelRequirementFromMeta}
    renderStoryStats={renderStoryStats}
    renderStoryBiasBar={renderStoryBiasBar}
    AuthorNameButton={AuthorNameButton}
    onOpenDetail={setStoryDetailStory}
    onStartStory={(storyId) => void startStoryPlay(storyId)}
    onStoryInteraction={(kind, storyId, storyItem) => handleStoryInteraction(kind, storyId, storyItem)}
    onShareStory={(storyItem) => void shareStoryCardWithFeedback(storyItem)}
  />
);

const renderStoryDetailModal = () => {
  const coverUrl = storyDetailStory ? getStoryCoverUrl(storyDetailStory) : '';
  const tags = storyDetailStory ? getStoryTags(storyDetailStory) : [];
  const title = storyDetailStory ? formatBookTitle(getStoryTitle(storyDetailStory)) : '';
  const detailStoryId = storyDetailStory?.id || storyDetailStory?.storyId || storyDetailStory?.sourceStoryId;
  const detailSequelRequirement = storyDetailStory ? getSequelRequirementFromMeta(storyDetailStory) : null;

  const handleShareFromDetail = async () => {
    if (!storyDetailStory) return;
    try {
      setIsSharing(true);
      setGlobalLoadingMessage(isEnglish ? 'Preparing story share...' : '正在准备分享...');
      setGlobalLoadingDetail(isEnglish ? 'Creating the story link and opening the system share sheet.' : '正在创建故事链接，并打开系统分享面板。');
      await shareOriginalStoryByCard(storyDetailStory);
    } catch (error: any) {
      console.error(error);
      showError(error?.message || tr('分享失败', 'Share failed.'));
    } finally {
      setIsSharing(false);
      setGlobalLoadingMessage(null);
      setGlobalLoadingDetail(null);
    }
  };

  const handleAdminDeleteFromDetail = () => {
    if (!isAdminUser || !detailStoryId) return;
    setStoryDetailStory(null);
    setConfirmationModal({
      isOpen: true,
      title: tr('删除作品', 'Delete story'),
      message: isEnglish
        ? `Delete ${stripBookTitle(title)}? This removes the story content and cannot be undone.`
        : '确定删除' + stripBookTitle(title) + '吗？此操作会移除作品内容，无法复原。',
      onConfirm: () => {
        void (async () => {
          try {
            setGlobalLoadingMessage(isEnglish ? 'Deleting story...' : '正在删除作品...');
            await deleteStoryCartridge(db as any, detailStoryId);
            setPublicStories((prev) => prev.filter((story: any) => story.id !== detailStoryId));
            setMyStories((prev) => prev.filter((story: any) => story.id !== detailStoryId));
            setMySharedStories((prev) => prev.filter((story: any) => story.sourceStoryId !== detailStoryId && story.id !== detailStoryId));
            setStoryDetailStory(null);
            showError(tr('作品已删除', 'Story deleted.'));
          } catch (error: any) {
            console.error(error);
            showError(error?.message || tr('删除作品失败', 'Failed to delete story.'));
          } finally {
            setGlobalLoadingMessage(null);
          }
        })();
      },
    });
  };

  return (
    <StoryDetailModal
      story={storyDetailStory}
      coverUrl={coverUrl}
      tags={tags}
      title={title}
      mainAxis={storyDetailStory ? getStoryMainAxis(storyDetailStory) : ''}
      authorId={storyDetailStory?.authorId || storyDetailStory?.meta?.authorId}
      authorName={storyDetailStory ? getStoryAuthorName(storyDetailStory) : ''}
      isSharing={isSharing}
      isAdmin={Boolean(isAdminUser && detailStoryId)}
      sequelRequirement={detailSequelRequirement}
      statsNode={storyDetailStory ? renderStoryStats(storyDetailStory, 'detail', {
        storyId: detailStoryId,
        onLike: () => handleStoryInteraction('like', detailStoryId, storyDetailStory),
        onFavorite: () => handleStoryInteraction('favorite', detailStoryId, storyDetailStory),
        onShare: handleShareFromDetail,
      }) : null}
      tr={tr}
      t={t}
      stripBookTitle={stripBookTitle}
      AuthorNameButton={AuthorNameButton}
      onClose={() => setStoryDetailStory(null)}
      onPlay={() => {
        if (!detailStoryId) return;
        setStoryDetailStory(null);
        void startStoryPlay(detailStoryId);
      }}
      onShare={handleShareFromDetail}
      onAdminDelete={handleAdminDeleteFromDetail}
    />
  );
};
const renderSequelGateModal = () => (
  <SequelGateModal
    modal={sequelGateModal}
    tr={tr}
    stripBookTitle={stripBookTitle}
    onGoSource={(sourceStoryId) => {
      setSequelGateModal(null);
      void startStoryPlay(sourceStoryId);
    }}
    onShowSourceDetail={(sourceStoryId) => {
      const sourceStory = findStoryListItemById(sourceStoryId);
      if (sourceStory) setStoryDetailStory(sourceStory);
      setSequelGateModal(null);
    }}
    onClose={() => setSequelGateModal(null)}
  />
);

const getVisibleStoryLibraryItems = () => {
  let source = storyLibraryTab === 'mine' ? myStories : publicStories;
  const keyword = storyLibrarySearch.trim().toLowerCase();
  return [...source]
    .filter((story: any) => {
      if (!storyMatchesLanguage(story, appLanguage)) return false;
      if (storyLibraryTab === 'mine' && storyLibraryVisibilityFilter !== 'all' && story.visibility !== storyLibraryVisibilityFilter) return false;
      if (!keyword) return true;
      const haystack = `${getStoryTitle(story)}\n${getStoryAuthorName(story)}\n${getStoryMainAxis(story)}\n${getStoryTags(story).join(' ')}`.toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a: any, b: any) => {
      if (storyLibrarySort === 'likes') return getStoryLikeCount(b) - getStoryLikeCount(a);
      if (storyLibrarySort === 'interventions') return getStoryInterventionCount(b) - getStoryInterventionCount(a);
      if (storyLibrarySort === 'favorites') return getStoryFavoriteCount(b) - getStoryFavoriteCount(a);
      if (storyLibrarySort === 'shares') return getStoryShareCount(b) - getStoryShareCount(a);
      if (storyLibrarySort === 'words') return getStoryAverageChapterWords(b) - getStoryAverageChapterWords(a);
      return getStoryUpdatedMs(b) - getStoryUpdatedMs(a);
    });
};

const handleStoryLibrarySortChange = (nextSort: StoryLibrarySort) => {
  setStoryLibrarySort(nextSort);
  if (storyLibraryTab === 'public') {
    void refreshStories({ force: true, publicSort: nextSort });
  }
};

const renderStorySelectView = () => {
  const visibleStories = getVisibleStoryLibraryItems();
  const languagePublicCount = publicStories.filter((story) => storyMatchesLanguage(story, appLanguage)).length;
  const languageMineCount = myStories.filter((story) => storyMatchesLanguage(story, appLanguage)).length;
  return (
    <StorySelectView
      t={t}
      isEnglish={isEnglish}
      storyLibraryTab={storyLibraryTab}
      setStoryLibraryTab={setStoryLibraryTab}
      storyLibrarySearch={storyLibrarySearch}
      setStoryLibrarySearch={setStoryLibrarySearch}
      storyLibraryVisibilityFilter={storyLibraryVisibilityFilter}
      setStoryLibraryVisibilityFilter={setStoryLibraryVisibilityFilter}
      storyLibrarySort={storyLibrarySort}
      onSortChange={handleStoryLibrarySortChange}
      isLoadingStories={isLoadingStories}
      storyListLoadError={storyListLoadError}
      visibleStories={visibleStories}
      languagePublicCount={languagePublicCount}
      languageMineCount={languageMineCount}
      onRefresh={() => refreshStories({ force: true })}
      renderStoryCard={renderStoryCard}
    />
  );
};

  if (part === 'detail') return renderStoryDetailModal();
  if (part === 'sequel') return renderSequelGateModal();
  return renderStorySelectView();
}
