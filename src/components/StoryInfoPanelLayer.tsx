import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { semanticIconButtonClass } from './semanticClasses';

export function StoryInfoPanelLayer({ ctx }: { ctx: any }) {
  const {
    isStoryInfoOpen,
    setIsStoryInfoOpen,
    tr,
    blueprint,
    endingBiasStoryCardLabels,
    isSingleEndingStory,
    characterStatuses,
    unlockedBranches,
    historicallyUnlockedBranches,
    authoringEndingIdToLabel,
    branchTierLabel,
    isEnglish,
    formatTriggerCondition,
  } = ctx;

const storyInfoPanel = (
  <AnimatePresence>
    {isStoryInfoOpen && (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 z-[2200] w-full max-w-sm border-l border-app-border bg-app-bg/90 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-app-border px-6 pb-6 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))]">
            <h3 className="text-xl font-black text-white">{tr('故事信息', 'Story Info')}</h3>
            <button
              type="button"
              onClick={() => setIsStoryInfoOpen(false)}
              className={semanticIconButtonClass('ghost')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {blueprint && (
              <>
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{tr('故事背景', 'Story Background')}</h4>
                  <p className="text-sm leading-relaxed text-app-text">{blueprint.main_axis}</p>
                </section>
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{tr('作者预设倾向', 'Author Tendency')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {endingBiasStoryCardLabels(blueprint).map((bias) => (
                      <div
                        key={bias.side}
                        className={`rounded-2xl border p-4 ${
                          bias.side === 'left'
                            ? 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100'
                            : bias.side === 'right'
                              ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                              : 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100'
                        }`}
                      >
                        <div className="text-[11px] font-black text-app-muted">{bias.label}</div>
                        <div className="mt-1 text-lg font-black">{bias.value}</div>
                      </div>
                    ))}
                  </div>
                  {isSingleEndingStory(blueprint) && (
                    <p className="text-xs leading-relaxed text-app-muted">
                      {tr('本作采用唯一走向，干涉会改变过程、角色经历与支线展开，但最终会自然收束到唯一结局。', 'This work uses a fixed-ending path; interference changes the journey, character experience, and branches, but ultimately converges to one ending.')}
                    </p>
                  )}
                  {!isSingleEndingStory(blueprint) && (
                  <p className="text-xs leading-relaxed text-app-muted">
                    {tr('这是作者为左域与右域设置的基础倾向，只作为命运走向参考，不代表最终结局必然落点。', 'This is the author’s base tendency for left/right ending domains. It is a reference, not a guaranteed final outcome.')}
                  </p>
                  )}
                </section>
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{tr('登场角色', 'Characters')}</h4>
                  <div className="grid gap-3">
                    {blueprint.characters.map(char => (
                      <div key={char.id} className="rounded-2xl border border-app-border bg-app-surface/40 p-4">
                        <div className="mb-1 flex items-start justify-between">
                          <div className="font-bold text-indigo-300">{char.name}</div>
                          {characterStatuses[char.id] && (
                            <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${characterStatuses[char.id].isDead ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {characterStatuses[char.id].status || tr('在场', 'Present')}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-app-muted leading-relaxed">{char.desc}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted">{tr('命运支线', 'Fate Branches')}</h4>
                  <div className="grid gap-3">
                    {(blueprint.branches || []).length === 0 ? (
                      <div className="rounded-2xl border border-app-border bg-app-surface/30 p-4 text-sm text-app-muted">
                        {tr('暂无支线记录。', 'No branch records yet.')}
                      </div>
                    ) : (
                      (blueprint.branches || []).filter((branch: any) => {
                        const isUnlocked = unlockedBranches.some((item: any) => item.id === branch.id);
                        const wasUnlocked = historicallyUnlockedBranches.some((item: any) => item.id === branch.id);
                        const isHidden = branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden;
                        return !isHidden || isUnlocked || wasUnlocked;
                      }).map((branch: any) => {
                        const isUnlocked = unlockedBranches.some((item: any) => item.id === branch.id);
                        const wasUnlocked = historicallyUnlockedBranches.some((item: any) => item.id === branch.id);
                        const isHidden = branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden;
                        const canRevealBranchContent = isUnlocked || wasUnlocked;
                        const visibleName = isHidden && !canRevealBranchContent ? tr('隐藏支线', 'Hidden branch') : branch.name;
                        const visibleDesc = canRevealBranchContent
                          ? (branch.desc || branch.sceneText || branch.hint || tr('尚无支线描述。', 'No branch description yet.'))
                          : (branch.hint || tr('继续干涉命运，寻找这条支线的触发契机。', 'Keep interfering with fate to find the trigger for this branch.'));
                        return (
                          <div
                            key={branch.id || branch.name}
                            className={`rounded-2xl border p-4 ${
                              isUnlocked
                                ? 'border-indigo-500/40 bg-indigo-950/30'
                                : wasUnlocked
                                  ? 'border-app-border bg-app-surface/60'
                                  : 'border-app-border bg-app-surface/30'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="font-bold text-app-text">{visibleName}</div>
                              <div className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                isUnlocked
                                  ? 'bg-indigo-500/20 text-indigo-200'
                                  : wasUnlocked
                                    ? 'bg-app-surface-soft/60 text-app-text'
                                    : 'bg-app-surface-soft text-app-muted'
                              }`}>
                                {isUnlocked ? tr('已解锁', 'Unlocked') : wasUnlocked ? tr('曾解锁', 'Previously unlocked') : tr('待解锁', 'Locked')}
                              </div>
                            </div>
                            <div className="text-xs leading-relaxed text-app-muted">{visibleDesc}</div>
                            {canRevealBranchContent && (
                              <div className="mt-2.5 rounded-xl border border-app-border bg-app-bg/40 p-2.5 space-y-1">
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                                  {tr('解锁方法：', 'Unlock Method: ')}
                                </div>
                                <div className="text-[11px] text-app-muted space-y-0.5">
                                  {(() => {
                                    const triggers = branch.triggerGroups || (branch.trigger ? [branch.trigger] : []);
                                    if (triggers.length === 0) return <div className="italic text-zinc-650">{tr('无判定条件', 'No trigger conditions')}</div>;
                                    return triggers.map((tg: any, tIdx: number) => (
                                      <div key={tIdx} className="flex items-start gap-1">
                                        <span className="text-zinc-600">•</span>
                                        <span>{formatTriggerCondition(tg, blueprint.characters || [], isEnglish)}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                            {canRevealBranchContent && (
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                                <span className="rounded-full bg-app-surface-soft px-2 py-1 text-app-text">
                                  {branch.side === 'left' ? tr('左域支线', 'Left branch') : tr('右域支线', 'Right branch')}
                                </span>
                                <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-200">
                                  {tr('影响：', 'Impact: ')}{branchTierLabel(branch.tier)}
                                </span>
                                <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-200">
                                  {tr('导向', 'Leads to')} {authoringEndingIdToLabel(branch.endingId || branch.inject?.endingId || branch.inject?.targetEndingId || branch.side)}
                                </span>
                                {(branch.is_hidden || branch.hidden || branch.tier === 'hidden' || branch.inject?.hidden) && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">{tr('隐藏支线', 'Hidden branch')}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);



  return storyInfoPanel;
}
