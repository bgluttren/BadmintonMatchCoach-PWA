import {
  AgeCategory,
  AgeCategoryGroup,
  CourtHalf,
  MatchClass,
  MatchConfig,
  MatchDiscipline,
  MatchEventNotice,
  MatchSnapshot,
  MatchState,
  PendingInterval,
  Player,
  RallyOutcome,
  RallyRecord,
  ServiceBox,
  ShotRecord,
  ShotType,
  Side,
} from '../types/match';

export interface DisciplineInfo {
  code: MatchDiscipline;
  matchClass: MatchClass;
  name: string;
}

export const DISCIPLINES: DisciplineInfo[] = [
  {
    code: 'MS',
    matchClass: 'singles',
    name: "Men's Singles",
  },
  {
    code: 'WS',
    matchClass: 'singles',
    name: "Women's Singles",
  },
  {
    code: 'MD',
    matchClass: 'doubles',
    name: "Men's Doubles",
  },
  {
    code: 'WD',
    matchClass: 'doubles',
    name: "Women's Doubles",
  },
  {
    code: 'XD',
    matchClass: 'doubles',
    name: 'Mixed Doubles',
  },
];

export const JUNIOR_AGE_CATEGORIES: AgeCategory[] = [
  'U11',
  'U13',
  'U15',
  'U17',
  'U19',
  'U22',
  'U23',
];

export const VETERAN_AGE_CATEGORIES: AgeCategory[] = [
  '35+',
  '40+',
  '45+',
  '50+',
  '55+',
  '60+',
  '65+',
  '70+',
  '75+',
  '80+',
];

export function getMatchClassForDiscipline(
  discipline: MatchDiscipline
): MatchClass {
  return discipline === 'MS' || discipline === 'WS' ? 'singles' : 'doubles';
}

export function getAgeCategoryGroup(
  ageCategory: AgeCategory
): AgeCategoryGroup {
  if (ageCategory === 'Open') return 'open';
  if (ageCategory.startsWith('U')) return 'junior';
  return 'veteran';
}

export function formatMatchCategoryCode(
  discipline: MatchDiscipline,
  ageCategory: AgeCategory
): string {
  if (ageCategory === 'Open') return discipline;
  if (ageCategory.startsWith('U')) return `${ageCategory} ${discipline}`;
  return `${discipline} ${ageCategory}`;
}

export function getMatchCategoryDisplay(config: MatchConfig): string {
  if (config.categoryCode) return config.categoryCode;
  if (config.discipline && config.ageCategory) {
    return formatMatchCategoryCode(config.discipline, config.ageCategory);
  }
  if (config.discipline) return config.discipline;
  return config.matchClass === 'singles' ? 'Singles' : 'Doubles';
}

// Official BWF Badminton Court dimensions in centimeters
export const COURT_LENGTH = 1340;
export const COURT_WIDTH = 610;
export const NET_X = 670;
export const CENTER_Y = 305;
export const SHORT_SERVICE_FROM_NET = 198;
export const LEFT_SHORT_SERVICE_X = NET_X - SHORT_SERVICE_FROM_NET; // 472
export const RIGHT_SHORT_SERVICE_X = NET_X + SHORT_SERVICE_FROM_NET; // 868
export const DOUBLES_LONG_SERVICE_INSET = 76;
export const LEFT_DOUBLES_LONG_X = DOUBLES_LONG_SERVICE_INSET; // 76
export const RIGHT_DOUBLES_LONG_X = COURT_LENGTH - DOUBLES_LONG_SERVICE_INSET; // 1264
export const SINGLES_SIDELINE_INSET = 46;
export const SINGLES_TOP_Y = SINGLES_SIDELINE_INSET; // 46
export const SINGLES_BOTTOM_Y = COURT_WIDTH - SINGLES_SIDELINE_INSET; // 564
export const LINE_WIDTH = 4;

// Outer court mat padding around BWF lines in cm (50cm = 0.5m)
export const MAT_PAD_X = 50;
export const MAT_PAD_Y = 50;
export const VIEWBOX_X = -MAT_PAD_X;
export const VIEWBOX_Y = -MAT_PAD_Y;
export const VIEWBOX_W = COURT_LENGTH + MAT_PAD_X * 2; // 1440
export const VIEWBOX_H = COURT_WIDTH + MAT_PAD_Y * 2; // 710

// Portrait mode (rotated 90° clockwise: width = 710, height = 1440)
export const PORTRAIT_VIEWBOX_X = -MAT_PAD_Y;
export const PORTRAIT_VIEWBOX_Y = -MAT_PAD_X;
export const PORTRAIT_VIEWBOX_W = COURT_WIDTH + MAT_PAD_Y * 2; // 710
export const PORTRAIT_VIEWBOX_H = COURT_LENGTH + MAT_PAD_X * 2; // 1440

export function oppositeSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

export function oppositeHalf(half: CourtHalf): CourtHalf {
  return half === 'left' ? 'right' : 'left';
}

export function getHalfForSide(
  side: Side,
  sideMapping: { left: Side; right: Side }
): CourtHalf {
  return sideMapping.left === side ? 'left' : 'right';
}

export function getSideForHalf(
  half: CourtHalf,
  sideMapping: { left: Side; right: Side }
): Side {
  return sideMapping[half];
}

export function createInitialMatchState(config: MatchConfig): MatchState {
  const { lineup } = config;
  const sideMapping: { left: Side; right: Side } =
    lineup.sideAHalf === 'left'
      ? { left: 'A', right: 'B' }
      : { left: 'B', right: 'A' };

  const servingSide = lineup.firstServerSide;
  const firstServerId =
    servingSide === 'A' ? lineup.teamABoxes.right : lineup.teamBBoxes.right;

  return {
    config,
    currentGame: 1,
    scoreA: 0,
    scoreB: 0,
    gamesWonA: 0,
    gamesWonB: 0,
    completedGames: [],
    sideMapping,
    servingSide,
    currentServerId: firstServerId,
    teamABoxes: { ...lineup.teamABoxes },
    teamBBoxes: { ...lineup.teamBBoxes },
    decidingIntervalSwitched: false,
    midGameIntervalTaken: false,
    matchWinner: null,
    rallies: [],
    pauseEvents: [],
    shuttlesUsed: 1,
    historyStack: [],
    lastEndsSwitchMessage: null,
    pendingInterval: null,
  };
}

export function takeSnapshot(state: MatchState): MatchSnapshot {
  return {
    currentGame: state.currentGame,
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    gamesWonA: state.gamesWonA,
    gamesWonB: state.gamesWonB,
    completedGames: state.completedGames.map((g) => ({ ...g })),
    sideMapping: { ...state.sideMapping },
    servingSide: state.servingSide,
    currentServerId: state.currentServerId,
    teamABoxes: { ...state.teamABoxes },
    teamBBoxes: { ...state.teamBBoxes },
    decidingIntervalSwitched: state.decidingIntervalSwitched,
    midGameIntervalTaken: Boolean(state.midGameIntervalTaken),
    matchWinner: state.matchWinner,
  };
}

export interface ActiveServiceInfo {
  servingSide: Side;
  receivingSide: Side;
  servingHalf: CourtHalf;
  receivingHalf: CourtHalf;
  activeBox: ServiceBox; // Same parity box for both server and receiver (diagonal on court)
  serverId: string;
  receiverId: string;
  serverRect: { x: number; y: number; width: number; height: number };
  receiverRect: { x: number; y: number; width: number; height: number };
}

/**
 * Computes exact BWF service box rectangles in court cm coordinates.
 * Note:
 * - On the LEFT half (facing right toward net):
 *   - Player's RIGHT box is bottom (y >= CENTER_Y)
 *   - Player's LEFT box is top (y < CENTER_Y)
 * - On the RIGHT half (facing left toward net):
 *   - Player's RIGHT box is top (y < CENTER_Y)
 *   - Player's LEFT box is bottom (y >= CENTER_Y)
 */
export function getServiceBoxRect(
  half: CourtHalf,
  box: ServiceBox,
  matchClass: 'singles' | 'doubles'
): { x: number; y: number; width: number; height: number } {
  const minY = matchClass === 'singles' ? SINGLES_TOP_Y : 0;
  const maxY = matchClass === 'singles' ? SINGLES_BOTTOM_Y : COURT_WIDTH;

  const isTop =
    (half === 'left' && box === 'left') ||
    (half === 'right' && box === 'right');

  const y = isTop ? minY : CENTER_Y;
  const height = isTop ? CENTER_Y - minY : maxY - CENTER_Y;

  if (half === 'left') {
    const startX = matchClass === 'doubles' ? LEFT_DOUBLES_LONG_X : 0;
    return {
      x: startX,
      y,
      width: LEFT_SHORT_SERVICE_X - startX,
      height,
    };
  } else {
    const endX =
      matchClass === 'doubles' ? RIGHT_DOUBLES_LONG_X : COURT_LENGTH;
    return {
      x: RIGHT_SHORT_SERVICE_X,
      y,
      width: endX - RIGHT_SHORT_SERVICE_X,
      height,
    };
  }
}

export function getActiveServiceInfo(state: MatchState): ActiveServiceInfo {
  const servingSide = state.servingSide;
  const receivingSide = oppositeSide(servingSide);
  const servingScore = servingSide === 'A' ? state.scoreA : state.scoreB;
  const activeBox: ServiceBox = servingScore % 2 === 0 ? 'right' : 'left';

  const servingHalf = getHalfForSide(servingSide, state.sideMapping);
  const receivingHalf = oppositeHalf(servingHalf);

  let serverId = state.currentServerId;
  let receiverId: string;

  if (state.config.matchClass === 'singles') {
    const serverPlayer = state.config.players.find((p) => p.side === servingSide);
    const receiverPlayer = state.config.players.find(
      (p) => p.side === receivingSide
    );
    serverId = serverPlayer?.id ?? serverId;
    receiverId = receiverPlayer?.id ?? '';
  } else {
    const servingBoxes =
      servingSide === 'A' ? state.teamABoxes : state.teamBBoxes;
    const receivingBoxes =
      receivingSide === 'A' ? state.teamABoxes : state.teamBBoxes;
    serverId = servingBoxes[activeBox];
    receiverId = receivingBoxes[activeBox];
  }

  return {
    servingSide,
    receivingSide,
    servingHalf,
    receivingHalf,
    activeBox,
    serverId,
    receiverId,
    serverRect: getServiceBoxRect(servingHalf, activeBox, state.config.matchClass),
    receiverRect: getServiceBoxRect(
      receivingHalf,
      activeBox,
      state.config.matchClass
    ),
  };
}

export interface CourtPlayerPlacement {
  player: Player;
  courtHalf: CourtHalf;
  box: ServiceBox;
  isTopQuadrant: boolean;
  isServer: boolean;
  isReceiver: boolean;
  centerX: number;
  centerY: number;
}

export function getPlayerScreenPlacements(
  state: MatchState
): CourtPlayerPlacement[] {
  const serviceInfo = getActiveServiceInfo(state);
  const placements: CourtPlayerPlacement[] = [];

  const getQuadrantCenter = (
    half: CourtHalf,
    box: ServiceBox,
    isSingles: boolean
  ) => {
    const isTop =
      (half === 'left' && box === 'left') ||
      (half === 'right' && box === 'right');
    const minY = isSingles ? SINGLES_TOP_Y : 0;
    const maxY = isSingles ? SINGLES_BOTTOM_Y : COURT_WIDTH;
    const y = isTop ? (minY + CENTER_Y) / 2 : (CENTER_Y + maxY) / 2;
    const x = half === 'left' ? 245 : 1095;
    return { x, y, isTop };
  };

  if (state.config.matchClass === 'singles') {
    (['A', 'B'] as Side[]).forEach((side) => {
      const player = state.config.players.find((p) => p.side === side);
      if (!player) return;
      const half = getHalfForSide(side, state.sideMapping);
      // In singles, both players align to the server's active service box parity
      const box = serviceInfo.activeBox;
      const pos = getQuadrantCenter(half, box, true);
      placements.push({
        player,
        courtHalf: half,
        box,
        isTopQuadrant: pos.isTop,
        isServer: player.id === serviceInfo.serverId,
        isReceiver: player.id === serviceInfo.receiverId,
        centerX: pos.x,
        centerY: pos.y,
      });
    });
  } else {
    (['A', 'B'] as Side[]).forEach((side) => {
      const boxes = side === 'A' ? state.teamABoxes : state.teamBBoxes;
      const half = getHalfForSide(side, state.sideMapping);
      (['right', 'left'] as ServiceBox[]).forEach((box) => {
        const player = state.config.players.find((p) => p.id === boxes[box]);
        if (!player) return;
        const pos = getQuadrantCenter(half, box, false);
        placements.push({
          player,
          courtHalf: half,
          box,
          isTopQuadrant: pos.isTop,
          isServer: player.id === serviceInfo.serverId,
          isReceiver: player.id === serviceInfo.receiverId,
          centerX: pos.x,
          centerY: pos.y,
        });
      });
    });
  }

  return placements;
}

/**
 * Estimates which player on the given half hit a shot based on quadrant Y position.
 */
function inferPlayerForShot(
  state: MatchState,
  half: CourtHalf,
  y: number,
  shotNumber: number,
  serviceInfo: ActiveServiceInfo
): { playerId: string | null; side: Side } {
  const side = getSideForHalf(half, state.sideMapping);
  if (shotNumber === 1) {
    return { playerId: serviceInfo.serverId, side };
  }
  if (shotNumber === 2) {
    return { playerId: serviceInfo.receiverId, side };
  }
  if (state.config.matchClass === 'singles') {
    const p = state.config.players.find((pl) => pl.side === side);
    return { playerId: p?.id ?? null, side };
  }
  const boxes = side === 'A' ? state.teamABoxes : state.teamBBoxes;
  const isTop = y < CENTER_Y;
  const box: ServiceBox =
    half === 'left' ? (isTop ? 'left' : 'right') : isTop ? 'right' : 'left';
  return { playerId: boxes[box], side };
}

/**
 * Clamps and mirrors an out-of-side tap onto the expected court half with clean court margin.
 */
function guardRailCoordinate(
  rawX: number,
  rawY: number,
  expectedHalf: CourtHalf,
  matchClass: 'singles' | 'doubles'
): { x: number; y: number; wasCorrected: boolean } {
  const netMargin = 28;
  const minY = matchClass === 'singles' ? SINGLES_TOP_Y + 18 : 22;
  const maxY = matchClass === 'singles' ? SINGLES_BOTTOM_Y - 18 : COURT_WIDTH - 22;

  const isOnExpectedSide =
    expectedHalf === 'left'
      ? rawX <= NET_X - netMargin
      : rawX >= NET_X + netMargin;

  let x = rawX;
  let y = rawY;
  let wasCorrected = false;

  if (!isOnExpectedSide) {
    wasCorrected = true;
    // Mirror across the net
    x = COURT_LENGTH - rawX;
    if (expectedHalf === 'left') {
      x = Math.max(45, Math.min(NET_X - netMargin, x));
    } else {
      x = Math.min(COURT_LENGTH - 45, Math.max(NET_X + netMargin, x));
    }
    y = Math.max(minY, Math.min(maxY, rawY));
  }

  return { x, y, wasCorrected };
}

/**
 * Generates a realistic randomized court coordinate on a given half for ghost shots.
 */
function randomCourtPosition(
  half: CourtHalf,
  matchClass: 'singles' | 'doubles'
): { x: number; y: number } {
  const minX = half === 'left' ? 95 : NET_X + 75;
  const maxX = half === 'left' ? NET_X - 75 : COURT_LENGTH - 95;
  const minY = matchClass === 'singles' ? SINGLES_TOP_Y + 38 : 38;
  const maxY =
    matchClass === 'singles' ? SINGLES_BOTTOM_Y - 38 : COURT_WIDTH - 38;

  const x = minX + Math.random() * (maxX - minX);
  const y = minY + Math.random() * (maxY - minY);
  return { x: Math.round(x), y: Math.round(y) };
}

export interface TapShotResult {
  addedShots: ShotRecord[];
  ghostCount: number;
  autoCorrected: boolean;
}

/**
 * Core Eyes-Free Shot Registration (Steps 1–4):
 * - Shot #1: Serve on serving half (auto-corrected if tapped on wrong side).
 * - Normal cadence (<= 3000ms): Alternates halves, applies Smart Guardrail if tapped on wrong half.
 * - Gap > 3000ms: Fills gap with ghost shots (~1 per 1.2s), adjusting count (+1/-1) so the resumed
 *   manual tap aligns naturally with the alternating half sequence!
 */
export function buildTapShots(
  state: MatchState,
  currentShots: ShotRecord[],
  rawX: number,
  rawY: number,
  now: number
): TapShotResult {
  const serviceInfo = getActiveServiceInfo(state);
  const actionGroupId = `grp_${now}_${Math.random().toString(36).slice(2, 7)}`;

  // Step 1: Serve (first shot)
  if (currentShots.length === 0) {
    const guarded = guardRailCoordinate(
      rawX,
      rawY,
      serviceInfo.servingHalf,
      state.config.matchClass
    );
    const serveShot: ShotRecord = {
      id: `shot_${now}_1`,
      shotNumber: 1,
      playerId: serviceInfo.serverId,
      side: serviceInfo.servingSide,
      courtHalf: serviceInfo.servingHalf,
      x: Math.round(guarded.x),
      y: Math.round(guarded.y),
      timestamp: now,
      isAutoCorrected: guarded.wasCorrected,
      isGhost: false,
      actionGroupId,
    };
    return {
      addedShots: [serveShot],
      ghostCount: 0,
      autoCorrected: guarded.wasCorrected,
    };
  }

  const prevShot = currentShots[currentShots.length - 1];
  const dt = now - prevShot.timestamp;

  // Step 3: Ghost Shots on interruption (> 3 seconds)
  if (dt > 3000) {
    const resumedHalf: CourtHalf = rawX < NET_X ? 'left' : 'right';
    let ghostCount = Math.max(1, Math.round(dt / 1200) - 1);

    // Check parity: after `ghostCount` alternating shots from prevShot.courtHalf,
    // the expected half for the resumed manual tap is:
    // If ghostCount is odd -> prevShot.courtHalf; if ghostCount is even -> oppositeHalf(prevShot.courtHalf)
    const expectedResumedHalf = (count: number): CourtHalf =>
      count % 2 === 1 ? prevShot.courtHalf : oppositeHalf(prevShot.courtHalf);

    if (expectedResumedHalf(ghostCount) !== resumedHalf) {
      // Adjust +1 or -1 so resumed manual tap lands on the matching alternating side
      if (ghostCount > 1) {
        const intervalMinus = dt / ghostCount; // (ghostCount - 1) ghosts -> ghostCount intervals
        const intervalPlus = dt / (ghostCount + 2);
        ghostCount =
          Math.abs(intervalMinus - 1200) <= Math.abs(intervalPlus - 1200)
            ? ghostCount - 1
            : ghostCount + 1;
      } else {
        ghostCount = ghostCount + 1;
      }
    }

    const addedShots: ShotRecord[] = [];
    const stepMs = dt / (ghostCount + 1);
    let currentHalf = prevShot.courtHalf;

    for (let i = 1; i <= ghostCount; i++) {
      currentHalf = oppositeHalf(currentHalf);
      const pos = randomCourtPosition(currentHalf, state.config.matchClass);
      const ghostTime = Math.round(prevShot.timestamp + stepMs * i);
      const shotNum = currentShots.length + i;
      const inferred = inferPlayerForShot(
        state,
        currentHalf,
        pos.y,
        shotNum,
        serviceInfo
      );
      addedShots.push({
        id: `shot_${ghostTime}_${shotNum}_ghost`,
        shotNumber: shotNum,
        playerId: inferred.playerId,
        side: inferred.side,
        courtHalf: currentHalf,
        x: pos.x,
        y: pos.y,
        timestamp: ghostTime,
        isAutoCorrected: false,
        isGhost: true,
        actionGroupId,
      });
    }

    const manualShotNum = currentShots.length + ghostCount + 1;
    const manualInferred = inferPlayerForShot(
      state,
      resumedHalf,
      rawY,
      manualShotNum,
      serviceInfo
    );
    addedShots.push({
      id: `shot_${now}_${manualShotNum}`,
      shotNumber: manualShotNum,
      playerId: manualInferred.playerId,
      side: manualInferred.side,
      courtHalf: resumedHalf,
      x: Math.round(rawX),
      y: Math.round(rawY),
      timestamp: now,
      isAutoCorrected: false,
      isGhost: false,
      actionGroupId,
    });

    return {
      addedShots,
      ghostCount,
      autoCorrected: false,
    };
  }

  // Step 2 & 4: Normal rhythm (<= 3000ms) with Smart Guardrail
  const expectedHalf = oppositeHalf(prevShot.courtHalf);
  const guarded = guardRailCoordinate(
    rawX,
    rawY,
    expectedHalf,
    state.config.matchClass
  );
  const nextShotNum = currentShots.length + 1;
  const inferred = inferPlayerForShot(
    state,
    expectedHalf,
    guarded.y,
    nextShotNum,
    serviceInfo
  );

  const nextShot: ShotRecord = {
    id: `shot_${now}_${nextShotNum}`,
    shotNumber: nextShotNum,
    playerId: inferred.playerId,
    side: inferred.side,
    courtHalf: expectedHalf,
    x: Math.round(guarded.x),
    y: Math.round(guarded.y),
    timestamp: now,
    isAutoCorrected: guarded.wasCorrected,
    isGhost: false,
    actionGroupId,
  };

  return {
    addedShots: [nextShot],
    ghostCount: 0,
    autoCorrected: guarded.wasCorrected,
  };
}

/**
 * Infers which side hit the finishing shot (the shot before the landing point)
 * and who wins the rally based on IN / OUT / FAULT / LET.
 */
export function inferRallyResultDefaults(
  state: MatchState,
  shots: ShotRecord[],
  outcome: RallyOutcome
): {
  finishingSide: Side;
  finishingPlayerId: string | null;
  winningSide: Side | null;
} {
  const serviceInfo = getActiveServiceInfo(state);
  if (outcome === 'LET') {
    return {
      finishingSide: serviceInfo.servingSide,
      finishingPlayerId: serviceInfo.serverId,
      winningSide: null,
    };
  }

  // Point N is the landing spot; Point N-1 is the stroke that produced it.
  // If only 1 shot exists, the server hit the finishing shot.
  const finishingShot =
    shots.length >= 2 ? shots[shots.length - 2] : shots[0];

  const finishingSide: Side =
    finishingShot?.side ?? serviceInfo.servingSide;
  const finishingPlayerId =
    finishingShot?.playerId ?? serviceInfo.serverId;

  const winningSide: Side =
    outcome === 'IN' ? finishingSide : oppositeSide(finishingSide);

  return {
    finishingSide,
    finishingPlayerId,
    winningSide,
  };
}

export function isGameWon(
  scoreA: number,
  scoreB: number,
  pointsPerGame: number,
  maxPoints: number
): Side | null {
  const max = Math.max(scoreA, scoreB);
  const diff = Math.abs(scoreA - scoreB);
  if (max >= maxPoints) {
    return scoreA > scoreB ? 'A' : 'B';
  }
  if (max >= pointsPerGame && diff >= 2) {
    return scoreA > scoreB ? 'A' : 'B';
  }
  return null;
}

export function applyRallyOutcome(
  state: MatchState,
  finalizedShots: ShotRecord[],
  outcome: RallyOutcome,
  finishingShotType: ShotType | null,
  isBackhand: boolean,
  isDeception: boolean,
  winningSide: Side | null,
  finishingPlayerId: string | null
): MatchState {
  const serviceInfo = getActiveServiceInfo(state);
  const firstTime = finalizedShots[0]?.timestamp ?? Date.now();
  const lastTime =
    finalizedShots[finalizedShots.length - 1]?.timestamp ?? firstTime;

  // LET: Reset rally without changing score or positions
  if (outcome === 'LET' || !winningSide) {
    const letRally: RallyRecord = {
      id: `rally_${Date.now()}`,
      rallyNumber: state.rallies.length + 1,
      gameNumber: state.currentGame,
      scoreBefore: { A: state.scoreA, B: state.scoreB },
      scoreAfter: { A: state.scoreA, B: state.scoreB },
      servingSide: serviceInfo.servingSide,
      serverId: serviceInfo.serverId,
      receiverId: serviceInfo.receiverId,
      shots: finalizedShots,
      outcome: 'LET',
      finishingShotType,
      isBackhand,
      isDeception,
      finishingPlayerId,
      winningSide: null,
      durationMs: Math.max(0, lastTime - firstTime),
      timestamp: Date.now(),
    };
    return {
      ...state,
      rallies: [...state.rallies, letRally],
      lastEndsSwitchMessage: 'Let called · Replay point',
      lastEvent: { key: 'engineEvents.letCalled' },
    };
  }

  const prevSnapshot = takeSnapshot(state);
  const nextScoreA = state.scoreA + (winningSide === 'A' ? 1 : 0);
  const nextScoreB = state.scoreB + (winningSide === 'B' ? 1 : 0);

  const rallyRecord: RallyRecord = {
    id: `rally_${Date.now()}`,
    rallyNumber: state.rallies.length + 1,
    gameNumber: state.currentGame,
    scoreBefore: { A: state.scoreA, B: state.scoreB },
    scoreAfter: { A: nextScoreA, B: nextScoreB },
    servingSide: serviceInfo.servingSide,
    serverId: serviceInfo.serverId,
    receiverId: serviceInfo.receiverId,
    shots: finalizedShots,
    outcome,
    finishingShotType,
    isBackhand,
    isDeception,
    finishingPlayerId,
    winningSide,
    durationMs: Math.max(0, lastTime - firstTime),
    timestamp: Date.now(),
  };

  // BWF Official Rotation Rules
  let nextServingSide: Side = state.servingSide;
  let nextTeamABoxes = { ...state.teamABoxes };
  let nextTeamBBoxes = { ...state.teamBBoxes };
  let nextServerId = state.currentServerId;

  if (state.config.matchClass === 'singles') {
    nextServingSide = winningSide;
    const serverPlayer = state.config.players.find(
      (p) => p.side === nextServingSide
    );
    nextServerId = serverPlayer?.id ?? '';
  } else {
    if (winningSide === state.servingSide) {
      // Serving side won: ONLY serving team swaps right/left boxes, same player keeps serving
      if (state.servingSide === 'A') {
        nextTeamABoxes = {
          right: state.teamABoxes.left,
          left: state.teamABoxes.right,
        };
      } else {
        nextTeamBBoxes = {
          right: state.teamBBoxes.left,
          left: state.teamBBoxes.right,
        };
      }
      nextServingSide = state.servingSide;
      nextServerId = serviceInfo.serverId;
    } else {
      // Receiving side won (Service Over): NO ONE swaps boxes!
      // Player standing in parity box of new serving side's new score becomes server
      nextServingSide = winningSide;
      const newServingScore = nextServingSide === 'A' ? nextScoreA : nextScoreB;
      const boxNeeded: ServiceBox =
        newServingScore % 2 === 0 ? 'right' : 'left';
      nextServerId =
        nextServingSide === 'A'
          ? nextTeamABoxes[boxNeeded]
          : nextTeamBBoxes[boxNeeded];
    }
  }

  let nextSideMapping = { ...state.sideMapping };
  let nextGame = state.currentGame;
  let finalScoreA = nextScoreA;
  let finalScoreB = nextScoreB;
  let nextGamesWonA = state.gamesWonA;
  let nextGamesWonB = state.gamesWonB;
  let nextCompletedGames = [...state.completedGames];
  let nextDecidingSwitch = state.decidingIntervalSwitched;
  let nextMidGameIntervalTaken = Boolean(state.midGameIntervalTaken);
  let nextMatchWinner: Side | null = null;
  let endsSwitchMsg: string | null = null;
  let lastEvent: MatchEventNotice | null = null;
  let pendingInterval: PendingInterval | null = null;

  const {
    pointsPerGame,
    maxPoints,
    gamesToWin,
    bwfIntervalsEnabled,
    midGameIntervalSec,
    betweenGameIntervalSec,
  } = state.config.rules;
  const intervalsEnabled = bwfIntervalsEnabled !== false;
  const midIntervalSec = midGameIntervalSec ?? 60;
  const gameIntervalSec = betweenGameIntervalSec ?? 120;
  const gameWinner = isGameWon(nextScoreA, nextScoreB, pointsPerGame, maxPoints);

  if (gameWinner) {
    nextCompletedGames.push({
      gameNumber: state.currentGame,
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      winner: gameWinner,
    });
    if (gameWinner === 'A') nextGamesWonA += 1;
    else nextGamesWonB += 1;

    if (nextGamesWonA >= gamesToWin) {
      nextMatchWinner = 'A';
    } else if (nextGamesWonB >= gamesToWin) {
      nextMatchWinner = 'B';
    } else {
      // Move to next game & Change of Ends (BWF Law 8.1.1 / 8.1.2)
      nextGame += 1;
      finalScoreA = 0;
      finalScoreB = 0;
      nextSideMapping = {
        left: state.sideMapping.right,
        right: state.sideMapping.left,
      };
      // Winner of preceding game serves first in next game
      nextServingSide = gameWinner;
      if (state.config.matchClass === 'singles') {
        nextServerId =
          state.config.players.find((p) => p.side === nextServingSide)?.id ??
          '';
      } else {
        // At 0-0 (even), player in right box serves
        nextServerId =
          nextServingSide === 'A'
            ? nextTeamABoxes.right
            : nextTeamBBoxes.right;
      }
      nextDecidingSwitch = false;
      nextMidGameIntervalTaken = false;
      endsSwitchMsg = `Game ${state.currentGame} complete · Change of ends`;
      lastEvent = {
        key: 'engineEvents.gameCompleteSwitch',
        params: { game: state.currentGame },
      };

      if (intervalsEnabled && gameIntervalSec > 0) {
        pendingInterval = {
          kind: 'between_games',
          durationSeconds: gameIntervalSec,
          gameNumber: state.currentGame,
          nextGameNumber: nextGame,
          pointsAtInterval: Math.max(nextScoreA, nextScoreB),
          changeOfEnds: true,
        };
      }
    }
  } else {
    // Mid-game interval at half-way point (e.g. 11 in 21-pt game, BWF Law 16.2.1)
    // and Change of Ends in the deciding game (BWF Law 8.1.3)
    const maxGames = gamesToWin * 2 - 1;
    const isDecidingGame =
      state.currentGame === maxGames ||
      (nextGamesWonA === gamesToWin - 1 && nextGamesWonB === gamesToWin - 1);
    const intervalTarget = Math.ceil(pointsPerGame / 2); // 11 for 21-pt game
    const reachedInterval =
      !nextMidGameIntervalTaken &&
      Math.max(nextScoreA, nextScoreB) === intervalTarget;

    if (reachedInterval) {
      nextMidGameIntervalTaken = true;
      let changedEndsAtMidGame = false;

      if (isDecidingGame && !nextDecidingSwitch) {
        nextSideMapping = {
          left: state.sideMapping.right,
          right: state.sideMapping.left,
        };
        nextDecidingSwitch = true;
        changedEndsAtMidGame = true;
        endsSwitchMsg = `${intervalTarget} pts in deciding game · Change of ends`;
        lastEvent = {
          key: 'engineEvents.decidingIntervalSwitch',
          params: { points: intervalTarget },
        };
      } else if (intervalsEnabled) {
        endsSwitchMsg = `${intervalTarget} pts · Mid-game interval`;
        lastEvent = {
          key: 'engineEvents.midGameInterval',
          params: { points: intervalTarget },
        };
      }

      if (intervalsEnabled && midIntervalSec > 0) {
        pendingInterval = {
          kind: 'mid_game',
          durationSeconds: midIntervalSec,
          gameNumber: state.currentGame,
          pointsAtInterval: intervalTarget,
          changeOfEnds: changedEndsAtMidGame,
        };
      }
    }
  }

  return {
    ...state,
    currentGame: nextGame,
    scoreA: finalScoreA,
    scoreB: finalScoreB,
    gamesWonA: nextGamesWonA,
    gamesWonB: nextGamesWonB,
    completedGames: nextCompletedGames,
    sideMapping: nextSideMapping,
    servingSide: nextServingSide,
    currentServerId: nextServerId,
    teamABoxes: nextTeamABoxes,
    teamBBoxes: nextTeamBBoxes,
    decidingIntervalSwitched: nextDecidingSwitch,
    midGameIntervalTaken: nextMidGameIntervalTaken,
    matchWinner: nextMatchWinner,
    rallies: [...state.rallies, rallyRecord],
    historyStack: [...state.historyStack, prevSnapshot],
    lastEndsSwitchMessage: endsSwitchMsg,
    lastEvent,
    pendingInterval,
  };
}

export function undoLastCompletedRally(state: MatchState): MatchState {
  if (state.termination) {
    const term = state.termination;
    return {
      ...state,
      matchWinner: term.previousMatchWinner,
      termination: null,
      pauseEvents: state.pauseEvents.filter((p) => p.id !== term.pauseEventId),
      lastEndsSwitchMessage: 'Undid walkover / disqualification',
      lastEvent: { key: 'engineEvents.undidMatchTermination' },
    };
  }
  if (state.rallies.length === 0) return state;
  const lastRally = state.rallies[state.rallies.length - 1];
  if (lastRally.outcome === 'LET') {
    return {
      ...state,
      rallies: state.rallies.slice(0, -1),
      lastEndsSwitchMessage: 'Undid last Let rally',
      lastEvent: { key: 'engineEvents.undidLet' },
    };
  }
  if (state.historyStack.length === 0) return state;
  const prev = state.historyStack[state.historyStack.length - 1];
  return {
    ...state,
    ...prev,
    rallies: state.rallies.slice(0, -1),
    historyStack: state.historyStack.slice(0, -1),
    lastEndsSwitchMessage: 'Last rally undone',
    lastEvent: { key: 'engineEvents.lastRallyUndone' },
  };
}
