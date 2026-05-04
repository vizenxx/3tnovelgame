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
    className={`fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[2300] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/85 text-zinc-200 shadow-xl backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 sm:left-6 ${className}`}
  >
    <ChevronLeft className="h-5 w-5" />
    <span className="sr-only">{label}</span>
  </button>
);
