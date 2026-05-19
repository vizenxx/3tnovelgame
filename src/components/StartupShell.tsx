import { useEffect, useState } from 'react';

const SimulatedProgressBar = () => {
  const [width, setWidth] = useState('18%');
  const [percent, setPercent] = useState(18);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTimeout(() => setWidth('86%'), 50);
    });
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setPercent(Math.min(86, Math.round(18 + (elapsed / 6000) * 68)));
    }, 180);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="app-boot-progress">
        <div
          className="app-boot-progress-fill"
          style={{ width, transitionDuration: '6000ms' }}
        />
      </div>
      <div className="app-boot-percent">{percent}%</div>
    </>
  );
};

export const StartupShell = ({ message, title = 'Fate Interference', subtitle = 'Linking the fate archive. Please wait.' }: { message: string; title?: string; subtitle?: string }) => (
  <div className="app-boot-screen">
    <div className="app-boot-cover-main">
      <div className="app-boot-mark" aria-hidden="true">
        <img src="/pwa-icon.svg" alt="" />
      </div>
      <div className="app-boot-label">3T Novelgame</div>
      <div className="app-boot-title">{title}</div>
    </div>
    <div className="app-boot-progress-wrap">
      <SimulatedProgressBar />
      <div className="app-boot-subtitle">{message || subtitle}</div>
    </div>
  </div>
);
