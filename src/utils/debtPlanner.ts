import { DebtItem, DebtPayoffStrategy } from '../types/budget';

export const DEBT_COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: 'Smaragd', hex: '#0F766E' },
  { label: 'Ozeanblau', hex: '#0369A1' },
  { label: 'Bernstein', hex: '#B45309' },
  { label: 'Violett', hex: '#6D28D9' },
  { label: 'Schiefer', hex: '#475569' },
  { label: 'Karmesin', hex: '#B91C1C' },
];

function isoMonthsAgo(monthsAgo: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function createSampleDebts(): DebtItem[] {
  const now = Date.now();
  const suffix = now.toString(36);
  return [
    {
      id: `debt-sample-karte-${suffix}`,
      title: 'Kreditkarte Teilzahlung',
      creditor: 'Direktbank',
      initialBalance: 1800,
      currentBalance: 1450,
      interestRate: 14.9,
      minimumPayment: 55,
      accentHex: '#B91C1C',
      payments: [],
      createdAt: now - 300000,
    },
    {
      id: `debt-sample-technik-${suffix}`,
      title: 'Laptop-Finanzierung',
      creditor: 'Elektronik-Partner',
      initialBalance: 960,
      currentBalance: 540,
      interestRate: 0,
      minimumPayment: 45,
      termMonths: 24,
      disbursedAt: isoMonthsAgo(9),
      accentHex: '#0369A1',
      payments: [],
      createdAt: now - 200000,
    },
    {
      id: `debt-sample-auto-${suffix}`,
      title: 'Autokredit Restbetrag',
      creditor: 'Hausbank',
      initialBalance: 6500,
      currentBalance: 4200,
      interestRate: 5.2,
      minimumPayment: 140,
      termMonths: 48,
      disbursedAt: isoMonthsAgo(18),
      accentHex: '#0F766E',
      payments: [],
      createdAt: now - 100000,
    },
  ];
}

export function calculateMonthlyAnnuityPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    !Number.isFinite(termMonths) ||
    termMonths < 1
  ) {
    return 0;
  }
  const months = Math.round(termMonths);
  const monthlyRate = Math.max(0, annualRatePercent) / 100 / 12;
  if (monthlyRate === 0) {
    return Math.round((principal / months) * 100) / 100;
  }
  const factor = Math.pow(1 + monthlyRate, months);
  const payment = (principal * (monthlyRate * factor)) / (factor - 1);
  return Math.round(payment * 100) / 100;
}

export function formatTermLabel(termMonths: number): string {
  const months = Math.round(termMonths);
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return `${months} Mon. (${years} ${years === 1 ? 'Jahr' : 'Jahre'})`;
  }
  return `${months} Mon.`;
}

export function formatGermanDateShort(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function getContractTermInfo(
  disbursedAt: string,
  termMonths: number,
): {
  endDateLabel: string;
  elapsedMonths: number;
  remainingContractMonths: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(disbursedAt);
  if (!match || !Number.isFinite(termMonths) || termMonths < 1) return null;

  const startYear = Number(match[1]);
  const startMonthIndex = Number(match[2]) - 1;
  const startDay = Number(match[3]);

  const endDate = new Date(startYear, startMonthIndex + Math.round(termMonths), 1);
  const endDateLabel = new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: 'numeric',
  }).format(endDate);

  const now = new Date();
  let elapsedMonths =
    (now.getFullYear() - startYear) * 12 + (now.getMonth() - startMonthIndex);
  if (now.getDate() < startDay) {
    elapsedMonths -= 1;
  }
  elapsedMonths = Math.max(0, elapsedMonths);
  const remainingContractMonths = Math.max(
    0,
    Math.round(termMonths) - elapsedMonths,
  );

  return {
    endDateLabel,
    elapsedMonths,
    remainingContractMonths,
  };
}

export interface DebtSchedulePoint {
  monthIndex: number;
  label: string;
  remainingTotal: number;
  baselineRemaining: number | null;
  cumulativeInterest: number;
}

export interface DebtPayoffDetail {
  debtId: string;
  monthsToPayoff: number | null;
  payoffDateLabel: string;
  interestPaid: number;
}

export interface DebtSimulationResult {
  monthsToFreedom: number;
  debtFreeDateLabel: string;
  totalInterestPaid: number;
  stalled: boolean;
  schedule: {
    monthIndex: number;
    label: string;
    remainingTotal: number;
    cumulativeInterest: number;
  }[];
  payoffByDebt: Record<string, DebtPayoffDetail>;
}

function addMonthsLabel(monthsFromNow: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsFromNow);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function addMonthsShortLabel(monthsFromNow: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsFromNow);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(d);
}

export function getPriorityOrderedDebts(
  debts: DebtItem[],
  strategy: DebtPayoffStrategy,
): DebtItem[] {
  const active = debts.filter((d) => d.currentBalance > 0.005);
  const paidOff = debts.filter((d) => d.currentBalance <= 0.005);

  const sortedActive = [...active].sort((a, b) => {
    if (strategy === 'avalanche') {
      if (b.interestRate !== a.interestRate) {
        return b.interestRate - a.interestRate;
      }
      return a.currentBalance - b.currentBalance;
    }
    if (a.currentBalance !== b.currentBalance) {
      return a.currentBalance - b.currentBalance;
    }
    return b.interestRate - a.interestRate;
  });

  const sortedPaidOff = [...paidOff].sort((a, b) => b.createdAt - a.createdAt);
  return [...sortedActive, ...sortedPaidOff];
}

export function simulateDebtPayoff(
  debts: DebtItem[],
  strategy: DebtPayoffStrategy,
  extraMonthly: number,
  options?: { cascadeFreedMinimums?: boolean },
): DebtSimulationResult {
  const cascadeFreedMinimums = options?.cascadeFreedMinimums ?? true;
  const activeDebts = debts.filter((d) => d.currentBalance > 0.005);

  if (activeDebts.length === 0) {
    return {
      monthsToFreedom: 0,
      debtFreeDateLabel: 'Bereits schuldenfrei',
      totalInterestPaid: 0,
      stalled: false,
      schedule: [
        {
          monthIndex: 0,
          label: addMonthsShortLabel(0),
          remainingTotal: 0,
          cumulativeInterest: 0,
        },
      ],
      payoffByDebt: {},
    };
  }

  const ordered = getPriorityOrderedDebts(activeDebts, strategy).map((d) => ({
    id: d.id,
    balance: d.currentBalance,
    rateMonthly: Math.max(0, d.interestRate) / 100 / 12,
    minimumPayment: Math.max(0, d.minimumPayment),
    interestPaid: 0,
    paidOffMonth: null as number | null,
  }));

  const initialTotalRemaining = ordered.reduce((sum, d) => sum + d.balance, 0);
  const effectiveExtra = cascadeFreedMinimums ? Math.max(0, extraMonthly) : 0;
  const totalMonthlyBudget =
    ordered.reduce((sum, d) => sum + d.minimumPayment, 0) + effectiveExtra;

  const schedule: DebtSimulationResult['schedule'] = [
    {
      monthIndex: 0,
      label: addMonthsShortLabel(0),
      remainingTotal: Math.round(initialTotalRemaining * 100) / 100,
      cumulativeInterest: 0,
    },
  ];

  const MAX_MONTHS = 360;
  let cumulativeInterest = 0;
  let month = 0;
  let stalled = false;

  if (totalMonthlyBudget <= 0) {
    stalled = true;
  }

  // Without rollover, every active debt must cover its own monthly interest
  if (!cascadeFreedMinimums) {
    for (const item of ordered) {
      const firstMonthInterest = item.balance * item.rateMonthly;
      if (item.minimumPayment <= firstMonthInterest + 0.001) {
        stalled = true;
        break;
      }
    }
  }

  while (!stalled && month < MAX_MONTHS) {
    const remainingBefore = ordered.reduce((sum, d) => sum + d.balance, 0);
    if (remainingBefore <= 0.01) break;

    month += 1;

    // 1. Accrue monthly interest
    let interestThisMonth = 0;
    for (const item of ordered) {
      if (item.balance <= 0.005) continue;
      const interest = item.balance * item.rateMonthly;
      item.balance += interest;
      item.interestPaid += interest;
      interestThisMonth += interest;
    }
    cumulativeInterest += interestThisMonth;

    if (cascadeFreedMinimums) {
      // If total monthly budget does not reduce principal, plan cannot converge
      if (totalMonthlyBudget <= interestThisMonth + 0.005 && month === 1) {
        stalled = true;
        break;
      }

      // 2. Pay minimums on all active debts first, keeping freed-up minimums in the extra pool
      let poolRemaining = totalMonthlyBudget;
      for (const item of ordered) {
        if (item.balance <= 0.005) continue;
        const minPay = Math.min(item.balance, item.minimumPayment, poolRemaining);
        item.balance -= minPay;
        poolRemaining -= minPay;
        if (item.balance <= 0.01) {
          item.balance = 0;
          if (item.paidOffMonth === null) {
            item.paidOffMonth = month;
          }
        }
      }

      // 3. Apply remaining pool (extraMonthly + cascaded minimums from paid-off debts) by priority
      for (const item of ordered) {
        if (poolRemaining <= 0.005) break;
        if (item.balance <= 0.005) continue;
        const extraPay = Math.min(item.balance, poolRemaining);
        item.balance -= extraPay;
        poolRemaining -= extraPay;
        if (item.balance <= 0.01) {
          item.balance = 0;
          if (item.paidOffMonth === null) {
            item.paidOffMonth = month;
          }
        }
      }
    } else {
      // Strict minimum payments only: each debt receives at most its own minimumPayment
      for (const item of ordered) {
        if (item.balance <= 0.005) continue;
        const minPay = Math.min(item.balance, item.minimumPayment);
        item.balance -= minPay;
        if (item.balance <= 0.01) {
          item.balance = 0;
          if (item.paidOffMonth === null) {
            item.paidOffMonth = month;
          }
        }
      }
    }

    const remainingAfter = ordered.reduce((sum, d) => sum + d.balance, 0);
    if (remainingAfter >= remainingBefore - 0.001 && remainingAfter > 0.05) {
      stalled = true;
      break;
    }

    schedule.push({
      monthIndex: month,
      label: addMonthsShortLabel(month),
      remainingTotal: Math.round(remainingAfter * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
    });

    if (remainingAfter <= 0.01) break;
  }

  const finalRemaining = ordered.reduce((sum, d) => sum + d.balance, 0);
  if (finalRemaining > 0.05) {
    stalled = true;
  }

  const payoffByDebt: Record<string, DebtPayoffDetail> = {};
  for (const item of ordered) {
    payoffByDebt[item.id] = {
      debtId: item.id,
      monthsToPayoff: item.paidOffMonth,
      payoffDateLabel:
        item.paidOffMonth !== null
          ? addMonthsLabel(item.paidOffMonth)
          : 'Nicht innerhalb 30 J.',
      interestPaid: Math.round(item.interestPaid * 100) / 100,
    };
  }

  return {
    monthsToFreedom: stalled ? MAX_MONTHS : month,
    debtFreeDateLabel: stalled
      ? 'Rate erhöhen nötig'
      : addMonthsLabel(month),
    totalInterestPaid: Math.round(cumulativeInterest * 100) / 100,
    stalled,
    schedule,
    payoffByDebt,
  };
}

export function mergeScheduleForChart(
  planned: DebtSimulationResult,
  baseline: DebtSimulationResult,
): DebtSchedulePoint[] {
  const fullLen = baseline.stalled
    ? planned.schedule.length
    : Math.max(planned.schedule.length, baseline.schedule.length);

  if (fullLen === 0) return [];

  const maxChartPoints = 72;
  const step = fullLen <= maxChartPoints ? 1 : Math.ceil((fullLen - 1) / (maxChartPoints - 1));

  const indices: number[] = [];
  for (let i = 0; i < fullLen; i += step) {
    indices.push(i);
  }
  if (indices[indices.length - 1] !== fullLen - 1) {
    indices.push(fullLen - 1);
  }

  return indices.map((i) => {
    const p = planned.schedule[i];
    const b = baseline.schedule[i];
    const label = p?.label ?? b?.label ?? addMonthsShortLabel(i);

    const remainingTotal = planned.stalled
      ? (p ? p.remainingTotal : planned.schedule[planned.schedule.length - 1]?.remainingTotal ?? 0)
      : (p ? p.remainingTotal : 0);

    const baselineRemaining = baseline.stalled
      ? null
      : (b ? b.remainingTotal : 0);

    return {
      monthIndex: i,
      label,
      remainingTotal,
      baselineRemaining,
      cumulativeInterest: p ? p.cumulativeInterest : planned.totalInterestPaid,
    };
  });
}
