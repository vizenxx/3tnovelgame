export type Visibility = 'public' | 'unlisted' | 'private';
export type BranchSide = 'left' | 'right';
export type BranchTier = 'small' | 'medium' | 'large' | 'hidden';
export type InterventionAction = 'bless' | 'curse';
export type EndingMode = 'dual' | 'single';
export type EndingDomain = 'left' | 'middle' | 'right';

export interface EndingBias {
  leftBaseWeight: number;
  rightBaseWeight: number;
}

export const ENDING_BIAS_MIN_PERCENT = 10;
export const ENDING_BIAS_MAX_PERCENT = 80;
export const ENDING_BIAS_INTERNAL_BASE = 20;

export interface StoryCharacter {
  id: string; // c1, c2...
  name: string;
  desc: string;
}

export interface StoryMeta {
  title: string;
  main_axis: string;
  tags: string[];
  coverUrl?: string;
  sharedStoryId?: string;
  sourceStoryId?: string | null;
  originalAuthorId?: string | null;
  originalAuthorName?: string;
  intervenerId?: string | null;
  intervenerName?: string;
  authorId: string;
  authorName?: string;
  visibility: Visibility;
  popularity?: number; // legacy field; replaced by interventionCount
  likeCount?: number;
  interventionCount?: number;
  favoriteCount?: number;
  reportCount?: number;
  averageChapterWords?: number;
  chapterCount?: number;
  cardExcerpt?: string;
  allowAdaptation?: boolean;
  seriesId?: string | null;
  seriesRole?: 'standalone' | 'main' | 'sequel' | 'prequel' | 'side';
  continuityNodeId?: string | null;
  seriesConstraints?: Record<string, any>;
  endingMode?: EndingMode; // default: dual
  endingRates?: { left: number; right: number }; // 10-80%, only meaningful in dual mode
  endingBias?: EndingBias;
  /** 玩家总结界面展示用，各≤5字；双向模式下对应左/右倾向结局的「XX结局」 */
  endingNames?: { left?: string; right?: string };
  createdAt: string;
  updatedAt: string;
  version: number;
  defaults: {
    targetWordCount: number; // e.g. 800
    paragraphs: { min: number; max: number }; // e.g. 6-10
  };
  characters: StoryCharacter[];
}

export interface StoryChapterDoc {
  chapter_num: number; // 1..7
  title: string;
  summary: string;
  present_characters: string[]; // character ids
  text: string; // default mainline full text
}

export interface StoryEndingDoc {
  id: string;
  chapter_num: 7;
  title?: string;
  text: string;
  keyNodes?: string[];
}

export type BranchTrigger =
  | {
      type: 'single';
      single: {
        chapterNum: number;
        charId: string;
        action: InterventionAction;
      };
    }
  | {
      type: 'count';
      count: {
        charId: string;
        action: InterventionAction;
        minCount: number;
        upToChapterNum?: number;
      };
    };

export interface StoryBranchDoc {
  id: string;
  side: BranchSide;
  tier: BranchTier; // mapped to score: 1/2/3/5
  name: string;
  hint: string;
  desc: string;
  trigger: BranchTrigger;
  triggerGroups?: BranchTrigger[];
  common?: boolean; // if true, eligible to be reused by other stories (future)
  inject: {
    mustHappen: string[];
    mustReveal: string[];
    mustChange: string[];
    hidden?: boolean;
    endingId?: string;
    targetEndingId?: string;
  };
  sceneText?: string;
}

// Runtime blueprint compatibility (minimal subset used by App.tsx + APIs)
export interface RuntimeBranch {
  id: string;
  name: string;
  score?: number; // 1/2/3/5
  side: BranchSide;
  condition_char?: string;
  condition_action?: InterventionAction;
  condition_chapter?: number;
  desc: string;
  is_hidden?: boolean;
  hint?: string;
  // Extended for cartridge mode
  trigger?: BranchTrigger;
  tier?: BranchTier;
  inject?: StoryBranchDoc['inject'];
  sceneText?: string;
}

export interface RuntimeBlueprint {
  title: string;
  main_axis: string;
  left_mainline_default: number;
  right_mainline_default: number;
  characters: StoryCharacter[];
  chapters: Array<{
    chapter_num: number;
    title: string;
    summary: string;
    present_characters: string[];
    text?: string;
  }>;
  endings: Array<{ type: 'good' | 'normal' | 'bad'; text: string }> & any[];
  endingMode?: EndingMode;
  endingBias?: EndingBias;
  branches: RuntimeBranch[];
  // Cartridge-only author assets
  authorAssets?: {
    defaultChapters?: Record<number, { text: string; title?: string; summary?: string }>;
    endingPrototypes?: { default?: string; left?: string; right?: string };
  };
}

export function tierToScore(tier: BranchTier): number {
  if (tier === 'small') return 1;
  if (tier === 'medium') return 2;
  if (tier === 'large') return 3;
  return 2; // legacy hidden means "small + hidden bonus"; hidden is no longer a strength tier.
}

export function branchBaseWeight(tier?: BranchTier): number {
  if (tier === 'medium') return 2;
  if (tier === 'large') return 3;
  return 1;
}

export function branchHiddenBonus(branch: { tier?: BranchTier; is_hidden?: boolean; hidden?: boolean }): number {
  return branch.tier === 'hidden' || branch.is_hidden || branch.hidden || (branch as any).inject?.hidden ? 1 : 0;
}

export function branchEffectiveWeight(branch: {
  tier?: BranchTier;
  score?: number;
  is_hidden?: boolean;
  hidden?: boolean;
}): number {
  const score = Number(branch.score);
  let base = 1;
  if (Number.isFinite(score) && score > 0) {
    base = score;
  } else {
    base = branchBaseWeight(branch.tier);
  }
  const isHidden = branch.tier === 'hidden' || !!branch.is_hidden || !!branch.hidden || !!(branch as any).inject?.hidden;
  return base + (isHidden ? 0.5 : 0);
}

export function normalizeEndingBias(input?: Partial<EndingBias> | { left?: number; right?: number } | null): EndingBias {
  const rawLeft = Number((input as any)?.leftBaseWeight ?? (input as any)?.left);
  const rawRight = Number((input as any)?.rightBaseWeight ?? (input as any)?.right);
  const normalize = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 40;
    if (value < ENDING_BIAS_MIN_PERCENT) {
      return Math.round(Math.max(ENDING_BIAS_MIN_PERCENT, Math.min(ENDING_BIAS_MAX_PERCENT, value * 10)));
    }
    return Math.round(Math.max(ENDING_BIAS_MIN_PERCENT, Math.min(ENDING_BIAS_MAX_PERCENT, value)));
  };
  return {
    leftBaseWeight: normalize(rawLeft),
    rightBaseWeight: normalize(rawRight),
  };
}

export function endingBiasPercentToInternalWeight(percent: number): number {
  const normalized = normalizeEndingBias({ leftBaseWeight: percent, rightBaseWeight: percent }).leftBaseWeight;
  return Math.round((normalized / 100) * ENDING_BIAS_INTERNAL_BASE * 100) / 100;
}

export function normalizeEndingBiasForMechanics(input?: Partial<EndingBias> | { left?: number; right?: number } | null): EndingBias {
  const displayBias = normalizeEndingBias(input);
  return {
    leftBaseWeight: endingBiasPercentToInternalWeight(displayBias.leftBaseWeight),
    rightBaseWeight: endingBiasPercentToInternalWeight(displayBias.rightBaseWeight),
  };
}

export function isBranchUnlockedByHistory(args: {
  branch: StoryBranchDoc;
  history: Array<{ chapterNum: number; charId: string; action: InterventionAction }>;
}): boolean {
  const { branch, history } = args;
  const groups = (branch.triggerGroups && branch.triggerGroups.length > 0 ? branch.triggerGroups : [branch.trigger]).slice(0, 3);
  return groups.every((g) => {
    if (g.type === 'single') {
      const t = g.single;
      return history.some(h => h.chapterNum === t.chapterNum && h.charId === t.charId && h.action === t.action);
    }
    const c = g.count;
    const relevant = history.filter(h => h.charId === c.charId && h.action === c.action);
    const sliced = typeof c.upToChapterNum === 'number' ? relevant.filter(h => h.chapterNum <= c.upToChapterNum) : relevant;
    return sliced.length >= c.minCount;
  });
}
