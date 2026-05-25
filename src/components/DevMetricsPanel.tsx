import React, { useEffect, useState } from 'react';
import {
  getApiMetricsSnapshot,
  isDevMetricsEnabled,
  resetApiMetrics,
  subscribeApiMetrics,
  type ApiMetricSnapshot,
} from '../devMetrics';

export const DevMetricsPanel = () => {
  const [visible, setVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<ApiMetricSnapshot>(() => getApiMetricsSnapshot());
  const enabled = isDevMetricsEnabled();

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeApiMetrics(() => setSnapshot(getApiMetricsSnapshot()));
  }, [enabled]);

  if (!enabled) return null;

  const latest = snapshot.recent[0];

  return (
    <div className="fixed right-3 z-[9000] text-[11px] text-zinc-100 bottom-[calc(env(safe-area-inset-bottom)+5.35rem)] sm:bottom-4">
      {visible && (
        <div className="mb-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-white/15 bg-zinc-950/90 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-100">本地 API 计量</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">只在本机记录，不写入服务器。</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-white/10 active:scale-95"
              onClick={resetApiMetrics}
            >
              清空
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.08] px-2 py-2">
              <p className="text-[10px] text-zinc-400">总数</p>
              <p className="font-semibold">{snapshot.total}</p>
            </div>
            <div className="rounded-xl bg-white/[0.08] px-2 py-2">
              <p className="text-[10px] text-zinc-400">失败</p>
              <p className="font-semibold">{snapshot.failures}</p>
            </div>
            <div className="rounded-xl bg-white/[0.08] px-2 py-2">
              <p className="text-[10px] text-zinc-400">业务</p>
              <p className="font-semibold">{snapshot.byKind.story}</p>
            </div>
            <div className="rounded-xl bg-white/[0.08] px-2 py-2">
              <p className="text-[10px] text-zinc-400">AI</p>
              <p className="font-semibold">{snapshot.byKind.ai}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-white/[0.06] p-2">
            <p className="text-[10px] text-zinc-400">平均耗时</p>
            <p className="font-semibold">{snapshot.averageMs}ms</p>
          </div>
          <div className="mt-3 max-h-44 space-y-1 overflow-auto pr-1">
            {snapshot.recent.length === 0 ? (
              <p className="rounded-xl bg-white/[0.06] px-3 py-2 text-zinc-400">还没有记录。</p>
            ) : snapshot.recent.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.06] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-200">
                    {metric.kind} · {metric.action || metric.endpoint}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">{metric.stage || metric.code || 'request'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={metric.ok ? 'text-emerald-300' : 'text-rose-300'}>{metric.ok ? 'OK' : 'ERR'}</p>
                  <p className="text-[10px] text-zinc-500">{metric.durationMs}ms</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="rounded-full border border-white/15 bg-zinc-950/80 px-3 py-2 font-semibold text-zinc-200 shadow-lg shadow-black/25 backdrop-blur-xl transition hover:bg-zinc-900 active:scale-95"
        onClick={() => setVisible((next) => !next)}
        title="本地 API 计量"
      >
        API {latest ? `${latest.durationMs}ms` : '0'}
      </button>
    </div>
  );
};
