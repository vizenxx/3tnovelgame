export const semanticButtonClass = (
  variant: 'primary' | 'secondary' | 'danger' | 'ghost',
  options?: { fullWidth?: boolean; compact?: boolean }
) => {
  const base = `inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:pointer-events-none disabled:opacity-50 ${
    options?.compact ? 'px-3 py-2 text-xs font-bold' : 'px-4 py-3 text-sm font-bold'
  } ${options?.fullWidth ? 'w-full' : ''}`;
  const variants = {
    primary: 'app-button-primary shadow-lg hover:shadow-xl',
    secondary: 'app-button-secondary border',
    danger: 'app-button-danger',
    ghost: 'app-button-ghost',
  };
  return `${base} ${variants[variant]}`;
};

export const semanticIconButtonClass = (variant: 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    secondary: 'app-icon-secondary',
    danger: 'app-icon-danger',
    ghost: 'app-icon-ghost',
  };
  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${variants[variant]}`;
};

export const semanticMenuButtonClass = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'ghost') => {
  const variants = {
    primary: 'text-indigo-100 hover:bg-indigo-950/60',
    secondary: 'text-emerald-100 hover:bg-emerald-950/60',
    danger: 'text-rose-100 hover:bg-rose-950/60',
    ghost: 'text-zinc-100 hover:bg-zinc-900/70',
  };
  return `flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition-all duration-150 hover:translate-x-1 active:translate-x-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]}`;
};
