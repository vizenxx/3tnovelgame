import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Heart,
  Loader2,
  LogIn,
  Menu,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { BackNavButton } from './BackNavButton';
import { semanticButtonClass, semanticIconButtonClass, semanticMenuButtonClass } from './semanticClasses';
import { createStoryBranch, deleteStoryBranch, upsertStoryBranch } from '../storyStore';

type AuthoringListSort = 'updated' | 'created' | 'likes' | 'favorites' | 'shares' | 'interventions';

export function AuthoringView({ ctx }: { ctx: any }) {
  const {
    tr,
    t,
    isEnglish,
    renderInlineHelp,
    goBack,
    handleCreateAuthoringStory,
    authoringSaving,
    dismissAuthorPulseNotification,
    authorPulseNotifications,
    openSeriesWorldView,
    refreshStories,
    authoringListSearch,
    setAuthoringListSearch,
    authoringSeriesKindFilter,
    setAuthoringSeriesKindFilter,
    seriesWorlds,
    authoringSeriesWorldFilter,
    setAuthoringSeriesWorldFilter,
    authoringListVisibilityFilter,
    setAuthoringListVisibilityFilter,
    authoringCreatedFilter,
    setAuthoringCreatedFilter,
    authoringListSort,
    setAuthoringListSort,
    setAuthoringLoadingStoryId,
    selectAuthoringStory,
    authoringLoadingStoryId,
    formatShortDate,
    getStoryTitle,
    getStoryLikeCount,
    getStoryFavoriteCount,
    getStoryShareCount,
    getStoryInterventionCount,
    handleDeleteAuthoringStory,
    authoringCartridge,
    setAuthoringCartridge,
    authoringStoryId,
    setAuthoringStoryId,
    authoringDirty,
    authoringTab,
    setAuthoringTab,
    handleSaveAuthoringChanges,
    authoringFindReplaceOpen,
    setAuthoringFindReplaceOpen,
    authoringTocOpen,
    setAuthoringTocOpen,
    authoringFindCompact,
    setAuthoringFindCompact,
    getAuthoringFindMatches,
    authoringFindMatchIndex,
    moveAuthoringFindMatch,
    replaceCurrentAuthoringMatch,
    authoringFindQuery,
    setAuthoringFindQuery,
    authoringReplaceQuery,
    setAuthoringReplaceQuery,
    authoringFindScope,
    setAuthoringFindScope,
    authoringFindChapterNums,
    setAuthoringFindChapterNums,
    authoringFindEndingIds,
    setAuthoringFindEndingIds,
    handleAuthoringReplaceAll,
    stripBookTitle,
    authoringCustomTagsInput,
    setAuthoringCustomTagsInput,
    parseTagInput,
    authoringCoverPrompt,
    setAuthoringCoverPrompt,
    handleAuthoringCoverPaste,
    handleAuthoringCoverUpload,
    applyAuthoringCover,
    isGeneratingCover,
    handleGenerateAuthoringCover,
    canUseCoverGeneration,
    endingBiasAxisFromBias,
    endingBiasFromAxis,
    endingBiasAxisLabel,
    handleAuthoringImport,
    authoringImportText,
    setAuthoringImportText,
    authoringImportReplaceBranches,
    setAuthoringImportReplaceBranches,
    showError,
    updateSeriesConstraints,
    getSeriesBaselineRules,
    getSeriesCharacterCards,
    authoringSeriesStoryOptions,
    authoringContinuitySourceStory,
    updateAuthoringSourceStory,
    authoringContinuityLoading,
    authoringContinuityBranches,
    authoringContinuityEndings,
    normalizeTagList,
    asSafeArray,
    loadContinuityNodesForSeries,
    authoringEndingIdToLabel,
    endingDomainFromId,
    endingDomainCards,
    expandedBranchId,
    setExpandedBranchId,
    branchForm,
    setBranchForm,
    branchConditions,
    setBranchConditions,
    myStories,
    getVisibilityLabel,
    formatBookTitle,
    getStoryCreatedMs,
    getStoryUpdatedMs,
    setConfirmationModal,
    setAuthoringDirty,
    openCompactFindMode,
    loadSeriesWorlds,
    formatStoryHeading,
    endingDomainTitle,
    createEndingIdForDomain,
    setSelectedBranchId,
    normalizeBranchTier,
    db,
    chapterOptions,
    normalizeCharacters,
    triggerPreview,
    normalizeBranchConditionsForStorage,
    branchTierLabel,
    formatTriggerCondition,
    setIsActionMenuOpen,
    handleStoryInteraction,
    user,
    isCurrentStoryActive,
    isSharing,
    handleShareStory,
    handleRestartStory,
  } = ctx;

  const safeArray = asSafeArray as <T>(value: unknown) => T[];

const renderBranchForm = (isNew: boolean) => (
  <div className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-5 space-y-4">
    <div className="flex items-center justify-between">
      <div className="text-sm font-black text-white">{isNew ? tr('新建支线', 'New branch') : tr('编辑支线', 'Edit branch')}</div>
      <button type="button" onClick={() => setExpandedBranchId(null)} className={semanticButtonClass('ghost', { compact: true })}>
        <X className="h-4 w-4" />
        {tr('取消', 'Cancel')}
      </button>
    </div>
    <div>
      <input value={branchForm.name} onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500" placeholder={tr('支线名', 'Branch name')} />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <select value={branchForm.side} onChange={(event) => setBranchForm((prev) => ({ ...prev, side: event.target.value as 'left' | 'right' }))} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500">
        <option value="left">{tr('左域支线', 'Left-domain branch')}</option>
        <option value="right">{tr('右域支线', 'Right-domain branch')}</option>
      </select>
      <select value={branchForm.tier} onChange={(event) => setBranchForm((prev) => ({ ...prev, tier: event.target.value as 'small' | 'medium' | 'large' }))} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500">
        <option value="small">{tr('影响：小', 'Impact: small')}</option>
        <option value="medium">{tr('影响：中', 'Impact: medium')}</option>
        <option value="large">{tr('影响：大', 'Impact: large')}</option>
      </select>
    </div>
    <label className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 text-sm text-app-text">
      <input
        type="checkbox"
        checked={branchForm.isHidden}
        onChange={(event) => setBranchForm((prev) => ({ ...prev, isHidden: event.target.checked }))}
        className="mt-1 h-4 w-4 accent-amber-500"
      />
      <span>
        <span className="block font-black text-amber-200">{tr('隐藏支线', 'Hidden branch')}</span>
        <span className="mt-1 block text-xs leading-relaxed text-app-muted">{tr('隐藏支线不会提前暴露完整内容；玩家需要在游玩中触发后，才会看到这条支线的具体情节。', 'Hidden branches do not reveal full content early. Players see the details only after triggering them during play.')}</span>
      </span>
    </label>
    <div className="rounded-2xl border border-app-border bg-app-surface/30 p-4">
      <label className="block space-y-2 text-sm font-bold text-app-text">
        <span>{tr('导向结局绑定', 'Ending binding')}</span>
        <select
          value={branchForm.endingId}
          onChange={(event) => setBranchForm((prev) => ({ ...prev, endingId: event.target.value }))}
          className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
        >
          <option value="">{tr('自动进入该域的默认结局', 'Auto-use the default ending in this domain')}</option>
          {(authoringCartridge?.endings || []).map((ending: any) => (
            <option key={ending.id} value={ending.id}>
              {tr('绑定', 'Bind')} {ending.title || authoringEndingIdToLabel(ending.id)}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs leading-relaxed text-app-muted">{tr('支线可以只影响左域/右域走向，也可以进一步绑定到某个具体结局。没有绑定时，会自动进入该域的默认结局。', 'A branch can affect only left/right direction, or bind to a specific ending. Without a binding, it uses that domain’s default ending.')}</p>
    </div>
    <textarea value={branchForm.sceneText} onChange={(event) => setBranchForm((prev) => ({ ...prev, sceneText: event.target.value }))} className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-sm text-app-text outline-none focus:border-indigo-500" placeholder={tr('支线情节（300 字以内）', 'Branch scene (within 300 words)')} />
    <div className="space-y-3">
      <div className="text-sm font-black text-white">{tr('触发条件', 'Trigger Conditions')}</div>
      {branchConditions.map((condition, idx) => (
        <div key={idx} className="rounded-2xl border border-app-border bg-app-surface/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black text-app-muted">{tr('条件组', 'Condition group')} {idx + 1}</div>
            {branchConditions.length > 1 && (
              <button type="button" onClick={() => setBranchConditions((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))} className={semanticButtonClass('danger', { compact: true })}>
                <Trash2 className="h-4 w-4" />
                {tr('删除条件', 'Delete condition')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={condition.kind} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, kind: event.target.value as 'single' | 'count' } : item))} className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500 min-w-[120px]">
              <option value="single">{tr('单次判定', 'Single check')}</option>
              <option value="count">{tr('累计判定', 'Cumulative check')}</option>
            </select>
            <select value={condition.kind === 'single' ? condition.singleChapterNum : condition.upToChapterNum} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleChapterNum: Number(event.target.value) } : { ...item, upToChapterNum: Number(event.target.value) }) : item))} className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500 min-w-[100px]">
              {chapterOptions.map((chapterNum) => <option key={chapterNum} value={chapterNum}>{isEnglish ? `Chapter ${chapterNum}` : `第${chapterNum}章`}</option>)}
            </select>
            <select value={condition.kind === 'single' ? condition.singleCharId : condition.countCharId} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? (condition.kind === 'single' ? { ...item, singleCharId: event.target.value } : { ...item, countCharId: event.target.value }) : item))} className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500 min-w-[140px]">
              <option value="">{tr('选择角色', 'Choose character')}</option>
              {normalizeCharacters(authoringCartridge?.meta?.characters || []).map((character: any) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
            {condition.kind === 'single' ? (
              <select value={condition.singleAction} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, singleAction: event.target.value as 'bless' | 'curse' } : item))} className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500 min-w-[100px]">
                <option value="bless">{tr('庇佑', 'Bless')}</option>
                <option value="curse">{tr('磨难', 'Hardship')}</option>
              </select>
            ) : (
              <>
                <select value={condition.countAction} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, countAction: event.target.value as 'bless' | 'curse' } : item))} className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500 min-w-[100px]">
                  <option value="bless">{tr('庇佑', 'Bless')}</option>
                  <option value="curse">{tr('磨难', 'Hardship')}</option>
                </select>
                <input type="number" min={1} value={condition.minCount} onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, minCount: Math.max(1, Number(event.target.value) || 1) } : item))} className="w-24 rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500" placeholder={tr('累计次数', 'Count')} />
              </>
            )}
          </div>
          <div>
            <input
              type="text"
              value={condition.hint || ''}
              onChange={(event) => setBranchConditions((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, hint: event.target.value } : item))}
              className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-2 text-sm text-app-text outline-none focus:border-indigo-500"
              placeholder={tr('提示（可选，在触发条件中设置，多条件时可针对不同条件设置提示）', 'Hint (optional, set in trigger conditions. Multi-conditions can have different hints)')}
            />
          </div>
          <div className="text-xs text-indigo-300">
            {triggerPreview({
              triggerType: condition.kind,
              singleChapterNum: condition.singleChapterNum,
              singleCharId: condition.singleCharId,
              singleAction: condition.singleAction,
              countCharId: condition.countCharId,
              countAction: condition.countAction,
              minCount: condition.minCount,
              upToChapterNum: condition.upToChapterNum,
              characters: normalizeCharacters(authoringCartridge?.meta?.characters || []),
            })}
          </div>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setBranchConditions((prev) => prev.length >= 3 ? prev : [...prev, { kind: 'single', singleChapterNum: 2, singleCharId: '', singleAction: 'bless', countCharId: '', countAction: 'bless', minCount: 1, upToChapterNum: 6 }])} className={semanticButtonClass('ghost', { compact: true })}>
        {tr('新增条件组', 'Add condition group')}
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!authoringStoryId || !branchForm.name.trim()) {
            showError(tr('请先填写支线名。', 'Please enter a branch name first.'));
            return;
          }
          const payload = {
            side: branchForm.side,
            tier: normalizeBranchTier(branchForm.tier),
            is_hidden: branchForm.isHidden,
            endingId: branchForm.endingId || undefined,
            name: branchForm.name,
            desc: branchForm.sceneText.slice(0, 80) || branchForm.name,
            common: false,
            hint: '',
            trigger: normalizeBranchConditionsForStorage(branchConditions)[0],
            triggerGroups: normalizeBranchConditionsForStorage(branchConditions),
            inject: { mustHappen: branchForm.sceneText ? [branchForm.sceneText] : [], mustReveal: [], mustChange: [], hidden: branchForm.isHidden, endingId: branchForm.endingId || undefined },
            sceneText: branchForm.sceneText,
          } as any;
          if (isNew) {
            const newId = await createStoryBranch(db as any, authoringStoryId, payload);
            await selectAuthoringStory(authoringStoryId, { keepTab: true, keepBranchSelection: false });
            setExpandedBranchId(null);
            showError(tr('支线已创建。', 'Branch created.'));
          } else {
            await upsertStoryBranch(db as any, authoringStoryId, branchForm.id, payload);
            await selectAuthoringStory(authoringStoryId, { keepTab: true, keepBranchSelection: true });
            showError(tr('支线已保存。', 'Branch saved.'));
          }
        }}
        className={semanticButtonClass('primary', { compact: true })}
      >
        {isNew ? tr('创建支线', 'Create branch') : tr('保存修改', 'Save changes')}
      </button>
    </div>
  </div>
);

const getFilteredAuthoringStories = () => {
  const query = authoringListSearch.trim().toLowerCase();
  const getAuthoringStorySeriesId = (story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '').trim();
  return [...myStories]
    .filter((story: any) => {
      const seriesId = getAuthoringStorySeriesId(story);
      if (authoringSeriesKindFilter === 'standalone' && seriesId) return false;
      if (authoringSeriesKindFilter === 'series' && !seriesId) return false;
      if (authoringSeriesWorldFilter !== 'all' && seriesId !== authoringSeriesWorldFilter) return false;
      if (authoringListVisibilityFilter !== 'all' && (story.visibility || 'private') !== authoringListVisibilityFilter) return false;
      if (authoringCreatedFilter !== 'all') {
        const createdAt = getStoryCreatedMs(story);
        const maxAgeMs = authoringCreatedFilter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : authoringCreatedFilter === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 365 * 24 * 60 * 60 * 1000;
        if (!createdAt || Date.now() - createdAt > maxAgeMs) return false;
      }
      if (!query) return true;
      const haystack = [
        getStoryTitle(story),
        story?.authorName,
        story?.mainAxis,
        ...(story?.tags || story?.meta?.tags || []),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a: any, b: any) => {
      if (authoringListSort === 'created') return getStoryCreatedMs(b) - getStoryCreatedMs(a);
      if (authoringListSort === 'likes') return getStoryLikeCount(b) - getStoryLikeCount(a);
      if (authoringListSort === 'favorites') return getStoryFavoriteCount(b) - getStoryFavoriteCount(a);
      if (authoringListSort === 'shares') return getStoryShareCount(b) - getStoryShareCount(a);
      if (authoringListSort === 'interventions') return getStoryInterventionCount(b) - getStoryInterventionCount(a);
      return getStoryUpdatedMs(b) - getStoryUpdatedMs(a);
    });
};

const getAuthoringStorySeriesId = (story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '').trim();
const getAuthoringStorySeriesName = (story: any) => {
  const seriesId = getAuthoringStorySeriesId(story);
  if (!seriesId) return tr('单独作品', 'Standalone');
  return seriesWorlds.find((series) => series.id === seriesId)?.title || tr('世界观作品', 'World setting work');
};

const renderAuthoringStatChip = (label: string, value: string | number, Icon: any, tone = 'text-app-text') => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-app-border/80 bg-app-bg/55 px-2.5 py-1 text-[11px] font-black text-app-text">
    <Icon className={`h-3.5 w-3.5 ${tone}`} />
    <span className="text-app-muted">{label}</span>
    <span className="text-app-text">{value}</span>
  </span>
);

const renderAuthorPulsePanel = () => {
  if (authorPulseNotifications.length === 0) return null;
  return (
    <div className="mb-5 grid gap-2">
      {authorPulseNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`app-card flex items-start justify-between gap-3 rounded-2xl px-4 py-3 ${
            notification.tone === 'like'
              ? 'border-rose-400/25 bg-rose-500/10'
              : notification.tone === 'favorite'
              ? 'border-amber-400/25 bg-amber-500/10'
              : notification.tone === 'share'
              ? 'border-cyan-400/25 bg-cyan-500/10'
              : notification.tone === 'intervention'
              ? 'border-indigo-400/25 bg-indigo-500/10'
              : 'border-emerald-400/25 bg-emerald-500/10'
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-full border border-white/10 bg-white/10 p-2">
              <Bell className="h-4 w-4 text-app-text" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-white">{notification.title}</div>
              <div className="mt-1 text-xs font-semibold leading-relaxed text-app-text">{notification.detail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissAuthorPulseNotification(notification.id)}
            className="rounded-full p-1 text-app-muted transition-colors hover:bg-white/10 hover:text-app-text active:scale-95"
            aria-label="关闭通知"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

const renderAuthoringView = () => (
  <div className="authoring-studio mx-auto max-w-5xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
    {!authoringCartridge ? (
      <>
        {renderInlineHelp('authoring-list', '创作者后台指引', '欢迎来到命运馆的作者工坊。在这里你可以新建单独的叙事卡带，或者建立并绑定自定义的世界观体系。你发布的作品将展示在公共书库中。数据面板可以帮你评估哪些命运走向和分支吸引了最多执行官的干涉。')}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <BackNavButton label={tr('返回上一页', 'Back')} onClick={() => goBack('STORY_SELECT')} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => handleCreateAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('secondary', { compact: true })}>
              <Sparkles className="h-4 w-4" />
              {tr('新建作品', 'New work')}
            </button>
            <button type="button" onClick={() => void openSeriesWorldView()} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
              <GitBranch className="h-4 w-4" />
              {tr('世界观设定', 'World settings')}
            </button>
            <button type="button" onClick={() => refreshStories({ force: true })} disabled={authoringSaving} className={semanticButtonClass('ghost', { compact: true })}>
              <RefreshCcw className="h-4 w-4" />
              {tr('刷新列表', 'Refresh list')}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-2xl font-black text-white">
                <BarChart3 className="h-5 w-5 text-indigo-300" />
                {tr('我的作品', 'My Works')}
              </div>
              <div className="mt-1 text-xs font-semibold text-app-muted">{tr('用数据判断哪些命运线值得继续扩写、改版或推广。', 'Use stats to decide which fate lines deserve expansion, revision, or promotion.')}</div>
            </div>
            <div className="text-xs font-black text-app-muted">{myStories.length} {tr('部作品', 'works')}</div>
          </div>
          <div className="mb-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.2fr_auto_auto_auto_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
              <input
                value={authoringListSearch}
                onChange={(event) => setAuthoringListSearch(event.target.value)}
                placeholder={tr('搜索作品、标签或主轴', 'Search works, tags, or premise')}
                className="w-full rounded-2xl border border-app-border bg-app-input-bg/60 py-3 pl-10 pr-4 text-sm font-semibold text-app-text outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400/70"
              />
            </label>
            <select
              value={authoringSeriesKindFilter}
              onChange={(event) => {
                const value = event.target.value as typeof authoringSeriesKindFilter;
                setAuthoringSeriesKindFilter(value);
                if (value !== 'series') setAuthoringSeriesWorldFilter('all');
              }}
              className="rounded-2xl border border-app-border bg-app-input-bg/60 px-4 py-3 text-sm font-black text-app-text outline-none focus:border-indigo-400/70"
            >
              <option value="all">{tr('全部作品', 'All works')}</option>
              <option value="standalone">{tr('单独作品', 'Standalone')}</option>
              <option value="series">{tr('世界观作品', 'World setting')}</option>
            </select>
            <select
              value={authoringSeriesWorldFilter}
              onChange={(event) => {
                setAuthoringSeriesWorldFilter(event.target.value);
                if (event.target.value !== 'all') setAuthoringSeriesKindFilter('series');
              }}
              className="rounded-2xl border border-app-border bg-app-input-bg/60 px-4 py-3 text-sm font-black text-app-text outline-none focus:border-indigo-400/70"
            >
              <option value="all">{tr('全部世界观', 'All settings')}</option>
              {seriesWorlds.map((series) => (
                <option key={series.id} value={series.id}>{series.title || tr('未命名世界观', 'Untitled setting')}</option>
              ))}
            </select>
            <select
              value={authoringListVisibilityFilter}
              onChange={(event) => setAuthoringListVisibilityFilter(event.target.value as typeof authoringListVisibilityFilter)}
              className="rounded-2xl border border-app-border bg-app-input-bg/60 px-4 py-3 text-sm font-black text-app-text outline-none focus:border-indigo-400/70"
            >
              <option value="all">{tr('全部可见性', 'All visibility')}</option>
              <option value="public">{tr('公开', 'Public')}</option>
              <option value="unlisted">{tr('非公开链接', 'Unlisted link')}</option>
              <option value="private">{tr('私人', 'Private')}</option>
            </select>
            <select
              value={authoringCreatedFilter}
              onChange={(event) => setAuthoringCreatedFilter(event.target.value as typeof authoringCreatedFilter)}
              className="rounded-2xl border border-app-border bg-app-input-bg/60 px-4 py-3 text-sm font-black text-app-text outline-none focus:border-indigo-400/70"
            >
              <option value="all">{tr('全部创作日期', 'All creation dates')}</option>
              <option value="7d">{tr('近 7 天', 'Last 7 days')}</option>
              <option value="30d">{tr('近 30 天', 'Last 30 days')}</option>
              <option value="365d">{tr('近 1 年', 'Last year')}</option>
            </select>
            <select
              value={authoringListSort}
              onChange={(event) => setAuthoringListSort(event.target.value as AuthoringListSort)}
              className="rounded-2xl border border-app-border bg-app-input-bg/60 px-4 py-3 text-sm font-black text-app-text outline-none focus:border-indigo-400/70"
            >
              <option value="updated">{tr('最近更新', 'Recently updated')}</option>
              <option value="created">{tr('创作日期', 'Creation date')}</option>
              <option value="likes">{tr('点赞最多', 'Most liked')}</option>
              <option value="favorites">{tr('收藏最多', 'Most favorited')}</option>
              <option value="shares">{tr('分享最多', 'Most shared')}</option>
              <option value="interventions">{tr('干涉最多', 'Most intervened')}</option>
            </select>
          </div>
          {myStories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-bg/40 p-10 text-center text-app-muted">
              {tr('还没有作品，点击“新建作品”开始创作。', 'No works yet. Click “New work” to start creating.')}
            </div>
          ) : getFilteredAuthoringStories().length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-bg/40 p-8 text-center text-sm font-semibold text-app-muted">
              {tr('没有符合当前筛选的作品。', 'No works match the current filters.')}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {getFilteredAuthoringStories().map((story: any) => (
                <button
                  key={story.id}
                  type="button"
                  disabled={authoringLoadingStoryId === story.id}
                  onClick={async () => {
                    setAuthoringLoadingStoryId(story.id);
                    await selectAuthoringStory(story.id);
                    setAuthoringLoadingStoryId(null);
                  }}
                  className={`app-card relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:shadow-xl active:scale-[0.98] ${authoringLoadingStoryId === story.id ? 'opacity-70 pointer-events-none' : ''}`}
                >
                  {authoringLoadingStoryId === story.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-app-bg/60 backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                  )}
                  <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur-md ${
                    story.visibility === 'public'
                      ? 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200'
                      : story.visibility === 'unlisted'
                      ? 'border-sky-400/25 bg-sky-500/15 text-sky-200'
                      : 'border-app-border bg-app-surface/80 text-app-text'
                  }`}>
                    {getVisibilityLabel(story.visibility)}
                  </span>
                  <div className="pr-24">
                    <div className="line-clamp-3 text-lg font-black text-white leading-tight">{formatBookTitle(getStoryTitle(story))}</div>
                    <div className="mt-2 text-xs font-semibold text-app-muted">{tr('创作', 'Created')} {formatShortDate(getStoryCreatedMs(story))} · {tr('更新', 'Updated')} {formatShortDate(getStoryUpdatedMs(story))}</div>
                    <div className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                      getAuthoringStorySeriesId(story)
                        ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200'
                        : 'border-app-border bg-app-surface/70 text-app-muted'
                    }`}>
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate">{getAuthoringStorySeriesName(story)}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {renderAuthoringStatChip(tr('点赞', 'Likes'), getStoryLikeCount(story), Heart, 'text-rose-300')}
                    {renderAuthoringStatChip(tr('收藏', 'Favorites'), getStoryFavoriteCount(story), Bookmark, 'text-amber-300')}
                    {renderAuthoringStatChip(tr('分享', 'Shares'), getStoryShareCount(story), ExternalLink, 'text-cyan-300')}
                    {renderAuthoringStatChip(tr('干涉', 'Interventions'), getStoryInterventionCount(story), Sparkles, 'text-indigo-300')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    ) : (
      <>
        {renderInlineHelp('authoring-editor', '故事编辑器指南', '这里是故事的核心编织区。你可以设置【作品设置】里的题材与登场人物，编写【主线和结局】（第 1 至第 7 章基础正文与结局名称）。通过【角色和支线】选项卡，你可以配置“命运分支规则”，设定玩家施加庇佑（Bless）或磨难（Curse）时被解锁，并注入改动覆盖指定章节，引导出截然相异的终章结局。')}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <BackNavButton
            label={tr('返回列表', 'Back to list')}
            onClick={() => {
              if (authoringDirty) {
                setConfirmationModal({
                  isOpen: true,
                  title: tr('放弃未保存的更改', 'Discard unsaved changes'),
                  message: tr('退出编辑模式将丢失当前未保存的内容，确定要离开吗？', 'Leaving the editor will discard unsaved changes. Continue?'),
                  onConfirm: () => {
                    setAuthoringDirty(false);
                    setAuthoringStoryId(null);
                    setAuthoringCartridge(null);
                  },
                });
              } else {
                setAuthoringStoryId(null);
                setAuthoringCartridge(null);
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="authoring-save-pill inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
              data-state={authoringSaving ? 'saving' : authoringDirty ? 'dirty' : 'saved'}
            >
              {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : authoringDirty ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {authoringSaving ? tr('保存中', 'Saving') : authoringDirty ? tr('有未保存更改', 'Unsaved changes') : tr('已保存', 'Saved')}
            </div>
            <button type="button" onClick={() => handleDeleteAuthoringStory()} disabled={authoringSaving} className={semanticButtonClass('danger', { compact: true })}>
              <Trash2 className="h-4 w-4" />
              {tr('删除作品', 'Delete work')}
            </button>
            <button type="button" onClick={handleSaveAuthoringChanges} disabled={authoringSaving} className={semanticButtonClass('primary', { compact: true })}>
              {authoringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tr('保存更改', 'Save changes')}
            </button>
          </div>
        </div>

        <div className="authoring-tabbar mb-8">
          <button type="button" onClick={() => setAuthoringTab('settings')} className={`authoring-tab-button ${authoringTab === 'settings' ? 'is-active' : ''}`}>
            <Copy className="mb-1 h-4 w-4 shrink-0" />{tr('作品设置', 'Settings')}
          </button>
          <button type="button" onClick={() => setAuthoringTab('series')} className={`authoring-tab-button ${authoringTab === 'series' ? 'is-active' : ''}`}>
            <GitBranch className="mb-1 h-4 w-4 shrink-0" />{tr('系列设置', 'Series')}
          </button>
          <button type="button" onClick={() => setAuthoringTab('mainline')} className={`authoring-tab-button ${authoringTab === 'mainline' ? 'is-active' : ''}`}>
            <BookOpen className="mb-1 h-4 w-4 shrink-0" />{tr('主线和结局', 'Mainline & Endings')}
          </button>
          <button type="button" onClick={() => setAuthoringTab('branches')} className={`authoring-tab-button ${authoringTab === 'branches' ? 'is-active' : ''}`}>
            <Sparkles className="mb-1 h-4 w-4 shrink-0" />{tr('角色和支线', 'Characters & Branches')}
          </button>
        </div>

        <div className="fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+5rem)] left-8 z-[1700]">
          <button
            type="button"
            onClick={() => {
              if (authoringFindCompact) {
                setAuthoringFindCompact(false);
                setAuthoringFindReplaceOpen(true);
                return;
              }
              setAuthoringFindReplaceOpen((prev) => !prev);
            }}
            aria-label={tr('查找 / 替换', 'Find / Replace')}
            className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl backdrop-blur-md transition-all hover:-translate-y-0.5 active:scale-95 ${
              authoringFindReplaceOpen || authoringFindCompact
                ? 'border-indigo-400 bg-indigo-500 text-white'
                : 'border-app-border bg-app-bg/90 text-app-text hover:border-indigo-500 hover:text-white'
            }`}
          >
            {authoringFindCompact ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          {authoringFindCompact && (
            <div className="absolute bottom-16 left-0 grid w-44 gap-1.5 rounded-[1.25rem] border border-indigo-500/30 bg-app-bg/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <button type="button" onClick={() => moveAuthoringFindMatch(-1)} className={semanticButtonClass('ghost', { compact: true, fullWidth: true })}>
                {tr('上一个', 'Previous')}
              </button>
              <button type="button" onClick={() => moveAuthoringFindMatch(1)} className={semanticButtonClass('ghost', { compact: true, fullWidth: true })}>
                {tr('下一个', 'Next')}
              </button>
              <button
                type="button"
                onClick={replaceCurrentAuthoringMatch}
                disabled={!authoringFindQuery}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 transition-all hover:border-amber-300 hover:bg-amber-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tr('替换', 'Replace')}
              </button>
              <div className="px-1 text-center text-[10px] font-bold text-app-muted">
                {tr('点击左下角 X 返回设置', 'Tap the X to return to settings')}
              </div>
            </div>
          )}
          {authoringFindReplaceOpen && (
            <div className="absolute bottom-16 left-0 grid max-h-[min(76dvh,680px)] w-[min(92vw,44rem)] gap-3 overflow-y-auto rounded-[1.75rem] border border-indigo-500/30 bg-app-bg/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-white">{tr('查找 / 替换', 'Find / Replace')}</div>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('可指定章节、结局或角色范围，避免误改其他段落。', 'Choose chapter, ending, or character scope to avoid changing unrelated text.')}</p>
                </div>
                <button type="button" onClick={() => setAuthoringFindReplaceOpen(false)} className={semanticIconButtonClass('ghost')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold text-app-muted">
                  <span>{tr('查找文字', 'Find text')}</span>
                  <input
                    value={authoringFindQuery}
                    onChange={(event) => setAuthoringFindQuery(event.target.value)}
                    className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                    placeholder={tr('输入要查找的文字', 'Enter text to find')}
                  />
                </label>
                <label className="space-y-1 text-xs font-bold text-app-muted">
                  <span>{tr('替换成', 'Replace with')}</span>
                  <input
                    value={authoringReplaceQuery}
                    onChange={(event) => setAuthoringReplaceQuery(event.target.value)}
                    className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                    placeholder={tr('留空则删除查找文字', 'Leave blank to delete matched text')}
                  />
                </label>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    ['chapters', tr('章节', 'Chapters')],
                    ['endings', tr('结局', 'Endings')],
                    ['characters', tr('角色', 'Characters')],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface/50 px-3 py-2 text-xs font-bold text-app-text">
                      <input
                        type="checkbox"
                        checked={authoringFindScope[key]}
                        onChange={(event) => setAuthoringFindScope((prev) => ({ ...prev, [key]: event.target.checked }))}
                        className="accent-indigo-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {authoringFindScope.chapters && (
                  <div className="rounded-2xl border border-app-border bg-app-surface/35 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{tr('章节范围', 'Chapter scope')}</div>
                      <button
                        type="button"
                        onClick={() => setAuthoringFindChapterNums((authoringCartridge.chapters || []).map((chapter: any) => Number(chapter.chapter_num)).filter((chapterNum: number) => Number.isFinite(chapterNum)))}
                        className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                      >
                        {tr('全选章节', 'Select all chapters')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(authoringCartridge.chapters || []).map((chapter: any) => {
                        const chapterNum = Number(chapter.chapter_num);
                        const selected = authoringFindChapterNums.includes(chapterNum);
                        return (
                          <label key={chapterNum} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100' : 'border-app-border bg-app-bg/60 text-app-muted'}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setAuthoringFindChapterNums((prev) => event.target.checked ? [...new Set([...prev, chapterNum])].sort((a, b) => a - b) : prev.filter((item) => item !== chapterNum))}
                              className="accent-indigo-500"
                            />
                            {isEnglish ? `Chapter ${chapterNum}` : `第${chapterNum}章`}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {authoringFindScope.endings && (
                  <div className="rounded-2xl border border-app-border bg-app-surface/35 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{tr('结局范围', 'Ending scope')}</div>
                      <button
                        type="button"
                        onClick={() => setAuthoringFindEndingIds((authoringCartridge.endings || []).map((ending: any) => String(ending.id || '')).filter(Boolean))}
                        className="text-xs font-black text-indigo-300 hover:text-indigo-100"
                      >
                        {tr('全选结局', 'Select all endings')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(authoringCartridge.endings || []).map((ending: any) => {
                        const endingId = String(ending.id || '');
                        const selected = authoringFindEndingIds.includes(endingId);
                        return (
                          <label key={endingId} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100' : 'border-app-border bg-app-bg/60 text-app-muted'}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setAuthoringFindEndingIds((prev) => event.target.checked ? [...new Set([...prev, endingId])] : prev.filter((item) => item !== endingId))}
                              className="accent-indigo-500"
                            />
                            {ending.title || authoringEndingIdToLabel(ending.id)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={openCompactFindMode}
                  disabled={
                    !authoringFindQuery ||
                    !(
                      (authoringFindScope.chapters && authoringFindChapterNums.length > 0) ||
                      (authoringFindScope.endings && authoringFindEndingIds.length > 0) ||
                      authoringFindScope.characters
                    )
                  }
                  className={semanticButtonClass('secondary', { compact: true })}
                >
                  {tr('查找', 'Find')}
                </button>
                <button
                  type="button"
                  onClick={handleAuthoringReplaceAll}
                  disabled={
                    !authoringFindQuery ||
                    !(
                      (authoringFindScope.chapters && authoringFindChapterNums.length > 0) ||
                      (authoringFindScope.endings && authoringFindEndingIds.length > 0) ||
                      authoringFindScope.characters
                    )
                  }
                  className={semanticButtonClass('primary', { compact: true })}
                >
                  {tr('全部替换', 'Replace all')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthoringFindQuery('');
                    setAuthoringReplaceQuery('');
                  }}
                  className={semanticButtonClass('ghost', { compact: true })}
                >
                  {tr('清空', 'Clear')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
            {authoringTab === 'settings' && (
              <section className="space-y-4">

                <div className="pt-2">
                  <h3 className="text-xl font-black text-white">{tr('作品设置', 'Story Settings')}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('正式作品可选择私人、非公开链接或公开；收藏命运记录不会出现在这里。', 'Formal works can be private, unlisted, or public. Saved fate records do not appear here.')}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-app-muted">
                    <div>{tr('作品标题', 'Story title')}</div>
                    <input
                      value={stripBookTitle(authoringCartridge.meta?.title || '')}
                      onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, title: event.target.value } }))}
                      className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-app-text outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-app-muted">
                    <div>{tr('标签（以中文逗号分隔）', 'Tags (comma-separated)')}</div>
                    <input
                      value={authoringCustomTagsInput}
                      onChange={(event) => setAuthoringCustomTagsInput(event.target.value)}
                      placeholder={tr('在此手动输入标签或点击下方快速添加', 'Type tags here, or use quick tags below')}
                      className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-app-text outline-none focus:border-indigo-500"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['生存', '末日', '异界', '恋爱', '悬疑', '推理', '赛博朋克', '奇幻', '惊悚', '治愈'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                             const current = authoringCustomTagsInput.trim();
                             if (!current) setAuthoringCustomTagsInput(tag);
                             else if (!current.includes(tag)) setAuthoringCustomTagsInput(current + (current.endsWith('，') || current.endsWith(',') ? '' : '，') + tag);
                          }}
                          className="rounded-lg bg-app-surface-soft/50 px-3 py-1.5 text-[11px] text-app-text transition-colors hover:bg-app-surface-soft hover:text-white"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
                <section className="app-card-quiet rounded-2xl p-4" tabIndex={0} onPaste={handleAuthoringCoverPaste}>
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row">
                    <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-app-border bg-gradient-to-br from-zinc-800 via-zinc-950 to-indigo-950">
                      {authoringCartridge.meta?.coverUrl ? (
                        <img src={authoringCartridge.meta.coverUrl} alt={tr('作品封面预览', 'Story cover preview')} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-app-muted">
                          NO COVER
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h4 className="text-lg font-black text-white">{tr('作品封面', 'Story Cover')}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('用于作品卡和分享预览，建议 1:1。可上传图片，或直接粘贴剪贴板图片。', 'Used for story cards and share previews. 1:1 is recommended. Upload an image or paste from clipboard.')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className={`${semanticButtonClass('secondary', { compact: true })} cursor-pointer`}>
                          <BookOpen className="h-4 w-4" />
                          {tr('上传封面', 'Upload cover')}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              void handleAuthoringCoverUpload(event.target.files?.[0]);
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                        {authoringCartridge.meta?.coverUrl && (
                          <button type="button" onClick={() => applyAuthoringCover('')} className={semanticButtonClass('ghost', { compact: true })}>
                            <X className="h-4 w-4" />
                            {tr('移除封面', 'Remove cover')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {canUseCoverGeneration && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        value={authoringCoverPrompt}
                        onChange={(event) => setAuthoringCoverPrompt(event.target.value)}
                        placeholder={tr('描述封面画面...', 'Describe the cover image...')}
                        className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                      />
                      <button type="button" onClick={handleGenerateAuthoringCover} disabled={isGeneratingCover} className={semanticButtonClass('primary', { compact: true })}>
                        {isGeneratingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {tr('AI 生成', 'AI Generate')}
                      </button>
                    </div>
                  )}
                </section>
                <label className="block space-y-2 text-sm text-app-muted">
                  <div>{tr('故事主轴', 'Story premise')}</div>
                  <textarea
                    value={authoringCartridge.meta?.main_axis || ''}
                    onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, main_axis: event.target.value } }))}
                    className="authoring-resizable-textarea min-h-[180px] w-full resize-y rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-app-text outline-none focus:border-indigo-500"
                  />
                </label>
                <section className="app-card-quiet rounded-2xl p-4">
                  <div className="mb-3 text-sm font-black text-app-text">{tr('结局结构', 'Ending Structure')}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      {
                        value: 'single',
                        label: tr('唯一走向', 'Fixed-ending path'),
                        hint: tr('所有干涉最终都会自然收束到唯一结局，适合宿命感或强主线作品。', 'All interventions naturally converge to one fixed ending. Best for fated or strong-mainline stories.'),
                      },
                      {
                        value: 'dual',
                        label: tr('三域走向', 'Three-domain path'),
                        hint: tr('使用中域、左域、右域三类收束，每一域都可以继续扩展具体结局。', 'Uses middle, left, and right domains. Each domain can later expand into specific endings.'),
                      },
                    ] as const).map((option) => {
                      const selected = (authoringCartridge.meta?.endingMode || 'dual') === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, endingMode: option.value } }))}
                          className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                            selected
                              ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                              : 'border-app-border bg-app-surface/40 text-app-muted hover:border-zinc-600 hover:text-app-text'
                          }`}
                        >
                          <div className="text-sm font-black">{option.label}</div>
                          <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                  {(authoringCartridge.meta?.endingMode || 'dual') !== 'single' && (
                  <div className="app-card-quiet mt-4 rounded-2xl p-4">
                    <div className="text-sm font-black text-app-text">{tr('故事倾向', 'Story Tendency')}</div>
                    <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('设置作品本身比较容易走向哪一种收束。读者只会感受到故事倾向，不会看到具体数值。', 'Set which ending direction the work naturally leans toward. Readers feel the tendency but do not see exact values.')}</p>
                    <div className="mt-3 rounded-2xl border border-app-border/60 bg-app-bg/45 p-3 text-xs font-bold text-app-muted">
                      {(() => {
                        const axis = endingBiasAxisFromBias(authoringCartridge.meta?.endingBias || authoringCartridge.meta?.endingRates);
                        const bias = endingBiasFromAxis(axis);
                        return (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <span>{tr('主线倾向', 'Mainline tendency')}</span>
                              <span className="text-sm font-black text-app-text">{endingBiasAxisLabel(axis)}</span>
                            </div>
                            <input
                              type="range"
                              min={-70}
                              max={70}
                              step={10}
                              value={axis}
                              onChange={(event) => {
                                const nextBias = endingBiasFromAxis(Number(event.target.value));
                                setAuthoringCartridge((prev: any) => ({
                                  ...prev,
                                  meta: { ...prev.meta, endingBias: nextBias, endingRates: nextBias },
                                }));
                              }}
                              className="mt-3 w-full accent-indigo-400"
                            />
                            <div className="mt-2 flex justify-between text-[10px] font-black text-zinc-600">
                              <span>{tr('右域强', 'Right strong')}</span>
                              <span>{tr('中性', 'Neutral')}</span>
                              <span>{tr('左域强', 'Left strong')}</span>
                            </div>
                            <div className="mt-2 text-[11px] leading-relaxed text-app-muted">
                              {tr(`左域 ${bias.leftBaseWeight}% / 右域 ${bias.rightBaseWeight}%；主线越偏一侧，另一侧越需要靠支线撬动。`, `Left ${bias.leftBaseWeight}% / Right ${bias.rightBaseWeight}%. The stronger one side's mainline is, the more the other side relies on branches to push back.`)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-app-muted">{tr('如果不确定，保持中性即可；支线与玩家干涉会继续影响故事最终走向。', 'If unsure, keep it neutral. Branches and player interventions still affect the final direction.')}</p>
                  </div>
                  )}
                </section>
                <section className="app-card-quiet rounded-2xl p-4">
                  <div className="mb-3 text-sm font-black text-app-text">{tr('作品可见性', 'Visibility')}</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { value: 'private', label: tr('私人', 'Private'), hint: tr('只有作者自己可见。', 'Only the author can view it.') },
                      { value: 'unlisted', label: tr('非公开链接', 'Unlisted link'), hint: tr('不进公开列表，但链接可读。', 'Not listed publicly, but readable by link.') },
                      { value: 'public', label: tr('公开', 'Public'), hint: tr('会出现在公开作品库。', 'Appears in the public library.') },
                    ].map((option) => {
                      const selected = (authoringCartridge.meta?.visibility || 'private') === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, visibility: option.value } }))}
                          className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                            selected
                              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                              : 'border-app-border bg-app-surface/40 text-app-muted hover:border-zinc-600 hover:text-app-text'
                          }`}
                        >
                          <div className="text-sm font-black">{option.label}</div>
                          <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <label className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-bg/50 p-4 text-sm text-app-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(authoringCartridge.meta?.allowAdaptation)}
                    onChange={(event) => setAuthoringCartridge((prev: any) => ({ ...prev, meta: { ...prev.meta, allowAdaptation: event.target.checked } }))}
                    className="mt-1 h-4 w-4 accent-indigo-500"
                  />
                  <span>
                    <span className="block font-black text-app-text">{tr('开放一键改编权限', 'Allow one-click adaptation')}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-app-muted">{tr('开启后，其他已登录用户可以把这篇作品改编成个人草稿继续创作。', 'When enabled, other logged-in users can adapt this work into their own draft.')}</span>
                  </span>
                </label>
                
                <div className="border-t border-app-border pt-6">
                  <h3 className="text-xl font-black text-white">{tr('一键导入', 'One-click Import')}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('支持按“主线设置 / 支线设置”范本格式自动解析并写入当前作品。', 'Parse and import text using the “Mainline / Branch Settings” template format.')}</p>
                </div>
                <textarea
                  value={authoringImportText}
                  onChange={(event) => setAuthoringImportText(event.target.value)}
                  placeholder={tr('把其他 AI 生成的完整文本粘贴到这里...', 'Paste a complete generated story here...')}
                  className="authoring-resizable-textarea min-h-[320px] w-full resize-y rounded-2xl border border-app-border bg-app-input-bg p-5 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
                />
                <label className="flex items-center gap-2 text-xs text-app-muted">
                  <input
                    type="checkbox"
                    checked={authoringImportReplaceBranches}
                    onChange={(event) => setAuthoringImportReplaceBranches(event.target.checked)}
                  />
                  {tr('导入时尝试覆盖支线结构', 'Try replacing branch structure during import')}
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={handleAuthoringImport} className={semanticButtonClass('primary', { fullWidth: true })}>
                    <Copy className="h-4 w-4" />
                    {tr('解析并导入', 'Parse and import')}
                  </button>
                  <button type="button" onClick={() => {
                      const template = `# 主线设置\n## 标题\n作品名称\n\n## 主轴\n一句话描述故事核心冲突\n\n## 主要角色\n### 角色1\n- 名字: 角色名A\n- 简介: 角色A的简介\n\n### 角色2\n- 名字: 角色名B\n- 简介: 角色B的简介\n\n## 默认故事\n### 第 1 章 标题一\n第一章大纲或正文\n\n### 第 2 章 标题二\n第二章大纲或正文\n\n## 结局设置\n### 中域默认结局\n中域默认结局正文\n### 左域默认结局\n左域默认结局正文\n### 右域默认结局\n右域默认结局正文\n\n# 支线设置\n## 支线1\n- 支线名: 支线名称\n- 倾向: 左域\n- 影响: 中\n- 隐藏: 否\n- 导向结局: 左域默认结局\n- 提示短句: 留意这里的变化\n- 支线情节: 这里写支线发生时的具体剧情\n- 条件组1: 第 2 章 角色名A 庇佑`;
                      navigator.clipboard.writeText(template);
                      showError(tr('蓝本格式已复制到剪贴板！', 'Template format copied to clipboard.'));
                  }} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    <Copy className="h-4 w-4" />
                    {tr('拷贝蓝本格式', 'Copy template format')}
                  </button>
                </div>
              </section>
            )}

            {authoringTab === 'series' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white">{tr('系列设置', 'Series Settings')}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('管理本作套用的世界观设定、角色卡和继承节点。这里记录的是系列层级的限制，不是本作情节主轴。', 'Manage the world setting, character cards, and continuity node used by this work. These are series-level constraints, not this story premise.')}</p>
                </div>
                <div className="rounded-[1.5rem] border border-indigo-300/15 bg-indigo-500/10 p-4">
                  <label className="mb-2 block text-sm font-black text-indigo-100">{tr('套用世界观设定', 'Apply world setting')}</label>
                  <select
                    value={authoringCartridge.meta?.seriesId || ''}
                    onChange={(event) => {
                      const seriesId = event.target.value;
                      const series = seriesWorlds.find((item) => item.id === seriesId) || null;
                      const baselineRuleIds = series ? getSeriesBaselineRules(series).map((rule) => rule.id) : [];
                      const characterIds = series ? getSeriesCharacterCards(series).map((card) => card.id) : [];
                      setAuthoringCartridge((prev: any) => ({
                        ...prev,
                        meta: {
                          ...prev.meta,
                          seriesId: seriesId || null,
                          seriesRole: seriesId ? (prev.meta?.seriesRole === 'sequel' ? 'sequel' : 'main') : 'standalone',
                          seriesConstraints: seriesId ? {
                            ...(prev.meta?.seriesConstraints || {}),
                            seriesTitle: series?.title || '',
                            baselineRuleIds,
                            characterIds,
                            selectedBaselineRules: getSeriesBaselineRules(series),
                            selectedCharacterCards: getSeriesCharacterCards(series),
                          } : {},
                        },
                      }));
                    }}
                    className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                  >
                    <option value="">{tr('不套用世界观设定', 'No world setting')}</option>
                    {seriesWorlds.map((series) => (
                      <option key={series.id} value={series.id}>{series.title || tr('未命名世界观设定', 'Untitled world setting')}</option>
                    ))}
                  </select>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void openSeriesWorldView()} className={semanticButtonClass('ghost', { compact: true })}>
                      <GitBranch className="h-4 w-4" />
                      {tr('管理世界观设定', 'Manage world settings')}
                    </button>
                    <button type="button" onClick={() => void loadSeriesWorlds()} className={semanticButtonClass('ghost', { compact: true })}>
                      <RefreshCcw className="h-4 w-4" />
                      {tr('刷新', 'Refresh')}
                    </button>
                  </div>
                </div>
                {authoringCartridge.meta?.seriesId ? (() => {
                  const selected = seriesWorlds.find((series) => series.id === authoringCartridge.meta?.seriesId) || null;
                  const baselineRules = getSeriesBaselineRules(selected);
                  const characterCards = getSeriesCharacterCards(selected);
                  const constraints = authoringCartridge.meta?.seriesConstraints || {};
                  const selectedRuleIds = safeArray<string>(constraints.baselineRuleIds);
                  const selectedCharacterIds = safeArray<string>(constraints.characterIds);
                  const authoringSeriesStoryOptions = myStories.filter((story: any) => String(story?.id || '') !== String(authoringStoryId || '') && String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '') === String(authoringCartridge.meta?.seriesId || ''));
                  const authoringContinuityBranches = safeArray<any>(authoringContinuitySourceStory?.branches);
                  const authoringContinuityEndings = safeArray<any>(authoringContinuitySourceStory?.endings);
                  const updateSeriesConstraints = (patch: Record<string, any>) => setAuthoringCartridge((prev: any) => ({
                    ...prev,
                    meta: {
                      ...prev.meta,
                      seriesConstraints: {
                        ...(prev.meta?.seriesConstraints || {}),
                        ...patch,
                      },
                    },
                  }));
                  const updateAuthoringSourceStory = (sourceStoryId: string) => {
                    const sourceStory = authoringSeriesStoryOptions.find((story: any) => String(story.id || '') === sourceStoryId);
                    setAuthoringCartridge((prev: any) => ({
                      ...prev,
                      meta: {
                        ...prev.meta,
                        continuityNodeId: null,
                        seriesConstraints: {
                          ...(prev.meta?.seriesConstraints || {}),
                          continuityNodeId: '',
                          continuityTitle: '',
                          sourceStoryId: sourceStoryId || '',
                          sourceTitle: sourceStory ? getStoryTitle(sourceStory) : '',
                          endingId: '',
                          endingTitle: '',
                          endingDomain: '',
                          requiredBranchIds: [],
                          requiredBranches: [],
                          bridgeSummary: '',
                          previousStorySummary: [],
                          previousCharacters: [],
                        },
                      },
                    }));
                  };
                  return (
                    <>
                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-4">
                        <div className="mb-3 text-sm font-black text-white">{tr('本作套用的世界基准', 'World baseline used by this work')}</div>
                        {baselineRules.length === 0 ? (
                          <p className="text-xs leading-relaxed text-app-muted">{tr('该世界观设定还没有条目化基准。', 'This world setting has no itemized baseline rules yet.')}</p>
                        ) : (
                          <div className="grid gap-2">
                            {baselineRules.map((rule) => (
                              <label key={rule.id} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                <input
                                  type="checkbox"
                                  checked={selectedRuleIds.includes(rule.id)}
                                  onChange={(event) => {
                                    const nextIds = event.target.checked
                                      ? [...new Set([...selectedRuleIds, rule.id])]
                                      : selectedRuleIds.filter((id) => id !== rule.id);
                                    updateSeriesConstraints({
                                      baselineRuleIds: nextIds,
                                      selectedBaselineRules: baselineRules.filter((item) => nextIds.includes(item.id)),
                                    });
                                  }}
                                  className="mt-1 accent-indigo-500"
                                />
                                <span>
                                  <span className="block font-black leading-relaxed text-app-text">{rule.detail || rule.title}</span>
                                  {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).length > 0 && (
                                    <span className="mt-2 flex flex-wrap gap-1.5">
                                      {normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).map((tag) => (
                                        <span key={tag} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-200">{tag}</span>
                                      ))}
                                    </span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{tr('角色卡池', 'Character pool')}</div>
                            <p className="mt-1 text-xs text-app-muted">{tr('勾选后可导入到本作角色列表；续作默认沿用主要角色。', 'Selected cards can be imported into this work; sequels inherit major characters by default.')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAuthoringCartridge((prev: any) => {
                              const existing = asSafeArray(prev.meta?.characters);
                              const existingNames = new Set(existing.map((character: any) => String(character.name || '').trim()).filter(Boolean));
                              const imported = characterCards
                                .filter((card) => selectedCharacterIds.includes(card.id))
                                .filter((card) => !existingNames.has(card.name))
                                .map((card, index) => ({
                                  id: `c${existing.length + index + 1}`,
                                  name: card.name,
                                  desc: card.desc || card.role || '系列角色',
                                }));
                              return {
                                ...prev,
                                meta: {
                                  ...prev.meta,
                                  characters: [...existing, ...imported].slice(0, 8),
                                },
                              };
                            })}
                            disabled={characterCards.length === 0}
                            className={semanticButtonClass('secondary', { compact: true })}
                          >
                            <Sparkles className="h-4 w-4" />
                            {tr('导入勾选角色', 'Import selected')}
                          </button>
                        </div>
                        {characterCards.length === 0 ? (
                          <p className="text-xs leading-relaxed text-app-muted">{tr('该世界观设定还没有角色卡。', 'This world setting has no character cards yet.')}</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {characterCards.map((card) => (
                              <label key={card.id} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                <input
                                  type="checkbox"
                                  checked={selectedCharacterIds.includes(card.id)}
                                  onChange={(event) => {
                                    const nextIds = event.target.checked
                                      ? [...new Set([...selectedCharacterIds, card.id])]
                                      : selectedCharacterIds.filter((id) => id !== card.id);
                                    updateSeriesConstraints({
                                      characterIds: nextIds,
                                      selectedCharacterCards: characterCards.filter((item) => nextIds.includes(item.id)),
                                    });
                                  }}
                                  className="mt-1 accent-indigo-500"
                                />
                                <span>
                                  <span className="block font-black text-app-text">{card.name}</span>
                                  <span className="mt-1 block leading-relaxed text-app-muted">{card.desc || card.role || tr('系列角色', 'Series character')}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-4">
                        <div className="mb-3">
                          <div className="text-sm font-black text-white">{tr('续作开启条件', 'Sequel unlock conditions')}</div>
                          <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('如果本作是续作，可指定需要先完成哪一部前作、哪一个结局，以及哪些支线，玩家才可以干涉本作。', 'If this work is a sequel, choose the previous story, ending, and branches required before players can interfere with it.')}</p>
                        </div>
                        <select
                          value={authoringCartridge.meta?.seriesRole || 'main'}
                          onChange={(event) => setAuthoringCartridge((prev: any) => ({
                            ...prev,
                            meta: {
                              ...prev.meta,
                              seriesRole: event.target.value,
                              ...(event.target.value !== 'sequel' ? { continuityNodeId: null } : {}),
                            },
                          }))}
                          className="w-full rounded-xl border border-app-border bg-app-input-bg px-3 py-3 text-sm text-app-text outline-none"
                        >
                          <option value="main">{tr('第一部 / 正篇', 'First installment')}</option>
                          <option value="sequel">{tr('续作', 'Sequel')}</option>
                          <option value="side">{tr('外传', 'Side story')}</option>
                        </select>
                        {authoringCartridge.meta?.seriesRole === 'sequel' && (
                          <div className="mt-4 space-y-4">
                            <select
                              value={constraints.sourceStoryId || ''}
                              onChange={(event) => updateAuthoringSourceStory(event.target.value)}
                              className="w-full rounded-xl border border-app-border bg-app-input-bg px-3 py-3 text-sm text-app-text outline-none"
                            >
                              <option value="">{tr('选择前作', 'Choose previous story')}</option>
                              {authoringSeriesStoryOptions.map((story: any) => (
                                <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                              ))}
                            </select>
                            {authoringSeriesStoryOptions.length === 0 && (
                              <p className="text-xs leading-relaxed text-app-muted">{tr('该世界观下还没有其他作品可作为前作。', 'No other work in this world setting can be used as the previous story yet.')}</p>
                            )}
                            {authoringContinuityLoading && (
                              <div className="flex items-center gap-2 text-xs font-bold text-indigo-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr('正在读取前作支线与结局...', 'Loading previous branches and endings...')}</div>
                            )}
                            {constraints.sourceStoryId && !authoringContinuityLoading && (
                              <div className="grid gap-4">
                                <div>
                                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('可开启续作的前作支线', 'Required previous-story branches')}</div>
                                  {authoringContinuityBranches.length === 0 ? (
                                    <p className="text-xs leading-relaxed text-app-muted">{tr('该前作没有可选择的支线。', 'This previous story has no selectable branches.')}</p>
                                  ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {authoringContinuityBranches.map((branch: any) => {
                                        const branchId = String(branch.id || '');
                                        const checked = safeArray<string>(constraints.requiredBranchIds).includes(branchId);
                                        return (
                                          <label key={branchId} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(event) => {
                                                const currentIds = safeArray<string>(constraints.requiredBranchIds);
                                                const nextIds = event.target.checked
                                                  ? [...new Set([...currentIds, branchId])]
                                                  : currentIds.filter((id) => id !== branchId);
                                                updateSeriesConstraints({
                                                  requiredBranchIds: nextIds,
                                                  requiredBranches: authoringContinuityBranches.filter((item) => nextIds.includes(String(item.id || ''))).map((item) => ({
                                                    id: String(item.id || ''),
                                                    name: item.name || item.title || item.id || '',
                                                    desc: item.desc || item.description || '',
                                                  })),
                                                });
                                              }}
                                              className="mt-1 accent-indigo-500"
                                            />
                                            <span>
                                              <span className="block font-bold text-app-text">{branch.name || branch.title || branchId}</span>
                                              {(branch.desc || branch.description) && <span className="mt-1 block leading-relaxed text-app-muted">{branch.desc || branch.description}</span>}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('可开启续作的前作结局', 'Required previous-story ending')}</div>
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    {authoringContinuityEndings.map((ending: any) => {
                                      const endingId = String(ending.id || '');
                                      return (
                                        <label key={endingId} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                          <input
                                            type="radio"
                                            name="authoring-continuity-ending"
                                            checked={constraints.endingId === endingId}
                                            onChange={() => updateSeriesConstraints({
                                              endingId,
                                              endingTitle: ending.title || endingId,
                                              endingDomain: endingDomainFromId(endingId),
                                            })}
                                            className="mt-1 accent-indigo-500"
                                          />
                                          <span className="font-bold text-app-text">{ending.title || endingId}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                                <textarea
                                  value={constraints.sequelSeedPrompt || safeArray<any>(constraints.repairRules).map((rule) => rule?.rule || rule?.text || rule).filter(Boolean).join('\n')}
                                  onChange={(event) => {
                                    const lines = event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
                                    updateSeriesConstraints({
                                      sequelSeedPrompt: event.target.value,
                                      repairRules: lines.map((rule) => ({ rule })),
                                    });
                                  }}
                                  placeholder={tr('继承硬设定：一行一条，例如「前作中阵亡的人物不能无解释复活」。', 'Continuity hard rules: one per line, e.g. dead characters cannot return without explanation.')}
                                  className="authoring-resizable-textarea min-h-[120px] w-full resize-y rounded-xl border border-app-border bg-app-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })() : (
                  <div className="rounded-2xl border border-dashed border-app-border bg-app-bg/40 p-6 text-sm leading-relaxed text-app-muted">
                    {tr('本作尚未套用世界观设定。普通单篇作品可以保持为空；若是系列作品，请先选择一个世界观设定。', 'This work is not using a world setting. Standalone stories can leave this empty; choose one for series works.')}
                  </div>
                )}
              </section>
            )}

            {authoringTab === 'mainline' && (
              <div className="relative">
                {authoringTocOpen && (
                  <div className="fixed inset-0 z-[99]" onClick={() => setAuthoringTocOpen(false)} />
                )}
                <div className={`fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+13.5rem)] left-8 z-[1600] max-h-[min(52dvh,26rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-app-border bg-app-bg/90 p-2 shadow-2xl backdrop-blur-md transition-all ${authoringTocOpen ? 'flex' : 'hidden'}`}>
                   <div className="mb-1 text-center text-[10px] font-black text-app-muted">目录导航</div>
                   {(authoringCartridge.chapters || []).map((c: any) => (
                      <button type="button" key={c.chapter_num} onClick={() => { setAuthoringTocOpen(false); document.getElementById(`authoring-chapter-${c.chapter_num}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl px-3 py-2 text-xs font-bold text-app-muted transition-colors hover:bg-app-surface-soft hover:text-white">
                         第 {c.chapter_num} 章
                      </button>
                   ))}
                   <div className="mx-2 my-1 h-px bg-app-surface-soft" />
                      <button type="button" onClick={() => { setAuthoringTocOpen(false); document.getElementById('authoring-endings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl px-3 py-2 text-xs font-bold text-app-muted transition-colors hover:bg-app-surface-soft hover:text-white">
                     结局设置
                   </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAuthoringTocOpen(!authoringTocOpen)}
                  className="fixed bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+9.5rem)] left-8 z-[1601] flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 active:scale-95"
                >
                  {authoringTocOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                </button>

              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white">主线与结局</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">这里负责章节正文与结局的编写。其他基本设定请前往「作品设置」修改。</p>
                </div>

                <div className="space-y-4">
                  <div className="text-lg font-black text-white">章节正文</div>
                  {(authoringCartridge.chapters || []).map((chapter: any) => (
                    <div id={`authoring-chapter-${chapter.chapter_num}`} key={chapter.chapter_num} className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-4 space-y-3">
                      <div className="text-sm font-black text-white">{formatStoryHeading(chapter)}</div>
                      <input
                        id={`authoring-chapter-${chapter.chapter_num}-title`}
                        value={chapter.title || ''}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, title: event.target.value } : item),
                        }))}
                        className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        placeholder="章节标题"
                      />
                      <textarea
                        id={`authoring-chapter-${chapter.chapter_num}-text`}
                        value={chapter.text || ''}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          chapters: prev.chapters.map((item: any) => item.chapter_num === chapter.chapter_num ? { ...item, text: event.target.value } : item),
                        }))}
                        className="authoring-resizable-textarea min-h-[240px] w-full resize-y rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-sm text-app-text outline-none focus:border-indigo-500"
                        placeholder={`第${chapter.chapter_num}章正文`}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div id="authoring-endings" className="text-lg font-black text-white">结局设置</div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {endingDomainCards(authoringCartridge.meta).map((domain) => (
                      <div key={domain.id} className="rounded-2xl border border-app-border bg-app-bg/45 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-app-muted">{domain.title}</div>
                        <div className="mt-2 text-sm font-black text-app-text">{domain.label}</div>
                        <p className="mt-3 text-xs leading-relaxed text-app-muted">{domain.hint}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-indigo-100/75">
                    可先编辑“中域默认 / 左域默认 / 右域默认”三个结局原型。每一域都可承载更多具体结局，并可由支线绑定来决定最终收束；已设置的支线倾向会继续沿用。
                  </div>
                  {authoringCartridge.meta?.endingMode === 'single' && (
                    (() => {
                      const hiddenEndings = (authoringCartridge.endings || []).filter(
                        (e: any) => e.id !== 'default' && (e.title || e.text)
                      );
                      return hiddenEndings.length > 0 ? (
                        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-300/80">
                          <span className="mt-0.5 shrink-0">⚠️</span>
                          <span>其他结局的内容已暂时保留在内存中（共 {hiddenEndings.length} 个结局有未保存的内容）。如需取回，请在离开此页前切换回“多线结局”。</span>
                        </div>
                      ) : null;
                    })()
                  )}
                  {(['middle', 'left', 'right'] as const)
                    .filter((domain) => authoringCartridge.meta?.endingMode === 'single' ? domain === 'middle' : true)
                    .map((domain) => {
                      const endingsInDomain = (authoringCartridge.endings || []).filter((ending: any) => endingDomainFromId(String(ending.id || '')) === domain);
                      const defaultEndingId = domain === 'middle' ? 'default' : domain;
                      const visibleEndings = endingsInDomain.length > 0
                        ? endingsInDomain
                        : [{ id: defaultEndingId, title: '', text: '' }];
                      return (
                        <div key={domain} className="space-y-3 rounded-[1.5rem] border border-app-border bg-app-bg/25 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-base font-black text-white">{endingDomainTitle(domain)}</div>
                              <p className="mt-1 text-xs leading-relaxed text-app-muted">
                                {domain === 'middle' ? '故事没有明显偏向左右时，会进入中结局域；可设置多个余韵型具体结局。' : `故事偏向${endingDomainTitle(domain)}后，会根据已触发支线绑定选择具体结局。`}
                              </p>
                            </div>
                            {authoringCartridge.meta?.endingMode !== 'single' && (
                              <button
                                type="button"
                                onClick={() => setAuthoringCartridge((prev: any) => {
                                  const endings = [...(prev.endings || [])];
                                  endings.push({
                                    id: createEndingIdForDomain(domain),
                                    chapter_num: 7,
                                    title: `${endingDomainTitle(domain)}的新结局`,
                                    text: '',
                                  });
                                  return { ...prev, endings };
                                })}
                                className={semanticButtonClass('secondary', { compact: true })}
                              >
                                <Sparkles className="h-4 w-4" />
                                新增具体结局
                              </button>
                            )}
                          </div>

                          {visibleEndings.map((ending: any) => (
                            <div id={`authoring-ending-${ending.id}`} key={ending.id} className="rounded-[1.25rem] border border-app-border bg-app-bg/50 p-4 space-y-3">
                              <div className="text-sm font-black text-white">{authoringEndingIdToLabel(ending.id)}</div>
                              <input
                                id={`authoring-ending-${ending.id}-title`}
                                value={ending.title || ''}
                                onChange={(event) => setAuthoringCartridge((prev: any) => ({
                                  ...prev,
                                  endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, title: event.target.value } : item),
                                }))}
                                className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                                placeholder="结局标题"
                              />
                              <textarea
                                id={`authoring-ending-${ending.id}-text`}
                                value={ending.text || ''}
                                onChange={(event) => setAuthoringCartridge((prev: any) => ({
                                  ...prev,
                                  endings: prev.endings.map((item: any) => item.id === ending.id ? { ...item, text: event.target.value } : item),
                                }))}
                                className="authoring-resizable-textarea min-h-[240px] w-full resize-y rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-sm text-app-text outline-none focus:border-indigo-500"
                                placeholder="结局正文"
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
            )}

            {authoringTab === 'branches' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white">角色和支线</h3>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">角色会作为干涉对象和支线条件基础；支线会根据触发条件在游玩时被判定解锁。</p>
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-app-border bg-app-bg/40 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-white">角色设定</div>
                    <button
                      type="button"
                      onClick={() => setAuthoringCartridge((prev: any) => {
                        const characters = [...(prev.meta?.characters || [])];
                        if (characters.length >= 5) return prev;
                        characters.push({ name: `角色${characters.length + 1}`, desc: '（待填写简介）' });
                        return { ...prev, meta: { ...prev.meta, characters } };
                      })}
                      className={semanticButtonClass('ghost', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      新增角色
                    </button>
                  </div>
                  {(authoringCartridge.meta?.characters || []).map((character: any, index: number) => (
                    <div id={`authoring-character-${index}`} key={index} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
                      <input
                        id={`authoring-character-${index}-name`}
                        value={character.name || ''}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          meta: {
                            ...prev.meta,
                            characters: prev.meta.characters.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, name: event.target.value } : item),
                          },
                        }))}
                        className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        placeholder="角色名"
                      />
                      <textarea
                        id={`authoring-character-${index}-desc`}
                        value={character.desc || ''}
                        onChange={(event) => setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          meta: {
                            ...prev.meta,
                            characters: prev.meta.characters.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, desc: event.target.value } : item),
                          },
                        }))}
                        className="authoring-resizable-textarea min-h-[96px] w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        placeholder="角色简介"
                      />
                      <button
                        type="button"
                        onClick={() => setAuthoringCartridge((prev: any) => ({
                          ...prev,
                          meta: { ...prev.meta, characters: prev.meta.characters.filter((_: any, itemIndex: number) => itemIndex !== index) },
                        }))}
                        disabled={(authoringCartridge.meta?.characters || []).length <= 1}
                        className={semanticButtonClass('danger', { compact: true })}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-lg font-black text-white">支线列表</div>
                  {expandedBranchId !== 'NEW' && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBranchId('NEW');
                        setBranchForm({
                          id: '',
                          name: '',
                          side: 'left',
                          tier: 'small',
                          isHidden: false,
                          endingId: '',
                          triggerType: 'single',
                          singleChapterNum: 2,
                          singleCharId: '',
                          singleAction: 'bless',
                          countCharId: '',
                          countAction: 'bless',
                          minCount: 1,
                          upToChapterNum: 6,
                          hint: '',
                          sceneText: '',
                        });
                        setBranchConditions([{
                          kind: 'single',
                          singleChapterNum: 2,
                          singleCharId: '',
                          singleAction: 'bless',
                          countCharId: '',
                          countAction: 'bless',
                          minCount: 1,
                          upToChapterNum: 6,
                          hint: '',
                        }]);
                      }}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      新增支线
                    </button>
                  )}
                </div>

                {expandedBranchId === 'NEW' && renderBranchForm(true)}

                <div className="space-y-3">
                  {(authoringCartridge.branches || []).map((branch: any) => (
                    <div key={branch.id} className="transition-all">
                      {expandedBranchId === branch.id ? (
                        renderBranchForm(false)
                      ) : (
                        <div className="rounded-[1.5rem] border border-app-border bg-app-bg/40 p-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{branch.name}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-app-muted">
                              <span>{branch.side === 'left' ? '左域' : '右域'} / 影响：{branchTierLabel(branch.tier)}</span>
                              {(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden) && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-black text-amber-200">隐藏支线</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-indigo-300">
                              导向：{authoringEndingIdToLabel(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || branch.side)}
                            </div>
                            <div className="mt-2 text-xs leading-relaxed text-app-muted max-w-xl line-clamp-2">{branch.sceneText || branch.hint || '暂无内容'}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBranchId(branch.id);
                                setExpandedBranchId(branch.id);
                                setBranchForm({
                                  id: branch.id,
                                  name: branch.name || '',
                                  side: branch.side || 'left',
                                  tier: normalizeBranchTier(branch.tier || 'small'),
                                  isHidden: Boolean(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden),
                                  endingId: branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || '',
                                  triggerType: 'single',
                                  singleChapterNum: branch.trigger?.single?.chapterNum || 2,
                                  singleCharId: branch.trigger?.single?.charId || '',
                                  singleAction: branch.trigger?.single?.action || 'bless',
                                  countCharId: branch.trigger?.count?.charId || '',
                                  countAction: branch.trigger?.count?.action || 'bless',
                                  minCount: branch.trigger?.count?.minCount || 1,
                                  upToChapterNum: branch.trigger?.count?.upToChapterNum || 6,
                                  hint: branch.hint || '',
                                  sceneText: branch.sceneText || '',
                                });
                                const rawGroups = (branch.triggerGroups && branch.triggerGroups.length > 0)
                                  ? branch.triggerGroups
                                  : (branch.trigger ? [branch.trigger] : []);
                                setBranchConditions(rawGroups.length > 0
                                  ? rawGroups.map((group: any) => group.type === 'count'
                                    ? {
                                        kind: 'count',
                                        singleChapterNum: 2,
                                        singleCharId: '',
                                        singleAction: 'bless',
                                        countCharId: group.count?.charId || '',
                                        countAction: group.count?.action || 'bless',
                                        minCount: group.count?.minCount || 1,
                                        upToChapterNum: group.count?.upToChapterNum || 6,
                                        hint: group.hint || branch.hint || '',
                                      }
                                    : {
                                        kind: 'single',
                                        singleChapterNum: group.single?.chapterNum || 2,
                                        singleCharId: group.single?.charId || '',
                                        singleAction: group.single?.action || 'bless',
                                        countCharId: '',
                                        countAction: 'bless',
                                        minCount: 1,
                                        upToChapterNum: 6,
                                        hint: group.hint || branch.hint || '',
                                      })
                                  : [{
                                      kind: 'single',
                                      singleChapterNum: 2,
                                      singleCharId: '',
                                      singleAction: 'bless',
                                      countCharId: '',
                                      countAction: 'bless',
                                      minCount: 1,
                                      upToChapterNum: 6,
                                      hint: branch.hint || '',
                                    }]
                                );
                              }}
                              className={semanticButtonClass('secondary', { compact: true })}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!authoringStoryId) return;
                                await deleteStoryBranch(db as any, authoringStoryId, branch.id);
                                await selectAuthoringStory(authoringStoryId);
                                showError('支线已删除。');
                              }}
                              className={semanticButtonClass('danger', { compact: true })}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>
      </>
    )}
  </div>
);



  return renderAuthoringView();
}
