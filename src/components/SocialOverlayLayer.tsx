import React from 'react';
import { AuthorProfileModal, NotificationCenterModal, ShareComposerModal } from './SocialModals';

export function SocialOverlayLayer({ ctx }: { ctx: any }) {
  const {
    authorProfileTarget,
    authorProfileBio,
    authorProfileLoading,
    authorProfileStories,
    user,
    authorProfileFollowing,
    authorProfileBusy,
    isEnglish,
    tr,
    shortUserId,
    formatBookTitle,
    getStoryTitle,
    getStoryLikeCount,
    getStoryFavoriteCount,
    getStoryShareCount,
    getStoryInterventionCount,
    setAuthorProfileTarget,
    toggleAuthorFollow,
    startStoryPlay,
    notificationCenterOpen,
    notificationLoading,
    notificationItems,
    setNotificationCenterOpen,
    refreshNotificationCenter,
    markAllNotificationsRead,
    clearAllNotifications,
    deleteNotificationItem,
    shareComposer,
    shareComposerText,
    t,
    setShareComposerText,
    closeShareComposer,
    confirmShareComposer,
  } = ctx;

const renderAuthorProfileModal = () => (
  <AuthorProfileModal
    target={authorProfileTarget}
    bio={authorProfileBio}
    loading={authorProfileLoading}
    stories={authorProfileStories}
    currentUserId={user?.uid}
    following={authorProfileFollowing}
    busy={authorProfileBusy}
    isEnglish={isEnglish}
    tr={tr}
    shortUserId={shortUserId}
    formatBookTitle={formatBookTitle}
    getStoryTitle={getStoryTitle}
    getStoryLikeCount={getStoryLikeCount}
    getStoryFavoriteCount={getStoryFavoriteCount}
    getStoryShareCount={getStoryShareCount}
    getStoryInterventionCount={getStoryInterventionCount}
    onClose={() => setAuthorProfileTarget(null)}
    onToggleFollow={toggleAuthorFollow}
    onOpenStory={(storyId) => {
      setAuthorProfileTarget(null);
      void startStoryPlay(storyId);
    }}
  />
);

const renderNotificationCenter = () => (
  <NotificationCenterModal
    open={notificationCenterOpen}
    loading={notificationLoading}
    items={notificationItems}
    tr={tr}
    onClose={() => setNotificationCenterOpen(false)}
    onRefresh={() => void refreshNotificationCenter()}
    onMarkAllRead={() => void markAllNotificationsRead()}
    onClearAll={() => void clearAllNotifications()}
    onDelete={(id) => void deleteNotificationItem(id)}
    onOpenStory={(storyId) => {
      setNotificationCenterOpen(false);
      void startStoryPlay(storyId);
    }}
  />
);

const renderShareComposer = () => (
  <ShareComposerModal
    shareComposer={shareComposer}
    text={shareComposerText}
    tr={tr}
    t={t}
    onTextChange={setShareComposerText}
    onClose={() => closeShareComposer(false)}
    onConfirm={() => void confirmShareComposer()}
  />
);

  return (
    <>
      {renderAuthorProfileModal()}
      {renderNotificationCenter()}
      {renderShareComposer()}
    </>
  );
}
