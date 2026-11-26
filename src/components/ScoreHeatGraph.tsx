import React, { useMemo, useState } from 'react';
import { Eye, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n';
import { MatchState, RallyRecord, Side } from '../types/match';

interface ScoreHeatGraphProps {
  matchState: MatchState;
  sideALabel: string;
  sideBLabel: string;
  onPreviewRally?: (rally: RallyRecord) => void;
}

interface HeatPoint {
  index: number;
  rally: RallyRecord;
  diff: number; // score(focus) - score(opponent)
  wonByFocus: boolean;
  heat: number; // [-1, +1] rolling momentum intensity
  streak: number; // +N for focus streak, -N for opponent streak
  isMomentumShift: boolean; // point winner switched sides vs previous scored rally
  isLeadChange: boolean; // leader changed across 0 (or tied -> new leader after prev leader)
  isIntervalPoint: boolean;
}

interface RunSummary {
  length: number;
  fromScore: string;
  toScore: string;
}

function heatToColor(heat: number): string {
  const clamped = Math.max(-1, Math.min(1, heat));
  if (clamped >= 0) {
    // Neutral slate (#233A34) -> Emerald (#10B981) -> Bright Mint (#34D399)
    const t = clamped;
    const r = Math.round(35 + (52 - 35) * t);
    const g = Math.round(58 + (211 - 58) * t);
    const b = Math.round(52 + (153 - 52) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Neutral slate (#233A34) -> Amber (#F59E0B) -> Hot Rose (#F43F5E)
  const t = Math.abs(clamped);
  if (t <= 0.5) {
    const k = t * 2;
    const r = Math.round(35 + (245 - 35) * k);
    const g = Math.round(58 + (158 - 58) * k);
    const b = Math.round(52 + (11 - 52) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (t - 0.5) * 2;
  const r = Math.round(245 + (244 - 245) * k);
  const g = Math.round(158 + (63 - 158) * k);
  const b = Math.round(11 + (94 - 11) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

export const ScoreHeatGraph: React.FC<ScoreHeatGraphProps> = ({
  matchState,
  sideALabel,
  sideBLabel,
  onPreviewRally,
}) => {
  const { t } = useI18n();
  const [perspectiveSide, setPerspectiveSide] = useState<Side>('A');

  const gamesWithRallies = useMemo(() => {
    const setNums = new Set<number>();
    matchState.rallies.forEach((r) => {
      if (r.outcome !== 'LET' && r.winningSide) {
        setNums.add(r.gameNumber);
      }
    });
    if (setNums.size === 0) {
      setNums.add(matchState.currentGame);
    }
    return Array.from(setNums).sort((a, b) => a - b);
  }, [matchState.rallies, matchState.currentGame]);

  const [selectedGame, setSelectedGame] = useState<number>(() => {
    if (gamesWithRallies.includes(matchState.currentGame)) {
      return matchState.currentGame;
    }
    return gamesWithRallies[gamesWithRallies.length - 1] ?? 1;
  });

  const activeGame = gamesWithRallies.includes(selectedGame)
    ? selectedGame
    : gamesWithRallies[gamesWithRallies.length - 1] ?? 1;

  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);

  const analysis = useMemo(() => {
    const scoredRallies = matchState.rallies
      .filter(
        (r) =>
          r.gameNumber === activeGame &&
          r.outcome !== 'LET' &&
          r.winningSide !== null
      )
      .sort((a, b) => a.rallyNumber - b.rallyNumber);

    const intervalTarget = Math.ceil(matchState.config.rules.pointsPerGame / 2);
    let intervalMarked = false;

    const points: HeatPoint[] = [];
    let currentStreak = 0;
    let prevLeader: Side | null = null;
    let leadChanges = 0;
    let momentumShifts = 0;

    let bestFocusRun: RunSummary | null = null;
    let bestOppRun: RunSummary | null = null;

    let runStartIdx = 0;

    const formatScoreForSide = (s: { A: number; B: number }, focus: Side) =>
      focus === 'A' ? `${s.A}–${s.B}` : `${s.B}–${s.A}`;

    scoredRallies.forEach((rally, idx) => {
      const wonByFocus = rally.winningSide === perspectiveSide;
      const focusScore =
        perspectiveSide === 'A' ? rally.scoreAfter.A : rally.scoreAfter.B;
      const oppScore =
        perspectiveSide === 'A' ? rally.scoreAfter.B : rally.scoreAfter.A;
      const diff = focusScore - oppScore;

      // Streak calculation
      const prevWon = idx > 0 ? scoredRallies[idx - 1].winningSide === perspectiveSide : null;
      const isMomentumShift = idx > 0 && prevWon !== wonByFocus;
      if (isMomentumShift) {
        momentumShifts += 1;
      }

      if (wonByFocus) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      }

      if (idx === 0 || isMomentumShift) {
        runStartIdx = idx;
      }

      // Check longest runs
      const runStartRally = scoredRallies[runStartIdx];
      if (currentStreak > 0) {
        if (!bestFocusRun || currentStreak > bestFocusRun.length) {
          bestFocusRun = {
            length: currentStreak,
            fromScore: formatScoreForSide(
              runStartRally.scoreBefore,
              perspectiveSide
            ),
            toScore: formatScoreForSide(rally.scoreAfter, perspectiveSide),
          };
        }
      } else {
        const oppLen = Math.abs(currentStreak);
        if (!bestOppRun || oppLen > bestOppRun.length) {
          bestOppRun = {
            length: oppLen,
            fromScore: formatScoreForSide(
              runStartRally.scoreBefore,
              perspectiveSide
            ),
            toScore: formatScoreForSide(rally.scoreAfter, perspectiveSide),
          };
        }
      }

      // Lead change tracking (when actual non-tied leader flips to the other side)
      const currentLeader: Side | null =
        rally.scoreAfter.A > rally.scoreAfter.B
          ? 'A'
          : rally.scoreAfter.B > rally.scoreAfter.A
            ? 'B'
            : null;
      let isLeadChange = false;
      if (currentLeader !== null) {
        if (prevLeader !== null && currentLeader !== prevLeader) {
          isLeadChange = true;
          leadChanges += 1;
        }
        prevLeader = currentLeader;
      }

      // Weighted rolling momentum heat over recent window (last 4 rallies + subtle forward neighbor)
      // Weights emphasize immediate run + local cluster so strong/weak phases pop clearly
      const weights: Array<[number, number]> = [
        [0, 0.42],
        [-1, 0.28],
        [-2, 0.16],
        [-3, 0.08],
        [1, 0.06],
      ];
      let weightedSum = 0;
      let weightTotal = 0;
      weights.forEach(([offset, w]) => {
        const target = scoredRallies[idx + offset];
        if (!target) return;
        const val = target.winningSide === perspectiveSide ? 1 : -1;
        weightedSum += val * w;
        weightTotal += w;
      });
      const rawHeat = weightTotal > 0 ? weightedSum / weightTotal : 0;
      // Amplify slightly when on a 3+ streak for crisp visual contrast
      const streakBoost =
        Math.abs(currentStreak) >= 3
          ? Math.sign(currentStreak) * Math.min(0.2, (Math.abs(currentStreak) - 2) * 0.07)
          : 0;
      const heat = Math.max(-1, Math.min(1, rawHeat + streakBoost));

      let isIntervalPoint = false;
      if (
        !intervalMarked &&
        Math.max(rally.scoreAfter.A, rally.scoreAfter.B) === intervalTarget
      ) {
        intervalMarked = true;
        isIntervalPoint = true;
      }

      points.push({
        index: idx,
        rally,
        diff,
        wonByFocus,
        heat,
        streak: currentStreak,
        isMomentumShift,
        isLeadChange,
        isIntervalPoint,
      });
    });

    const maxAbsDiff = Math.max(
      3,
      ...points.map((p) => Math.abs(p.diff))
    );

    const lastRally = scoredRallies[scoredRallies.length - 1];
    const finalScoreText = lastRally
      ? `${lastRally.scoreAfter.A} – ${lastRally.scoreAfter.B}`
      : '0 – 0';

    return {
      points,
      maxAbsDiff,
      bestFocusRun: bestFocusRun as RunSummary | null,
      bestOppRun: bestOppRun as RunSummary | null,
      leadChanges,
      momentumShifts,
      intervalTarget,
      finalScoreText,
    };
  }, [matchState, activeGame, perspectiveSide]);

  const activeInspectIndex =
    inspectedIndex !== null && inspectedIndex < analysis.points.length
      ? inspectedIndex
      : null;
  const inspectedPoint =
    activeInspectIndex !== null ? analysis.points[activeInspectIndex] : null;

  const focusLabel = perspectiveSide === 'A' ? sideALabel : sideBLabel;
  const oppLabel = perspectiveSide === 'A' ? sideBLabel : sideALabel;

  // SVG Layout Constants
  const SVG_W = 760;
  const SVG_H = 236;
  const PAD_L = 38;
  const PAD_R = 16;
  const PAD_T = 22;
  const CHART_H = 128; // Differential curve height
  const ZERO_Y = PAD_T + CHART_H / 2;
  const HEAT_Y = PAD_T + CHART_H + 18;
  const HEAT_H = 32;
  const AXIS_Y = HEAT_Y + HEAT_H + 18;

  const plotW = SVG_W - PAD_L - PAD_R;
  const count = analysis.points.length;

  const getXForStep = (stepZeroBased: number) => {
    // stepZeroBased: 0 is start (0-0), 1..count are scored rallies
    if (count === 0) return PAD_L;
    return PAD_L + (stepZeroBased / count) * plotW;
  };

  const getYForDiff = (diff: number) => {
    const ratio = diff / analysis.maxAbsDiff;
    return ZERO_Y - ratio * (CHART_H / 2 - 8);
  };

  const curvePoints = [
    { x: getXForStep(0), y: ZERO_Y },
    ...analysis.points.map((pt) => ({
      x: getXForStep(pt.index + 1),
      y: getYForDiff(pt.diff),
    })),
  ];

  const linePath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    curvePoints.length > 1
      ? `${linePath} L ${curvePoints[curvePoints.length - 1].x.toFixed(1)} ${ZERO_Y.toFixed(1)} L ${curvePoints[0].x.toFixed(1)} ${ZERO_Y.toFixed(1)} Z`
      : '';

  const playerNameById = useMemo(
    () => new Map(matchState.config.players.map((p) => [p.id, p.name] as const)),
    [matchState.config.players]
  );

  const uid = `heat_${activeGame}_${perspectiveSide}`;

  return (
    <div className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-4 space-y-3.5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">
              {t('analyseModal.heatGraph.title')}
            </h3>
            <span className="rounded-md border border-emerald-800/80 bg-[#061814] px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300 tabular-nums">
              {analysis.finalScoreText}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-emerald-100/65">
            {t('analyseModal.heatGraph.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Game Switcher */}
          {gamesWithRallies.length > 1 && (
            <div className="flex rounded-lg border border-emerald-900/70 bg-[#061814] p-0.5">
              {gamesWithRallies.map((gNum) => (
                <button
                  key={gNum}
                  type="button"
                  onClick={() => {
                    setSelectedGame(gNum);
                    setInspectedIndex(null);
                  }}
                  className={`min-h-[30px] rounded-md px-2.5 text-xs font-semibold tabular-nums transition-colors ${
                    activeGame === gNum
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-emerald-100/70 hover:text-white'
                  }`}
                >
                  {t('analyseModal.gameLabel', { game: gNum })}
                </button>
              ))}
            </div>
          )}

          {/* Perspective Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-emerald-900/70 bg-[#061814] p-0.5">
            <span className="hidden pl-2 pr-1 text-[11px] text-emerald-100/60 sm:inline">
              {t('analyseModal.heatGraph.perspectiveLabel')}
            </span>
            <button
              type="button"
              onClick={() => setPerspectiveSide('A')}
              className={`min-h-[30px] max-w-[140px] truncate rounded-md px-2.5 text-xs font-semibold transition-colors ${
                perspectiveSide === 'A'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-emerald-100/75 hover:text-white'
              }`}
              title={sideALabel}
            >
              {sideALabel}
            </button>
            <button
              type="button"
              onClick={() => setPerspectiveSide('B')}
              className={`min-h-[30px] max-w-[140px] truncate rounded-md px-2.5 text-xs font-semibold transition-colors ${
                perspectiveSide === 'B'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-emerald-100/75 hover:text-white'
              }`}
              title={sideBLabel}
            >
              {sideBLabel}
            </button>
          </div>
        </div>
      </div>

      {analysis.points.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/60 bg-[#061814] px-4 py-8 text-center text-xs text-emerald-100/60">
          {t('analyseModal.heatGraph.noRalliesYet')}
        </div>
      ) : (
        <>
          {/* Summary KPI Pills */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-[#061814] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {t('analyseModal.heatGraph.bestRunLabel')} ({focusLabel})
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {analysis.bestFocusRun ? (
                    <>
                      {t('analyseModal.heatGraph.streakValue', {
                        count: analysis.bestFocusRun.length,
                      })}{' '}
                      <span className="text-xs font-normal text-emerald-200/75">
                        {t('analyseModal.heatGraph.scoreRange', {
                          from: analysis.bestFocusRun.fromScore,
                          to: analysis.bestFocusRun.toScore,
                        })}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-100/50">
                      {t('analyseModal.heatGraph.noneYet')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-[#061814] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300/90">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {t('analyseModal.heatGraph.worstRunLabel')} ({oppLabel})
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {analysis.bestOppRun ? (
                    <>
                      {t('analyseModal.heatGraph.streakValue', {
                        count: analysis.bestOppRun.length,
                      })}{' '}
                      <span className="text-xs font-normal text-rose-200/75">
                        {t('analyseModal.heatGraph.scoreRange', {
                          from: analysis.bestOppRun.fromScore,
                          to: analysis.bestOppRun.toScore,
                        })}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-100/50">
                      {t('analyseModal.heatGraph.noneYet')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-[#061814] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-amber-300/90 truncate">
                  {t('analyseModal.heatGraph.shiftsLabel')}
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {t('analyseModal.heatGraph.shiftsValue', {
                    leads: analysis.leadChanges,
                    swings: analysis.momentumShifts,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive SVG Momentum & Heat Chart */}
          <div className="rounded-xl border border-emerald-900/70 bg-[#061814] p-2.5 sm:p-3">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="h-auto w-full select-none overflow-visible"
              onMouseLeave={() => setInspectedIndex(null)}
            >
              <defs>
                <clipPath id={`${uid}_above`}>
                  <rect
                    x={PAD_L}
                    y={PAD_T - 6}
                    width={plotW + 8}
                    height={ZERO_Y - (PAD_T - 6)}
                  />
                </clipPath>
                <clipPath id={`${uid}_below`}>
                  <rect
                    x={PAD_L}
                    y={ZERO_Y}
                    width={plotW + 8}
                    height={PAD_T + CHART_H + 6 - ZERO_Y}
                  />
                </clipPath>
                <linearGradient id={`${uid}_posGrad`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity="0.62" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id={`${uid}_negGrad`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.62" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Labels */}
              <line
                x1={PAD_L}
                y1={getYForDiff(analysis.maxAbsDiff)}
                x2={SVG_W - PAD_R}
                y2={getYForDiff(analysis.maxAbsDiff)}
                stroke="#134E4A"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.55}
              />
              <text
                x={PAD_L - 6}
                y={getYForDiff(analysis.maxAbsDiff) + 3.5}
                textAnchor="end"
                fill="#6EE7B7"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
              >
                +{analysis.maxAbsDiff}
              </text>

              <line
                x1={PAD_L}
                y1={ZERO_Y}
                x2={SVG_W - PAD_R}
                y2={ZERO_Y}
                stroke="#94A3B8"
                strokeWidth={1.25}
                strokeDasharray="5 4"
                opacity={0.65}
              />
              <text
                x={PAD_L - 6}
                y={ZERO_Y + 3.5}
                textAnchor="end"
                fill="#CBD5E1"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={700}
              >
                0
              </text>

              <line
                x1={PAD_L}
                y1={getYForDiff(-analysis.maxAbsDiff)}
                x2={SVG_W - PAD_R}
                y2={getYForDiff(-analysis.maxAbsDiff)}
                stroke="#7F1D1D"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.55}
              />
              <text
                x={PAD_L - 6}
                y={getYForDiff(-analysis.maxAbsDiff) + 3.5}
                textAnchor="end"
                fill="#FDA4AF"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
              >
                -{analysis.maxAbsDiff}
              </text>

              {/* Area Fills Split Cleanly Across Zero */}
              {areaPath && (
                <>
                  <path
                    d={areaPath}
                    fill={`url(#${uid}_posGrad)`}
                    clipPath={`url(#${uid}_above)`}
                  />
                  <path
                    d={areaPath}
                    fill={`url(#${uid}_negGrad)`}
                    clipPath={`url(#${uid}_below)`}
                  />
                </>
              )}

              {/* Interval Marker Line (e.g. 11 pts) */}
              {analysis.points
                .filter((pt) => pt.isIntervalPoint)
                .map((pt) => {
                  const ix = getXForStep(pt.index + 1);
                  return (
                    <g key={`interval_${pt.rally.id}`}>
                      <line
                        x1={ix}
                        y1={PAD_T - 4}
                        x2={ix}
                        y2={HEAT_Y + HEAT_H}
                        stroke="#2DD4BF"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        opacity={0.75}
                      />
                      <rect
                        x={ix - 18}
                        y={PAD_T - 18}
                        width={36}
                        height={14}
                        rx={4}
                        fill="#0F766E"
                      />
                      <text
                        x={ix}
                        y={PAD_T - 8}
                        textAnchor="middle"
                        fill="#CCFBF1"
                        fontSize={9}
                        fontWeight={700}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {t('analyseModal.heatGraph.intervalMarker', {
                          points: analysis.intervalTarget,
                        })}
                      </text>
                    </g>
                  );
                })}

              {/* Main Lead Differential Curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Point Markers & Lead-Change Diamonds */}
              {analysis.points.map((pt) => {
                const cx = getXForStep(pt.index + 1);
                const cy = getYForDiff(pt.diff);
                const isInspected = activeInspectIndex === pt.index;

                return (
                  <g key={`pt_${pt.rally.id}`} pointerEvents="none">
                    {pt.isLeadChange && (
                      <polygon
                        points={`${cx},${ZERO_Y - 5.5} ${cx + 5.5},${ZERO_Y} ${cx},${ZERO_Y + 5.5} ${cx - 5.5},${ZERO_Y}`}
                        fill="#FBBF24"
                        stroke="#051A15"
                        strokeWidth={1.2}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isInspected ? 5.5 : pt.isLeadChange ? 4.2 : 2.8}
                      fill={
                        pt.wonByFocus
                          ? '#34D399'
                          : '#FB7185'
                      }
                      stroke={isInspected ? '#FFFFFF' : '#061814'}
                      strokeWidth={isInspected ? 2 : 1.2}
                    />
                  </g>
                );
              })}

              {/* Heat Strip Title on Left */}
              <text
                x={PAD_L - 6}
                y={HEAT_Y + HEAT_H / 2 + 3.5}
                textAnchor="end"
                fill="#94A3B8"
                fontSize={9}
                fontWeight={700}
                fontFamily="JetBrains Mono, monospace"
              >
                HEAT
              </text>

              {/* Heat Strip Cells (1 cell per scored rally, aligned with curve steps) */}
              {analysis.points.map((pt) => {
                const colWidth = plotW / count;
                const cellX = PAD_L + pt.index * colWidth;
                const gap = colWidth > 10 ? 1.5 : 0.6;
                const rectW = Math.max(2, colWidth - gap);
                const isInspected = activeInspectIndex === pt.index;
                const fill = heatToColor(pt.heat);

                return (
                  <g key={`heat_${pt.rally.id}`}>
                    <rect
                      x={cellX + gap / 2}
                      y={HEAT_Y}
                      width={rectW}
                      height={HEAT_H}
                      rx={colWidth > 12 ? 4 : 2}
                      fill={fill}
                      stroke={
                        isInspected
                          ? '#FFFFFF'
                          : pt.isMomentumShift
                            ? 'rgba(255,255,255,0.45)'
                            : 'none'
                      }
                      strokeWidth={isInspected ? 2 : pt.isMomentumShift ? 1 : 0}
                    />

                    {/* Momentum Shift Tick at top edge of heat cell */}
                    {pt.isMomentumShift && (
                      <circle
                        cx={cellX + colWidth / 2}
                        cy={HEAT_Y - 5}
                        r={2.2}
                        fill="#FDE68A"
                      />
                    )}

                    {/* X-axis tick numbers every ~5 rallies + first/last */}
                    {(pt.index === 0 ||
                      pt.index === count - 1 ||
                      (count <= 20 && (pt.index + 1) % 3 === 0) ||
                      (count > 20 && (pt.index + 1) % 5 === 0)) && (
                      <text
                        x={cellX + colWidth / 2}
                        y={AXIS_Y}
                        textAnchor="middle"
                        fill="#94A3B8"
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {pt.index + 1}
                      </text>
                    )}

                    {/* Full-height invisible hit target for easy hover/tap */}
                    <rect
                      x={cellX}
                      y={PAD_T - 8}
                      width={colWidth}
                      height={HEAT_Y + HEAT_H + 14 - (PAD_T - 8)}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setInspectedIndex(pt.index)}
                      onClick={() =>
                        setInspectedIndex((cur) =>
                          cur === pt.index ? null : pt.index
                        )
                      }
                    />
                  </g>
                );
              })}

              {/* Inspected Column Guideline */}
              {inspectedPoint && (
                <line
                  x1={getXForStep(inspectedPoint.index + 1)}
                  y1={PAD_T - 4}
                  x2={getXForStep(inspectedPoint.index + 1)}
                  y2={HEAT_Y + HEAT_H}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.55}
                  pointerEvents="none"
                />
              )}
            </svg>

            {/* Interactive Rally Detail Strip */}
            <div className="mt-2 flex min-h-[34px] flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/60 bg-[#0B241E] px-3 py-1.5 text-xs">
              {inspectedPoint ? (
                <>
                  <span className="font-medium text-slate-100 tabular-nums">
                    {t('analyseModal.heatGraph.selectedPointSummary', {
                      rally: inspectedPoint.rally.rallyNumber,
                      scoreA: inspectedPoint.rally.scoreAfter.A,
                      scoreB: inspectedPoint.rally.scoreAfter.B,
                      winner:
                        inspectedPoint.rally.winningSide === 'A'
                          ? sideALabel
                          : sideBLabel,
                      shot: inspectedPoint.rally.finishingShotType
                        ? t(`shotTypes.${inspectedPoint.rally.finishingShotType}`)
                        : t(
                            `resultModal.outcomes.${inspectedPoint.rally.outcome}.label`
                          ),
                    })}
                    {inspectedPoint.rally.finishingPlayerId &&
                      playerNameById.get(
                        inspectedPoint.rally.finishingPlayerId
                      ) && (
                        <span className="text-emerald-200/75">
                          {' '}
                          (
                          {t('analyseModal.rallyList.byPlayer', {
                            name: playerNameById.get(
                              inspectedPoint.rally.finishingPlayerId
                            )!,
                          })}
                          )
                        </span>
                      )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {inspectedPoint.isLeadChange && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                        {t('analyseModal.heatGraph.legendLeadChange')}
                      </span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                        inspectedPoint.streak > 0
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-rose-500/20 text-rose-200'
                      }`}
                    >
                      {inspectedPoint.streak > 0
                        ? t('analyseModal.heatGraph.streakBadge', {
                            count: inspectedPoint.streak,
                          })
                        : t('analyseModal.heatGraph.concededBadge', {
                            count: Math.abs(inspectedPoint.streak),
                          })}
                    </span>
                    {onPreviewRally && (
                      <button
                        type="button"
                        onClick={() => onPreviewRally(inspectedPoint.rally)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/25"
                      >
                        <Eye className="h-3 w-3" />
                        {t('analyseModal.rallyPreview.buttonLabel')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-emerald-100/60">
                  {t('analyseModal.heatGraph.inspectHint')}
                </span>
              )}
            </div>
          </div>

          {/* Heat Scale & Marker Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-emerald-100/75">
            <div className="flex items-center gap-2">
              <span className="text-rose-300 font-medium">
                {t('analyseModal.heatGraph.legendWeak')}
              </span>
              <div className="h-2.5 w-28 rounded-full bg-gradient-to-r from-rose-500 via-slate-600 to-emerald-400 sm:w-36" />
              <span className="text-emerald-300 font-medium">
                {t('analyseModal.heatGraph.legendStrong')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-400" />
                {t('analyseModal.heatGraph.legendLeadChange')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-200" />
                {t('analyseModal.heatGraph.legendShift')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-0.5 border-l border-dashed border-teal-300" />
                {t('analyseModal.heatGraph.intervalMarker', {
                  points: analysis.intervalTarget,
                })}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
