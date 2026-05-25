import React from 'react';
import { Copy, Loader2, RefreshCcw } from 'lucide-react';

export function SummaryView({ ctx }: { ctx: any }) {
  const {
    tr,
    isGeneratingConclusion,
    generationStatus,
    storyConclusion,
    handleShareStory,
    isSharing,
    resetGame,
  } = ctx;

const renderSummaryView = () => (
  <div className="mx-auto max-w-4xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] sm:px-8">
    <div className="mb-10 text-center space-y-4">
      <div className="inline-block rounded-full bg-amber-500/10 px-4 py-1 text-[10px] font-bold tracking-[0.2em] text-amber-500 uppercase">
        {tr('命运之卷已封存', 'Fate volume sealed')}
      </div>
      <h1 className="text-4xl font-black text-white sm:text-6xl">{tr('最终命运总结', 'Final Fate Summary')}</h1>
    </div>

    <div className="relative rounded-[3rem] border border-app-border bg-app-surface/30 p-10 shadow-2xl backdrop-blur-xl sm:p-12">
      {isGeneratingConclusion ? (
        <div className="flex h-64 flex-col items-center justify-center gap-6">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-700" />
          <p className="text-sm font-bold text-app-muted">{generationStatus}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-app-surface-soft" />
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-app-muted">时空回响</h2>
              <div className="h-px flex-1 bg-app-surface-soft" />
            </div>
            <div className="prose prose-invert max-w-none text-xl font-medium leading-relaxed italic text-amber-200/90">
              {String(storyConclusion || '').split('\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <button
              onClick={handleShareStory}
              disabled={isSharing}
              className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:scale-[1.02]"
            >
              {isSharing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Copy className="h-6 w-6" />}
              分享这段命运
            </button>
            <button
              onClick={resetGame}
              className="flex items-center justify-center gap-3 rounded-2xl bg-app-surface-soft py-5 text-lg font-black text-app-text transition-all hover:bg-app-surface-soft hover:scale-[1.02]"
            >
              <RefreshCcw className="h-6 w-6" />
              开启新轮回
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);

  return renderSummaryView();
}
