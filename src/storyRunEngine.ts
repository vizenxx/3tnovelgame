import type { BranchTrigger, InterventionAction, StoryBranchDoc } from './storyCartridge';
import { branchEffectiveWeight, isBranchUnlockedByHistory, normalizeEndingBias } from './storyCartridge';
import type { EndingBias, EndingDomain } from './storyCartridge';

export type StoryInterventionEvent = {
  chapterNum: number;
  charId: string;
  action: InterventionAction;
};

export type RuntimeBranchLike = StoryBranchDoc & {
  condition_char?: string;
  condition_action?: InterventionAction;
  condition_chapter?: number;
  score?: number;
  is_hidden?: boolean;
};

export type StoryRunDecision = {
  unlockedBranches: RuntimeBranchLike[];
  newlyUnlockedBranches: RuntimeBranchLike[];
  historicallyUnlockedBranches: RuntimeBranchLike[];
  endingDelta: number;
  newEndingValue: number;
  endingDomain: EndingDomain;
  selectedEndingId: string;
  endingBias: EndingBias;
  leftPool: number;
  rightPool: number;
  rewriteRange: {
    startChapter: number;
    endChapter: number;
    reason: 'ending_shift' | 'large_branch' | 'medium_branch' | 'small_branch' | 'local';
  };
  affectedChapterStart: number;
  shouldWarnAboutRewriteRisk: boolean;
};

const normalizeTrigger = (branch: RuntimeBranchLike): BranchTrigger => {
  if (branch.trigger) return branch.trigger;
  return {
    type: 'single',
    single: {
      chapterNum: Number(branch.condition_chapter || 2),
      charId: String(branch.condition_char || ''),
      action: branch.condition_action === 'curse' ? 'curse' : 'bless',
    },
  };
};

const normalizeBranch = (branch: RuntimeBranchLike): RuntimeBranchLike => ({
  ...branch,
  trigger: normalizeTrigger(branch),
  triggerGroups: branch.triggerGroups && branch.triggerGroups.length > 0
    ? branch.triggerGroups
    : [normalizeTrigger(branch)],
});

const branchWeight = (branch: RuntimeBranchLike) => {
  return branchEffectiveWeight(branch);
};

const clampEndingValue = (value: number) => Math.max(-25, Math.min(25, Math.round(value * 100) / 100));

export function endingDomainForValue(value: number): EndingDomain {
  if (value >= 15) return 'left';
  if (value <= -15) return 'right';
  return 'middle';
}

function deterministicNoise(args: {
  chapterNum: number;
  charId: string;
  action: InterventionAction;
  historyLength: number;
  leftPool: number;
  rightPool: number;
}) {
  const seed = `${args.chapterNum}:${args.charId}:${args.action}:${args.historyLength}:${args.leftPool}:${args.rightPool}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return ((Math.abs(hash) % 300) / 100) - 1.5;
}

function highestBranchWeight(branches: RuntimeBranchLike[]) {
  return branches.reduce((max, branch) => Math.max(max, branchWeight(branch)), 0);
}

function branchEndingId(branch: RuntimeBranchLike, domain: EndingDomain) {
  const raw = (branch as any).endingId ?? (branch as any).ending_id ?? (branch as any).targetEndingId ?? (branch as any).target_ending_id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return domain === 'middle' ? 'default' : domain;
}

export function selectEndingForDomain(args: {
  domain: EndingDomain;
  unlockedBranches: RuntimeBranchLike[];
  endingMode?: 'single' | 'dual';
}) {
  if (args.endingMode === 'single') return 'default';
  const domainBranches = args.unlockedBranches.filter((branch) => {
    if (args.domain === 'middle') return false;
    return branch.side === args.domain;
  });
  if (domainBranches.length === 0) return args.domain === 'middle' ? 'default' : args.domain;
  const byEnding = new Map<string, number>();
  for (const branch of domainBranches) {
    const id = branchEndingId(branch, args.domain);
    byEnding.set(id, (byEnding.get(id) || 0) + branchWeight(branch));
  }
  return [...byEnding.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || (args.domain === 'middle' ? 'default' : args.domain);
}

export function calculateEndingMechanics(args: {
  currentEndingValue: number;
  endingBias?: Partial<EndingBias> | { left?: number; right?: number } | null;
  allBranches: RuntimeBranchLike[];
  unlockedBranches: RuntimeBranchLike[];
  newlyUnlockedBranches: RuntimeBranchLike[];
  intervention: StoryInterventionEvent;
  historyLength: number;
  endingMode?: 'single' | 'dual';
}) {
  const endingBias = normalizeEndingBias(args.endingBias);
  const leftBranchPool = args.unlockedBranches
    .filter((branch) => branch.side === 'left')
    .reduce((sum, branch) => sum + branchWeight(branch), 0);
  const rightBranchPool = args.unlockedBranches
    .filter((branch) => branch.side === 'right')
    .reduce((sum, branch) => sum + branchWeight(branch), 0);
  const leftPool = endingBias.leftBaseWeight + leftBranchPool;
  const rightPool = endingBias.rightBaseWeight + rightBranchPool;
  const poolTotal = Math.max(1, leftPool + rightPool);
  const directionalExpectation = ((leftPool - rightPool) / poolTotal) * 5;

  const newlyLeftExclusive = args.newlyUnlockedBranches
    .filter((branch) => branch.side === 'left')
    .reduce((sum, branch) => sum + (branchWeight(branch) / Math.max(leftPool, 1)) * 10, 0);
  const newlyRightExclusive = args.newlyUnlockedBranches
    .filter((branch) => branch.side === 'right')
    .reduce((sum, branch) => sum + (branchWeight(branch) / Math.max(rightPool, 1)) * 10, 0);
  const exclusivePull = newlyLeftExclusive - newlyRightExclusive;
  const noise = deterministicNoise({
    ...args.intervention,
    historyLength: args.historyLength,
    leftPool,
    rightPool,
  });
  const endingDelta = Math.max(-7, Math.min(7, directionalExpectation + exclusivePull + noise));
  const newEndingValue = clampEndingValue(args.currentEndingValue + endingDelta);
  const endingDomain = endingDomainForValue(newEndingValue);
  const previousDomain = endingDomainForValue(args.currentEndingValue);
  const selectedEndingId = selectEndingForDomain({
    domain: endingDomain,
    unlockedBranches: args.unlockedBranches,
    endingMode: args.endingMode,
  });
  const previousEndingId = selectEndingForDomain({
    domain: previousDomain,
    unlockedBranches: args.unlockedBranches.filter((branch) => !args.newlyUnlockedBranches.some((newBranch) => newBranch.id === branch.id)),
    endingMode: args.endingMode,
  });

  const maxNewWeight = highestBranchWeight(args.newlyUnlockedBranches);
  const endingChanged = endingDomain !== previousDomain || selectedEndingId !== previousEndingId;
  const endChapter = endingChanged || maxNewWeight >= 3
    ? 7
    : maxNewWeight >= 2
      ? Math.min(7, args.intervention.chapterNum + 2)
      : args.intervention.chapterNum;
  const reason: StoryRunDecision['rewriteRange']['reason'] = endingChanged
    ? 'ending_shift'
    : maxNewWeight >= 3
      ? 'large_branch'
      : maxNewWeight >= 2
        ? 'medium_branch'
        : maxNewWeight >= 1
          ? 'small_branch'
          : 'local';

  return {
    endingBias,
    leftPool,
    rightPool,
    endingDelta,
    newEndingValue,
    endingDomain,
    selectedEndingId,
    rewriteRange: {
      startChapter: args.intervention.chapterNum,
      endChapter,
      reason,
    },
  };
}

export function evaluateStoryRunAfterIntervention(args: {
  branches: RuntimeBranchLike[];
  history: StoryInterventionEvent[];
  previousUnlockedBranches: RuntimeBranchLike[];
  previousHistoricalBranches: RuntimeBranchLike[];
  intervention: StoryInterventionEvent;
  previousIntervenedChapters: number[];
  currentEndingValue?: number;
  endingBias?: Partial<EndingBias> | { left?: number; right?: number } | null;
  endingMode?: 'single' | 'dual';
}) {
  const nextHistory = [...args.history, args.intervention];
  const normalizedBranches = args.branches.map(normalizeBranch);
  const unlockedBranches = normalizedBranches.filter((branch) => (
    isBranchUnlockedByHistory({ branch, history: nextHistory })
  ));
  const previousUnlockedIds = new Set(args.previousUnlockedBranches.map((branch) => branch.id));
  const historicalIds = new Set(args.previousHistoricalBranches.map((branch) => branch.id));
  const newlyUnlockedBranches = unlockedBranches.filter((branch) => !previousUnlockedIds.has(branch.id));
  const historicallyUnlockedBranches = [
    ...args.previousHistoricalBranches,
    ...newlyUnlockedBranches.filter((branch) => !historicalIds.has(branch.id)),
  ];
  const mechanics = calculateEndingMechanics({
    currentEndingValue: args.currentEndingValue || 0,
    endingBias: args.endingBias,
    allBranches: normalizedBranches,
    unlockedBranches,
    newlyUnlockedBranches,
    intervention: args.intervention,
    historyLength: nextHistory.length,
    endingMode: args.endingMode,
  });
  const earliestLaterIntervention = args.previousIntervenedChapters.some((chapterNum) => (
    chapterNum > args.intervention.chapterNum
  ));

  return {
    unlockedBranches,
    newlyUnlockedBranches,
    historicallyUnlockedBranches,
    endingDelta: mechanics.endingDelta,
    newEndingValue: mechanics.newEndingValue,
    endingDomain: mechanics.endingDomain,
    selectedEndingId: mechanics.selectedEndingId,
    endingBias: mechanics.endingBias,
    leftPool: mechanics.leftPool,
    rightPool: mechanics.rightPool,
    rewriteRange: mechanics.rewriteRange,
    affectedChapterStart: mechanics.rewriteRange.startChapter,
    shouldWarnAboutRewriteRisk: earliestLaterIntervention,
  } satisfies StoryRunDecision;
}
