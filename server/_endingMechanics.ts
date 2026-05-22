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
  let base = 1;
  if (Number.isFinite(score) && score > 0) {
    base = score;
  } else {
    base = branchBaseWeight(branch.tier);
  }
  const isHidden = branch.tier === 'hidden' || !!branch.is_hidden || !!branch.hidden || !!branch.inject?.hidden;
  return base + (isHidden ? 0.5 : 0);
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

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const unsigned = hash >>> 0;
  return unsigned / 4294967296;
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
  const displayBias = normalizeEndingBiasDisplay(args.endingBias);
  const leftMainline = displayBias.leftBaseWeight;
  const rightMainline = displayBias.rightBaseWeight;

  const leftPool = 100 - leftMainline;
  const rightPool = 100 - rightMainline;

  const leftSublines = args.allBranches.filter((branch) => branch.side === 'left');
  const rightSublines = args.allBranches.filter((branch) => branch.side === 'right');

  const leftTotalWeight = leftSublines.reduce((sum, branch) => sum + branchEffectiveWeight(branch), 0);
  const rightTotalWeight = rightSublines.reduce((sum, branch) => sum + branchEffectiveWeight(branch), 0);

  let directEVChange = 0;
  for (const branch of args.newlyUnlockedBranches) {
    let val = 0.5;
    if (branch.tier === 'medium') {
      val = 1.0;
    } else if (branch.tier === 'large') {
      val = 1.5;
    }
    const isHidden = branch.tier === 'hidden' || !!branch.is_hidden || !!branch.hidden || !!branch.inject?.hidden;
    if (isHidden) {
      val += 0.5;
    }
    if (branch.side === 'left') {
      directEVChange += val;
    } else if (branch.side === 'right') {
      directEVChange -= val;
    }
  }

  const leftTriggeredProb = leftSublines
    .filter((b) => args.unlockedBranches.some((ub) => ub.id === b.id))
    .reduce((sum, branch) => sum + (branchEffectiveWeight(branch) / (leftTotalWeight || 1)) * leftPool, 0);

  const rightTriggeredProb = rightSublines
    .filter((b) => args.unlockedBranches.some((ub) => ub.id === b.id))
    .reduce((sum, branch) => sum + (branchEffectiveWeight(branch) / (rightTotalWeight || 1)) * rightPool, 0);

  const leftSuccessRate = leftMainline + leftTriggeredProb;
  const rightSuccessRate = rightMainline + rightTriggeredProb;

  const seed = `${args.intervention.chapterNum}:${args.intervention.charId}:${args.intervention.action}:${args.historyLength}`;
  const leftRand = seededRandom(seed + ':left_success');
  const rightRand = seededRandom(seed + ':right_success');
  const leftChangeRand = seededRandom(seed + ':left_change');
  const rightChangeRand = seededRandom(seed + ':right_change');

  const leftSuccess = leftRand * 100 < leftSuccessRate;
  const rightSuccess = rightRand * 100 < rightSuccessRate;

  const leftChange = leftSuccess ? Math.floor(leftChangeRand * 5) + 1 : 0;
  const rightChange = rightSuccess ? Math.floor(rightChangeRand * 5) + 1 : 0;

  const endingDeltaRaw = directEVChange + leftChange - rightChange;
  const newEndingValue = clampEndingValue(args.currentEndingValue + endingDeltaRaw);
  const endingDelta = Math.round((newEndingValue - args.currentEndingValue) * 100) / 100;

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
