import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEuro, getCategoryName } from '../data/initialBudget';
import { Category, CategoryId, Transaction } from '../types/budget';

interface SpendingTrendChartProps {
  transactions: Transaction[];
  categories: Category[];
  selectedCategory: CategoryId | 'all';
  monthlyLimit: number;
  onOpenNewModal: () => void;
}

type TrendMode = 'daily' | 'cumulative';

interface DailyPoint {
  date: string;
  axisLabel: string;
  fullDateLabel: string;
  dailyAmount: number;
  cumulativeAmount: number;
  txCount: number;
}

interface CustomTrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: DailyPoint;
  }>;
  mode: TrendMode;
}

function CustomTrendTooltip({
  active,
  payload,
  mode,
}: CustomTrendTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
        {point.fullDateLabel}
      </p>
      <div className="space-y-1 font-mono-tabular text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between gap-5">
          <span>Tagesausgaben:</span>
          <span
            className={
              mode === 'daily'
                ? 'font-semibold text-slate-900 dark:text-slate-100'
                : ''
            }
          >
            {formatEuro(point.dailyAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span>Kumuliert (30 T.):</span>
          <span
            className={
              mode === 'cumulative'
                ? 'font-semibold text-slate-900 dark:text-slate-100'
                : ''
            }
          >
            {formatEuro(point.cumulativeAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5 text-slate-500 dark:text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
          <span>Buchungen:</span>
          <span>
            {point.txCount} {point.txCount === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SpendingTrendChart({
  transactions,
  categories,
  selectedCategory,
  monthlyLimit,
  onOpenNewModal,
}: SpendingTrendChartProps) {
  const [trendMode, setTrendMode] = useState<TrendMode>('daily');

  const { points, total30Days, averagePerDay, maxDailyAmount } = useMemo(() => {
    const filteredTx =
      selectedCategory === 'all'
        ? transactions
        : transactions.filter((tx) => tx.categoryId === selectedCategory);

    const byDate = new Map<string, { amount: number; count: number }>();
    for (const tx of filteredTx) {
      const current = byDate.get(tx.date) ?? { amount: 0, count: 0 };
      byDate.set(tx.date, {
        amount: Math.round((current.amount + tx.amount) * 100) / 100,
        count: current.count + 1,
      });
    }

    const shortFormatter = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
    const fullFormatter = new Intl.DateTimeFormat('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const series: DailyPoint[] = [];
    let runningTotal = 0;
    let peakDay = 0;

    for (let offset = 29; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;

      const entry = byDate.get(isoDate) ?? { amount: 0, count: 0 };
      runningTotal = Math.round((runningTotal + entry.amount) * 100) / 100;
      if (entry.amount > peakDay) {
        peakDay = entry.amount;
      }

      series.push({
        date: isoDate,
        axisLabel: shortFormatter.format(d),
        fullDateLabel: fullFormatter.format(d),
        dailyAmount: entry.amount,
        cumulativeAmount: runningTotal,
        txCount: entry.count,
      });
    }

    return {
      points: series,
      total30Days: runningTotal,
      averagePerDay: Math.round((runningTotal / 30) * 100) / 100,
      maxDailyAmount: peakDay,
    };
  }, [transactions, selectedCategory]);

  const activeCategoryLabel =
    selectedCategory === 'all'
      ? 'Alle Kategorien'
      : getCategoryName(categories, selectedCategory);

  const lineStroke =
    selectedCategory === 'all'
      ? '#059669'
      : categories.find((c) => c.id === selectedCategory)?.accentHex ?? '#059669';

  return (
    <section
      aria-label="Ausgabenverlauf der letzten 30 Tage"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            30-Tage-Verlauf
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span>{activeCategoryLabel}</span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular">
              Summe: {formatEuro(total30Days)}
            </span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular">
              Ø {formatEuro(averagePerDay, true)}/Tag
            </span>
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Verlaufsansicht wählen"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={trendMode === 'daily'}
            onClick={() => setTrendMode('daily')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              trendMode === 'daily'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Täglich
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={trendMode === 'cumulative'}
            onClick={() => setTrendMode('cumulative')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              trendMode === 'cumulative'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Kumuliert
          </button>
        </div>
      </div>

      {total30Days === 0 ? (
        <div className="py-12 text-center flex-1 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            Keine Ausgaben in den letzten 30 Tagen
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Erfasse eine Ausgabe, um den täglichen und kumulierten Ausgabenverlauf sichtbar zu machen.
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
      ) : (
        <div className="pt-6 min-h-[300px] flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
              />
              <XAxis
                dataKey="axisLabel"
                tickLine={false}
                axisLine={false}
                interval={4}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-slate-500 dark:text-slate-400 font-mono-tabular"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val} €`}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-slate-500 dark:text-slate-400 font-mono-tabular"
                width={58}
              />
              <Tooltip
                content={<CustomTrendTooltip mode={trendMode} />}
                cursor={{ stroke: 'rgba(148, 163, 184, 0.45)', strokeWidth: 1 }}
              />
              {trendMode === 'daily' && averagePerDay > 0 && (
                <ReferenceLine
                  y={averagePerDay}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Ø ${formatEuro(averagePerDay, true)}`,
                    position: 'insideTopRight',
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
              )}
              {trendMode === 'cumulative' && selectedCategory === 'all' && (
                <ReferenceLine
                  y={monthlyLimit}
                  stroke="#ef6c00"
                  strokeDasharray="4 4"
                  label={{
                    value: `Limit ${formatEuro(monthlyLimit)}`,
                    position: 'insideTopRight',
                    fill: '#ef6c00',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={
                  trendMode === 'daily' ? 'dailyAmount' : 'cumulativeAmount'
                }
                stroke={lineStroke}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: lineStroke, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: lineStroke, stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={350}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
