import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SAVINGS_CATEGORY_PRESETS } from '../data/initialBudget';

interface SavingsGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    categoryLabel: string;
    accentHex: string;
    targetAmount: number;
    initialSaved: number;
    monthlyTarget: number;
  }) => void;
}

export function SavingsGoalModal({
  isOpen,
  onClose,
  onSubmit,
}: SavingsGoalModalProps) {
  const [title, setTitle] = useState('');
  const [categoryLabel, setCategoryLabel] = useState(
    SAVINGS_CATEGORY_PRESETS[0].label,
  );
  const [targetInput, setTargetInput] = useState('');
  const [initialSavedInput, setInitialSavedInput] = useState('0');
  const [monthlyTargetInput, setMonthlyTargetInput] = useState('100');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const targetAmount = Number(targetInput.replace(',', '.'));
    const initialSaved = Number((initialSavedInput || '0').replace(',', '.'));
    const monthlyTarget = Number((monthlyTargetInput || '0').replace(',', '.'));

    if (!trimmedTitle) {
      setError('Bitte gib einen Namen für dein Sparziel ein.');
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError('Bitte gib einen gültigen Zielbetrag größer als 0 € ein.');
      return;
    }
    if (!Number.isFinite(initialSaved) || initialSaved < 0) {
      setError('Der bereits angesparte Betrag darf nicht negativ sein.');
      return;
    }
    if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
      setError('Die monatliche Sparrate darf nicht negativ sein.');
      return;
    }

    const preset = SAVINGS_CATEGORY_PRESETS.find(
      (p) => p.label === categoryLabel,
    );

    onSubmit({
      title: trimmedTitle,
      categoryLabel,
      accentHex: preset?.accentHex ?? '#0284C7',
      targetAmount: Math.round(targetAmount * 100) / 100,
      initialSaved: Math.round(initialSaved * 100) / 100,
      monthlyTarget: Math.round(monthlyTarget * 100) / 100,
    });

    setTitle('');
    setCategoryLabel(SAVINGS_CATEGORY_PRESETS[0].label);
    setTargetInput('');
    setInitialSavedInput('0');
    setMonthlyTargetInput('100');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-goal-title"
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
            id="new-goal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Neues Sparziel anlegen
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
              htmlFor="goal-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Bezeichnung
            </label>
            <input
              id="goal-title"
              type="text"
              autoFocus
              placeholder="z. B. Italien-Urlaub oder Neues Fahrrad"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label
              htmlFor="goal-category"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kategorie
            </label>
            <select
              id="goal-category"
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {SAVINGS_CATEGORY_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="goal-target"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Zielbetrag (€)
              </label>
              <input
                id="goal-target"
                type="text"
                inputMode="decimal"
                placeholder="1500"
                value={targetInput}
                onChange={(e) => {
                  setTargetInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="goal-monthly"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Monats-Sparrate (€)
              </label>
              <input
                id="goal-monthly"
                type="text"
                inputMode="decimal"
                placeholder="100"
                value={monthlyTargetInput}
                onChange={(e) => {
                  setMonthlyTargetInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="goal-initial"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Bereits angespart (€)
            </label>
            <input
              id="goal-initial"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={initialSavedInput}
              onChange={(e) => {
                setInitialSavedInput(e.target.value);
                if (error) setError('');
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
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
              Sparziel speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
