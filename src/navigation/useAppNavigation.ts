import { useCallback, useRef, useState } from 'react';

export type AppNavigationOptions = {
  replace?: boolean;
  reset?: boolean;
};

export function useAppNavigation<TView extends string>(initialView: TView) {
  const [viewState, setViewState] = useState<TView>(initialView);
  const returnStackRef = useRef<TView[]>([]);

  const navigateTo = useCallback((nextView: TView, options: AppNavigationOptions = {}) => {
    setViewState((current) => {
      if (options.reset) {
        returnStackRef.current = [];
      } else if (!options.replace && current !== nextView) {
        const stack = returnStackRef.current;
        returnStackRef.current = stack[stack.length - 1] === current ? stack : [...stack, current];
      }
      return nextView;
    });
  }, []);

  const resetTo = useCallback((nextView: TView) => {
    returnStackRef.current = [];
    setViewState(nextView);
  }, []);

  const goBack = useCallback((fallback: TView) => {
    const previous = returnStackRef.current.pop();
    setViewState(previous || fallback);
  }, []);

  const canGoBack = () => returnStackRef.current.length > 0;

  return {
    viewState,
    setViewState,
    navigateTo,
    resetTo,
    goBack,
    canGoBack,
    returnStackRef,
  };
}
