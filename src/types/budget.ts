export type CategoryId =
  | 'lebensmittel'
  | 'kaffee'
  | 'mobilitaet'
  | 'freizeit'
  | 'haushalt'
  | 'sonstiges';

export interface Category {
  id: CategoryId;
  name: string;
  targetBudget: number;
  accentHex: string;
}

export type RecurringInterval = 'monthly' | 'weekly';

export interface RecurringRule {
  id: string;
  title: string;
  amount: number;
  categoryId: CategoryId;
  interval: RecurringInterval;
  startDate: string; // ISO YYYY-MM-DD
  active: boolean;
  generatedPeriods: string[]; // 'YYYY-MM' for monthly, 'YYYY-MM-DD' for weekly
  createdAt: number;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  categoryId: CategoryId;
  date: string; // ISO YYYY-MM-DD
  createdAt: number;
  recurringId?: string;
  recurringInterval?: RecurringInterval;
}

export interface SavingsContribution {
  id: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  createdAt: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  categoryLabel: string;
  targetAmount: number;
  initialSaved: number; // amount saved prior to tracked monthly contributions
  monthlyTarget: number;
  accentHex: string;
  contributions: SavingsContribution[];
  createdAt: number;
}

export type DebtPayoffStrategy = 'avalanche' | 'snowball';

export interface DebtPayment {
  id: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  createdAt: number;
}

export interface DebtItem {
  id: string;
  title: string;
  creditor: string;
  initialBalance: number;
  currentBalance: number;
  interestRate: number; // annual % e.g. 14.9
  minimumPayment: number;
  termMonths?: number; // optional loan duration in months (1..600)
  disbursedAt?: string; // optional ISO YYYY-MM-DD payout date
  accentHex: string;
  payments: DebtPayment[];
  createdAt: number;
}

export type ActiveView =
  | 'overview'
  | 'categories'
  | 'savings'
  | 'transactions'
  | 'debtfree';

export type BudgetHealth = 'nominal' | 'warning' | 'critical';
