import React from 'react';
import { OnboardingGuide, PushPermissionPrompt } from './HelpAndOnboarding';

export function OnboardingPromptLayer({ ctx }: { ctx: any }) {
  const {
    showOnboardingGuide,
    tr,
    dismissOnboardingGuide,
    startQuickGenerationFromOnboarding,
    showPushPermissionPrompt,
    pushSubscribeBusy,
    dismissPushPermissionPrompt,
    enablePushNotificationsFromPrompt,
  } = ctx;

const renderOnboardingGuide = () => (
  <OnboardingGuide
    open={showOnboardingGuide}
    tr={tr}
    onDismiss={dismissOnboardingGuide}
    onQuickGenerate={startQuickGenerationFromOnboarding}
  />
);
const renderPushPermissionPrompt = () => (
  <PushPermissionPrompt
    open={showPushPermissionPrompt}
    busy={pushSubscribeBusy}
    tr={tr}
    onDismiss={dismissPushPermissionPrompt}
    onEnable={() => void enablePushNotificationsFromPrompt()}
  />
);

  return (
    <>
      {renderOnboardingGuide()}
      {renderPushPermissionPrompt()}
    </>
  );
}
