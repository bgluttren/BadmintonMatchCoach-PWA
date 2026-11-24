export type MobilePlatform = 'ios' | 'android' | 'desktop';

export interface InAppBrowserInfo {
  isInApp: boolean;
  appName: string | null;
  platform: MobilePlatform;
  isStandalone: boolean;
  androidIntentUrl: string | null;
}

export function buildAndroidBreakoutUrl(currentUrl: string): string | null {
  try {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const scheme = parsed.protocol.replace(':', '');
    const withoutScheme = currentUrl.replace(/^https?:\/\//i, '');
    return `intent://${withoutScheme}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`;
  } catch {
    return null;
  }
}

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isInApp: false,
      appName: null,
      platform: 'desktop',
      isStandalone: false,
      androidIntentUrl: null,
    };
  }

  const ua = navigator.userAgent || '';
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const platform: MobilePlatform = isIOS
    ? 'ios'
    : isAndroid
      ? 'android'
      : 'desktop';

  if (isStandalone) {
    return {
      isInApp: false,
      appName: null,
      platform,
      isStandalone: true,
      androidIntentUrl: null,
    };
  }

  let appName: string | null = null;

  if (/WhatsApp/i.test(ua)) {
    appName = 'WhatsApp';
  } else if (/Instagram/i.test(ua)) {
    appName = 'Instagram';
  } else if (/Barcelona/i.test(ua)) {
    appName = 'Threads';
  } else if (/Messenger/i.test(ua)) {
    appName = 'Messenger';
  } else if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) {
    appName = 'Facebook (Meta)';
  } else if (/BytedanceWebview|TikTok|musical_ly/i.test(ua)) {
    appName = 'TikTok';
  } else if (/Snapchat/i.test(ua)) {
    appName = 'Snapchat';
  } else if (/LinkedInApp/i.test(ua)) {
    appName = 'LinkedIn';
  } else if (/Line\//i.test(ua)) {
    appName = 'LINE';
  } else if (/Twitter|TwitterAndroid/i.test(ua)) {
    appName = 'X (Twitter)';
  } else if (isAndroid && /; wv\)/i.test(ua)) {
    appName = 'In-App Browser';
  } else if (isIOS && !/(Safari|CriOS|FxiOS|EdgiOS|OPiOS)\//i.test(ua)) {
    appName = 'In-App Browser';
  }

  const isInApp = appName !== null;
  const androidIntentUrl =
    isInApp && isAndroid ? buildAndroidBreakoutUrl(window.location.href) : null;

  return {
    isInApp,
    appName,
    platform,
    isStandalone: false,
    androidIntentUrl,
  };
}
