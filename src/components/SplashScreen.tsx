import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const { t } = useI18n();
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
    }, 600);

    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, 800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  const handleDismiss = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setIsFadingOut(true);
    window.setTimeout(onComplete, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsFadingOut(true);
        window.setTimeout(onComplete, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  return (
    <div
      role="dialog"
      aria-label={t('common.appName')}
      onPointerDown={handleDismiss}
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#051A15] select-none cursor-pointer transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle Ambient Court Glow Behind Artwork */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.22),transparent_68%)]"
      />

      {/* Responsive Hero Artwork Container */}
      <div className="relative flex h-full w-full flex-col items-center justify-between px-4 py-8 sm:justify-center sm:gap-6 sm:py-10">
        <div className="relative flex w-full max-w-md flex-1 items-center justify-center sm:flex-initial">
          <div className="relative aspect-[900/1104] max-h-[68dvh] w-full overflow-hidden rounded-3xl border border-emerald-500/35 bg-[#072D24] shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
            <img
              src="./splash-portrait.png"
              alt={t('common.appName')}
              className="h-full w-full object-cover object-center"
              fetchPriority="high"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#051A15] via-[#051A15]/60 to-transparent"
            />
          </div>
        </div>

        {/* Brand Title & Progress */}
        <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t('common.appName')}
          </h1>
          <p className="mt-1 text-xs font-medium text-emerald-200/85 sm:text-sm">
            {t('common.splashSubtitle')}
          </p>

          <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-emerald-950/90">
            <div className="h-full w-full origin-left animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300" />
          </div>

          <span className="mt-2.5 text-[11px] font-medium text-emerald-100/50">
            {t('common.tapToContinue')}
          </span>
        </div>
      </div>
    </div>
  );
};
