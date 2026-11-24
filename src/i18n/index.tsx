import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { en } from './en';

const ACTIVE_LANG_KEY = 'badminton_match_coach_lang_active_v1';
const CACHED_PACKS_KEY = 'badminton_match_coach_lang_packs_v2';
const SITE_MANIFEST_KEY = 'badminton_match_coach_lang_manifest_v2';

export interface LanguagePackMeta {
  code: string;
  name: string;
  nativeName: string;
  url?: string;
}

export interface StoredLanguagePack {
  meta: LanguagePackMeta;
  dictionary: Record<string, unknown>;
  updatedAt: number;
}

interface ManifestResponse {
  languages?: LanguagePackMeta[];
}

interface I18nContextValue {
  lang: string;
  activeMeta: LanguagePackMeta;
  availableLanguages: LanguagePackMeta[];
  cachedCodes: string[];
  isLoadingLang: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  tList: (key: string) => string[];
  selectLanguage: (code: string) => Promise<{ ok: boolean; error?: string }>;
  loadLanguageFromUrl: (
    url: string
  ) => Promise<{ ok: boolean; meta?: LanguagePackMeta; error?: string }>;
  importLanguageFromFile: (
    file: File
  ) => Promise<{ ok: boolean; meta?: LanguagePackMeta; error?: string }>;
  refreshManifest: () => Promise<LanguagePackMeta[]>;
  downloadEnglishTemplate: () => void;
}

const BUILTIN_EN_META: LanguagePackMeta = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  url: '/locales/en.json',
};

function readActiveLangCode(): string {
  try {
    return localStorage.getItem(ACTIVE_LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

function readCachedPacks(): Record<string, StoredLanguagePack> {
  try {
    localStorage.removeItem('badminton_match_coach_lang_packs_v1');
    localStorage.removeItem('badminton_match_coach_lang_manifest_v1');
    const raw = localStorage.getItem(CACHED_PACKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredLanguagePack>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedPacks(packs: Record<string, StoredLanguagePack>): void {
  try {
    localStorage.setItem(CACHED_PACKS_KEY, JSON.stringify(packs));
  } catch {
    // Ignore quota errors
  }
}

function readCachedManifest(): LanguagePackMeta[] {
  try {
    const raw = localStorage.getItem(SITE_MANIFEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LanguagePackMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedManifest(list: LanguagePackMeta[]): void {
  try {
    localStorage.setItem(SITE_MANIFEST_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

function isValidDictionary(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.common === 'object' ||
    typeof record.setup === 'object' ||
    typeof record.court === 'object'
  );
}

function inferMetaFromPayload(
  payload: Record<string, unknown>,
  fallbackCode: string
): LanguagePackMeta {
  const rawMeta = payload._meta;
  if (rawMeta && typeof rawMeta === 'object') {
    const m = rawMeta as Record<string, unknown>;
    const code =
      typeof m.code === 'string' && m.code.trim()
        ? m.code.trim().toLowerCase()
        : fallbackCode;
    const name =
      typeof m.name === 'string' && m.name.trim()
        ? m.name.trim()
        : code.toUpperCase();
    const nativeName =
      typeof m.nativeName === 'string' && m.nativeName.trim()
        ? m.nativeName.trim()
        : name;
    return { code, name, nativeName };
  }
  return {
    code: fallbackCode,
    name: fallbackCode.toUpperCase(),
    nativeName: fallbackCode.toUpperCase(),
  };
}

function inferCodeFromPath(pathOrUrl: string): string {
  const match = pathOrUrl.match(/\/([a-z]{2,8}(?:-[a-z0-9]+)?)\.json/i);
  if (match && match[1]) return match[1].toLowerCase();
  const fileMatch = pathOrUrl.match(/^([a-z]{2,8}(?:-[a-z0-9]+)?)\.json$/i);
  if (fileMatch && fileMatch[1]) return fileMatch[1].toLowerCase();
  return `custom_${Date.now().toString(36).slice(-4)}`;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLang] = useState<string>(() => readActiveLangCode());
  const [cachedPacks, setCachedPacks] = useState<
    Record<string, StoredLanguagePack>
  >(() => readCachedPacks());
  const [manifestLanguages, setManifestLanguages] = useState<
    LanguagePackMeta[]
  >(() => readCachedManifest());
  const [isLoadingLang, setIsLoadingLang] = useState(false);

  const refreshManifest = useCallback(async (): Promise<LanguagePackMeta[]> => {
    try {
      const res = await fetch('/locales/manifest.json', { cache: 'no-store' });
      if (!res.ok) return [];
      const json = (await res.json()) as ManifestResponse;
      if (Array.isArray(json.languages)) {
        const cleaned = json.languages.filter(
          (l) => l && typeof l.code === 'string' && typeof l.name === 'string'
        );
        setManifestLanguages(cleaned);
        writeCachedManifest(cleaned);
        return cleaned;
      }
    } catch {
      // Offline or no manifest hosted — keep cached manifest
    }
    return [];
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang || 'en';
  }, [lang]);

  const activeDictionary = useMemo<Record<string, unknown>>(() => {
    if (lang === 'en') return en as unknown as Record<string, unknown>;
    return (
      cachedPacks[lang]?.dictionary ??
      (en as unknown as Record<string, unknown>)
    );
  }, [lang, cachedPacks]);

  const availableLanguages = useMemo<LanguagePackMeta[]>(() => {
    const map = new Map<string, LanguagePackMeta>();
    map.set('en', BUILTIN_EN_META);
    manifestLanguages.forEach((m) => {
      const code = m.code.toLowerCase();
      map.set(code, { ...m, code });
    });
    Object.values(cachedPacks).forEach((pack) => {
      if (!map.has(pack.meta.code)) {
        map.set(pack.meta.code, pack.meta);
      }
    });
    return Array.from(map.values());
  }, [manifestLanguages, cachedPacks]);

  const activeMeta = useMemo<LanguagePackMeta>(() => {
    return (
      availableLanguages.find((l) => l.code === lang) ??
      cachedPacks[lang]?.meta ??
      BUILTIN_EN_META
    );
  }, [availableLanguages, cachedPacks, lang]);

  const cachedCodes = useMemo(
    () => ['en', ...Object.keys(cachedPacks)],
    [cachedPacks]
  );

  const activatePack = useCallback(
    (meta: LanguagePackMeta, dictionary: Record<string, unknown>) => {
      const normalizedCode = meta.code.toLowerCase();
      const nextMeta = { ...meta, code: normalizedCode };
      setCachedPacks((prev) => {
        const updated = {
          ...prev,
          [normalizedCode]: {
            meta: nextMeta,
            dictionary,
            updatedAt: Date.now(),
          },
        };
        writeCachedPacks(updated);
        return updated;
      });
      setLang(normalizedCode);
      try {
        localStorage.setItem(ACTIVE_LANG_KEY, normalizedCode);
      } catch {
        // Ignore
      }
    },
    []
  );

  const loadLanguageFromUrl = useCallback(
    async (
      url: string,
      overrideMeta?: LanguagePackMeta
    ): Promise<{ ok: boolean; meta?: LanguagePackMeta; error?: string }> => {
      const trimmed = url.trim();
      if (!trimmed) {
        return { ok: false, error: 'URL required' };
      }
      setIsLoadingLang(true);
      try {
        const res = await fetch(trimmed, { cache: 'no-store' });
        if (!res.ok) {
          return { ok: false, error: `HTTP ${res.status}` };
        }
        const json: unknown = await res.json();
        if (!isValidDictionary(json)) {
          return { ok: false, error: 'invalid' };
        }
        const inferred = inferMetaFromPayload(json, inferCodeFromPath(trimmed));
        const finalMeta: LanguagePackMeta = {
          ...(overrideMeta ?? inferred),
          url: trimmed,
        };
        activatePack(finalMeta, json);
        return { ok: true, meta: finalMeta };
      } catch {
        return { ok: false, error: 'fetch_failed' };
      } finally {
        setIsLoadingLang(false);
      }
    },
    [activatePack]
  );

  // On mount, refresh manifest and fetch the latest active non-English pack if online
  useEffect(() => {
    let cancelled = false;
    void refreshManifest().then((list) => {
      if (cancelled) return;
      const initialCode = readActiveLangCode().toLowerCase();
      if (!initialCode || initialCode === 'en') return;
      const existingPack = readCachedPacks()[initialCode];
      const meta =
        list.find((l) => l.code.toLowerCase() === initialCode) ??
        existingPack?.meta;
      const targetUrl = meta?.url ?? `/locales/${initialCode}.json`;
      if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) return;

      void fetch(targetUrl, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && isValidDictionary(json)) {
            const finalMeta = meta ?? inferMetaFromPayload(json, initialCode);
            activatePack({ ...finalMeta, url: targetUrl }, json);
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [activatePack, refreshManifest]);

  const selectLanguage = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const normalized = code.toLowerCase();
      if (normalized === 'en') {
        setLang('en');
        try {
          localStorage.setItem(ACTIVE_LANG_KEY, 'en');
        } catch {
          // Ignore
        }
        return { ok: true };
      }

      const existing = cachedPacks[normalized];
      const meta =
        availableLanguages.find((l) => l.code === normalized) ?? existing?.meta;
      const targetUrl = meta?.url ?? `/locales/${normalized}.json`;

      if (navigator.onLine && targetUrl) {
        const result = await loadLanguageFromUrl(targetUrl, meta);
        if (result.ok) {
          return { ok: true };
        }
        if (!existing) {
          return { ok: false, error: result.error };
        }
      }

      if (existing) {
        setLang(normalized);
        try {
          localStorage.setItem(ACTIVE_LANG_KEY, normalized);
        } catch {
          // Ignore
        }
        return { ok: true };
      }

      const result = await loadLanguageFromUrl(targetUrl, meta);
      return { ok: result.ok, error: result.error };
    },
    [availableLanguages, cachedPacks, loadLanguageFromUrl]
  );

  const importLanguageFromFile = useCallback(
    async (
      file: File
    ): Promise<{ ok: boolean; meta?: LanguagePackMeta; error?: string }> => {
      setIsLoadingLang(true);
      try {
        const text = await file.text();
        const json: unknown = JSON.parse(text);
        if (!isValidDictionary(json)) {
          return { ok: false, error: 'invalid' };
        }
        const meta = inferMetaFromPayload(json, inferCodeFromPath(file.name));
        activatePack(meta, json);
        return { ok: true, meta };
      } catch {
        return { ok: false, error: 'invalid' };
      } finally {
        setIsLoadingLang(false);
      }
    },
    [activatePack]
  );

  const downloadEnglishTemplate = useCallback(() => {
    const payload = {
      _meta: BUILTIN_EN_META,
      ...en,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'en.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const fromActive = getNestedValue(activeDictionary, key);
      if (typeof fromActive === 'string') {
        return interpolate(fromActive, params);
      }
      const fromEn = getNestedValue(en, key);
      if (typeof fromEn === 'string') {
        return interpolate(fromEn, params);
      }
      return key;
    },
    [activeDictionary]
  );

  const tList = useCallback(
    (key: string): string[] => {
      const fromActive = getNestedValue(activeDictionary, key);
      if (
        Array.isArray(fromActive) &&
        fromActive.every((item) => typeof item === 'string')
      ) {
        return fromActive as string[];
      }
      const fromEn = getNestedValue(en, key);
      if (
        Array.isArray(fromEn) &&
        fromEn.every((item) => typeof item === 'string')
      ) {
        return fromEn as string[];
      }
      return [];
    },
    [activeDictionary]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      activeMeta,
      availableLanguages,
      cachedCodes,
      isLoadingLang,
      t,
      tList,
      selectLanguage,
      loadLanguageFromUrl,
      importLanguageFromFile,
      refreshManifest,
      downloadEnglishTemplate,
    }),
    [
      lang,
      activeMeta,
      availableLanguages,
      cachedCodes,
      isLoadingLang,
      t,
      tList,
      selectLanguage,
      loadLanguageFromUrl,
      importLanguageFromFile,
      refreshManifest,
      downloadEnglishTemplate,
    ]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
