import { Plus, Repeat, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  formatEuro,
  formatGermanDate,
  getCategoryName,
  getIntervalLabel,
} from '../data/initialBudget';
import { Category, CategoryId, Transaction } from '../types/budget';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  selectedCategory: CategoryId | 'all';
  onSelectCategory: (categoryId: CategoryId | 'all') => void;
  onDeleteTransaction: (id: string) => void;
  onMarkAsRecurring: (tx: Transaction) => void;
  onOpenNewModal: () => void;
  maxItems?: number;
  onViewAll?: () => void;
}

function matchesAmountQuery(amount: number, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  // Support comparison queries like ">20", "< 50", ">= 25", "<= 100"
  const operatorMatch = trimmed.match(/^(>=|<=|>|<)\s*(\d+(?:[.,]\d+)?)\s*€?$/);
  if (operatorMatch) {
    const [, op, numStr] = operatorMatch;
    const target = Number(numStr.replace(',', '.'));
    if (Number.isFinite(target)) {
      if (op === '>') return amount > target;
      if (op === '>=') return amount >= target;
      if (op === '<') return amount < target;
      if (op === '<=') return amount <= target;
    }
  }

  const normalizedQuery = trimmed
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');

  if (!normalizedQuery || !/\d/.test(normalizedQuery)) {
    return false;
  }

  const candidates = [
    String(amount),
    amount.toFixed(2),
    amount.toFixed(2).replace('.', ','),
    String(amount).replace('.', ','),
    formatEuro(amount).replace(/\s+/g, '').replace('€', '').toLowerCase(),
  ];

  return candidates.some(
    (candidate) =>
      candidate.includes(normalizedQuery) ||
      candidate.replace(',', '.').includes(normalizedQuery),
  );
}

export function TransactionList({
  transactions,
  categories,
  selectedCategory,
  onSelectCategory,
  onDeleteTransaction,
  onMarkAsRecurring,
  onOpenNewModal,
  maxItems,
  onViewAll,
}: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        const matchesCategory =
          selectedCategory === 'all' || tx.categoryId === selectedCategory;
        const matchesQuery =
          !query ||
          tx.title.toLowerCase().includes(query) ||
          getCategoryName(categories, tx.categoryId)
            .toLowerCase()
            .includes(query) ||
          matchesAmountQuery(tx.amount, searchQuery);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt - a.createdAt;
      });
  }, [transactions, categories, selectedCategory, searchQuery]);

  const visibleTransactions = useMemo(
    () =>
      maxItems && maxItems > 0
        ? filteredTransactions.slice(0, maxItems)
        : filteredTransactions,
    [filteredTransactions, maxItems],
  );

  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions],
  );

  const hasActiveFilter =
    searchQuery.trim().length > 0 || selectedCategory !== 'all';

  return (
    <section
      aria-label="Transaktionen und Ausgabenverlauf"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {maxItems ? 'Letzte Transaktionen' : 'Transaktionen'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
            {filteredTransactions.length}{' '}
            {filteredTransactions.length === 1 ? 'Ausgabe' : 'Ausgaben'}
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            Summe: {formatEuro(filteredTotal)}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Titel oder Betrag suchen..."
            aria-label="Ausgaben nach Titel oder Betrag durchsuchen"
            className="w-full min-h-[40px] pl-9 pr-9 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Suche zurücksetzen"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Filter Tabs */}
      <div
        role="tablist"
        aria-label="Nach Kategorie filtern"
        className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto mb-5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => onSelectCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Alle
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            {transactions.length === 0
              ? 'Noch keine Ausgaben erfasst'
              : 'Keine passenden Buchungen gefunden'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {transactions.length === 0
              ? 'Nutze die Schnell-Buttons oben oder erfasse eine eigene Ausgabe.'
              : 'Passe deine Suche (Titel oder Betrag) bzw. den Kategorie-Filter an.'}
          </p>
          {transactions.length > 0 && hasActiveFilter ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onSelectCategory('all');
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Suche & Filter zurücksetzen</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Erste Ausgabe erfassen</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleTransactions.map((tx) => {
              const isRecurring = Boolean(tx.recurringId);
              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {tx.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{getCategoryName(categories, tx.categoryId)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {formatGermanDate(tx.date)}
                      </span>
                      {isRecurring && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {getIntervalLabel(tx.recurringInterval ?? 'monthly')} wiederkehrend
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono-tabular mr-1">
                      −{formatEuro(tx.amount)}
                    </span>

                    {!isRecurring && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRecurring(tx)}
                        aria-label={`${tx.title} als monatlich wiederkehrend markieren`}
                        title="Als monatlich wiederkehrend markieren"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      >
                        <Repeat className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(tx.id)}
                      aria-label={`${tx.title} löschen`}
                      title="Ausgabe löschen"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-[#C62828] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {maxItems && onViewAll && filteredTransactions.length > maxItems && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Zeige {visibleTransactions.length} von {filteredTransactions.length} Buchungen
              </span>
              <button
                type="button"
                onClick={onViewAll}
                className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                Alle Transaktionen anzeigen →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
