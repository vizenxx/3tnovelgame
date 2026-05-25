import { ChevronLeft } from 'lucide-react';

export const BackNavButton = ({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[2300] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-app-border bg-app-surface/85 text-app-muted shadow-xl backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:border-app-accent hover:text-app-text active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 sm:left-6 ${className}`}
  >
    <ChevronLeft className="h-5 w-5" />
    <span className="sr-only">{label}</span>
  </button>
);
