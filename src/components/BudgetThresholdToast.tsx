import { AlertTriangle, X } from 'lucide-react';
import { formatEuro } from '../data/initialBudget';

interface BudgetThresholdToastProps {
  visible: boolean;
  monthlyLimit: number;
  totalCommitted: number;
  onDismiss: () => void;
}

export function BudgetThresholdToast({
  visible,
  monthlyLimit,
  totalCommitted,
  onDismiss,
}: BudgetThresholdToastProps) {
  if (!visible) return null;

  const percentage =
    monthlyLimit > 0 ? Math.round((totalCommitted / monthlyLimit) * 100) : 100;
  const remaining = Math.round((monthlyLimit - totalCommitted) * 100) / 100;
  const isExceeded = remaining < 0;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:w-[400px] bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/70 rounded-2xl p-4 shadow-xl transition-all duration-200 ease-out"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-[#C62828] dark:text-red-400 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isExceeded
                ? 'Monatsbudget überschritten'
                : '90 %-Budgetschwelle erreicht'}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Budget-Warnung schließen"
              className="min-h-[36px] min-w-[36px] -mr-1.5 -mt-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed font-mono-tabular">
            {isExceeded ? (
              <>
                Dein Limit von {formatEuro(monthlyLimit)} ist um{' '}
                <strong className="font-semibold text-[#C62828] dark:text-red-400">
                  {formatEuro(Math.abs(remaining))}
                </strong>{' '}
                überschritten ({percentage} %).
              </>
            ) : (
              <>
                Bereits <strong className="font-semibold text-[#C62828] dark:text-red-400">{percentage} %</strong>{' '}
                ({formatEuro(totalCommitted)} von {formatEuro(monthlyLimit)}) verplant. Noch{' '}
                {formatEuro(remaining)} verfügbar.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
