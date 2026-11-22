import { CheckCircle2, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  formatEuro,
  getGoalMonthSaved,
  getGoalTotalSaved,
  toIsoDate,
} from '../data/initialBudget';
import { SavingsGoal } from '../types/budget';

interface SavingsGoalsSectionProps {
  goals: SavingsGoal[];
  onContribute: (goalId: string, amount: number) => void;
  onWithdrawMonth: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onOpenNewGoalModal: () => void;
  compact?: boolean;
  onViewAll?: () => void;
}

export function SavingsGoalsSection({
  goals,
  onContribute,
  onWithdrawMonth,
  onDeleteGoal,
  onOpenNewGoalModal,
  compact = false,
  onViewAll,
}: SavingsGoalsSectionProps) {
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const currentMonthKey = toIsoDate(new Date()).slice(0, 7);

  const totalSavedAll = goals.reduce((sum, g) => sum + getGoalTotalSaved(g), 0);
  const totalTargetAll = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavedThisMonth = goals.reduce(
    (sum, g) => sum + getGoalMonthSaved(g, currentMonthKey),
    0,
  );

  const handleCustomSubmit = (goalId: string) => {
    const raw = (customAmounts[goalId] ?? '').replace(',', '.').trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    onContribute(goalId, Math.round(parsed * 100) / 100);
    setCustomAmounts((prev) => ({ ...prev, [goalId]: '' }));
  };

  return (
    <section
      aria-label="Sparziele nach Kategorien"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sparziele
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
            {formatEuro(totalSavedAll)} / {formatEuro(totalTargetAll)}
            {totalSavedThisMonth > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                Monat: +{formatEuro(totalSavedThisMonth)}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {compact && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline px-2 py-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Verwalten →
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewGoalModal}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Neues Ziel</span>
          </button>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4 mt-5">
          <PiggyBank
            className="w-6 h-6 text-slate-400 mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            Noch keine Sparziele angelegt
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Lege ein Ziel wie „Urlaub“ oder „Notgroschen“ an, um monatlich gezielt Geld vom Budget zurückzulegen.
          </p>
          <button
            type="button"
            onClick={onOpenNewGoalModal}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Erstes Sparziel anlegen</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {goals.map((goal) => {
            const totalSaved = getGoalTotalSaved(goal);
            const monthSaved = getGoalMonthSaved(goal, currentMonthKey);
            const ratio =
              goal.targetAmount > 0 ? totalSaved / goal.targetAmount : 0;
            const clamped = Math.min(Math.max(ratio, 0), 1);
            const percent = Math.round(ratio * 100);
            const isComplete = totalSaved >= goal.targetAmount;
            const remainingToGoal = Math.max(0, goal.targetAmount - totalSaved);

            return (
              <div key={goal.id} className="py-4 first:pt-3 last:pb-0 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {goal.title}
                      </h3>
                      {isComplete && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2E7D32] dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Erreicht</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{goal.categoryLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {percent} %
                      </span>
                      {!compact && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            Monatsziel: {formatEuro(goal.monthlyTarget)}
                          </span>
                        </>
                      )}
                      {monthSaved > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                            Diesen Monat +{formatEuro(monthSaved)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right font-mono-tabular">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatEuro(totalSaved)}{' '}
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          / {formatEuro(goal.targetAmount)}
                        </span>
                      </div>
                      {!compact && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Noch {formatEuro(remainingToGoal)}
                        </div>
                      )}
                    </div>

                    {!compact && (
                      <button
                        type="button"
                        onClick={() => onDeleteGoal(goal.id)}
                        aria-label={`Sparziel ${goal.title} löschen`}
                        title="Sparziel entfernen"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-[#C62828] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div
                  role="progressbar"
                  aria-label={`Sparfortschritt ${goal.title}`}
                  aria-valuemin={0}
                  aria-valuemax={goal.targetAmount}
                  aria-valuenow={Math.round(totalSaved)}
                  className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                >
                  <div
                    className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                    style={{
                      transform: `scaleX(${clamped})`,
                      backgroundColor: isComplete ? '#16A34A' : goal.accentHex,
                    }}
                  />
                </div>

                {/* Quick Reserve Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onContribute(goal.id, 25)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono-tabular"
                    >
                      + 25 €
                    </button>
                    <button
                      type="button"
                      onClick={() => onContribute(goal.id, 50)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono-tabular"
                    >
                      + 50 €
                    </button>
                    {!compact && monthSaved > 0 && (
                      <button
                        type="button"
                        onClick={() => onWithdrawMonth(goal.id)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Monats-Rücklage leeren
                      </button>
                    )}
                  </div>

                  {!compact && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Betrag (€)"
                        aria-label={`Eigenen Betrag für ${goal.title} zurücklegen`}
                        value={customAmounts[goal.id] ?? ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [goal.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCustomSubmit(goal.id);
                          }
                        }}
                        className="w-28 min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono-tabular text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleCustomSubmit(goal.id)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Einzahlen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
