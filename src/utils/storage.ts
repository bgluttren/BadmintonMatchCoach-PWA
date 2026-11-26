import {
  AgeCategory,
  CourtHalf,
  IntervalKind,
  MatchClass,
  MatchDiscipline,
  MatchRules,
  MatchState,
  RallyOutcome,
  ShotRecord,
  ShotType,
  Side,
} from '../types/match';

const ACTIVE_MATCH_KEY = 'badminton_match_coach_active_v1';
const ACTIVE_SESSION_KEY = 'badminton_match_coach_session_v1';
const RALLY_DRAFT_KEY = 'badminton_match_coach_rally_draft_v1';
const SETUP_DRAFT_KEY = 'badminton_match_coach_setup_draft_v1';
const LAST_MATCH_RULES_KEY = 'badminton_match_coach_last_rules_v1';
const SAVED_MATCHES_KEY = 'badminton_match_coach_archive_v1';

const IDB_NAME = 'BadmintonMatchCoachDB';
const IDB_VERSION = 1;
const IDB_STORE_KV = 'kv';
const IDB_STORE_ARCHIVE = 'archived_matches';

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openIDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_KV)) {
          db.createObjectStore(IDB_STORE_KV);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_ARCHIVE)) {
          db.createObjectStore(IDB_STORE_ARCHIVE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbPut(
  storeName: string,
  key: string,
  value: unknown
): Promise<void> {
  try {
    const db = await openIDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB failure
  }
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  try {
    const db = await openIDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB failure
  }
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openIDB();
    if (!db) return null;
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openIDB();
    if (!db) return [];
    return await new Promise<T[]>((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
  return false;
}

export type ActiveModalType = 'none' | 'result' | 'pause' | 'analyse';

export interface ResultDraftState {
  step: 'A' | 'B';
  outcome: RallyOutcome;
  winningSide: Side | null;
  finishingSide: Side;
  finishingPlayerId: string | null;
  selectedShotType: ShotType;
  isBackhand: boolean;
  isDeception: boolean;
}

export type PauseSubView =
  | 'menu'
  | 'umpire'
  | 'cleaning'
  | 'shuttle'
  | 'video';

export interface PauseDraftState {
  subView: PauseSubView;
  timerStartedAt: number | null;
  openedAt?: number | null;
  selectedCleaning?: boolean;
  selectedShuttleChange?: boolean;
  selectedOther?: boolean;
  selectedInterval?: boolean;
  otherNote?: string;
  countdownDurationSec?: number | null;
  intervalKind?: IntervalKind | null;
  intervalGameNumber?: number;
  intervalNextGameNumber?: number;
  intervalPoints?: number;
  intervalChangeOfEnds?: boolean;
}

export interface CorrectionTimingState {
  remainingTimestamps: number[];
  lastRealTapAt: number | null;
}

export interface ActiveSessionState {
  viewMode: 'setup' | 'court';
  matchState: MatchState | null;
  currentShots: ShotRecord[];
  redoStack: ShotRecord[][];
  correctionTiming?: CorrectionTimingState | null;
  activeModal: ActiveModalType;
  resultDraft: ResultDraftState | null;
  pauseDraft: PauseDraftState | null;
  updatedAt: number;
}

export interface RallyDraftPayload {
  matchId: string;
  currentShots: ShotRecord[];
  redoStack: ShotRecord[][];
  correctionTiming?: CorrectionTimingState | null;
  updatedAt: number;
}

export interface PlayerDraft {
  name: string;
  club: string;
  nationality: string;
}

export interface MatchSetupDraft {
  matchName: string;
  tournamentName?: string;
  courtName?: string;
  umpireName?: string;
  matchClass: MatchClass;
  discipline?: MatchDiscipline;
  ageCategory?: AgeCategory;
  pA1: PlayerDraft;
  pA2: PlayerDraft;
  pB1: PlayerDraft;
  pB2: PlayerDraft;
  gamesToWin: number;
  pointsPerGame: number;
  maxPoints: number;
  bwfIntervalsEnabled?: boolean;
  midGameIntervalSec?: number;
  betweenGameIntervalSec?: number;
  firstServerSide: Side;
  sideAHalf: CourtHalf;
  teamARightServer: '1' | '2';
  teamBRightServer: '1' | '2';
}

export function saveRallyDraft(
  matchId: string,
  currentShots: ShotRecord[],
  redoStack: ShotRecord[][],
  updatedAt: number = Date.now(),
  correctionTiming: CorrectionTimingState | null = null
): void {
  const payload: RallyDraftPayload = {
    matchId,
    currentShots,
    redoStack,
    correctionTiming,
    updatedAt,
  };
  try {
    localStorage.setItem(RALLY_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore
  }
  void idbPut(IDB_STORE_KV, 'rally_draft', payload);
}

export function clearRallyDraft(): void {
  try {
    localStorage.removeItem(RALLY_DRAFT_KEY);
  } catch {
    // Ignore
  }
  void idbDelete(IDB_STORE_KV, 'rally_draft');
}

function loadRallyDraft(): RallyDraftPayload | null {
  try {
    const raw = localStorage.getItem(RALLY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RallyDraftPayload>;
    if (!parsed || typeof parsed.matchId !== 'string') return null;
    return {
      matchId: parsed.matchId,
      currentShots: Array.isArray(parsed.currentShots) ? parsed.currentShots : [],
      redoStack: Array.isArray(parsed.redoStack) ? parsed.redoStack : [],
      correctionTiming: parsed.correctionTiming ?? null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActiveSessionState): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    if (session.matchState) {
      localStorage.setItem(
        ACTIVE_MATCH_KEY,
        JSON.stringify(session.matchState)
      );
      saveRallyDraft(
        session.matchState.config.id,
        session.currentShots,
        session.redoStack,
        session.updatedAt,
        session.correctionTiming ?? null
      );
    } else {
      localStorage.removeItem(ACTIVE_MATCH_KEY);
      clearRallyDraft();
    }
  } catch {
    // Storage quota fallback silently ignored
  }
  void idbPut(IDB_STORE_KV, 'active_session', session);
}

export function loadActiveSession(): ActiveSessionState | null {
  try {
    const rallyDraft = loadRallyDraft();
    const rawSession = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as Partial<ActiveSessionState>;
      if (parsed && typeof parsed === 'object') {
        const sessionUpdatedAt =
          typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now();
        const matchState = parsed.matchState ?? null;
        const useRallyDraft =
          !!rallyDraft &&
          !!matchState &&
          rallyDraft.matchId === matchState.config.id &&
          rallyDraft.updatedAt >= sessionUpdatedAt;

        return {
          viewMode:
            parsed.viewMode === 'court' && matchState ? 'court' : 'setup',
          matchState,
          currentShots: useRallyDraft
            ? rallyDraft.currentShots
            : Array.isArray(parsed.currentShots)
              ? parsed.currentShots
              : [],
          redoStack: useRallyDraft
            ? rallyDraft.redoStack
            : Array.isArray(parsed.redoStack)
              ? parsed.redoStack
              : [],
          correctionTiming: useRallyDraft
            ? (rallyDraft.correctionTiming ?? null)
            : (parsed.correctionTiming ?? null),
          activeModal: parsed.activeModal ?? 'none',
          resultDraft: parsed.resultDraft ?? null,
          pauseDraft: parsed.pauseDraft ?? null,
          updatedAt: useRallyDraft ? rallyDraft.updatedAt : sessionUpdatedAt,
        };
      }
    }

    // Legacy fallback if only ACTIVE_MATCH_KEY existed
    const legacyMatch = loadActiveMatch();
    if (legacyMatch) {
      const useRallyDraft =
        !!rallyDraft && rallyDraft.matchId === legacyMatch.config.id;
      return {
        viewMode: 'court',
        matchState: legacyMatch,
        currentShots: useRallyDraft ? rallyDraft.currentShots : [],
        redoStack: useRallyDraft ? rallyDraft.redoStack : [],
        correctionTiming: useRallyDraft
          ? (rallyDraft.correctionTiming ?? null)
          : null,
        activeModal: 'none',
        resultDraft: null,
        pauseDraft: null,
        updatedAt: useRallyDraft ? rallyDraft.updatedAt : Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function saveSetupDraft(draft: MatchSetupDraft): void {
  try {
    localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore
  }
}

export function loadSetupDraft(): MatchSetupDraft | null {
  try {
    const raw = localStorage.getItem(SETUP_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchSetupDraft;
  } catch {
    return null;
  }
}

export function clearSetupDraft(): void {
  try {
    localStorage.removeItem(SETUP_DRAFT_KEY);
  } catch {
    // Ignore
  }
}

export function saveLastMatchRules(rules: MatchRules): void {
  try {
    localStorage.setItem(LAST_MATCH_RULES_KEY, JSON.stringify(rules));
  } catch {
    // Ignore
  }
}

export function loadLastMatchRules(): MatchRules | null {
  try {
    const raw = localStorage.getItem(LAST_MATCH_RULES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MatchRules>;
    if (
      !parsed ||
      typeof parsed.gamesToWin !== 'number' ||
      typeof parsed.pointsPerGame !== 'number' ||
      typeof parsed.maxPoints !== 'number'
    ) {
      return null;
    }
    return {
      gamesToWin: parsed.gamesToWin,
      pointsPerGame: parsed.pointsPerGame,
      maxPoints: parsed.maxPoints,
      bwfIntervalsEnabled: parsed.bwfIntervalsEnabled ?? true,
      midGameIntervalSec: parsed.midGameIntervalSec ?? 60,
      betweenGameIntervalSec: parsed.betweenGameIntervalSec ?? 120,
    };
  } catch {
    return null;
  }
}

export function saveActiveMatch(state: MatchState): void {
  try {
    localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(state));
  } catch {
    // Storage quota fallback silently ignored
  }
}

export function loadActiveMatch(): MatchState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_MATCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchState;
  } catch {
    return null;
  }
}

export function clearActiveMatch(): void {
  try {
    localStorage.removeItem(ACTIVE_MATCH_KEY);
  } catch {
    // Ignore
  }
}

export function archiveMatch(state: MatchState): void {
  try {
    const existing = loadArchivedMatches();
    const filtered = existing.filter((m) => m.config.id !== state.config.id);
    const updated = [state, ...filtered].slice(0, 20);
    localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  void idbPut(IDB_STORE_ARCHIVE, state.config.id, state);
}

export function loadArchivedMatches(): MatchState[] {
  try {
    const raw = localStorage.getItem(SAVED_MATCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MatchState[];
  } catch {
    return [];
  }
}

export async function hydrateFromIndexedDB(): Promise<{
  session: ActiveSessionState | null;
  archivedMatches: MatchState[] | null;
}> {
  const [idbSession, idbRally, idbArchived] = await Promise.all([
    idbGet<ActiveSessionState>(IDB_STORE_KV, 'active_session'),
    idbGet<RallyDraftPayload>(IDB_STORE_KV, 'rally_draft'),
    idbGetAll<MatchState>(IDB_STORE_ARCHIVE),
  ]);

  let resolvedSession: ActiveSessionState | null = null;
  if (idbSession && idbSession.matchState) {
    const useRally =
      !!idbRally &&
      idbRally.matchId === idbSession.matchState.config.id &&
      idbRally.updatedAt >= idbSession.updatedAt;
    resolvedSession = {
      ...idbSession,
      currentShots: useRally ? idbRally.currentShots : idbSession.currentShots,
      redoStack: useRally ? idbRally.redoStack : idbSession.redoStack,
      correctionTiming: useRally
        ? (idbRally.correctionTiming ?? null)
        : (idbSession.correctionTiming ?? null),
      updatedAt: useRally ? idbRally.updatedAt : idbSession.updatedAt,
    };
  }

  let resolvedArchive: MatchState[] | null = null;
  if (idbArchived.length > 0) {
    const localArchived = loadArchivedMatches();
    const map = new Map<string, MatchState>();
    localArchived.forEach((m) => map.set(m.config.id, m));
    idbArchived.forEach((m) => {
      const existing = map.get(m.config.id);
      if (!existing || m.rallies.length >= existing.rallies.length) {
        map.set(m.config.id, m);
      }
    });
    const merged = Array.from(map.values()).sort(
      (a, b) => b.config.createdAt - a.config.createdAt
    );
    try {
      localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(merged.slice(0, 20)));
    } catch {
      // Ignore
    }
    resolvedArchive = merged;
  }

  return {
    session: resolvedSession,
    archivedMatches: resolvedArchive,
  };
}

export function exportMatchAsJSON(state: MatchState): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'BadmintonMatchCoach',
    matchConfig: state.config,
    scoreSummary: {
      currentGame: state.currentGame,
      scoreA: state.scoreA,
      scoreB: state.scoreB,
      gamesWonA: state.gamesWonA,
      gamesWonB: state.gamesWonB,
      completedGames: state.completedGames,
      matchWinner: state.matchWinner,
      shuttlesUsed: state.shuttlesUsed,
    },
    rallies: state.rallies,
    pauseEvents: state.pauseEvents,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const safeName = (state.config.matchName || 'match')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `badmintonmatchcoach_${safeName}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
