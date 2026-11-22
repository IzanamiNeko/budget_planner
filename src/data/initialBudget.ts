import {
  BudgetHealth,
  Category,
  CategoryId,
  RecurringInterval,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '../types/budget';

export const DEFAULT_MONTHLY_LIMIT = 1000;
export const MIN_MONTHLY_LIMIT = 200;
export const MAX_MONTHLY_LIMIT = 3000;
export const MONTHLY_LIMIT_STEP = 100;

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'lebensmittel',
    name: 'Lebensmittel',
    targetBudget: 350,
    accentHex: '#15803D',
  },
  {
    id: 'kaffee',
    name: 'Kaffee & Snacks',
    targetBudget: 120,
    accentHex: '#B45309',
  },
  {
    id: 'mobilitaet',
    name: 'Mobilität',
    targetBudget: 180,
    accentHex: '#0369A1',
  },
  {
    id: 'freizeit',
    name: 'Freizeit',
    targetBudget: 150,
    accentHex: '#6D28D9',
  },
  {
    id: 'haushalt',
    name: 'Haushalt',
    targetBudget: 120,
    accentHex: '#0F766E',
  },
  {
    id: 'sonstiges',
    name: 'Sonstiges',
    targetBudget: 80,
    accentHex: '#475569',
  },
];

export const SAVINGS_CATEGORY_PRESETS: { label: string; accentHex: string }[] = [
  { label: 'Urlaub', accentHex: '#0284C7' },
  { label: 'Notgroschen', accentHex: '#0F766E' },
  { label: 'Freizeit', accentHex: '#6D28D9' },
  { label: 'Mobilität', accentHex: '#0369A1' },
  { label: 'Haushalt', accentHex: '#15803D' },
  { label: 'Technik & Anschaffungen', accentHex: '#475569' },
];

export function createInitialSavingsGoals(): SavingsGoal[] {
  const now = Date.now();
  return [
    {
      id: 'goal-init-urlaub',
      title: 'Sommerurlaub',
      categoryLabel: 'Urlaub',
      targetAmount: 1200,
      initialSaved: 420,
      monthlyTarget: 150,
      accentHex: '#0284C7',
      contributions: [],
      createdAt: now - 864000000,
    },
    {
      id: 'goal-init-notgroschen',
      title: 'Notgroschen',
      categoryLabel: 'Notgroschen',
      targetAmount: 2000,
      initialSaved: 850,
      monthlyTarget: 100,
      accentHex: '#0F766E',
      contributions: [],
      createdAt: now - 1728000000,
    },
  ];
}

export function getGoalTotalSaved(goal: SavingsGoal): number {
  const contribSum = goal.contributions.reduce((sum, c) => sum + c.amount, 0);
  return Math.max(0, Math.round((goal.initialSaved + contribSum) * 100) / 100);
}

export function getGoalMonthSaved(goal: SavingsGoal, monthKey: string): number {
  const sum = goal.contributions
    .filter((c) => c.date.startsWith(monthKey))
    .reduce((acc, c) => acc + c.amount, 0);
  return Math.max(0, Math.round(sum * 100) / 100);
}

function formatIsoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toIsoDate(date);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialRecurringRules(): RecurringRule[] {
  const ticketDate = formatIsoDaysAgo(3);
  return [
    {
      id: 'rule-init-ticket',
      title: 'Deutschlandticket Monatsabo',
      amount: 49,
      categoryId: 'mobilitaet',
      interval: 'monthly',
      startDate: ticketDate,
      active: true,
      generatedPeriods: [ticketDate.slice(0, 7)],
      createdAt: Date.now() - 259200000,
    },
  ];
}

// Initial transactions sum to exactly 250 € to mirror the starter prototype state (250 € of 1.000 €)
export function createInitialTransactions(): Transaction[] {
  const now = Date.now();
  return [
    {
      id: 'tx-init-1',
      title: 'Wocheneinkauf Supermarkt',
      amount: 88,
      categoryId: 'lebensmittel',
      date: formatIsoDaysAgo(1),
      createdAt: now - 86400000,
    },
    {
      id: 'tx-init-2',
      title: 'Deutschlandticket Monatsabo',
      amount: 49,
      categoryId: 'mobilitaet',
      date: formatIsoDaysAgo(3),
      createdAt: now - 259200000,
      recurringId: 'rule-init-ticket',
      recurringInterval: 'monthly',
    },
    {
      id: 'tx-init-3',
      title: 'Kino & Getränke',
      amount: 34,
      categoryId: 'freizeit',
      date: formatIsoDaysAgo(4),
      createdAt: now - 345600000,
    },
    {
      id: 'tx-init-4',
      title: 'Drogerie & Haushaltswaren',
      amount: 42,
      categoryId: 'haushalt',
      date: formatIsoDaysAgo(5),
      createdAt: now - 432000000,
    },
    {
      id: 'tx-init-5',
      title: 'Bäckerei & Cappuccino',
      amount: 14,
      categoryId: 'kaffee',
      date: formatIsoDaysAgo(6),
      createdAt: now - 518400000,
    },
    {
      id: 'tx-init-6',
      title: 'Wochenmarkt Gemüse',
      amount: 23,
      categoryId: 'lebensmittel',
      date: formatIsoDaysAgo(7),
      createdAt: now - 604800000,
    },
  ];
}

export function getIntervalLabel(interval: RecurringInterval): string {
  return interval === 'monthly' ? 'Monatlich' : 'Wöchentlich';
}

export function getNextOccurrenceDate(rule: RecurringRule): string {
  const todayIso = toIsoDate(new Date());
  const start = new Date(`${rule.startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return todayIso;

  if (rule.interval === 'monthly') {
    const anchorDay = start.getDate();
    let year = start.getFullYear();
    let month = start.getMonth();

    for (let i = 0; i < 120; i++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const targetDay = Math.min(anchorDay, daysInMonth);
      const candidate = toIsoDate(new Date(year, month, targetDay));
      const periodKey = candidate.slice(0, 7);

      if (candidate > todayIso || (candidate >= todayIso && !rule.generatedPeriods.includes(periodKey))) {
        return candidate;
      }

      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return todayIso;
  }

  // Weekly
  const cursor = new Date(start);
  for (let i = 0; i < 520; i++) {
    const candidate = toIsoDate(cursor);
    if (candidate > todayIso || (candidate >= todayIso && !rule.generatedPeriods.includes(candidate))) {
      return candidate;
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return todayIso;
}

/**
 * Generates any due transactions for active recurring rules up to today's date
 * without duplicating periods that were already generated.
 */
export function syncRecurringTransactions(
  rules: RecurringRule[],
  existingTransactions: Transaction[],
): {
  updatedRules: RecurringRule[];
  updatedTransactions: Transaction[];
  addedCount: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toIsoDate(today);

  const newTransactions: Transaction[] = [];
  const updatedRules = rules.map((rule) => {
    if (!rule.active) return rule;

    const start = new Date(`${rule.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return rule;

    const generated = new Set(rule.generatedPeriods ?? []);

    if (rule.interval === 'monthly') {
      const anchorDay = start.getDate();
      let year = start.getFullYear();
      let month = start.getMonth();

      for (let guard = 0; guard < 60; guard++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const targetDay = Math.min(anchorDay, daysInMonth);
        const occIso = toIsoDate(new Date(year, month, targetDay));

        if (occIso > todayIso) break;

        const periodKey = occIso.slice(0, 7);
        const alreadyExistsInList = existingTransactions.some(
          (tx) => tx.recurringId === rule.id && tx.date.startsWith(periodKey),
        );

        if (!generated.has(periodKey) && !alreadyExistsInList) {
          newTransactions.push({
            id: `tx-rec-${rule.id}-${periodKey}-${Math.random().toString(36).slice(2, 6)}`,
            title: rule.title,
            amount: rule.amount,
            categoryId: rule.categoryId,
            date: occIso,
            createdAt: Date.now(),
            recurringId: rule.id,
            recurringInterval: rule.interval,
          });
        }
        generated.add(periodKey);

        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
    } else {
      const cursor = new Date(start);
      for (let guard = 0; guard < 104; guard++) {
        const occIso = toIsoDate(cursor);
        if (occIso > todayIso) break;

        const alreadyExistsInList = existingTransactions.some(
          (tx) => tx.recurringId === rule.id && tx.date === occIso,
        );

        if (!generated.has(occIso) && !alreadyExistsInList) {
          newTransactions.push({
            id: `tx-rec-${rule.id}-${occIso}-${Math.random().toString(36).slice(2, 6)}`,
            title: rule.title,
            amount: rule.amount,
            categoryId: rule.categoryId,
            date: occIso,
            createdAt: Date.now(),
            recurringId: rule.id,
            recurringInterval: rule.interval,
          });
        }
        generated.add(occIso);
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    return {
      ...rule,
      generatedPeriods: Array.from(generated),
    };
  });

  if (newTransactions.length === 0) {
    return {
      updatedRules,
      updatedTransactions: existingTransactions,
      addedCount: 0,
    };
  }

  return {
    updatedRules,
    updatedTransactions: [...newTransactions, ...existingTransactions],
    addedCount: newTransactions.length,
  };
}

export function getCategoryName(categories: Category[], categoryId: CategoryId): string {
  return categories.find((c) => c.id === categoryId)?.name ?? 'Sonstiges';
}

export function formatEuro(amount: number, showDecimals = false): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: showDecimals ? 2 : Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatGermanDate(isoDate: string): string {
  if (!isoDate) return '';
  const today = toIsoDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toIsoDate(yesterdayDate);

  if (isoDate === today) return 'Heute';
  if (isoDate === yesterday) return 'Gestern';

  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getBudgetHealth(progress: number, remaining: number): {
  status: BudgetHealth;
  label: string;
  barColorClass: string;
  textColorClass: string;
} {
  if (remaining < 0) {
    return {
      status: 'critical',
      label: 'Limit überschritten',
      barColorClass: 'bg-[#C62828] dark:bg-red-500',
      textColorClass: 'text-[#C62828] dark:text-red-400',
    };
  }
  if (progress < 0.7) {
    return {
      status: 'nominal',
      label: 'Im Plan',
      barColorClass: 'bg-[#2E7D32] dark:bg-emerald-500',
      textColorClass: 'text-[#2E7D32] dark:text-emerald-400',
    };
  }
  if (progress < 0.9) {
    return {
      status: 'warning',
      label: 'Fast erreicht',
      barColorClass: 'bg-[#EF6C00] dark:bg-amber-500',
      textColorClass: 'text-[#EF6C00] dark:text-amber-400',
    };
  }
  return {
    status: 'critical',
    label: 'Kritischer Bereich',
    barColorClass: 'bg-[#C62828] dark:bg-red-500',
    textColorClass: 'text-[#C62828] dark:text-red-400',
  };
}
