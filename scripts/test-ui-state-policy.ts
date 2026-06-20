import assert from 'node:assert/strict';
import {
  shouldAutoPromptForPush,
  shouldShowConnectivityDrawer,
} from '../src/uiStatePolicy';

assert.equal(
  shouldShowConnectivityDrawer({
    isOnline: true,
    manualNotice: null,
    hasListSegmentError: true,
    activeView: 'ACCOUNT_CENTER',
  }),
  false,
  'story list segment errors must not become a global drawer outside the library'
);

assert.equal(
  shouldShowConnectivityDrawer({
    isOnline: true,
    manualNotice: null,
    hasListSegmentError: true,
    activeView: 'STORY_SELECT',
  }),
  false,
  'story list segment errors should stay inline even on the library surface'
);

assert.equal(
  shouldShowConnectivityDrawer({
    isOnline: false,
    manualNotice: null,
    hasListSegmentError: false,
    activeView: 'AUTHORING',
  }),
  true,
  'true offline state should remain global'
);

assert.equal(
  shouldAutoPromptForPush({
    isSessionHydrated: true,
    hasUser: true,
    permission: 'default',
    hasDismissedPrompt: false,
  }),
  false,
  'mobile notification permission should not auto-prompt on first-run'
);

console.log('ui state policy ok');
