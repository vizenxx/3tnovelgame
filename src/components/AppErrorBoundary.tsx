import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare props: AppErrorBoundaryProps;

  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : '未知错误',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('App render boundary caught:', error, info);
  }

  private resetToHome = () => {
    window.history.replaceState({}, '', window.location.pathname);
    window.location.reload();
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-5 py-10 text-zinc-100">
        <div className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-white">页面状态已保护</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            刚才有一段资料没有正常载入，系统已拦截空白画面。你可以回到首页重新同步作品，或直接重新载入 App。
          </p>
          {this.state.message && (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 text-left text-xs leading-relaxed text-zinc-500">
              {this.state.message.slice(0, 220)}
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={this.resetToHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              回到首页
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900 active:scale-[0.98]"
            >
              <RefreshCcw className="h-4 w-4" />
              重新载入
            </button>
          </div>
        </div>
      </div>
    );
  }
}
