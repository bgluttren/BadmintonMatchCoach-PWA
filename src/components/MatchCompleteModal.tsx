import React from 'react';
import { BarChart3, Download, Plus, Trophy, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { MatchState } from '../types/match';
import { getMatchCategoryDisplay } from '../utils/bwfEngine';
import { exportMatchAsJSON } from '../utils/storage';

interface MatchCompleteModalProps {
  matchState: MatchState;
  onOpenAnalyse: () => void;
  onUndoLastRally: () => void;
  onStartNewMatch: () => void;
}

export const MatchCompleteModal: React.FC<MatchCompleteModalProps> = ({
  matchState,
  onOpenAnalyse,
  onUndoLastRally,
  onStartNewMatch,
}) => {
  const { t } = useI18n();

  if (!matchState.matchWinner) return null;

  const winnerPlayers = matchState.config.players.filter(
    (p) => p.side === matchState.matchWinner
  );
  const winnerLabel = winnerPlayers.map((p) => p.name).join(' / ');

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-3xl border border-amber-400/50 bg-[#0B241E] p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
          <Trophy className="h-7 w-7" />
        </div>

        <div className="mt-4 text-xs font-semibold text-amber-300">
          {[
            t('completeModal.matchComplete'),
            matchState.config.tournamentName,
            matchState.config.matchName,
            matchState.config.courtName,
            getMatchCategoryDisplay(matchState.config),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {matchState.config.umpireName && (
          <div className="mt-0.5 text-[11px] font-medium text-emerald-200/75">
            {t('setup.umpireMeta', { name: matchState.config.umpireName })}
          </div>
        )}
        <h2 className="mt-1 font-display text-3xl font-extrabold text-white">
          {t('completeModal.winnerSuffix', { winner: winnerLabel })}
        </h2>

        {matchState.termination && (
          <div className="mt-2 inline-flex items-center rounded-xl border border-rose-500/45 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-200">
            {t(`completeModal.terminationReasons.${matchState.termination.reason}`, {
              player: matchState.termination.playerName,
            })}
          </div>
        )}

        <div className="mt-1.5 font-mono text-lg font-bold tabular-nums text-emerald-300">
          {t('completeModal.gamesCount', {
            a: matchState.gamesWonA,
            b: matchState.gamesWonB,
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 font-mono text-xs tabular-nums text-emerald-100/80">
          {matchState.completedGames.map((g) => (
            <span
              key={g.gameNumber}
              className="rounded-lg bg-[#061814] px-2.5 py-1 border border-emerald-900/70"
            >
              G{g.gameNumber}: {g.scoreA}–{g.scoreB}
            </span>
          ))}
          {matchState.termination && (
            <span className="rounded-lg border border-amber-500/40 bg-[#061814] px-2.5 py-1 text-amber-200">
              {t('completeModal.currentGameScore', {
                game: matchState.currentGame,
                a: matchState.scoreA,
                b: matchState.scoreB,
              })}
            </span>
          )}
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onOpenAnalyse}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 hover:bg-emerald-400"
          >
            <BarChart3 className="h-4 w-4" />
            {t('completeModal.analyseMatch')}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => exportMatchAsJSON(matchState)}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-800/70 bg-[#061814] text-xs font-semibold text-emerald-100 hover:bg-emerald-950"
            >
              <Download className="h-3.5 w-3.5" />
              {t('common.exportJson')}
            </button>
            <button
              type="button"
              onClick={onUndoLastRally}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-800/70 bg-[#061814] text-xs font-semibold text-emerald-100 hover:bg-emerald-950"
            >
              <Undo2 className="h-3.5 w-3.5" />
              {matchState.termination
                ? t('completeModal.undoTermination')
                : t('completeModal.undoLastPoint')}
            </button>
          </div>

          <button
            type="button"
            onClick={onStartNewMatch}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/70 text-sm font-semibold text-emerald-200 hover:bg-emerald-950"
          >
            <Plus className="h-4 w-4" />
            {t('completeModal.newMatchSetup')}
          </button>
        </div>
      </div>
    </div>
  );
};
