import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Eye, PauseCircle, X } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  MatchState,
  PauseEvent,
  PauseReason,
  RallyOutcome,
  RallyRecord,
  ShotType,
  Side,
} from '../types/match';
import {
  CENTER_Y,
  COURT_LENGTH,
  COURT_WIDTH,
  getMatchCategoryDisplay,
  LEFT_DOUBLES_LONG_X,
  LEFT_SHORT_SERVICE_X,
  NET_X,
  RIGHT_DOUBLES_LONG_X,
  RIGHT_SHORT_SERVICE_X,
  SINGLES_BOTTOM_Y,
  SINGLES_TOP_Y,
  VIEWBOX_H,
  VIEWBOX_W,
  VIEWBOX_X,
  VIEWBOX_Y,
} from '../utils/bwfEngine';
import { exportMatchAsJSON } from '../utils/storage';
import { RallyPreviewModal } from './RallyPreviewModal';
import { ScoreHeatGraph } from './ScoreHeatGraph';

interface AnalyseModalProps {
  isOpen: boolean;
  matchState: MatchState;
  onClose: () => void;
}

const SHOT_TYPES: ShotType[] = [
  'Smash',
  'Clear',
  'Drop',
  'Net Stop',
  'Drive',
  'Block',
  'Lift',
  'Serve',
];

export const AnalyseModal: React.FC<AnalyseModalProps> = ({
  isOpen,
  matchState,
  onClose,
}) => {
  const { t } = useI18n();
  const [filterHitter, setFilterHitter] = useState<string>('ALL');
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | RallyOutcome>(
    'ALL'
  );
  const [showAllShots, setShowAllShots] = useState(false);
  const [shotModifierFilter, setShotModifierFilter] = useState<
    'ALL' | 'STANDARD' | 'BACKHAND' | 'DECEPTION'
  >('ALL');
  const [listGameFilter, setListGameFilter] = useState<'ALL' | number>('ALL');
  const [newestFirst, setNewestFirst] = useState(false);
  const [previewRally, setPreviewRally] = useState<RallyRecord | null>(null);

  const stats = useMemo(() => {
    const getRallyFinisher = (
      r: RallyRecord
    ): { playerId: string | null; side: Side | null } => {
      if (r.outcome === 'LET') {
        return { playerId: null, side: null };
      }
      const byId = r.finishingPlayerId
        ? matchState.config.players.find((pl) => pl.id === r.finishingPlayerId)
        : undefined;
      if (byId) {
        return { playerId: byId.id, side: byId.side };
      }
      const origin =
        r.shots.length >= 2 ? r.shots[r.shots.length - 2] : r.shots[0];
      if (origin?.side) {
        return { playerId: origin.playerId, side: origin.side };
      }
      if (r.winningSide) {
        const side: Side =
          r.outcome === 'IN'
            ? r.winningSide
            : r.winningSide === 'A'
              ? 'B'
              : 'A';
        return { playerId: null, side };
      }
      return { playerId: null, side: null };
    };

    const matchesHitter = (r: RallyRecord): boolean => {
      if (filterHitter === 'ALL') return true;
      const finisher = getRallyFinisher(r);
      if (filterHitter === 'SIDE:A') return finisher.side === 'A';
      if (filterHitter === 'SIDE:B') return finisher.side === 'B';
      if (filterHitter.startsWith('PLAYER:')) {
        const targetId = filterHitter.slice('PLAYER:'.length);
        if (finisher.playerId) return finisher.playerId === targetId;
        const targetPlayer = matchState.config.players.find(
          (pl) => pl.id === targetId
        );
        return !!targetPlayer && finisher.side === targetPlayer.side;
      }
      return true;
    };

    const scoredRallies = matchState.rallies.filter((r) => r.outcome !== 'LET');
    const hitterRallies = matchState.rallies.filter(matchesHitter);
    const filteredRallies = hitterRallies.filter((r) => {
      if (filterOutcome !== 'ALL' && r.outcome !== filterOutcome) return false;
      return true;
    });

    const filteredOutcomeCounts: Record<RallyOutcome, number> = {
      IN: 0,
      OUT: 0,
      FAULT: 0,
      LET: 0,
    };
    hitterRallies.forEach((r) => {
      filteredOutcomeCounts[r.outcome] += 1;
    });

    let totalShots = 0;
    let totalGhostShots = 0;
    let totalDurationMs = 0;
    let backhandCount = 0;
    let deceptionCount = 0;

    const createEmptyCounts = () => ({
      A: 0,
      B: 0,
      wonA: 0,
      errA: 0,
      wonB: 0,
      errB: 0,
    });

    const createEmptyBreakdown = () => ({
      all: createEmptyCounts(),
      standard: createEmptyCounts(),
      backhand: createEmptyCounts(),
      deception: createEmptyCounts(),
    });

    const shotTypeCounts: Record<
      ShotType,
      ReturnType<typeof createEmptyBreakdown>
    > = {
      Smash: createEmptyBreakdown(),
      Clear: createEmptyBreakdown(),
      Drop: createEmptyBreakdown(),
      'Net Stop': createEmptyBreakdown(),
      Drive: createEmptyBreakdown(),
      Block: createEmptyBreakdown(),
      Lift: createEmptyBreakdown(),
      Serve: createEmptyBreakdown(),
    };

    const outcomeCounts: Record<RallyOutcome, number> = {
      IN: 0,
      OUT: 0,
      FAULT: 0,
      LET: 0,
    };

    const recordShotOutcome = (
      bucket: ReturnType<typeof createEmptyCounts>,
      side: Side,
      succeeded: boolean
    ) => {
      bucket[side] += 1;
      if (side === 'A') {
        if (succeeded) bucket.wonA += 1;
        else bucket.errA += 1;
      } else {
        if (succeeded) bucket.wonB += 1;
        else bucket.errB += 1;
      }
    };

    matchState.rallies.forEach((r) => {
      outcomeCounts[r.outcome] += 1;
      totalShots += r.shots.length;
      totalGhostShots += r.shots.filter((s) => s.isGhost).length;
      totalDurationMs += r.durationMs;

      if (r.outcome !== 'LET') {
        if (r.isBackhand) backhandCount += 1;
        if (r.isDeception) deceptionCount += 1;
        if (r.finishingShotType) {
          const p = r.finishingPlayerId
            ? matchState.config.players.find(
                (pl) => pl.id === r.finishingPlayerId
              )
            : undefined;
          const finisherSide: Side = p?.side ?? r.winningSide ?? 'A';
          const succeeded = r.winningSide === finisherSide;
          const group = shotTypeCounts[r.finishingShotType];

          recordShotOutcome(group.all, finisherSide, succeeded);
          if (!r.isBackhand && !r.isDeception) {
            recordShotOutcome(group.standard, finisherSide, succeeded);
          }
          if (r.isBackhand) {
            recordShotOutcome(group.backhand, finisherSide, succeeded);
          }
          if (r.isDeception) {
            recordShotOutcome(group.deception, finisherSide, succeeded);
          }
        }
      }
    });

    const avgShots =
      matchState.rallies.length > 0
        ? (totalShots / matchState.rallies.length).toFixed(1)
        : '0.0';
    const avgDurationSec =
      matchState.rallies.length > 0
        ? (totalDurationMs / matchState.rallies.length / 1000).toFixed(1)
        : '0.0';

    return {
      scoredRallies,
      filteredRallies,
      filteredOutcomeCounts,
      totalShots,
      totalGhostShots,
      avgShots,
      avgDurationSec,
      backhandCount,
      deceptionCount,
      shotTypeCounts,
      outcomeCounts,
    };
  }, [matchState, filterHitter, filterOutcome]);

  if (!isOpen) return null;

  const sideALabel = matchState.config.players
    .filter((p) => p.side === 'A')
    .map((p) => p.name)
    .join(' / ');
  const sideBLabel = matchState.config.players
    .filter((p) => p.side === 'B')
    .map((p) => p.name)
    .join(' / ');

  const getShotBucket = (type: ShotType) => {
    const b = stats.shotTypeCounts[type];
    if (shotModifierFilter === 'STANDARD') return b.standard;
    if (shotModifierFilter === 'BACKHAND') return b.backhand;
    if (shotModifierFilter === 'DECEPTION') return b.deception;
    return b.all;
  };

  const maxShotCount = Math.max(
    1,
    ...SHOT_TYPES.map((type) => {
      const bucket = getShotBucket(type);
      return bucket.A + bucket.B;
    })
  );

  const playerNameById = new Map(
    matchState.config.players.map((p) => [p.id, p.name] as const)
  );

  const availableGames = Array.from(
    new Set([
      ...matchState.rallies.map((r) => r.gameNumber),
      ...matchState.pauseEvents.map((p) => p.gameNumber),
    ])
  ).sort((a, b) => a - b);

  const effectiveGameFilter =
    listGameFilter === 'ALL' || availableGames.includes(listGameFilter)
      ? listGameFilter
      : 'ALL';

  type TimelineEntry =
    | {
        kind: 'rally';
        rally: RallyRecord;
        sortAnchor: number;
        timestamp: number;
      }
    | {
        kind: 'pause';
        pause: PauseEvent;
        sortAnchor: number;
        timestamp: number;
      };

  const resolvePauseSortAnchor = (pause: PauseEvent): number => {
    if (typeof pause.afterRallyNumber === 'number') {
      return pause.afterRallyNumber;
    }
    let anchor = 0;
    for (const r of matchState.rallies) {
      if (r.timestamp <= pause.timestamp) {
        anchor = r.rallyNumber;
      } else {
        break;
      }
    }
    return anchor;
  };

  const timelineAll: TimelineEntry[] = [
    ...matchState.rallies.map((rally) => ({
      kind: 'rally' as const,
      rally,
      sortAnchor: rally.rallyNumber,
      timestamp: rally.timestamp,
    })),
    ...matchState.pauseEvents.map((pause) => ({
      kind: 'pause' as const,
      pause,
      sortAnchor: resolvePauseSortAnchor(pause),
      timestamp: pause.timestamp,
    })),
  ].sort((a, b) => {
    if (a.sortAnchor !== b.sortAnchor) return a.sortAnchor - b.sortAnchor;
    if (a.kind !== b.kind) return a.kind === 'rally' ? -1 : 1;
    return a.timestamp - b.timestamp;
  });

  const timelineItems = timelineAll.filter((entry) =>
    effectiveGameFilter === 'ALL'
      ? true
      : entry.kind === 'rally'
        ? entry.rally.gameNumber === effectiveGameFilter
        : entry.pause.gameNumber === effectiveGameFilter
  );
  if (newestFirst) {
    timelineItems.reverse();
  }

  const visibleRallyCount = timelineItems.filter(
    (e) => e.kind === 'rally'
  ).length;
  const visiblePauseCount = timelineItems.filter(
    (e) => e.kind === 'pause'
  ).length;
  const orderedPreviewRallies = timelineItems
    .filter(
      (entry): entry is Extract<TimelineEntry, { kind: 'rally' }> =>
        entry.kind === 'rally'
    )
    .map((entry) => entry.rally);

  const getPauseReasonsList = (pause: PauseEvent): PauseReason[] => {
    if (pause.reasons && pause.reasons.length > 0) return pause.reasons;
    if (
      pause.type === 'Cleaning' ||
      pause.type === 'Shuttle Change' ||
      pause.type === 'Interval' ||
      pause.type === 'Other' ||
      pause.type === 'Umpire Call' ||
      pause.type === 'Video Call'
    ) {
      return [pause.type];
    }
    return ['Other'];
  };

  const getPauseReasonBadgeClass = (reason: PauseReason) => {
    if (reason === 'Cleaning') {
      return 'border-sky-500/40 bg-sky-500/15 text-sky-200';
    }
    if (reason === 'Shuttle Change') {
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
    }
    if (reason === 'Interval') {
      return 'border-teal-400/50 bg-teal-500/20 text-teal-200';
    }
    if (reason === 'Video Call') {
      return 'border-purple-500/40 bg-purple-500/15 text-purple-200';
    }
    return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
  };

  const formatRallyDuration = (durationMs: number) => {
    const safeMs = Math.max(0, durationMs);
    if (safeMs >= 60_000) {
      const totalSec = Math.floor(safeMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    return `${(safeMs / 1000).toFixed(1)}s`;
  };

  const getOutcomeBadgeClass = (outcome: RallyOutcome) => {
    if (outcome === 'IN') {
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
    }
    if (outcome === 'OUT') {
      return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    }
    if (outcome === 'FAULT') {
      return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
    }
    return 'border-sky-500/40 bg-sky-500/15 text-sky-300';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-emerald-800/80 bg-[#071D18] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-emerald-900/70 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-emerald-300/90 tabular-nums">
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
            <h2 className="font-display text-2xl font-bold text-white truncate">
              {t('analyseModal.title')}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportMatchAsJSON(matchState)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-800/70 bg-[#0B241E] px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-950"
            >
              <Download className="h-3.5 w-3.5" />
              {t('common.exportJson')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900"
              aria-label={t('analyseModal.closeAria')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="setup-scroll-surface flex-1 overflow-y-auto p-5 space-y-6">
          {/* Top KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-3.5">
              <div className="text-xs text-emerald-100/65">
                {t('analyseModal.kpis.ralliesLogged')}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
                {matchState.rallies.length}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-3.5">
              <div className="text-xs text-emerald-100/65">
                {t('analyseModal.kpis.avgShots')}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-300">
                {stats.avgShots}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-3.5">
              <div className="text-xs text-emerald-100/65">
                {t('analyseModal.kpis.avgDuration')}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
                {stats.avgDurationSec}s
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-3.5">
              <div className="text-xs text-emerald-100/65">
                {t('analyseModal.kpis.backhandDeception')}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-300">
                {stats.backhandCount} / {stats.deceptionCount}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-3.5 col-span-2 sm:col-span-1">
              <div className="text-xs text-emerald-100/65">
                {t('analyseModal.kpis.shuttlesGhosts')}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-200">
                {matchState.shuttlesUsed} · {stats.totalGhostShots}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Court Placement Map */}
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-4 lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  {t('analyseModal.placementMapTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAllShots((v) => !v)}
                  className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                    showAllShots
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-emerald-800/70 bg-[#061814] text-emerald-100/70'
                  }`}
                >
                  {showAllShots
                    ? t('analyseModal.showingAllStrokes')
                    : t('analyseModal.landingPointsOnly')}
                </button>
              </div>

              {/* Filter Controls: Who Hit the Last Shot + Outcome */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap rounded-lg bg-[#061814] p-0.5 border border-emerald-900/70">
                    <button
                      type="button"
                      onClick={() => setFilterHitter('ALL')}
                      className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold ${
                        filterHitter === 'ALL'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {t('analyseModal.allPlayersShots')}
                    </button>

                    {matchState.config.matchClass === 'singles' ? (
                      matchState.config.players.map((p) => {
                        const key = `PLAYER:${p.id}`;
                        const active = filterHitter === key;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFilterHitter(key)}
                            className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold ${
                              active
                                ? p.side === 'A'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-amber-400 text-slate-950'
                                : 'text-emerald-100/75 hover:text-white'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setFilterHitter('SIDE:A')}
                          className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold ${
                            filterHitter === 'SIDE:A'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-emerald-100/75 hover:text-white'
                          }`}
                        >
                          {sideALabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterHitter('SIDE:B')}
                          className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold ${
                            filterHitter === 'SIDE:B'
                              ? 'bg-amber-400 text-slate-950'
                              : 'text-emerald-100/75 hover:text-white'
                          }`}
                        >
                          {sideBLabel}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex rounded-lg bg-[#061814] p-0.5 border border-emerald-900/70">
                    {(['ALL', 'IN', 'OUT', 'FAULT'] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setFilterOutcome(o)}
                        className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold ${
                          filterOutcome === o
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-emerald-100/70 hover:text-white'
                        }`}
                      >
                        {o === 'ALL'
                          ? t('analyseModal.allOutcomes')
                          : t(`resultModal.outcomes.${o}.label`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual Player Selector for Doubles */}
                {matchState.config.matchClass === 'doubles' &&
                  matchState.config.players.length > 2 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {matchState.config.players.map((p) => {
                        const key = `PLAYER:${p.id}`;
                        const active = filterHitter === key;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setFilterHitter(active ? 'ALL' : key)
                            }
                            className={`min-h-[28px] rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? p.side === 'A'
                                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                                  : 'border-amber-400 bg-amber-400/25 text-amber-100'
                                : 'border-emerald-900/70 bg-[#061814] text-emerald-100/70 hover:text-white'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                {filterHitter !== 'ALL' && (
                  <div className="text-[11px] font-medium text-emerald-200/85">
                    {t('analyseModal.shotsByPlayer', {
                      name:
                        filterHitter === 'SIDE:A'
                          ? sideALabel
                          : filterHitter === 'SIDE:B'
                            ? sideBLabel
                            : (playerNameById.get(
                                filterHitter.slice('PLAYER:'.length)
                              ) ?? ''),
                    })}
                  </div>
                )}
              </div>

              {/* SVG Mini Analysis Court */}
              {(() => {
                const leftHalfSide = matchState.sideMapping.left;
                const rightHalfSide = matchState.sideMapping.right;
                const leftHalfLabel =
                  leftHalfSide === 'A' ? sideALabel : sideBLabel;
                const rightHalfLabel =
                  rightHalfSide === 'A' ? sideALabel : sideBLabel;

                const selectedPlayerObj = filterHitter.startsWith('PLAYER:')
                  ? matchState.config.players.find(
                      (p) => p.id === filterHitter.slice('PLAYER:'.length)
                    )
                  : undefined;

                const selectedHitterSide: Side | null =
                  filterHitter === 'SIDE:A'
                    ? 'A'
                    : filterHitter === 'SIDE:B'
                      ? 'B'
                      : (selectedPlayerObj?.side ?? null);

                const selectedHitterLabel =
                  filterHitter === 'SIDE:A'
                    ? sideALabel
                    : filterHitter === 'SIDE:B'
                      ? sideBLabel
                      : (selectedPlayerObj?.name ?? '');

                const leftSelected =
                  selectedHitterSide === null ||
                  selectedHitterSide === leftHalfSide;
                const rightSelected =
                  selectedHitterSide === null ||
                  selectedHitterSide === rightHalfSide;

                const leftColor =
                  leftHalfSide === 'A' ? '#6EE7B7' : '#FCD34D';
                const rightColor =
                  rightHalfSide === 'A' ? '#6EE7B7' : '#FCD34D';

                const activeMapSummary =
                  filterHitter === 'ALL'
                    ? t('analyseModal.allPlayersShots')
                    : t('analyseModal.shotsByPlayer', {
                        name: selectedHitterLabel,
                      });
                const outcomeSuffix =
                  filterOutcome !== 'ALL'
                    ? ` · ${t(`resultModal.outcomes.${filterOutcome}.label`)}`
                    : '';

                return (
                  <div className="overflow-hidden rounded-xl border border-emerald-800/60 bg-[#06261E]">
                    <svg
                      viewBox={`${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_W} ${VIEWBOX_H}`}
                      className="h-auto w-full"
                    >
                      <defs>
                        {(
                          [
                            { id: 'arrow-IN', color: '#34D399' },
                            { id: 'arrow-OUT', color: '#FB7185' },
                            { id: 'arrow-FAULT', color: '#FBBF24' },
                            { id: 'arrow-LET', color: '#38BDF8' },
                          ] as const
                        ).map((m) => (
                          <marker
                            key={m.id}
                            id={m.id}
                            markerWidth="14"
                            markerHeight="14"
                            refX="10"
                            refY="7"
                            orient="auto"
                            markerUnits="userSpaceOnUse"
                          >
                            <path d="M 0 1 L 12 7 L 0 13 z" fill={m.color} />
                          </marker>
                        ))}
                      </defs>

                      <rect
                        x={VIEWBOX_X}
                        y={VIEWBOX_Y}
                        width={VIEWBOX_W}
                        height={VIEWBOX_H}
                        fill="#072D24"
                      />
                      <rect
                        x={0}
                        y={0}
                        width={COURT_LENGTH}
                        height={COURT_WIDTH}
                        fill="#0E5A48"
                      />

                      {/* Player Names on Top Mat & Subtle Court Watermarks */}
                      <g pointerEvents="none" style={{ userSelect: 'none' }}>
                        <text
                          x={NET_X / 2}
                          y={-18}
                          textAnchor="middle"
                          fill={leftColor}
                          opacity={leftSelected ? 0.95 : 0.42}
                          fontSize={leftHalfLabel.length > 22 ? 19 : 23}
                          fontWeight="700"
                        >
                          {leftHalfLabel}
                        </text>
                        <text
                          x={NET_X + NET_X / 2}
                          y={-18}
                          textAnchor="middle"
                          fill={rightColor}
                          opacity={rightSelected ? 0.95 : 0.42}
                          fontSize={rightHalfLabel.length > 22 ? 19 : 23}
                          fontWeight="700"
                        >
                          {rightHalfLabel}
                        </text>

                        <text
                          x={NET_X / 2}
                          y={CENTER_Y + 12}
                          textAnchor="middle"
                          fill={leftColor}
                          opacity={leftSelected ? 0.2 : 0.08}
                          fontSize={leftHalfLabel.length > 16 ? 30 : 40}
                          fontWeight="800"
                        >
                          {leftHalfLabel}
                        </text>
                        <text
                          x={NET_X + NET_X / 2}
                          y={CENTER_Y + 12}
                          textAnchor="middle"
                          fill={rightColor}
                          opacity={rightSelected ? 0.2 : 0.08}
                          fontSize={rightHalfLabel.length > 16 ? 30 : 40}
                          fontWeight="800"
                        >
                          {rightHalfLabel}
                        </text>

                        {/* Selected Filter Label on Bottom Mat */}
                        <text
                          x={NET_X}
                          y={COURT_WIDTH + 33}
                          textAnchor="middle"
                          fill={
                            selectedHitterSide === 'A'
                              ? '#6EE7B7'
                              : selectedHitterSide === 'B'
                                ? '#FCD34D'
                                : '#E2E8F0'
                          }
                          opacity={0.92}
                          fontSize={21}
                          fontWeight="700"
                        >
                          {activeMapSummary}
                          {outcomeSuffix}
                        </text>
                      </g>

                      {/* Court Lines */}
                      <g
                        stroke="#E2E8F0"
                        strokeWidth={4}
                        fill="none"
                        opacity={0.75}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={COURT_LENGTH}
                          height={COURT_WIDTH}
                        />
                    <line
                      x1={0}
                      y1={SINGLES_TOP_Y}
                      x2={COURT_LENGTH}
                      y2={SINGLES_TOP_Y}
                    />
                    <line
                      x1={0}
                      y1={SINGLES_BOTTOM_Y}
                      x2={COURT_LENGTH}
                      y2={SINGLES_BOTTOM_Y}
                    />
                    <line
                      x1={LEFT_SHORT_SERVICE_X}
                      y1={0}
                      x2={LEFT_SHORT_SERVICE_X}
                      y2={COURT_WIDTH}
                    />
                    <line
                      x1={RIGHT_SHORT_SERVICE_X}
                      y1={0}
                      x2={RIGHT_SHORT_SERVICE_X}
                      y2={COURT_WIDTH}
                    />
                    <line
                      x1={LEFT_DOUBLES_LONG_X}
                      y1={0}
                      x2={LEFT_DOUBLES_LONG_X}
                      y2={COURT_WIDTH}
                    />
                    <line
                      x1={RIGHT_DOUBLES_LONG_X}
                      y1={0}
                      x2={RIGHT_DOUBLES_LONG_X}
                      y2={COURT_WIDTH}
                    />
                    <line
                      x1={0}
                      y1={CENTER_Y}
                      x2={LEFT_SHORT_SERVICE_X}
                      y2={CENTER_Y}
                    />
                    <line
                      x1={RIGHT_SHORT_SERVICE_X}
                      y1={CENTER_Y}
                      x2={COURT_LENGTH}
                      y2={CENTER_Y}
                    />
                    <line
                      x1={NET_X}
                      y1={-25}
                      x2={NET_X}
                      y2={COURT_WIDTH + 25}
                      strokeWidth={6}
                      strokeDasharray="16 10"
                    />
                  </g>

                  {/* Plot shots, trajectories from origin, and landing points */}
                  {stats.filteredRallies.map((rally) => {
                    const lastShot = rally.shots[rally.shots.length - 1];
                    const originShot =
                      rally.shots.length >= 2
                        ? rally.shots[rally.shots.length - 2]
                        : null;
                    const color =
                      rally.outcome === 'IN'
                        ? '#34D399'
                        : rally.outcome === 'OUT'
                          ? '#FB7185'
                          : rally.outcome === 'FAULT'
                            ? '#FBBF24'
                            : '#38BDF8';

                    let lineEndX = lastShot?.x ?? 0;
                    let lineEndY = lastShot?.y ?? 0;
                    let canDrawArrow = false;
                    if (originShot && lastShot) {
                      const dx = lastShot.x - originShot.x;
                      const dy = lastShot.y - originShot.y;
                      const dist = Math.hypot(dx, dy);
                      if (dist > 6) {
                        const trim = dist > 28 ? 16 : 0;
                        lineEndX = lastShot.x - (dx / dist) * trim;
                        lineEndY = lastShot.y - (dy / dist) * trim;
                        canDrawArrow = true;
                      }
                    }

                    return (
                      <g key={rally.id}>
                        {showAllShots &&
                          rally.shots.map((s, idx) => {
                            const prev = idx > 0 ? rally.shots[idx - 1] : null;
                            return (
                              <g key={s.id}>
                                {prev && idx < rally.shots.length - 1 && (
                                  <line
                                    x1={prev.x}
                                    y1={prev.y}
                                    x2={s.x}
                                    y2={s.y}
                                    stroke="#E2E8F0"
                                    strokeWidth={2.5}
                                    strokeOpacity={0.28}
                                    strokeDasharray={
                                      s.isGhost || prev.isGhost
                                        ? '6 6'
                                        : undefined
                                    }
                                  />
                                )}
                                <circle
                                  cx={s.x}
                                  cy={s.y}
                                  r={s.isGhost ? 10 : 12}
                                  fill={
                                    s.isGhost
                                      ? 'none'
                                      : 'rgba(255,255,255,0.28)'
                                  }
                                  stroke={s.isGhost ? '#94A3B8' : '#F8FAFC'}
                                  strokeWidth={2}
                                  strokeDasharray={
                                    s.isGhost ? '4 4' : undefined
                                  }
                                />
                              </g>
                            );
                          })}

                        {/* Trajectory line from where finishing shot was struck */}
                        {originShot && lastShot && canDrawArrow && (
                          <line
                            x1={originShot.x}
                            y1={originShot.y}
                            x2={lineEndX}
                            y2={lineEndY}
                            stroke={color}
                            strokeWidth={4.5}
                            strokeOpacity={0.8}
                            strokeDasharray={
                              originShot.isGhost ? '10 6' : undefined
                            }
                            markerEnd={`url(#arrow-${rally.outcome})`}
                          />
                        )}

                        {/* Origin marker (where the finishing shot was hit from) */}
                        {originShot && (
                          <circle
                            cx={originShot.x}
                            cy={originShot.y}
                            r={7.5}
                            fill="#061814"
                            stroke={color}
                            strokeWidth={3}
                          />
                        )}

                        {/* Landing point marker */}
                        {lastShot && (
                          <circle
                            cx={lastShot.x}
                            cy={lastShot.y}
                            r={16}
                            fill={color}
                            fillOpacity={0.9}
                            stroke="#051A15"
                            strokeWidth={3}
                          />
                        )}
                      </g>
                    );
                  })}
                    </svg>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100/75">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    {t('resultModal.outcomes.IN.label')} (
                    {stats.filteredOutcomeCounts.IN})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    {t('resultModal.outcomes.OUT.label')} (
                    {stats.filteredOutcomeCounts.OUT})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    {t('resultModal.outcomes.FAULT.label')} (
                    {stats.filteredOutcomeCounts.FAULT})
                  </span>
                  {filterHitter === 'ALL' && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                      {t('resultModal.outcomes.LET.label')} (
                      {stats.filteredOutcomeCounts.LET})
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-emerald-100/65">
                  {t('analyseModal.originToLandingLegend')}
                </span>
              </div>
            </div>

            {/* Shot Type Breakdown */}
            <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-4 lg:col-span-5 space-y-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {t('analyseModal.finishingDistributionTitle')}
                  </h3>
                  <span className="text-[11px] font-medium text-emerald-100/65">
                    {t('analyseModal.shotSuccessLegend')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/70">
                  <span className="text-emerald-300 font-semibold">
                    {t('analyseModal.sideALabel')} {sideALabel}
                  </span>
                  <span>·</span>
                  <span className="text-amber-300 font-semibold">
                    {t('analyseModal.sideBLabel')} {sideBLabel}
                  </span>
                </div>

                {/* Modifier Filter (All / Standard / Backhand / Deception) */}
                <div className="flex flex-wrap rounded-lg border border-emerald-900/70 bg-[#061814] p-0.5">
                  {(
                    [
                      { id: 'ALL', label: t('analyseModal.shotModifierAll') },
                      {
                        id: 'STANDARD',
                        label: t('analyseModal.shotModifierStandard'),
                      },
                      {
                        id: 'BACKHAND',
                        label: t('analyseModal.shotModifierBackhand'),
                      },
                      {
                        id: 'DECEPTION',
                        label: t('analyseModal.shotModifierDeception'),
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setShotModifierFilter(tab.id)}
                      className={`min-h-[30px] flex-1 rounded-md px-2 text-xs font-semibold transition-colors ${
                        shotModifierFilter === tab.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {SHOT_TYPES.map((type) => {
                  const full = stats.shotTypeCounts[type];
                  const bucket = getShotBucket(type);
                  const countA = bucket.A;
                  const countB = bucket.B;
                  const total = countA + countB;
                  const widthA = (countA / maxShotCount) * 100;
                  const widthB = (countB / maxShotCount) * 100;

                  const subRows = [
                    {
                      key: 'standard',
                      label: t('analyseModal.shotModifierStandard'),
                      badgeClass: 'text-emerald-100/75',
                      data: full.standard,
                    },
                    {
                      key: 'backhand',
                      label: t('analyseModal.shotModifierBackhand'),
                      badgeClass: 'text-amber-300',
                      data: full.backhand,
                    },
                    {
                      key: 'deception',
                      label: t('analyseModal.shotModifierDeception'),
                      badgeClass: 'text-sky-300',
                      data: full.deception,
                    },
                  ].filter((row) => row.data.A + row.data.B > 0);

                  const showGroupedSubRows =
                    shotModifierFilter === 'ALL' &&
                    (full.backhand.A + full.backhand.B > 0 ||
                      full.deception.A + full.deception.B > 0);

                  const renderSideStat = (
                    side: Side,
                    count: number,
                    won: number,
                    err: number
                  ) => {
                    if (count === 0) {
                      return (
                        <span>
                          {side}: 0
                        </span>
                      );
                    }
                    return (
                      <span>
                        {side}: {count}{' '}
                        <span className="text-[11px]">
                          (<span className="text-emerald-300">{won}✓</span>/
                          <span className="text-rose-300">{err}✗</span>)
                        </span>
                      </span>
                    );
                  };

                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-slate-100">
                          {t(`shotTypes.${type}`)}
                        </span>
                        <span className="font-mono tabular-nums text-emerald-100/75">
                          {renderSideStat('A', countA, bucket.wonA, bucket.errA)}{' '}
                          ·{' '}
                          {renderSideStat('B', countB, bucket.wonB, bucket.errB)}{' '}
                          ({total})
                        </span>
                      </div>
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#061814]">
                        <div
                          style={{ width: `${widthA}%` }}
                          className="bg-emerald-400 transition-all"
                        />
                        <div
                          style={{ width: `${widthB}%` }}
                          className="bg-amber-400 transition-all"
                        />
                      </div>

                      {showGroupedSubRows && (
                        <div className="space-y-1 rounded-lg border border-emerald-900/50 bg-[#061814] px-2.5 py-1.5">
                          {subRows.map((sub) => {
                            const subTot = sub.data.A + sub.data.B;
                            return (
                              <div
                                key={sub.key}
                                className="flex flex-wrap items-center justify-between gap-1 text-[11px]"
                              >
                                <span className={`font-semibold ${sub.badgeClass}`}>
                                  {sub.label}
                                </span>
                                <span className="font-mono tabular-nums text-emerald-100/75">
                                  {renderSideStat(
                                    'A',
                                    sub.data.A,
                                    sub.data.wonA,
                                    sub.data.errA
                                  )}{' '}
                                  ·{' '}
                                  {renderSideStat(
                                    'B',
                                    sub.data.B,
                                    sub.data.wonB,
                                    sub.data.errB
                                  )}{' '}
                                  ({subTot})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Game-by-Game Scoreboard */}
              <div className="border-t border-emerald-900/70 pt-4">
                <h4 className="text-xs font-bold text-emerald-200">
                  {t('analyseModal.setProgressionTitle')}
                </h4>
                <div className="mt-2 space-y-1.5 text-xs tabular-nums">
                  {matchState.completedGames.map((g) => (
                    <div
                      key={g.gameNumber}
                      className="flex items-center justify-between rounded-lg bg-[#061814] px-3 py-2"
                    >
                      <span className="text-emerald-100/75">
                        {t('analyseModal.gameLabel', { game: g.gameNumber })}
                      </span>
                      <span className="font-mono font-bold text-white">
                        {g.scoreA} – {g.scoreB}
                      </span>
                    </div>
                  ))}
                  {(!matchState.matchWinner || matchState.termination) && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-700/60 bg-[#061814] px-3 py-2">
                      <span className="text-emerald-300 font-semibold">
                        {t('analyseModal.gameLabel', {
                          game: matchState.currentGame,
                        })}{' '}
                        {!matchState.matchWinner && t('analyseModal.liveSuffix')}
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        {matchState.scoreA} – {matchState.scoreB}
                      </span>
                    </div>
                  )}
                  {matchState.termination && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
                      {t(
                        `completeModal.terminationReasons.${matchState.termination.reason}`,
                        { player: matchState.termination.playerName }
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Score Momentum & Heat Graph */}
          <ScoreHeatGraph
            matchState={matchState}
            sideALabel={sideALabel}
            sideBLabel={sideBLabel}
            onPreviewRally={(rally) => setPreviewRally(rally)}
          />

          {/* Complete Rally & Pause Timeline */}
          <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {t('analyseModal.rallyList.title')}
                  </h3>
                  <span className="rounded-lg border border-emerald-800/70 bg-[#061814] px-2 py-0.5 text-[11px] font-semibold text-emerald-300 tabular-nums">
                    {visiblePauseCount > 0
                      ? t('analyseModal.rallyList.countWithPausesBadge', {
                          rallies: visibleRallyCount,
                          pauses: visiblePauseCount,
                        })
                      : t('analyseModal.rallyList.countBadge', {
                          count: visibleRallyCount,
                        })}
                  </span>
                </div>
                {visibleRallyCount > 0 && (
                  <p className="text-[11px] text-emerald-100/55">
                    {t('analyseModal.rallyPreview.tapRowHint')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {availableGames.length > 1 && (
                  <div className="flex rounded-lg border border-emerald-900/70 bg-[#061814] p-0.5">
                    <button
                      type="button"
                      onClick={() => setListGameFilter('ALL')}
                      className={`min-h-[30px] rounded-md px-2 text-xs font-semibold ${
                        effectiveGameFilter === 'ALL'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {t('analyseModal.rallyList.allGames')}
                    </button>
                    {availableGames.map((gNum) => (
                      <button
                        key={gNum}
                        type="button"
                        onClick={() => setListGameFilter(gNum)}
                        className={`min-h-[30px] rounded-md px-2 text-xs font-semibold tabular-nums ${
                          effectiveGameFilter === gNum
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-emerald-100/70 hover:text-white'
                        }`}
                      >
                        {t('analyseModal.gameLabel', { game: gNum })}
                      </button>
                    ))}
                  </div>
                )}

                {timelineAll.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNewestFirst((v) => !v)}
                    className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-emerald-800/70 bg-[#061814] px-2.5 text-xs font-semibold text-emerald-100/80 hover:border-emerald-600 hover:text-white"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-emerald-400" />
                    {newestFirst
                      ? t('analyseModal.rallyList.sortNewest')
                      : t('analyseModal.rallyList.sortOldest')}
                  </button>
                )}
              </div>
            </div>

            {timelineItems.length === 0 ? (
              <div className="rounded-xl border border-emerald-900/60 bg-[#061814] px-4 py-6 text-center text-xs text-emerald-100/60">
                {t('analyseModal.rallyList.empty')}
              </div>
            ) : (
              <>
                {/* Desktop / Tablet Table */}
                <div className="hidden overflow-x-auto rounded-xl border border-emerald-900/70 bg-[#061814] md:block">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-900/70 text-[11px] uppercase tracking-wider text-emerald-300/80">
                        <th className="px-3 py-2.5 font-semibold">
                          {t('analyseModal.rallyList.cols.rally')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold">
                          {t('analyseModal.rallyList.cols.score')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold">
                          {t('analyseModal.rallyList.cols.winner')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-right">
                          {t('analyseModal.rallyList.cols.shots')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-right">
                          {t('analyseModal.rallyList.cols.duration')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold">
                          {t('analyseModal.rallyList.cols.decidingShot')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-right">
                          <span className="sr-only">
                            {t('analyseModal.rallyPreview.buttonLabel')}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950/80">
                      {timelineItems.map((entry) => {
                        if (entry.kind === 'pause') {
                          const { pause } = entry;
                          const reasons = getPauseReasonsList(pause);
                          const secondaryNote =
                            pause.note ||
                            (pause.type === 'Umpire Call' ||
                            pause.type === 'Video Call'
                              ? pause.detail
                              : '');

                          return (
                            <tr
                              key={pause.id}
                              className="bg-amber-500/[0.06] hover:bg-amber-500/[0.11] transition-colors"
                            >
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                                  <PauseCircle className="h-3.5 w-3.5 shrink-0" />
                                  {t('analyseModal.rallyList.pauseRowBadge')}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-emerald-100/60 tabular-nums">
                                    {t('analyseModal.gameLabel', {
                                      game: pause.gameNumber,
                                    })}
                                  </span>
                                  <span className="font-mono font-bold text-amber-100 tabular-nums">
                                    {pause.scoreAtEvent.A} –{' '}
                                    {pause.scoreAtEvent.B}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {reasons.map((reason) => (
                                    <span
                                      key={reason}
                                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getPauseReasonBadgeClass(reason)}`}
                                    >
                                      {t(
                                        `analyseModal.rallyList.pauseReasons.${reason}`
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-emerald-100/45 whitespace-nowrap">
                                —
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold text-amber-200 tabular-nums whitespace-nowrap">
                                {typeof pause.durationMs === 'number'
                                  ? formatRallyDuration(pause.durationMs)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-emerald-100/80">
                                {secondaryNote || pause.detail}
                              </td>
                              <td className="px-3 py-2.5" />
                            </tr>
                          );
                        }

                        const { rally } = entry;
                        const winnerName =
                          rally.winningSide === 'A'
                            ? sideALabel
                            : rally.winningSide === 'B'
                              ? sideBLabel
                              : t('analyseModal.rallyList.noWinnerLet');
                        const finisherName = rally.finishingPlayerId
                          ? playerNameById.get(rally.finishingPlayerId)
                          : null;
                        const shotName = rally.finishingShotType
                          ? t(`shotTypes.${rally.finishingShotType}`)
                          : '—';

                        return (
                          <tr
                            key={rally.id}
                            onClick={() => setPreviewRally(rally)}
                            className="cursor-pointer hover:bg-emerald-950/55 transition-colors"
                          >
                            <td className="px-3 py-2.5 font-mono font-semibold text-emerald-100/80 tabular-nums whitespace-nowrap">
                              #{rally.rallyNumber}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-emerald-100/60 tabular-nums">
                                  {t('analyseModal.gameLabel', {
                                    game: rally.gameNumber,
                                  })}
                                </span>
                                <span className="font-mono font-bold text-white tabular-nums">
                                  {rally.scoreAfter.A} – {rally.scoreAfter.B}
                                </span>
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${getOutcomeBadgeClass(rally.outcome)}`}
                                >
                                  {t(`resultModal.outcomes.${rally.outcome}.label`)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`font-semibold ${
                                  rally.winningSide === 'A'
                                    ? 'text-emerald-300'
                                    : rally.winningSide === 'B'
                                      ? 'text-amber-300'
                                      : 'text-sky-300'
                                }`}
                              >
                                {winnerName}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-white tabular-nums whitespace-nowrap">
                              {rally.shots.length}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-emerald-100/85 tabular-nums whitespace-nowrap">
                              {formatRallyDuration(rally.durationMs)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-100">
                                  {shotName}
                                </span>
                                {rally.isBackhand && (
                                  <span className="rounded border border-emerald-800/80 bg-emerald-950/80 px-1.5 py-0.5 text-[10px] text-emerald-200">
                                    {t('resultModal.backhand')}
                                  </span>
                                )}
                                {rally.isDeception && (
                                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                                    {t('resultModal.deception')}
                                  </span>
                                )}
                                {finisherName && (
                                  <span className="text-[11px] text-emerald-100/60">
                                    ({t('analyseModal.rallyList.byPlayer', {
                                      name: finisherName,
                                    })})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewRally(rally);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/70 bg-[#0B241E] px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:border-emerald-400 hover:text-white"
                              >
                                <Eye className="h-3 w-3 text-emerald-400" />
                                {t('analyseModal.rallyPreview.buttonLabel')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-2 md:hidden">
                  {timelineItems.map((entry) => {
                    if (entry.kind === 'pause') {
                      const { pause } = entry;
                      const reasons = getPauseReasonsList(pause);
                      const secondaryNote =
                        pause.note ||
                        (pause.type === 'Umpire Call' ||
                        pause.type === 'Video Call'
                          ? pause.detail
                          : '');

                      return (
                        <div
                          key={pause.id}
                          className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                                <PauseCircle className="h-3.5 w-3.5" />
                                {t('analyseModal.rallyList.pauseRowBadge')}
                              </span>
                              <span className="text-[11px] text-emerald-100/60 tabular-nums">
                                {t('analyseModal.gameLabel', {
                                  game: pause.gameNumber,
                                })}
                              </span>
                              <span className="font-mono text-sm font-bold text-amber-100 tabular-nums">
                                {pause.scoreAtEvent.A} –{' '}
                                {pause.scoreAtEvent.B}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-semibold text-amber-200 tabular-nums">
                              {typeof pause.durationMs === 'number'
                                ? formatRallyDuration(pause.durationMs)
                                : '—'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {reasons.map((reason) => (
                              <span
                                key={reason}
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getPauseReasonBadgeClass(reason)}`}
                              >
                                {t(
                                  `analyseModal.rallyList.pauseReasons.${reason}`
                                )}
                              </span>
                            ))}
                          </div>

                          {(secondaryNote || pause.detail) && (
                            <div className="text-[11px] text-emerald-100/75">
                              {secondaryNote || pause.detail}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const { rally } = entry;
                    const winnerName =
                      rally.winningSide === 'A'
                        ? sideALabel
                        : rally.winningSide === 'B'
                          ? sideBLabel
                          : t('analyseModal.rallyList.noWinnerLet');
                    const finisherName = rally.finishingPlayerId
                      ? playerNameById.get(rally.finishingPlayerId)
                      : null;
                    const shotName = rally.finishingShotType
                      ? t(`shotTypes.${rally.finishingShotType}`)
                      : '—';

                    return (
                      <div
                        key={rally.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewRally(rally)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewRally(rally);
                          }
                        }}
                        className="cursor-pointer rounded-xl border border-emerald-900/70 bg-[#061814] p-3 space-y-2 transition-colors hover:border-emerald-500/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-200 tabular-nums">
                              #{rally.rallyNumber}
                            </span>
                            <span className="text-[11px] text-emerald-100/60 tabular-nums">
                              {t('analyseModal.gameLabel', {
                                game: rally.gameNumber,
                              })}
                            </span>
                            <span className="font-mono text-sm font-bold text-white tabular-nums">
                              {rally.scoreAfter.A} – {rally.scoreAfter.B}
                            </span>
                          </div>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getOutcomeBadgeClass(rally.outcome)}`}
                          >
                            {t(`resultModal.outcomes.${rally.outcome}.label`)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span
                            className={`font-semibold ${
                              rally.winningSide === 'A'
                                ? 'text-emerald-300'
                                : rally.winningSide === 'B'
                                  ? 'text-amber-300'
                                  : 'text-sky-300'
                            }`}
                          >
                            {winnerName}
                          </span>
                          <span className="font-mono text-emerald-100/80 tabular-nums">
                            {t('analyseModal.rallyList.shotCountLabel', {
                              count: rally.shots.length,
                            })}{' '}
                            · {formatRallyDuration(rally.durationMs)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-950/80 pt-1.5 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-emerald-100/60">
                              {t('analyseModal.rallyList.cols.decidingShot')}:
                            </span>
                            <span className="font-semibold text-slate-100">
                              {shotName}
                            </span>
                            {rally.isBackhand && (
                              <span className="rounded border border-emerald-800/80 bg-emerald-950/80 px-1.5 py-0.5 text-[10px] text-emerald-200">
                                {t('resultModal.backhand')}
                              </span>
                            )}
                            {rally.isDeception && (
                              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                                {t('resultModal.deception')}
                              </span>
                            )}
                            {finisherName && (
                              <span className="text-[11px] text-emerald-100/60">
                                ({t('analyseModal.rallyList.byPlayer', {
                                  name: finisherName,
                                })})
                              </span>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700/70 bg-[#0B241E] px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            <Eye className="h-3 w-3 text-emerald-400" />
                            {t('analyseModal.rallyPreview.buttonLabel')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <RallyPreviewModal
        rally={previewRally}
        matchState={matchState}
        orderedRallies={orderedPreviewRallies}
        sideALabel={sideALabel}
        sideBLabel={sideBLabel}
        onSelectRally={setPreviewRally}
        onClose={() => setPreviewRally(null)}
      />
    </div>
  );
};
