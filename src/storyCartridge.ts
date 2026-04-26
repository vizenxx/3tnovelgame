export type Visibility = 'public' | 'unlisted' | 'private';
export type BranchSide = 'left' | 'right';
export type BranchTier = 'small' | 'medium' | 'large' | 'hidden';
export type InterventionAction = 'bless' | 'curse';
export type EndingMode = 'dual' | 'single';

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
  endingMode?: EndingMode; // default: dual
  endingRates?: { left: number; right: number }; // 0-80, only meaningful in dual mode
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
  id: 'default' | 'left' | 'right';
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
  };
  sceneText?: string;
}

// Runtime blueprint compatibility (minimal subset used by App.tsx + APIs)
export interface RuntimeBranch {
  id: string;
  name: string;
  score: number; // 1/2/3/5
  side: BranchSide;
  condition_char: string;
  condition_action: InterventionAction;
  condition_chapter: number;
  desc: string;
  is_hidden: boolean;
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
  return 5; // hidden
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
