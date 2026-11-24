import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  FileUp,
  Globe,
  Link2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    lang,
    availableLanguages,
    cachedCodes,
    isLoadingLang,
    t,
    selectLanguage,
    loadLanguageFromUrl,
    importLanguageFromFile,
    refreshManifest,
    downloadEnglishTemplate,
  } = useI18n();

  const [customUrl, setCustomUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSelect = async (code: string) => {
    setStatusMsg(null);
    const res = await selectLanguage(code);
    if (!res.ok) {
      setStatusMsg({
        type: 'error',
        text:
          res.error === 'invalid'
            ? t('languageModal.loadErrorInvalid')
            : t('languageModal.loadErrorFetch'),
      });
    }
  };

  const handleLoadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    setStatusMsg(null);
    const res = await loadLanguageFromUrl(customUrl);
    if (res.ok && res.meta) {
      setCustomUrl('');
      setStatusMsg({
        type: 'success',
        text: t('languageModal.loadSuccess', {
          name: res.meta.nativeName,
          code: res.meta.code.toUpperCase(),
        }),
      });
    } else {
      setStatusMsg({
        type: 'error',
        text:
          res.error === 'invalid'
            ? t('languageModal.loadErrorInvalid')
            : t('languageModal.loadErrorFetch'),
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatusMsg(null);
    const res = await importLanguageFromFile(file);
    if (res.ok && res.meta) {
      setStatusMsg({
        type: 'success',
        text: t('languageModal.loadSuccess', {
          name: res.meta.nativeName,
          code: res.meta.code.toUpperCase(),
        }),
      });
    } else {
      setStatusMsg({
        type: 'error',
        text: t('languageModal.loadErrorInvalid'),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-emerald-800/80 bg-[#0B241E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900/70 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold text-white truncate">
                {t('languageModal.title')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="setup-scroll-surface flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-xs leading-relaxed text-emerald-100/75">
            {t('languageModal.subtitle')}
          </p>

          {statusMsg && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-rose-400/50 bg-rose-500/15 text-rose-200'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Available Languages */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {t('languageModal.availableOnSite')}
              </span>
              <button
                type="button"
                onClick={() => void refreshManifest()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-300/80 hover:bg-emerald-950 hover:text-emerald-200"
              >
                <RefreshCw className="h-3 w-3" />
                {t('languageModal.refreshList')}
              </button>
            </div>

            <div className="space-y-2">
              {availableLanguages.map((item) => {
                const isActive = lang === item.code;
                const isCached = cachedCodes.includes(item.code);
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={isLoadingLang}
                    onClick={() => void handleSelect(item.code)}
                    className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-emerald-400 bg-emerald-500/20'
                        : 'border-emerald-900/70 bg-[#061814] hover:border-emerald-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold uppercase text-emerald-300">
                          {item.code}
                        </span>
                        <span className="text-sm font-bold text-white truncate">
                          {item.nativeName}
                        </span>
                        {item.name !== item.nativeName && (
                          <span className="text-xs text-emerald-100/60 truncate">
                            ({item.name})
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-emerald-100/60">
                        {item.code === 'en'
                          ? t('languageModal.builtInBadge')
                          : isCached
                            ? t('languageModal.cachedOfflineBadge')
                            : item.url || `/locales/${item.code}.json`}
                      </div>
                    </div>

                    {isActive && (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" />
                        {t('languageModal.activeBadge')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Load from URL */}
          <form
            onSubmit={handleLoadUrl}
            className="space-y-2 rounded-2xl border border-emerald-900/70 bg-[#061814] p-4"
          >
            <label className="block text-xs font-bold text-emerald-200">
              {t('languageModal.loadFromUrlTitle')}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={t('languageModal.loadFromUrlPlaceholder')}
                className="min-h-[42px] flex-1 rounded-xl border border-emerald-800/70 bg-[#0B241E] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoadingLang || !customUrl.trim()}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 shrink-0"
              >
                <Link2 className="h-3.5 w-3.5" />
                {isLoadingLang
                  ? t('languageModal.loading')
                  : t('languageModal.loadUrlBtn')}
              </button>
            </div>
          </form>

          {/* Local JSON Import & Template Download */}
          <div className="space-y-2.5 rounded-2xl border border-emerald-900/70 bg-[#061814] p-4">
            <div className="text-xs font-bold text-emerald-200">
              {t('languageModal.importFileTitle')}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-700/70 bg-[#0B241E] px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-950"
              >
                <FileUp className="h-3.5 w-3.5 text-emerald-400" />
                {t('languageModal.importFileBtn')}
              </button>
              <button
                type="button"
                onClick={downloadEnglishTemplate}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-700/70 bg-[#0B241E] px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-950"
              >
                <Download className="h-3.5 w-3.5 text-amber-300" />
                {t('languageModal.downloadTemplateBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
