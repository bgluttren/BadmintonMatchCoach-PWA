import React from 'react';
import { ArrowLeft, ArrowLeftRight, Check, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  MatchState,
  RallyOutcome,
  ShotRecord,
  ShotType,
  Side,
} from '../types/match';
import { inferRallyResultDefaults, oppositeSide } from '../utils/bwfEngine';
import { ResultDraftState } from '../utils/storage';

interface ResultMenuModalProps {
  isOpen: boolean;
  matchState: MatchState;
  shots: ShotRecord[];
  draft: ResultDraftState | null;
  onDraftChange: (draft: ResultDraftState) => void;
  onCancel: () => void;
  onConfirm: (params: {
    outcome: RallyOutcome;
    finishingShotType: ShotType | null;
    isBackhand: boolean;
    isDeception: boolean;
    winningSide: Side | null;
    finishingPlayerId: string | null;
  }) => void;
}

const SHOT_TYPES: ShotType[] = [
  'Smash',
  'Clear',
  'Drop',
  'Net Stop',
  'Drive',
  'Lift',
  'Serve',
];

export function createInitialResultDraft(
  matchState: MatchState,
  shots: ShotRecord[]
): ResultDraftState {
  const inferred = inferRallyResultDefaults(matchState, shots, 'IN');
  return {
    step: 'A',
    outcome: 'IN',
    winningSide: inferred.winningSide,
    finishingSide: inferred.finishingSide,
    finishingPlayerId: inferred.finishingPlayerId,
    selectedShotType: shots.length <= 2 ? 'Serve' : 'Smash',
    isBackhand: false,
    isDeception: false,
  };
}

export const ResultMenuModal: React.FC<ResultMenuModalProps> = ({
  isOpen,
  matchState,
  shots,
  draft,
  onDraftChange,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  const activeDraft = draft ?? createInitialResultDraft(matchState, shots);
  const {
    step,
    outcome,
    winningSide,
    finishingSide,
    finishingPlayerId,
    selectedShotType,
    isBackhand,
    isDeception,
  } = activeDraft;

  const updateDraft = (patch: Partial<ResultDraftState>) => {
    onDraftChange({ ...activeDraft, ...patch });
  };

  const getSideLabel = (side: Side): string => {
    const sidePlayers = matchState.config.players.filter((p) => p.side === side);
    if (sidePlayers.length === 1) return sidePlayers[0].name;
    return sidePlayers.map((p) => p.name.split(' ')[0]).join(' / ');
  };

  const handleSelectOutcome = (chosen: RallyOutcome) => {
    const inferred = inferRallyResultDefaults(matchState, shots, chosen);

    if (chosen === 'LET') {
      onConfirm({
        outcome: 'LET',
        finishingShotType: null,
        isBackhand: false,
        isDeception: false,
        winningSide: null,
        finishingPlayerId: null,
      });
      return;
    }

    updateDraft({
      outcome: chosen,
      finishingSide: inferred.finishingSide,
      finishingPlayerId: inferred.finishingPlayerId,
      winningSide: inferred.winningSide,
      step: 'B',
    });
  };

  const handleSwapWinner = () => {
    if (!winningSide) return;
    const nextWinner = oppositeSide(winningSide);
    const nextFinisherSide =
      outcome === 'IN' ? nextWinner : oppositeSide(nextWinner);
    const sidePlayers = matchState.config.players.filter(
      (p) => p.side === nextFinisherSide
    );
    updateDraft({
      winningSide: nextWinner,
      finishingSide: nextFinisherSide,
      finishingPlayerId: sidePlayers[0]?.id ?? null,
    });
  };

  const finishingTeamPlayers = matchState.config.players.filter(
    (p) => p.side === finishingSide
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-emerald-800/80 bg-[#0B241E] p-5 pb-7 shadow-2xl sm:rounded-3xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-emerald-900/70 pb-3.5">
          <div className="flex items-center gap-2.5">
            {step === 'B' && (
              <button
                type="button"
                onClick={() => updateDraft({ step: 'A' })}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900"
                aria-label={t('common.back')}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="text-xs font-medium text-emerald-300/90 tabular-nums">
                {t('resultModal.rallyHeader', {
                  rally: matchState.rallies.length + 1,
                  count: shots.length,
                })}
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                {step === 'A'
                  ? t('resultModal.step1Title')
                  : t('resultModal.step2Title')}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-800/70 px-3 text-xs font-semibold text-emerald-100/80 hover:bg-emerald-950"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('resultModal.resumeTap')}
          </button>
        </div>

        {/* Step A: IN / OUT / LET / FAULT */}
        {step === 'A' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectOutcome('IN')}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-emerald-400/50 bg-emerald-500/20 p-3 text-center transition-colors hover:bg-emerald-500/30 active:scale-[0.98]"
              >
                <span className="font-display text-2xl font-extrabold text-emerald-300">
                  {t('resultModal.outcomes.IN.label')}
                </span>
                <span className="mt-0.5 text-xs text-emerald-100/80">
                  {t('resultModal.outcomes.IN.desc')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('OUT')}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-rose-400/50 bg-rose-500/20 p-3 text-center transition-colors hover:bg-rose-500/30 active:scale-[0.98]"
              >
                <span className="font-display text-2xl font-extrabold text-rose-300">
                  {t('resultModal.outcomes.OUT.label')}
                </span>
                <span className="mt-0.5 text-xs text-rose-100/80">
                  {t('resultModal.outcomes.OUT.desc')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('FAULT')}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/20 p-3 text-center transition-colors hover:bg-amber-500/30 active:scale-[0.98]"
              >
                <span className="font-display text-2xl font-extrabold text-amber-300">
                  {t('resultModal.outcomes.FAULT.label')}
                </span>
                <span className="mt-0.5 text-xs text-amber-100/80">
                  {t('resultModal.outcomes.FAULT.desc')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('LET')}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-sky-400/50 bg-sky-500/20 p-3 text-center transition-colors hover:bg-sky-500/30 active:scale-[0.98]"
              >
                <span className="font-display text-2xl font-extrabold text-sky-300">
                  {t('resultModal.outcomes.LET.label')}
                </span>
                <span className="mt-0.5 text-xs text-sky-100/80">
                  {t('resultModal.outcomes.LET.desc')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step B: Shot Type + Backhand + Deception */}
        {step === 'B' && (
          <div className="mt-4 space-y-4">
            {/* Inferred Winner Banner + Safeguard Swap */}
            {winningSide && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-800/70 bg-[#061814] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] text-emerald-100/65">
                    {t('resultModal.outcomePrefix')}{' '}
                    <span className="font-semibold text-white">
                      {t(`resultModal.outcomes.${outcome}.label`)}
                    </span>{' '}
                    · {t('resultModal.pointAwardedTo')}
                  </div>
                  <div className="truncate text-sm font-bold text-emerald-300">
                    {getSideLabel(winningSide)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSwapWinner}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-700/70 px-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 shrink-0"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  {t('common.swap')}
                </button>
              </div>
            )}

            {/* Doubles Hitter Selector */}
            {matchState.config.matchClass === 'doubles' &&
              finishingTeamPlayers.length > 1 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-emerald-100/75">
                    {t('resultModal.shotPlayedBy')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {finishingTeamPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => updateDraft({ finishingPlayerId: p.id })}
                        className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold truncate transition-colors ${
                          finishingPlayerId === p.id
                            ? 'bg-emerald-500 text-slate-950'
                            : 'border border-emerald-800/70 bg-[#061814] text-emerald-100/80 hover:text-white'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Modifiers: Backhand & Deception */}
            <div>
              <div className="mb-1.5 text-xs font-medium text-emerald-100/75">
                {t('resultModal.shotModifiers')}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateDraft({ isBackhand: !isBackhand })}
                  className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    isBackhand
                      ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                      : 'border-emerald-800/70 bg-[#061814] text-emerald-100/75 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      isBackhand
                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                        : 'border-emerald-700'
                    }`}
                  >
                    {isBackhand && <Check className="h-3 w-3 stroke-[3]" />}
                  </span>
                  {t('resultModal.backhand')}
                </button>

                <button
                  type="button"
                  onClick={() => updateDraft({ isDeception: !isDeception })}
                  className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    isDeception
                      ? 'border-sky-400 bg-sky-400/20 text-sky-200'
                      : 'border-emerald-800/70 bg-[#061814] text-emerald-100/75 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      isDeception
                        ? 'border-sky-300 bg-sky-400 text-slate-950'
                        : 'border-emerald-700'
                    }`}
                  >
                    {isDeception && <Check className="h-3 w-3 stroke-[3]" />}
                  </span>
                  {t('resultModal.deception')}
                </button>
              </div>
            </div>

            {/* 7 Shot Types */}
            <div>
              <div className="mb-1.5 text-xs font-medium text-emerald-100/75">
                {t('resultModal.finishingShotType')}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SHOT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateDraft({ selectedShotType: type })}
                    className={`min-h-[46px] rounded-xl border px-3 text-sm font-bold transition-colors ${
                      selectedShotType === type
                        ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                        : 'border-emerald-800/70 bg-[#061814] text-slate-100 hover:border-emerald-600'
                    }`}
                  >
                    {t(`shotTypes.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Rally CTA */}
            <button
              type="button"
              onClick={() =>
                onConfirm({
                  outcome,
                  finishingShotType: selectedShotType,
                  isBackhand,
                  isDeception,
                  winningSide,
                  finishingPlayerId,
                })
              }
              className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-base font-bold text-slate-950 shadow-lg hover:bg-emerald-400 active:scale-[0.98]"
            >
              <Check className="h-5 w-5 stroke-[2.5]" />
              {t('resultModal.saveRallyCta')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
