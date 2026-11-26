/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyseModal } from './components/AnalyseModal';
import { BadmintonCourt } from './components/BadmintonCourt';
import { InAppBrowserBreakout } from './components/InAppBrowserBreakout';
import { MatchCompleteModal } from './components/MatchCompleteModal';
import { MatchSetup } from './components/MatchSetup';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PauseMenuModal } from './components/PauseMenuModal';
import {
  createInitialResultDraft,
  ResultMenuModal,
} from './components/ResultMenuModal';
import { SplashScreen } from './components/SplashScreen';
import {
  MatchConfig,
  MatchState,
  MatchTerminationReason,
  PauseEventType,
  PauseReason,
  RallyOutcome,
  ShotRecord,
  ShotType,
  Side,
} from './types/match';
import {
  applyRallyOutcome,
  buildTapShots,
  createInitialMatchState,
  oppositeSide,
  undoLastCompletedRally,
} from './utils/bwfEngine';
import { detectInAppBrowser } from './utils/inAppBrowser';
import {
  ActiveSessionState,
  archiveMatch,
  clearActiveMatch,
  CorrectionTimingState,
  hydrateFromIndexedDB,
  loadActiveSession,
  loadArchivedMatches,
  PauseDraftState,
  requestPersistentStorage,
  ResultDraftState,
  saveActiveSession,
  saveRallyDraft,
} from './utils/storage';

function getInitialSession(): ActiveSessionState {
  return (
    loadActiveSession() ?? {
      viewMode: 'setup',
      matchState: null,
      currentShots: [],
      redoStack: [],
      correctionTiming: null,
      activeModal: 'none',
      resultDraft: null,
      pauseDraft: null,
      updatedAt: Date.now(),
    }
  );
}

export default function App() {
  const [session, setSession] = useState<ActiveSessionState>(() =>
    getInitialSession()
  );
  const sessionRef = useRef<ActiveSessionState>(session);
  sessionRef.current = session;

  const [archivedMatches, setArchivedMatches] = useState<MatchState[]>(() =>
    loadArchivedMatches()
  );
  const [archiveAnalyseTarget, setArchiveAnalyseTarget] =
    useState<MatchState | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const handleCloseSplash = useCallback(() => setShowSplash(false), []);

  const rallySaveTimerRef = useRef<number | null>(null);

  // Hydrate from IndexedDB & request persistent storage when running in real browser/PWA
  useEffect(() => {
    const iab = detectInAppBrowser();
    if (!iab.isInApp) {
      void requestPersistentStorage();
    }

    let cancelled = false;
    void hydrateFromIndexedDB().then(({ session: idbSession, archivedMatches: idbArchived }) => {
      if (cancelled) return;
      if (idbArchived && idbArchived.length > 0) {
        setArchivedMatches(idbArchived);
      }
      if (
        idbSession &&
        idbSession.matchState &&
        idbSession.updatedAt > sessionRef.current.updatedAt &&
        !sessionRef.current.matchState
      ) {
        sessionRef.current = idbSession;
        setSession(idbSession);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleLightweightRallySave = useCallback(() => {
    if (rallySaveTimerRef.current !== null) {
      window.clearTimeout(rallySaveTimerRef.current);
    }
    rallySaveTimerRef.current = window.setTimeout(() => {
      rallySaveTimerRef.current = null;
      const cur = sessionRef.current;
      if (cur.matchState) {
        saveRallyDraft(
          cur.matchState.config.id,
          cur.currentShots,
          cur.redoStack,
          cur.updatedAt,
          cur.correctionTiming ?? null
        );
      }
    }, 700);
  }, []);

  const commitSession = useCallback(
    (
      updater: (prev: ActiveSessionState) => ActiveSessionState,
      persistMode: 'immediate' | 'deferred_rally' | 'memory_only' = 'immediate'
    ) => {
      const next = updater(sessionRef.current);
      if (next === sessionRef.current) return;
      const stamped: ActiveSessionState = {
        ...next,
        updatedAt: Date.now(),
      };
      sessionRef.current = stamped;

      if (persistMode === 'immediate') {
        if (rallySaveTimerRef.current !== null) {
          window.clearTimeout(rallySaveTimerRef.current);
          rallySaveTimerRef.current = null;
        }
        saveActiveSession(stamped);
        if (stamped.matchState?.matchWinner) {
          archiveMatch(stamped.matchState);
          setArchivedMatches(loadArchivedMatches());
        }
      } else if (persistMode === 'deferred_rally') {
        scheduleLightweightRallySave();
      }

      setSession(stamped);
    },
    [scheduleLightweightRallySave]
  );

  // Flush session immediately when app is backgrounded, receives a phone call, or unloads
  useEffect(() => {
    const flushNow = () => {
      if (rallySaveTimerRef.current !== null) {
        window.clearTimeout(rallySaveTimerRef.current);
        rallySaveTimerRef.current = null;
      }
      saveActiveSession(sessionRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      if (rallySaveTimerRef.current !== null) {
        window.clearTimeout(rallySaveTimerRef.current);
      }
    };
  }, []);

  const handleStartMatch = useCallback(
    (config: MatchConfig) => {
      const initial = createInitialMatchState(config);
      commitSession(() => ({
        viewMode: 'court',
        matchState: initial,
        currentShots: [],
        redoStack: [],
        correctionTiming: null,
        activeModal: 'none',
        resultDraft: null,
        pauseDraft: null,
        updatedAt: Date.now(),
      }));
    },
    [commitSession]
  );

  const handleResumeMatch = useCallback(() => {
    commitSession((prev) => {
      if (!prev.matchState) return prev;
      return {
        ...prev,
        viewMode: 'court',
        activeModal: 'none',
        pauseDraft: null,
      };
    });
  }, [commitSession]);

  const handleRegisterTap = useCallback(
    (
      courtX: number,
      courtY: number,
      now: number
    ): { ghostCount: number; autoCorrected: boolean } => {
      const cur = sessionRef.current;
      if (!cur.matchState) {
        return { ghostCount: 0, autoCorrected: false };
      }

      let tapTimestamp = now;
      let disableGhostFill = false;
      let nextCorrectionTiming: CorrectionTimingState | null =
        cur.correctionTiming ?? null;

      if (nextCorrectionTiming) {
        disableGhostFill = true;
        if (nextCorrectionTiming.remainingTimestamps.length > 0) {
          tapTimestamp = nextCorrectionTiming.remainingTimestamps[0];
          nextCorrectionTiming = {
            remainingTimestamps: nextCorrectionTiming.remainingTimestamps.slice(1),
            lastRealTapAt: now,
          };
        } else {
          const prevShot = cur.currentShots[cur.currentShots.length - 1];
          const delta =
            nextCorrectionTiming.lastRealTapAt !== null
              ? Math.max(1, now - nextCorrectionTiming.lastRealTapAt)
              : 0;
          tapTimestamp = prevShot ? prevShot.timestamp + delta : now;
          nextCorrectionTiming = {
            remainingTimestamps: [],
            lastRealTapAt: now,
          };
        }
      } else if (cur.redoStack.length > 0) {
        const undoneTimestamps: number[] = [];
        for (let i = cur.redoStack.length - 1; i >= 0; i--) {
          const grp = cur.redoStack[i];
          for (let j = 0; j < grp.length; j++) {
            undoneTimestamps.push(grp[j].timestamp);
          }
        }
        // If only a single serve was undone back to an empty court, start a fresh rally
        if (cur.currentShots.length > 0 || undoneTimestamps.length >= 2) {
          disableGhostFill = true;
          tapTimestamp = undoneTimestamps[0] ?? now;
          nextCorrectionTiming = {
            remainingTimestamps: undoneTimestamps.slice(1),
            lastRealTapAt: now,
          };
        }
      }

      const prevShot = cur.currentShots[cur.currentShots.length - 1];
      if (prevShot && tapTimestamp <= prevShot.timestamp) {
        tapTimestamp = prevShot.timestamp + 1;
      }

      const result = buildTapShots(
        cur.matchState,
        cur.currentShots,
        courtX,
        courtY,
        tapTimestamp,
        { disableGhostFill }
      );
      commitSession(
        (prev) => ({
          ...prev,
          currentShots: [...prev.currentShots, ...result.addedShots],
          redoStack: [],
          correctionTiming: nextCorrectionTiming,
        }),
        'deferred_rally'
      );
      return {
        ghostCount: result.ghostCount,
        autoCorrected: result.autoCorrected,
      };
    },
    [commitSession]
  );

  const handleUpdateLastShotPosition = useCallback(
    (x: number, y: number) => {
      commitSession((prev) => {
        if (prev.currentShots.length === 0) return prev;
        const updated = [...prev.currentShots];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          x,
          y,
          isAutoCorrected: false,
        };
        return {
          ...prev,
          currentShots: updated,
        };
      }, 'memory_only');
    },
    [commitSession]
  );

  const handleUndoShot = useCallback(() => {
    const cur = sessionRef.current;
    if (cur.currentShots.length > 0) {
      commitSession((prev) => {
        if (prev.currentShots.length === 0) return prev;
        const lastGroupId =
          prev.currentShots[prev.currentShots.length - 1].actionGroupId;
        const removedGroup = prev.currentShots.filter(
          (s) => s.actionGroupId === lastGroupId
        );
        const remaining = prev.currentShots.filter(
          (s) => s.actionGroupId !== lastGroupId
        );
        const nextCorrectionTiming = prev.correctionTiming
          ? {
              ...prev.correctionTiming,
              remainingTimestamps: [
                ...removedGroup.map((s) => s.timestamp),
                ...prev.correctionTiming.remainingTimestamps,
              ],
            }
          : null;
        return {
          ...prev,
          currentShots: remaining,
          redoStack: [...prev.redoStack, removedGroup],
          correctionTiming: nextCorrectionTiming,
        };
      }, 'deferred_rally');
      return;
    }

    if (cur.matchState && cur.matchState.rallies.length > 0) {
      commitSession((prev) => {
        if (!prev.matchState || prev.matchState.rallies.length === 0) {
          return prev;
        }
        const lastRally =
          prev.matchState.rallies[prev.matchState.rallies.length - 1];
        return {
          ...prev,
          matchState: undoLastCompletedRally(prev.matchState),
          currentShots: lastRally.shots.map((s) => ({ ...s })),
          redoStack: [],
          correctionTiming: null,
        };
      }, 'immediate');
    }
  }, [commitSession]);

  const handleRedoShot = useCallback(() => {
    commitSession((prev) => {
      if (prev.redoStack.length === 0) return prev;
      const groupToRestore = prev.redoStack[prev.redoStack.length - 1];
      const nextCorrectionTiming = prev.correctionTiming
        ? {
            ...prev.correctionTiming,
            remainingTimestamps: prev.correctionTiming.remainingTimestamps.slice(
              groupToRestore.length
            ),
          }
        : null;
      return {
        ...prev,
        currentShots: [...prev.currentShots, ...groupToRestore],
        redoStack: prev.redoStack.slice(0, -1),
        correctionTiming: nextCorrectionTiming,
      };
    }, 'deferred_rally');
  }, [commitSession]);

  const handleOpenResultMenu = useCallback(() => {
    commitSession((prev) => {
      if (!prev.matchState) return prev;
      return {
        ...prev,
        activeModal: 'result',
        resultDraft: createInitialResultDraft(
          prev.matchState,
          prev.currentShots
        ),
      };
    });
  }, [commitSession]);

  const handleResultDraftChange = useCallback(
    (draft: ResultDraftState) => {
      commitSession((prev) => ({
        ...prev,
        resultDraft: draft,
      }));
    },
    [commitSession]
  );

  const handleCancelResultMenu = useCallback(() => {
    commitSession((prev) => ({
      ...prev,
      activeModal: 'none',
      resultDraft: null,
    }));
  }, [commitSession]);

  const handleOpenPauseMenu = useCallback(() => {
    commitSession((prev) => ({
      ...prev,
      activeModal: 'pause',
      pauseDraft: {
        subView: 'menu',
        timerStartedAt: null,
        openedAt: Date.now(),
        selectedCleaning: false,
        selectedShuttleChange: false,
        selectedOther: false,
        otherNote: '',
      },
    }));
  }, [commitSession]);

  const handlePauseDraftChange = useCallback(
    (draft: PauseDraftState) => {
      commitSession((prev) => ({
        ...prev,
        pauseDraft: draft,
      }));
    },
    [commitSession]
  );

  const handleClosePauseMenu = useCallback(() => {
    commitSession((prev) => ({
      ...prev,
      activeModal: 'none',
      pauseDraft: null,
    }));
  }, [commitSession]);

  const handleOpenAnalyse = useCallback(() => {
    commitSession((prev) => ({
      ...prev,
      activeModal: 'analyse',
      pauseDraft: prev.activeModal === 'pause' ? prev.pauseDraft : null,
    }));
  }, [commitSession]);

  const handleCloseAnalyse = useCallback(() => {
    commitSession((prev) => ({
      ...prev,
      activeModal: prev.pauseDraft ? 'pause' : 'none',
    }));
  }, [commitSession]);

  const handleConfirmRally = useCallback(
    (params: {
      outcome: RallyOutcome;
      finishingShotType: ShotType | null;
      isBackhand: boolean;
      isDeception: boolean;
      winningSide: Side | null;
      finishingPlayerId: string | null;
    }) => {
      commitSession((prev) => {
        if (!prev.matchState) return prev;
        const nextMatch = applyRallyOutcome(
          prev.matchState,
          prev.currentShots,
          params.outcome,
          params.finishingShotType,
          params.isBackhand,
          params.isDeception,
          params.winningSide,
          params.finishingPlayerId
        );
        const interval = !nextMatch.matchWinner
          ? nextMatch.pendingInterval
          : null;
        const cleanedMatch = nextMatch.pendingInterval
          ? { ...nextMatch, pendingInterval: null }
          : nextMatch;

        return {
          ...prev,
          matchState: cleanedMatch,
          currentShots: [],
          redoStack: [],
          correctionTiming: null,
          activeModal: interval ? 'pause' : 'none',
          resultDraft: null,
          pauseDraft: interval
            ? {
                subView: 'menu',
                timerStartedAt: null,
                openedAt: Date.now(),
                selectedCleaning: false,
                selectedShuttleChange: false,
                selectedOther: false,
                selectedInterval: true,
                otherNote: '',
                countdownDurationSec: interval.durationSeconds,
                intervalKind: interval.kind,
                intervalGameNumber: interval.gameNumber,
                intervalNextGameNumber: interval.nextGameNumber,
                intervalPoints: interval.pointsAtInterval,
                intervalChangeOfEnds: interval.changeOfEnds,
              }
            : null,
        };
      });
    },
    [commitSession]
  );

  const handleLogPauseEvent = useCallback(
    (
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
    ) => {
      commitSession((prev) => {
        if (!prev.matchState) return prev;
        const nextShuttlesUsed = options?.incrementShuttle
          ? prev.matchState.shuttlesUsed + 1
          : prev.matchState.shuttlesUsed;
        const afterRallyNumber =
          prev.matchState.rallies[prev.matchState.rallies.length - 1]
            ?.rallyNumber ?? 0;
        const toastType = options?.toastTypeLabel ?? type;
        const pauseId = `pause_${Date.now()}`;
        const term = options?.terminateMatch;
        const winningSide = term
          ? oppositeSide(term.offendingSide)
          : prev.matchState.matchWinner;

        return {
          ...prev,
          activeModal: options?.closePauseMenu ? 'none' : prev.activeModal,
          pauseDraft: options?.closePauseMenu ? null : prev.pauseDraft,
          matchState: {
            ...prev.matchState,
            shuttlesUsed: nextShuttlesUsed,
            matchWinner: winningSide,
            termination: term
              ? {
                  reason: term.reason,
                  playerId: term.playerId,
                  playerName: term.playerName,
                  offendingSide: term.offendingSide,
                  winningSide: oppositeSide(term.offendingSide),
                  pauseEventId: pauseId,
                  previousMatchWinner: prev.matchState.matchWinner,
                }
              : prev.matchState.termination,
            pauseEvents: [
              ...prev.matchState.pauseEvents,
              {
                id: pauseId,
                type,
                reasons: options?.reasons,
                detail,
                note: options?.note,
                playerId: options?.playerId,
                playerName: options?.playerName,
                gameNumber: prev.matchState.currentGame,
                afterRallyNumber,
                scoreAtEvent: {
                  A: prev.matchState.scoreA,
                  B: prev.matchState.scoreB,
                },
                timestamp: Date.now(),
                durationMs,
              },
            ],
            lastEndsSwitchMessage: `${toastType}: ${detail}`,
            lastEvent: {
              key: 'engineEvents.pauseEventToast',
              params: { type: toastType, detail },
            },
          },
        };
      });
    },
    [commitSession]
  );

  const handleIncrementShuttle = useCallback(() => {
    commitSession((prev) => {
      if (!prev.matchState) return prev;
      return {
        ...prev,
        matchState: {
          ...prev.matchState,
          shuttlesUsed: prev.matchState.shuttlesUsed + 1,
        },
      };
    });
  }, [commitSession]);

  const handleUndoLastRally = useCallback(() => {
    commitSession((prev) => {
      if (!prev.matchState) return prev;
      return {
        ...prev,
        matchState: undoLastCompletedRally(prev.matchState),
      };
    });
  }, [commitSession]);

  const handleEndMatchToSetup = useCallback(() => {
    commitSession((prev) => {
      if (prev.matchState && prev.matchState.rallies.length > 0) {
        archiveMatch(prev.matchState);
        setArchivedMatches(loadArchivedMatches());
      }
      const isFinished = !!prev.matchState?.matchWinner;
      if (isFinished) {
        clearActiveMatch();
      }
      return {
        ...prev,
        viewMode: 'setup',
        matchState: isFinished ? null : prev.matchState,
        currentShots: isFinished ? [] : prev.currentShots,
        redoStack: isFinished ? [] : prev.redoStack,
        correctionTiming: isFinished ? null : prev.correctionTiming ?? null,
        activeModal: 'none',
        resultDraft: null,
        pauseDraft: null,
      };
    });
  }, [commitSession]);

  const {
    viewMode,
    matchState,
    currentShots,
    redoStack,
    activeModal,
    resultDraft,
    pauseDraft,
  } = session;

  const isResultOpen = activeModal === 'result';
  const isPauseOpen = activeModal === 'pause';
  const isAnalyseOpen = activeModal === 'analyse';

  return (
    <>
      {viewMode === 'setup' || !matchState ? (
        <>
          <MatchSetup
            existingActiveMatch={matchState}
            archivedMatches={archivedMatches}
            onStartMatch={handleStartMatch}
            onResumeMatch={handleResumeMatch}
            onOpenArchiveAnalyse={(m) => setArchiveAnalyseTarget(m)}
          />
          {archiveAnalyseTarget && (
            <AnalyseModal
              isOpen={true}
              matchState={archiveAnalyseTarget}
              onClose={() => setArchiveAnalyseTarget(null)}
            />
          )}
        </>
      ) : (
        <>
          <BadmintonCourt
            matchState={matchState}
            currentShots={currentShots}
            redoStack={redoStack}
            isModalOpen={
              showSplash ||
              isResultOpen ||
              isPauseOpen ||
              isAnalyseOpen ||
              !!matchState.matchWinner
            }
            onRegisterTap={handleRegisterTap}
            onUpdateLastShotPosition={handleUpdateLastShotPosition}
            onUndoShot={handleUndoShot}
            onRedoShot={handleRedoShot}
            onOpenResultMenu={handleOpenResultMenu}
            onOpenPauseMenu={handleOpenPauseMenu}
          />

          <ResultMenuModal
            isOpen={isResultOpen}
            matchState={matchState}
            shots={currentShots}
            draft={resultDraft}
            onDraftChange={handleResultDraftChange}
            onCancel={handleCancelResultMenu}
            onConfirm={handleConfirmRally}
          />

          <PauseMenuModal
            isOpen={isPauseOpen}
            matchState={matchState}
            draft={pauseDraft}
            onDraftChange={handlePauseDraftChange}
            onClose={handleClosePauseMenu}
            onOpenAnalyse={handleOpenAnalyse}
            onLogPauseEvent={handleLogPauseEvent}
            onIncrementShuttle={handleIncrementShuttle}
            onEndMatchToSetup={handleEndMatchToSetup}
          />

          <AnalyseModal
            isOpen={isAnalyseOpen}
            matchState={matchState}
            onClose={handleCloseAnalyse}
          />

          <MatchCompleteModal
            matchState={matchState}
            onOpenAnalyse={handleOpenAnalyse}
            onUndoLastRally={handleUndoLastRally}
            onStartNewMatch={handleEndMatchToSetup}
          />
        </>
      )}

      <OfflineIndicator />
      <InAppBrowserBreakout />
      {showSplash && <SplashScreen onComplete={handleCloseSplash} />}
    </>
  );
}
