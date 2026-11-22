import { ArrowRight, CalendarCheck, PiggyBank, TrendingDown, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatEuro, getGoalTotalSaved } from '../data/initialBudget';
import { Category, SavingsGoal, Transaction } from '../types/budget';

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthlyLimit: number;
  transactions: Transaction[];
  categories: Category[];
  savingsGoals: SavingsGoal[];
  reservedThisMonth: number;
  onTransferRemainderToGoal?: (goalId: string, amount: number) => void;
}

export function MonthlySummaryModal({
  isOpen,
  onClose,
  monthlyLimit,
  transactions,
  categories,
  savingsGoals,
  reservedThisMonth,
  onTransferRemainderToGoal,
}: MonthlySummaryModalProps) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLabel = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    savingsGoals[0]?.id ?? '',
  );
  const [transferredNotice, setTransferredNotice] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setTransferredNotice('');
      return;
    }
    if (!selectedGoalId && savingsGoals.length > 0) {
      setSelectedGoalId(savingsGoals[0].id);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, savingsGoals, selectedGoalId]);

  const summary = useMemo(() => {
    const monthTransactions = transactions.filter((tx) =>
      tx.date.startsWith(currentMonthKey),
    );

    const totalSpent =
      Math.round(
        monthTransactions.reduce((sum, tx) => sum + tx.amount, 0) * 100,
      ) / 100;

    const categoryStats = categories
      .map((cat) => {
        const items = monthTransactions.filter((tx) => tx.categoryId === cat.id);
        const spent =
          Math.round(items.reduce((sum, tx) => sum + tx.amount, 0) * 100) / 100;
        const overTarget = Math.max(0, Math.round((spent - cat.targetBudget) * 100) / 100);

        return {
          ...cat,
          spent,
          count: items.length,
          sharePercent: totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0,
          overTarget,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.spent - a.spent;
      });

    // Most used category by frequency (tie-broken by highest spend), and highest spend category
    const mostUsedCategory =
      categoryStats.find((c) => c.count > 0) ?? null;
    const highestSpendCategory =
      [...categoryStats].sort((a, b) => b.spent - a.spent).find((c) => c.spent > 0) ??
      null;

    const remainingBudget = Math.max(
      0,
      Math.round((monthlyLimit - totalSpent - reservedThisMonth) * 100) / 100,
    );
    const exceededAmount = Math.max(
      0,
      Math.round((totalSpent + reservedThisMonth - monthlyLimit) * 100) / 100,
    );

    // Concrete savings potential:
    // 1. Sum of over-target category excesses (actionable optimization)
    // 2. Or 15% of flexible categories (Kaffee & Snacks + Freizeit) if all categories are on target
    const overTargetSum =
      Math.round(
        categoryStats.reduce((sum, c) => sum + c.overTarget, 0) * 100,
      ) / 100;

    const flexibleSpend =
      Math.round(
        categoryStats
          .filter((c) => c.id === 'kaffee' || c.id === 'freizeit')
          .reduce((sum, c) => sum + c.spent, 0) * 100,
      ) / 100;

    const optimizationPotential =
      overTargetSum > 0
        ? overTargetSum
        : Math.round(flexibleSpend * 0.15 * 100) / 100;

    const optimizationReason =
      overTargetSum > 0
        ? 'Durch Einhaltung überschrittener Kategorie-Richtwerte'
        : flexibleSpend > 0
          ? '15 % Reduktion bei Kaffee & Snacks / Freizeit'
          : 'Keine variablen Ausgaben im Monat erfasst';

    return {
      txCount: monthTransactions.length,
      totalSpent,
      remainingBudget,
      exceededAmount,
      mostUsedCategory,
      highestSpendCategory,
      optimizationPotential,
      optimizationReason,
      topCategories: [...categoryStats]
        .sort((a, b) => b.spent - a.spent)
        .filter((c) => c.spent > 0)
        .slice(0, 3),
    };
  }, [transactions, categories, currentMonthKey, monthlyLimit, reservedThisMonth]);

  if (!isOpen) return null;

  const handleTransferRemainder = () => {
    if (!onTransferRemainderToGoal || !selectedGoalId || summary.remainingBudget <= 0) {
      return;
    }
    const goal = savingsGoals.find((g) => g.id === selectedGoalId);
    onTransferRemainderToGoal(selectedGoalId, summary.remainingBudget);
    setTransferredNotice(
      `${formatEuro(summary.remainingBudget)} wurden dem Sparziel „${goal?.title ?? 'Sparziel'}“ gutgeschrieben.`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monthly-summary-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-4 sm:hidden"
          aria-hidden="true"
        />
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monatsrückblick · {currentMonthLabel}
              </p>
              <h2
                id="monthly-summary-title"
                className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-0.5"
              >
                Monatszusammenfassung
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Monatszusammenfassung schließen"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 3 Core Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-slate-100 dark:border-slate-800">
          {/* Metric 1: Total Expenses */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gesamtausgaben
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono-tabular mt-1">
              {formatEuro(summary.totalSpent)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-1.5">
              {summary.txCount} {summary.txCount === 1 ? 'Buchung' : 'Buchungen'} · Limit {formatEuro(monthlyLimit)}
            </p>
          </div>

          {/* Metric 2: Most Used Category */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Meist genutzte Kategorie
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1 truncate">
              {summary.mostUsedCategory
                ? summary.mostUsedCategory.name
                : 'Keine Buchungen'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-1.5">
              {summary.mostUsedCategory
                ? `${summary.mostUsedCategory.count}× genutzt · ${formatEuro(summary.mostUsedCategory.spent)} (${summary.mostUsedCategory.sharePercent} %)`
                : 'Noch keine Ausgaben erfasst'}
            </p>
          </div>

          {/* Metric 3: Savings Potential */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Einsparungspotenzial
            </p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular mt-1">
              {formatEuro(summary.optimizationPotential)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
              {summary.optimizationReason}
            </p>
          </div>
        </div>

        {/* Budget Outcome & Top Categories */}
        <div className="py-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <TrendingDown
                className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0"
                aria-hidden="true"
              />
              {summary.exceededAmount > 0 ? (
                <span className="text-[#C62828] dark:text-red-400 font-medium">
                  Budget inklusive Sparziele um{' '}
                  <span className="font-mono-tabular font-semibold">
                    {formatEuro(summary.exceededAmount)}
                  </span>{' '}
                  überschritten
                </span>
              ) : (
                <span className="text-slate-700 dark:text-slate-300">
                  Verbleibendes Restbudget am Monatsende:{' '}
                  <strong className="font-mono-tabular text-slate-900 dark:text-slate-100">
                    {formatEuro(summary.remainingBudget)}
                  </strong>
                </span>
              )}
            </div>

            {reservedThisMonth > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Bereits gespart: {formatEuro(reservedThisMonth)}
              </span>
            )}
          </div>

          {summary.topCategories.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Ausgabenstärkste Kategorien im {currentMonthLabel}
              </h3>
              <div className="space-y-2.5">
                {summary.topCategories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {cat.name}
                        {summary.highestSpendCategory?.id === cat.id && (
                          <span className="text-slate-400 dark:text-slate-500 font-normal">
                            {' '}
                            · Höchster Betrag
                          </span>
                        )}
                      </span>
                      <span className="font-mono-tabular text-slate-700 dark:text-slate-300">
                        {formatEuro(cat.spent)} ({cat.sharePercent} %)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, cat.sharePercent)}%`,
                          backgroundColor: cat.accentHex,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Direct Transfer of Remainder to a Savings Goal */}
          {summary.remainingBudget > 0 &&
            savingsGoals.length > 0 &&
            onTransferRemainderToGoal && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                {transferredNotice ? (
                  <p
                    role="status"
                    className="text-sm font-medium text-[#2E7D32] dark:text-emerald-400"
                  >
                    {transferredNotice}
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <PiggyBank
                        className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Restbudget ({formatEuro(summary.remainingBudget)}) direkt sichern:
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Sparziel für Restbudget wählen"
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {savingsGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title} ({formatEuro(getGoalTotalSaved(g))} /{' '}
                            {formatEuro(g.targetAmount)})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleTransferRemainder}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Übertragen</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
