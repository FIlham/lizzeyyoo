// src/server/finance.types.ts
// Domain types for the finance feature. No db.json schema anymore (Postgres-backed).

export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'Makanan'
  | 'Transportasi'
  | 'Hiburan'
  | 'Belanja'
  | 'Tagihan'
  | 'Kesehatan'
  | 'Pendidikan'
  | 'Lainnya';

export interface Transaction {
  id: string;
  date: string; // ISO string
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  method?: string; // e.g. "Cash", "Transfer", "Debit"
  rawInput?: string; // original natural language input if from AI parsing
}

export type Budgets = Record<string, number>;

export interface Goal {
  name: string;
  target: number;
  current: number;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Record<string, number>;
  recentTransactions: Transaction[];
}

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  method?: string;
  rawInput?: string;
}