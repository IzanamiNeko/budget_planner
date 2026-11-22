import {
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEuro } from '../data/initialBudget';
import { DebtItem, DebtPayoffStrategy } from '../types/budget';
import {
  DebtSchedulePoint,
  formatGermanDateShort,
  formatTermLabel,
  getContractTermInfo,
  getPriorityOrderedDebts,
  mergeScheduleForChart,
  simulateDebtPayoff,
} from '../utils/debtPlanner';
import { DebtFormModal } from './DebtFormModal';
import { DebtPaymentModal } from './DebtPaymentModal';

interface DebtFreeSectionProps {
  debts: DebtItem[];
  strategy: DebtPayoffStrategy;
  extraMonthly: number;
  remainingMonthlyBudget: number;
  onStrategyChange: (strategy: DebtPayoffStrategy) => void;
  onExtraMonthlyChange: (extra: number) => void;
  onCreateDebt: (payload: {
    title: string;
    creditor: string;
    initialBalance: number;
    currentBalance: number;
    interestRate: number;
    minimumPayment: number;
    termMonths?: number;
    disbursedAt?: string;
    accentHex: string;
  }) => void;
  onUpdateDebt: (
    debtId: string,
    payload: {
      title: string;
      creditor: string;
      initialBalance: number;
      currentBalance: number;
      interestRate: number;
      minimumPayment: number;
      termMonths?: number;
      disbursedAt?: string;
      accentHex: string;
    },
  ) => void;
  onRecordPayment: (
    debt: DebtItem,
    amount: number,
    date: string,
    alsoBookAsExpense: boolean,
  ) => void;
  onDeleteDebt: (debtId: string) => void;
  onLoadSampleDebts: () => void;
}

interface CustomPayoffTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: DebtSchedulePoint }>;
  showBaseline?: boolean;
}

function CustomPayoffTooltip({
  active,
  payload,
  showBaseline,
}: CustomPayoffTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
        {point.monthIndex === 0 ? 'Heute' : `Monat ${point.monthIndex} (${point.label})`}
      </p>
      <div className="space-y-1 font-mono-tabular text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between gap-5">
          <span>Restschuld (mit Plan):</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {formatEuro(point.remainingTotal)}
          </span>
        </div>
        {showBaseline && point.baselineRemaining !== null && (
          <div className="flex items-center justify-between gap-5">
            <span>Nur Mindestraten:</span>
            <span>{formatEuro(point.baselineRemaining)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-5 pt-0.5 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
          <span>Zinsen kumuliert:</span>
          <span>{formatEuro(point.cumulativeInterest)}</span>
        </div>
      </div>
    </div>
  );
}

export function DebtFreeSection({
  debts,
  strategy,
  extraMonthly,
  remainingMonthlyBudget,
  onStrategyChange,
  onExtraMonthlyChange,
  onCreateDebt,
  onUpdateDebt,
  onRecordPayment,
  onDeleteDebt,
  onLoadSampleDebts,
}: DebtFreeSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<DebtItem | null>(null);

  const activeDebts = useMemo(
    () => debts.filter((d) => d.currentBalance > 0.005),
    [debts],
  );

  const orderedDebts = useMemo(
    () => getPriorityOrderedDebts(debts, strategy),
    [debts, strategy],
  );

  const totals = useMemo(() => {
    const totalInitial = debts.reduce((sum, d) => sum + d.initialBalance, 0);
    const totalCurrent = debts.reduce((sum, d) => sum + d.currentBalance, 0);
    const totalPaidOff = Math.max(0, totalInitial - totalCurrent);
    const progress = totalInitial > 0 ? totalPaidOff / totalInitial : 1;
    const totalMinimums = activeDebts.reduce(
      (sum, d) => sum + d.minimumPayment,
      0,
    );
    const weightedRate =
      totalCurrent > 0
        ? activeDebts.reduce(
            (sum, d) => sum + d.currentBalance * d.interestRate,
            0,
          ) / totalCurrent
        : 0;

    return {
      totalInitial: Math.round(totalInitial * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      totalPaidOff: Math.round(totalPaidOff * 100) / 100,
      progress: Math.min(1, Math.max(0, progress)),
      totalMinimums: Math.round(totalMinimums * 100) / 100,
      weightedRate: Math.round(weightedRate * 10) / 10,
    };
  }, [debts, activeDebts]);

  const plannedSim = useMemo(
    () => simulateDebtPayoff(debts, strategy, extraMonthly),
    [debts, strategy, extraMonthly],
  );

  const baselineSim = useMemo(
    () =>
      simulateDebtPayoff(debts, strategy, 0, {
        cascadeFreedMinimums: false,
      }),
    [debts, strategy],
  );

  const avalancheSim = useMemo(
    () => simulateDebtPayoff(debts, 'avalanche', extraMonthly),
    [debts, extraMonthly],
  );

  const snowballSim = useMemo(
    () => simulateDebtPayoff(debts, 'snowball', extraMonthly),
    [debts, extraMonthly],
  );

  const chartSeries = useMemo(
    () => mergeScheduleForChart(plannedSim, baselineSim),
    [plannedSim, baselineSim],
  );

  const showBaselineComparison =
    !baselineSim.stalled &&
    !plannedSim.stalled &&
    (extraMonthly > 0 || activeDebts.length > 1);

  const monthsSaved =
    !plannedSim.stalled && !baselineSim.stalled
      ? Math.max(0, baselineSim.monthsToFreedom - plannedSim.monthsToFreedom)
      : 0;
  const interestSaved =
    !plannedSim.stalled && !baselineSim.stalled
      ? Math.max(
          0,
          Math.round(
            (baselineSim.totalInterestPaid - plannedSim.totalInterestPaid) *
              100,
          ) / 100,
        )
      : 0;

  const totalMonthlyDebtCommitment = totals.totalMinimums + extraMonthly;

  const openCreateModal = () => {
    setEditingDebt(null);
    setIsFormOpen(true);
  };

  const openEditModal = (debt: DebtItem) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };

  if (debts.length === 0) {
    return (
      <div className="space-y-6">
        <section
          aria-label="Schuldenplan"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 text-center"
        >
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 text-balance">
              Dein persönlicher Schuldenplan
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Erfasse Kredite, Kreditkarten oder Ratenzahlungen mit Zinssatz und Mindestrate. Vergleiche die Lawinen- und Schneeball-Methode, plane monatliche Sondertilgungen und sieh sofort, wann du komplett schuldenfrei bist.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Erste Verbindlichkeit anlegen</span>
              </button>

              <button
                type="button"
                onClick={onLoadSampleDebts}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Beispiel-Szenario laden</span>
              </button>
            </div>
          </div>
        </section>

        <DebtFormModal
          isOpen={isFormOpen}
          editingDebt={editingDebt}
          onClose={() => setIsFormOpen(false)}
          onSubmit={(payload) => {
            if (editingDebt) {
              onUpdateDebt(editingDebt.id, payload);
            } else {
              onCreateDebt(payload);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Primary Schuldenplan KPI Summary Card */}
      <section
        aria-label="Schuldenplan-Übersicht"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Verbleibende Gesamtschuld
                </p>
                <div className="flex flex-wrap items-baseline gap-3 mt-1">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-mono-tabular">
                    {formatEuro(totals.totalCurrent)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
                    von {formatEuro(totals.totalInitial)} ursprünglich
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Verbindlichkeit hinzufügen</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full w-full rounded-full origin-left transition-transform duration-500 ease-out bg-[#2E7D32] dark:bg-emerald-500"
                  style={{ transform: `scaleX(${totals.progress})` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono-tabular">
                  Bereits getilgt:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatEuro(totals.totalPaidOff)}
                  </strong>{' '}
                  ({Math.round(totals.progress * 100)} %)
                </span>
                <span>
                  {totals.totalCurrent === 0
                    ? 'Alle Verbindlichkeiten abbezahlt'
                    : plannedSim.stalled
                      ? 'Monatliche Rate deckt Zinsen nicht — Sondertilgung erhöhen'
                      : `Voraussichtlich schuldenfrei: ${plannedSim.debtFreeDateLabel} (${plannedSim.monthsToFreedom} ${plannedSim.monthsToFreedom === 1 ? 'Monat' : 'Monate'})`}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-x-6 gap-y-4 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Schuldenfrei-Datum
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {plannedSim.debtFreeDateLabel}
              </p>
              {!plannedSim.stalled && monthsSaved > 0 && (
                <p className="text-xs text-[#2E7D32] dark:text-emerald-400 mt-0.5 font-mono-tabular">
                  {monthsSaved} {monthsSaved === 1 ? 'Monat' : 'Monate'} schneller
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zinsersparnis (Plan)
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5 font-mono-tabular">
                {plannedSim.stalled
                  ? '—'
                  : baselineSim.stalled
                    ? 'Zinsfalle vermieden'
                    : formatEuro(interestSaved)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
                {plannedSim.stalled
                  ? 'Rate unter Monatszins'
                  : `Restzinsen: ${formatEuro(plannedSim.totalInterestPaid)}`}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monatliche Tilgungsrate
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5 font-mono-tabular">
                {formatEuro(totalMonthlyDebtCommitment)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
                {formatEuro(totals.totalMinimums)} Pflicht + {formatEuro(extraMonthly)} Extra
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ø Zinssatz & Positionen
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5 font-mono-tabular">
                {totals.weightedRate.toFixed(1).replace('.', ',')} % p.a.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeDebts.length} offen · {debts.length - activeDebts.length} getilgt
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Strategy Simulator (5 cols) + Payoff Chart (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section
          aria-label="Tilgungsstrategie und Sondertilgung"
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Strategie & Sondertilgung
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Wähle deine Reihenfolge und simuliere monatliche Extrazahlungen.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Tilgungsstrategie wählen"
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={strategy === 'avalanche'}
                onClick={() => onStrategyChange('avalanche')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  strategy === 'avalanche'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Lawine (Zins zuerst)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={strategy === 'snowball'}
                onClick={() => onStrategyChange('snowball')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  strategy === 'snowball'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Schneeball (Kleinste zuerst)
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {strategy === 'avalanche'
                ? 'Lawinen-Methode: Tilgt zuerst den Kredit mit dem höchsten Zinssatz — mathematisch die maximale Zinsersparnis.'
                : 'Schneeball-Methode: Tilgt zuerst die kleinste Restschuld — sorgt für schnelle sichtbare Teilerfolge.'}
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-sm">
                <label
                  htmlFor="extra-monthly-slider"
                  className="font-medium text-slate-800 dark:text-slate-200"
                >
                  Monatliche Sondertilgung
                </label>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                  + {formatEuro(extraMonthly)} / Mon.
                </span>
              </div>
              <input
                id="extra-monthly-slider"
                type="range"
                min={0}
                max={1000}
                step={25}
                value={Math.min(1000, extraMonthly)}
                onChange={(e) => onExtraMonthlyChange(Number(e.target.value))}
                className="budget-slider w-full bg-slate-200 dark:bg-slate-700 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 font-mono-tabular">
                <span>0 €</span>
                <span>500 €</span>
                <span>1.000 €</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Lawinen-Methode (Gesamtzinsen):</span>
              <span className="font-mono-tabular font-medium text-slate-900 dark:text-slate-100">
                {avalancheSim.stalled
                  ? 'Rate zu niedrig'
                  : `${formatEuro(avalancheSim.totalInterestPaid)} · ${avalancheSim.monthsToFreedom} Mon.`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Schneeball-Methode (Gesamtzinsen):</span>
              <span className="font-mono-tabular font-medium text-slate-900 dark:text-slate-100">
                {snowballSim.stalled
                  ? 'Rate zu niedrig'
                  : `${formatEuro(snowballSim.totalInterestPaid)} · ${snowballSim.monthsToFreedom} Mon.`}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <span>Freies Restbudget diesen Monat:</span>
              <span
                className={`font-mono-tabular font-semibold ${
                  remainingMonthlyBudget >= totalMonthlyDebtCommitment
                    ? 'text-[#2E7D32] dark:text-emerald-400'
                    : 'text-[#EF6C00] dark:text-amber-400'
                }`}
              >
                {formatEuro(remainingMonthlyBudget)}
              </span>
            </div>
          </div>
        </section>

        <section
          aria-label="Prognostizierter Schuldenabbau"
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Tilgungs-Prognose
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {showBaselineComparison
                  ? 'Geplanter Abbau (inkl. Übertrag) vs. nur Mindestraten'
                  : 'Prognostizierter Restschulden-Verlauf bis zur Tilgung'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                Mit Tilgungsplan
              </span>
              {showBaselineComparison && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
                  Nur Mindestraten
                </span>
              )}
            </div>
          </div>

          {totals.totalCurrent === 0 ? (
            <div className="py-12 flex-1 flex flex-col items-center justify-center text-center">
              <CheckCircle2
                className="w-8 h-8 text-[#2E7D32] dark:text-emerald-400 mb-2"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Alle erfassten Verbindlichkeiten sind getilgt!
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Du kannst bestehende Einträge entfernen oder neue Schulden hinzufügen.
              </p>
            </div>
          ) : plannedSim.stalled ? (
            <div className="py-12 flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tilgungsrate aktuell zu niedrig für Prognose
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Die monatliche Gesamtrate deckt die laufenden Zinsen nicht ausreichend ab. Erhöhe die Mindestrate einer Position oder schiebe den Regler für die Sondertilgung nach rechts.
              </p>
            </div>
          ) : (
            <div className="pt-5 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartSeries}
                  margin={{ top: 10, right: 14, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="debtPayoffGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={32}
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-slate-500 dark:text-slate-400 font-mono-tabular"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: number) =>
                      `${new Intl.NumberFormat('de-DE', {
                        maximumFractionDigits: 0,
                      }).format(val)} €`
                    }
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-slate-500 dark:text-slate-400 font-mono-tabular"
                    width={76}
                  />
                  <Tooltip
                    content={<CustomPayoffTooltip showBaseline={showBaselineComparison} />}
                    cursor={{ stroke: 'rgba(148, 163, 184, 0.45)', strokeWidth: 1 }}
                  />
                  {showBaselineComparison && (
                    <Line
                      type="monotone"
                      dataKey="baselineRemaining"
                      stroke="#94a3b8"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="remainingTotal"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fill="url(#debtPayoffGrad)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#059669',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={350}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Row 3: Priority-Ordered Debt List */}
      <section
        aria-label="Alle Verbindlichkeiten nach Tilgungsreihenfolge"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Verbindlichkeiten in Tilgungsreihenfolge
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {strategy === 'avalanche'
                ? 'Sortiert nach höchstem Zinssatz (Lawinen-Methode)'
                : 'Sortiert nach kleinster Restschuld (Schneeball-Methode)'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            + Weitere Position erfassen
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {orderedDebts.map((debt, index) => {
            const isPaidOff = debt.currentBalance <= 0.005;
            const paidSoFar = Math.max(
              0,
              Math.round((debt.initialBalance - debt.currentBalance) * 100) / 100,
            );
            const ratio =
              debt.initialBalance > 0
                ? Math.min(1, Math.max(0, paidSoFar / debt.initialBalance))
                : 1;
            const detail = plannedSim.payoffByDebt[debt.id];
            const isTopPriority = !isPaidOff && index === 0;
            const contractInfo =
              debt.disbursedAt &&
              typeof debt.termMonths === 'number' &&
              debt.termMonths >= 1
                ? getContractTermInfo(debt.disbursedAt, debt.termMonths)
                : null;
            const comparisonMonths = contractInfo
              ? contractInfo.remainingContractMonths
              : typeof debt.termMonths === 'number' && debt.termMonths >= 1
                ? debt.termMonths
                : null;

            return (
              <div
                key={debt.id}
                className="py-5 first:pt-1 last:pb-1 space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      {isPaidOff ? (
                        <span className="font-semibold text-[#2E7D32] dark:text-emerald-400">
                          Vollständig getilgt
                        </span>
                      ) : (
                        <span
                          className={
                            isTopPriority
                              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'font-medium text-slate-500 dark:text-slate-400'
                          }
                        >
                          Priorität {index + 1}
                          {isTopPriority ? ' · Aktuelles Fokus-Ziel' : ''}
                        </span>
                      )}
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {debt.creditor}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                        {debt.interestRate.toFixed(1).replace('.', ',')} % p.a.
                      </span>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                        Mindestrate: {formatEuro(debt.minimumPayment)}/Mon.
                      </span>
                      {debt.disbursedAt && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                            Ausgezahlt: {formatGermanDateShort(debt.disbursedAt)}
                          </span>
                        </>
                      )}
                      {typeof debt.termMonths === 'number' && debt.termMonths >= 1 && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                            Laufzeit: {formatTermLabel(debt.termMonths)}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {debt.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isPaidOff && (
                      <button
                        type="button"
                        onClick={() => setPaymentTarget(debt)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Tilgung buchen
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(debt)}
                      aria-label={`${debt.title} bearbeiten`}
                      title="Bearbeiten"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteDebt(debt.id)}
                      aria-label={`${debt.title} löschen`}
                      title="Löschen"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#C62828] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                    style={{
                      transform: `scaleX(${ratio})`,
                      backgroundColor: isPaidOff ? '#2E7D32' : debt.accentHex,
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono-tabular">
                    Restschuld:{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {formatEuro(debt.currentBalance)}
                    </strong>{' '}
                    / {formatEuro(debt.initialBalance)} · Getilgt:{' '}
                    {Math.round(ratio * 100)} %
                  </span>
                  <span>
                    {isPaidOff
                      ? `${debt.payments.length} ${debt.payments.length === 1 ? 'Tilgung' : 'Tilgungen'} erfasst`
                      : detail
                        ? (
                          <>
                            Schuldenfrei im {detail.payoffDateLabel}
                            {detail.interestPaid > 0
                              ? ` · ca. ${formatEuro(detail.interestPaid)} Restzinsen`
                              : ''}
                            {contractInfo && ` · Vertragsende ${contractInfo.endDateLabel}`}
                            {comparisonMonths !== null &&
                            detail.monthsToPayoff !== null ? (
                              detail.monthsToPayoff < comparisonMonths ? (
                                <span className="text-[#2E7D32] dark:text-emerald-400 font-medium">
                                  {' '}
                                  · {comparisonMonths - detail.monthsToPayoff} Mon. vor Laufzeitende
                                </span>
                              ) : detail.monthsToPayoff > comparisonMonths ? (
                                <span className="text-[#EF6C00] dark:text-amber-400 font-medium">
                                  {' '}
                                  · {detail.monthsToPayoff - comparisonMonths} Mon. über Laufzeit
                                </span>
                              ) : (
                                <span> · im Laufzeit-Plan</span>
                              )
                            ) : null}
                          </>
                        )
                        : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <DebtFormModal
        isOpen={isFormOpen}
        editingDebt={editingDebt}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(payload) => {
          if (editingDebt) {
            onUpdateDebt(editingDebt.id, payload);
          } else {
            onCreateDebt(payload);
          }
        }}
      />

      <DebtPaymentModal
        debt={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onConfirm={onRecordPayment}
      />
    </div>
  );
}
