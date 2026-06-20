import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AccountCenterContent } from './AccountCenterView';

export function AccountCenterLayer({ ctx, part = 'modal' }: { ctx: any; part?: 'modal' | 'page' }) {
  const {
    accountCenterMode,
    user,
    myBio,
    mySharedStories,
    followedAuthors,
    myStories,
    appLanguage,
    appTheme,
    pushSubscribeBusy,
    isAdminUser,
    adminFeatureDraft,
    isSavingAdminSettings,
    APP_VERSION_LABEL,
    APP_BUILD_LABEL,
    GUEST_RETENTION_NOTICE,
    tr,
    t,
    getUserAuthorName,
    setIsAccountCenterOpen,
    goBack,
    setIsEditNameModalOpen,
    setIsEditBioModalOpen,
    setIsSecurityModalOpen,
    setArchiveTab,
    openArchiveView,
    enterAuthoring,
    setAppLanguage,
    setAppTheme,
    enablePushNotifications,
    setIsHelpDrawerOpen,
    handleLogout,
    startTutorialFromOnboarding,
    setAdminFeatureDraft,
    handleSaveAdminSettings,
    isAccountCenterOpen,
    safeModalBackdropClass,
  } = ctx;

const isSystemSettingsMode = accountCenterMode === 'settings';
const renderAccountCenterContent = (mode: 'page' | 'modal' = 'modal') => (
  <AccountCenterContent
    mode={mode}
    accountCenterMode={accountCenterMode}
    user={user}
    myBio={myBio}
    mySharedStories={mySharedStories}
    followedAuthorsCount={followedAuthors.length}
    myStoriesCount={myStories.length}
    appLanguage={appLanguage}
    appTheme={appTheme}
    pushSubscribeBusy={pushSubscribeBusy}
    isAdminUser={isAdminUser}
    adminFeatureDraft={adminFeatureDraft}
    isSavingAdminSettings={isSavingAdminSettings}
    appVersionLabel={APP_VERSION_LABEL}
    appBuildLabel={APP_BUILD_LABEL}
    guestRetentionNotice={GUEST_RETENTION_NOTICE}
    tr={tr}
    t={t}
    getUserAuthorName={getUserAuthorName}
    onClose={() => setIsAccountCenterOpen(false)}
    onBackPage={() => goBack('STORY_SELECT')}
    onEditName={() => setIsEditNameModalOpen(true)}
    onEditBio={() => setIsEditBioModalOpen(true)}
    onSecurity={() => setIsSecurityModalOpen(true)}
    onOpenArchiveFavorite={(returnTarget) => {
      setArchiveTab('favorite');
      openArchiveView(returnTarget);
    }}
    onOpenArchiveSaved={(returnTarget) => {
      setArchiveTab('saved');
      openArchiveView(returnTarget);
    }}
    onOpenArchiveAuthors={(returnTarget) => {
      setArchiveTab('authors');
      openArchiveView(returnTarget);
    }}
    onEnterAuthoring={() => {
      setIsAccountCenterOpen(false);
      void enterAuthoring();
    }}
    onSetLanguage={setAppLanguage}
    onSetTheme={setAppTheme}
    onEnablePushNotifications={enablePushNotifications}
    onOpenHelpCenter={() => {
      if (mode === 'modal') setIsAccountCenterOpen(false);
      setIsHelpDrawerOpen(true);
    }}
    onLogout={() => {
      if (mode === 'modal') setIsAccountCenterOpen(false);
      handleLogout();
    }}
    onStartTutorial={() => {
      if (mode === 'modal') setIsAccountCenterOpen(false);
      startTutorialFromOnboarding();
    }}
    onToggleCoverGeneration={() => setAdminFeatureDraft((prev) => ({ ...prev, coverGenerationEnabled: !prev.coverGenerationEnabled }))}
    onSaveAdminSettings={handleSaveAdminSettings}
  />
);
const accountCenterModal = (
  <AnimatePresence>
    {isAccountCenterOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} ${isSystemSettingsMode ? 'z-[3200] bg-black/80' : 'z-[2400] bg-black/45'} backdrop-blur-md`}
        style={!isSystemSettingsMode ? { paddingBottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 6.1rem)' } : undefined}
        onClick={() => setIsAccountCenterOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          className={`app-modal-surface app-modal-safe-height w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6`}
          onClick={(event) => event.stopPropagation()}
        >
          {renderAccountCenterContent('modal')}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const renderAccountCenterView = () => (
  <div className="mx-auto max-w-4xl px-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] lg:px-8">
    {renderAccountCenterContent('page')}
  </div>
);

  return part === 'page' ? renderAccountCenterView() : accountCenterModal;
}
