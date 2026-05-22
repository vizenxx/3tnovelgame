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
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setPercent(Math.round(12 + ease * 76));
    }, 120);
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
}: {
  message: string;
  title?: string;
  subtitle?: string;
}) => (
  <div className="app-boot-screen">
    <div className="app-boot-cover-main">
      <div className="app-boot-mark" aria-hidden="true">
        <img src="/pwa-icon.svg" alt="" />
      </div>
      <div className="app-boot-text">
        <div className="app-boot-label">3T Novelgame</div>
        <div className="app-boot-title">{title}</div>
        <div className="app-boot-tagline">可分享 · 可改写的互动故事引擎</div>
      </div>
    </div>
    <div className="app-boot-progress-wrap">
      <SimulatedProgressBar />
      <div className="app-boot-subtitle">{message || subtitle}</div>
    </div>
  </div>
);
