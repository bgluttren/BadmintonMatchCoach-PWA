export type MatchClass = 'singles' | 'doubles';
export type MatchDiscipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';
export type AgeCategoryGroup = 'open' | 'junior' | 'veteran';
export type AgeCategory =
  | 'Open'
  | 'U11'
  | 'U13'
  | 'U15'
  | 'U17'
  | 'U19'
  | 'U22'
  | 'U23'
  | '35+'
  | '40+'
  | '45+'
  | '50+'
  | '55+'
  | '60+'
  | '65+'
  | '70+'
  | '75+'
  | '80+';

export type Side = 'A' | 'B';
export type CourtHalf = 'left' | 'right';
export type ServiceBox = 'right' | 'left';

export type RallyOutcome = 'IN' | 'OUT' | 'LET' | 'FAULT';

export type ShotType =
  | 'Smash'
  | 'Clear'
  | 'Drop'
  | 'Net Stop'
  | 'Drive'
  | 'Lift'
  | 'Serve';

export interface Player {
  id: string;
  name: string;
  club: string;
  nationality: string;
  side: Side;
}

export interface MatchRules {
  gamesToWin: number; // e.g., 2 for Best of 3
  pointsPerGame: number; // standard 21
  maxPoints: number; // standard 30
  bwfIntervalsEnabled?: boolean; // official BWF mid-game & between-game pauses
  midGameIntervalSec?: number; // default 60s
  betweenGameIntervalSec?: number; // default 120s
}

export interface StartingLineup {
  firstServerSide: Side;
  sideAHalf: CourtHalf;
  // Player IDs occupying right & left service boxes when facing the net
  teamABoxes: {
    right: string;
    left: string;
  };
  teamBBoxes: {
    right: string;
    left: string;
  };
}

export interface MatchConfig {
  id: string;
  matchName: string;
  tournamentName?: string;
  courtName?: string;
  umpireName?: string;
  matchClass: MatchClass;
  discipline?: MatchDiscipline;
  ageCategory?: AgeCategory;
  categoryCode?: string;
  createdAt: number;
  players: Player[];
  rules: MatchRules;
  lineup: StartingLineup;
}

export interface ShotRecord {
  id: string;
  shotNumber: number;
  playerId: string | null;
  side: Side | null;
  courtHalf: CourtHalf;
  x: number; // 0..1340 court cm (can extend outside for OUT)
  y: number; // 0..610 court cm (can extend outside for OUT)
  timestamp: number;
  isAutoCorrected: boolean;
  isGhost: boolean;
  actionGroupId: string; // Groups a manual tap + any generated ghosts for atomic Undo/Redo
}

export interface GameScore {
  gameNumber: number;
  scoreA: number;
  scoreB: number;
  winner: Side | null;
}

export interface RallyRecord {
  id: string;
  rallyNumber: number;
  gameNumber: number;
  scoreBefore: { A: number; B: number };
  scoreAfter: { A: number; B: number };
  servingSide: Side;
  serverId: string;
  receiverId: string;
  shots: ShotRecord[];
  outcome: RallyOutcome;
  finishingShotType: ShotType | null;
  isBackhand: boolean;
  isDeception: boolean;
  finishingPlayerId: string | null;
  winningSide: Side | null; // null for LET
  durationMs: number;
  timestamp: number;
}

export type PauseEventType =
  | 'Umpire Call'
  | 'Cleaning'
  | 'Shuttle Change'
  | 'Video Call'
  | 'Interval'
  | 'Other'
  | 'Combined';

export type PauseReason =
  | 'Cleaning'
  | 'Shuttle Change'
  | 'Interval'
  | 'Other'
  | 'Umpire Call'
  | 'Video Call';

export interface PauseEvent {
  id: string;
  type: PauseEventType;
  reasons?: PauseReason[];
  detail: string;
  note?: string;
  playerId?: string;
  playerName?: string;
  gameNumber: number;
  afterRallyNumber?: number;
  scoreAtEvent: { A: number; B: number };
  timestamp: number;
  durationMs?: number;
}

export type MatchTerminationReason = 'WO' | 'Black Card';

export interface MatchTermination {
  reason: MatchTerminationReason;
  playerId: string;
  playerName: string;
  offendingSide: Side;
  winningSide: Side;
  pauseEventId: string;
  previousMatchWinner: Side | null;
}

export type IntervalKind = 'mid_game' | 'between_games';

export interface PendingInterval {
  kind: IntervalKind;
  durationSeconds: number;
  gameNumber: number;
  nextGameNumber?: number;
  pointsAtInterval: number;
  changeOfEnds: boolean;
}

export interface MatchSnapshot {
  currentGame: number;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  completedGames: GameScore[];
  sideMapping: {
    left: Side;
    right: Side;
  };
  servingSide: Side;
  currentServerId: string;
  teamABoxes: { right: string; left: string };
  teamBBoxes: { right: string; left: string };
  decidingIntervalSwitched: boolean;
  midGameIntervalTaken?: boolean;
  matchWinner: Side | null;
}

export interface MatchEventNotice {
  key: string;
  params?: Record<string, string | number>;
}

export interface MatchState extends MatchSnapshot {
  config: MatchConfig;
  rallies: RallyRecord[];
  pauseEvents: PauseEvent[];
  shuttlesUsed: number;
  historyStack: MatchSnapshot[];
  lastEndsSwitchMessage: string | null;
  lastEvent?: MatchEventNotice | null;
  termination?: MatchTermination | null;
  pendingInterval?: PendingInterval | null;
}
