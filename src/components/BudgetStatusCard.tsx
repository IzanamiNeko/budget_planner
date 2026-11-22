import { AlertTriangle, CheckCircle2, Coffee, RotateCcw, ShoppingBag } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  MAX_MONTHLY_LIMIT,
  MIN_MONTHLY_LIMIT,
  MONTHLY_LIMIT_STEP,
  formatEuro,
  getBudgetHealth,
} from '../data/initialBudget';

interface BudgetStatusCardProps {
  monthlyLimit: number;
  spentAmount: number;
  reservedThisMonth: number;
  onLimitChange: (limit: number) => void;
  onQuickAdd: (title: string, amount: number, categoryId: 'kaffee' | 'lebensmittel') => void;
  onResetExpenses: () => void;
  onRestoreDemo: () => void;
  transactionCount: number;
}

export function BudgetStatusCard({
  monthlyLimit,
  spentAmount,
  reservedThisMonth,
  onLimitChange,
  onQuickAdd,
  onResetExpenses,
  onRestoreDemo,
  transactionCount,
}: BudgetStatusCardProps) {
  const totalCommitted = Math.round((spentAmount + reservedThisMonth) * 100) / 100;
  const remaining = Math.round((monthlyLimit - totalCommitted) * 100) / 100;
  const rawProgress = monthlyLimit > 0 ? totalCommitted / monthlyLimit : 1;
  const clampedProgress = Math.min(Math.max(rawProgress, 0), 1);
  const percentage = Math.round(rawProgress * 100);
  const health = getBudgetHealth(clampedProgress, remaining);

  const sliderPercentage =
    ((monthlyLimit - MIN_MONTHLY_LIMIT) / (MAX_MONTHLY_LIMIT - MIN_MONTHLY_LIMIT)) * 100;

  return (
    <section
      aria-label="Monatsbudget Status und Schnellsteuerung"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {health.status === 'nominal' ? (
              <CheckCircle2 className="w-4 h-4 text-[#2E7D32] dark:text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className={`w-4 h-4 shrink-0 ${health.textColorClass}`} aria-hidden="true" />
            )}
            <span className={health.textColorClass}>{health.label}</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono-tabular">
              {percentage} % verplant
            </span>
          </div>

          <h2
            className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono-tabular ${
              remaining >= 0
                ? 'text-slate-900 dark:text-slate-50'
                : 'text-[#C62828] dark:text-red-400'
            }`}
          >
            {remaining >= 0
              ? `Noch verfügbar: ${formatEuro(remaining)}`
              : `Limit überschritten um: ${formatEuro(Math.abs(remaining))}`}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Ausgegeben: <strong className="font-semibold text-slate-900 dark:text-slate-200">{formatEuro(spentAmount)}</strong>
            </span>
            {reservedThisMonth > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span>
                  Sparziele (Monat): <strong className="font-semibold text-slate-900 dark:text-slate-200">{formatEuro(reservedThisMonth)}</strong>
                </span>
              </>
            )}
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>
              Budget: <strong className="font-semibold text-slate-900 dark:text-slate-200">{formatEuro(monthlyLimit)}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>{transactionCount} {transactionCount === 1 ? 'Buchung' : 'Buchungen'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onQuickAdd('Kaffee', 5, 'kaffee')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
          >
            <Coffee className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>+ 5 € Kaffee</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickAdd('Einkauf', 25, 'lebensmittel')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>+ 25 € Einkauf</span>
          </button>

          {spentAmount > 0 ? (
            <button
              type="button"
              onClick={onResetExpenses}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ausgaben zurücksetzen</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestoreDemo}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 cursor-pointer"
            >
              <span>Beispieldaten laden</span>
            </button>
          )}
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="pt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono-tabular">
            <span>0 €</span>
            <span>70 % Warnung ({formatEuro(Math.round(monthlyLimit * 0.7))})</span>
            <span>{formatEuro(monthlyLimit)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Ausgeschöpftes Monatsbudget"
            aria-valuemin={0}
            aria-valuemax={monthlyLimit}
            aria-valuenow={Math.round(totalCommitted)}
            className="relative w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
          >
            <div
              className={`h-full w-full rounded-full origin-left transition-[transform,background-color] duration-300 ease-out ${health.barColorClass}`}
              style={{ transform: `scaleX(${clampedProgress})` }}
            />
          </div>
        </div>

        {/* Budget Slider */}
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <label
              htmlFor="monthly-budget-slider"
              className="text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Monatsbudget anpassen
            </label>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100 font-mono-tabular">
              {formatEuro(monthlyLimit)}
            </span>
          </div>
          <input
            id="monthly-budget-slider"
            type="range"
            min={MIN_MONTHLY_LIMIT}
            max={MAX_MONTHLY_LIMIT}
            step={MONTHLY_LIMIT_STEP}
            value={monthlyLimit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="budget-slider w-full cursor-pointer"
            style={{ '--slider-pct': `${sliderPercentage}%` } as CSSProperties}
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            <span>{formatEuro(MIN_MONTHLY_LIMIT)}</span>
            <span>100 €-Schritte</span>
            <span>{formatEuro(MAX_MONTHLY_LIMIT)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
