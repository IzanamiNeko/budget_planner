import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEuro, toIsoDate } from '../data/initialBudget';
import { DebtItem } from '../types/budget';

interface DebtPaymentModalProps {
  debt: DebtItem | null;
  onClose: () => void;
  onConfirm: (
    debt: DebtItem,
    amount: number,
    date: string,
    alsoBookAsExpense: boolean,
  ) => void;
}

export function DebtPaymentModal({
  debt,
  onClose,
  onConfirm,
}: DebtPaymentModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [alsoBookAsExpense, setAlsoBookAsExpense] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!debt) return;
    const defaultAmount =
      debt.minimumPayment > 0
        ? Math.min(debt.currentBalance, debt.minimumPayment)
        : Math.min(debt.currentBalance, 100);
    setAmountInput(String(Math.round(defaultAmount * 100) / 100));
    setDate(toIsoDate(new Date()));
    setAlsoBookAsExpense(true);
    setError('');
  }, [debt]);

  useEffect(() => {
    if (!debt) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debt, onClose]);

  if (!debt) return null;

  const parsedAmount = Number(amountInput.replace(',', '.'));
  const validPreviewAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const projectedBalance = Math.max(
    0,
    Math.round((debt.currentBalance - validPreviewAmount) * 100) / 100,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Bitte gib einen gültigen Tilgungsbetrag größer als 0 € ein.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Bitte wähle ein gültiges Datum.');
      return;
    }

    onConfirm(
      debt,
      Math.round(parsedAmount * 100) / 100,
      date,
      alsoBookAsExpense,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debt-payment-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-4 sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="debt-payment-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Tilgung buchen
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {debt.title} · Restschuld: {formatEuro(debt.currentBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {debt.minimumPayment > 0 && (
              <button
                type="button"
                onClick={() =>
                  setAmountInput(
                    String(Math.min(debt.currentBalance, debt.minimumPayment)),
                  )
                }
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-mono-tabular cursor-pointer"
              >
                Mindestrate ({formatEuro(Math.min(debt.currentBalance, debt.minimumPayment))})
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setAmountInput(String(Math.min(debt.currentBalance, 100)))
              }
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-mono-tabular cursor-pointer"
            >
              100 €
            </button>
            <button
              type="button"
              onClick={() => setAmountInput(String(debt.currentBalance))}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-mono-tabular cursor-pointer"
            >
              Vollständig tilgen ({formatEuro(debt.currentBalance)})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="debt-pay-amount"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Betrag (€)
              </label>
              <input
                id="debt-pay-amount"
                type="text"
                inputMode="decimal"
                autoFocus
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="debt-pay-date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Datum
              </label>
              <input
                id="debt-pay-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2.5 border-y border-slate-100 dark:border-slate-800 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Neue Restschuld danach
            </span>
            <span
              className={`font-semibold font-mono-tabular ${
                projectedBalance === 0
                  ? 'text-[#2E7D32] dark:text-emerald-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {projectedBalance === 0
                ? '0 € (Vollständig getilgt)'
                : formatEuro(projectedBalance)}
            </span>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoBookAsExpense}
              onChange={(e) => setAlsoBookAsExpense(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Zahlung gleichzeitig als Ausgabe („Tilgung: {debt.title}“) in meinem Monatsbudget erfassen
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-[#C62828] dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tilgung verbuchen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
