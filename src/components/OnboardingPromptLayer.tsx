import React from 'react';
import { NewUserWelcomeModal, PushPermissionPrompt } from './HelpAndOnboarding';

export function OnboardingPromptLayer({ ctx }: { ctx: any }) {
  const {
    showOnboardingGuide,
    tr,
    dismissOnboardingGuide,
    startTutorialFromOnboarding,
    showPushPermissionPrompt,
    pushSubscribeBusy,
    dismissPushPermissionPrompt,
    enablePushNotificationsFromPrompt,
  } = ctx;

  return (
    <>
      <NewUserWelcomeModal
        open={showOnboardingGuide}
        tr={tr}
        onDismiss={dismissOnboardingGuide}
        onStartTutorial={startTutorialFromOnboarding}
      />
      <PushPermissionPrompt
        open={showPushPermissionPrompt}
        busy={pushSubscribeBusy}
        tr={tr}
        onDismiss={dismissPushPermissionPrompt}
        onEnable={() => void enablePushNotificationsFromPrompt()}
      />
    </>
  );
}
