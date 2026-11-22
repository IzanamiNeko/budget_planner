import { formatEuro } from '../data/initialBudget';
import { Category, CategoryId, Transaction } from '../types/budget';

interface CategoryOverviewProps {
  categories: Category[];
  transactions: Transaction[];
  selectedCategory: CategoryId | 'all';
  onSelectCategory: (categoryId: CategoryId | 'all') => void;
  onUpdateCategoryTarget?: (categoryId: CategoryId, newTarget: number) => void;
  editable?: boolean;
}

export function CategoryOverview({
  categories,
  transactions,
  selectedCategory,
  onSelectCategory,
  onUpdateCategoryTarget,
  editable = false,
}: CategoryOverviewProps) {
  const spentByCategory = categories.map((category) => {
    const spent = transactions
      .filter((tx) => tx.categoryId === category.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const ratio = category.targetBudget > 0 ? spent / category.targetBudget : 0;
    const clamped = Math.min(Math.max(ratio, 0), 1);
    const count = transactions.filter((tx) => tx.categoryId === category.id).length;

    return {
      ...category,
      spent,
      ratio,
      clamped,
      count,
      isOver: spent > category.targetBudget,
    };
  });

  return (
    <section
      aria-label="Ausgaben nach Kategorien"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Kategorien
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {editable
              ? 'Richtwerte pro Kategorie direkt anpassen'
              : 'Klicke auf eine Kategorie, um Buchungen zu filtern'}
          </p>
        </div>

        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {spentByCategory.map((item) => {
          const isSelected = selectedCategory === item.id;
          return (
            <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <button
                  type="button"
                  onClick={() =>
                    onSelectCategory(isSelected ? 'all' : item.id)
                  }
                  className={`text-left text-sm font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-emerald-700 dark:text-emerald-400 underline underline-offset-4'
                      : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {item.name}
                </button>

                <div className="flex items-center gap-3 text-sm font-mono-tabular shrink-0">
                  <span
                    className={
                      item.isOver
                        ? 'font-semibold text-[#C62828] dark:text-red-400'
                        : 'font-semibold text-slate-900 dark:text-slate-100'
                    }
                  >
                    {formatEuro(item.spent)}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    / {formatEuro(item.targetBudget)}
                  </span>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                  style={{
                    transform: `scaleX(${item.clamped})`,
                    backgroundColor: item.isOver ? '#C62828' : item.accentHex,
                  }}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {item.count} {item.count === 1 ? 'Eintrag' : 'Einträge'}
                  {item.isOver ? ' · Richtwert überschritten' : ''}
                </span>
                <span className="font-mono-tabular">
                  {Math.round(item.ratio * 100)} %
                </span>
              </div>

              {editable && onUpdateCategoryTarget && (
                <div className="mt-3 flex items-center gap-3">
                  <label
                    htmlFor={`target-${item.id}`}
                    className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
                  >
                    Monats-Richtwert:
                  </label>
                  <input
                    id={`target-${item.id}`}
                    type="range"
                    min={50}
                    max={1000}
                    step={10}
                    value={item.targetBudget}
                    onChange={(e) =>
                      onUpdateCategoryTarget(item.id, Number(e.target.value))
                    }
                    className="budget-slider flex-1 bg-slate-200 dark:bg-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-mono-tabular text-slate-700 dark:text-slate-300 w-16 text-right">
                    {formatEuro(item.targetBudget)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
