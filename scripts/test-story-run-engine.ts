import assert from 'node:assert/strict';
import { evaluateStoryRunAfterIntervention } from '../src/storyRunEngine';
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

const first = evaluateStoryRunAfterIntervention({
  branches,
  history: [],
  previousUnlockedBranches: [],
  previousHistoricalBranches: [],
  intervention: { chapterNum: 2, charId: 'c1', action: 'bless' },
  previousIntervenedChapters: [],
});

assert.equal(first.unlockedBranches.length, 1);
assert.equal(first.newlyUnlockedBranches[0]?.id, 'branch-bless-c1-ch2');
assert.equal(first.historicallyUnlockedBranches.length, 1);
assert.equal(first.endingDelta, 7);
assert.equal(first.newEndingValue, 7);
assert.equal(first.endingDomain, 'middle');
assert.equal(first.leftPool, 2);
assert.equal(first.rightPool, 1);
assert.equal(first.shouldWarnAboutRewriteRisk, false);

const rewriteEarlier = evaluateStoryRunAfterIntervention({
  branches,
  history: [{ chapterNum: 5, charId: 'c2', action: 'curse' }],
  previousUnlockedBranches: [],
  previousHistoricalBranches: first.historicallyUnlockedBranches,
  intervention: { chapterNum: 3, charId: 'c2', action: 'curse' },
  previousIntervenedChapters: [5],
});

assert.equal(rewriteEarlier.shouldWarnAboutRewriteRisk, true);
assert.equal(rewriteEarlier.unlockedBranches.some((branch) => branch.id === 'branch-curse-c2-count'), true);
assert.equal(rewriteEarlier.endingDelta, -7);
assert.equal(rewriteEarlier.newEndingValue, -7);

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

console.log('storyRunEngine tests passed');
