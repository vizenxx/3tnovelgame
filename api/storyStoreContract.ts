export const STORY_STORE_ACTIONS = [
  'listPublicStories',
  'listMyStories',
  'listMySharedStories',
  'getStoryMeta',
  'getStoryCartridge',
  'getSharedStoryRecord',
  'getAppSettings',
  'getUserProgress',
  'saveUserProgress',
  'saveAppSettings',
  'reserveCoverUsage',
  'refundCoverUsage',
  'incrementStoryMetric',
  'likeStory',
  'unlikeStory',
  'favoriteStory',
  'unfavoriteStory',
  'reportStory',
  'createSharedStoryRecord',
  'updateAuthorNameEverywhere',
  'createEmptyStory',
  'adaptBlueprintToStory',
  'deleteSharedStoryRecord',
  'updateSharedStoryVisibility',
  'saveStoryMeta',
  'saveStoryChapter',
  'saveStoryEnding',
  'saveStoryMainlineBundle',
  'deleteStoryCartridge',
  'upsertStoryBranch',
  'createStoryBranch',
  'deleteStoryBranch',
] as const;

export type StoryStoreAction = typeof STORY_STORE_ACTIONS[number];

export function isStoryStoreAction(value: string): value is StoryStoreAction {
  return (STORY_STORE_ACTIONS as readonly string[]).includes(value);
}
