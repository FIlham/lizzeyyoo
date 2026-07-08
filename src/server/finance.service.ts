// src/server/finance.service.ts — Postgres (drizzle) + Redis cache, userId-scoped.
import { and, desc, eq, gte } from 'drizzle-orm';
import { db, schema } from './db.server';
import { cacheGetOrSet, cacheInvalidateUser } from './cache.server';
import type { FinanceSummary, Goal, Transaction, TransactionType } from './finance.types';

const SUMMARY_TTL = 30; // seconds
const BUDGET_TTL = 300;
const GOAL_TTL = 300;

// --- Transactions ---

export async function getAllTransactions(userId: string): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId))
    .orderBy(desc(schema.transactions.date));
  return rows.map(rowToTransaction);
}

export async function getRecentTransactions(userId: string, days = 30): Promise<Transaction[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), gte(schema.transactions.date, cutoff)))
    .orderBy(desc(schema.transactions.date));
  return rows.map(rowToTransaction);
}

export async function addTransaction(
  userId: string,
  newTx: Omit<Transaction, 'id' | 'date'>,
): Promise<Transaction> {
  const [row] = await db
    .insert(schema.transactions)
    .values({
      userId,
      type: newTx.type,
      amount: newTx.amount,
      category: newTx.category,
      note: newTx.note,
      method: newTx.method ?? null,
      rawInput: newTx.rawInput ?? null,
    })
    .returning();
  await cacheInvalidateUser(userId);
  return rowToTransaction(row);
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
    .returning({ id: schema.transactions.id });
  if (res.length === 0) return false;
  await cacheInvalidateUser(userId);
  return true;
}

// --- Budgets ---

export async function getBudgets(userId: string): Promise<Record<string, number>> {
  return await cacheGetOrSet(`u:${userId}:budgets`, BUDGET_TTL, async () => {
    const rows = await db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId));
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category] = r.amount;
    return out;
  });
}

export async function updateBudget(
  userId: string,
  category: string,
  amount: number,
): Promise<Record<string, number>> {
  // upsert on (userId, category)
  await db
    .insert(schema.budgets)
    .values({ userId, category, amount })
    .onConflictDoUpdate({
      target: [schema.budgets.userId, schema.budgets.category],
      set: { amount, updatedAt: new Date() },
    });
  await cacheInvalidateUser(userId);
  return await getBudgets(userId);
}

// --- Goals ---

export async function getGoal(userId: string): Promise<Goal> {
  return await cacheGetOrSet(`u:${userId}:goal`, GOAL_TTL, async () => {
    const rows = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId));
    const g = rows[0];
    return g
      ? { name: g.name, target: g.target, current: g.current }
      : { name: 'Beli Laptop', target: 5_000_000, current: 0 };
  });
}

export async function updateGoal(
  userId: string,
  updates: Partial<Pick<Goal, 'name' | 'target' | 'current'>>,
): Promise<Goal> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.target !== undefined) set.target = updates.target;
  if (updates.current !== undefined) set.current = updates.current;

  await db
    .insert(schema.goals)
    .values({
      userId,
      name: updates.name ?? 'Beli Laptop',
      target: updates.target ?? 5_000_000,
      current: updates.current ?? 0,
    })
    .onConflictDoUpdate({
      target: [schema.goals.userId],
      set,
    });
  await cacheInvalidateUser(userId);
  return await getGoal(userId);
}

// --- Summary / Analytics ---

export async function getFinanceSummary(userId: string, days = 30): Promise<FinanceSummary> {
  return await cacheGetOrSet(`u:${userId}:summary:${days}d`, SUMMARY_TTL, async () => {
    const recent = await getRecentTransactions(userId, days);
    let totalIncome = 0;
    let totalExpense = 0;
    const byCategory: Record<string, number> = {};
    for (const tx of recent) {
      if (tx.type === 'income') totalIncome += tx.amount;
      else {
        totalExpense += tx.amount;
        byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
      }
    }
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byCategory,
      recentTransactions: recent,
    };
  });
}

// --- Mapper ---

type TxRow = typeof schema.transactions.$inferSelect;

function rowToTransaction(row: TxRow): Transaction {
  return {
    id: row.id,
    date: row.date.toISOString(),
    type: row.type as TransactionType,
    amount: row.amount,
    category: row.category,
    note: row.note,
    method: row.method ?? undefined,
    rawInput: row.rawInput ?? undefined,
  };
}