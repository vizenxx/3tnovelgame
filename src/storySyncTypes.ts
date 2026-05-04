export type SyncStatus = 'idle' | 'loading' | 'syncing' | 'stale' | 'error';

export type StoryListSegment = 'public' | 'mine' | 'archive';

export type SegmentSyncState = {
  status: SyncStatus;
  updatedAt?: number;
  error?: string;
};

export type StoryListSyncState = Record<StoryListSegment, SegmentSyncState>;

export const createIdleStoryListSyncState = (): StoryListSyncState => ({
  public: { status: 'idle' },
  mine: { status: 'idle' },
  archive: { status: 'idle' },
});

export const updateStoryListSegmentState = (
  previous: StoryListSyncState,
  segment: StoryListSegment,
  status: SyncStatus,
  error?: string
): StoryListSyncState => ({
  ...previous,
  [segment]: {
    status,
    updatedAt: status === 'syncing' || status === 'loading'
      ? previous[segment]?.updatedAt
      : Date.now(),
    error,
  },
});
