import { Pause, Play, Repeat, Trash2 } from 'lucide-react';
import {
  formatEuro,
  formatGermanDate,
  getCategoryName,
  getIntervalLabel,
  getNextOccurrenceDate,
} from '../data/initialBudget';
import { Category, RecurringRule } from '../types/budget';

interface RecurringTransactionsSectionProps {
  rules: RecurringRule[];
  categories: Category[];
  onToggleRuleActive: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onOpenNewModal: () => void;
}

export function RecurringTransactionsSection({
  rules,
  categories,
  onToggleRuleActive,
  onDeleteRule,
  onOpenNewModal,
}: RecurringTransactionsSectionProps) {
  const activeMonthlyTotal = rules
    .filter((r) => r.active)
    .reduce(
      (sum, r) => sum + (r.interval === 'monthly' ? r.amount : r.amount * 4.33),
      0,
    );

  return (
    <section
      aria-label="Wiederkehrende Transaktionen und Abonnements"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Wiederkehrende Buchungen & Abonnements
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Werden am jeweiligen Fälligkeitstag automatisch zur Liste hinzugefügt
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular">
              Monatliche Fixkosten: {formatEuro(Math.round(activeMonthlyTotal * 100) / 100)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewModal}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Neues Abo anlegen</span>
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            Keine wiederkehrenden Ausgaben hinterlegt
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Markiere beim Erstellen einer Ausgabe die Option „Als wiederkehrend markieren“ oder klicke auf das Wiederholen-Symbol in der Liste.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {rules.map((rule) => {
            const nextDate = getNextOccurrenceDate(rule);
            return (
              <li
                key={rule.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-2 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium truncate ${
                        rule.active
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-400 dark:text-slate-500 line-through'
                      }`}
                    >
                      {rule.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{getCategoryName(categories, rule.categoryId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getIntervalLabel(rule.interval)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {rule.active
                        ? `Nächste Buchung: ${formatGermanDate(nextDate)}`
                        : 'Pausiert'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono-tabular mr-2">
                    {formatEuro(rule.amount)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggleRuleActive(rule.id)}
                    aria-label={
                      rule.active
                        ? `${rule.title} pausieren`
                        : `${rule.title} aktivieren`
                    }
                    title={rule.active ? 'Pausieren' : 'Aktivieren'}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {rule.active ? (
                      <Pause className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Play className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    aria-label={`Wiederkehrende Regel ${rule.title} entfernen`}
                    title="Wiederholung beenden"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-[#C62828] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
