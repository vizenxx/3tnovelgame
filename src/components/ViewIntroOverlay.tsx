import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export type ViewIntroStep = { title: string; body: string };

type Props = {
  steps: ViewIntroStep[];
  onDone: () => void;
  /** Position above the primary bottom dock (true) or above safe-area only (false) */
  aboveDock?: boolean;
  tr: (zh: string, en: string) => string;
};

export function ViewIntroOverlay({ steps, onDone, aboveDock = true, tr }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const current = steps[stepIndex];
  if (!current) return null;
  const isLast = stepIndex === steps.length - 1;

  const advance = () => (isLast ? onDone() : setStepIndex((i) => i + 1));

  const bottomClass = aboveDock
    ? 'bottom-[calc(max(0.85rem,env(safe-area-inset-bottom))+5.8rem)]'
    : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]';

  return (
    <AnimatePresence>
      <motion.div
        key={stepIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed left-1/2 z-[2100] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 ${bottomClass}`}
      >
        <div className="rounded-[1.5rem] border border-indigo-500/30 bg-app-bg/96 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm font-black text-white leading-snug">{current.title}</p>
            <button
              type="button"
              onClick={onDone}
              aria-label={tr('跳过引导', 'Skip guide')}
              className="shrink-0 rounded-full p-1 text-app-muted transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-app-muted">{current.body}</p>
          <div className="flex items-center justify-between gap-3">
            {steps.length > 1 ? (
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      i === stepIndex ? 'w-5 bg-indigo-400' : 'w-1.5 bg-app-border'
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={advance}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-black text-white transition-colors hover:bg-indigo-500 active:scale-95"
            >
              {isLast ? tr('知道了', 'Got it') : tr('下一步', 'Next →')}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
