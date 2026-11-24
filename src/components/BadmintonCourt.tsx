import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { MatchState, PauseEventType, ShotRecord } from '../types/match';
import {
  CENTER_Y,
  COURT_LENGTH,
  COURT_WIDTH,
  getActiveServiceInfo,
  getMatchCategoryDisplay,
  getPlayerScreenPlacements,
  getSideForHalf,
  LEFT_DOUBLES_LONG_X,
  LEFT_SHORT_SERVICE_X,
  NET_X,
  PORTRAIT_VIEWBOX_H,
  PORTRAIT_VIEWBOX_W,
  PORTRAIT_VIEWBOX_X,
  PORTRAIT_VIEWBOX_Y,
  RIGHT_DOUBLES_LONG_X,
  RIGHT_SHORT_SERVICE_X,
  SINGLES_BOTTOM_Y,
  SINGLES_TOP_Y,
  VIEWBOX_H,
  VIEWBOX_W,
  VIEWBOX_X,
  VIEWBOX_Y,
} from '../utils/bwfEngine';

interface BadmintonCourtProps {
  matchState: MatchState;
  currentShots: ShotRecord[];
  redoStack: ShotRecord[][];
  isModalOpen: boolean;
  onRegisterTap: (
    courtX: number,
    courtY: number,
    now: number
  ) => { ghostCount: number; autoCorrected: boolean };
  onUpdateLastShotPosition: (x: number, y: number) => void;
  onUndoShot: () => void;
  onRedoShot: () => void;
  onOpenResultMenu: () => void;
  onOpenPauseMenu: () => void;
}

interface ActiveGesture {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCourtX: number;
  startCourtY: number;
  mode: 'pending' | 'dragging_end';
  timerId: number | null;
}

export const BadmintonCourt: React.FC<BadmintonCourtProps> = ({
  matchState,
  currentShots,
  redoStack,
  isModalOpen,
  onRegisterTap,
  onUpdateLastShotPosition,
  onUndoShot,
  onRedoShot,
  onOpenResultMenu,
  onOpenPauseMenu,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gesturesRef = useRef<Map<number, ActiveGesture>>(new Map());
  const shotsCountRef = useRef<number>(currentShots.length);
  shotsCountRef.current = currentShots.length;

  const [viewport, setViewport] = useState<{ width: number; height: number }>(
    () => ({
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' ? window.innerHeight : 768,
    })
  );

  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(
    null
  );
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // Track exact container size so court always adapts to device orientation & fills 100%
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewport({ width: rect.width, height: rect.height });
          return;
        }
      }
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => updateSize());
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  const isPortrait = viewport.height > viewport.width;

  const vbX = isPortrait ? PORTRAIT_VIEWBOX_X : VIEWBOX_X;
  const vbY = isPortrait ? PORTRAIT_VIEWBOX_Y : VIEWBOX_Y;
  const vbW = isPortrait ? PORTRAIT_VIEWBOX_W : VIEWBOX_W;
  const vbH = isPortrait ? PORTRAIT_VIEWBOX_H : VIEWBOX_H;

  // Aspect-ratio compensation so text, shot circles & icons never look stretched
  // even when preserveAspectRatio="none" fills 100% of any screen shape.
  const { compX, compY } = useMemo(() => {
    const pxPerX = Math.max(0.01, viewport.width / vbW);
    const pxPerY = Math.max(0.01, viewport.height / vbH);
    const uniformPx = Math.sqrt(pxPerX * pxPerY);
    return {
      compX: uniformPx / pxPerX,
      compY: uniformPx / pxPerY,
    };
  }, [viewport.width, viewport.height, vbW, vbH]);

  const toScreen = useCallback(
    (courtX: number, courtY: number): { x: number; y: number } => {
      if (!isPortrait) {
        return { x: courtX, y: courtY };
      }
      // 90° clockwise rotation: canonical left half -> top half, right half -> bottom half
      return {
        x: COURT_WIDTH - courtY,
        y: courtX,
      };
    },
    [isPortrait]
  );

  const showFeedback = useCallback((msg: string) => {
    setFeedbackBanner(msg);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackBanner(null);
    }, 1600);
  }, []);

  useEffect(() => {
    if (matchState.lastEvent) {
      let params = matchState.lastEvent.params;
      if (
        matchState.lastEvent.key === 'engineEvents.pauseEventToast' &&
        params?.type
      ) {
        const typeMap: Record<PauseEventType, string> = {
          'Umpire Call': t('pauseModal.umpireCall'),
          Cleaning: t('pauseModal.cleaning'),
          'Shuttle Change': t('pauseModal.shuttleChange'),
          'Video Call': t('pauseModal.videoCall'),
          Interval: t('pauseModal.intervalLabel'),
          Other: t('pauseModal.other'),
          Combined: t('analyseModal.rallyList.pauseRowBadge'),
        };
        const mappedType =
          typeMap[params.type as PauseEventType] ?? String(params.type);
        params = { ...params, type: mappedType };
      }
      showFeedback(t(matchState.lastEvent.key, params));
    } else if (matchState.lastEndsSwitchMessage) {
      showFeedback(matchState.lastEndsSwitchMessage);
    }
  }, [
    matchState.lastEvent,
    matchState.lastEndsSwitchMessage,
    matchState.rallies.length,
    showFeedback,
    t,
  ]);

  useEffect(() => {
    const cancelAllGestures = () => {
      let wasDragging = false;
      gesturesRef.current.forEach((g) => {
        if (g.timerId !== null) {
          window.clearTimeout(g.timerId);
          g.timerId = null;
        }
        if (g.mode === 'dragging_end') {
          wasDragging = true;
        }
      });
      gesturesRef.current.clear();
      if (wasDragging) {
        setIsDraggingEnd(false);
        setDragCoords(null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelAllGestures();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', cancelAllGestures);
    window.addEventListener('pagehide', cancelAllGestures);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', cancelAllGestures);
      window.removeEventListener('pagehide', cancelAllGestures);
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      gesturesRef.current.forEach((g) => {
        if (g.timerId !== null) {
          window.clearTimeout(g.timerId);
        }
      });
      gesturesRef.current.clear();
    };
  }, []);

  const clientToCourt = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      let svgX = NET_X;
      let svgY = CENTER_Y;

      if (svg) {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = clientX;
          pt.y = clientY;
          const transformed = pt.matrixTransform(ctm.inverse());
          svgX = transformed.x;
          svgY = transformed.y;
        } else {
          const rect = svg.getBoundingClientRect();
          svgX = vbX + ((clientX - rect.left) / Math.max(1, rect.width)) * vbW;
          svgY = vbY + ((clientY - rect.top) / Math.max(1, rect.height)) * vbH;
        }
      }

      if (!isPortrait) {
        return { x: svgX, y: svgY };
      }
      // Inverse of 90° clockwise rotation
      return {
        x: svgY,
        y: COURT_WIDTH - svgX,
      };
    },
    [isPortrait, vbX, vbY, vbW, vbH]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isModalOpen) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }

    const courtPos = clientToCourt(e.clientX, e.clientY);

    // If a second finger touches down (e.g. rapid two-thumb tapping), cancel long-press timers
    const isSinglePointer = gesturesRef.current.size === 0;
    if (!isSinglePointer) {
      gesturesRef.current.forEach((g) => {
        if (g.timerId !== null) {
          window.clearTimeout(g.timerId);
          g.timerId = null;
        }
      });
    }

    const timerId = isSinglePointer
      ? window.setTimeout(() => {
          const active = gesturesRef.current.get(e.pointerId);
          if (!active || gesturesRef.current.size !== 1) return;

          if (navigator.vibrate) {
            navigator.vibrate(25);
          }

          if (shotsCountRef.current === 0) {
            // Long-press between rallies opens Pause Menu
            active.timerId = null;
            gesturesRef.current.delete(e.pointerId);
            onOpenPauseMenu();
          } else {
            // Long-press during/end of rally enters Free Landing Position Drag
            active.mode = 'dragging_end';
            active.timerId = null;
            setIsDraggingEnd(true);
            setDragCoords({
              x: Math.round(active.startCourtX),
              y: Math.round(active.startCourtY),
            });
            onUpdateLastShotPosition(
              Math.round(active.startCourtX),
              Math.round(active.startCourtY)
            );
          }
        }, 450)
      : null;

    gesturesRef.current.set(e.pointerId, {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCourtX: courtPos.x,
      startCourtY: courtPos.y,
      mode: 'pending',
      timerId,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = gesturesRef.current.get(e.pointerId);
    if (!active) return;

    if (active.mode === 'dragging_end') {
      e.preventDefault();
      const pos = clientToCourt(e.clientX, e.clientY);
      const rx = Math.round(pos.x);
      const ry = Math.round(pos.y);
      setDragCoords({ x: rx, y: ry });
      onUpdateLastShotPosition(rx, ry);
      return;
    }

    const dist = Math.hypot(
      e.clientX - active.startClientX,
      e.clientY - active.startClientY
    );
    if (dist > 24 && active.timerId !== null) {
      window.clearTimeout(active.timerId);
      active.timerId = null;
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = gesturesRef.current.get(e.pointerId);
    if (!active) return;

    if (active.timerId !== null) {
      window.clearTimeout(active.timerId);
      active.timerId = null;
    }
    gesturesRef.current.delete(e.pointerId);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (active.mode === 'dragging_end') {
      setIsDraggingEnd(false);
      setDragCoords(null);
      if (e.type !== 'pointercancel') {
        onOpenResultMenu();
      }
      return;
    }

    if (e.type === 'pointercancel') return;

    const dx = e.clientX - active.startClientX;
    const dy = e.clientY - active.startClientY;
    const dist = Math.hypot(dx, dy);

    // Swipe Left / Right Detection
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx < 0) {
        if (shotsCountRef.current > 0) {
          onUndoShot();
          if (navigator.vibrate) navigator.vibrate(12);
          showFeedback(t('court.undoShot'));
        } else if (matchState.rallies.length > 0) {
          onUndoShot();
          if (navigator.vibrate) navigator.vibrate(16);
        }
      } else {
        if (redoStack.length > 0) {
          onRedoShot();
          if (navigator.vibrate) navigator.vibrate(12);
          showFeedback(t('court.redoShot'));
        }
      }
      return;
    }

    // Standard Quick Tap -> Register Shot
    if (dist < 30) {
      const courtPos = clientToCourt(e.clientX, e.clientY);
      const result = onRegisterTap(courtPos.x, courtPos.y, Date.now());
      shotsCountRef.current += 1;
      if (navigator.vibrate) navigator.vibrate(10);
      if (result.ghostCount > 0) {
        showFeedback(
          t(
            result.ghostCount > 1
              ? 'court.ghostShotsAdded'
              : 'court.ghostShotAdded',
            { count: result.ghostCount }
          )
        );
      }
    }
  };

  const serviceInfo = useMemo(
    () => getActiveServiceInfo(matchState),
    [matchState]
  );
  const placements = useMemo(
    () => getPlayerScreenPlacements(matchState),
    [matchState]
  );

  const leftSide = getSideForHalf('left', matchState.sideMapping);
  const rightSide = getSideForHalf('right', matchState.sideMapping);
  const leftScore = leftSide === 'A' ? matchState.scoreA : matchState.scoreB;
  const rightScore = rightSide === 'A' ? matchState.scoreA : matchState.scoreB;
  const leftGames =
    leftSide === 'A' ? matchState.gamesWonA : matchState.gamesWonB;
  const rightGames =
    rightSide === 'A' ? matchState.gamesWonA : matchState.gamesWonB;

  const isSingles = matchState.config.matchClass === 'singles';
  const isIdle = currentShots.length === 0;

  // Screen positions for upright text & icons
  const half1ScorePos = toScreen(335, CENTER_Y);
  const half2ScorePos = toScreen(1005, CENTER_Y);
  const half1MetaPos = toScreen(38, CENTER_Y);
  const half2MetaPos = toScreen(1302, CENTER_Y);
  const serveIconPos = toScreen(
    serviceInfo.serverRect.x + serviceInfo.serverRect.width / 2,
    serviceInfo.serverRect.y + serviceInfo.serverRect.height / 2
  );
  const headerPos = isPortrait
    ? { x: CENTER_Y, y: -22 }
    : { x: NET_X, y: -22 };
  const hintPos = isPortrait
    ? { x: CENTER_Y, y: COURT_LENGTH + 30 }
    : { x: NET_X, y: COURT_WIDTH + 30 };

  return (
    <div
      ref={containerRef}
      className="court-touch-surface relative h-dvh w-screen overflow-hidden bg-[#06221B]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-Screen Court SVG: Always fills 100% of screen and matches device orientation */}
      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        className="block h-full w-full select-none"
      >
        <defs>
          <radialGradient id="courtVignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#106652" />
            <stop offset="100%" stopColor="#0C4F40" />
          </radialGradient>
        </defs>

        {/* Outer Surround Mat (0.5m / 50cm boundary outside court lines) */}
        <rect
          x={vbX}
          y={vbY}
          width={vbW}
          height={vbH}
          fill="#06221B"
        />

        {/* Rotated Court Geometry Group (canonical 1340x610 rotated 90° CW in portrait) */}
        <g
          transform={
            isPortrait ? `translate(${COURT_WIDTH}, 0) rotate(90)` : undefined
          }
          pointerEvents="none"
        >
          {/* Main Court Floor */}
          <rect
            x={0}
            y={0}
            width={COURT_LENGTH}
            height={COURT_WIDTH}
            fill="url(#courtVignette)"
          />

          {/* Singles Mode: Mute Outer Doubles Tramlines so Singles Court Pops */}
          {isSingles && (
            <g>
              <rect
                x={0}
                y={0}
                width={COURT_LENGTH}
                height={SINGLES_TOP_Y}
                fill="#072D24"
                fillOpacity={0.72}
              />
              <rect
                x={0}
                y={SINGLES_BOTTOM_Y}
                width={COURT_LENGTH}
                height={COURT_WIDTH - SINGLES_BOTTOM_Y}
                fill="#072D24"
                fillOpacity={0.72}
              />
            </g>
          )}

          {/* Active Service Boxes Illumination (Visible before rally starts) */}
          {isIdle && (
            <g>
              <rect
                x={serviceInfo.receiverRect.x}
                y={serviceInfo.receiverRect.y}
                width={serviceInfo.receiverRect.width}
                height={serviceInfo.receiverRect.height}
                fill="#34D399"
                fillOpacity={0.14}
                stroke="#34D399"
                strokeWidth={4}
                strokeDasharray="14 10"
              />
              <rect
                x={serviceInfo.serverRect.x}
                y={serviceInfo.serverRect.y}
                width={serviceInfo.serverRect.width}
                height={serviceInfo.serverRect.height}
                fill="#F59E0B"
                fillOpacity={0.26}
                stroke="#FBBF24"
                strokeWidth={6}
              />
            </g>
          )}

          {/* Official BWF Court Lines */}
          <g fill="none">
            <rect
              x={0}
              y={0}
              width={COURT_LENGTH}
              height={COURT_WIDTH}
              stroke="#F8FAFC"
              strokeWidth={isSingles ? 2.5 : 5}
              strokeOpacity={isSingles ? 0.35 : 1}
            />
            <line
              x1={0}
              y1={SINGLES_TOP_Y}
              x2={COURT_LENGTH}
              y2={SINGLES_TOP_Y}
              stroke="#F8FAFC"
              strokeWidth={isSingles ? 5 : 3.5}
              strokeOpacity={isSingles ? 1 : 0.75}
            />
            <line
              x1={0}
              y1={SINGLES_BOTTOM_Y}
              x2={COURT_LENGTH}
              y2={SINGLES_BOTTOM_Y}
              stroke="#F8FAFC"
              strokeWidth={isSingles ? 5 : 3.5}
              strokeOpacity={isSingles ? 1 : 0.75}
            />
            <line
              x1={LEFT_SHORT_SERVICE_X}
              y1={isSingles ? SINGLES_TOP_Y : 0}
              x2={LEFT_SHORT_SERVICE_X}
              y2={isSingles ? SINGLES_BOTTOM_Y : COURT_WIDTH}
              stroke="#F8FAFC"
              strokeWidth={4.5}
            />
            <line
              x1={RIGHT_SHORT_SERVICE_X}
              y1={isSingles ? SINGLES_TOP_Y : 0}
              x2={RIGHT_SHORT_SERVICE_X}
              y2={isSingles ? SINGLES_BOTTOM_Y : COURT_WIDTH}
              stroke="#F8FAFC"
              strokeWidth={4.5}
            />
            <line
              x1={LEFT_DOUBLES_LONG_X}
              y1={0}
              x2={LEFT_DOUBLES_LONG_X}
              y2={COURT_WIDTH}
              stroke="#F8FAFC"
              strokeWidth={isSingles ? 2.5 : 5}
              strokeOpacity={isSingles ? 0.3 : 1}
            />
            <line
              x1={RIGHT_DOUBLES_LONG_X}
              y1={0}
              x2={RIGHT_DOUBLES_LONG_X}
              y2={COURT_WIDTH}
              stroke="#F8FAFC"
              strokeWidth={isSingles ? 2.5 : 5}
              strokeOpacity={isSingles ? 0.3 : 1}
            />
            <line
              x1={0}
              y1={CENTER_Y}
              x2={LEFT_SHORT_SERVICE_X}
              y2={CENTER_Y}
              stroke="#F8FAFC"
              strokeWidth={4.5}
            />
            <line
              x1={RIGHT_SHORT_SERVICE_X}
              y1={CENTER_Y}
              x2={COURT_LENGTH}
              y2={CENTER_Y}
              stroke="#F8FAFC"
              strokeWidth={4.5}
            />
            <line
              x1={NET_X}
              y1={-18}
              x2={NET_X}
              y2={COURT_WIDTH + 18}
              stroke="#F8FAFC"
              strokeWidth={7}
              strokeDasharray="18 10"
            />
          </g>

          {/* Connecting Trajectory Lines (transformed seamlessly with the court) */}
          {currentShots.map((shot, idx) => {
            if (idx === 0) return null;
            const prev = currentShots[idx - 1];
            const isDashed = shot.isGhost || prev.isGhost;
            return (
              <line
                key={`line_${shot.id}`}
                x1={prev.x}
                y1={prev.y}
                x2={shot.x}
                y2={shot.y}
                stroke={isDashed ? '#CBD5E1' : '#F8FAFC'}
                strokeWidth={isDashed ? 4 : 5}
                strokeOpacity={isDashed ? 0.65 : 0.85}
                strokeDasharray={isDashed ? '12 10' : undefined}
              />
            );
          })}
        </g>

        {/* Upright Match Info in Top 0.5m Surround */}
        {(() => {
          const gamesSuffix =
            matchState.completedGames.length > 0
              ? ` (${matchState.completedGames
                  .map((g) => `${g.scoreA}-${g.scoreB}`)
                  .join(', ')})`
              : '';
          const headerText = [
            matchState.config.tournamentName,
            matchState.config.matchName,
            matchState.config.courtName,
            getMatchCategoryDisplay(matchState.config),
            `${t('court.gameUpper')} ${matchState.currentGame}${gamesSuffix}`,
          ]
            .filter(Boolean)
            .join(' · ')
            .toUpperCase();
          const baseSize = isPortrait ? 19 : 22;
          const adaptiveFontSize =
            isPortrait && headerText.length > 46
              ? Math.max(13, Math.floor((baseSize * 46) / headerText.length))
              : !isPortrait && headerText.length > 90
                ? Math.max(15, Math.floor((baseSize * 90) / headerText.length))
                : baseSize;

          return (
            <g
              transform={`translate(${headerPos.x}, ${headerPos.y}) scale(${compX}, ${compY})`}
              pointerEvents="none"
            >
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#A7F3D0"
                fillOpacity={0.7}
                fontSize={adaptiveFontSize}
                fontWeight={700}
                fontFamily="Barlow Condensed, sans-serif"
                letterSpacing="0.06em"
              >
                {headerText}
              </text>
            </g>
          );
        })()}

        {/* Giant High-Contrast Background Scores (Upright & Aspect-Compensated) */}
        <g pointerEvents="none">
          <g
            transform={`translate(${half1ScorePos.x}, ${half1ScorePos.y}) scale(${compX}, ${compY})`}
          >
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFFFFF"
              fillOpacity={0.2}
              fontSize={isPortrait ? 200 : 230}
              fontWeight={800}
              fontFamily="Barlow Condensed, sans-serif"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {leftScore}
            </text>
          </g>

          <g
            transform={`translate(${half2ScorePos.x}, ${half2ScorePos.y}) scale(${compX}, ${compY})`}
          >
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFFFFF"
              fillOpacity={0.2}
              fontSize={isPortrait ? 200 : 230}
              fontWeight={800}
              fontFamily="Barlow Condensed, sans-serif"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {rightScore}
            </text>
          </g>

          {/* Set & Score Metadata Anchored Near Each Baseline */}
          <g
            transform={`translate(${half1MetaPos.x}, ${half1MetaPos.y}) scale(${compX}, ${compY})`}
          >
            <text
              x={0}
              y={0}
              textAnchor={isPortrait ? 'middle' : 'start'}
              dominantBaseline="central"
              fill={leftSide === serviceInfo.servingSide ? '#FBBF24' : '#E2E8F0'}
              fillOpacity={0.9}
              fontSize={isPortrait ? 19 : 21}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {t('court.sideUpper')} {leftSide} · {t('court.gamesUpper')}{' '}
              {leftGames} · {t('court.ptsUpper')} {leftScore}
            </text>
          </g>

          <g
            transform={`translate(${half2MetaPos.x}, ${half2MetaPos.y}) scale(${compX}, ${compY})`}
          >
            <text
              x={0}
              y={0}
              textAnchor={isPortrait ? 'middle' : 'end'}
              dominantBaseline="central"
              fill={rightSide === serviceInfo.servingSide ? '#FBBF24' : '#E2E8F0'}
              fillOpacity={0.9}
              fontSize={isPortrait ? 19 : 21}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {t('court.sideUpper')} {rightSide} · {t('court.gamesUpper')}{' '}
              {rightGames} · {t('court.ptsUpper')} {rightScore}
            </text>
          </g>
        </g>

        {/* Upright Serve Shuttlecock Icon inside Server's Highlighted Box */}
        {isIdle && (
          <g
            transform={`translate(${serveIconPos.x}, ${serveIconPos.y}) scale(${compX}, ${compY})`}
            pointerEvents="none"
          >
            <g transform="translate(0, 56)">
              <circle cx={0} cy={0} r={22} fill="#FBBF24" fillOpacity={0.94} />
              <path d="M-9 -10 L9 -10 L5 3 L-5 3 Z" fill="#051A15" />
              <circle cx={0} cy={7} r={5} fill="#051A15" />
            </g>
          </g>
        )}

        {/* Player Names Positioned Directly Inside Their Active Quadrants (Upright!) */}
        <g pointerEvents="none">
          {placements.map((pl) => {
            const screenPos = toScreen(pl.centerX, pl.centerY);
            const labelColor = pl.isServer
              ? '#FDE68A'
              : pl.isReceiver
                ? '#A7F3D0'
                : '#F8FAFC';
            const subLabel = pl.isServer
              ? t('court.servingUpper')
              : pl.isReceiver
                ? t('court.receivingUpper')
                : '';

            return (
              <g
                key={pl.player.id}
                transform={`translate(${screenPos.x}, ${screenPos.y}) scale(${compX}, ${compY})`}
              >
                <text
                  x={0}
                  y={-6}
                  textAnchor="middle"
                  fill={labelColor}
                  fontSize={isPortrait ? 24 : 30}
                  fontWeight={700}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#051A15',
                    strokeWidth: 6,
                    strokeLinejoin: 'round',
                  }}
                >
                  {pl.player.name}
                  {pl.player.nationality ? ` (${pl.player.nationality})` : ''}
                </text>
                {(subLabel || pl.player.club) && (
                  <text
                    x={0}
                    y={20}
                    textAnchor="middle"
                    fill={pl.isServer ? '#FBBF24' : '#CBD5E1'}
                    fillOpacity={0.92}
                    fontSize={isPortrait ? 15 : 17}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#051A15',
                      strokeWidth: 4.5,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {[subLabel, pl.player.club].filter(Boolean).join(' · ')}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Upright Circular Shot Nodes (Serve #1, Manual, Ghost, Last Landing Target) */}
        {currentShots.length > 0 && (
          <g pointerEvents="none">
            {currentShots.map((shot, idx) => {
              const screenPos = toScreen(shot.x, shot.y);
              const isServe = idx === 0;
              const isLast = idx === currentShots.length - 1;
              const radius = isServe ? 24 : isLast ? 22 : 18;

              let fill = '#0F172A';
              let stroke = '#F8FAFC';
              let textFill = '#F8FAFC';

              if (shot.isGhost) {
                fill = 'rgba(15, 23, 42, 0.48)';
                stroke = '#CBD5E1';
                textFill = '#E2E8F0';
              } else if (isServe) {
                fill = '#F59E0B';
                stroke = '#FFFBEB';
                textFill = '#051A15';
              } else if (isLast) {
                fill = '#34D399';
                stroke = '#FFFFFF';
                textFill = '#051A15';
              } else if (shot.isAutoCorrected) {
                fill = '#0284C7';
                stroke = '#BAE6FD';
                textFill = '#FFFFFF';
              }

              return (
                <g
                  key={shot.id}
                  transform={`translate(${screenPos.x}, ${screenPos.y}) scale(${compX}, ${compY})`}
                >
                  {isLast && (
                    <circle
                      cx={0}
                      cy={0}
                      r={isDraggingEnd ? 52 : 34}
                      fill="none"
                      stroke={isDraggingEnd ? '#FBBF24' : '#34D399'}
                      strokeWidth={isDraggingEnd ? 4.5 : 3}
                      strokeOpacity={isDraggingEnd ? 0.95 : 0.65}
                      strokeDasharray={isDraggingEnd ? undefined : '8 6'}
                    />
                  )}

                  {isLast && isDraggingEnd && (
                    <g stroke="#FBBF24" strokeWidth={2.5} opacity={0.85}>
                      <line x1={-72} y1={0} x2={-30} y2={0} />
                      <line x1={30} y1={0} x2={72} y2={0} />
                      <line x1={0} y1={-72} x2={0} y2={-30} />
                      <line x1={0} y1={30} x2={0} y2={72} />
                    </g>
                  )}

                  <circle
                    cx={0}
                    cy={0}
                    r={radius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={shot.isGhost ? 3 : 3.5}
                    strokeDasharray={shot.isGhost ? '7 5' : undefined}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textFill}
                    fontSize={20}
                    fontWeight={800}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {shot.shotNumber}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Quiet Bottom 0.5m Surround Hint ONLY when idle (never during active rally) */}
        {isIdle && (
          <g
            transform={`translate(${hintPos.x}, ${hintPos.y}) scale(${compX}, ${compY})`}
            pointerEvents="none"
          >
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#A7F3D0"
              fillOpacity={0.6}
              fontSize={isPortrait ? 16 : 19}
              fontWeight={600}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {t('court.idleHint')}
            </text>
          </g>
        )}
      </svg>

      {/* Live Drag Coordinate Readout during Free End-Point Adjustment */}
      {isDraggingEnd && dragCoords && (
        <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 rounded-xl border border-amber-400/60 bg-[#051A15]/90 px-4 py-1.5 font-mono text-xs font-semibold tabular-nums text-amber-300 shadow-lg">
          {t('court.landingReadout', { x: dragCoords.x, y: dragCoords.y })}
        </div>
      )}

      {/* Brief Transient Gesture Toast */}
      {feedbackBanner && !isDraggingEnd && (
        <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-500/50 bg-[#051A15]/90 px-4 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg">
          {feedbackBanner}
        </div>
      )}
    </div>
  );
};
