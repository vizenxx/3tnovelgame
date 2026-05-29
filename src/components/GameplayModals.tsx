import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, BookOpen, Check, Copy, Loader2, RefreshCcw, Sparkles, X } from 'lucide-react';
import { AuthoringSaveSuccessModal, ConfirmationModal } from './GeneralModals';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';

export function GameplayModals({ ctx }: { ctx: any }) {
  const {
    confirmationModal,
    setConfirmationModal,
    tr,
    t,
    shareOriginalStoryByCard,
    myStories,
    resetToHome,
    branchUnlockNotice,
    setBranchUnlockNotice,
    interventionStatusNotice,
    setInterventionStatusNotice,
    activeStoryId,
    blueprint,
    handleShareStory,
    isSharing,
    endingDomainUserLabel,
    endingDomainToneClass,
    semanticIconButtonClass,
    storyConclusion,
    setShowSummaryModal,
    showSummaryModal,
    isSingleEndingStory,
    endingValue,
    endingDomainFromValue,
    historicallyUnlockedBranches,
    unlockedBranches,
    handleSaveWorkAndReturn,
    handleSaveProgressAndReturn,
    resetGame,
    interventionsLeft,
    setShowLeaveGameModal,
    showLeaveGameModal,
    startNewStoryPlay,
    inheritedEndingDisplayLabel,
    startSequelWithInheritedRecord,
    setPendingSequelInheritance,
    pendingSequelInheritance,
    startFreshFromPendingProgress,
    resumeStoryPlay,
    safeModalBackdropClass,
    setPendingProgressToLoad,
    pendingProgressToLoad,
    setAuthoringCartridge,
    setAuthoringStoryId,
    handleShareSavedAuthoringStory,
    formatBookTitle,
    setAuthoringSaveSuccessStory,
    authoringSaveSuccessStory,
  } = ctx;

const renderConfirmationModal = () => (
  <ConfirmationModal
    modal={confirmationModal}
    tr={tr}
    onClose={() => setConfirmationModal((prev) => ({ ...prev, isOpen: false }))}
  />
);

const renderAuthoringSaveSuccessModal = () => (
  <AuthoringSaveSuccessModal
    story={authoringSaveSuccessStory}
    tr={tr}
    isSharing={isSharing}
    formatBookTitle={formatBookTitle}
    onShare={handleShareSavedAuthoringStory}
    onReturnHome={() => {
      setAuthoringSaveSuccessStory(null);
      setAuthoringStoryId(null);
      setAuthoringCartridge(null);
      resetToHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }}
    onClose={() => setAuthoringSaveSuccessStory(null)}
  />
);

const renderResumePromptModal = () => (
  <AnimatePresence>
    {pendingProgressToLoad && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5000] bg-black/90 backdrop-blur-lg`}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2.5rem] border border-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
            <RefreshCcw className="h-8 w-8" />
          </div>
          <h3 className="mb-3 text-2xl font-black text-app-text">{tr('检测到现有进度', 'Existing Progress Found')}</h3>
          <p className="mb-8 text-app-muted leading-relaxed">
            {tr('此前在这个故事中有尚未完成的干涉。是否要继承上次的进度继续游玩？', 'There is unfinished progress for this story. Continue from the previous run?')}
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => resumeStoryPlay(pendingProgressToLoad.id, pendingProgressToLoad.data)}
              className="w-full rounded-2xl bg-white py-4 text-sm font-black text-black shadow-lg shadow-white/5"
            >
              {tr('继承并继续', 'Continue')}
            </button>
            <button
              type="button"
              onClick={() => { void startFreshFromPendingProgress(); }}
              className="w-full rounded-2xl bg-app-surface py-4 text-sm font-bold text-app-muted"
            >
              {tr('开始新干涉', 'Start new run')}
            </button>
            <button
              type="button"
              onClick={() => setPendingProgressToLoad(null)}
              className="w-full py-2 text-xs font-medium text-zinc-600 hover:text-app-muted transition-colors"
            >
              {tr('暂不处理', 'Not now')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const renderSequelInheritanceModal = () => (
  <AnimatePresence>
    {pendingSequelInheritance && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5050] bg-black/85 backdrop-blur-lg`}
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6"
        >
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{tr('续作继承', 'Sequel inheritance')}</div>
            <h3 className="mt-2 text-2xl font-black text-app-text">{tr('选择要继承的前作命运线', 'Choose a previous fate line')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-app-muted">
              {tr('找到多条符合前置条件的记录。选择其中一条后，续作第一章会根据该记录做开场调节，之后再回到本作的既定轨道。', 'Multiple eligible records were found. Choose one to tune the sequel opening, then continue into the sequel path.')}
            </p>
          </div>
          <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1">
            {pendingSequelInheritance.records.map((record) => (
              <button
                key={record.runId}
                type="button"
                onClick={() => {
                  const pending = pendingSequelInheritance;
                  setPendingSequelInheritance(null);
                  void startSequelWithInheritedRecord(pending.storyId, pending.cartridge, pending.progressData, record, pending.requirement);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:border-indigo-400/45 hover:bg-indigo-500/10 active:scale-[0.99]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="font-black text-app-text">{inheritedEndingDisplayLabel(record, pendingSequelInheritance.requirement)}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${record.sourceType === 'archived' ? 'bg-amber-500/15 text-amber-200' : 'bg-app-surface-soft text-app-muted'}`}>
                      {record.sourceType === 'archived' ? tr('收藏命运', 'Fate Archive') : tr('自动记录', 'Auto record')}
                    </span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-app-muted">
                    {record.completedAt ? new Date(record.completedAt).toLocaleString() : tr('完成记录', 'Completed record')}
                  </div>
                </div>
                {record.unlockedBranches.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.unlockedBranches.slice(0, 5).map((branch) => (
                      <span key={branch.id} className="rounded-full bg-indigo-500/12 px-2.5 py-1 text-[11px] font-black text-indigo-100">
                        {branch.name || branch.id}
                      </span>
                    ))}
                  </div>
                )}
                {record.storyConclusion && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-app-muted">{record.storyConclusion}</p>
                )}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPendingSequelInheritance(null)} className={semanticButtonClass('ghost', { fullWidth: true })}>
              {tr('关闭', 'Close')}
            </button>
            <button
              type="button"
              onClick={() => {
                const pending = pendingSequelInheritance;
                setPendingSequelInheritance(null);
                void startNewStoryPlay(pending.storyId, pending.cartridge, pending.progressData);
              }}
              className={semanticButtonClass('secondary', { fullWidth: true })}
            >
              {tr('使用标准开场', 'Use standard opening')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const renderLeaveGameModal = () => (
  <AnimatePresence>
    {showLeaveGameModal && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5000] bg-black/80 backdrop-blur-md`}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2.5rem] border border-app-border p-6 shadow-2xl sm:p-8"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h3 className="mb-3 text-2xl font-black text-app-text">{tr('确定要离开吗？', 'Leave this run?')}</h3>
          <p className="mb-8 text-app-muted leading-relaxed">
            {tr('当前干涉尚未保存。离开游玩页后，未保存的游玩进度将会丢失。', 'This run has not been saved. Unsaved progress will be lost after leaving.')}
          </p>
          <div className="flex flex-col gap-3">
            {interventionsLeft > 0 && (
              <button
                type="button"
                onClick={() => resetGame({ discardCloudProgress: true })}
                className="w-full rounded-2xl bg-rose-500 py-4 text-sm font-black text-white shadow-lg shadow-rose-500/20"
              >
                {tr('放弃干涉并返回', 'Discard and return')}
              </button>
            )}
            {interventionsLeft < 3 && interventionsLeft > 0 && (
              <button
                type="button"
                onClick={handleSaveProgressAndReturn}
                className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-600/20"
              >
                {tr('保存进度并返回', 'Save & return')}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveWorkAndReturn}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20"
            >
              {tr('收藏命运并返回', 'Collect & return')}
            </button>
            <button
              type="button"
              onClick={() => resetGame({ discardCloudProgress: true })}
              className="w-full rounded-2xl bg-app-surface py-4 text-sm font-bold text-app-muted"
            >
              {tr('确认返回', 'Confirm return')}
            </button>
            <button
              type="button"
              onClick={() => setShowLeaveGameModal(false)}
              className="mt-2 w-full py-2 text-sm font-medium text-app-muted hover:text-app-text"
            >
              {tr('继续游玩', 'Keep playing')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const renderBranchUnlockModal = () => (
  <AnimatePresence>
    {branchUnlockNotice && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5200] bg-black/75 backdrop-blur-md`}
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-indigo-500/30 p-5 text-center shadow-2xl sm:p-7"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-indigo-300">{tr('支线解锁', 'Branch unlocked')}</div>
          <h3 className="text-2xl font-black text-app-text">{branchUnlockNotice.name || tr('新的命运支线', 'New fate branch')}</h3>
          {(branchUnlockNotice.desc || branchUnlockNotice.hint) && (
            <p className="mt-4 text-sm leading-relaxed text-app-muted">
              {branchUnlockNotice.desc || branchUnlockNotice.hint}
            </p>
          )}
          <button
            type="button"
            onClick={() => setBranchUnlockNotice(null)}
            className={`${semanticButtonClass('primary', { fullWidth: true })} mt-7`}
          >
            <Check className="h-4 w-4" />
            {tr('继续阅读', 'Continue reading')}
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const renderInterventionStatusNotice = () => (
  <AnimatePresence>
    {interventionStatusNotice && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5250] bg-black/65 backdrop-blur-md`}
        onClick={() => setInterventionStatusNotice(null)}
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 18, opacity: 0, scale: 0.96 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-3xl border border-app-border p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">{tr('命运涟漪', 'Fate ripple')}</div>
          {interventionStatusNotice.updates.length > 0 ? (
            <>
              <h3 className="mt-2 text-2xl font-black text-app-text">{tr('众人的命运因干涉而有了变化...', 'Fates shifted after the intervention...')}</h3>
              <div className="mt-5 grid gap-3">
                {interventionStatusNotice.updates.map((update) => (
                  <div key={update.id} className="rounded-2xl border border-app-border bg-app-surface/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-app-text">{update.name}</div>
                      <div className={`rounded-full px-2.5 py-1 text-[11px] font-black ${update.isDead ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {update.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-2xl font-black text-app-text">{tr('干涉的涟漪似乎没能碰触到众人...', 'The ripple did not seem to touch anyone...')}</h3>
              <p className="mt-4 text-sm leading-relaxed text-app-muted">
                {tr('这次变化更多停留在情节与命运走向之中，角色状态暂未出现可记录的改变。', 'This change stayed mostly in the plot and fate direction; no character status changed enough to record.')}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => setInterventionStatusNotice(null)}
            className={`${semanticButtonClass('primary', { fullWidth: true })} mt-7`}
          >
            <Check className="h-4 w-4" />
            {tr('关闭', 'Close')}
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const getCurrentBranchExplorationStats = () => {
  const total = (blueprint?.branches || []).length;
  const runById = new Map<string, any>();
  (unlockedBranches || []).forEach((branch: any) => {
    const id = String(branch?.id || branch?.name || '');
    if (id) runById.set(id, branch);
  });
  const historicalById = new Map<string, any>();
  (historicallyUnlockedBranches || []).forEach((branch: any) => {
    const id = String(branch?.id || branch?.name || '');
    if (id) historicalById.set(id, branch);
  });
  runById.forEach((branch, id) => historicalById.set(id, branch));
  return {
    total,
    runUnlocked: Array.from(runById.values()),
    historicalUnlockedCount: historicalById.size,
  };
};

const renderSummaryModal = () => {
  const domain = endingDomainFromValue(endingValue);
  const singleEnding = isSingleEndingStory(blueprint);
  const branchStats = getCurrentBranchExplorationStats();
  return (
  <AnimatePresence>
    {showSummaryModal && storyConclusion && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[5200] bg-black/75 backdrop-blur-md`}
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-amber-500/25 p-5 shadow-2xl sm:p-7"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-amber-300">{tr('命运结算', 'Fate result')}</div>
              <h3 className="text-3xl font-black text-app-text">{tr('最终命运总结', 'Final Fate Summary')}</h3>
            </div>
            <button type="button" onClick={() => setShowSummaryModal(false)} className={semanticIconButtonClass('ghost')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          {singleEnding && (
            <div className="mb-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm font-black text-indigo-100">
              {tr('当前走向：唯一走向', 'Fixed-ending path')}
            </div>
          )}
          {!singleEnding && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-black ${endingDomainToneClass(domain)}`}>
            {tr('当前结局归属：', 'Current ending domain: ')}{endingDomainUserLabel(domain)}
          </div>
          )}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-app-border bg-app-surface/35 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{tr('本次解锁', 'Unlocked this run')}</div>
              <div className="mt-1 text-2xl font-black text-white">{branchStats.runUnlocked.length}</div>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface/35 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{tr('解锁统计', 'Unlock progress')}</div>
              <div className="mt-1 text-2xl font-black text-white">{branchStats.historicalUnlockedCount}/{branchStats.total}</div>
            </div>
          </div>
          {branchStats.runUnlocked.length > 0 && (
            <div className="mb-4 rounded-2xl border border-app-border bg-app-surface/30 p-4">
              <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{tr('本次触及支线', 'Branches this run')}</div>
              <div className="flex flex-wrap gap-2">
                {branchStats.runUnlocked.map((branch: any) => (
                  <span key={branch.id || branch.name} className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-black text-indigo-200">
                    {branch.name || tr('未命名支线', 'Untitled branch')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-app-border bg-app-surface/40 p-5 text-lg font-medium leading-relaxed text-amber-100">
            {String(storyConclusion || '').split('\n').filter(Boolean).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setShowSummaryModal(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
              <BookOpen className="h-4 w-4" />
              {tr('回去阅读完整故事', 'Return to full story')}
            </button>
            <button type="button" onClick={handleShareStory} disabled={isSharing} className={semanticButtonClass('primary', { fullWidth: true })}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              {tr('分享故事', 'Share story')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};

  return (
    <>
      {renderConfirmationModal()}
      {renderAuthoringSaveSuccessModal()}
      {renderResumePromptModal()}
      {renderSequelInheritanceModal()}
      {renderLeaveGameModal()}
      {renderBranchUnlockModal()}
      {renderInterventionStatusNotice()}
      {renderSummaryModal()}
    </>
  );
}
