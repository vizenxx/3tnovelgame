export type AppSurface =
  | 'STORY_SELECT'
  | 'ACCOUNT_CENTER'
  | 'ARCHIVE'
  | 'AUTHORING'
  | 'PLAYING'
  | 'READONLY_STORY'
  | string;

export type ConnectivityPolicyInput = {
  isOnline: boolean;
  manualNotice: unknown | null;
  hasListSegmentError: boolean;
  activeView: AppSurface;
};

export function shouldShowConnectivityDrawer(input: ConnectivityPolicyInput) {
  if (!input.isOnline) return true;
  if (input.manualNotice) return true;
  // Story-list segment failures should be rendered inline by their owning view.
  // Promoting them to a global drawer makes Profile/Create/Settings feel broken.
  return false;
}

export type PushPromptPolicyInput = {
  isSessionHydrated: boolean;
  hasUser: boolean;
  permission?: NotificationPermission | 'unsupported';
  hasDismissedPrompt: boolean;
};

export function shouldAutoPromptForPush(_input: PushPromptPolicyInput) {
  // Push notification permission is intentionally opt-in from Settings or a
  // meaningful user action. Auto-prompting on first-run competes with onboarding.
  return false;
}
