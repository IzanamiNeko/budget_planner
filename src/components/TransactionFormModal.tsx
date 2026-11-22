import { Repeat, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toIsoDate } from '../data/initialBudget';
import { Category, CategoryId, RecurringInterval } from '../types/budget';

interface TransactionFormModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    amount: number;
    categoryId: CategoryId;
    date: string;
    isRecurring: boolean;
    interval: RecurringInterval;
  }) => void;
}

export function TransactionFormModal({
  isOpen,
  categories,
  onClose,
  onSubmit,
}: TransactionFormModalProps) {
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('lebensmittel');
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [isRecurring, setIsRecurring] = useState(false);
  const [interval, setInterval] = useState<RecurringInterval>('monthly');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const normalizedAmount = Number(amountInput.replace(',', '.'));

    if (!trimmedTitle) {
      setError('Bitte gib eine Bezeichnung für die Ausgabe ein.');
      return;
    }
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError('Bitte gib einen gültigen Betrag größer als 0 € ein.');
      return;
    }

    onSubmit({
      title: trimmedTitle,
      amount: Math.round(normalizedAmount * 100) / 100,
      categoryId,
      date: date || toIsoDate(new Date()),
      isRecurring,
      interval,
    });

    setTitle('');
    setAmountInput('');
    setCategoryId('lebensmittel');
    setDate(toIsoDate(new Date()));
    setIsRecurring(false);
    setInterval('monthly');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-transaction-title"
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
          <h2
            id="new-transaction-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Neue Ausgabe erfassen
          </h2>
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
          <div>
            <label
              htmlFor="tx-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Bezeichnung
            </label>
            <input
              id="tx-title"
              type="text"
              autoFocus
              placeholder="z. B. Streaming-Abo oder Wocheneinkauf"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tx-amount"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Betrag (€)
              </label>
              <input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                placeholder="12,50"
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
                htmlFor="tx-date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {isRecurring ? 'Startdatum' : 'Datum'}
              </label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tx-category"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kategorie
            </label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value as CategoryId)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring Option */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
              />
              <span className="text-sm text-slate-800 dark:text-slate-200">
                <span className="font-medium flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  Als wiederkehrend markieren
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Wird automatisch regelmäßig zur Ausgabenliste hinzugefügt (z. B. Abonnement).
                </span>
              </span>
            </label>

            {isRecurring && (
              <div className="pl-7">
                <label
                  htmlFor="tx-interval"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Wiederholungsintervall
                </label>
                <div
                  id="tx-interval"
                  role="radiogroup"
                  aria-label="Wiederholungsintervall"
                  className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={interval === 'monthly'}
                    onClick={() => setInterval('monthly')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      interval === 'monthly'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Monatlich
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={interval === 'weekly'}
                    onClick={() => setInterval('weekly')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      interval === 'weekly'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Wöchentlich
                  </button>
                </div>
              </div>
            )}
          </div>

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
              Ausgabe speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
