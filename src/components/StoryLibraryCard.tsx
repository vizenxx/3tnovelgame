import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Sparkles } from 'lucide-react';
import { semanticButtonClass } from './semanticClasses';

export const StoryLibraryCard = ({
  story,
  tr,
  t,
  formatBookTitle,
  getStoryCoverUrl,
  getStoryTags,
  getStoryTitle,
  getStoryAuthorName,
  getStoryMainAxis,
  hasStoryCardAction,
  getSequelRequirementFromMeta,
  renderStoryStats,
  renderStoryBiasBar,
  AuthorNameButton,
  onOpenDetail,
  onStartStory,
  onStoryInteraction,
  onShareStory,
}: {
  story: any;
  tr: (zh: string, en: string) => string;
  t: (key: string) => string;
  formatBookTitle: (title: any) => string;
  getStoryCoverUrl: (story: any) => string;
  getStoryTags: (story: any) => string[];
  getStoryTitle: (story: any) => string;
  getStoryAuthorName: (story: any) => string;
  getStoryMainAxis: (story: any) => string;
  hasStoryCardAction: (kind: 'like' | 'favorite', story: any) => boolean;
  getSequelRequirementFromMeta: (story: any) => any;
  renderStoryStats: (story: any, variant: 'card' | 'detail', actions: any) => React.ReactNode;
  renderStoryBiasBar: (story: any) => React.ReactNode;
  AuthorNameButton: React.ComponentType<any>;
  onOpenDetail: (story: any) => void;
  onStartStory: (storyId: string) => void;
  onStoryInteraction: (kind: 'like' | 'favorite', storyId: string, story: any) => void;
  onShareStory: (story: any) => void;
}) => {
  const coverUrl = getStoryCoverUrl(story);
  const tags = getStoryTags(story);
  const storyId = story?.id || story?.storyId || story?.sourceStoryId;
  const isLiked = hasStoryCardAction('like', story);
  const isFavorited = hasStoryCardAction('favorite', story);
  const sequelRequirement = getSequelRequirementFromMeta(story);
  const seriesId = String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '').trim();
  const isSeriesStory = Boolean(seriesId || story?.seriesTitle || story?.seriesConstraints?.seriesTitle || story?.meta?.seriesConstraints?.seriesTitle);

  return (
    <motion.div
      key={storyId || story.id}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onOpenDetail(story)}
      className={`story-library-card group p-4 transition-all cursor-pointer ${
        isLiked ? 'ring-1 ring-pink-500/18' : isFavorited ? 'ring-1 ring-amber-500/18' : ''
      }`}
    >
      <div className="relative flex h-full min-h-0 gap-4">
        <div className="w-28 shrink-0 sm:w-32">
          <div className="story-card-kind-badge" data-kind={isSeriesStory ? 'series' : 'standalone'}>
            {isSeriesStory ? tr('系列作品', 'Series') : tr('单篇作品', 'Standalone')}
          </div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpenDetail(story); }} className="story-library-cover h-28 w-28 cursor-pointer transition-all hover:ring-2 hover:ring-indigo-400/70 hover:ring-offset-2 hover:ring-offset-zinc-950 sm:h-32 sm:w-32">
            {coverUrl ? (
              <img src={coverUrl} alt={tr(`${formatBookTitle(getStoryTitle(story))} 封面`, `${formatBookTitle(getStoryTitle(story))} cover`)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">
                3T NOVEL
              </div>
            )}
          </button>
          {renderStoryStats(story, 'card', {
            storyId,
            onLike: () => onStoryInteraction('like', storyId, story),
            onFavorite: () => onStoryInteraction('favorite', storyId, story),
            onShare: () => onShareStory(story),
          })}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {renderStoryBiasBar(story)}
          <h3 className="mb-1 line-clamp-2 whitespace-normal break-words text-[1.35rem] font-black leading-tight text-white transition-colors group-hover:text-indigo-200 sm:text-[1.45rem]">
            {formatBookTitle(getStoryTitle(story))}
          </h3>
          <div className="mb-1 truncate text-sm font-bold text-app-muted/85">
            <AuthorNameButton authorId={story.authorId || story.meta?.authorId} authorName={getStoryAuthorName(story)} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="story-library-desc-fade mb-2 text-[0.92rem] leading-relaxed text-app-text/85 transition-colors group-hover:text-app-text sm:text-[0.96rem]">
              {getStoryMainAxis(story)}
            </p>
            {sequelRequirement && (
              <div className="mb-2 shrink-0 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
                {tr('续作：需完成前作条件', 'Sequel: prequel requirements')}
              </div>
            )}
          </div>
          <div className="mb-2 flex min-w-0 shrink-0 flex-wrap gap-1.5">
            {(tags.length > 0 ? tags.slice(0, 3) : [tr('未标签', 'Untagged')]).map((tag: string) => (
              <span key={tag} className="rounded-lg border border-indigo-400/15 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-black text-indigo-200">
                {tag}
              </span>
            ))}
          </div>
          <div className="grid shrink-0 gap-2 sm:grid-cols-2">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenDetail(story); }} className={`${semanticButtonClass('secondary', { fullWidth: true, compact: true })} text-sm`}>
              <BookOpen className="h-4 w-4" />
              {t('library.details')}
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); if (storyId) onStartStory(storyId); }} className={`${semanticButtonClass('primary', { fullWidth: true, compact: true })} text-sm`}>
              <Sparkles className="h-4 w-4" />
              {t('library.intervene')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
