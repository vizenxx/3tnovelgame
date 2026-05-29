import React from 'react';
import { AuthoringTourOverlay, HelpCenterDrawer, HelpFloatingButton, getViewIntroConfigs } from './HelpAndOnboarding';
import { ViewIntroOverlay } from './ViewIntroOverlay';

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
    activeViewIntroKey,
    markViewIntroDone,
    onAuthoringTourDone,
  } = ctx;

  const viewIntroConfigs = getViewIntroConfigs(tr);
  const activeConfig = activeViewIntroKey ? viewIntroConfigs[activeViewIntroKey] : null;

  return (
    <>
      <AuthoringTourOverlay
        tourStep={authoringCartridge ? tourStep : null}
        tr={tr}
        setTourStep={setTourStep}
        setAuthoringTab={setAuthoringTab}
        showMessage={showError}
        onTourDone={onAuthoringTourDone}
      />

      {activeConfig && activeConfig.steps.length > 0 && (
        <ViewIntroOverlay
          steps={activeConfig.steps}
          aboveDock={activeConfig.aboveDock}
          onDone={() => markViewIntroDone(activeViewIntroKey)}
          tr={tr}
        />
      )}

      <HelpFloatingButton
        onOpen={() => setIsHelpDrawerOpen(true)}
        tr={tr}
      />

      <HelpCenterDrawer
        open={isHelpDrawerOpen}
        search={helpSearch}
        dismissedCount={Object.keys(dismissedHelpCards).length}
        tr={tr}
        onSearchChange={setHelpSearch}
        onClose={() => setIsHelpDrawerOpen(false)}
        onRestore={restoreHelpCards}
      />
    </>
  );
}
