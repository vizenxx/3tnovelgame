import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { semanticIconButtonClass } from './semanticClasses';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

type PwaUpdateInfo = {
  latestVersion: string;
  isIos?: boolean;
};

export const GlobalError = ({ errorMsg }: { errorMsg: string | null }) => (
  <AnimatePresence>
    {errorMsg && (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        role="alert"
        aria-live="assertive"
        className="app-toast fixed left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-[6100] w-[min(92vw,28rem)] -translate-x-1/2 rounded-[1.5rem] px-5 py-4 text-center text-sm font-bold leading-relaxed text-app-text backdrop-blur-xl"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-indigo-400 to-sky-300" />
        <div>{errorMsg}</div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const InstallAppBanner = ({
  canInstall,
  isStandalone,
  onInstall,
}: {
  canInstall: boolean;
  isStandalone: boolean;
  onInstall: () => void;
}) => {
  const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (isStandalone) return null;
  if (!canInstall && !isIos) return null;

  return (
    <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-bold text-indigo-100">å®‰è£…åˆ°æ‰‹æœºæ¡Œé¢</div>
          <div className="text-xs leading-relaxed text-indigo-200/80">
            å®‰è£…åŽå¯åƒåŽŸç”Ÿåº”ç”¨ä¸€æ ·ä»Žæ¡Œé¢ç›´æŽ¥æ‰“å¼€ï¼ŒåŠ è½½ä¹Ÿä¼šæ›´ç¨³å®šã€‚
          </div>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-zinc-200"
        >
          ç«‹å³å®‰è£…
        </button>
      </div>
    </div>
  );
};

export const PwaUpdateModal = ({
  updateInfo,
  isApplying,
  onClose,
  onUpdate,
}: {
  updateInfo: PwaUpdateInfo | null;
  isApplying: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) => {
  if (!updateInfo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[3600] bg-black/80 backdrop-blur-sm`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-app-border p-5 shadow-2xl sm:p-6"
        >
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.35em] text-app-muted">ç‰ˆæœ¬æ›´æ–°</div>
            <h3 className="text-2xl font-black text-white">å‘çŽ°æ–°ç‰ˆ App</h3>
            <p className="text-sm leading-relaxed text-app-muted">
              å½“å‰å®‰è£…çš„ PWA ä¸æ˜¯æœ€æ–°ç‰ˆã€‚æœ€æ–°ç‰ˆæœ¬ä¸º {updateInfo.latestVersion}ï¼Œå»ºè®®çŽ°åœ¨å‡çº§åŽå†ç»§ç»­ä½¿ç”¨ã€‚
            </p>
          </div>

          {updateInfo.isIos ? (
            <div className="space-y-3 text-sm text-app-text">
              <div className="rounded-2xl border border-app-border bg-app-surface/60 p-4 space-y-2">
                <div>1. ç‚¹å‡»ä¸‹æ–¹â€œæ‰“å¼€æ›´æ–°é¡µâ€</div>
                <div>2. åœ¨ Safari ä¸­é‡æ–°æ‰“å¼€æœ¬ç«™å¹¶ç­‰å¾…é¡µé¢åŠ è½½å®Œæˆ</div>
                <div>3. å›žåˆ°ä¸»å±å¹•é‡æ–°è¿›å…¥ Appï¼›å¦‚æžœä»æœªæ›´æ–°ï¼Œå†ä»Ž Safari é‡æ–°â€œæ·»åŠ åˆ°ä¸»å±å¹•â€</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center"
                >
                  æ‰“å¼€æ›´æ–°é¡µ
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 rounded-2xl border border-app-border bg-app-surface text-app-text font-bold"
                >
                  ç¨åŽå†è¯´
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isApplying}
                className="py-3 rounded-2xl border border-app-border bg-app-surface text-app-text font-bold disabled:opacity-50"
              >
                ç¨åŽå†è¯´
              </button>
              <button
                type="button"
                onClick={onUpdate}
                disabled={isApplying}
                className="py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
              >
                {isApplying ? 'å‡çº§ä¸­...' : 'ç«‹å³å‡çº§'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
