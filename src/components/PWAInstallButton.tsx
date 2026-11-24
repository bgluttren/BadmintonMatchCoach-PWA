import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../i18n';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useI18n();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        {t('pwa.installApp')}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-700/70 bg-emerald-950/60 px-3.5 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-900/60 whitespace-nowrap shrink-0"
        >
          <Share className="h-3.5 w-3.5" />
          {t('pwa.installOnIOS')}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-800/70 bg-[#0B241E] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-50">
                {t('pwa.iosGuideTitle')}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-emerald-100/80">
                {t('pwa.iosStep1')}{' '}
                <strong className="text-white">{t('pwa.iosStep1Bold')}</strong>{' '}
                {t('pwa.iosStep1End')}
                <br />
                {t('pwa.iosStep2')}{' '}
                <strong className="text-white">{t('pwa.iosStep2Bold')}</strong>{' '}
                {t('pwa.iosStep2End')}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
