import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEuro, toIsoDate } from '../data/initialBudget';
import { DebtItem } from '../types/budget';
import {
  DEBT_COLOR_PRESETS,
  calculateMonthlyAnnuityPayment,
  getContractTermInfo,
} from '../utils/debtPlanner';

interface DebtFormModalProps {
  isOpen: boolean;
  editingDebt: DebtItem | null;
  onClose: () => void;
  onSubmit: (payload: {
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
}

const TERM_PRESETS = [12, 24, 36, 48, 60];

export function DebtFormModal({
  isOpen,
  editingDebt,
  onClose,
  onSubmit,
}: DebtFormModalProps) {
  const [title, setTitle] = useState('');
  const [creditor, setCreditor] = useState('');
  const [currentBalanceInput, setCurrentBalanceInput] = useState('');
  const [initialBalanceInput, setInitialBalanceInput] = useState('');
  const [initialTouched, setInitialTouched] = useState(false);
  const [interestInput, setInterestInput] = useState('6.5');
  const [minimumInput, setMinimumInput] = useState('50');
  const [minimumTouched, setMinimumTouched] = useState(false);
  const [termMonthsInput, setTermMonthsInput] = useState('');
  const [disbursedAtInput, setDisbursedAtInput] = useState('');
  const [accentHex, setAccentHex] = useState(DEBT_COLOR_PRESETS[0].hex);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingDebt) {
      setTitle(editingDebt.title);
      setCreditor(editingDebt.creditor);
      setCurrentBalanceInput(String(editingDebt.currentBalance));
      setInitialBalanceInput(String(editingDebt.initialBalance));
      setInitialTouched(true);
      setInterestInput(String(editingDebt.interestRate));
      setMinimumInput(String(editingDebt.minimumPayment));
      setMinimumTouched(true);
      setTermMonthsInput(
        editingDebt.termMonths ? String(editingDebt.termMonths) : '',
      );
      setDisbursedAtInput(editingDebt.disbursedAt ?? '');
      setAccentHex(editingDebt.accentHex);
    } else {
      setTitle('');
      setCreditor('');
      setCurrentBalanceInput('');
      setInitialBalanceInput('');
      setInitialTouched(false);
      setInterestInput('6.5');
      setMinimumInput('50');
      setMinimumTouched(false);
      setTermMonthsInput('');
      setDisbursedAtInput('');
      setAccentHex(DEBT_COLOR_PRESETS[0].hex);
    }
    setError('');
  }, [isOpen, editingDebt]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const previewBalance = Number(currentBalanceInput.replace(',', '.'));
  const previewInterest = Number((interestInput || '0').replace(',', '.'));
  const trimmedTermPreview = termMonthsInput.trim();
  const previewTerm = trimmedTermPreview
    ? Number(trimmedTermPreview.replace(',', '.'))
    : NaN;
  const hasValidPreviewTerm =
    Number.isInteger(previewTerm) && previewTerm >= 1 && previewTerm <= 600;

  const suggestedAnnuity =
    Number.isFinite(previewBalance) &&
    previewBalance > 0 &&
    Number.isFinite(previewInterest) &&
    previewInterest >= 0 &&
    hasValidPreviewTerm
      ? calculateMonthlyAnnuityPayment(
          previewBalance,
          previewInterest,
          previewTerm,
        )
      : 0;

  const contractInfoPreview =
    disbursedAtInput && hasValidPreviewTerm
      ? getContractTermInfo(disbursedAtInput, previewTerm)
      : null;

  useEffect(() => {
    if (!isOpen || editingDebt || minimumTouched) return;
    if (suggestedAnnuity > 0) {
      setMinimumInput(String(suggestedAnnuity));
    }
  }, [isOpen, editingDebt, minimumTouched, suggestedAnnuity]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedCreditor = creditor.trim();
    const currentBalance = Number(currentBalanceInput.replace(',', '.'));
    const initialRaw = initialBalanceInput.trim()
      ? Number(initialBalanceInput.replace(',', '.'))
      : currentBalance;
    const interestRate = Number((interestInput || '0').replace(',', '.'));
    const minimumPayment = Number((minimumInput || '0').replace(',', '.'));
    const trimmedTerm = termMonthsInput.trim();
    const parsedTerm = trimmedTerm
      ? Number(trimmedTerm.replace(',', '.'))
      : undefined;
    const trimmedDisbursedAt = disbursedAtInput.trim();

    if (!trimmedTitle) {
      setError('Bitte gib eine Bezeichnung für die Verbindlichkeit ein.');
      return;
    }
    if (!trimmedCreditor) {
      setError('Bitte gib den Kreditgeber bzw. die Bank ein.');
      return;
    }
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      setError('Bitte gib eine gültige aktuelle Restschuld ein.');
      return;
    }
    if (!Number.isFinite(initialRaw) || initialRaw <= 0) {
      setError('Der ursprüngliche Schuldenbetrag muss größer als 0 € sein.');
      return;
    }
    if (initialRaw < currentBalance) {
      setError(
        'Der ursprüngliche Betrag muss mindestens so hoch sein wie die aktuelle Restschuld.',
      );
      return;
    }
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
      setError('Der Zinssatz muss zwischen 0 % und 100 % liegen.');
      return;
    }
    if (!Number.isFinite(minimumPayment) || minimumPayment < 0) {
      setError('Die monatliche Mindestrate darf nicht negativ sein.');
      return;
    }
    if (
      parsedTerm !== undefined &&
      (!Number.isFinite(parsedTerm) ||
        !Number.isInteger(parsedTerm) ||
        parsedTerm < 1 ||
        parsedTerm > 600)
    ) {
      setError(
        'Die Laufzeit muss eine ganze Zahl zwischen 1 und 600 Monaten sein.',
      );
      return;
    }
    if (
      trimmedDisbursedAt &&
      !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDisbursedAt)
    ) {
      setError('Bitte gib ein gültiges Auszahlungsdatum ein.');
      return;
    }

    onSubmit({
      title: trimmedTitle,
      creditor: trimmedCreditor,
      initialBalance: Math.round(initialRaw * 100) / 100,
      currentBalance: Math.round(currentBalance * 100) / 100,
      interestRate: Math.round(interestRate * 100) / 100,
      minimumPayment: Math.round(minimumPayment * 100) / 100,
      ...(parsedTerm !== undefined ? { termMonths: parsedTerm } : {}),
      ...(trimmedDisbursedAt ? { disbursedAt: trimmedDisbursedAt } : {}),
      accentHex,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debt-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-4 sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2
            id="debt-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {editingDebt
              ? 'Verbindlichkeit bearbeiten'
              : 'Neue Verbindlichkeit anlegen'}
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
              htmlFor="debt-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Bezeichnung
            </label>
            <input
              id="debt-title"
              type="text"
              autoFocus
              placeholder="z. B. Kreditkarte, Autokredit oder BAföG"
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
              htmlFor="debt-creditor"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Gläubiger / Institut
            </label>
            <input
              id="debt-creditor"
              type="text"
              placeholder="z. B. Hausbank, KfW, Direktbank"
              value={creditor}
              onChange={(e) => {
                setCreditor(e.target.value);
                if (error) setError('');
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="debt-current"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Aktuelle Restschuld (€)
              </label>
              <input
                id="debt-current"
                type="text"
                inputMode="decimal"
                placeholder="1450"
                value={currentBalanceInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentBalanceInput(val);
                  if (!initialTouched && !editingDebt) {
                    setInitialBalanceInput(val);
                  }
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="debt-initial"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Ursprungsbetrag (€)
              </label>
              <input
                id="debt-initial"
                type="text"
                inputMode="decimal"
                placeholder="2000"
                value={initialBalanceInput}
                onChange={(e) => {
                  setInitialTouched(true);
                  setInitialBalanceInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="debt-interest"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Zinssatz (% p.a.)
              </label>
              <input
                id="debt-interest"
                type="text"
                inputMode="decimal"
                placeholder="6.5"
                value={interestInput}
                onChange={(e) => {
                  setInterestInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="debt-minimum"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Mindestrate / Monat (€)
              </label>
              <input
                id="debt-minimum"
                type="text"
                inputMode="decimal"
                placeholder="50"
                value={minimumInput}
                onChange={(e) => {
                  setMinimumTouched(true);
                  setMinimumInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="debt-disbursed"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Ausgezahlt am
                </label>
                {disbursedAtInput ? (
                  <button
                    type="button"
                    onClick={() => setDisbursedAtInput('')}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Leeren
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDisbursedAtInput(toIsoDate(new Date()))}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Heute
                  </button>
                )}
              </div>
              <input
                id="debt-disbursed"
                type="date"
                value={disbursedAtInput}
                onChange={(e) => {
                  setDisbursedAtInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="debt-term"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Laufzeit (Monate)
                </label>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Optional
                </span>
              </div>
              <input
                id="debt-term"
                type="text"
                inputMode="numeric"
                placeholder="z. B. 36"
                value={termMonthsInput}
                onChange={(e) => {
                  setTermMonthsInput(e.target.value);
                  if (error) setError('');
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {TERM_PRESETS.map((months) => {
                const selected = termMonthsInput.trim() === String(months);
                return (
                  <button
                    key={months}
                    type="button"
                    onClick={() => {
                      setTermMonthsInput(String(months));
                      if (error) setError('');
                    }}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-mono-tabular transition-colors cursor-pointer ${
                      selected
                        ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {months} Mon.
                  </button>
                );
              })}
              {termMonthsInput.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setTermMonthsInput('');
                    if (error) setError('');
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Keine
                </button>
              )}
            </div>

            {contractInfoPreview && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Reguläres Laufzeitende: {contractInfoPreview.endDateLabel} (noch{' '}
                {contractInfoPreview.remainingContractMonths} Mon.)
              </p>
            )}

            {suggestedAnnuity > 0 && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Rate bei {previewTerm} Mon.:{' '}
                  <strong className="font-mono-tabular text-slate-900 dark:text-slate-100">
                    {formatEuro(suggestedAnnuity)}/Mon.
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMinimumTouched(true);
                    setMinimumInput(String(suggestedAnnuity));
                    if (error) setError('');
                  }}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Übernehmen
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Farbmarkierung
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {DEBT_COLOR_PRESETS.map((preset) => {
                const selected = accentHex === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setAccentHex(preset.hex)}
                    aria-label={`Farbe ${preset.label}`}
                    aria-pressed={selected}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                      selected
                        ? 'border-slate-900 dark:border-white scale-105'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {selected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
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
              {editingDebt ? 'Änderungen speichern' : 'Verbindlichkeit speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
