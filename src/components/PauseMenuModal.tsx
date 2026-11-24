import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Download,
  Flag,
  Gavel,
  HeartPulse,
  Home,
  MoreHorizontal,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Timer,
  Tv,
  UserCheck,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  MatchState,
  MatchTerminationReason,
  PauseEventType,
  PauseReason,
  Player,
  Side,
} from '../types/match';
import { getMatchCategoryDisplay } from '../utils/bwfEngine';
import {
  exportMatchAsJSON,
  PauseDraftState,
  PauseSubView,
} from '../utils/storage';

type UmpireRulingId =
  | 'serviceFault'
  | 'lineOverrule'
  | 'yellowCard'
  | 'redCard'
  | 'blackCard'
  | 'medical'
  | 'walkover'
  | 'general';

interface UmpireRulingDef {
  id: UmpireRulingId;
  requiresPlayer: boolean;
  endsMatchReason?: MatchTerminationReason;
  tone: 'amber' | 'yellow' | 'red' | 'black' | 'sky' | 'orange';
}

const UMPIRE_RULING_DEFS: UmpireRulingDef[] = [
  { id: 'serviceFault', requiresPlayer: false, tone: 'amber' },
  { id: 'lineOverrule', requiresPlayer: false, tone: 'amber' },
  { id: 'yellowCard', requiresPlayer: true, tone: 'yellow' },
  { id: 'redCard', requiresPlayer: true, tone: 'red' },
  {
    id: 'blackCard',
    requiresPlayer: true,
    endsMatchReason: 'Black Card',
    tone: 'black',
  },
  { id: 'medical', requiresPlayer: true, tone: 'sky' },
  {
    id: 'walkover',
    requiresPlayer: true,
    endsMatchReason: 'WO',
    tone: 'orange',
  },
  { id: 'general', requiresPlayer: false, tone: 'amber' },
];

interface PauseMenuModalProps {
  isOpen: boolean;
  matchState: MatchState;
  draft: PauseDraftState | null;
  onDraftChange: (draft: PauseDraftState) => void;
  onClose: () => void;
  onOpenAnalyse: () => void;
  onLogPauseEvent: (
    type: PauseEventType,
    detail: string,
    durationMs?: number,
    options?: {
      reasons?: PauseReason[];
      note?: string;
      toastTypeLabel?: string;
      incrementShuttle?: boolean;
      closePauseMenu?: boolean;
      playerId?: string;
      playerName?: string;
      terminateMatch?: {
        reason: MatchTerminationReason;
        playerId: string;
        playerName: string;
        offendingSide: Side;
      };
    }
  ) => void;
  onIncrementShuttle: () => void;
  onEndMatchToSetup: () => void;
}

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  isOpen,
  matchState,
  draft,
  onDraftChange,
  onClose,
  onOpenAnalyse,
  onLogPauseEvent,
  onEndMatchToSetup,
}) => {
  const { t, tList } = useI18n();
  const activeDraft: PauseDraftState = draft ?? {
    subView: 'menu',
    timerStartedAt: null,
    openedAt: null,
    selectedCleaning: false,
    selectedShuttleChange: false,
    selectedOther: false,
    otherNote: '',
  };
  const {
    subView,
    timerStartedAt,
    openedAt,
    selectedCleaning = false,
    selectedShuttleChange = false,
    selectedOther = false,
    selectedInterval = false,
    otherNote = '',
    countdownDurationSec = null,
    intervalKind = null,
    intervalGameNumber,
    intervalNextGameNumber,
    intervalPoints,
    intervalChangeOfEnds = false,
  } = activeDraft;

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedUmpireRuling, setSelectedUmpireRuling] =
    useState<UmpireRulingDef | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const swipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    isHorizontal: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const hasVibratedOvertimeRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      swipeRef.current = null;
      setSwipeOffsetX(0);
      suppressClickRef.current = false;
      hasVibratedOvertimeRef.current = false;
      setSelectedUmpireRuling(null);
      return;
    }
    hasVibratedOvertimeRef.current = false;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [isOpen, countdownDurationSec]);

  useEffect(() => {
    if (subView !== 'umpire') {
      setSelectedUmpireRuling(null);
    }
  }, [subView]);

  const setSubView = useCallback(
    (nextSubView: PauseSubView) => {
      const needsTimer = nextSubView === 'cleaning' || nextSubView === 'video';
      if (nextSubView !== 'umpire') {
        setSelectedUmpireRuling(null);
      }
      onDraftChange({
        ...activeDraft,
        subView: nextSubView,
        timerStartedAt: needsTimer ? Date.now() : null,
      });
    },
    [activeDraft, onDraftChange]
  );

  const handleSwipeBackAction = useCallback(() => {
    if (subView === 'umpire' && selectedUmpireRuling) {
      setSelectedUmpireRuling(null);
    } else if (subView !== 'menu') {
      setSubView('menu');
    } else {
      onClose();
    }
  }, [onClose, selectedUmpireRuling, setSubView, subView]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSwipeBackAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipeBackAction, isOpen]);

  const updateDraft = (patch: Partial<PauseDraftState>) => {
    onDraftChange({
      ...activeDraft,
      ...patch,
    });
  };

  const elapsedSeconds = timerStartedAt
    ? Math.max(0, Math.floor((nowMs - timerStartedAt) / 1000))
    : 0;
  const cleaningSeconds = subView === 'cleaning' ? elapsedSeconds : 0;
  const videoSeconds = subView === 'video' ? elapsedSeconds : 0;

  const lastRally = matchState.rallies[matchState.rallies.length - 1];
  const lastLandingAt = lastRally
    ? (lastRally.shots[lastRally.shots.length - 1]?.timestamp ??
      lastRally.timestamp)
    : null;
  const pauseOriginAt = lastLandingAt ?? openedAt ?? nowMs;
  const pauseDurationMs = Math.max(0, nowMs - pauseOriginAt);
  const pauseSeconds = Math.floor(pauseDurationMs / 1000);
  const matchSeconds = Math.max(
    0,
    Math.floor((nowMs - matchState.config.createdAt) / 1000)
  );

  const isCountdownActive =
    typeof countdownDurationSec === 'number' && countdownDurationSec > 0;
  const totalCountdownMs = isCountdownActive ? countdownDurationSec * 1000 : 0;
  const remainingMs = isCountdownActive
    ? totalCountdownMs - pauseDurationMs
    : 0;
  const isCountdownOvertime = isCountdownActive && remainingMs <= 0;
  const countdownDisplaySeconds = isCountdownActive
    ? isCountdownOvertime
      ? Math.floor(Math.abs(remainingMs) / 1000)
      : Math.ceil(remainingMs / 1000)
    : 0;
  const countdownProgressPct = isCountdownActive
    ? Math.max(0, Math.min(100, (remainingMs / totalCountdownMs) * 100))
    : 0;

  useEffect(() => {
    if (!isOpen || !isCountdownActive) return;
    if (remainingMs <= 0 && !hasVibratedOvertimeRef.current) {
      hasVibratedOvertimeRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate([70, 50, 70]);
      }
    }
  }, [isCountdownActive, isOpen, remainingMs]);

  if (!isOpen) return null;

  const isOtherDefaulted =
    !selectedInterval && !selectedCleaning && !selectedShuttleChange;
  const effectiveOtherActive = isOtherDefaulted || selectedOther;

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getLocalizedReasonLabel = (reason: PauseReason): string => {
    return t(`analyseModal.rallyList.pauseReasons.${reason}`);
  };

  const buildSelectedReasons = (extra?: PauseReason): PauseReason[] => {
    const reasons: PauseReason[] = [];
    if (extra) reasons.push(extra);
    if (selectedInterval) reasons.push('Interval');
    if (selectedCleaning) reasons.push('Cleaning');
    if (selectedShuttleChange) reasons.push('Shuttle Change');
    if (
      (!extra && effectiveOtherActive) ||
      (extra && selectedOther)
    ) {
      reasons.push('Other');
    }
    if (reasons.length === 0) {
      reasons.push('Other');
    }
    return reasons;
  };

  const handleResumeAndLog = () => {
    const reasons = buildSelectedReasons();
    const type: PauseEventType =
      reasons.length > 1 ? 'Combined' : reasons[0];
    const trimmedNote = otherNote.trim();
    const reasonLabels = reasons.map(getLocalizedReasonLabel).join(' + ');
    const detail =
      reasons.length === 1 && reasons[0] === 'Interval'
        ? intervalKind === 'between_games'
          ? t('pauseModal.betweenGameIntervalLogDetail', {
              game: intervalGameNumber ?? Math.max(1, matchState.currentGame - 1),
              nextGame: intervalNextGameNumber ?? matchState.currentGame,
              seconds: pauseSeconds,
            })
          : t('pauseModal.midGameIntervalLogDetail', {
              points:
                intervalPoints ??
                Math.ceil(matchState.config.rules.pointsPerGame / 2),
              seconds: pauseSeconds,
            })
        : reasons.length === 1 && reasons[0] === 'Other'
          ? trimmedNote || t('pauseModal.otherLogDetail', { seconds: pauseSeconds })
          : reasons.length === 1 && reasons[0] === 'Shuttle Change'
            ? t('pauseModal.shuttleLogDetail', {
                count: matchState.shuttlesUsed + 1,
              })
            : reasons.length === 1 && reasons[0] === 'Cleaning'
              ? t('pauseModal.cleaningLogDetail', { seconds: pauseSeconds })
              : t('pauseModal.combinedLogDetail', {
                  reasons: reasonLabels,
                  seconds: pauseSeconds,
                });

    onLogPauseEvent(type, detail, pauseDurationMs, {
      reasons,
      note: trimmedNote || undefined,
      toastTypeLabel:
        reasons.length > 1 ? reasonLabels : getLocalizedReasonLabel(reasons[0]),
      incrementShuttle: selectedShuttleChange,
      closePauseMenu: true,
    });
  };

  const handleSpecialSubViewLog = (
    primaryReason: 'Umpire Call' | 'Video Call',
    primaryDetail: string,
    extra?: {
      player?: Player;
      endsMatchReason?: MatchTerminationReason;
    }
  ) => {
    const reasons = buildSelectedReasons(primaryReason);
    const type: PauseEventType =
      reasons.length > 1 ? 'Combined' : primaryReason;
    const trimmedNote = otherNote.trim();
    const reasonLabels = reasons.map(getLocalizedReasonLabel).join(' + ');

    onLogPauseEvent(type, primaryDetail, pauseDurationMs, {
      reasons,
      note: trimmedNote || undefined,
      toastTypeLabel:
        reasons.length > 1
          ? reasonLabels
          : getLocalizedReasonLabel(primaryReason),
      incrementShuttle: selectedShuttleChange,
      closePauseMenu: true,
      playerId: extra?.player?.id,
      playerName: extra?.player?.name,
      terminateMatch:
        extra?.endsMatchReason && extra.player
          ? {
              reason: extra.endsMatchReason,
              playerId: extra.player.id,
              playerName: extra.player.name,
              offendingSide: extra.player.side,
            }
          : undefined,
    });
  };

  const getRulingLabel = (id: UmpireRulingId) =>
    t(`pauseModal.umpireRulingItems.${id}`);

  const renderRulingIcon = (ruling: UmpireRulingDef) => {
    switch (ruling.id) {
      case 'yellowCard':
        return (
          <span className="h-4 w-3 shrink-0 rounded-[2px] border border-yellow-200/70 bg-yellow-400" />
        );
      case 'redCard':
        return (
          <span className="h-4 w-3 shrink-0 rounded-[2px] border border-rose-200/70 bg-rose-500" />
        );
      case 'blackCard':
        return (
          <span className="h-4 w-3 shrink-0 rounded-[2px] border border-slate-400 bg-slate-950" />
        );
      case 'medical':
        return <HeartPulse className="h-4 w-4 shrink-0 text-sky-400" />;
      case 'walkover':
        return <ShieldAlert className="h-4 w-4 shrink-0 text-orange-400" />;
      default:
        return <Flag className="h-4 w-4 shrink-0 text-amber-400" />;
    }
  };

  const videoVerdicts = tList('pauseModal.videoVerdicts');

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;

    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      isHorizontal: false,
    };
    setSwipeOffsetX(0);
  };

  const handleBackdropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = swipeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (!active.isHorizontal) {
      if (Math.abs(dy) > 16 && Math.abs(dy) >= Math.abs(dx)) {
        swipeRef.current = null;
        setSwipeOffsetX(0);
        return;
      }
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        active.isHorizontal = true;
      }
    }

    if (active.isHorizontal) {
      setSwipeOffsetX(Math.max(-160, Math.min(160, dx)));
    }
  };

  const handleBackdropPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = swipeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    swipeRef.current = null;
    setSwipeOffsetX(0);

    if (
      e.type !== 'pointercancel' &&
      Math.abs(dx) >= 55 &&
      Math.abs(dx) > Math.abs(dy) * 1.3
    ) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 100);
      if (navigator.vibrate) {
        navigator.vibrate(14);
      }
      handleSwipeBackAction();
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm touch-pan-y overscroll-x-contain"
      onPointerDown={handleBackdropPointerDown}
      onPointerMove={handleBackdropPointerMove}
      onPointerUp={handleBackdropPointerEnd}
      onPointerCancel={handleBackdropPointerEnd}
      onClickCapture={handleClickCapture}
    >
      <div
        className={`flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-emerald-800/80 bg-[#0B241E] shadow-2xl touch-pan-y overscroll-x-contain ${
          swipeOffsetX === 0 ? 'transition-transform duration-150' : ''
        }`}
        style={
          swipeOffsetX !== 0
            ? {
                transform: `translateX(${swipeOffsetX}px)`,
                opacity: Math.max(0.55, 1 - Math.abs(swipeOffsetX) / 280),
              }
            : undefined
        }
      >
        {/* Pinned Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-emerald-900/70 px-4 pt-3.5 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium text-emerald-300/90 tabular-nums sm:text-xs">
              {[
                matchState.config.tournamentName,
                matchState.config.matchName,
                matchState.config.courtName,
                getMatchCategoryDisplay(matchState.config),
                `${t('common.game')} ${matchState.currentGame} (${matchState.scoreA}–${matchState.scoreB})`,
                matchState.config.umpireName
                  ? t('setup.umpireMeta', { name: matchState.config.umpireName })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <h2 className="font-display text-xl font-bold leading-tight text-white sm:text-2xl">
              {t(`pauseModal.titles.${subView}`)}
            </h2>
          </div>
          <button
            type="button"
            onClick={subView === 'menu' ? handleResumeAndLog : onClose}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900"
            aria-label={t('pauseModal.resumeCourt')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5 sm:px-5 sm:py-3 sm:space-y-3">
          {/* Official BWF Interval & Change-of-Ends Banner */}
          {isCountdownActive && intervalKind && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-400/45 bg-teal-500/15 px-3 py-2 text-xs">
              <span className="font-bold text-teal-100">
                {intervalKind === 'between_games'
                  ? t('pauseModal.betweenGameIntervalBanner', {
                      game:
                        intervalGameNumber ??
                        Math.max(1, matchState.currentGame - 1),
                      nextGame:
                        intervalNextGameNumber ?? matchState.currentGame,
                    })
                  : t('pauseModal.midGameIntervalBanner', {
                      points:
                        intervalPoints ??
                        Math.ceil(matchState.config.rules.pointsPerGame / 2),
                      game: intervalGameNumber ?? matchState.currentGame,
                    })}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  intervalChangeOfEnds
                    ? 'border-amber-400/60 bg-amber-400/20 text-amber-200'
                    : 'border-emerald-700/70 bg-[#061814] text-emerald-200/80'
                }`}
              >
                {intervalChangeOfEnds && (
                  <ArrowLeftRight className="h-3 w-3 shrink-0" />
                )}
                {intervalChangeOfEnds
                  ? t('pauseModal.changeOfEndsBadge')
                  : t('pauseModal.sameEndsBadge')}
              </span>
            </div>
          )}

          {/* Live Pause / Rest Countdown & Match Timers */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className={`rounded-xl border bg-[#061814] px-3 py-2 ${
                isCountdownOvertime
                  ? 'border-rose-500/60'
                  : isCountdownActive
                    ? 'border-teal-400/45'
                    : 'border-amber-500/30'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider sm:text-[11px] ${
                  isCountdownOvertime
                    ? 'text-rose-300'
                    : isCountdownActive
                      ? 'text-teal-300'
                      : 'text-amber-300/90'
                }`}
              >
                <Timer className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isCountdownActive
                    ? isCountdownOvertime
                      ? t('pauseModal.restOverLabel')
                      : t('pauseModal.restRemainingLabel')
                    : t('pauseModal.pauseDurationLabel')}
                </span>
              </div>
              <div
                className={`mt-0.5 font-mono text-xl font-bold leading-tight tabular-nums sm:text-2xl ${
                  isCountdownOvertime
                    ? 'text-rose-300'
                    : isCountdownActive
                      ? 'text-teal-200'
                      : 'text-amber-200'
                }`}
              >
                {isCountdownActive
                  ? isCountdownOvertime
                    ? `+${formatTimer(countdownDisplaySeconds)}`
                    : formatTimer(countdownDisplaySeconds)
                  : formatTimer(pauseSeconds)}
              </div>
              {isCountdownActive && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-emerald-950">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isCountdownOvertime
                        ? 'bg-rose-500'
                        : countdownDisplaySeconds <= 10
                          ? 'bg-amber-400'
                          : 'bg-teal-400'
                    }`}
                    style={{ width: `${countdownProgressPct}%` }}
                  />
                </div>
              )}
              <div className="mt-0.5 text-[10px] leading-tight text-emerald-100/60">
                {isCountdownActive
                  ? lastLandingAt
                    ? t('pauseModal.countdownFromLanding', {
                        seconds: countdownDurationSec,
                      })
                    : t('pauseModal.countdownFromOpened', {
                        seconds: countdownDurationSec,
                      })
                  : lastLandingAt
                    ? t('pauseModal.pauseFromLanding')
                    : t('pauseModal.pauseFromOpened')}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-700/60 bg-[#061814] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90 sm:text-[11px]">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{t('pauseModal.matchDurationLabel')}</span>
              </div>
              <div className="mt-0.5 font-mono text-xl font-bold leading-tight tabular-nums text-white sm:text-2xl">
                {formatTimer(matchSeconds)}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-emerald-100/60 tabular-nums">
                {matchState.rallies.length} {t('common.rallies')}
              </div>
            </div>
          </div>

          {/* Main Pause Menu */}
          {subView === 'menu' && (
            <div className="space-y-2.5">
              {/* Analyse CTA */}
              <button
                type="button"
                onClick={onOpenAnalyse}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-left font-bold text-emerald-200 transition-colors hover:bg-emerald-500/25"
              >
                <BarChart3 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm leading-tight text-white">
                    {t('pauseModal.analyseTitle')}
                  </div>
                  <div className="text-[11px] font-normal leading-snug text-emerald-100/70">
                    {t('pauseModal.analyseSubtitle')}
                  </div>
                </div>
              </button>

              {/* Multi-Select Pause Reasons (Cleaning, Shuttle Change, Other default) */}
              <div className="rounded-2xl border border-emerald-900/70 bg-[#061814] p-2.5 space-y-2">
                <div className="text-[11px] font-semibold text-emerald-200/85">
                  {t('pauseModal.reasonsTitle')}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Court Cleaning */}
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({ selectedCleaning: !selectedCleaning })
                    }
                    className={`flex min-h-[42px] items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors sm:px-3 ${
                      selectedCleaning
                        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                        : 'border-emerald-800/70 bg-[#0B241E] text-emerald-100/80 hover:border-emerald-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sky-400 shrink-0" />
                      <span>{t('pauseModal.cleaning')}</span>
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selectedCleaning
                          ? 'border-sky-300 bg-sky-400 text-slate-950'
                          : 'border-emerald-700'
                      }`}
                    >
                      {selectedCleaning && (
                        <Check className="h-3 w-3 stroke-[3]" />
                      )}
                    </span>
                  </button>

                  {/* Shuttle Change (+1) */}
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        selectedShuttleChange: !selectedShuttleChange,
                      })
                    }
                    className={`flex min-h-[42px] items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors sm:px-3 ${
                      selectedShuttleChange
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-emerald-800/70 bg-[#0B241E] text-emerald-100/80 hover:border-emerald-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        <span className="block leading-tight">
                          {t('pauseModal.shuttleChange')}
                        </span>
                        <span className="block font-mono text-[10px] font-normal leading-tight text-emerald-200/75 tabular-nums">
                          {selectedShuttleChange
                            ? t('pauseModal.shuttleNextBadge', {
                                current: matchState.shuttlesUsed,
                                next: matchState.shuttlesUsed + 1,
                              })
                            : t('pauseModal.shuttlesCountBadge', {
                                count: matchState.shuttlesUsed,
                              })}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selectedShuttleChange
                          ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                          : 'border-emerald-700'
                      }`}
                    >
                      {selectedShuttleChange && (
                        <Check className="h-3 w-3 stroke-[3]" />
                      )}
                    </span>
                  </button>

                  {/* Other (Default if nothing else selected) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isOtherDefaulted) return;
                      updateDraft({ selectedOther: !selectedOther });
                    }}
                    className={`col-span-2 flex min-h-[40px] items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                      effectiveOtherActive
                        ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                        : 'border-emerald-800/70 bg-[#0B241E] text-emerald-100/80 hover:border-emerald-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MoreHorizontal className="h-4 w-4 text-amber-300 shrink-0" />
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{t('pauseModal.other')}</span>
                        {isOtherDefaulted && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                            {t('pauseModal.otherDefaultBadge')}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        effectiveOtherActive
                          ? 'border-amber-300 bg-amber-400 text-slate-950'
                          : 'border-emerald-700'
                      }`}
                    >
                      {effectiveOtherActive && (
                        <Check className="h-3 w-3 stroke-[3]" />
                      )}
                    </span>
                  </button>
                </div>

                {effectiveOtherActive && (
                  <input
                    type="text"
                    value={otherNote}
                    onChange={(e) => updateDraft({ otherNote: e.target.value })}
                    placeholder={t('pauseModal.otherNotePlaceholder')}
                    className="w-full rounded-xl border border-emerald-800/70 bg-[#0B241E] px-3 py-1.5 text-xs text-white placeholder:text-emerald-100/45 focus:border-amber-400/70 focus:outline-none"
                  />
                )}
              </div>

              {/* Special Rulings / Challenges */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubView('umpire')}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-800/70 bg-[#061814] px-3 py-2 text-left text-xs font-semibold text-white hover:border-emerald-600 sm:text-sm"
                >
                  <Gavel className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{t('pauseModal.umpireCall')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubView('video')}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-800/70 bg-[#061814] px-3 py-2 text-left text-xs font-semibold text-white hover:border-emerald-600 sm:text-sm"
                >
                  <Tv className="h-4 w-4 text-purple-300 shrink-0" />
                  <span>{t('pauseModal.videoCall')}</span>
                </button>
              </div>

              {/* Utility Row + Discrete Export JSON */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/70 pt-2">
                <button
                  type="button"
                  onClick={onEndMatchToSetup}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-800/70 px-3 text-xs font-medium text-emerald-100/80 hover:bg-emerald-950"
                >
                  <Home className="h-3.5 w-3.5" />
                  {t('pauseModal.setup')}
                </button>

                <button
                  type="button"
                  onClick={() => exportMatchAsJSON(matchState)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-emerald-300/85 hover:bg-emerald-950 hover:text-emerald-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('common.exportJson')}
                </button>
              </div>
            </div>
          )}

          {/* Umpire Call Subview */}
          {subView === 'umpire' && !selectedUmpireRuling && (
            <div className="space-y-2">
              <p className="text-xs text-emerald-100/70">
                {t('pauseModal.umpirePrompt')}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {UMPIRE_RULING_DEFS.map((ruling) => {
                  const label = getRulingLabel(ruling.id);
                  return (
                    <button
                      key={ruling.id}
                      type="button"
                      onClick={() => {
                        if (ruling.requiresPlayer) {
                          setSelectedUmpireRuling(ruling);
                        } else {
                          handleSpecialSubViewLog('Umpire Call', label);
                        }
                      }}
                      className={`flex min-h-[42px] items-center justify-between gap-2 rounded-xl border bg-[#061814] px-3.5 py-2 text-left text-xs font-semibold text-white transition-colors sm:text-sm ${
                        ruling.endsMatchReason
                          ? 'border-rose-500/45 hover:border-rose-400'
                          : 'border-emerald-800/70 hover:border-amber-400/60'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {renderRulingIcon(ruling)}
                        <span>{label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {ruling.endsMatchReason && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
                            {t('pauseModal.endsMatchTag')}
                          </span>
                        )}
                        {ruling.requiresPlayer && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200/85">
                            <UserCheck className="h-3 w-3" />
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Umpire Call -> Player Selection Step */}
          {subView === 'umpire' && selectedUmpireRuling && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-[#061814] px-3 py-2 text-xs font-bold text-white">
                {renderRulingIcon(selectedUmpireRuling)}
                <span>{getRulingLabel(selectedUmpireRuling.id)}</span>
              </div>

              {selectedUmpireRuling.endsMatchReason && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/45 bg-rose-500/15 px-3 py-2 text-[11px] font-medium text-rose-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <span>{t('pauseModal.endsMatchWarning')}</span>
                </div>
              )}

              <p className="text-xs font-semibold text-emerald-200">
                {t('pauseModal.selectPlayerPrompt')}
              </p>

              <div className="space-y-2">
                {(['A', 'B'] as Side[]).map((side) => {
                  const sidePlayers = matchState.config.players.filter(
                    (p) => p.side === side
                  );
                  if (sidePlayers.length === 0) return null;
                  const sideLabel =
                    side === 'A' ? t('setup.sideA') : t('setup.sideB');

                  return (
                    <div key={side} className="space-y-1.5">
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          side === 'A' ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {sideLabel}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {sidePlayers.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              const rulingLabel = getRulingLabel(
                                selectedUmpireRuling.id
                              );
                              handleSpecialSubViewLog(
                                'Umpire Call',
                                t('pauseModal.rulingForPlayerDetail', {
                                  ruling: rulingLabel,
                                  player: player.name,
                                }),
                                {
                                  player,
                                  endsMatchReason:
                                    selectedUmpireRuling.endsMatchReason,
                                }
                              );
                            }}
                            className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border bg-[#061814] px-3 py-2 text-left transition-colors ${
                              side === 'A'
                                ? 'border-emerald-700/70 hover:border-emerald-400'
                                : 'border-amber-700/60 hover:border-amber-400'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-white sm:text-sm">
                                {player.name}
                              </span>
                              {player.club && (
                                <span className="block truncate text-[10px] text-emerald-100/60">
                                  {player.club}
                                </span>
                              )}
                            </span>
                            <UserCheck
                              className={`h-4 w-4 shrink-0 ${
                                side === 'A'
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legacy Cleaning Subview fallback */}
          {subView === 'cleaning' && (
            <div className="space-y-4 py-2 text-center">
              <div className="font-mono text-4xl font-bold tabular-nums text-sky-300">
                {formatTimer(cleaningSeconds)}
              </div>
              <p className="text-xs text-emerald-100/75">
                {t('pauseModal.cleaningActiveDesc')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubView('menu')}
                  className="min-h-[44px] rounded-xl border border-emerald-800/70 text-sm font-semibold text-emerald-200 hover:bg-emerald-950"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLogPauseEvent(
                      'Cleaning',
                      t('pauseModal.cleaningLogDetail', {
                        seconds: cleaningSeconds || pauseSeconds,
                      }),
                      (cleaningSeconds || pauseSeconds) * 1000,
                      {
                        reasons: ['Cleaning'],
                        closePauseMenu: true,
                      }
                    )
                  }
                  className="min-h-[44px] rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  {t('pauseModal.logAndResume')}
                </button>
              </div>
            </div>
          )}

          {/* Legacy Shuttle Subview fallback */}
          {subView === 'shuttle' && (
            <div className="space-y-4 py-2 text-center">
              <div className="text-xs text-emerald-100/75">
                {t('pauseModal.shuttlesUsedSoFar')}
              </div>
              <div className="font-mono text-4xl font-bold tabular-nums text-emerald-300">
                {matchState.shuttlesUsed}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubView('menu')}
                  className="min-h-[44px] rounded-xl border border-emerald-800/70 text-sm font-semibold text-emerald-200 hover:bg-emerald-950"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLogPauseEvent(
                      'Shuttle Change',
                      t('pauseModal.shuttleLogDetail', {
                        count: matchState.shuttlesUsed + 1,
                      }),
                      pauseDurationMs,
                      {
                        reasons: ['Shuttle Change'],
                        incrementShuttle: true,
                        closePauseMenu: true,
                      }
                    )
                  }
                  className="min-h-[44px] rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  {t('pauseModal.plusOneShuttle')}
                </button>
              </div>
            </div>
          )}

          {/* Video Call Subview */}
          {subView === 'video' && (
            <div className="space-y-3 text-center">
              <div className="font-mono text-3xl font-bold tabular-nums text-purple-300">
                {formatTimer(videoSeconds)}
              </div>
              <p className="text-xs text-emerald-100/75">
                {t('pauseModal.videoPrompt')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {videoVerdicts.map((verdict) => (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() =>
                      handleSpecialSubViewLog(
                        'Video Call',
                        t('pauseModal.videoLogDetail', {
                          verdict,
                          seconds: videoSeconds,
                        })
                      )
                    }
                    className="min-h-[44px] rounded-xl border border-emerald-800/70 bg-[#061814] px-4 text-sm font-semibold text-white hover:border-purple-400/70"
                  >
                    {verdict}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pinned Footer (Always Visible) */}
        {subView === 'menu' && (
          <div className="shrink-0 border-t border-emerald-900/75 bg-[#091E19] px-4 py-2.5 sm:px-5 sm:py-3">
            <button
              type="button"
              onClick={handleResumeAndLog}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 hover:bg-emerald-400"
            >
              <Play className="h-4 w-4 fill-current" />
              {t('pauseModal.resumeAndLog')}
            </button>
            <p className="mt-1.5 text-center text-[11px] leading-tight text-emerald-100/55">
              {t('pauseModal.swipeBackToUndoHint')}
            </p>
          </div>
        )}

        {(subView === 'umpire' || subView === 'video') && (
          <div className="shrink-0 border-t border-emerald-900/75 bg-[#091E19] px-4 py-2.5 sm:px-5 sm:py-3">
            <button
              type="button"
              onClick={() => {
                if (subView === 'umpire' && selectedUmpireRuling) {
                  setSelectedUmpireRuling(null);
                } else {
                  setSubView('menu');
                }
              }}
              className="min-h-[42px] w-full rounded-xl border border-emerald-800/70 text-xs font-semibold text-emerald-200 hover:bg-emerald-950"
            >
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
