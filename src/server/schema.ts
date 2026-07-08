// src/server/schema.ts — Drizzle schema (auth + finance), single source of truth
import { pgTable, text, timestamp, boolean, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Better Auth core tables (model names: user, session, account, verification) ---

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Finance tables (userId-scoped) ---

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    type: text('type').notNull(), // 'income' | 'expense'
    amount: integer('amount').notNull(),
    category: text('category').notNull(),
    note: text('note').notNull().default(''),
    method: text('method'),
    rawInput: text('raw_input'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('tx_user_date').on(t.userId, t.id)],
);

export const budgets = pgTable(
  'budgets',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('budget_user_category').on(t.userId, t.category)],
);

export const goals = pgTable(
  'goals',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Beli Laptop'),
    target: integer('target').notNull().default(5_000_000),
    current: integer('current').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('goal_user').on(t.userId)],
);

export const userRelations = relations(user, ({ many }) => ({
  transactions: many(transactions),
  budgets: many(budgets),
  goals: many(goals),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(user, {
    fields: [budgets.userId],
    references: [user.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(user, {
    fields: [goals.userId],
    references: [user.id],
  }),
}));

export const DEFAULT_BUDGETS: Record<string, number> = {
  Makanan: 1_500_000,
  Transportasi: 500_000,
  Hiburan: 300_000,
  Belanja: 500_000,
  Tagihan: 800_000,
  Lainnya: 200_000,
};