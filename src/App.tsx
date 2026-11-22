/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  CalendarCheck,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  Sun,
  TrendingDown,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { BudgetStatusCard } from './components/BudgetStatusCard';
import { BudgetThresholdToast } from './components/BudgetThresholdToast';
import { CategoryDistributionChart } from './components/CategoryDistributionChart';
import { CategoryOverview } from './components/CategoryOverview';
import { DebtFreeSection } from './components/DebtFreeSection';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RecurringTransactionsSection } from './components/RecurringTransactionsSection';
import { SavingsGoalModal } from './components/SavingsGoalModal';
import { SavingsGoalsSection } from './components/SavingsGoalsSection';
import { SpendingTrendChart } from './components/SpendingTrendChart';
import { TransactionFormModal } from './components/TransactionFormModal';
import { TransactionList } from './components/TransactionList';
import {
  DEFAULT_MONTHLY_LIMIT,
  INITIAL_CATEGORIES,
  formatEuro,
  getGoalMonthSaved,
  toIsoDate,
} from './data/initialBudget';
import { auth } from './lib/firebase';
import {
  createDebtInFirestore,
  createRecurringRuleAndSyncInFirestore,
  createSavingsGoalInFirestore,
  createTransactionInFirestore,
  deleteDebtInFirestore,
  deleteRecurringRuleInFirestore,
  deleteSavingsGoalInFirestore,
  deleteTransactionInFirestore,
  ensureUserWorkspaceInitialized,
  markTransactionAsRecurringInFirestore,
  recordDebtPaymentInFirestore,
  resetUserExpensesInFirestore,
  restoreDemoDataInFirestore,
  restoreUserTransactionsAndRulesInFirestore,
  seedSampleDebtsInFirestore,
  subscribeToUserWorkspace,
  syncDueRecurringRulesToFirestore,
  toggleRecurringRuleInFirestore,
  updateCategoryTargetInFirestore,
  updateDebtInFirestore,
  updateGoalContributionsInFirestore,
  updateUserDebtPreferences,
  updateUserMonthlyLimit,
  updateUserTheme,
} from './services/budgetFirestore';
import {
  ActiveView,
  Category,
  CategoryId,
  DebtItem,
  DebtPayoffStrategy,
  RecurringInterval,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from './types/budget';

const THEME_STORAGE_KEY = 'budgetplanner_theme_v1';

function getInitialDarkTheme(): boolean {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
  } catch {
    // ignore storage failure
  }
  return false;
}

function getUserInitials(user: User): string {
  const source = (user.displayName || user.email || 'K').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const [monthlyLimit, setMonthlyLimit] = useState<number>(DEFAULT_MONTHLY_LIMIT);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [debtStrategy, setDebtStrategy] =
    useState<DebtPayoffStrategy>('avalanche');
  const [debtExtraMonthly, setDebtExtraMonthly] = useState<number>(100);
  const [autoAddedNotice, setAutoAddedNotice] = useState<number>(0);

  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>(
    'all',
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [monthEndNoticeDismissed, setMonthEndNoticeDismissed] = useState(false);
  const [resetBackup, setResetBackup] = useState<{
    transactions: Transaction[];
    rules: RecurringRule[];
  } | null>(null);

  const [isDark, setIsDark] = useState<boolean>(getInitialDarkTheme);

  const limitDebounceRef = useRef<number | null>(null);
  const debtExtraDebounceRef = useRef<number | null>(null);
  const categoryDebounceRef = useRef<Partial<Record<CategoryId, number>>>({});
  const hasSyncedRecurringRef = useRef<boolean>(false);
  const loadedSectionsRef = useRef<{
    settings: boolean;
    categories: boolean;
    transactions: boolean;
    rules: boolean;
    goals: boolean;
    debts: boolean;
  }>({
    settings: false,
    categories: false,
    transactions: false,
    rules: false,
    goals: false,
    debts: false,
  });

  if (fatalError) {
    throw fatalError;
  }

  const reportAsyncError = useCallback((err: unknown) => {
    setFatalError(err instanceof Error ? err : new Error(String(err)));
  }, []);

  const applyTheme = useCallback((nextDark: boolean, persistLocal: boolean) => {
    const root = document.documentElement;
    if (nextDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', nextDark ? '#020617' : '#f8fafc');
    }
    if (persistLocal) {
      try {
        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          nextDark ? 'dark' : 'light',
        );
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    applyTheme(isDark, false);
  }, [isDark, applyTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        const nextDark = event.newValue === 'dark';
        setIsDark(nextDark);
        applyTheme(nextDark, false);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyTheme]);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAvatarLoadError(false);

      if (!nextUser) {
        setWorkspaceLoading(false);
        setResetBackup(null);
        setAutoAddedNotice(0);
        setSelectedCategory('all');
        setActiveView('overview');
        hasSyncedRecurringRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize user workspace in Firestore and subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let unsubscribeWorkspace: (() => void) | null = null;

    hasSyncedRecurringRef.current = false;
    loadedSectionsRef.current = {
      settings: false,
      categories: false,
      transactions: false,
      rules: false,
      goals: false,
      debts: false,
    };
    setWorkspaceLoading(true);

    const checkAllLoaded = () => {
      const s = loadedSectionsRef.current;
      if (
        s.settings &&
        s.categories &&
        s.transactions &&
        s.rules &&
        s.goals &&
        s.debts
      ) {
        setWorkspaceLoading(false);
      }
    };

    const startWorkspace = async () => {
      try {
        await ensureUserWorkspaceInitialized(
          user,
          getInitialDarkTheme() ? 'dark' : 'light',
        );
        if (cancelled) return;

        unsubscribeWorkspace = subscribeToUserWorkspace(user.uid, {
          onSettings: (settings) => {
            if (cancelled) return;
            setMonthlyLimit(settings.monthlyLimit);
            setDebtStrategy(settings.debtStrategy);
            setDebtExtraMonthly(settings.debtExtraMonthly);
            const cloudDark = settings.theme === 'dark';
            setIsDark(cloudDark);
            applyTheme(cloudDark, true);
            loadedSectionsRef.current.settings = true;
            checkAllLoaded();
          },
          onCategories: (nextCategories) => {
            if (cancelled) return;
            setCategories(nextCategories);
            loadedSectionsRef.current.categories = true;
            checkAllLoaded();
          },
          onTransactions: (nextTransactions) => {
            if (cancelled) return;
            setTransactions(nextTransactions);
            loadedSectionsRef.current.transactions = true;
            checkAllLoaded();
          },
          onRecurringRules: (nextRules) => {
            if (cancelled) return;
            setRecurringRules(nextRules);
            loadedSectionsRef.current.rules = true;
            checkAllLoaded();
          },
          onSavingsGoals: (nextGoals) => {
            if (cancelled) return;
            setSavingsGoals(nextGoals);
            loadedSectionsRef.current.goals = true;
            checkAllLoaded();
          },
          onDebts: (nextDebts) => {
            if (cancelled) return;
            setDebts(nextDebts);
            loadedSectionsRef.current.debts = true;
            checkAllLoaded();
          },
          onError: (err) => {
            if (!cancelled) reportAsyncError(err);
          },
        });
      } catch (err) {
        if (!cancelled) reportAsyncError(err);
      }
    };

    void startWorkspace();

    return () => {
      cancelled = true;
      if (unsubscribeWorkspace) {
        unsubscribeWorkspace();
      }
      if (limitDebounceRef.current !== null) {
        window.clearTimeout(limitDebounceRef.current);
        limitDebounceRef.current = null;
      }
      if (debtExtraDebounceRef.current !== null) {
        window.clearTimeout(debtExtraDebounceRef.current);
        debtExtraDebounceRef.current = null;
      }
      const catTimers = categoryDebounceRef.current;
      (Object.keys(catTimers) as CategoryId[]).forEach((key) => {
        const timerId = catTimers[key];
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
          delete catTimers[key];
        }
      });
    };
  }, [user, applyTheme, reportAsyncError]);

  // Run automatic recurring-transaction sync once initial snapshots have loaded for the signed-in user
  useEffect(() => {
    if (!user || workspaceLoading || hasSyncedRecurringRef.current) return;
    hasSyncedRecurringRef.current = true;

    if (recurringRules.length === 0) return;

    void syncDueRecurringRulesToFirestore(user.uid, recurringRules, transactions)
      .then((addedCount) => {
        if (addedCount > 0) {
          setAutoAddedNotice(addedCount);
        }
      })
      .catch(reportAsyncError);
  }, [user, workspaceLoading, recurringRules, transactions, reportAsyncError]);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    applyTheme(nextDark, true);
    if (user) {
      void updateUserTheme(user.uid, nextDark ? 'dark' : 'light').catch(
        reportAsyncError,
      );
    }
  };

  const handleSignOut = () => {
    void signOut(auth).catch(reportAsyncError);
  };

  const handleLimitChange = (nextLimit: number) => {
    setMonthlyLimit(nextLimit);
    if (!user) return;
    if (limitDebounceRef.current !== null) {
      window.clearTimeout(limitDebounceRef.current);
    }
    limitDebounceRef.current = window.setTimeout(() => {
      limitDebounceRef.current = null;
      void updateUserMonthlyLimit(user.uid, nextLimit).catch(reportAsyncError);
    }, 250);
  };

  const spentAmount = useMemo(
    () =>
      Math.round(
        transactions.reduce((sum, tx) => sum + tx.amount, 0) * 100,
      ) / 100,
    [transactions],
  );

  const currentMonthKey = useMemo(() => toIsoDate(new Date()).slice(0, 7), []);

  const reservedThisMonth = useMemo(
    () =>
      Math.round(
        savingsGoals.reduce(
          (sum, g) => sum + getGoalMonthSaved(g, currentMonthKey),
          0,
        ) * 100,
      ) / 100,
    [savingsGoals, currentMonthKey],
  );

  const totalCommitted = useMemo(
    () => Math.round((spentAmount + reservedThisMonth) * 100) / 100,
    [spentAmount, reservedThisMonth],
  );

  const thresholdLevel: 'none' | 'warning90' | 'exceeded' = useMemo(() => {
    if (monthlyLimit <= 0) return 'none';
    const ratio = totalCommitted / monthlyLimit;
    if (totalCommitted > monthlyLimit) return 'exceeded';
    if (ratio >= 0.9) return 'warning90';
    return 'none';
  }, [totalCommitted, monthlyLimit]);

  const [dismissedThreshold, setDismissedThreshold] = useState<
    'none' | 'warning90' | 'exceeded'
  >('none');

  // Reset dismissal whenever usage drops below 90% or escalates from 90% warning to exceeded
  useEffect(() => {
    if (thresholdLevel === 'none') {
      setDismissedThreshold('none');
    } else if (
      thresholdLevel === 'exceeded' &&
      dismissedThreshold === 'warning90'
    ) {
      setDismissedThreshold('none');
    }
  }, [thresholdLevel, dismissedThreshold]);

  const isThresholdToastVisible =
    thresholdLevel !== 'none' && dismissedThreshold !== thresholdLevel;

  const currentMonthLabel = useMemo(() => {
    return new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const handleQuickAdd = (
    title: string,
    amount: number,
    categoryId: 'kaffee' | 'lebensmittel',
  ) => {
    if (!user) return;
    setResetBackup(null);
    void createTransactionInFirestore(user.uid, {
      title,
      amount,
      categoryId,
      date: toIsoDate(new Date()),
    }).catch(reportAsyncError);
  };

  const handleAddTransaction = (payload: {
    title: string;
    amount: number;
    categoryId: CategoryId;
    date: string;
    isRecurring: boolean;
    interval: RecurringInterval;
  }) => {
    if (!user) return;
    setResetBackup(null);

    if (payload.isRecurring) {
      void createRecurringRuleAndSyncInFirestore(
        user.uid,
        {
          title: payload.title,
          amount: payload.amount,
          categoryId: payload.categoryId,
          startDate: payload.date,
          interval: payload.interval,
        },
        transactions,
      )
        .then((addedCount) => {
          if (addedCount > 0) {
            setAutoAddedNotice(addedCount);
          }
        })
        .catch(reportAsyncError);
      return;
    }

    void createTransactionInFirestore(user.uid, {
      title: payload.title,
      amount: payload.amount,
      categoryId: payload.categoryId,
      date: payload.date,
    }).catch(reportAsyncError);
  };

  const handleMarkAsRecurring = (tx: Transaction) => {
    if (!user || tx.recurringId) return;
    void markTransactionAsRecurringInFirestore(user.uid, tx, transactions).catch(
      reportAsyncError,
    );
  };

  const handleToggleRuleActive = (ruleId: string) => {
    if (!user) return;
    const targetRule = recurringRules.find((r) => r.id === ruleId);
    if (!targetRule) return;

    void toggleRecurringRuleInFirestore(user.uid, targetRule, transactions)
      .then((addedCount) => {
        if (addedCount > 0) {
          setAutoAddedNotice(addedCount);
        }
      })
      .catch(reportAsyncError);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!user) return;
    const linked = transactions.filter((tx) => tx.recurringId === ruleId);
    void deleteRecurringRuleInFirestore(user.uid, ruleId, linked).catch(
      reportAsyncError,
    );
  };

  const handleDeleteTransaction = (id: string) => {
    if (!user) return;
    void deleteTransactionInFirestore(user.uid, id).catch(reportAsyncError);
  };

  const handleResetExpenses = () => {
    if (!user) return;
    if (transactions.length > 0 || recurringRules.some((r) => r.active)) {
      setResetBackup({
        transactions,
        rules: recurringRules,
      });
    }
    setSelectedCategory('all');
    setAutoAddedNotice(0);
    void resetUserExpensesInFirestore(
      user.uid,
      transactions,
      recurringRules,
    ).catch(reportAsyncError);
  };

  const handleUndoReset = () => {
    if (!user || !resetBackup) return;
    const backup = resetBackup;
    setResetBackup(null);
    void restoreUserTransactionsAndRulesInFirestore(
      user.uid,
      backup.transactions,
      backup.rules,
    ).catch(reportAsyncError);
  };

  const handleRestoreDemo = () => {
    if (!user) return;
    setResetBackup(null);
    setAutoAddedNotice(0);
    setSelectedCategory('all');
    void restoreDemoDataInFirestore(
      user.uid,
      transactions,
      recurringRules,
      savingsGoals,
    ).catch(reportAsyncError);
  };

  const handleUpdateCategoryTarget = (
    categoryId: CategoryId,
    newTarget: number,
  ) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, targetBudget: newTarget } : cat,
      ),
    );
    if (!user) return;
    const existingTimer = categoryDebounceRef.current[categoryId];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    categoryDebounceRef.current[categoryId] = window.setTimeout(() => {
      delete categoryDebounceRef.current[categoryId];
      void updateCategoryTargetInFirestore(user.uid, categoryId, newTarget).catch(
        reportAsyncError,
      );
    }, 250);
  };

  const handleAddSavingsGoal = (payload: {
    title: string;
    categoryLabel: string;
    accentHex: string;
    targetAmount: number;
    initialSaved: number;
    monthlyTarget: number;
  }) => {
    if (!user) return;
    void createSavingsGoalInFirestore(user.uid, payload).catch(reportAsyncError);
  };

  const handleContributeToGoal = (goalId: string, amount: number) => {
    if (!user) return;
    const goal = savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const today = toIsoDate(new Date());
    const nextContributions = [
      ...goal.contributions,
      {
        id: `contrib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        amount,
        date: today,
        createdAt: Date.now(),
      },
    ];
    void updateGoalContributionsInFirestore(
      user.uid,
      goalId,
      nextContributions,
    ).catch(reportAsyncError);
  };

  const handleWithdrawMonthGoal = (goalId: string) => {
    if (!user) return;
    const goal = savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const nextContributions = goal.contributions.filter(
      (c) => !c.date.startsWith(currentMonthKey),
    );
    void updateGoalContributionsInFirestore(
      user.uid,
      goalId,
      nextContributions,
    ).catch(reportAsyncError);
  };

  const handleDeleteGoal = (goalId: string) => {
    if (!user) return;
    void deleteSavingsGoalInFirestore(user.uid, goalId).catch(reportAsyncError);
  };

  const handleDebtStrategyChange = (nextStrategy: DebtPayoffStrategy) => {
    setDebtStrategy(nextStrategy);
    if (!user) return;
    void updateUserDebtPreferences(user.uid, {
      debtStrategy: nextStrategy,
    }).catch(reportAsyncError);
  };

  const handleDebtExtraMonthlyChange = (nextExtra: number) => {
    setDebtExtraMonthly(nextExtra);
    if (!user) return;
    if (debtExtraDebounceRef.current !== null) {
      window.clearTimeout(debtExtraDebounceRef.current);
    }
    debtExtraDebounceRef.current = window.setTimeout(() => {
      debtExtraDebounceRef.current = null;
      void updateUserDebtPreferences(user.uid, {
        debtExtraMonthly: nextExtra,
      }).catch(reportAsyncError);
    }, 250);
  };

  const handleCreateDebt = (payload: {
    title: string;
    creditor: string;
    initialBalance: number;
    currentBalance: number;
    interestRate: number;
    minimumPayment: number;
    termMonths?: number;
    disbursedAt?: string;
    accentHex: string;
  }) => {
    if (!user) return;
    void createDebtInFirestore(user.uid, payload).catch(reportAsyncError);
  };

  const handleUpdateDebt = (
    debtId: string,
    payload: {
      title: string;
      creditor: string;
      initialBalance: number;
      currentBalance: number;
      interestRate: number;
      minimumPayment: number;
      termMonths?: number;
      disbursedAt?: string;
      accentHex: string;
    },
  ) => {
    if (!user) return;
    void updateDebtInFirestore(user.uid, debtId, payload).catch(reportAsyncError);
  };

  const handleRecordDebtPayment = (
    debt: DebtItem,
    amount: number,
    date: string,
    alsoBookAsExpense: boolean,
  ) => {
    if (!user) return;
    void recordDebtPaymentInFirestore(
      user.uid,
      debt,
      amount,
      date,
      alsoBookAsExpense,
    ).catch(reportAsyncError);
  };

  const handleDeleteDebt = (debtId: string) => {
    if (!user) return;
    void deleteDebtInFirestore(user.uid, debtId).catch(reportAsyncError);
  };

  const handleLoadSampleDebts = () => {
    if (!user) return;
    void seedSampleDebtsInFirestore(user.uid).catch(reportAsyncError);
  };

  const navItems: {
    id: ActiveView;
    label: string;
    mobileLabel: string;
    icon: typeof LayoutDashboard;
  }[] = [
    {
      id: 'overview',
      label: 'Übersicht',
      mobileLabel: 'Übersicht',
      icon: LayoutDashboard,
    },
    {
      id: 'categories',
      label: 'Kategorien',
      mobileLabel: 'Kategorien',
      icon: LayoutGrid,
    },
    {
      id: 'savings',
      label: 'Sparziele',
      mobileLabel: 'Sparziele',
      icon: PiggyBank,
    },
    {
      id: 'transactions',
      label: 'Transaktionen',
      mobileLabel: 'Buchungen',
      icon: ReceiptText,
    },
    {
      id: 'debtfree',
      label: 'Schuldenplan',
      mobileLabel: 'Schulden',
      icon: TrendingDown,
    },
  ];

  const totalCategoryTargets = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.targetBudget, 0),
    [categories],
  );

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-emerald-700 dark:border-t-emerald-400 animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">Anmeldestatus wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGateScreen isDark={isDark} onToggleTheme={handleToggleTheme} />
    );
  }

  if (workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-emerald-700 dark:border-t-emerald-400 animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">
            Persönliches Budget wird geladen...
          </p>
        </div>
      </div>
    );
  }

  const accountLabel = user.displayName || user.email || 'Konto';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Nav Links — Zone 3 Primary CTA */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer font-display"
          >
            BudgetPlanner
          </button>

          <nav
            aria-label="Hauptnavigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-emerald-700 dark:border-emerald-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Neue Ausgabe</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentMonthLabel}
              <span className="mx-2 text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              Monatsplanung
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mt-1 text-balance">
              Mein BudgetPlanner
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
            <div
              className="flex items-center gap-2.5 pr-1 text-sm text-slate-700 dark:text-slate-300"
              title={user.email || accountLabel}
            >
              {user.photoURL && !avatarLoadError ? (
                <img
                  src={user.photoURL}
                  alt={accountLabel}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarLoadError(true)}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-emerald-700 dark:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center shrink-0"
                >
                  {getUserInitials(user)}
                </div>
              )}
              <span className="font-medium max-w-[150px] truncate">
                {accountLabel}
              </span>
            </div>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setIsSummaryModalOpen(true)}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Monatsrückblick</span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
              aria-pressed={isDark}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Hell</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Dunkel</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Vom Konto abmelden"
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>

        {/* Month-End Summary Inline Prompt (last 5 days of month) */}
        {!monthEndNoticeDismissed &&
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() -
            new Date().getDate() <=
            5 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Monatsende naht — prüfe jetzt deinen Rückblick für {currentMonthLabel}.
              </p>
              <div className="flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(true)}
                  className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Rückblick öffnen
                </button>
                <button
                  type="button"
                  onClick={() => setMonthEndNoticeDismissed(true)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  Ausblenden
                </button>
              </div>
            </div>
          )}

        {/* Auto-added Recurring Notice */}
        {autoAddedNotice > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60"
          >
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {autoAddedNotice}{' '}
              {autoAddedNotice === 1
                ? 'fällige wiederkehrende Buchung wurde automatisch hinzugefügt.'
                : 'fällige wiederkehrende Buchungen wurden automatisch hinzugefügt.'}
            </p>
            <button
              type="button"
              onClick={() => setAutoAddedNotice(0)}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Schließen
            </button>
          </div>
        )}

        {/* Undo Reset Banner */}
        {resetBackup && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Alle {resetBackup.transactions.length} Ausgaben wurden auf 0 € zurückgesetzt.
            </p>
            <button
              type="button"
              onClick={handleUndoReset}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" aria-hidden="true" />
              <span>Rückgängig machen</span>
            </button>
          </div>
        )}

        {/* Primary Budget Control Card */}
        {activeView !== 'debtfree' && (
          <BudgetStatusCard
            monthlyLimit={monthlyLimit}
            spentAmount={spentAmount}
            reservedThisMonth={reservedThisMonth}
            onLimitChange={handleLimitChange}
            onQuickAdd={handleQuickAdd}
            onResetExpenses={handleResetExpenses}
            onRestoreDemo={handleRestoreDemo}
            transactionCount={transactions.length}
          />
        )}

        {/* Dynamic Workspace Content */}
        {activeView === 'overview' && (
          <div className="space-y-6">
            {/* Row 2: Side-by-side Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-5">
                <CategoryDistributionChart
                  categories={categories}
                  transactions={transactions}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenNewModal={() => setIsModalOpen(true)}
                />
              </div>

              <div className="lg:col-span-7">
                <SpendingTrendChart
                  transactions={transactions}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  monthlyLimit={monthlyLimit}
                  onOpenNewModal={() => setIsModalOpen(true)}
                />
              </div>
            </div>

            {/* Row 3: Compact Savings Goals + Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5">
                <SavingsGoalsSection
                  goals={savingsGoals}
                  onContribute={handleContributeToGoal}
                  onWithdrawMonth={handleWithdrawMonthGoal}
                  onDeleteGoal={handleDeleteGoal}
                  onOpenNewGoalModal={() => setIsGoalModalOpen(true)}
                  compact
                  onViewAll={() => setActiveView('savings')}
                />
              </div>

              <div className="lg:col-span-7">
                <TransactionList
                  transactions={transactions}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onDeleteTransaction={handleDeleteTransaction}
                  onMarkAsRecurring={handleMarkAsRecurring}
                  onOpenNewModal={() => setIsModalOpen(true)}
                  maxItems={5}
                  onViewAll={() => setActiveView('transactions')}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'categories' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400 px-1">
              <span>
                Summe aller Kategorie-Richtwerte:{' '}
                <strong className="font-mono-tabular text-slate-900 dark:text-slate-100">
                  {formatEuro(totalCategoryTargets)}
                </strong>
              </span>
              <span className="font-mono-tabular">
                Monatsbudget: {formatEuro(monthlyLimit)}
              </span>
            </div>
            <CategoryOverview
              categories={categories}
              transactions={transactions}
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                if (cat !== 'all') setActiveView('transactions');
              }}
              onUpdateCategoryTarget={handleUpdateCategoryTarget}
              editable
            />
          </div>
        )}

        {activeView === 'savings' && (
          <SavingsGoalsSection
            goals={savingsGoals}
            onContribute={handleContributeToGoal}
            onWithdrawMonth={handleWithdrawMonthGoal}
            onDeleteGoal={handleDeleteGoal}
            onOpenNewGoalModal={() => setIsGoalModalOpen(true)}
          />
        )}

        {activeView === 'transactions' && (
          <div className="space-y-6">
            <RecurringTransactionsSection
              rules={recurringRules}
              categories={categories}
              onToggleRuleActive={handleToggleRuleActive}
              onDeleteRule={handleDeleteRule}
              onOpenNewModal={() => setIsModalOpen(true)}
            />

            <TransactionList
              transactions={transactions}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onDeleteTransaction={handleDeleteTransaction}
              onMarkAsRecurring={handleMarkAsRecurring}
              onOpenNewModal={() => setIsModalOpen(true)}
            />
          </div>
        )}

        {activeView === 'debtfree' && (
          <DebtFreeSection
            debts={debts}
            strategy={debtStrategy}
            extraMonthly={debtExtraMonthly}
            remainingMonthlyBudget={Math.max(
              0,
              Math.round((monthlyLimit - totalCommitted) * 100) / 100,
            )}
            onStrategyChange={handleDebtStrategyChange}
            onExtraMonthlyChange={handleDebtExtraMonthlyChange}
            onCreateDebt={handleCreateDebt}
            onUpdateDebt={handleUpdateDebt}
            onRecordPayment={handleRecordDebtPayment}
            onDeleteDebt={handleDeleteDebt}
            onLoadSampleDebts={handleLoadSampleDebts}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>BudgetPlanner — Account-synchronisiert über Firebase</span>
          <button
            type="button"
            onClick={handleRestoreDemo}
            className="hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
          >
            Standard-Beispieldaten wiederherstellen
          </button>
        </div>
      </footer>

      <TransactionFormModal
        isOpen={isModalOpen}
        categories={categories}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTransaction}
      />

      <SavingsGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSubmit={handleAddSavingsGoal}
      />

      <MonthlySummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        monthlyLimit={monthlyLimit}
        transactions={transactions}
        categories={categories}
        savingsGoals={savingsGoals}
        reservedThisMonth={reservedThisMonth}
        onTransferRemainderToGoal={handleContributeToGoal}
      />

      <BudgetThresholdToast
        visible={isThresholdToastVisible}
        monthlyLimit={monthlyLimit}
        totalCommitted={totalCommitted}
        onDismiss={() => setDismissedThreshold(thresholdLevel)}
      />

      <OfflineBanner />

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-3 right-3 h-0.5 rounded-b-full bg-emerald-700 dark:bg-emerald-400"
                  />
                )}
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
