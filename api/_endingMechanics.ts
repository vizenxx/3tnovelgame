type InterventionAction = 'bless' | 'curse';
type EndingDomain = 'left' | 'middle' | 'right';
type EndingBias = { leftBaseWeight: number; rightBaseWeight: number };
const ENDING_BIAS_MIN_PERCENT = 10;
const ENDING_BIAS_MAX_PERCENT = 80;
const ENDING_BIAS_INTERNAL_BASE = 20;

type RuntimeBranchLike = {
  id?: string;
  side?: 'left' | 'right';
  tier?: 'small' | 'medium' | 'large' | 'hidden';
  score?: number;
  is_hidden?: boolean;
  hidden?: boolean;
  endingId?: string;
  ending_id?: string;
  targetEndingId?: string;
  target_ending_id?: string;
  inject?: {
    hidden?: boolean;
    endingId?: string;
    targetEndingId?: string;
  };
};

type StoryInterventionEvent = {
  chapterNum: number;
  charId: string;
  action: InterventionAction;
};

export function branchBaseWeight(tier?: RuntimeBranchLike['tier']): number {
  if (tier === 'medium') return 2;
  if (tier === 'large') return 3;
  return 1;
}

export function branchEffectiveWeight(branch: RuntimeBranchLike): number {
  const score = Number(branch.score);
  if (Number.isFinite(score) && score > 0 && score <= 4) {
    return Math.max(1, Math.min(4, Math.round(score)));
  }
  const hiddenBonus = branch.tier === 'hidden' || branch.is_hidden || branch.hidden || branch.inject?.hidden ? 1 : 0;
  return branchBaseWeight(branch.tier) + hiddenBonus;
}

export function normalizeEndingBiasDisplay(input?: Partial<EndingBias> | { left?: number; right?: number } | null): EndingBias {
  const rawLeft = Number((input as any)?.leftBaseWeight ?? (input as any)?.left);
  const rawRight = Number((input as any)?.rightBaseWeight ?? (input as any)?.right);
  const normalizePercent = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 40;
    if (value < ENDING_BIAS_MIN_PERCENT) {
      return Math.round(Math.max(ENDING_BIAS_MIN_PERCENT, Math.min(ENDING_BIAS_MAX_PERCENT, value * 10)));
    }
    return Math.round(Math.max(ENDING_BIAS_MIN_PERCENT, Math.min(ENDING_BIAS_MAX_PERCENT, value)));
  };
  return {
    leftBaseWeight: normalizePercent(rawLeft),
    rightBaseWeight: normalizePercent(rawRight),
  };
}

export function normalizeEndingBias(input?: Partial<EndingBias> | { left?: number; right?: number } | null): EndingBias {
  const displayBias = normalizeEndingBiasDisplay(input);
  const percentToWeight = (percent: number) => Math.round((percent / 100) * ENDING_BIAS_INTERNAL_BASE * 100) / 100;
  return {
    leftBaseWeight: percentToWeight(displayBias.leftBaseWeight),
    rightBaseWeight: percentToWeight(displayBias.rightBaseWeight),
  };
}

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

function branchEndingId(branch: RuntimeBranchLike, domain: EndingDomain) {
  const raw = branch.endingId
    ?? branch.ending_id
    ?? branch.targetEndingId
    ?? branch.target_ending_id
    ?? branch.inject?.endingId
    ?? branch.inject?.targetEndingId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return domain === 'middle' ? 'default' : domain;
}

function selectEndingForDomain(args: {
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
    byEnding.set(id, (byEnding.get(id) || 0) + branchEffectiveWeight(branch));
  }
  return [...byEnding.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
    || (args.domain === 'middle' ? 'default' : args.domain);
}

function highestBranchWeight(branches: RuntimeBranchLike[]) {
  return branches.reduce((max, branch) => Math.max(max, branchEffectiveWeight(branch)), 0);
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
    .reduce((sum, branch) => sum + branchEffectiveWeight(branch), 0);
  const rightBranchPool = args.unlockedBranches
    .filter((branch) => branch.side === 'right')
    .reduce((sum, branch) => sum + branchEffectiveWeight(branch), 0);
  const leftPool = endingBias.leftBaseWeight + leftBranchPool;
  const rightPool = endingBias.rightBaseWeight + rightBranchPool;
  const poolTotal = Math.max(1, leftPool + rightPool);
  const directionalExpectation = ((leftPool - rightPool) / poolTotal) * 5;

  const newlyLeftExclusive = args.newlyUnlockedBranches
    .filter((branch) => branch.side === 'left')
    .reduce((sum, branch) => sum + (branchEffectiveWeight(branch) / Math.max(leftPool, 1)) * 10, 0);
  const newlyRightExclusive = args.newlyUnlockedBranches
    .filter((branch) => branch.side === 'right')
    .reduce((sum, branch) => sum + (branchEffectiveWeight(branch) / Math.max(rightPool, 1)) * 10, 0);
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
  const reason = endingChanged
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
