import React from 'react';
import { Check, GitBranch, Loader2, PenSquare, RefreshCcw, Sparkles, Trash2 } from 'lucide-react';
import { BackNavButton } from './BackNavButton';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';

export const SeriesWorldView = (ctx: any) => {
  const {
    seriesForm,
    seriesWorldBibleText,
    parseEditableJson,
    asSafeArray,
    tr,
    normalizeSeriesPlotMaterial,
    setSeriesWorldBibleText,
    seriesSourceStoryId,
    gameState,
    goBack,
    navigateTo,
    loadSeriesWorlds,
    renderInlineHelp,
    seriesWorlds,
    resetSeriesWorldDraft,
    selectedSeriesId,
    setSelectedSeriesId,
    setSeriesForm,
    setSeriesIronLawsText,
    setSeriesFutureDirectionsText,
    loadContinuityNodesForSeries,
    myStories,
    getStoryTitle,
    setSeriesSourceStoryId,
    handleGenerateSeriesWorld,
    seriesGenerating,
    handleDeleteSeriesWorld,
    seriesSaving,
    handleSaveSeriesWorld,
    createEmptySeriesCharacterCard,
    normalizeTagList,
    createEmptySeriesPlotMaterial,
  } = ctx;
  const parseJson = parseEditableJson as <T>(text: string, fallback: T) => T;
  const safeArray = asSafeArray as <T>(value: unknown) => T[];

    const seriesGenreText = (seriesForm.genreTags || []).join('，');
    const worldBibleDraft = parseJson<Record<string, any>>(seriesWorldBibleText, seriesForm.worldBible || {});
    const baselineRuleDrafts: any[] = safeArray<any>(worldBibleDraft.baselineRules).length > 0
      ? safeArray<any>(worldBibleDraft.baselineRules)
      : safeArray<any>(worldBibleDraft.coreRules || worldBibleDraft.ironLaws).map((rule, index) => ({
          id: (rule as any)?.id || `rule_${index + 1}`,
          title: (rule as any)?.title || (rule as any)?.rule || `${tr('世界基准', 'Baseline rule')} ${index + 1}`,
          kind: (rule as any)?.kind || tr('世界', 'World'),
          detail: (rule as any)?.detail || (rule as any)?.rule || String(rule || ''),
        }));
    const characterCardDrafts: any[] = safeArray<any>(worldBibleDraft.characterPool).length > 0
      ? safeArray<any>(worldBibleDraft.characterPool)
      : (safeArray<any>(worldBibleDraft.characters).length > 0
          ? safeArray<any>(worldBibleDraft.characters)
          : safeArray<any>(worldBibleDraft.recurringCharacterSeeds)
        ).map((card, index) => ({
          id: (card as any)?.id || `char_${index + 1}`,
          name: (card as any)?.name || (card as any)?.title || `${tr('角色', 'Character')} ${index + 1}`,
          role: (card as any)?.role || (card as any)?.type || '',
          desc: (card as any)?.desc || (card as any)?.description || (card as any)?.profile || String(card || ''),
          status: (card as any)?.status || '',
        }));
    const plotNoteDrafts: any[] = safeArray<any>(worldBibleDraft.plotNotes).map(normalizeSeriesPlotMaterial);
    const updateWorldBibleDraft = (patch: Record<string, any>) => {
      setSeriesWorldBibleText(JSON.stringify({ ...worldBibleDraft, ...patch }, null, 2));
    };
    const updateBaselineRuleDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        baselineRules: baselineRuleDrafts.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
      });
    };
    const updateCharacterCardDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        characterPool: characterCardDrafts.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card),
      });
    };
    const updatePlotNoteDraft = (index: number, patch: Record<string, any>) => {
      updateWorldBibleDraft({
        plotNotes: plotNoteDrafts.map((note, noteIndex) => noteIndex === index ? { ...note, ...patch } : note),
      });
    };
    const organizeSourceLabel = seriesSourceStoryId
      ? tr('提取世界观', 'Extract world setting')
      : tr('生成世界观', 'Generate world setting');
    const isSeriesWorldListPage = gameState === 'SERIES_WORLD_LIST';
    const isSeriesWorldGeneratePage = gameState === 'SERIES_WORLD_GENERATE';
    const isSeriesWorldEditPage = gameState === 'SERIES_WORLD_EDIT';
    const pageTitle = isSeriesWorldListPage
      ? tr('世界观列表', 'World Settings')
      : isSeriesWorldGeneratePage
        ? tr('生成 / 提取世界观设定', 'Generate / Extract World Setting')
        : tr('编辑世界观仓库', 'Edit World Setting Archive');
    const pageDescription = isSeriesWorldListPage
      ? tr('这里集中管理已经保存的世界观设定。选择一个进入编辑；新建或提取请进入生成页。', 'Manage saved world settings here. Choose one to edit, or open the generation page to create/extract a new one.')
      : isSeriesWorldGeneratePage
        ? tr('从基本概况生成全新的世界观仓库，或导入已有作品提取世界基准、角色卡池和情节素材。生成完成后会进入编辑页。', 'Generate a new setting archive from an overview, or import an existing story to extract baseline rules, character cards, and plot material. After generation, the editor opens.')
        : tr('这里只编辑世界观仓库条目。后续生成作品时，再到高级创作设置里选择要套用的世界观设定。', 'Edit archive items here. Later, apply the world setting from Advanced creation when generating a story.');
    return (
      <div className="mx-auto min-h-[100dvh] max-w-6xl px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(5rem,calc(env(safe-area-inset-top)+4rem))] sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <BackNavButton
            label={tr('返回上一页', 'Back')}
            onClick={() => goBack('STORY_SELECT')}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {!isSeriesWorldGeneratePage && (
              <button type="button" onClick={() => navigateTo('SERIES_WORLD_GENERATE')} className={semanticButtonClass('secondary', { compact: true })}>
                <Sparkles className="h-4 w-4" />
                {tr('生成 / 提取', 'Generate / Extract')}
              </button>
            )}
            <button type="button" onClick={() => void loadSeriesWorlds()} className={semanticButtonClass('ghost', { compact: true })}>
              <RefreshCcw className="h-4 w-4" />
              {tr('刷新', 'Refresh')}
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-[2rem] border border-indigo-300/15 bg-indigo-500/10 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
            <GitBranch className="h-3.5 w-3.5" />
            {tr('世界观设定', 'World Settings')}
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">{pageTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-app-muted">
            {pageDescription}
          </p>
        </div>
        {isSeriesWorldGeneratePage && renderInlineHelp('world-generator', '世界观生成与提取指引', '在此页面，你可以让AI自动生成一套全新的世界观蓝图，或者通过提取已有故事的章节来抓取其中的人物设定、世界法则。生成好的世界观可以在后续创建『续作』或『新篇章』故事时在高级设置里套用。')}

        <div className="grid gap-6">
          <section className="space-y-4">
            {isSeriesWorldListPage && (
            <div className="rounded-[1.5rem] border border-app-border bg-app-bg/60 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-white">{tr('已保存设定', 'Saved settings')}</div>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('这是独立的收录页，只负责查找、进入编辑和删除后的管理。', 'This is a dedicated library page for finding, opening, and managing saved settings.')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigateTo('SERIES_WORLD_GENERATE')} className={semanticButtonClass('primary', { compact: true })}>
                    <Sparkles className="h-4 w-4" />
                    {tr('生成新世界观', 'Create new setting')}
                  </button>
                  <button type="button" onClick={resetSeriesWorldDraft} className={semanticButtonClass('secondary', { compact: true })}>
                    <PenSquare className="h-4 w-4" />
                    {tr('手动建立', 'Manual create')}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seriesWorlds.length === 0 && <div className="rounded-2xl bg-app-surface/60 p-4 text-sm text-app-muted sm:col-span-2 lg:col-span-3">{tr('还没有世界观设定，可以先生成或手动建立一个。', 'No world setting yet. Generate one or create a manual draft first.')}</div>}
                {seriesWorlds.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => {
                      setSelectedSeriesId(series.id);
                      setSeriesForm(series);
                      setSeriesWorldBibleText(JSON.stringify(series.worldBible || {}, null, 2));
                      setSeriesIronLawsText(JSON.stringify(series.ironLaws || [], null, 2));
                      setSeriesFutureDirectionsText(JSON.stringify(series.futureDirections || [], null, 2));
                      navigateTo('SERIES_WORLD_EDIT');
                      void loadContinuityNodesForSeries(series.id);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${selectedSeriesId === series.id ? 'border-indigo-400 bg-indigo-500/15' : 'border-app-border bg-app-surface/40 hover:border-zinc-600'}`}
                  >
                    <div className="text-sm font-black text-white">{series.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-app-muted">{(series.worldBible as any)?.worldview || series.pitch || tr('尚未填写世界观概况', 'No world overview yet')}</div>
                  </button>
                ))}
              </div>
            </div>
            )}

            {isSeriesWorldGeneratePage && (
            <div className="rounded-[1.5rem] border border-app-border bg-app-bg/60 p-4">
              <div className="mb-4">
                <div className="text-lg font-black text-white">{tr('世界观生成', 'World setting generation')}</div>
                <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('填写世界观概况即可生成新设定；如果选择来源作品，则会直接从该作品提取世界观概况、角色卡池、支线和结局素材。', 'Write an overview to generate a new setting. If a source story is selected, the app extracts the overview, character cards, branches, and ending material from that story.')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={seriesForm.title || ''} onChange={(event) => setSeriesForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={tr('世界观设定名称', 'World setting title')} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500" />
                <input value={seriesGenreText} onChange={(event) => setSeriesForm((prev) => ({ ...prev, genreTags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }))} placeholder={tr('题材标签，以逗号分隔', 'Genre tags, comma-separated')} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500" />
              </div>
              <textarea
                value={worldBibleDraft.worldview || ''}
                onChange={(event) => updateWorldBibleDraft({ worldview: event.target.value })}
                placeholder={tr('世界观概况：简单描述这个世界的核心感觉、规则、时代、冲突或创作方向。', 'World overview: briefly describe the world’s feel, rules, era, conflict, or creative direction.')}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <div className="mt-4 rounded-2xl border border-app-border bg-app-surface/35 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('来源作品（可选）', 'Source story (optional)')}</label>
                <p className="mb-3 text-xs leading-relaxed text-app-muted">
                  {tr('不选择作品时，按上方概况生成世界观；选择作品后，主按钮会改为从该作品提取。', 'Without a story, the button generates from the overview. With a story selected, it extracts from that story.')}
                </p>
                <select
                  value={seriesSourceStoryId}
                  onChange={(event) => setSeriesSourceStoryId(event.target.value)}
                  className="w-full rounded-xl border border-app-border bg-app-input-bg px-3 py-3 text-sm text-app-text outline-none"
                >
                  <option value="">{tr('不导入作品，生成全新世界观设定', 'No story import; generate a new world setting')}</option>
                  {myStories.map((story: any) => (
                    <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => void handleGenerateSeriesWorld(seriesSourceStoryId ? 'extract' : 'new')} disabled={seriesGenerating} className={semanticButtonClass('primary', { compact: true, fullWidth: true })}>
                  {seriesGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {organizeSourceLabel}
                </button>
                <button type="button" onClick={resetSeriesWorldDraft} className={semanticButtonClass('secondary', { compact: true, fullWidth: true })}>
                  <PenSquare className="h-4 w-4" />
                  {tr('手动建立空白仓库', 'Create blank archive')}
                </button>
              </div>
            </div>
            )}
          </section>

          <section className="space-y-6">
            {isSeriesWorldEditPage && (
            <div className="rounded-[2rem] border border-app-border bg-app-bg/60 p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-black text-white">{tr('世界观设定草稿', 'World Setting Draft')}</div>
                  <div className="mt-1 text-xs text-app-muted">{tr('所有内容都可以手动编辑，保存后才能用于绑定作品。', 'Everything can be edited manually. Save it before binding stories.')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSeriesId && (
                    <button type="button" onClick={() => handleDeleteSeriesWorld()} disabled={seriesSaving} className={semanticButtonClass('danger', { compact: true })}>
                      <Trash2 className="h-4 w-4" />
                      {tr('删除世界观', 'Delete setting')}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleSaveSeriesWorld()} disabled={seriesSaving} className={semanticButtonClass('primary', { compact: true })}>
                    {seriesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {tr('保存世界观设定', 'Save world setting')}
                  </button>
                </div>
              </div>
              {renderInlineHelp('world-editor', '世界观仓库编辑指引', '在此编辑世界观的关键要素。其中【世界基准规则】是AI创作故事时绝对遵守的铁律（例如：魔法在这个世界上已被禁止）；【角色卡池】存放该世界里登场的主要配角与背景；【故事大纲与素材】能为后续作品提供线索。修改完成后，切记点击最下方的『保存世界观』，才能让改动生效。')}
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={seriesForm.title || ''} onChange={(event) => setSeriesForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={tr('世界观设定名称', 'World setting title')} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500" />
                <input value={seriesGenreText} onChange={(event) => setSeriesForm((prev) => ({ ...prev, genreTags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }))} placeholder={tr('题材标签，以逗号分隔', 'Genre tags, comma-separated')} className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500" />
              </div>
              <textarea
                value={worldBibleDraft.worldview || ''}
                onChange={(event) => updateWorldBibleDraft({ worldview: event.target.value })}
                placeholder={tr('世界观概况：简单描述这个世界的核心感觉、规则、时代、冲突或创作方向，用来让 AI 整理下方三类仓库条目。', 'World overview: briefly describe the world’s feel, rules, era, conflict, or creative direction so AI can organize the archive items below.')}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <div className="mt-5 space-y-5">
                <div className="rounded-[1.5rem] border border-app-border bg-app-bg/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('世界基准', 'World baseline')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('一条一条记录这个世界允许什么、禁止什么、哪些设定必须被遵守。生成作品时可以按需勾选。', 'Record reusable rules one by one: what is allowed, forbidden, or must be obeyed. They can be selected during generation.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ baselineRules: [...baselineRuleDrafts, { id: `rule_${baselineRuleDrafts.length + 1}`, detail: '', tags: [] }] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增基准', 'Add rule')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {baselineRuleDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-app-border p-4 text-xs leading-relaxed text-app-muted">
                        {tr('还没有世界基准。可以手动新增，或点击左侧从零生成世界观。', 'No baseline rules yet. Add one manually or generate a world setting from scratch.')}
                      </div>
                    )}
                    {baselineRuleDrafts.map((rule, index) => (
                      <div key={rule.id || index} className="rounded-2xl border border-app-border bg-app-surface/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">{tr('世界基准', 'Rule')} {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ baselineRules: baselineRuleDrafts.filter((_, ruleIndex) => ruleIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除基准', 'Delete rule')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="hidden">
                          <input
                            value={rule.title || ''}
                            onChange={(event) => updateBaselineRuleDraft(index, { title: event.target.value, id: rule.id || `rule_${index + 1}` })}
                            placeholder={tr('基准标题，例如：王都在第二部前不可陷落', 'Rule title, e.g. The capital cannot fall before Part 2')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                          <input
                            value={rule.kind || ''}
                            onChange={(event) => updateBaselineRuleDraft(index, { kind: event.target.value })}
                            placeholder={tr('类别', 'Kind')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                        </div>
                        <textarea
                          value={rule.detail || rule.rule || ''}
                          onChange={(event) => updateBaselineRuleDraft(index, { detail: event.target.value })}
                          placeholder={tr('具体说明：这条基准如何限制或保护后续作品生成。', 'Details: how this rule limits or protects later story generation.')}
                          className="min-h-24 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        />
                        <input
                          value={normalizeTagList(Array.isArray(rule.tags) ? rule.tags : String(rule.tags || rule.kind || '').split(/[,，]/)).join('，')}
                          onChange={(event) => updateBaselineRuleDraft(index, { tags: normalizeTagList(event.target.value.split(/[,，]/)), kind: '' })}
                          placeholder={tr('标签，可选，例如：角色限制，时间限制，势力规则', 'Tags, optional: character limit, timeline, faction rule')}
                          className="mt-3 w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-app-border bg-app-bg/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('角色卡池', 'Character pool')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('保存系列内可复用角色。续作默认可以从这里沿用主要角色，不再每次重新发明。', 'Store reusable characters for the series. Sequels can inherit major characters from here by default.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ characterPool: [...characterCardDrafts, createEmptySeriesCharacterCard(characterCardDrafts.length)] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增角色卡', 'Add character')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {characterCardDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-app-border p-4 text-xs leading-relaxed text-app-muted">
                        {tr('还没有角色卡。可以加入主角、重要配角、势力代表或会贯穿多部作品的角色。', 'No character cards yet. Add protagonists, key supporting characters, faction representatives, or recurring figures.')}
                      </div>
                    )}
                    {characterCardDrafts.map((card, index) => (
                      <div key={card.id || index} className="rounded-2xl border border-app-border bg-app-surface/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">{tr('角色卡', 'Character')} {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ characterPool: characterCardDrafts.filter((_, cardIndex) => cardIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除角色卡', 'Delete character card')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={card.name || ''}
                            onChange={(event) => updateCharacterCardDraft(index, { name: event.target.value, id: card.id || `char_${index + 1}` })}
                            placeholder={tr('角色名', 'Character name')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                          <input
                            value={card.role || ''}
                            onChange={(event) => updateCharacterCardDraft(index, { role: event.target.value })}
                            placeholder={tr('系列定位，例如：主角/导师/宿敌', 'Series role, e.g. protagonist / mentor / rival')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                        </div>
                        <textarea
                          value={card.desc || ''}
                          onChange={(event) => updateCharacterCardDraft(index, { desc: event.target.value })}
                          placeholder={tr('角色说明：身份、动机、矛盾点，以及后续作品可如何使用。', 'Profile: identity, motive, contradiction, and how later stories may use this character.')}
                          className="mt-3 min-h-24 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        />
                        <input
                          value={card.status || ''}
                          onChange={(event) => updateCharacterCardDraft(index, { status: event.target.value })}
                          placeholder={tr('默认状态，例如：仍在王都、失踪、被封印', 'Default status, e.g. in the capital / missing / sealed away')}
                          className="mt-3 w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-app-border bg-app-bg/55 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">{tr('情节素材', 'Plot material')}</div>
                      <p className="mt-1 text-xs leading-relaxed text-app-muted">{tr('记录可复用的伏笔、历史事件、未解谜团或适合未来作品调用的情节素材。', 'Store reusable foreshadowing, historical events, unresolved mysteries, or plot material for future stories.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateWorldBibleDraft({ plotNotes: [...plotNoteDrafts, createEmptySeriesPlotMaterial(plotNoteDrafts.length)] })}
                      className={semanticButtonClass('secondary', { compact: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr('新增概况', 'Add note')}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {plotNoteDrafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-app-border p-4 text-xs leading-relaxed text-app-muted">
                        {tr('还没有情节素材。可以记录“某场旧战争”“某个未解预言”“某角色的失踪原因”等。', 'No plot material yet. You can record old wars, unsolved prophecies, missing-character causes, and similar material.')}
                      </div>
                    )}
                    {plotNoteDrafts.map((note, index) => (
                      <div key={note.id || index} className="grid gap-2 rounded-2xl border border-app-border bg-app-surface/40 p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                          <input
                            value={note.title || ''}
                            onChange={(event) => updatePlotNoteDraft(index, { title: event.target.value, id: note.id || `plot_${index + 1}` })}
                            placeholder={tr('素材标题', 'Material title')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                          <input
                            value={note.tag || ''}
                            onChange={(event) => updatePlotNoteDraft(index, { tag: event.target.value })}
                            placeholder={tr('标签', 'Tag')}
                            className="rounded-xl border border-app-border bg-app-input-bg px-3 py-2 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateWorldBibleDraft({ plotNotes: plotNoteDrafts.filter((_, noteIndex) => noteIndex !== index) })}
                            className={semanticIconButtonClass('ghost')}
                            aria-label={tr('删除情节素材', 'Delete plot material')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          value={note.detail || ''}
                          onChange={(event) => updatePlotNoteDraft(index, { detail: event.target.value })}
                          placeholder={tr('情节素材内容', 'Plot material details')}
                          className="min-h-20 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            )}
          </section>
        </div>
      </div>
    );

};
