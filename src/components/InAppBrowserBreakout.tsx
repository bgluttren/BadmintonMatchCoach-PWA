import React, { useEffect, useState } from 'react';
import {
  Check,
  Compass,
  Copy,
  Database,
  ExternalLink,
  MoreHorizontal,
  Share,
  Smartphone,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { detectInAppBrowser, InAppBrowserInfo } from '../utils/inAppBrowser';

const DISMISS_KEY = 'badminton_match_coach_iab_dismissed_v1';

export const InAppBrowserBreakout: React.FC = () => {
  const { t } = useI18n();
  const [info, setInfo] = useState<InAppBrowserInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser();
    setInfo(detected);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // Ignore sessionStorage restrictions
    }
  }, []);

  if (!info || !info.isInApp || dismissed) {
    return null;
  }

  const handleCopyUrl = async () => {
    const url = window.location.href;
    let success = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        success = true;
      }
    } catch {
      success = false;
    }

    if (!success) {
      try {
        const input = document.createElement('input');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        input.setSelectionRange(0, url.length);
        success = document.execCommand('copy');
        document.body.removeChild(input);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore
    }
    setDismissed(true);
  };

  const appName = info.appName ?? 'In-App Browser';
  const isWhatsApp = info.appName === 'WhatsApp';
  const isIOS = info.platform === 'ios';
  const isAndroid = info.platform === 'android';
  const browserLabel = isIOS
    ? t('breakout.descriptionBrowserIOS')
    : t('breakout.descriptionBrowserAndroid');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#051A15]/95 p-4 backdrop-blur-md"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-[#0B241E] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 border border-amber-400/30">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              {t('breakout.openedInside', { appName })}
            </div>
            <h2 className="font-display text-2xl font-bold text-white leading-tight">
              {t('breakout.title')}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-emerald-100/85">
          {t('breakout.descriptionPrefix')}{' '}
          <strong className="text-white">{t('common.appName')}</strong>{' '}
          {t('breakout.descriptionMiddle', { appName })}{' '}
          <strong className="text-white">{browserLabel}</strong>{' '}
          {t('breakout.descriptionSuffix')}
        </p>

        {/* Why breakout matters (IndexedDB + PWA) */}
        <div className="mt-4 space-y-2 rounded-2xl border border-emerald-900/80 bg-[#061814] p-3.5 text-xs text-emerald-100/80">
          <div className="flex items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong className="text-white">{t('breakout.idbTitle')}</strong>{' '}
              {t('breakout.idbDesc', { appName })}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <strong className="text-white">{t('breakout.pwaTitle')}</strong>{' '}
              {t('breakout.pwaDesc')}
            </span>
          </div>
        </div>

        {/* Platform-specific breakout steps */}
        <div className="mt-4 rounded-2xl border border-emerald-800/70 bg-[#071E18] p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">
            {t('breakout.howToOpen', {
              browser: isIOS ? 'Safari' : 'Browser',
            })}
          </div>
          {isIOS ? (
            <ol className="mt-2 space-y-1.5 text-xs text-emerald-100/90">
              {isWhatsApp ? (
                <>
                  <li className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300">1.</span>
                    <span>
                      {t('breakout.iosWhatsAppStep1Pre')}{' '}
                      <Share className="inline h-3.5 w-3.5 mx-0.5 text-white" />{' '}
                      {t('breakout.iosWhatsAppStep1Mid')}{' '}
                      <Compass className="inline h-3.5 w-3.5 mx-0.5 text-white" />{' '}
                      {t('breakout.iosWhatsAppStep1Post')}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300">2.</span>
                    <span>
                      {t('breakout.iosWhatsAppStep2Pre')}{' '}
                      <strong className="text-white">
                        {t('breakout.iosWhatsAppStep2Bold1')}
                      </strong>
                      {t('breakout.iosWhatsAppStep2Mid')}{' '}
                      <strong className="text-white">
                        {t('breakout.iosWhatsAppStep2Bold2')}
                      </strong>
                      .
                    </span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300">1.</span>
                    <span>
                      {t('breakout.iosMetaStep1Pre')}{' '}
                      <MoreHorizontal className="inline h-4 w-4 mx-0.5 text-white" />{' '}
                      {t('breakout.iosMetaStep1Post')}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300">2.</span>
                    <span>
                      {t('breakout.iosMetaStep2Pre')}{' '}
                      <strong className="text-white">
                        {t('breakout.iosMetaStep2Bold')}
                      </strong>
                      {t('breakout.iosMetaStep2Post')}
                    </span>
                  </li>
                </>
              )}
            </ol>
          ) : (
            <ol className="mt-2 space-y-1.5 text-xs text-emerald-100/90">
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-300">1.</span>
                <span>
                  {t('breakout.androidStep1Pre')}{' '}
                  <strong className="text-white">
                    {t('breakout.androidStep1Bold')}
                  </strong>{' '}
                  {t('breakout.androidStep1Mid')}{' '}
                  <MoreHorizontal className="inline h-4 w-4 mx-0.5 text-white" />{' '}
                  {t('breakout.androidStep1Post')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-300">2.</span>
                <span>
                  {t('breakout.androidStep2Pre')}{' '}
                  <strong className="text-white">
                    {t('breakout.androidStep2Bold1')}
                  </strong>{' '}
                  {t('breakout.androidStep2Mid')}{' '}
                  <strong className="text-white">
                    {t('breakout.androidStep2Bold2')}
                  </strong>
                  .
                </span>
              </li>
            </ol>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          {isAndroid && info.androidIntentUrl && (
            <a
              href={info.androidIntentUrl}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition-colors hover:bg-emerald-400 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              {t('breakout.openInSystemBrowser')}
            </a>
          )}

          <button
            type="button"
            onClick={handleCopyUrl}
            className={`flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors active:scale-[0.98] ${
              isAndroid && info.androidIntentUrl
                ? 'border border-emerald-700/80 bg-[#061814] text-emerald-200 hover:bg-emerald-950'
                : 'bg-emerald-500 text-slate-950 shadow-lg hover:bg-emerald-400'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 stroke-[2.5]" />
                {t('breakout.linkCopied', {
                  browser: isIOS ? 'Safari' : 'Chrome',
                })}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t('breakout.copyLink', {
                  browser: isIOS ? 'Safari' : 'Browser',
                })}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex min-h-[40px] w-full items-center justify-center rounded-xl text-xs font-medium text-emerald-100/60 hover:text-emerald-100"
          >
            {t('breakout.continueAnyway', { appName })}
          </button>
        </div>
      </div>
    </div>
  );
};
