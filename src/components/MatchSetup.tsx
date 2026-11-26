import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Globe,
  Play,
  RotateCcw,
  Settings,
  Trophy,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  AgeCategory,
  AgeCategoryGroup,
  CourtHalf,
  MatchClass,
  MatchConfig,
  MatchDiscipline,
  MatchState,
  Player,
  Side,
} from '../types/match';
import {
  DISCIPLINES,
  formatMatchCategoryCode,
  getAgeCategoryGroup,
  getMatchCategoryDisplay,
  getMatchClassForDiscipline,
  JUNIOR_AGE_CATEGORIES,
  VETERAN_AGE_CATEGORIES,
} from '../utils/bwfEngine';
import { LanguageModal } from './LanguageModal';
import { PWAInstallButton } from './PWAInstallButton';
import {
  clearSetupDraft,
  exportMatchAsJSON,
  loadLastMatchRules,
  loadSetupDraft,
  PlayerDraft,
  saveLastMatchRules,
  saveSetupDraft,
} from '../utils/storage';

interface MatchSetupProps {
  existingActiveMatch: MatchState | null;
  archivedMatches: MatchState[];
  onStartMatch: (config: MatchConfig) => void;
  onResumeMatch: () => void;
  onOpenArchiveAnalyse: (match: MatchState) => void;
}

const emptyDraft = (defaultName: string): PlayerDraft => ({
  name: defaultName,
  club: '',
  nationality: '',
});

export const MatchSetup: React.FC<MatchSetupProps> = ({
  existingActiveMatch,
  archivedMatches,
  onStartMatch,
  onResumeMatch,
  onOpenArchiveAnalyse,
}) => {
  const { lang, t } = useI18n();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [initialDraft] = useState(() => loadSetupDraft());
  const [lastSavedRules] = useState(() => loadLastMatchRules());
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const [matchName, setMatchName] = useState(
    () => initialDraft?.matchName ?? ''
  );
  const [tournamentName, setTournamentName] = useState(
    () => initialDraft?.tournamentName ?? ''
  );
  const [courtName, setCourtName] = useState(
    () => initialDraft?.courtName ?? ''
  );
  const [umpireName, setUmpireName] = useState(
    () => initialDraft?.umpireName ?? ''
  );
  const [discipline, setDiscipline] = useState<MatchDiscipline>(
    () =>
      initialDraft?.discipline ??
      (initialDraft?.matchClass === 'doubles' ? 'MD' : 'MS')
  );
  const [ageCategory, setAgeCategory] = useState<AgeCategory>(
    () => initialDraft?.ageCategory ?? 'Open'
  );

  const matchClass: MatchClass = getMatchClassForDiscipline(discipline);
  const ageGroup: AgeCategoryGroup = getAgeCategoryGroup(ageCategory);
  const categoryCode = formatMatchCategoryCode(discipline, ageCategory);

  // Player drafts
  const [pA1, setPA1] = useState<PlayerDraft>(
    () => initialDraft?.pA1 ?? emptyDraft(t('setup.playerA'))
  );
  const [pA2, setPA2] = useState<PlayerDraft>(
    () => initialDraft?.pA2 ?? emptyDraft(t('setup.playerA2'))
  );
  const [pB1, setPB1] = useState<PlayerDraft>(
    () => initialDraft?.pB1 ?? emptyDraft(t('setup.playerB'))
  );
  const [pB2, setPB2] = useState<PlayerDraft>(
    () => initialDraft?.pB2 ?? emptyDraft(t('setup.playerB2'))
  );

  // Rules (remember last used settings across matches)
  const [gamesToWin, setGamesToWin] = useState<number>(
    () => initialDraft?.gamesToWin ?? lastSavedRules?.gamesToWin ?? 2
  ); // Best of 3
  const [pointsPerGame, setPointsPerGame] = useState<number>(
    () => initialDraft?.pointsPerGame ?? lastSavedRules?.pointsPerGame ?? 21
  );
  const [maxPoints, setMaxPoints] = useState<number>(
    () => initialDraft?.maxPoints ?? lastSavedRules?.maxPoints ?? 30
  );
  const [bwfIntervalsEnabled, setBwfIntervalsEnabled] = useState<boolean>(
    () =>
      initialDraft?.bwfIntervalsEnabled ??
      lastSavedRules?.bwfIntervalsEnabled ??
      true
  );
  const [midGameIntervalSec, setMidGameIntervalSec] = useState<number>(
    () =>
      initialDraft?.midGameIntervalSec ??
      lastSavedRules?.midGameIntervalSec ??
      60
  );
  const [betweenGameIntervalSec, setBetweenGameIntervalSec] = useState<number>(
    () =>
      initialDraft?.betweenGameIntervalSec ??
      lastSavedRules?.betweenGameIntervalSec ??
      120
  );

  // Coin toss & starting lineup
  const [firstServerSide, setFirstServerSide] = useState<Side>(
    () => initialDraft?.firstServerSide ?? 'A'
  );
  const [sideAHalf, setSideAHalf] = useState<CourtHalf>(
    () => initialDraft?.sideAHalf ?? 'left'
  );
  const [teamARightServer, setTeamARightServer] = useState<'1' | '2'>(
    () => initialDraft?.teamARightServer ?? '1'
  );
  const [teamBRightServer, setTeamBRightServer] = useState<'1' | '2'>(
    () => initialDraft?.teamBRightServer ?? '1'
  );

  const prevDefaultsRef = React.useRef({
    round: t('setup.defaultRoundName'),
    pA: t('setup.playerA'),
    pA1: t('setup.playerA1'),
    pA2: t('setup.playerA2'),
    pB: t('setup.playerB'),
    pB1: t('setup.playerB1'),
    pB2: t('setup.playerB2'),
  });

  useEffect(() => {
    const prev = prevDefaultsRef.current;
    const next = {
      round: t('setup.defaultRoundName'),
      pA: t('setup.playerA'),
      pA1: t('setup.playerA1'),
      pA2: t('setup.playerA2'),
      pB: t('setup.playerB'),
      pB1: t('setup.playerB1'),
      pB2: t('setup.playerB2'),
    };

    if (prev.round !== next.round) {
      setMatchName((cur) =>
        cur === prev.round || cur === 'Quarterfinal' ? next.round : cur
      );
    }
    if (prev.pA !== next.pA || prev.pA1 !== next.pA1) {
      setPA1((d) => {
        if (d.name === prev.pA || d.name === 'Player A') {
          return { ...d, name: next.pA };
        }
        if (d.name === prev.pA1 || d.name === 'Player A1') {
          return { ...d, name: next.pA1 };
        }
        return d;
      });
    }
    if (prev.pA2 !== next.pA2) {
      setPA2((d) =>
        d.name === prev.pA2 || d.name === 'Player A2'
          ? { ...d, name: next.pA2 }
          : d
      );
    }
    if (prev.pB !== next.pB || prev.pB1 !== next.pB1) {
      setPB1((d) => {
        if (d.name === prev.pB || d.name === 'Player B') {
          return { ...d, name: next.pB };
        }
        if (d.name === prev.pB1 || d.name === 'Player B1') {
          return { ...d, name: next.pB1 };
        }
        return d;
      });
    }
    if (prev.pB2 !== next.pB2) {
      setPB2((d) =>
        d.name === prev.pB2 || d.name === 'Player B2'
          ? { ...d, name: next.pB2 }
          : d
      );
    }

    prevDefaultsRef.current = next;
  }, [t]);

  useEffect(() => {
    saveSetupDraft({
      matchName,
      tournamentName,
      courtName,
      umpireName,
      matchClass,
      discipline,
      ageCategory,
      pA1,
      pA2,
      pB1,
      pB2,
      gamesToWin,
      pointsPerGame,
      maxPoints,
      bwfIntervalsEnabled,
      midGameIntervalSec,
      betweenGameIntervalSec,
      firstServerSide,
      sideAHalf,
      teamARightServer,
      teamBRightServer,
    });
  }, [
    matchName,
    tournamentName,
    courtName,
    umpireName,
    matchClass,
    discipline,
    ageCategory,
    pA1,
    pA2,
    pB1,
    pB2,
    gamesToWin,
    pointsPerGame,
    maxPoints,
    bwfIntervalsEnabled,
    midGameIntervalSec,
    betweenGameIntervalSec,
    firstServerSide,
    sideAHalf,
    teamARightServer,
    teamBRightServer,
  ]);

  useEffect(() => {
    saveLastMatchRules({
      gamesToWin,
      pointsPerGame,
      maxPoints,
      bwfIntervalsEnabled,
      midGameIntervalSec,
      betweenGameIntervalSec,
    });
  }, [
    gamesToWin,
    pointsPerGame,
    maxPoints,
    bwfIntervalsEnabled,
    midGameIntervalSec,
    betweenGameIntervalSec,
  ]);

  const handleDisciplineChange = (nextDiscipline: MatchDiscipline) => {
    setDiscipline(nextDiscipline);
    const nextClass = getMatchClassForDiscipline(nextDiscipline);
    if (nextClass === 'doubles') {
      if (pA1.name === t('setup.playerA') || pA1.name === 'Player A') {
        setPA1((d) => ({ ...d, name: t('setup.playerA1') }));
      }
      if (pB1.name === t('setup.playerB') || pB1.name === 'Player B') {
        setPB1((d) => ({ ...d, name: t('setup.playerB1') }));
      }
    } else {
      if (pA1.name === t('setup.playerA1') || pA1.name === 'Player A1') {
        setPA1((d) => ({ ...d, name: t('setup.playerA') }));
      }
      if (pB1.name === t('setup.playerB1') || pB1.name === 'Player B1') {
        setPB1((d) => ({ ...d, name: t('setup.playerB') }));
      }
    }
  };

  const handleAgeGroupChange = (group: AgeCategoryGroup) => {
    if (group === 'open') {
      setAgeCategory('Open');
    } else if (group === 'junior') {
      if (!ageCategory.startsWith('U')) {
        setAgeCategory('U19');
      }
    } else {
      if (!ageCategory.endsWith('+')) {
        setAgeCategory('35+');
      }
    }
  };

  const handlePointsPreset = (pts: number, cap: number) => {
    setPointsPerGame(pts);
    setMaxPoints(cap);
  };

  const sideBHalf: CourtHalf = sideAHalf === 'left' ? 'right' : 'left';

  const previewNames = useMemo(() => {
    const a1 =
      pA1.name.trim() ||
      (matchClass === 'singles' ? t('setup.playerA') : t('setup.playerA1'));
    const a2 = pA2.name.trim() || t('setup.playerA2');
    const b1 =
      pB1.name.trim() ||
      (matchClass === 'singles' ? t('setup.playerB') : t('setup.playerB1'));
    const b2 = pB2.name.trim() || t('setup.playerB2');

    const aRight = teamARightServer === '1' ? a1 : a2;
    const aLeft = teamARightServer === '1' ? a2 : a1;
    const bRight = teamBRightServer === '1' ? b1 : b2;
    const bLeft = teamBRightServer === '1' ? b2 : b1;

    return { a1, a2, b1, b2, aRight, aLeft, bRight, bLeft };
  }, [
    pA1.name,
    pA2.name,
    pB1.name,
    pB2.name,
    matchClass,
    teamARightServer,
    teamBRightServer,
    t,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const players: Player[] = [
      {
        id: 'A1',
        name: previewNames.a1,
        club: pA1.club.trim(),
        nationality: pA1.nationality.trim().toUpperCase(),
        side: 'A',
      },
    ];

    if (matchClass === 'doubles') {
      players.push({
        id: 'A2',
        name: previewNames.a2,
        club: pA2.club.trim(),
        nationality: pA2.nationality.trim().toUpperCase(),
        side: 'A',
      });
    }

    players.push({
      id: 'B1',
      name: previewNames.b1,
      club: pB1.club.trim(),
      nationality: pB1.nationality.trim().toUpperCase(),
      side: 'B',
    });

    if (matchClass === 'doubles') {
      players.push({
        id: 'B2',
        name: previewNames.b2,
        club: pB2.club.trim(),
        nationality: pB2.nationality.trim().toUpperCase(),
        side: 'B',
      });
    }

    const fallbackMatchName =
      matchClass === 'singles'
        ? `${previewNames.a1} vs ${previewNames.b1}`
        : `${previewNames.a1} / ${previewNames.a2} vs ${previewNames.b1} / ${previewNames.b2}`;

    const resolvedRules = {
      gamesToWin,
      pointsPerGame: Math.max(1, pointsPerGame),
      maxPoints: Math.max(pointsPerGame, maxPoints),
      bwfIntervalsEnabled,
      midGameIntervalSec: Math.max(10, midGameIntervalSec),
      betweenGameIntervalSec: Math.max(10, betweenGameIntervalSec),
    };

    const config: MatchConfig = {
      id: `match_${Date.now()}`,
      matchName:
        matchName.trim() || fallbackMatchName || t('setup.defaultMatchName'),
      tournamentName: tournamentName.trim() || undefined,
      courtName: courtName.trim() || undefined,
      umpireName: umpireName.trim() || undefined,
      matchClass,
      discipline,
      ageCategory,
      categoryCode,
      createdAt: Date.now(),
      players,
      rules: resolvedRules,
      lineup: {
        firstServerSide,
        sideAHalf,
        teamABoxes:
          matchClass === 'singles'
            ? { right: 'A1', left: 'A1' }
            : {
                right: teamARightServer === '1' ? 'A1' : 'A2',
                left: teamARightServer === '1' ? 'A2' : 'A1',
              },
        teamBBoxes:
          matchClass === 'singles'
            ? { right: 'B1', left: 'B1' }
            : {
                right: teamBRightServer === '1' ? 'B1' : 'B2',
                left: teamBRightServer === '1' ? 'B2' : 'B1',
              },
      },
    };

    saveLastMatchRules(resolvedRules);
    clearSetupDraft();
    onStartMatch(config);
  };

  const renderPlayerFields = (
    label: string,
    draft: PlayerDraft,
    setDraft: React.Dispatch<React.SetStateAction<PlayerDraft>>
  ) => (
    <div className="space-y-2.5">
      <div className="text-xs font-semibold tracking-wide text-emerald-300/90">
        {label}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
        <div className="sm:col-span-6">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('setup.playerNamePlaceholder')}
            required
            className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#061814] px-3.5 py-2 text-sm font-medium text-slate-50 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-4">
          <input
            type="text"
            value={draft.club}
            onChange={(e) => setDraft({ ...draft, club: e.target.value })}
            placeholder={t('setup.clubPlaceholder')}
            className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#061814] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <input
            type="text"
            maxLength={3}
            value={draft.nationality}
            onChange={(e) =>
              setDraft({ ...draft, nationality: e.target.value.toUpperCase() })
            }
            placeholder={t('setup.natPlaceholder')}
            className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#061814] px-3 py-2 text-center font-mono text-sm uppercase text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );

  // Mini court preview coordinates for Draw & Starting Lineup
  const leftSide: Side = sideAHalf === 'left' ? 'A' : 'B';
  const rightSide: Side = sideAHalf === 'left' ? 'B' : 'A';
  const leftTeamNames =
    leftSide === 'A'
      ? { top: previewNames.aLeft, bottom: previewNames.aRight, single: previewNames.a1 }
      : { top: previewNames.bLeft, bottom: previewNames.bRight, single: previewNames.b1 };
  const rightTeamNames =
    rightSide === 'A'
      ? { top: previewNames.aRight, bottom: previewNames.aLeft, single: previewNames.a1 }
      : { top: previewNames.bRight, bottom: previewNames.bLeft, single: previewNames.b1 };

  return (
    <div className="setup-scroll-surface min-h-dvh w-full bg-[#051A15] text-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-emerald-900/70 bg-[#051A15]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="min-w-0 truncate font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            {t('common.appName')}
          </span>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsLangOpen(true)}
              aria-label={t('languageModal.buttonLabel')}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-800/80 bg-[#0B241E] px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:border-emerald-500/60 hover:bg-emerald-950"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono uppercase">{lang}</span>
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8">
        {/* Resume Existing Active Match Banner */}
        {existingActiveMatch && !existingActiveMatch.matchWinner && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-emerald-500/40 bg-[#0B2921] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                {t('setup.matchInProgress')}
              </div>
              <div className="mt-0.5 text-lg font-bold text-white">
                {existingActiveMatch.config.matchName}
              </div>
              {(existingActiveMatch.config.tournamentName ||
                existingActiveMatch.config.courtName ||
                existingActiveMatch.config.umpireName) && (
                <div className="mt-0.5 text-xs text-emerald-200/80">
                  {[
                    existingActiveMatch.config.tournamentName,
                    existingActiveMatch.config.courtName,
                    existingActiveMatch.config.umpireName
                      ? t('setup.umpireMeta', {
                          name: existingActiveMatch.config.umpireName,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-100/75 tabular-nums">
                <span className="font-mono font-semibold text-emerald-300">
                  {getMatchCategoryDisplay(existingActiveMatch.config)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('setup.gameScoreSummary', {
                    game: existingActiveMatch.currentGame,
                    scoreA: existingActiveMatch.scoreA,
                    scoreB: existingActiveMatch.scoreB,
                  })}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('setup.ralliesLoggedCount', {
                    count: existingActiveMatch.rallies.length,
                  })}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onResumeMatch}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              {t('setup.resumeMatch')}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Intro */}
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {t('setup.title')}
            </h1>
            <p className="text-sm text-emerald-100/70">{t('setup.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Match Info, Rules, Players */}
            <div className="space-y-6 lg:col-span-7">
              {/* Match Information */}
              <section className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-white">
                    {t('setup.section1Title')}
                  </h2>
                  <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                    {categoryCode} · {t(`disciplines.${discipline}.name`)}
                  </span>
                </div>

                {/* Collapsible More Match Information (Tournament, Match Name, Court, Umpire) */}
                {(() => {
                  const filledMeta = [
                    tournamentName.trim(),
                    matchName.trim(),
                    courtName.trim(),
                    umpireName.trim(),
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div className="rounded-xl border border-emerald-900/70 bg-[#061814]/80">
                      <button
                        type="button"
                        aria-expanded={isMoreInfoOpen}
                        onClick={() => setIsMoreInfoOpen((v) => !v)}
                        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-emerald-950/50 rounded-xl"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-emerald-200">
                            {t('setup.moreMatchInfoToggle')}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-emerald-100/60">
                            {filledMeta || t('setup.moreMatchInfoHint')}
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-emerald-300 transition-transform duration-200 ${
                            isMoreInfoOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isMoreInfoOpen && (
                        <div className="grid grid-cols-1 gap-3 border-t border-emerald-900/60 p-3.5 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                              {t('setup.tournamentNameLabel')}
                            </label>
                            <input
                              type="text"
                              value={tournamentName}
                              onChange={(e) => setTournamentName(e.target.value)}
                              placeholder={t('setup.tournamentNamePlaceholder')}
                              className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#051A15] px-3.5 py-2 text-sm font-medium text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                              {t('setup.matchNameLabel')}
                            </label>
                            <input
                              type="text"
                              value={matchName}
                              onChange={(e) => setMatchName(e.target.value)}
                              placeholder={t('setup.matchNamePlaceholder')}
                              className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#051A15] px-3.5 py-2 text-sm font-medium text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                              {t('setup.courtNameLabel')}
                            </label>
                            <input
                              type="text"
                              value={courtName}
                              onChange={(e) => setCourtName(e.target.value)}
                              placeholder={t('setup.courtNamePlaceholder')}
                              className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#051A15] px-3.5 py-2 text-sm font-medium text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                              {t('setup.umpireNameLabel')}
                            </label>
                            <input
                              type="text"
                              value={umpireName}
                              onChange={(e) => setUmpireName(e.target.value)}
                              placeholder={t('setup.umpireNamePlaceholder')}
                              className="min-h-[44px] w-full rounded-xl border border-emerald-800/70 bg-[#051A15] px-3.5 py-2 text-sm font-medium text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 5 International Disciplines */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-emerald-100/80">
                      {t('setup.disciplineLabel')}
                    </label>
                    <span className="text-[11px] text-emerald-300/90 font-medium">
                      {discipline} · {t(`disciplines.${discipline}.name`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-emerald-900/70 bg-[#061814] p-1">
                    {DISCIPLINES.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleDisciplineChange(item.code)}
                        title={`${item.code} · ${t(`disciplines.${item.code}.name`)}`}
                        className={`flex min-h-[54px] flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors ${
                          discipline === item.code
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-emerald-100/75 hover:text-white'
                        }`}
                      >
                        <span className="font-mono text-sm font-bold leading-none">
                          {item.code}
                        </span>
                        <span
                          className={`mt-1 line-clamp-2 text-[10px] leading-tight ${
                            discipline === item.code
                              ? 'text-slate-900/85 font-semibold'
                              : 'text-emerald-100/60'
                          }`}
                        >
                          {t(`disciplines.${item.code}.name`)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-emerald-100/55">
                    {t('setup.disciplineNote')}
                  </p>
                </div>

                {/* Age Category: Open, Junior (U11-U23), Veteran/Masters (35+-80+) */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-emerald-100/80">
                      {t('setup.ageCategoryLabel')}
                    </label>
                    <span className="text-[11px] text-emerald-300/90 font-medium">
                      {ageGroup === 'open'
                        ? t('setup.ageOpenDesc')
                        : ageGroup === 'junior'
                          ? t('setup.ageJuniorDesc', {
                              age: ageCategory.slice(1),
                            })
                          : t('setup.ageVeteranDesc', {
                              age: ageCategory.slice(0, -1),
                            })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-emerald-900/70 bg-[#061814] p-1">
                    {[
                      { id: 'open' as const, label: t('setup.ageGroupOpen') },
                      { id: 'junior' as const, label: t('setup.ageGroupJunior') },
                      {
                        id: 'veteran' as const,
                        label: t('setup.ageGroupVeteran'),
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleAgeGroupChange(tab.id)}
                        className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          ageGroup === tab.id
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-emerald-100/75 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {ageGroup === 'junior' && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                      {JUNIOR_AGE_CATEGORIES.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setAgeCategory(u)}
                          className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold transition-colors ${
                            ageCategory === u
                              ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                              : 'border-emerald-900/70 bg-[#061814] text-emerald-100/70 hover:text-white'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}

                  {ageGroup === 'veteran' && (
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {VETERAN_AGE_CATEGORIES.map((vet) => (
                        <button
                          key={vet}
                          type="button"
                          onClick={() => setAgeCategory(vet)}
                          className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold transition-colors ${
                            ageCategory === vet
                              ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                              : 'border-emerald-900/70 bg-[#061814] text-emerald-100/70 hover:text-white'
                          }`}
                        >
                          {vet}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Match Rules (collapsed summary + gear edit button, saved across matches) */}
              <section className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white">
                      {t('setup.section2Title')}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-emerald-200/85 tabular-nums">
                      {t('setup.rulesSummaryLine', {
                        totalGames: gamesToWin * 2 - 1,
                        points: pointsPerGame,
                        cap: maxPoints,
                        intervals: bwfIntervalsEnabled
                          ? t('setup.rulesIntervalsOn', {
                              midSec: midGameIntervalSec,
                              gameSec: betweenGameIntervalSec,
                            })
                          : t('setup.rulesIntervalsOff'),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={isRulesOpen}
                    aria-label={t('setup.editRulesAria')}
                    title={t('setup.editRulesAria')}
                    onClick={() => setIsRulesOpen((v) => !v)}
                    className={`flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      isRulesOpen
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-emerald-800/70 bg-[#061814] text-emerald-200 hover:border-emerald-500/60 hover:text-white'
                    }`}
                  >
                    <Settings
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isRulesOpen ? 'rotate-45 text-emerald-300' : ''
                      }`}
                    />
                  </button>
                </div>

                {isRulesOpen && (
                  <div className="mt-4 border-t border-emerald-900/60 pt-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                          {t('setup.gamesToWinLabel')}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#061814] p-1 border border-emerald-900/70">
                          {[
                            { val: 1, label: t('setup.bo1') },
                            { val: 2, label: t('setup.bo3') },
                            { val: 3, label: t('setup.bo5') },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setGamesToWin(opt.val)}
                              className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                                gamesToWin === opt.val
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'text-emerald-100/75 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                          {t('setup.scoringFormatLabel')}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#061814] p-1 border border-emerald-900/70">
                          {[
                            { pts: 21, cap: 30, label: '21 / 30' },
                            { pts: 15, cap: 21, label: '15 / 21' },
                            { pts: 11, cap: 15, label: '11 / 15' },
                          ].map((preset) => (
                            <button
                              key={preset.pts}
                              type="button"
                              onClick={() =>
                                handlePointsPreset(preset.pts, preset.cap)
                              }
                              className={`min-h-[38px] rounded-lg px-2 font-mono text-xs font-semibold tabular-nums transition-colors whitespace-nowrap ${
                                pointsPerGame === preset.pts &&
                                maxPoints === preset.cap
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'text-emerald-100/75 hover:text-white'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-emerald-100/70">
                          {t('setup.pointsPerGameLabel')}
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={50}
                          value={pointsPerGame}
                          onChange={(e) =>
                            setPointsPerGame(
                              Math.max(5, Number(e.target.value) || 21)
                            )
                          }
                          className="min-h-[42px] w-full rounded-xl border border-emerald-800/70 bg-[#061814] px-3 py-2 font-mono text-sm tabular-nums text-white focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-emerald-100/70">
                          {t('setup.maxPointsLabel')}
                        </label>
                        <input
                          type="number"
                          min={pointsPerGame}
                          max={60}
                          value={maxPoints}
                          onChange={(e) =>
                            setMaxPoints(
                              Math.max(
                                pointsPerGame,
                                Number(e.target.value) || 30
                              )
                            )
                          }
                          className="min-h-[42px] w-full rounded-xl border border-emerald-800/70 bg-[#061814] px-3 py-2 font-mono text-sm tabular-nums text-white focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* International BWF Intervals & Change of Ends */}
                    <div className="mt-4 rounded-xl border border-emerald-900/70 bg-[#061814] p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-emerald-200">
                            {t('setup.bwfIntervalsTitle')}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-100/65">
                            {t('setup.bwfIntervalsSummary', {
                              midSec: midGameIntervalSec,
                              points: Math.ceil(pointsPerGame / 2),
                              gameSec: betweenGameIntervalSec,
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={bwfIntervalsEnabled}
                          onClick={() => setBwfIntervalsEnabled((v) => !v)}
                          className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                            bwfIntervalsEnabled
                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                              : 'border-emerald-800 bg-[#0B241E] text-emerald-100/60'
                          }`}
                        >
                          {bwfIntervalsEnabled && (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          <span>
                            {bwfIntervalsEnabled ? 'BWF ON' : 'OFF'}
                          </span>
                        </button>
                      </div>

                      {bwfIntervalsEnabled && (
                        <div className="grid grid-cols-2 gap-3 border-t border-emerald-900/60 pt-2.5">
                          <div>
                            <label className="mb-1 block text-[11px] text-emerald-100/70">
                              {t('setup.midGameIntervalLabel')}
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={300}
                              value={midGameIntervalSec}
                              onChange={(e) =>
                                setMidGameIntervalSec(
                                  Math.max(15, Number(e.target.value) || 60)
                                )
                              }
                              className="min-h-[38px] w-full rounded-lg border border-emerald-800/70 bg-[#0B241E] px-2.5 py-1.5 font-mono text-xs tabular-nums text-white focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] text-emerald-100/70">
                              {t('setup.betweenGameIntervalLabel')}
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={600}
                              value={betweenGameIntervalSec}
                              onChange={(e) =>
                                setBetweenGameIntervalSec(
                                  Math.max(15, Number(e.target.value) || 120)
                                )
                              }
                              className="min-h-[38px] w-full rounded-lg border border-emerald-800/70 bg-[#0B241E] px-2.5 py-1.5 font-mono text-xs tabular-nums text-white focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Player Information */}
              <section className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-5 space-y-5">
                <h2 className="text-base font-bold text-white">
                  {t('setup.section3Title')}
                </h2>

                {/* Side A */}
                <div className="space-y-3 pb-4 border-b border-emerald-900/70">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-300">
                      {matchClass === 'singles'
                        ? t('setup.sideA')
                        : t('setup.teamA')}
                    </span>
                    <span className="text-xs text-emerald-100/60">
                      {t('setup.playerFieldsHint')}
                    </span>
                  </div>
                  {renderPlayerFields(
                    matchClass === 'singles'
                      ? t('setup.playerA')
                      : t('setup.playerA1'),
                    pA1,
                    setPA1
                  )}
                  {matchClass === 'doubles' &&
                    renderPlayerFields(t('setup.playerA2'), pA2, setPA2)}
                </div>

                {/* Side B */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-300">
                      {matchClass === 'singles'
                        ? t('setup.sideB')
                        : t('setup.teamB')}
                    </span>
                    <span className="text-xs text-emerald-100/60">
                      {t('setup.playerFieldsHint')}
                    </span>
                  </div>
                  {renderPlayerFields(
                    matchClass === 'singles'
                      ? t('setup.playerB')
                      : t('setup.playerB1'),
                    pB1,
                    setPB1
                  )}
                  {matchClass === 'doubles' &&
                    renderPlayerFields(t('setup.playerB2'), pB2, setPB2)}
                </div>
              </section>
            </div>

            {/* Right Column: Coin Toss & Starting Court Lineup */}
            <div className="space-y-6 lg:col-span-5">
              <section className="rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-5 space-y-5">
                <h2 className="text-base font-bold text-white">
                  {t('setup.section4Title')}
                </h2>

                {/* First Server */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-emerald-100/80">
                    {t('setup.firstServeLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFirstServerSide('A')}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        firstServerSide === 'A'
                          ? 'border-emerald-400 bg-emerald-500/20 text-white'
                          : 'border-emerald-900/70 bg-[#061814] text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {firstServerSide === 'A' && (
                        <Check className="h-4 w-4 text-emerald-400" />
                      )}
                      <span className="truncate">
                        {matchClass === 'singles'
                          ? previewNames.a1
                          : t('setup.teamA')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFirstServerSide('B')}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        firstServerSide === 'B'
                          ? 'border-amber-400 bg-amber-500/20 text-white'
                          : 'border-emerald-900/70 bg-[#061814] text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {firstServerSide === 'B' && (
                        <Check className="h-4 w-4 text-amber-400" />
                      )}
                      <span className="truncate">
                        {matchClass === 'singles'
                          ? previewNames.b1
                          : t('setup.teamB')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Starting Court Halves */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-emerald-100/80">
                      {t('setup.startingEndsLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSideAHalf(sideAHalf === 'left' ? 'right' : 'left')
                      }
                      className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {t('setup.swapEnds')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-emerald-900/70 bg-[#061814] p-3">
                      <div className="text-emerald-100/60">
                        {t('setup.end1Label')}
                      </div>
                      <div className="mt-1 font-bold text-sm text-white truncate">
                        {sideAHalf === 'left'
                          ? matchClass === 'singles'
                            ? previewNames.a1
                            : t('setup.teamA')
                          : matchClass === 'singles'
                            ? previewNames.b1
                            : t('setup.teamB')}
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-900/70 bg-[#061814] p-3">
                      <div className="text-emerald-100/60">
                        {t('setup.end2Label')}
                      </div>
                      <div className="mt-1 font-bold text-sm text-white truncate">
                        {sideBHalf === 'right'
                          ? matchClass === 'singles'
                            ? previewNames.b1
                            : t('setup.teamB')
                          : matchClass === 'singles'
                            ? previewNames.a1
                            : t('setup.teamA')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Doubles Service Box Assignment */}
                {matchClass === 'doubles' && (
                  <div className="space-y-3 pt-1">
                    <div className="text-xs font-medium text-emerald-100/80">
                      {t('setup.startingServiceBoxesLabel')}
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-xl border border-emerald-900/70 bg-[#061814] p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-300">
                            {t('setup.teamA')} · {t('setup.rightServiceBox')}
                          </span>
                          <span className="text-emerald-100/60">
                            {firstServerSide === 'A'
                              ? t('setup.firstServer')
                              : t('setup.firstReceiver')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTeamARightServer('1')}
                            className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold truncate transition-colors ${
                              teamARightServer === '1'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-emerald-950/60 text-emerald-100/75 hover:text-white'
                            }`}
                          >
                            {previewNames.a1}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeamARightServer('2')}
                            className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold truncate transition-colors ${
                              teamARightServer === '2'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-emerald-950/60 text-emerald-100/75 hover:text-white'
                            }`}
                          >
                            {previewNames.a2}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-900/70 bg-[#061814] p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-amber-300">
                            {t('setup.teamB')} · {t('setup.rightServiceBox')}
                          </span>
                          <span className="text-emerald-100/60">
                            {firstServerSide === 'B'
                              ? t('setup.firstServer')
                              : t('setup.firstReceiver')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTeamBRightServer('1')}
                            className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold truncate transition-colors ${
                              teamBRightServer === '1'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-950/60 text-emerald-100/75 hover:text-white'
                            }`}
                          >
                            {previewNames.b1}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeamBRightServer('2')}
                            className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold truncate transition-colors ${
                              teamBRightServer === '2'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-950/60 text-emerald-100/75 hover:text-white'
                            }`}
                          >
                            {previewNames.b2}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Mini Court Orientation Preview */}
                <div>
                  <div className="mb-2 text-xs font-medium text-emerald-100/80">
                    {t('setup.startingCourtPreview')}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-emerald-700/60 bg-[#0E5A48] p-2">
                    <div className="grid grid-cols-2 border-2 border-white/80">
                      {/* Left Half */}
                      <div className="grid grid-rows-2 border-r-2 border-dashed border-white/80">
                        <div
                          className={`flex flex-col items-center justify-center border-b border-white/50 px-2 py-3 text-center ${
                            matchClass === 'doubles' ? 'min-h-[54px]' : 'min-h-[48px] opacity-60'
                          }`}
                        >
                          {matchClass === 'doubles' && (
                            <>
                              <span className="text-[10px] text-white/70">
                                {t('setup.leftBox')}
                              </span>
                              <span className="max-w-full truncate text-xs font-bold text-white">
                                {leftTeamNames.top}
                              </span>
                            </>
                          )}
                        </div>
                        <div
                          className={`flex flex-col items-center justify-center px-2 py-3 text-center ${
                            firstServerSide === leftSide
                              ? 'bg-amber-400/25 ring-1 ring-inset ring-amber-300'
                              : 'bg-emerald-400/10'
                          }`}
                        >
                          <span className="text-[10px] text-white/80">
                            {t('setup.rightBox')} ·{' '}
                            {firstServerSide === leftSide
                              ? t('setup.server')
                              : t('setup.receiver')}
                          </span>
                          <span className="max-w-full truncate text-xs font-bold text-white">
                            {matchClass === 'doubles'
                              ? leftTeamNames.bottom
                              : leftTeamNames.single}
                          </span>
                        </div>
                      </div>

                      {/* Right Half */}
                      <div className="grid grid-rows-2">
                        <div
                          className={`flex flex-col items-center justify-center border-b border-white/50 px-2 py-3 text-center ${
                            firstServerSide === rightSide
                              ? 'bg-amber-400/25 ring-1 ring-inset ring-amber-300'
                              : 'bg-emerald-400/10'
                          }`}
                        >
                          <span className="text-[10px] text-white/80">
                            {t('setup.rightBox')} ·{' '}
                            {firstServerSide === rightSide
                              ? t('setup.server')
                              : t('setup.receiver')}
                          </span>
                          <span className="max-w-full truncate text-xs font-bold text-white">
                            {matchClass === 'doubles'
                              ? rightTeamNames.top
                              : rightTeamNames.single}
                          </span>
                        </div>
                        <div
                          className={`flex flex-col items-center justify-center px-2 py-3 text-center ${
                            matchClass === 'doubles' ? 'min-h-[54px]' : 'min-h-[48px] opacity-60'
                          }`}
                        >
                          {matchClass === 'doubles' && (
                            <>
                              <span className="text-[10px] text-white/70">
                                {t('setup.leftBox')}
                              </span>
                              <span className="max-w-full truncate text-xs font-bold text-white">
                                {rightTeamNames.bottom}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Start Match CTA */}
                <button
                  type="submit"
                  className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-bold text-slate-950 shadow-lg transition-colors hover:bg-emerald-400 active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  {t('setup.startMatchCta')}
                </button>
              </section>
            </div>
          </div>
        </form>

        {/* Archived Matches Section */}
        {archivedMatches.length > 0 && (
          <section className="mt-10 border-t border-emerald-900/70 pt-8">
            <h2 className="text-base font-bold text-white">
              {t('setup.recentMatchesTitle')}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archivedMatches.map((m) => (
                <div
                  key={m.config.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-900/70 bg-[#0B241E] p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">
                        {m.config.matchName}
                      </span>
                      {m.matchWinner && (
                        <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                      )}
                    </div>
                    {(m.config.tournamentName || m.config.courtName) && (
                      <div className="mt-0.5 truncate text-[11px] text-emerald-200/75">
                        {[m.config.tournamentName, m.config.courtName]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-emerald-100/70 tabular-nums">
                      <span className="font-mono font-semibold text-emerald-300">
                        {getMatchCategoryDisplay(m.config)}
                      </span>{' '}
                      · {m.gamesWonA}–{m.gamesWonB} {t('common.sets')} ·{' '}
                      {m.rallies.length} {t('common.rallies')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-900/60">
                    <button
                      type="button"
                      onClick={() => onOpenArchiveAnalyse(m)}
                      className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-950 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-900"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      {t('common.analyse')}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportMatchAsJSON(m)}
                      className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-emerald-800/70 px-3 text-xs font-semibold text-emerald-100/80 hover:bg-emerald-950"
                      title={t('common.exportJson')}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('common.json')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <LanguageModal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} />
    </div>
  );
};
