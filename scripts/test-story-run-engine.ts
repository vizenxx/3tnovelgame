import assert from 'node:assert/strict';
import { calculateEndingMechanics } from '../server/_endingMechanics';
import { areStoryChaptersEquivalent, hashStoryChapters } from '../src/storyContentHash';
import { createIdleStoryListSyncState, updateStoryListSegmentState } from '../src/storySyncTypes';

const branches = [
  {
    id: 'branch-bless-c1-ch2',
    side: 'left',
    tier: 'small',
    name: 'Light in the ruins',
    hint: 'A gentle omen stirs.',
    desc: 'A hidden mercy becomes visible.',
    trigger: {
      type: 'single',
      single: { chapterNum: 2, charId: 'c1', action: 'bless' },
    },
    inject: { mustHappen: [], mustReveal: [], mustChange: [] },
  },
  {
    id: 'branch-curse-c2-count',
    side: 'right',
    tier: 'large',
    name: 'Ash vow',
    hint: 'A darker promise gathers.',
    desc: 'Repeated hardship opens a harsher route.',
    trigger: {
      type: 'count',
      count: { charId: 'c2', action: 'curse', minCount: 2, upToChapterNum: 5 },
    },
    inject: { mustHappen: [], mustReveal: [], mustChange: [] },
  },
] as any;

const first = calculateEndingMechanics({
  currentEndingValue: 0,
  allBranches: branches,
  unlockedBranches: [branches[0]],
  newlyUnlockedBranches: [branches[0]],
  intervention: { chapterNum: 2, charId: 'c1', action: 'bless' },
  historyLength: 1,
});

assert.equal(first.endingDelta, 2.5);
assert.equal(first.newEndingValue, 2.5);
assert.equal(first.endingDomain, 'middle');
assert.equal(first.leftPool, 60);
assert.equal(first.rightPool, 60);
assert.equal(first.rewriteRange.endChapter, 2);

const largeBranch = calculateEndingMechanics({
  currentEndingValue: 0,
  allBranches: branches,
  unlockedBranches: [branches[1]],
  newlyUnlockedBranches: [branches[1]],
  intervention: { chapterNum: 3, charId: 'c2', action: 'curse' },
  historyLength: 2,
});

assert.equal(largeBranch.rewriteRange.endChapter, 7);
assert.equal(largeBranch.rewriteRange.reason, 'large_branch');
assert.ok(largeBranch.endingDelta <= 0);

const branchesWithHidden = [
  ...branches,
  {
    id: 'branch-hidden-medium',
    side: 'left',
    tier: 'medium',
    hidden: true,
    trigger: {
      type: 'single',
      single: { chapterNum: 4, charId: 'c1', action: 'bless' },
    },
  }
] as any;

const hiddenTest = calculateEndingMechanics({
  currentEndingValue: 0,
  allBranches: branchesWithHidden,
  unlockedBranches: [branchesWithHidden[2]],
  newlyUnlockedBranches: [branchesWithHidden[2]],
  intervention: { chapterNum: 4, charId: 'c1', action: 'bless' },
  historyLength: 1,
});

assert.equal(hiddenTest.rewriteRange.endChapter, 6);
assert.equal(hiddenTest.rewriteRange.reason, 'medium_branch');
assert.equal(hiddenTest.endingDelta, 3.5);
assert.equal(hiddenTest.newEndingValue, 3.5);

assert.equal(
  areStoryChaptersEquivalent(
    [{ chapter_num: 1, title: ' One ', summary: '', text: 'A   quiet road' }],
    [{ chapter_num: 1, title: 'One', summary: '', text: 'A quiet road' }]
  ),
  true
);
assert.notEqual(
  hashStoryChapters([{ chapter_num: 1, title: 'One', summary: '', text: 'A quiet road' }]),
  hashStoryChapters([{ chapter_num: 1, title: 'One', summary: '', text: 'A broken road' }])
);

const syncState = updateStoryListSegmentState(createIdleStoryListSyncState(), 'archive', 'error', 'timeout');
assert.equal(syncState.archive.status, 'error');
assert.equal(syncState.archive.error, 'timeout');
assert.equal(syncState.public.status, 'idle');

console.log('story mechanics tests passed');
