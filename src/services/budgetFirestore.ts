import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_MONTHLY_LIMIT,
  INITIAL_CATEGORIES,
  createInitialRecurringRules,
  createInitialSavingsGoals,
  createInitialTransactions,
  syncRecurringTransactions,
  toIsoDate,
} from '../data/initialBudget';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import {
  Category,
  CategoryId,
  DebtItem,
  DebtPayment,
  DebtPayoffStrategy,
  RecurringInterval,
  RecurringRule,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from '../types/budget';
import { createSampleDebts } from '../utils/debtPlanner';

const LOCAL_MIGRATION_KEYS = {
  limit: 'budgetplanner_limit_v1',
  transactions: 'budgetplanner_transactions_v1',
  categories: 'budgetplanner_categories_v1',
  recurring: 'budgetplanner_recurring_v1',
  goals: 'budgetplanner_goals_v1',
  theme: 'budgetplanner_theme_v1',
};

const VALID_CATEGORY_IDS = new Set<string>([
  'lebensmittel',
  'kaffee',
  'mobilitaet',
  'freizeit',
  'haushalt',
  'sonstiges',
]);

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${prefix}-${Date.now()}`;
}

function sanitizeTitle(raw: string, fallback = 'Buchung'): string {
  const trimmed = raw.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeCategoryId(raw: string): CategoryId {
  return VALID_CATEGORY_IDS.has(raw) ? (raw as CategoryId) : 'sonstiges';
}

function sanitizeHex(raw: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#475569';
}

function sanitizeIsoDate(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toIsoDate(new Date());
}

function readLocalJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export interface UserWorkspaceSettings {
  monthlyLimit: number;
  theme: 'light' | 'dark';
  displayName: string;
  debtStrategy: DebtPayoffStrategy;
  debtExtraMonthly: number;
}

export async function ensureUserWorkspaceInitialized(
  user: User,
  fallbackTheme: 'light' | 'dark',
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    return;
  }

  // First login for this account: migrate local browser data if available, otherwise seed starter defaults
  const localLimitRaw = readLocalJson<number>(LOCAL_MIGRATION_KEYS.limit);
  const initialLimit =
    typeof localLimitRaw === 'number' &&
    localLimitRaw >= 200 &&
    localLimitRaw <= 3000
      ? Math.round(localLimitRaw)
      : DEFAULT_MONTHLY_LIMIT;

  const localTheme = (() => {
    try {
      const t = window.localStorage.getItem(LOCAL_MIGRATION_KEYS.theme);
      return t === 'dark' || t === 'light' ? t : fallbackTheme;
    } catch {
      return fallbackTheme;
    }
  })();

  const categoriesToSeed =
    readLocalJson<Category[]>(LOCAL_MIGRATION_KEYS.categories) ??
    INITIAL_CATEGORIES;
  const transactionsToSeed =
    readLocalJson<Transaction[]>(LOCAL_MIGRATION_KEYS.transactions) ??
    createInitialTransactions();
  const rulesToSeed =
    readLocalJson<RecurringRule[]>(LOCAL_MIGRATION_KEYS.recurring) ??
    createInitialRecurringRules();
  const goalsToSeed =
    readLocalJson<SavingsGoal[]>(LOCAL_MIGRATION_KEYS.goals) ??
    createInitialSavingsGoals();

  const batch = writeBatch(db);

  batch.set(userRef, {
    uid: user.uid,
    displayName: sanitizeTitle(user.displayName || user.email || 'Nutzer', 'Nutzer'),
    monthlyLimit: initialLimit,
    theme: localTheme,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const cat of categoriesToSeed) {
    const catId = sanitizeCategoryId(cat.id);
    const catRef = doc(db, 'users', user.uid, 'categories', catId);
    batch.set(catRef, {
      id: catId,
      ownerId: user.uid,
      name: sanitizeTitle(cat.name, 'Kategorie').slice(0, 60),
      targetBudget: Math.min(100000, Math.max(0, Number(cat.targetBudget) || 0)),
      accentHex: sanitizeHex(cat.accentHex),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const tx of transactionsToSeed.slice(0, 200)) {
    const txId = sanitizeId(tx.id, 'tx');
    const txRef = doc(db, 'users', user.uid, 'transactions', txId);
    const amount = Math.min(1000000, Math.max(0.01, Number(tx.amount) || 1));
    const payload: Record<string, unknown> = {
      ownerId: user.uid,
      title: sanitizeTitle(tx.title),
      amount: Math.round(amount * 100) / 100,
      categoryId: sanitizeCategoryId(tx.categoryId),
      date: sanitizeIsoDate(tx.date),
      clientCreatedAt: Math.max(0, Number(tx.createdAt) || Date.now()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (tx.recurringId) {
      payload.recurringId = sanitizeId(tx.recurringId, 'rule');
      payload.recurringInterval =
        tx.recurringInterval === 'weekly' ? 'weekly' : 'monthly';
    }
    batch.set(txRef, payload);
  }

  for (const rule of rulesToSeed.slice(0, 50)) {
    const ruleId = sanitizeId(rule.id, 'rule');
    const ruleRef = doc(db, 'users', user.uid, 'recurringRules', ruleId);
    const amount = Math.min(1000000, Math.max(0.01, Number(rule.amount) || 1));
    batch.set(ruleRef, {
      ownerId: user.uid,
      title: sanitizeTitle(rule.title),
      amount: Math.round(amount * 100) / 100,
      categoryId: sanitizeCategoryId(rule.categoryId),
      interval: rule.interval === 'weekly' ? 'weekly' : 'monthly',
      startDate: sanitizeIsoDate(rule.startDate),
      active: Boolean(rule.active),
      generatedPeriods: (rule.generatedPeriods ?? [])
        .slice(0, 120)
        .map((p) => String(p).slice(0, 16)),
      clientCreatedAt: Math.max(0, Number(rule.createdAt) || Date.now()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const goal of goalsToSeed.slice(0, 30)) {
    const goalId = sanitizeId(goal.id, 'goal');
    const goalRef = doc(db, 'users', user.uid, 'savingsGoals', goalId);
    batch.set(goalRef, {
      ownerId: user.uid,
      title: sanitizeTitle(goal.title, 'Sparziel'),
      categoryLabel: sanitizeTitle(goal.categoryLabel, 'Sonstiges').slice(0, 60),
      targetAmount: Math.min(
        10000000,
        Math.max(1, Number(goal.targetAmount) || 100),
      ),
      initialSaved: Math.min(
        10000000,
        Math.max(0, Number(goal.initialSaved) || 0),
      ),
      monthlyTarget: Math.min(
        1000000,
        Math.max(0, Number(goal.monthlyTarget) || 0),
      ),
      accentHex: sanitizeHex(goal.accentHex),
      contributions: (goal.contributions ?? []).slice(0, 200).map((c) => ({
        id: sanitizeId(c.id, 'contrib'),
        amount: Math.min(1000000, Math.max(0.01, Number(c.amount) || 1)),
        date: sanitizeIsoDate(c.date),
        createdAt: Math.max(0, Number(c.createdAt) || Date.now()),
      })),
      clientCreatedAt: Math.max(0, Number(goal.createdAt) || Date.now()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeToUserWorkspace(
  userId: string,
  callbacks: {
    onSettings: (settings: UserWorkspaceSettings) => void;
    onCategories: (categories: Category[]) => void;
    onTransactions: (transactions: Transaction[]) => void;
    onRecurringRules: (rules: RecurringRule[]) => void;
    onSavingsGoals: (goals: SavingsGoal[]) => void;
    onDebts: (debts: DebtItem[]) => void;
    onError?: (error: Error) => void;
  },
): () => void {
  const reportListenerError = (
    error: unknown,
    operationType: OperationType,
    path: string,
  ) => {
    try {
      handleFirestoreError(error, operationType, path);
    } catch (wrapped) {
      if (callbacks.onError) {
        callbacks.onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped)),
        );
      } else {
        throw wrapped;
      }
    }
  };

  const userPath = `users/${userId}`;
  const unsubUser = onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      callbacks.onSettings({
        monthlyLimit:
          typeof data.monthlyLimit === 'number'
            ? data.monthlyLimit
            : DEFAULT_MONTHLY_LIMIT,
        theme: data.theme === 'dark' ? 'dark' : 'light',
        displayName:
          typeof data.displayName === 'string' ? data.displayName : 'Konto',
        debtStrategy:
          data.debtStrategy === 'snowball' ? 'snowball' : 'avalanche',
        debtExtraMonthly:
          typeof data.debtExtraMonthly === 'number' &&
          data.debtExtraMonthly >= 0
            ? data.debtExtraMonthly
            : 100,
      });
    },
    (error) => reportListenerError(error, OperationType.GET, userPath),
  );

  const catPath = `users/${userId}/categories`;
  const unsubCategories = onSnapshot(
    query(collection(db, 'users', userId, 'categories'), where('ownerId', '==', userId)),
    (snapshot) => {
      const orderMap = new Map(
        INITIAL_CATEGORIES.map((c, idx) => [c.id, idx]),
      );
      const list: Category[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: sanitizeCategoryId(String(data.id ?? d.id)),
            name: String(data.name ?? ''),
            targetBudget: Number(data.targetBudget ?? 0),
            accentHex: String(data.accentHex ?? '#475569'),
          };
        })
        .sort(
          (a, b) =>
            (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99),
        );
      callbacks.onCategories(list.length > 0 ? list : INITIAL_CATEGORIES);
    },
    (error) => reportListenerError(error, OperationType.LIST, catPath),
  );

  const txPath = `users/${userId}/transactions`;
  const unsubTransactions = onSnapshot(
    query(collection(db, 'users', userId, 'transactions'), where('ownerId', '==', userId)),
    (snapshot) => {
      const list: Transaction[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title ?? ''),
          amount: Number(data.amount ?? 0),
          categoryId: sanitizeCategoryId(String(data.categoryId ?? 'sonstiges')),
          date: String(data.date ?? ''),
          createdAt: Number(data.clientCreatedAt ?? 0),
          ...(typeof data.recurringId === 'string'
            ? {
                recurringId: data.recurringId,
                recurringInterval:
                  data.recurringInterval === 'weekly' ? 'weekly' : 'monthly',
              }
            : {}),
        };
      });
      callbacks.onTransactions(list);
    },
    (error) => reportListenerError(error, OperationType.LIST, txPath),
  );

  const rulesPath = `users/${userId}/recurringRules`;
  const unsubRules = onSnapshot(
    query(collection(db, 'users', userId, 'recurringRules'), where('ownerId', '==', userId)),
    (snapshot) => {
      const list: RecurringRule[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            amount: Number(data.amount ?? 0),
            categoryId: sanitizeCategoryId(
              String(data.categoryId ?? 'sonstiges'),
            ),
            interval: (data.interval === 'weekly'
              ? 'weekly'
              : 'monthly') as RecurringInterval,
            startDate: String(data.startDate ?? ''),
            active: Boolean(data.active),
            generatedPeriods: Array.isArray(data.generatedPeriods)
              ? data.generatedPeriods.map(String)
              : [],
            createdAt: Number(data.clientCreatedAt ?? 0),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callbacks.onRecurringRules(list);
    },
    (error) => reportListenerError(error, OperationType.LIST, rulesPath),
  );

  const goalsPath = `users/${userId}/savingsGoals`;
  const unsubGoals = onSnapshot(
    query(collection(db, 'users', userId, 'savingsGoals'), where('ownerId', '==', userId)),
    (snapshot) => {
      const list: SavingsGoal[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            categoryLabel: String(data.categoryLabel ?? 'Sonstiges'),
            targetAmount: Number(data.targetAmount ?? 0),
            initialSaved: Number(data.initialSaved ?? 0),
            monthlyTarget: Number(data.monthlyTarget ?? 0),
            accentHex: String(data.accentHex ?? '#0284C7'),
            contributions: Array.isArray(data.contributions)
              ? (data.contributions as SavingsContribution[])
              : [],
            createdAt: Number(data.clientCreatedAt ?? 0),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callbacks.onSavingsGoals(list);
    },
    (error) => reportListenerError(error, OperationType.LIST, goalsPath),
  );

  const debtsPath = `users/${userId}/debts`;
  const unsubDebts = onSnapshot(
    query(collection(db, 'users', userId, 'debts'), where('ownerId', '==', userId)),
    (snapshot) => {
      const list: DebtItem[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            creditor: String(data.creditor ?? 'Kreditgeber'),
            initialBalance: Number(data.initialBalance ?? 0),
            currentBalance: Number(data.currentBalance ?? 0),
            interestRate: Number(data.interestRate ?? 0),
            minimumPayment: Number(data.minimumPayment ?? 0),
            ...(typeof data.termMonths === 'number' &&
            Number.isFinite(data.termMonths) &&
            data.termMonths >= 1
              ? { termMonths: Math.round(data.termMonths) }
              : {}),
            ...(typeof data.disbursedAt === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(data.disbursedAt)
              ? { disbursedAt: data.disbursedAt }
              : {}),
            accentHex: String(data.accentHex ?? '#0F766E'),
            payments: Array.isArray(data.payments)
              ? (data.payments as DebtPayment[])
              : [],
            createdAt: Number(data.clientCreatedAt ?? 0),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callbacks.onDebts(list);
    },
    (error) => reportListenerError(error, OperationType.LIST, debtsPath),
  );

  return () => {
    unsubUser();
    unsubCategories();
    unsubTransactions();
    unsubRules();
    unsubGoals();
    unsubDebts();
  };
}

export async function updateUserMonthlyLimit(
  userId: string,
  monthlyLimit: number,
): Promise<void> {
  const path = `users/${userId}`;
  const clamped = Math.min(3000, Math.max(200, Math.round(monthlyLimit)));
  try {
    await updateDoc(doc(db, 'users', userId), {
      monthlyLimit: clamped,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserTheme(
  userId: string,
  theme: 'light' | 'dark',
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      theme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCategoryTargetInFirestore(
  userId: string,
  categoryId: CategoryId,
  targetBudget: number,
): Promise<void> {
  const path = `users/${userId}/categories/${categoryId}`;
  const clamped = Math.min(100000, Math.max(0, Math.round(targetBudget)));
  try {
    await updateDoc(doc(db, 'users', userId, 'categories', categoryId), {
      targetBudget: clamped,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTransactionInFirestore(
  userId: string,
  tx: Omit<Transaction, 'id' | 'createdAt'>,
): Promise<void> {
  const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${userId}/transactions/${txId}`;
  const amount = Math.min(1000000, Math.max(0.01, Math.round(tx.amount * 100) / 100));

  const payload: Record<string, unknown> = {
    ownerId: userId,
    title: sanitizeTitle(tx.title),
    amount,
    categoryId: sanitizeCategoryId(tx.categoryId),
    date: sanitizeIsoDate(tx.date),
    clientCreatedAt: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (tx.recurringId) {
    payload.recurringId = sanitizeId(tx.recurringId, 'rule');
    payload.recurringInterval =
      tx.recurringInterval === 'weekly' ? 'weekly' : 'monthly';
  }

  try {
    await setDoc(doc(db, 'users', userId, 'transactions', txId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTransactionInFirestore(
  userId: string,
  txId: string,
): Promise<void> {
  const path = `users/${userId}/transactions/${txId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'transactions', txId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createRecurringRuleAndSyncInFirestore(
  userId: string,
  payload: {
    title: string;
    amount: number;
    categoryId: CategoryId;
    startDate: string;
    interval: RecurringInterval;
  },
  existingTransactions: Transaction[],
): Promise<number> {
  const ruleId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newRule: RecurringRule = {
    id: ruleId,
    title: sanitizeTitle(payload.title),
    amount: Math.min(1000000, Math.max(0.01, Math.round(payload.amount * 100) / 100)),
    categoryId: sanitizeCategoryId(payload.categoryId),
    interval: payload.interval,
    startDate: sanitizeIsoDate(payload.startDate),
    active: true,
    generatedPeriods: [],
    createdAt: Date.now(),
  };

  const todayIso = toIsoDate(new Date());
  const synced =
    newRule.startDate <= todayIso
      ? syncRecurringTransactions([newRule], existingTransactions)
      : {
          updatedRules: [newRule],
          updatedTransactions: existingTransactions,
          addedCount: 0,
        };

  const finalRule = synced.updatedRules[0];
  const addedTransactions = synced.updatedTransactions.slice(0, synced.addedCount);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId, 'recurringRules', ruleId), {
    ownerId: userId,
    title: finalRule.title,
    amount: finalRule.amount,
    categoryId: finalRule.categoryId,
    interval: finalRule.interval,
    startDate: finalRule.startDate,
    active: finalRule.active,
    generatedPeriods: finalRule.generatedPeriods.slice(0, 120),
    clientCreatedAt: finalRule.createdAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const tx of addedTransactions) {
    const txId = sanitizeId(tx.id, 'tx');
    batch.set(doc(db, 'users', userId, 'transactions', txId), {
      ownerId: userId,
      title: sanitizeTitle(tx.title),
      amount: tx.amount,
      categoryId: tx.categoryId,
      date: tx.date,
      clientCreatedAt: tx.createdAt,
      recurringId: ruleId,
      recurringInterval: finalRule.interval,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const path = `users/${userId}/recurringRules/${ruleId}`;
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
  return synced.addedCount;
}

export async function markTransactionAsRecurringInFirestore(
  userId: string,
  tx: Transaction,
  existingTransactions: Transaction[],
): Promise<number> {
  const ruleId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const periodKey = tx.date.slice(0, 7);

  const newRule: RecurringRule = {
    id: ruleId,
    title: sanitizeTitle(tx.title),
    amount: tx.amount,
    categoryId: tx.categoryId,
    interval: 'monthly',
    startDate: sanitizeIsoDate(tx.date),
    active: true,
    generatedPeriods: [periodKey],
    createdAt: Date.now(),
  };

  const updatedList = existingTransactions.map((item) =>
    item.id === tx.id
      ? { ...item, recurringId: ruleId, recurringInterval: 'monthly' as const }
      : item,
  );
  const synced = syncRecurringTransactions([newRule], updatedList);
  const finalRule = synced.updatedRules[0];
  const addedTransactions = synced.updatedTransactions.slice(0, synced.addedCount);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId, 'recurringRules', ruleId), {
    ownerId: userId,
    title: finalRule.title,
    amount: finalRule.amount,
    categoryId: finalRule.categoryId,
    interval: finalRule.interval,
    startDate: finalRule.startDate,
    active: true,
    generatedPeriods: finalRule.generatedPeriods.slice(0, 120),
    clientCreatedAt: finalRule.createdAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', userId, 'transactions', tx.id), {
    recurringId: ruleId,
    recurringInterval: 'monthly',
    updatedAt: serverTimestamp(),
  });

  for (const newTx of addedTransactions) {
    const newTxId = sanitizeId(newTx.id, 'tx');
    batch.set(doc(db, 'users', userId, 'transactions', newTxId), {
      ownerId: userId,
      title: sanitizeTitle(newTx.title),
      amount: newTx.amount,
      categoryId: newTx.categoryId,
      date: newTx.date,
      clientCreatedAt: newTx.createdAt,
      recurringId: ruleId,
      recurringInterval: 'monthly',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/recurringRules/${ruleId}`);
  }
  return synced.addedCount;
}

export async function syncDueRecurringRulesToFirestore(
  userId: string,
  rules: RecurringRule[],
  existingTransactions: Transaction[],
): Promise<number> {
  const synced = syncRecurringTransactions(rules, existingTransactions);
  if (synced.addedCount === 0) return 0;

  const addedTransactions = synced.updatedTransactions.slice(0, synced.addedCount);
  const batch = writeBatch(db);

  for (let i = 0; i < rules.length; i++) {
    const before = rules[i];
    const after = synced.updatedRules[i];
    if (after && after.generatedPeriods.length !== before.generatedPeriods.length) {
      batch.update(doc(db, 'users', userId, 'recurringRules', after.id), {
        generatedPeriods: after.generatedPeriods.slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    }
  }

  for (const tx of addedTransactions) {
    const txId = sanitizeId(tx.id, 'tx');
    batch.set(doc(db, 'users', userId, 'transactions', txId), {
      ownerId: userId,
      title: sanitizeTitle(tx.title),
      amount: tx.amount,
      categoryId: tx.categoryId,
      date: tx.date,
      clientCreatedAt: tx.createdAt,
      recurringId: tx.recurringId,
      recurringInterval: tx.recurringInterval ?? 'monthly',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/recurringRules`);
  }
  return synced.addedCount;
}

export async function toggleRecurringRuleInFirestore(
  userId: string,
  rule: RecurringRule,
  existingTransactions: Transaction[],
): Promise<number> {
  const nextActive = !rule.active;
  const ruleRef = doc(db, 'users', userId, 'recurringRules', rule.id);

  if (!nextActive) {
    try {
      await updateDoc(ruleRef, {
        active: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${userId}/recurringRules/${rule.id}`,
      );
    }
    return 0;
  }

  const reactivatedRule = { ...rule, active: true };
  const synced = syncRecurringTransactions([reactivatedRule], existingTransactions);
  const finalRule = synced.updatedRules[0];
  const addedTransactions = synced.updatedTransactions.slice(0, synced.addedCount);

  const batch = writeBatch(db);
  batch.update(ruleRef, {
    active: true,
    generatedPeriods: finalRule.generatedPeriods.slice(0, 120),
    updatedAt: serverTimestamp(),
  });

  for (const tx of addedTransactions) {
    const txId = sanitizeId(tx.id, 'tx');
    batch.set(doc(db, 'users', userId, 'transactions', txId), {
      ownerId: userId,
      title: sanitizeTitle(tx.title),
      amount: tx.amount,
      categoryId: tx.categoryId,
      date: tx.date,
      clientCreatedAt: tx.createdAt,
      recurringId: rule.id,
      recurringInterval: rule.interval,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `users/${userId}/recurringRules/${rule.id}`,
    );
  }
  return synced.addedCount;
}

export async function deleteRecurringRuleInFirestore(
  userId: string,
  ruleId: string,
  linkedTransactions: Transaction[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', userId, 'recurringRules', ruleId));

  for (const tx of linkedTransactions) {
    batch.update(doc(db, 'users', userId, 'transactions', tx.id), {
      recurringId: deleteField(),
      recurringInterval: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `users/${userId}/recurringRules/${ruleId}`,
    );
  }
}

export async function createSavingsGoalInFirestore(
  userId: string,
  payload: {
    title: string;
    categoryLabel: string;
    accentHex: string;
    targetAmount: number;
    initialSaved: number;
    monthlyTarget: number;
  },
): Promise<void> {
  const goalId = `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${userId}/savingsGoals/${goalId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'savingsGoals', goalId), {
      ownerId: userId,
      title: sanitizeTitle(payload.title, 'Sparziel'),
      categoryLabel: sanitizeTitle(payload.categoryLabel, 'Sonstiges').slice(0, 60),
      targetAmount: Math.min(10000000, Math.max(1, Math.round(payload.targetAmount * 100) / 100)),
      initialSaved: Math.min(10000000, Math.max(0, Math.round(payload.initialSaved * 100) / 100)),
      monthlyTarget: Math.min(1000000, Math.max(0, Math.round(payload.monthlyTarget * 100) / 100)),
      accentHex: sanitizeHex(payload.accentHex),
      contributions: [],
      clientCreatedAt: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateGoalContributionsInFirestore(
  userId: string,
  goalId: string,
  contributions: SavingsContribution[],
): Promise<void> {
  const path = `users/${userId}/savingsGoals/${goalId}`;
  const bounded = contributions.slice(-200).map((c) => ({
    id: sanitizeId(c.id, 'contrib'),
    amount: Math.min(1000000, Math.max(0.01, Math.round(c.amount * 100) / 100)),
    date: sanitizeIsoDate(c.date),
    createdAt: Math.max(0, Number(c.createdAt) || Date.now()),
  }));

  try {
    await updateDoc(doc(db, 'users', userId, 'savingsGoals', goalId), {
      contributions: bounded,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavingsGoalInFirestore(
  userId: string,
  goalId: string,
): Promise<void> {
  const path = `users/${userId}/savingsGoals/${goalId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'savingsGoals', goalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetUserExpensesInFirestore(
  userId: string,
  transactions: Transaction[],
  rules: RecurringRule[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const tx of transactions) {
    batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
  }
  for (const rule of rules) {
    if (rule.active) {
      batch.update(doc(db, 'users', userId, 'recurringRules', rule.id), {
        active: false,
        updatedAt: serverTimestamp(),
      });
    }
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/transactions`);
  }
}

export async function restoreUserTransactionsAndRulesInFirestore(
  userId: string,
  transactions: Transaction[],
  rules: RecurringRule[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const tx of transactions) {
    const payload: Record<string, unknown> = {
      ownerId: userId,
      title: sanitizeTitle(tx.title),
      amount: tx.amount,
      categoryId: sanitizeCategoryId(tx.categoryId),
      date: sanitizeIsoDate(tx.date),
      clientCreatedAt: tx.createdAt || Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (tx.recurringId) {
      payload.recurringId = sanitizeId(tx.recurringId, 'rule');
      payload.recurringInterval =
        tx.recurringInterval === 'weekly' ? 'weekly' : 'monthly';
    }
    batch.set(doc(db, 'users', userId, 'transactions', sanitizeId(tx.id, 'tx')), payload);
  }

  for (const rule of rules) {
    batch.update(doc(db, 'users', userId, 'recurringRules', rule.id), {
      active: rule.active,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/transactions`);
  }
}

export async function restoreDemoDataInFirestore(
  userId: string,
  currentTransactions: Transaction[],
  currentRules: RecurringRule[],
  currentGoals: SavingsGoal[],
): Promise<void> {
  const batch = writeBatch(db);

  for (const tx of currentTransactions) {
    batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
  }
  for (const r of currentRules) {
    batch.delete(doc(db, 'users', userId, 'recurringRules', r.id));
  }
  for (const g of currentGoals) {
    batch.delete(doc(db, 'users', userId, 'savingsGoals', g.id));
  }

  batch.update(doc(db, 'users', userId), {
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    updatedAt: serverTimestamp(),
  });

  for (const cat of INITIAL_CATEGORIES) {
    batch.update(doc(db, 'users', userId, 'categories', cat.id), {
      targetBudget: cat.targetBudget,
      updatedAt: serverTimestamp(),
    });
  }

  for (const tx of createInitialTransactions()) {
    const payload: Record<string, unknown> = {
      ownerId: userId,
      title: tx.title,
      amount: tx.amount,
      categoryId: tx.categoryId,
      date: tx.date,
      clientCreatedAt: tx.createdAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (tx.recurringId) {
      payload.recurringId = tx.recurringId;
      payload.recurringInterval = tx.recurringInterval ?? 'monthly';
    }
    batch.set(doc(db, 'users', userId, 'transactions', tx.id), payload);
  }

  for (const rule of createInitialRecurringRules()) {
    batch.set(doc(db, 'users', userId, 'recurringRules', rule.id), {
      ownerId: userId,
      title: rule.title,
      amount: rule.amount,
      categoryId: rule.categoryId,
      interval: rule.interval,
      startDate: rule.startDate,
      active: rule.active,
      generatedPeriods: rule.generatedPeriods,
      clientCreatedAt: rule.createdAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const goal of createInitialSavingsGoals()) {
    batch.set(doc(db, 'users', userId, 'savingsGoals', goal.id), {
      ownerId: userId,
      title: goal.title,
      categoryLabel: goal.categoryLabel,
      targetAmount: goal.targetAmount,
      initialSaved: goal.initialSaved,
      monthlyTarget: goal.monthlyTarget,
      accentHex: goal.accentHex,
      contributions: goal.contributions,
      clientCreatedAt: goal.createdAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

export async function updateUserDebtPreferences(
  userId: string,
  prefs: {
    debtStrategy?: DebtPayoffStrategy;
    debtExtraMonthly?: number;
  },
): Promise<void> {
  const path = `users/${userId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (prefs.debtStrategy) {
    payload.debtStrategy =
      prefs.debtStrategy === 'snowball' ? 'snowball' : 'avalanche';
  }
  if (typeof prefs.debtExtraMonthly === 'number') {
    payload.debtExtraMonthly = Math.min(
      100000,
      Math.max(0, Math.round(prefs.debtExtraMonthly)),
    );
  }

  try {
    await updateDoc(doc(db, 'users', userId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createDebtInFirestore(
  userId: string,
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
): Promise<void> {
  const debtId = `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${userId}/debts/${debtId}`;

  const currentBalance = Math.min(
    10000000,
    Math.max(0, Math.round(payload.currentBalance * 100) / 100),
  );
  const initialBalance = Math.min(
    10000000,
    Math.max(
      Math.max(1, currentBalance),
      Math.round(payload.initialBalance * 100) / 100,
    ),
  );

  const docData: Record<string, unknown> = {
    ownerId: userId,
    title: sanitizeTitle(payload.title, 'Verbindlichkeit'),
    creditor: sanitizeTitle(payload.creditor, 'Kreditgeber').slice(0, 60),
    initialBalance,
    currentBalance,
    interestRate: Math.min(
      100,
      Math.max(0, Math.round(payload.interestRate * 100) / 100),
    ),
    minimumPayment: Math.min(
      1000000,
      Math.max(0, Math.round(payload.minimumPayment * 100) / 100),
    ),
    accentHex: sanitizeHex(payload.accentHex),
    payments: [],
    clientCreatedAt: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (
    typeof payload.termMonths === 'number' &&
    Number.isFinite(payload.termMonths) &&
    payload.termMonths >= 1
  ) {
    docData.termMonths = Math.min(600, Math.max(1, Math.round(payload.termMonths)));
  }

  if (
    typeof payload.disbursedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.disbursedAt)
  ) {
    docData.disbursedAt = payload.disbursedAt;
  }

  try {
    await setDoc(doc(db, 'users', userId, 'debts', debtId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDebtInFirestore(
  userId: string,
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
): Promise<void> {
  const path = `users/${userId}/debts/${debtId}`;
  const currentBalance = Math.min(
    10000000,
    Math.max(0, Math.round(payload.currentBalance * 100) / 100),
  );
  const initialBalance = Math.min(
    10000000,
    Math.max(
      Math.max(1, currentBalance),
      Math.round(payload.initialBalance * 100) / 100,
    ),
  );

  const hasValidTerm =
    typeof payload.termMonths === 'number' &&
    Number.isFinite(payload.termMonths) &&
    payload.termMonths >= 1;

  const hasValidDisbursedAt =
    typeof payload.disbursedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.disbursedAt);

  try {
    await updateDoc(doc(db, 'users', userId, 'debts', debtId), {
      title: sanitizeTitle(payload.title, 'Verbindlichkeit'),
      creditor: sanitizeTitle(payload.creditor, 'Kreditgeber').slice(0, 60),
      initialBalance,
      currentBalance,
      interestRate: Math.min(
        100,
        Math.max(0, Math.round(payload.interestRate * 100) / 100),
      ),
      minimumPayment: Math.min(
        1000000,
        Math.max(0, Math.round(payload.minimumPayment * 100) / 100),
      ),
      termMonths: hasValidTerm
        ? Math.min(600, Math.max(1, Math.round(payload.termMonths!)))
        : deleteField(),
      disbursedAt: hasValidDisbursedAt ? payload.disbursedAt : deleteField(),
      accentHex: sanitizeHex(payload.accentHex),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordDebtPaymentInFirestore(
  userId: string,
  debt: DebtItem,
  amount: number,
  paymentDate: string,
  alsoBookAsExpense: boolean,
): Promise<void> {
  const cleanAmount = Math.min(
    1000000,
    Math.max(0.01, Math.round(amount * 100) / 100),
  );
  const nextBalance = Math.max(
    0,
    Math.round((debt.currentBalance - cleanAmount) * 100) / 100,
  );
  const cleanDate = sanitizeIsoDate(paymentDate);
  const paymentEntry: DebtPayment = {
    id: `dpay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amount: cleanAmount,
    date: cleanDate,
    createdAt: Date.now(),
  };

  const nextPayments = [...debt.payments, paymentEntry].slice(-200).map((p) => ({
    id: sanitizeId(p.id, 'dpay'),
    amount: Math.min(1000000, Math.max(0.01, Math.round(p.amount * 100) / 100)),
    date: sanitizeIsoDate(p.date),
    createdAt: Math.max(0, Number(p.createdAt) || Date.now()),
  }));

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId, 'debts', debt.id), {
    currentBalance: nextBalance,
    payments: nextPayments,
    updatedAt: serverTimestamp(),
  });

  if (alsoBookAsExpense) {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    batch.set(doc(db, 'users', userId, 'transactions', txId), {
      ownerId: userId,
      title: sanitizeTitle(`Tilgung: ${debt.title}`, 'Schuldentilgung'),
      amount: cleanAmount,
      categoryId: 'sonstiges',
      date: cleanDate,
      clientCreatedAt: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `users/${userId}/debts/${debt.id}`,
    );
  }
}

export async function deleteDebtInFirestore(
  userId: string,
  debtId: string,
): Promise<void> {
  const path = `users/${userId}/debts/${debtId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'debts', debtId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleDebtsInFirestore(userId: string): Promise<void> {
  const samples = createSampleDebts();
  const batch = writeBatch(db);
  for (const debt of samples) {
    const docData: Record<string, unknown> = {
      ownerId: userId,
      title: debt.title,
      creditor: debt.creditor,
      initialBalance: debt.initialBalance,
      currentBalance: debt.currentBalance,
      interestRate: debt.interestRate,
      minimumPayment: debt.minimumPayment,
      accentHex: debt.accentHex,
      payments: [],
      clientCreatedAt: debt.createdAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (typeof debt.termMonths === 'number' && debt.termMonths >= 1) {
      docData.termMonths = debt.termMonths;
    }
    if (
      typeof debt.disbursedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(debt.disbursedAt)
    ) {
      docData.disbursedAt = debt.disbursedAt;
    }
    batch.set(doc(db, 'users', userId, 'debts', debt.id), docData);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/debts`);
  }
}
