import { useEffect, useState } from 'react';

const SimulatedProgressBar = () => {
  const [width, setWidth] = useState('12%');
  const [percent, setPercent] = useState(12);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTimeout(() => setWidth('88%'), 50);
    });
    const start = Date.now();
    const dur = 6500;
    let isVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const handleVisibility = () => {
      isVisible = document.visibilityState !== 'hidden';
    };
    const interval = setInterval(() => {
      if (!isVisible) return;
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setPercent(Math.round(12 + ease * 76));
    }, 250);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <>
      <div className="app-boot-progress">
        <div
          className="app-boot-progress-fill"
          style={{ width, transitionDuration: '6500ms' }}
        />
      </div>
      <div className="app-boot-percent">{percent}%</div>
    </>
  );
};

export const StartupShell = ({
  message,
  title = 'Fate Interference',
  subtitle = 'Linking the fate archive. Please wait.',
  tagline = 'Shareable · Rewritable interactive story engine',
}: {
  message: string;
  title?: string;
  subtitle?: string;
  tagline?: string;
}) => (
  <div className="app-boot-screen">
    <div className="app-boot-cover-main">
      <div className="app-boot-mark" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="app-boot-logo-svg" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id="flowing-purple-grad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818CF8">
                <animate attributeName="stop-color" values="#818CF8; #C084FC; #6366F1; #818CF8" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#A5B4FC">
                <animate attributeName="stop-color" values="#A5B4FC; #818CF8; #C084FC; #A5B4FC" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#C084FC">
                <animate attributeName="stop-color" values="#C084FC; #6366F1; #818CF8; #C084FC" dur="4s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          <g transform="translate(4,4) scale(0.666)" stroke="url(#flowing-purple-grad)">
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/>
            <path d="m14 7 3 3"/>
            <path d="M5 6v4"/>
            <path d="M19 14v4"/>
            <path d="M10 2v2"/>
            <path d="M7 8H3"/>
            <path d="M21 16h-4"/>
            <path d="M11 3H9"/>
          </g>
        </svg>
      </div>
      <div className="app-boot-text">
        <div className="app-boot-label">3T Novelgame</div>
        <div className="app-boot-title">{title}</div>
        <div className="app-boot-tagline">{tagline}</div>
      </div>
    </div>
    <div className="app-boot-progress-wrap">
      <SimulatedProgressBar />
      <div className="app-boot-subtitle">{message || subtitle}</div>
    </div>
  </div>
);
