import React from 'react';
import { AuthoringTourOverlay, HelpCenterDrawer, HelpFloatingButton } from './HelpAndOnboarding';

export function HelpOverlayLayer({ ctx }: { ctx: any }) {
  const {
    authoringCartridge,
    tourStep,
    setTourStep,
    setAuthoringTab,
    showError,
    isHelpDrawerOpen,
    helpSearch,
    dismissedHelpCards,
    tr,
    setHelpSearch,
    setIsHelpDrawerOpen,
    restoreHelpCards,
  } = ctx;

const renderTourOverlay = () => (
  <AuthoringTourOverlay
    tourStep={authoringCartridge ? tourStep : null}
    setTourStep={setTourStep}
    setAuthoringTab={setAuthoringTab}
    showMessage={showError}
  />
);
const renderHelpFloatingButton = () => (
  <HelpFloatingButton />
);
const renderHelpCenterDrawer = () => (
  <HelpCenterDrawer
    open={isHelpDrawerOpen}
    search={helpSearch}
    dismissedCount={Object.keys(dismissedHelpCards).length}
    tr={tr}
    onSearchChange={setHelpSearch}
    onClose={() => setIsHelpDrawerOpen(false)}
    onRestore={restoreHelpCards}
  />
);

  return (
    <>
      {renderTourOverlay()}
      {renderHelpFloatingButton()}
      {renderHelpCenterDrawer()}
    </>
  );
}
