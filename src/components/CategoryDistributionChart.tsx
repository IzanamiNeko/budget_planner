import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEuro } from '../data/initialBudget';
import { Category, CategoryId, Transaction } from '../types/budget';

interface CategoryDistributionChartProps {
  categories: Category[];
  transactions: Transaction[];
  selectedCategory: CategoryId | 'all';
  onSelectCategory: (categoryId: CategoryId | 'all') => void;
  onOpenNewModal: () => void;
}

interface ChartDatum {
  id: CategoryId;
  name: string;
  shortName: string;
  amount: number;
  targetBudget: number;
  sharePercent: number;
  color: string;
}

type ChartMode = 'donut' | 'bar';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ChartDatum;
  }>;
  mode: ChartMode;
}

function CustomChartTooltip({ active, payload, mode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const datum = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: datum.color }}
          aria-hidden="true"
        />
        <span>{datum.name}</span>
      </div>
      <div className="space-y-0.5 font-mono-tabular text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between gap-4">
          <span>Ausgaben:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatEuro(datum.amount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Anteil:</span>
          <span>{datum.sharePercent.toFixed(1).replace('.', ',')} %</span>
        </div>
        {mode === 'bar' && (
          <div className="flex items-center justify-between gap-4">
            <span>Richtwert:</span>
            <span>{formatEuro(datum.targetBudget)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CategoryDistributionChart({
  categories,
  transactions,
  selectedCategory,
  onSelectCategory,
  onOpenNewModal,
}: CategoryDistributionChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('donut');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLabel = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  const { chartData, monthTotal, nonZeroData } = useMemo(() => {
    const currentMonthTransactions = transactions.filter((tx) =>
      tx.date.startsWith(currentMonthKey),
    );

    const total =
      Math.round(
        currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0) * 100,
      ) / 100;

    const rawData: ChartDatum[] = categories
      .map((category) => {
        const amount =
          Math.round(
            currentMonthTransactions
              .filter((tx) => tx.categoryId === category.id)
              .reduce((sum, tx) => sum + tx.amount, 0) * 100,
          ) / 100;

        const sharePercent = total > 0 ? (amount / total) * 100 : 0;
        const shortName =
          category.name.length > 13
            ? `${category.name.slice(0, 12)}…`
            : category.name;

        return {
          id: category.id,
          name: category.name,
          shortName,
          amount,
          targetBudget: category.targetBudget,
          sharePercent,
          color: category.accentHex,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      chartData: rawData,
      monthTotal: total,
      nonZeroData: rawData.filter((item) => item.amount > 0),
    };
  }, [categories, transactions, currentMonthKey]);

  const handleCategoryClick = (categoryId: CategoryId) => {
    onSelectCategory(selectedCategory === categoryId ? 'all' : categoryId);
  };

  return (
    <section
      aria-label="Kategorieverteilung im aktuellen Monat"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Kategorieverteilung
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentMonthLabel}
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular">
              {formatEuro(monthTotal)}
            </span>
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Diagrammtyp wählen"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={chartMode === 'donut'}
            onClick={() => setChartMode('donut')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'donut'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Verteilung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={chartMode === 'bar'}
            onClick={() => setChartMode('bar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'bar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Kategorie-Balken
          </button>
        </div>
      </div>

      {monthTotal === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            Noch keine Ausgaben im {currentMonthLabel}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Sobald du eine Ausgabe für diesen Monat erfasst, erscheint hier die grafische Verteilung.
          </p>
          <button
            type="button"
            onClick={onOpenNewModal}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Ausgabe hinzufügen</span>
          </button>
        </div>
      ) : chartMode === 'donut' ? (
        <div className="pt-5 space-y-5">
          {/* Donut Chart */}
          <div className="relative h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={nonZeroData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={nonZeroData.length > 1 ? 3 : 0}
                  stroke="none"
                  isAnimationActive={true}
                  animationDuration={350}
                  onClick={(_, index) => {
                    const clicked = nonZeroData[index];
                    if (clicked) handleCategoryClick(clicked.id);
                  }}
                  className="cursor-pointer focus:outline-none"
                >
                  {nonZeroData.map((entry) => {
                    const isDimmed =
                      selectedCategory !== 'all' && selectedCategory !== entry.id;
                    return (
                      <Cell
                        key={entry.id}
                        fill={entry.color}
                        fillOpacity={isDimmed ? 0.3 : 1}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomChartTooltip mode="donut" />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Metric Summary */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Gesamt
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono-tabular">
                {formatEuro(monthTotal)}
              </span>
            </div>
          </div>

          {/* Tabular Category Share Breakdown */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
            {chartData.map((item) => {
              const isSelected = selectedCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCategoryClick(item.id)}
                  className={`w-full flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-xs sm:text-sm truncate ${
                        isSelected
                          ? 'font-semibold text-emerald-800 dark:text-emerald-300'
                          : 'font-medium text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono-tabular text-xs sm:text-sm">
                    <span className="text-slate-500 dark:text-slate-400 w-10 text-right">
                      {item.sharePercent.toFixed(0)} %
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 w-16 text-right">
                      {formatEuro(item.amount)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="pt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
              />
              <XAxis
                dataKey="shortName"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-slate-600 dark:text-slate-400"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val} €`}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-slate-500 dark:text-slate-400 font-mono-tabular"
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={<CustomChartTooltip mode="bar" />}
              />
              <Bar
                dataKey="amount"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
                onClick={(data) => {
                  const payload = (data as unknown as { payload?: ChartDatum })
                    ?.payload;
                  if (payload?.id) handleCategoryClick(payload.id);
                }}
                className="cursor-pointer"
              >
                {chartData.map((entry) => {
                  const isDimmed =
                    selectedCategory !== 'all' && selectedCategory !== entry.id;
                  return (
                    <Cell
                      key={entry.id}
                      fill={entry.color}
                      fillOpacity={isDimmed ? 0.35 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
