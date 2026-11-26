import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  CourtHalf,
  MatchState,
  Player,
  RallyOutcome,
  RallyRecord,
  ServiceBox,
  Side,
} from '../types/match';
import {
  CENTER_Y,
  COURT_LENGTH,
  COURT_WIDTH,
  LEFT_DOUBLES_LONG_X,
  LEFT_SHORT_SERVICE_X,
  NET_X,
  RIGHT_DOUBLES_LONG_X,
  RIGHT_SHORT_SERVICE_X,
  SINGLES_BOTTOM_Y,
  SINGLES_TOP_Y,
} from '../utils/bwfEngine';
import {
  BWF_NET_HEIGHT_CM,
  computeRallyFlightAnalysis,
  Point2D,
  projectCourt3D,
  TILT_VIEWBOX_H,
  TILT_VIEWBOX_W,
  TILT_VIEWBOX_X,
  TILT_VIEWBOX_Y,
} from '../utils/shuttleFlight';

interface RallyPreviewModalProps {
  rally: RallyRecord | null;
  matchState: MatchState;
  orderedRallies: RallyRecord[];
  sideALabel: string;
  sideBLabel: string;
  onSelectRally: (rally: RallyRecord) => void;
  onClose: () => void;
}

export const RallyPreviewModal: React.FC<RallyPreviewModalProps> = ({
  rally,
  matchState,
  orderedRallies,
  sideALabel,
  sideBLabel,
  onSelectRally,
  onClose,
}) => {
  const { t } = useI18n();
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalShots = rally?.shots.length ?? 0;

  useEffect(() => {
    if (!rally) {
      setIsPlaying(false);
      setVisibleCount(0);
      return;
    }
    setIsPlaying(false);
    setVisibleCount(rally.shots.length);
  }, [rally]);

  useEffect(() => {
    if (!isPlaying || !rally || totalShots <= 1) return;
    if (visibleCount >= totalShots) {
      setIsPlaying(false);
      return;
    }

    const curShot = rally.shots[Math.max(0, visibleCount - 1)];
    const nextShot = rally.shots[visibleCount];
    const rawDelta =
      curShot && nextShot ? nextShot.timestamp - curShot.timestamp : 650;
    const delayMs = Math.max(380, Math.min(1150, rawDelta));

    const timer = window.setTimeout(() => {
      setVisibleCount((prev) => {
        const next = Math.min(totalShots, prev + 1);
        if (next >= totalShots) {
          setIsPlaying(false);
        }
        return next;
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, rally, totalShots, visibleCount]);

  useEffect(() => {
    if (!rally) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, rally]);

  const playerNameById = useMemo(
    () => new Map(matchState.config.players.map((p) => [p.id, p.name] as const)),
    [matchState.config.players]
  );

  const flightAnalysis = useMemo(
    () =>
      rally
        ? computeRallyFlightAnalysis(
            rally.shots,
            rally.outcome,
            rally.finishingShotType
          )
        : { nodeHeightsCm: [], segments: [] },
    [rally]
  );

  if (!rally) return null;

  const currentIdx = orderedRallies.findIndex((r) => r.id === rally.id);
  const prevRally = currentIdx > 0 ? orderedRallies[currentIdx - 1] : null;
  const nextRally =
    currentIdx >= 0 && currentIdx < orderedRallies.length - 1
      ? orderedRallies[currentIdx + 1]
      : null;

  // Determine exact court halves during THIS rally from shot #1 (since ends may switch later)
  const firstShotWithSide = rally.shots.find((s) => s.side !== null);
  const leftHalfSide: Side = firstShotWithSide?.side
    ? firstShotWithSide.courtHalf === 'left'
      ? firstShotWithSide.side
      : firstShotWithSide.side === 'A'
        ? 'B'
        : 'A'
    : matchState.sideMapping.left;
  const rightHalfSide: Side = leftHalfSide === 'A' ? 'B' : 'A';
  const leftHalfLabel = leftHalfSide === 'A' ? sideALabel : sideBLabel;
  const rightHalfLabel = rightHalfSide === 'A' ? sideALabel : sideBLabel;
  const isSingles = matchState.config.matchClass === 'singles';

  const courtPlayerPlacements = (() => {
    const servingScore =
      rally.servingSide === 'A' ? rally.scoreBefore.A : rally.scoreBefore.B;
    const activeBox: ServiceBox = servingScore % 2 === 0 ? 'right' : 'left';
    const otherBox: ServiceBox = activeBox === 'right' ? 'left' : 'right';

    const getQuadrantCenter = (half: CourtHalf, box: ServiceBox) => {
      const isTop =
        (half === 'left' && box === 'left') ||
        (half === 'right' && box === 'right');
      const minY = isSingles ? SINGLES_TOP_Y : 0;
      const maxY = isSingles ? SINGLES_BOTTOM_Y : COURT_WIDTH;
      const y = isTop ? (minY + CENTER_Y) / 2 : (CENTER_Y + maxY) / 2;
      const x = half === 'left' ? 255 : 1085;
      return { x, y };
    };

    const placements: Array<{
      player: Player;
      half: CourtHalf;
      side: Side;
      x: number;
      y: number;
      isServer: boolean;
      isReceiver: boolean;
    }> = [];

    (
      [
        { half: 'left' as CourtHalf, side: leftHalfSide },
        { half: 'right' as CourtHalf, side: rightHalfSide },
      ] as const
    ).forEach(({ half, side }) => {
      const sidePlayers = matchState.config.players.filter(
        (p) => p.side === side
      );
      if (isSingles) {
        const player = sidePlayers[0];
        if (!player) return;
        const pos = getQuadrantCenter(half, activeBox);
        placements.push({
          player,
          half,
          side,
          x: pos.x,
          y: pos.y,
          isServer:
            player.id === rally.serverId || side === rally.servingSide,
          isReceiver:
            player.id === rally.receiverId || side !== rally.servingSide,
        });
      } else {
        const keyId =
          side === rally.servingSide ? rally.serverId : rally.receiverId;
        const primary =
          sidePlayers.find((p) => p.id === keyId) ?? sidePlayers[0];
        const partner = sidePlayers.find((p) => p.id !== primary?.id);

        if (primary) {
          const pos = getQuadrantCenter(half, activeBox);
          placements.push({
            player: primary,
            half,
            side,
            x: pos.x,
            y: pos.y,
            isServer: primary.id === rally.serverId,
            isReceiver: primary.id === rally.receiverId,
          });
        }
        if (partner) {
          const pos = getQuadrantCenter(half, otherBox);
          placements.push({
            player: partner,
            half,
            side,
            x: pos.x,
            y: pos.y,
            isServer: partner.id === rally.serverId,
            isReceiver: partner.id === rally.receiverId,
          });
        }
      }
    });

    return placements;
  })();

  const activeShots = rally.shots.slice(
    0,
    Math.max(0, Math.min(totalShots, visibleCount))
  );
  const activeStepShot =
    activeShots.length > 0 ? activeShots[activeShots.length - 1] : null;

  const winnerName =
    rally.winningSide === 'A'
      ? sideALabel
      : rally.winningSide === 'B'
        ? sideBLabel
        : t('analyseModal.rallyList.noWinnerLet');

  const serverName = playerNameById.get(rally.serverId) ?? '';
  const finisherName = rally.finishingPlayerId
    ? playerNameById.get(rally.finishingPlayerId)
    : null;
  const shotName = rally.finishingShotType
    ? t(`shotTypes.${rally.finishingShotType}`)
    : '—';
  const hasFinishingShot = Boolean(rally.finishingShotType);
  const finishingShotIdx = totalShots >= 2 ? totalShots - 2 : 0;
  const modifierLabels = [
    rally.isBackhand ? t('resultModal.backhand') : null,
    rally.isDeception ? t('resultModal.deception') : null,
  ].filter((v): v is string => Boolean(v));
  const shotDetailText = hasFinishingShot
    ? [shotName, ...modifierLabels].join(' · ')
    : null;
  const outcomeLabel = t(`resultModal.outcomes.${rally.outcome}.label`);
  const activeStepIdx = activeShots.length - 1;
  const activeStepShooter = activeStepShot?.playerId
    ? playerNameById.get(activeStepShot.playerId)
    : null;
  const bottomCourtReadout =
    totalShots === 0
      ? ''
      : activeStepIdx >= finishingShotIdx || visibleCount >= totalShots
        ? shotDetailText
          ? `${t('analyseModal.rallyPreview.decidingShotPrefix')} ${shotDetailText}${finisherName ? ` · ${finisherName}` : ''} → ${outcomeLabel}`
          : `${t('analyseModal.rallyPreview.landingBadge')} → ${outcomeLabel}`
        : `#${activeStepShot?.shotNumber ?? 1}: ${
            activeStepIdx === 0
              ? `${t('analyseModal.rallyPreview.serveBadge')}${activeStepShooter ? ` · ${activeStepShooter}` : ''}`
              : activeStepShooter ||
                (activeStepShot?.side
                  ? `${t('common.side')} ${activeStepShot.side}`
                  : '')
          }`;

  const getOutcomeColor = (outcome: RallyOutcome) => {
    if (outcome === 'IN') return '#34D399';
    if (outcome === 'OUT') return '#FB7185';
    if (outcome === 'FAULT') return '#FBBF24';
    return '#38BDF8';
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

  const formatDuration = (ms: number) => {
    const safeMs = Math.max(0, ms);
    if (safeMs >= 60_000) {
      const s = Math.floor(safeMs / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    return `${(safeMs / 1000).toFixed(1)}s`;
  };

  const handleTogglePlay = () => {
    if (totalShots <= 1) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (visibleCount >= totalShots || visibleCount === 0) {
        setVisibleCount(1);
      }
      setIsPlaying(true);
    }
  };

  const outcomeColor = getOutcomeColor(rally.outcome);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-700/80 bg-[#071D18] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-emerald-900/70 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200/85 tabular-nums">
              <span className="font-semibold text-emerald-300">
                {t('analyseModal.gameLabel', { game: rally.gameNumber })}
              </span>
              <span>·</span>
              <span className="font-mono font-bold text-white">
                {t('analyseModal.rallyPreview.scoreTransition', {
                  beforeA: rally.scoreBefore.A,
                  beforeB: rally.scoreBefore.B,
                  afterA: rally.scoreAfter.A,
                  afterB: rally.scoreAfter.B,
                })}
              </span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${getOutcomeBadgeClass(rally.outcome)}`}
              >
                {t(`resultModal.outcomes.${rally.outcome}.label`)}
              </span>
            </div>
            <h3 className="mt-0.5 font-display text-xl font-bold text-white truncate sm:text-2xl">
              {t('analyseModal.rallyPreview.title', {
                rally: rally.rallyNumber,
              })}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!prevRally}
              onClick={() => prevRally && onSelectRally(prevRally)}
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-emerald-800/70 bg-[#0B241E] text-emerald-200 hover:bg-emerald-950 disabled:opacity-35 disabled:pointer-events-none"
              aria-label={t('analyseModal.rallyPreview.prevRally')}
              title={t('analyseModal.rallyPreview.prevRally')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!nextRally}
              onClick={() => nextRally && onSelectRally(nextRally)}
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-emerald-800/70 bg-[#0B241E] text-emerald-200 hover:bg-emerald-950 disabled:opacity-35 disabled:pointer-events-none"
              aria-label={t('analyseModal.rallyPreview.nextRally')}
              title={t('analyseModal.rallyPreview.nextRally')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="setup-scroll-surface flex-1 overflow-y-auto p-4 space-y-4 sm:p-5">
          {/* Rally Outcome Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/70 bg-[#0B241E] px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <span className="text-emerald-100/60">
                  {t('analyseModal.rallyPreview.winnerPrefix')}{' '}
                </span>
                <span
                  className={`font-bold ${
                    rally.winningSide === 'A'
                      ? 'text-emerald-300'
                      : rally.winningSide === 'B'
                        ? 'text-amber-300'
                        : 'text-sky-300'
                  }`}
                >
                  {winnerName}
                </span>
              </span>
              {serverName && (
                <span className="text-emerald-100/75">
                  <span className="text-emerald-100/55">
                    {t('analyseModal.rallyPreview.serverPrefix')}{' '}
                  </span>
                  <span className="font-semibold text-white">{serverName}</span>
                </span>
              )}
              <span className="text-emerald-100/75">
                <span className="text-emerald-100/55">
                  {t('analyseModal.rallyPreview.decidingShotPrefix')}{' '}
                </span>
                <span className="font-bold text-white">
                  {shotDetailText ?? '—'}
                </span>
                {hasFinishingShot && finisherName && (
                  <span className="text-emerald-100/60">
                    {' '}
                    ({t('analyseModal.rallyList.byPlayer', {
                      name: finisherName,
                    })})
                  </span>
                )}
              </span>
            </div>

            <div className="font-mono font-semibold text-emerald-200 tabular-nums">
              {t('analyseModal.rallyList.shotCountLabel', {
                count: totalShots,
              })}{' '}
              · {formatDuration(rally.durationMs)}
            </div>
          </div>

          {/* Interactive SVG Court Replay */}
          {totalShots === 0 ? (
            <div className="rounded-xl border border-emerald-900/60 bg-[#061814] px-4 py-10 text-center text-xs text-emerald-100/60">
              {t('analyseModal.rallyPreview.noShotsRecorded')}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-emerald-800/60 bg-[#062019]">
                <svg
                  viewBox={`${TILT_VIEWBOX_X} ${TILT_VIEWBOX_Y} ${TILT_VIEWBOX_W} ${TILT_VIEWBOX_H}`}
                  className="h-auto w-full"
                >
                  <defs>
                    <marker
                      id="preview-arrow-A"
                      markerWidth="13"
                      markerHeight="13"
                      refX="10"
                      refY="6.5"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M 0 1 L 11 6.5 L 0 12 z" fill="#34D399" />
                    </marker>
                    <marker
                      id="preview-arrow-B"
                      markerWidth="13"
                      markerHeight="13"
                      refX="10"
                      refY="6.5"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M 0 1 L 11 6.5 L 0 12 z" fill="#FBBF24" />
                    </marker>
                    <marker
                      id="preview-arrow-ghost"
                      markerWidth="12"
                      markerHeight="12"
                      refX="9"
                      refY="6"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M 0 1 L 10 6 L 0 11 z" fill="#CBD5E1" />
                    </marker>
                  </defs>

                  {(() => {
                    const poly = (
                      pts: Array<[number, number, number?]>
                    ): string =>
                      pts
                        .map(([px, py, pz = 0]) => {
                          const p = projectCourt3D(px, py, pz);
                          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                        })
                        .join(' ');

                    const line3D = (
                      x1: number,
                      y1: number,
                      x2: number,
                      y2: number,
                      z1 = 0,
                      z2 = 0
                    ) => {
                      const p1 = projectCourt3D(x1, y1, z1);
                      const p2 = projectCourt3D(x2, y2, z2);
                      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
                    };

                    const toSvgPath = (pts: Point2D[]): string =>
                      pts
                        .map(
                          (pt, idx) =>
                            `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
                        )
                        .join(' ');

                    const leftTopHeaderPos = projectCourt3D(NET_X / 2, -26, 0);
                    const rightTopHeaderPos = projectCourt3D(
                      NET_X + NET_X / 2,
                      -26,
                      0
                    );
                    const activeSegment =
                      activeShots.length >= 2
                        ? flightAnalysis.segments[activeShots.length - 2]
                        : null;

                    return (
                      <>
                        {/* Outer Deep Frame */}
                        <rect
                          x={TILT_VIEWBOX_X}
                          y={TILT_VIEWBOX_Y}
                          width={TILT_VIEWBOX_W}
                          height={TILT_VIEWBOX_H}
                          fill="#062019"
                        />

                        {/* Tilted 20% Surround Mat */}
                        <polygon
                          points={poly([
                            [-55, -55],
                            [COURT_LENGTH + 55, -55],
                            [COURT_LENGTH + 55, COURT_WIDTH + 55],
                            [-55, COURT_WIDTH + 55],
                          ])}
                          fill="#072D24"
                        />

                        {/* Tilted 20% Main Court Floor */}
                        <polygon
                          points={poly([
                            [0, 0],
                            [COURT_LENGTH, 0],
                            [COURT_LENGTH, COURT_WIDTH],
                            [0, COURT_WIDTH],
                          ])}
                          fill="#0E5A48"
                        />

                        {/* Singles Mode: Mute Outer Doubles Tramlines */}
                        {isSingles && (
                          <g pointerEvents="none">
                            <polygon
                              points={poly([
                                [0, 0],
                                [COURT_LENGTH, 0],
                                [COURT_LENGTH, SINGLES_TOP_Y],
                                [0, SINGLES_TOP_Y],
                              ])}
                              fill="#072D24"
                              fillOpacity={0.68}
                            />
                            <polygon
                              points={poly([
                                [0, SINGLES_BOTTOM_Y],
                                [COURT_LENGTH, SINGLES_BOTTOM_Y],
                                [COURT_LENGTH, COURT_WIDTH],
                                [0, COURT_WIDTH],
                              ])}
                              fill="#072D24"
                              fillOpacity={0.68}
                            />
                          </g>
                        )}

                        {/* Top Mat Court Half Headers */}
                        <g pointerEvents="none" style={{ userSelect: 'none' }}>
                          <text
                            x={leftTopHeaderPos.x}
                            y={leftTopHeaderPos.y}
                            textAnchor="middle"
                            fill={leftHalfSide === 'A' ? '#6EE7B7' : '#FCD34D'}
                            opacity={0.95}
                            fontSize={leftHalfLabel.length > 22 ? 18 : 21}
                            fontWeight="700"
                          >
                            {t('court.sideUpper')} {leftHalfSide} · {leftHalfLabel}
                          </text>
                          <text
                            x={rightTopHeaderPos.x}
                            y={rightTopHeaderPos.y}
                            textAnchor="middle"
                            fill={rightHalfSide === 'A' ? '#6EE7B7' : '#FCD34D'}
                            opacity={0.95}
                            fontSize={rightHalfLabel.length > 22 ? 18 : 21}
                            fontWeight="700"
                          >
                            {t('court.sideUpper')} {rightHalfSide} · {rightHalfLabel}
                          </text>
                        </g>

                        {/* Tilted BWF Court Lines */}
                        <g
                          stroke="#E2E8F0"
                          strokeWidth={3.8}
                          fill="none"
                          opacity={0.78}
                        >
                          <polygon
                            points={poly([
                              [0, 0],
                              [COURT_LENGTH, 0],
                              [COURT_LENGTH, COURT_WIDTH],
                              [0, COURT_WIDTH],
                            ])}
                          />
                          <line {...line3D(0, SINGLES_TOP_Y, COURT_LENGTH, SINGLES_TOP_Y)} />
                          <line {...line3D(0, SINGLES_BOTTOM_Y, COURT_LENGTH, SINGLES_BOTTOM_Y)} />
                          <line {...line3D(LEFT_SHORT_SERVICE_X, 0, LEFT_SHORT_SERVICE_X, COURT_WIDTH)} />
                          <line {...line3D(RIGHT_SHORT_SERVICE_X, 0, RIGHT_SHORT_SERVICE_X, COURT_WIDTH)} />
                          <line {...line3D(LEFT_DOUBLES_LONG_X, 0, LEFT_DOUBLES_LONG_X, COURT_WIDTH)} />
                          <line {...line3D(RIGHT_DOUBLES_LONG_X, 0, RIGHT_DOUBLES_LONG_X, COURT_WIDTH)} />
                          <line {...line3D(0, CENTER_Y, LEFT_SHORT_SERVICE_X, CENTER_Y)} />
                          <line {...line3D(RIGHT_SHORT_SERVICE_X, CENTER_Y, COURT_LENGTH, CENTER_Y)} />
                          <line
                            {...line3D(NET_X, 0, NET_X, COURT_WIDTH)}
                            strokeOpacity={0.45}
                            strokeDasharray="10 8"
                          />
                        </g>

                        {/* On-Court Player Names & Starting Service Box Positions */}
                        <g pointerEvents="none" style={{ userSelect: 'none' }}>
                          {courtPlayerPlacements.map((pl) => {
                            const floorPos = projectCourt3D(pl.x, pl.y, 0);
                            const roleLabel = pl.isServer
                              ? t('court.servingUpper')
                              : pl.isReceiver
                                ? t('court.receivingUpper')
                                : '';
                            const nameFill =
                              pl.side === 'A' ? '#A7F3D0' : '#FDE68A';
                            const baseSize =
                              pl.player.name.length > 18
                                ? 19
                                : pl.player.name.length > 12
                                  ? 22
                                  : 26;
                            const depthAdjust = pl.y < CENTER_Y ? 0.92 : 1.04;

                            return (
                              <g
                                key={`court_player_${pl.player.id}`}
                                transform={`translate(${floorPos.x}, ${floorPos.y})`}
                              >
                                <text
                                  x={0}
                                  y={roleLabel ? -7 : 2}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fill={nameFill}
                                  fillOpacity={0.9}
                                  fontSize={Math.round(baseSize * depthAdjust)}
                                  fontWeight="800"
                                  style={{
                                    paintOrder: 'stroke',
                                    stroke: '#051A15',
                                    strokeWidth: 6.5,
                                    strokeLinejoin: 'round',
                                  }}
                                >
                                  {pl.player.name}
                                </text>
                                {roleLabel && (
                                  <text
                                    x={0}
                                    y={15}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill={pl.isServer ? '#FBBF24' : '#CBD5E1'}
                                    fillOpacity={0.88}
                                    fontSize={13}
                                    fontWeight="700"
                                    fontFamily="JetBrains Mono, monospace"
                                    letterSpacing="0.06em"
                                    style={{
                                      paintOrder: 'stroke',
                                      stroke: '#051A15',
                                      strokeWidth: 4.5,
                                      strokeLinejoin: 'round',
                                    }}
                                  >
                                    {roleLabel}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>

                        {/* 3D Vertical Net (155 cm BWF height) */}
                        <g pointerEvents="none">
                          <polygon
                            points={poly([
                              [NET_X, 0, 32],
                              [NET_X, COURT_WIDTH, 32],
                              [NET_X, COURT_WIDTH, BWF_NET_HEIGHT_CM],
                              [NET_X, 0, BWF_NET_HEIGHT_CM],
                            ])}
                            fill="#031410"
                            fillOpacity={0.32}
                            stroke="#CBD5E1"
                            strokeOpacity={0.28}
                            strokeWidth={1.5}
                          />
                          {[0.25, 0.5, 0.75].map((frac) => (
                            <line
                              key={`net_h_${frac}`}
                              {...line3D(
                                NET_X,
                                0,
                                NET_X,
                                COURT_WIDTH,
                                32 + (BWF_NET_HEIGHT_CM - 32) * frac,
                                32 + (BWF_NET_HEIGHT_CM - 32) * frac
                              )}
                              stroke="#CBD5E1"
                              strokeOpacity={0.18}
                              strokeWidth={1.2}
                            />
                          ))}
                          {[0.2, 0.4, 0.6, 0.8].map((frac) => (
                            <line
                              key={`net_v_${frac}`}
                              {...line3D(
                                NET_X,
                                COURT_WIDTH * frac,
                                NET_X,
                                COURT_WIDTH * frac,
                                32,
                                BWF_NET_HEIGHT_CM
                              )}
                              stroke="#CBD5E1"
                              strokeOpacity={0.18}
                              strokeWidth={1.2}
                            />
                          ))}
                          {/* Net Posts */}
                          <line
                            {...line3D(NET_X, 0, NET_X, 0, 0, BWF_NET_HEIGHT_CM + 4)}
                            stroke="#E2E8F0"
                            strokeWidth={4.5}
                            strokeLinecap="round"
                          />
                          <line
                            {...line3D(
                              NET_X,
                              COURT_WIDTH,
                              NET_X,
                              COURT_WIDTH,
                              0,
                              BWF_NET_HEIGHT_CM + 4
                            )}
                            stroke="#E2E8F0"
                            strokeWidth={5.5}
                            strokeLinecap="round"
                          />
                          {/* Crisp White Top Net Tape */}
                          <line
                            {...line3D(
                              NET_X,
                              0,
                              NET_X,
                              COURT_WIDTH,
                              BWF_NET_HEIGHT_CM,
                              BWF_NET_HEIGHT_CM
                            )}
                            stroke="#F8FAFC"
                            strokeWidth={5}
                            strokeOpacity={0.92}
                          />
                        </g>

                        {/* Ground Shadow Paths for Active Shots (z = 0) */}
                        <g pointerEvents="none">
                          {flightAnalysis.segments
                            .slice(0, Math.max(0, activeShots.length - 1))
                            .map((seg) => (
                              <path
                                key={`shadow_${seg.shotId}`}
                                d={toSvgPath(seg.samples.map((s) => s.shadow))}
                                fill="none"
                                stroke="#020F0B"
                                strokeWidth={3}
                                strokeOpacity={0.45}
                                strokeDasharray="6 6"
                              />
                            ))}
                        </g>

                        {/* Ghost Preview of Remaining Future 3D Arcs (when stepping) */}
                        {flightAnalysis.segments
                          .slice(Math.max(0, activeShots.length - 1))
                          .map((futureSeg) => {
                            const targetPt =
                              futureSeg.samples[futureSeg.samples.length - 1]
                                ?.screen;
                            return (
                              <g
                                key={`future_${futureSeg.shotId}`}
                                opacity={0.18}
                                pointerEvents="none"
                              >
                                <path
                                  d={toSvgPath(
                                    futureSeg.samples.map((s) => s.screen)
                                  )}
                                  fill="none"
                                  stroke="#CBD5E1"
                                  strokeWidth={3}
                                  strokeDasharray="8 8"
                                />
                                {targetPt && (
                                  <circle
                                    cx={targetPt.x}
                                    cy={targetPt.y}
                                    r={13}
                                    fill="#051A15"
                                    stroke="#CBD5E1"
                                    strokeWidth={2}
                                  />
                                )}
                              </g>
                            );
                          })}

                        {/* Active Elevated 3D Shuttlecock Trajectories */}
                        {flightAnalysis.segments
                          .slice(0, Math.max(0, activeShots.length - 1))
                          .map((seg, segIdx, arr) => {
                            const isLatestSeg = segIdx === arr.length - 1;
                            const strokeColor = seg.isGhost
                              ? '#CBD5E1'
                              : seg.side === 'B'
                                ? '#FBBF24'
                                : '#34D399';
                            const markerId = seg.isGhost
                              ? 'preview-arrow-ghost'
                              : seg.side === 'B'
                                ? 'preview-arrow-B'
                                : 'preview-arrow-A';

                            // Trim last ~18 units so arrowhead meets marker edge cleanly
                            const pts = seg.samples.map((s) => s.screen);
                            if (pts.length >= 2) {
                              const pLast = pts[pts.length - 1];
                              const pPrev = pts[pts.length - 2];
                              const dx = pLast.x - pPrev.x;
                              const dy = pLast.y - pPrev.y;
                              const d = Math.hypot(dx, dy);
                              if (d > 24) {
                                pts[pts.length - 1] = {
                                  x: pLast.x - (dx / d) * 18,
                                  y: pLast.y - (dy / d) * 18,
                                };
                              }
                            }

                            return (
                              <path
                                key={`arc_${seg.shotId}`}
                                d={toSvgPath(pts)}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={isLatestSeg ? 5.5 : 3.8}
                                strokeOpacity={isLatestSeg ? 0.96 : 0.68}
                                strokeLinecap="round"
                                strokeDasharray={
                                  seg.isGhost ? '12 8' : undefined
                                }
                                markerEnd={`url(#${markerId})`}
                              />
                            );
                          })}

                        {/* Vertical Elevation Drop-Pins + Elevated Shot Markers */}
                        {activeShots.map((shot, idx) => {
                          const hitZ = flightAnalysis.nodeHeightsCm[idx] ?? 0;
                          const hitPos = projectCourt3D(shot.x, shot.y, hitZ);
                          const floorPos = projectCourt3D(shot.x, shot.y, 0);
                          const isFinalLanding = idx === totalShots - 1;
                          const isCurrentStep = idx === activeShots.length - 1;
                          const isDecidingStroke =
                            idx === finishingShotIdx &&
                            totalShots >= 2 &&
                            hasFinishingShot;
                          const sideColor =
                            shot.side === 'B' ? '#FBBF24' : '#34D399';
                          const fillColor = isFinalLanding
                            ? outcomeColor
                            : shot.isGhost
                              ? '#0F2E26'
                              : sideColor;

                          return (
                            <g
                              key={shot.id}
                              className="cursor-pointer"
                              onClick={() => {
                                setIsPlaying(false);
                                setVisibleCount(idx + 1);
                              }}
                            >
                              {hitZ > 8 && (
                                <>
                                  <ellipse
                                    cx={floorPos.x}
                                    cy={floorPos.y}
                                    rx={9}
                                    ry={5}
                                    fill="#020D0A"
                                    fillOpacity={0.55}
                                  />
                                  <line
                                    x1={floorPos.x}
                                    y1={floorPos.y}
                                    x2={hitPos.x}
                                    y2={hitPos.y}
                                    stroke={
                                      shot.isGhost ? '#CBD5E1' : sideColor
                                    }
                                    strokeOpacity={0.34}
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                  />
                                </>
                              )}
                              {isDecidingStroke && (
                                <circle
                                  cx={hitPos.x}
                                  cy={hitPos.y}
                                  r={24}
                                  fill="none"
                                  stroke={outcomeColor}
                                  strokeWidth={2.5}
                                  strokeDasharray="6 4"
                                  strokeOpacity={0.9}
                                />
                              )}
                              {isCurrentStep && (
                                <circle
                                  cx={hitPos.x}
                                  cy={hitPos.y}
                                  r={29}
                                  fill="none"
                                  stroke="#FFFFFF"
                                  strokeWidth={3}
                                  strokeOpacity={0.75}
                                />
                              )}
                              <circle
                                cx={hitPos.x}
                                cy={hitPos.y}
                                r={isFinalLanding ? 20 : 17}
                                fill={fillColor}
                                stroke={shot.isGhost ? '#CBD5E1' : '#051A15'}
                                strokeWidth={shot.isGhost ? 2.5 : 3}
                                strokeDasharray={
                                  shot.isGhost ? '5 4' : undefined
                                }
                              />
                              <text
                                x={hitPos.x}
                                y={hitPos.y + 1}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={
                                  shot.isGhost && !isFinalLanding
                                    ? '#F8FAFC'
                                    : '#051A15'
                                }
                                fontSize={15}
                                fontWeight="800"
                                fontFamily="JetBrains Mono, monospace"
                                pointerEvents="none"
                              >
                                {shot.shotNumber}
                              </text>
                            </g>
                          );
                        })}

                        {/* Active Segment Apex Height & Flight Time Pill */}
                        {activeSegment && (
                          <g pointerEvents="none" style={{ userSelect: 'none' }}>
                            {(() => {
                              const labelText = t(
                                'analyseModal.rallyPreview.flightMetricsBadge',
                                {
                                  height:
                                    activeSegment.peakHeightMeters.toFixed(1),
                                  time: activeSegment.dtSec.toFixed(1),
                                }
                              );
                              const boxW = Math.max(150, labelText.length * 8.4 + 24);
                              const cx = Math.max(
                                TILT_VIEWBOX_X + boxW / 2 + 16,
                                Math.min(
                                  TILT_VIEWBOX_X +
                                    TILT_VIEWBOX_W -
                                    boxW / 2 -
                                    16,
                                  activeSegment.peakScreen.x
                                )
                              );
                              const cy = Math.max(
                                TILT_VIEWBOX_Y + 26,
                                activeSegment.peakScreen.y - 24
                              );
                              return (
                                <>
                                  <line
                                    x1={activeSegment.peakShadow.x}
                                    y1={activeSegment.peakShadow.y}
                                    x2={activeSegment.peakScreen.x}
                                    y2={activeSegment.peakScreen.y}
                                    stroke={
                                      activeSegment.side === 'B'
                                        ? '#FBBF24'
                                        : '#34D399'
                                    }
                                    strokeOpacity={0.42}
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                  />
                                  <circle
                                    cx={activeSegment.peakShadow.x}
                                    cy={activeSegment.peakShadow.y}
                                    r={4}
                                    fill={
                                      activeSegment.side === 'B'
                                        ? '#FBBF24'
                                        : '#34D399'
                                    }
                                    fillOpacity={0.55}
                                  />
                                  <circle
                                    cx={activeSegment.peakScreen.x}
                                    cy={activeSegment.peakScreen.y}
                                    r={4.5}
                                    fill="#FFFFFF"
                                  />
                                  <rect
                                    x={cx - boxW / 2}
                                    y={cy - 14}
                                    width={boxW}
                                    height={26}
                                    rx={8}
                                    fill="#051A15"
                                    fillOpacity={0.9}
                                    stroke={
                                      activeSegment.side === 'B'
                                        ? '#FBBF24'
                                        : '#34D399'
                                    }
                                    strokeOpacity={0.65}
                                    strokeWidth={1.6}
                                  />
                                  <text
                                    x={cx}
                                    y={cy - 1}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill="#F8FAFC"
                                    fontSize={13.5}
                                    fontWeight="700"
                                    fontFamily="JetBrains Mono, monospace"
                                  >
                                    {labelText}
                                  </text>
                                </>
                              );
                            })()}
                          </g>
                        )}

                        {/* Bottom Mat Active / Deciding Shot Readout */}
                        {bottomCourtReadout && (
                          <text
                            x={NET_X}
                            y={804}
                            textAnchor="middle"
                            fill={
                              (activeStepIdx >= finishingShotIdx ||
                                visibleCount >= totalShots) &&
                              hasFinishingShot
                                ? outcomeColor
                                : '#CBD5E1'
                            }
                            fontSize={bottomCourtReadout.length > 52 ? 19 : 22}
                            fontWeight="700"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                          >
                            {bottomCourtReadout}
                          </text>
                        )}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Replay Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/70 bg-[#0B241E] px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={totalShots <= 1}
                    onClick={handleTogglePlay}
                    className="flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5 fill-current" />
                        {t('analyseModal.rallyPreview.pauseReplay')}
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        {t('analyseModal.rallyPreview.playReplay')}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={visibleCount <= 1}
                    onClick={() => {
                      setIsPlaying(false);
                      setVisibleCount((v) => Math.max(1, v - 1));
                    }}
                    className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-emerald-800/70 bg-[#061814] text-emerald-200 hover:bg-emerald-950 disabled:opacity-35"
                    aria-label={t('analyseModal.rallyPreview.prevRally')}
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={visibleCount >= totalShots}
                    onClick={() => {
                      setIsPlaying(false);
                      setVisibleCount((v) => Math.min(totalShots, v + 1));
                    }}
                    className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-emerald-800/70 bg-[#061814] text-emerald-200 hover:bg-emerald-950 disabled:opacity-35"
                    aria-label={t('analyseModal.rallyPreview.nextRally')}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setVisibleCount(totalShots);
                    }}
                    className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold ${
                      visibleCount === totalShots && !isPlaying
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-emerald-800/70 bg-[#061814] text-emerald-100/75 hover:text-white'
                    }`}
                  >
                    {t('analyseModal.rallyPreview.showAllShotsBtn', {
                      count: totalShots,
                    })}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100/80 font-mono tabular-nums">
                  {activeStepShot && (
                    <>
                      {activeStepIdx === finishingShotIdx && shotDetailText ? (
                        <span
                          className={`rounded-md border px-2 py-0.5 font-sans text-[11px] font-bold ${getOutcomeBadgeClass(rally.outcome)}`}
                        >
                          {t('analyseModal.rallyPreview.decidingShotTag')}:{' '}
                          {shotDetailText}
                        </span>
                      ) : activeStepIdx === totalShots - 1 && totalShots >= 2 ? (
                        <span
                          className={`rounded-md border px-2 py-0.5 font-sans text-[11px] font-bold ${getOutcomeBadgeClass(rally.outcome)}`}
                        >
                          {shotDetailText
                            ? `${shotDetailText} → ${outcomeLabel}`
                            : `${t('analyseModal.rallyPreview.landingBadge')} (${outcomeLabel})`}
                        </span>
                      ) : activeStepIdx === 0 ? (
                        <span className="rounded-md border border-emerald-700/60 bg-[#061814] px-2 py-0.5 font-sans text-[11px] font-semibold text-emerald-200">
                          {t('analyseModal.rallyPreview.serveBadge')}
                          {activeStepShooter ? ` · ${activeStepShooter}` : ''}
                        </span>
                      ) : activeStepShooter ? (
                        <span className="rounded-md border border-emerald-700/60 bg-[#061814] px-2 py-0.5 font-sans text-[11px] font-semibold text-emerald-200">
                          {activeStepShooter}
                        </span>
                      ) : null}
                      <span>
                        {t('analyseModal.rallyPreview.stepCounter', {
                          current: activeStepShot.shotNumber,
                          total: totalShots,
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Interactive Shot-by-Shot Sequence Strip */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/85">
                  {t('analyseModal.rallyPreview.shotTimelineTitle', {
                    count: totalShots,
                  })}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {rally.shots.map((shot, idx) => {
                    const isSelected = idx === activeShots.length - 1;
                    const isIncluded = idx < activeShots.length;
                    const isFinal = idx === totalShots - 1;
                    const isDecidingStroke =
                      idx === finishingShotIdx && hasFinishingShot;
                    const shooter = shot.playerId
                      ? playerNameById.get(shot.playerId)
                      : null;
                    const prev = idx > 0 ? rally.shots[idx - 1] : null;
                    const deltaSec = prev
                      ? ((shot.timestamp - prev.timestamp) / 1000).toFixed(1)
                      : null;

                    return (
                      <button
                        key={shot.id}
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setVisibleCount(idx + 1);
                        }}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-white/70 bg-emerald-500/20'
                            : isIncluded
                              ? 'border-emerald-800/70 bg-[#0B241E] hover:border-emerald-500/60'
                              : 'border-emerald-950 bg-[#061814] opacity-55 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] text-slate-950 ${
                              isFinal
                                ? rally.outcome === 'IN'
                                  ? 'bg-emerald-400'
                                  : rally.outcome === 'OUT'
                                    ? 'bg-rose-400'
                                    : rally.outcome === 'FAULT'
                                      ? 'bg-amber-400'
                                      : 'bg-sky-400'
                                : shot.side === 'B'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                            }`}
                          >
                            {shot.shotNumber}
                          </span>
                          <span className="text-white">
                            {idx === 0
                              ? totalShots === 1
                                ? `${t('analyseModal.rallyPreview.serveBadge')} (${outcomeLabel})`
                                : t('analyseModal.rallyPreview.serveBadge')
                              : isFinal
                                ? `${t('analyseModal.rallyPreview.landingBadge')} (${outcomeLabel})`
                                : shooter ||
                                  (shot.side
                                    ? `${t('common.side')} ${shot.side}`
                                    : `#${shot.shotNumber}`)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-100/70">
                          {idx === 0 && shooter && <span>{shooter}</span>}
                          {isDecidingStroke && shotDetailText && (
                            <span
                              className={`rounded border px-1.5 py-0.5 font-semibold ${getOutcomeBadgeClass(rally.outcome)}`}
                            >
                              {shotDetailText}
                            </span>
                          )}
                          {isFinal && totalShots >= 2 && shotDetailText && (
                            <span
                              className={`rounded border px-1.5 py-0.5 font-semibold ${getOutcomeBadgeClass(rally.outcome)}`}
                            >
                              {shotDetailText}
                            </span>
                          )}
                          {deltaSec !== null && (
                            <span className="font-mono tabular-nums">
                              +{deltaSec}s
                              {flightAnalysis.segments[idx - 1]
                                ? ` · ↑${flightAnalysis.segments[idx - 1].peakHeightMeters.toFixed(1)}m`
                                : ''}
                            </span>
                          )}
                          {shot.isGhost && (
                            <span className="rounded bg-slate-700/70 px-1 py-0.5 text-[9px] text-slate-200">
                              {t('analyseModal.rallyPreview.ghostTag')}
                            </span>
                          )}
                          {shot.isAutoCorrected && (
                            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-200">
                              {t('analyseModal.rallyPreview.autoCorrectedTag')}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
