import React from 'react';
import { Check, ChevronLeft, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { BackNavButton } from './BackNavButton';
import { semanticButtonClass } from './semanticClasses';

export const ThemeSelectionView = (ctx: any) => {
  const {
    tr,
    goBack,
    appLanguage,
    quickGenerationMode,
    setQuickGenerationMode,
    QUICK_QUIZ_STEPS,
    quickQuizStepIndex,
    asSafeArray,
    quickQuizAnswers,
    handleRandomQuickGeneration,
    quickCharacterSeed,
    setQuickCharacterSeed,
    quickText,
    setQuickQuizStepIndex,
    toggleQuickQuizAnswer,
    handleGenerateBlueprint,
    QUICK_STORY_TEMPLATES,
    applyQuickStoryTemplate,
    isEnglish,
    QUICK_STORY_TEMPLATE_EN,
    themeInputText,
    setThemeInputText,
    setSelectedThemes,
    THEMES,
    THEME_LABEL_EN,
    quickSeriesBindingId,
    setQuickSeriesBindingId,
    seriesWorlds,
    getSeriesBaselineRules,
    getSeriesCharacterCards,
    myStories,
    quickContinuitySourceStory,
    quickSeriesSelection,
    setQuickSeriesSelection,
    quickContinuityLoading,
    getStoryTitle,
    authoringEndingIdToLabel,
    customOutline,
    setCustomOutline,
    narrativePerson,
    NARRATIVE_PERSON_OPTIONS,
    setNarrativePerson,
    quickEndingMode,
    setQuickEndingMode,
    quickEndingBias,
    endingBiasAxisFromBias,
    endingBiasFromAxis,
    endingBiasAxisLabel,
    setQuickEndingBias,
    targetWordCount,
    setTargetWordCount,
    selectedThemes,
    normalizeTagList,
  } = ctx;
  const safeArray = asSafeArray as <T>(value: unknown) => T[];
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-center px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] text-center lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <BackNavButton label={tr('返回上一页', 'Back')} onClick={() => goBack('STORY_SELECT')} />
        <div className="h-10 w-10" />
      </div>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
          <Wand2 className="h-4 w-4" />
          {tr('命运引擎', 'Fate Engine')}
        </div>
        <h1 className="text-4xl font-black text-white sm:text-5xl">{tr('快速生成故事', 'Quick Story Generation')}</h1>
        <p className="text-sm leading-relaxed text-app-muted sm:text-base">
          {tr('选择 1 到 4 个主题，或直接输入故事大纲。系统会先生成完整蓝图，再预先写好前 3 章供玩家开始干涉。', 'Choose 1 to 4 tags or enter an outline. The system creates a full blueprint, then writes the first 3 chapters so play can begin quickly.')}
        </p>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-xl rounded-full border border-app-border bg-app-bg/70 p-1 text-xs font-black">
        {([
          { id: 'quiz' as const, label: appLanguage === 'en-US' ? 'Play by quiz' : '想玩故事' },
          { id: 'advanced' as const, label: appLanguage === 'en-US' ? 'Advanced creation' : '高级创作设置' },
        ]).map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setQuickGenerationMode(mode.id)}
            className={`flex-1 rounded-full px-3 py-2 transition-colors ${quickGenerationMode === mode.id ? 'bg-indigo-500 text-white' : 'text-app-muted hover:text-app-text'}`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {quickGenerationMode === 'quiz' ? (() => {
        const step = QUICK_QUIZ_STEPS[Math.min(quickQuizStepIndex, QUICK_QUIZ_STEPS.length - 1)];
        const selected = safeArray<string>(quickQuizAnswers[step.id]);
        const isLastStep = quickQuizStepIndex >= QUICK_QUIZ_STEPS.length - 1;
        return (
          <div className="mx-auto mt-8 w-full max-w-4xl rounded-[2rem] border border-app-border bg-app-surface/30 p-5 text-left shadow-2xl shadow-black/10 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-amber-100">
                  {appLanguage === 'en-US' ? 'Want a surprise?' : '想来点惊喜？'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                  {appLanguage === 'en-US'
                    ? 'Randomly draw every preference layer and start generating immediately.'
                    : '从每一层偏好中随机抽取设定，并直接开始生成故事。'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRandomQuickGeneration}
                className={semanticButtonClass('secondary', { compact: true })}
              >
                <Sparkles className="h-4 w-4" />
                {appLanguage === 'en-US' ? 'Fully random' : '全随机生成'}
              </button>
            </div>
            <div className="mb-5 rounded-2xl border border-app-border bg-app-bg/55 p-4">
              <button
                type="button"
                onClick={() => setQuickCharacterSeed((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-black text-app-text">
                    {appLanguage === 'en-US' ? 'Use a character idea?' : '有想放进故事的人物吗？'}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">
                    {appLanguage === 'en-US'
                      ? 'Optional. Add a person, relationship, or character seed for the story to build around.'
                      : '可选。可以填一个人物、关系或人设需求，让故事围绕它自然展开。'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${quickCharacterSeed.enabled ? 'bg-indigo-500 text-white' : 'bg-app-surface-soft text-app-muted'}`}>
                  {quickCharacterSeed.enabled ? (appLanguage === 'en-US' ? 'On' : '已开启') : (appLanguage === 'en-US' ? 'Skip' : '跳过')}
                </span>
              </button>
              {quickCharacterSeed.enabled && (
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={quickCharacterSeed.name}
                      onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder={appLanguage === 'en-US' ? 'Character name, e.g. my sister' : '人物名称，例如：妹妹'}
                      className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
                    />
                    <input
                      value={quickCharacterSeed.role}
                      onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, role: event.target.value }))}
                      placeholder={appLanguage === 'en-US' ? 'Identity or relationship' : '身份或关系，例如：主角的妹妹'}
                      className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { value: 'protagonist' as const, label: appLanguage === 'en-US' ? 'Protagonist' : '作为主角' },
                      { value: 'important' as const, label: appLanguage === 'en-US' ? 'Key character' : '重要角色' },
                      { value: 'mystery' as const, label: appLanguage === 'en-US' ? 'Mystery role' : '神秘人物' },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setQuickCharacterSeed((prev) => ({ ...prev, position: option.value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                          quickCharacterSeed.position === option.value
                            ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                            : 'border-app-border bg-app-surface/50 text-app-muted hover:border-zinc-600 hover:text-app-text'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={quickCharacterSeed.note}
                    onChange={(event) => setQuickCharacterSeed((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder={appLanguage === 'en-US' ? 'Optional note: personality, secret, wish, conflict...' : '可选补充：性格、秘密、愿望、矛盾点……'}
                    className="min-h-24 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                  {appLanguage === 'en-US' ? `Step ${quickQuizStepIndex + 1}/${QUICK_QUIZ_STEPS.length}` : `第 ${quickQuizStepIndex + 1}/${QUICK_QUIZ_STEPS.length} 步`}
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">{quickText(step.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-app-muted">{quickText(step.subtitle)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-app-surface-soft sm:w-40">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${((quickQuizStepIndex + 1) / QUICK_QUIZ_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {step.options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleQuickQuizAnswer(step, option.id)}
                    className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                      active
                        ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                        : 'border-app-border bg-app-bg/60 text-app-text hover:border-zinc-600 hover:bg-app-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{quickText(option.label)}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-indigo-200" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setQuickQuizStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={quickQuizStepIndex === 0}
                className={semanticButtonClass('ghost', { compact: true })}
              >
                <ChevronLeft className="h-4 w-4" />
                {appLanguage === 'en-US' ? 'Previous' : '上一步'}
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setQuickQuizStepIndex((prev) => Math.min(QUICK_QUIZ_STEPS.length - 1, prev + 1))}
                    disabled={selected.length < 1}
                    className={semanticButtonClass('primary', { compact: true })}
                  >
                    {appLanguage === 'en-US' ? 'Next' : '下一步'}
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateBlueprint}
                    disabled={selected.length < 1}
                    className={semanticButtonClass('primary', { compact: true })}
                  >
                    <Sparkles className="h-4 w-4" />
                    {appLanguage === 'en-US' ? 'Generate my story' : '生成想玩的故事'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })() : (
      <>
      <div className="mx-auto mt-8 grid w-full max-w-4xl gap-3 px-4 text-left md:grid-cols-3">
        {QUICK_STORY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyQuickStoryTemplate(template)}
            className="group rounded-[1.5rem] border border-app-border bg-app-surface/40 p-4 text-left transition-all hover:-translate-y-1 hover:border-indigo-400/50 hover:bg-indigo-500/10 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-black text-app-text group-hover:text-white">{isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.label || template.label : template.label}</span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200">
                {isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.badge || template.badge : template.badge}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-app-muted group-hover:text-app-text">{isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.hint || template.hint : template.hint}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(isEnglish ? QUICK_STORY_TEMPLATE_EN[template.id]?.tags || template.tags : template.tags).map((tag) => (
                <span key={tag} className="rounded-full bg-app-bg px-2 py-1 text-[10px] font-bold text-app-muted">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 w-full max-w-2xl px-4 text-left">
        <label className="mb-3 block text-sm font-bold text-app-text">{tr('主题与标签（以逗号分隔）', 'Themes and tags, comma-separated')}</label>
        <input
          value={themeInputText}
          onChange={(event) => {
             const val = event.target.value;
             setThemeInputText(val);
             setSelectedThemes(val.split(/[,，]/).map(s => s.trim()).filter(Boolean));
          }}
          placeholder={tr('在此手动输入标签或点击下方快速添加', 'Enter tags here or tap quick tags below')}
          className="w-full rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {THEMES.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                 const current = themeInputText.trim();
                 const displayTag = isEnglish ? THEME_LABEL_EN[tag] || tag : tag;
                 let newText = current;
                 if (!current) newText = displayTag;
                 else if (!current.includes(displayTag)) newText = current + (current.endsWith('，') || current.endsWith(',') ? '' : (isEnglish ? ', ' : '，')) + displayTag;
                 setThemeInputText(newText);
                 setSelectedThemes(newText.split(/[,，]/).map(s => s.trim()).filter(Boolean));
              }}
              className="rounded-lg bg-app-surface-soft/50 px-3 py-1.5 text-xs text-app-text transition-colors hover:bg-app-surface-soft hover:text-white"
            >
              + {isEnglish ? THEME_LABEL_EN[tag] || tag : tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-2xl px-4 text-left">
        <div className="mb-6 rounded-2xl border border-indigo-300/15 bg-indigo-500/10 p-4">
          <label className="mb-2 block text-sm font-black text-indigo-100">{tr('套用世界观设定', 'Apply world setting')}</label>
          <select
            value={quickSeriesBindingId}
            onChange={(event) => setQuickSeriesBindingId(event.target.value)}
            className="w-full rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
          >
            <option value="">{tr('不套用世界观设定', 'No world setting')}</option>
            {seriesWorlds.map((series) => (
              <option key={series.id} value={series.id}>{series.title || tr('未命名世界观设定', 'Untitled world setting')}</option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-indigo-100/65">
                {tr('世界观设定是可复用设定仓库。可勾选本次生成要遵守的世界基准、沿用角色卡，并在续作时加入继承节点。', 'A world setting is a reusable setting archive. Pick the rules and character cards this generation should obey, and add a continuity node for sequels.')}
          </p>
          {quickSeriesBindingId && (() => {
            const selected = seriesWorlds.find((series) => series.id === quickSeriesBindingId) || null;
            const baselineRules = getSeriesBaselineRules(selected);
            const characterCards = getSeriesCharacterCards(selected);
            const seriesStoryOptions = myStories.filter((story: any) => String(story?.seriesId || story?.series_id || story?.meta?.seriesId || story?.meta?.series_id || '') === quickSeriesBindingId);
            const continuityBranches = safeArray<any>(quickContinuitySourceStory?.branches);
            const continuityEndings = safeArray<any>(quickContinuitySourceStory?.endings);
            return (
              <div className="mt-4 space-y-4">
                <div className="border-t border-app-border pt-4">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('世界基准', 'World baseline')}</div>
                  {baselineRules.length === 0 ? (
                    <div className="text-xs leading-relaxed text-app-muted">{tr('该世界观设定还没有条目化基准；生成时只会参考世界观概况。', 'No itemized baseline rules yet; generation will only use the world overview as reference.')}</div>
                  ) : (
                    <div className="grid gap-2">
                      {baselineRules.map((rule) => (
                        <label key={rule.id} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                          <input
                            type="checkbox"
                            checked={quickSeriesSelection.baselineRuleIds.includes(rule.id)}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({
                              ...prev,
                              baselineRuleIds: event.target.checked
                                ? [...new Set([...prev.baselineRuleIds, rule.id])]
                                : prev.baselineRuleIds.filter((id) => id !== rule.id),
                            }))}
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
                <div className="rounded-2xl border border-app-border bg-app-bg/60 p-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('角色卡池', 'Character pool')}</div>
                  {characterCards.length === 0 ? (
                    <div className="text-xs leading-relaxed text-app-muted">{tr('该世界观设定还没有角色卡；生成时会根据本次情节重新设计角色。', 'No character cards yet; this story will create its own cast.')}</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {characterCards.map((card) => (
                        <label key={card.id} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                          <input
                            type="checkbox"
                            checked={quickSeriesSelection.characterIds.includes(card.id)}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({
                              ...prev,
                              characterIds: event.target.checked
                                ? [...new Set([...prev.characterIds, card.id])]
                                : prev.characterIds.filter((id) => id !== card.id),
                            }))}
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
                <div className="rounded-2xl border border-app-border bg-app-bg/60 p-3">
                  <label className="flex items-center gap-2 text-sm font-black text-app-text">
                    <input
                      type="checkbox"
                      checked={quickSeriesSelection.useContinuity}
                      onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, useContinuity: event.target.checked }))}
                      className="accent-indigo-500"
                    />
                    {tr('作为续作生成，设置前作继承锚点', 'Generate as sequel with previous-story anchors')}
                  </label>
                  {quickSeriesSelection.useContinuity && (
                    <div className="mt-3 space-y-3">
                      <select
                        value={quickSeriesSelection.sourceStoryId}
                        onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, sourceStoryId: event.target.value, requiredBranchIds: [], endingId: '', continuityNodeId: '' }))}
                        className="rounded-xl border border-app-border bg-app-input-bg px-3 py-3 text-sm text-app-text outline-none"
                      >
                        <option value="">{tr('选择前作', 'Choose previous story')}</option>
                        {seriesStoryOptions.map((story: any) => (
                          <option key={story.id} value={story.id}>{getStoryTitle(story)}</option>
                        ))}
                      </select>
                      {seriesStoryOptions.length === 0 && (
                        <div className="text-xs leading-relaxed text-app-muted">{tr('该世界观下还没有可作为前作的作品。请先生成或绑定第一部。', 'No previous story is bound to this world setting yet.')}</div>
                      )}
                      {quickContinuityLoading && (
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr('正在读取前作支线与结局...', 'Loading branches and endings...')}</div>
                      )}
                      {quickSeriesSelection.sourceStoryId && !quickContinuityLoading && (
                        <div className="grid gap-3">
                          <div>
                            <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('前置支线，可复选', 'Required branches')}</div>
                            {continuityBranches.length === 0 ? (
                              <div className="text-xs leading-relaxed text-app-muted">{tr('该前作没有可选支线。', 'This previous story has no branches.')}</div>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {continuityBranches.map((branch: any) => {
                                  const branchId = String(branch.id || '');
                                  return (
                                    <label key={branchId} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                      <input
                                        type="checkbox"
                                        checked={quickSeriesSelection.requiredBranchIds.includes(branchId)}
                                        onChange={(event) => setQuickSeriesSelection((prev) => ({
                                          ...prev,
                                          requiredBranchIds: event.target.checked
                                            ? [...new Set([...prev.requiredBranchIds, branchId])]
                                            : prev.requiredBranchIds.filter((id) => id !== branchId),
                                        }))}
                                        className="mt-1 accent-indigo-500"
                                      />
                                      <span className="font-bold text-app-text">{branch.name || branch.title || branchId}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-app-muted">{tr('前置结局，单选', 'Required ending')}</div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {continuityEndings.map((ending: any) => {
                                const endingId = String(ending.id || '');
                                return (
                                  <label key={endingId} className="flex items-start gap-2 rounded-xl border border-app-border bg-app-surface/50 p-3 text-xs text-app-text">
                                    <input
                                      type="radio"
                                      name="quick-continuity-ending"
                                      checked={quickSeriesSelection.endingId === endingId}
                                      onChange={() => setQuickSeriesSelection((prev) => ({ ...prev, endingId }))}
                                      className="mt-1 accent-indigo-500"
                                    />
                                    <span className="font-bold text-app-text">{ending.title || endingId}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <textarea
                            value={quickSeriesSelection.hardSettings}
                            onChange={(event) => setQuickSeriesSelection((prev) => ({ ...prev, hardSettings: event.target.value }))}
                            placeholder={tr('继承硬设定：一行一条，例如「前作中阵亡的人物不能无解释复活」或「第二部开场必须承认王都已陷落」。', 'Continuity hard rules: one per line, e.g. “Dead characters cannot return without explanation.”')}
                            className="min-h-24 w-full resize-y rounded-xl border border-app-border bg-app-input-bg px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <label className="mb-3 block text-sm font-bold text-app-text">{tr('专属故事大纲', 'Custom story outline')}</label>
        <textarea
          value={customOutline}
          onChange={(event) => setCustomOutline(event.target.value)}
          placeholder={tr('例如：一位在现代都市经营神秘书店的青年，某夜遇见来自未来的顾客，自此被卷入一场会改写现实的命运试炼。', 'Example: A young bookseller in a modern city meets a customer from the future and is drawn into a fate trial that can rewrite reality.')}
          className="min-h-[140px] w-full rounded-2xl border border-app-border bg-app-input-bg px-4 py-4 text-sm text-app-text outline-none transition-colors focus:border-indigo-500"
        />
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-app-border bg-app-bg/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-app-muted">{tr('叙事人称', 'Narrative voice')}</span>
              <span className="text-xs font-black text-indigo-300">
                {quickText(NARRATIVE_PERSON_OPTIONS.find((option) => option.value === narrativePerson)?.label)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {NARRATIVE_PERSON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNarrativePerson(option.value)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                    narrativePerson === option.value
                      ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                      : 'border-app-border bg-app-surface/50 text-app-muted hover:border-zinc-600 hover:text-app-text'
                  }`}
                >
                  <div className="text-sm font-black">{quickText(option.label)}</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-70">{quickText(option.hint)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="space-y-3 rounded-2xl border border-app-border bg-app-bg/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-app-muted">{tr('结局结构', 'Ending structure')}</span>
              <span className="text-xs font-black text-indigo-300">
                {quickEndingMode === 'single' ? tr('唯一走向', 'Fixed-ending path') : tr('三域走向', 'Three-domain path')}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                {
                  value: 'single',
                  label: tr('唯一走向', 'Fixed-ending path'),
                  hint: tr('所有干涉最终都会自然收束到唯一结局，重点在过程变化、角色经历与支线展开。', 'All interference naturally converges to one fixed ending; the focus is path changes, character experience, and branches.'),
                },
                {
                  value: 'dual',
                  label: tr('三域走向', 'Three-domain path'),
                  hint: tr('使用中域、左域、右域三类收束，并为每一域保留扩展更多具体结局的空间。', 'Uses middle, left, and right domains while leaving room for more concrete endings later.'),
                },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQuickEndingMode(option.value)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                    quickEndingMode === option.value
                      ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-lg shadow-indigo-950/30'
                      : 'border-app-border bg-app-surface/50 text-app-muted hover:border-zinc-600 hover:text-app-text'
                  }`}
                >
                  <div className="text-sm font-black">{option.label}</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-70">{option.hint}</div>
                </button>
              ))}
            </div>
            {quickEndingMode === 'dual' && (
              <div className="mt-4 rounded-2xl border border-app-border/80 bg-app-bg/60 p-3 text-xs font-bold text-app-muted">
                {(() => {
                  const axis = endingBiasAxisFromBias(quickEndingBias);
                  const bias = endingBiasFromAxis(axis);
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span>{tr('主线倾向', 'Mainline tendency')}</span>
                        <span className="text-sm font-black text-indigo-200">{endingBiasAxisLabel(axis)}</span>
                      </div>
                      <input
                        type="range"
                        min={-70}
                        max={70}
                        step={10}
                        value={axis}
                        onChange={(event) => setQuickEndingBias(endingBiasFromAxis(Number(event.target.value)))}
                        className="mt-3 w-full accent-indigo-500"
                      />
                      <div className="mt-2 flex justify-between text-[10px] font-black text-zinc-600">
                        <span>{tr('右域强', 'Right strong')}</span>
                        <span>{tr('中性', 'Neutral')}</span>
                        <span>{tr('左域强', 'Left strong')}</span>
                      </div>
                      <div className="mt-2 text-[11px] leading-relaxed text-app-muted">
                        {tr(`左域 ${bias.leftBaseWeight}% / 右域 ${bias.rightBaseWeight}%；支线会瓜分各自剩余空间来撬动走向。`, `Left ${bias.leftBaseWeight}% / Right ${bias.rightBaseWeight}%. Branches use each side's remaining room to shift the path.`)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-app-muted">{tr('每章目标字数', 'Target words per chapter')}</span>
            <span className="font-black text-indigo-300">{targetWordCount} {tr('字', 'words')}</span>
          </div>
          <input
            type="range"
            min="600"
            max="1200"
            step="100"
            value={targetWordCount}
            onChange={(event) => setTargetWordCount(parseInt(event.target.value, 10))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            <span>{tr('精简', 'Lean')}</span>
            <span>{tr('宏大', 'Epic')}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateBlueprint}
          disabled={
            (selectedThemes.length < 1 && customOutline.trim().length === 0 && !quickSeriesBindingId) ||
            selectedThemes.length > 4 ||
            (quickSeriesSelection.useContinuity && (!quickSeriesSelection.sourceStoryId || !quickSeriesSelection.endingId))
          }
          className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
        >
          <Sparkles className="h-4 w-4" />
          {tr('生成世界蓝图', 'Generate story blueprint')}
        </button>
      </div>
      </>
      )}
    </div>

  );
};
