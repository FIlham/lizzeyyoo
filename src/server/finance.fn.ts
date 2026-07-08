// src/server/finance.fn.ts — Server function RPC definitions (imports: .server.ts allowed)
import { createServerFn } from '@tanstack/react-start';
import * as FinanceService from './finance.service';
import { getAuthContext } from './session.server';
import type { NewTransaction, Transaction } from './finance.types';
import { runAIChat } from '../services/ai.server';
import type { AIProvider } from '../services/ai.server';
import {
  checkRateLimit,
  RateLimitError,
  AI_CHAT_LIMITS,
  FINANCE_WRITE_LIMITS,
} from './ratelimit.server';

// --- Transactions ---

export const fetchTransactionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await getAuthContext();
  return await FinanceService.getAllTransactions(userId);
});

export const fetchRecentTransactionsFn = createServerFn({ method: 'GET' })
  .validator((d: number) => d)
  .handler(async ({ data: days }) => {
    const { userId } = await getAuthContext();
    return await FinanceService.getRecentTransactions(userId, days);
  });

export const createTransactionFn = createServerFn({ method: 'POST' })
  .validator((d: Omit<NewTransaction, never>) => d as Omit<Transaction, 'id' | 'date'>)
  .handler(async ({ data }) => {
    const { userId } = await getAuthContext();
    // Rate-limit: 30 write ops per minute per user
    await checkRateLimit(`user:${userId}`, FINANCE_WRITE_LIMITS);
    return await FinanceService.addTransaction(userId, data);
  });

export const deleteTransactionFn = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => d.id)
  .handler(async ({ data: id }) => {
    const { userId } = await getAuthContext();
    // Rate-limit: 30 write ops per minute per user
    await checkRateLimit(`user:${userId}`, FINANCE_WRITE_LIMITS);
    return await FinanceService.deleteTransaction(userId, id);
  });

// --- Budgets ---

export const fetchBudgetsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await getAuthContext();
  return await FinanceService.getBudgets(userId);
});

export const updateBudgetFn = createServerFn({ method: 'POST' })
  .validator((d: { category: string; amount: number }) => d)
  .handler(async ({ data }) => {
    const { userId } = await getAuthContext();
    // Rate-limit: 30 write ops per minute per user
    await checkRateLimit(`user:${userId}`, FINANCE_WRITE_LIMITS);
    return await FinanceService.updateBudget(userId, data.category, data.amount);
  });

// --- Goals ---

export const fetchGoalFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await getAuthContext();
  return await FinanceService.getGoal(userId);
});

export const updateGoalFn = createServerFn({ method: 'POST' })
  .validator((d: { name?: string; target?: number; current?: number }) => d)
  .handler(async ({ data }) => {
    const { userId } = await getAuthContext();
    // Rate-limit: 30 write ops per minute per user
    await checkRateLimit(`user:${userId}`, FINANCE_WRITE_LIMITS);
    return await FinanceService.updateGoal(userId, data);
  });

// --- Summary / Analytics ---

export const fetchSummaryFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await getAuthContext();
  return await FinanceService.getFinanceSummary(userId, 30);
});

// --- AI Chat ---

export const sendChatMessageFn = createServerFn({ method: 'POST' })
  .validator(
    (d: {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      sessionId: string;
      provider?: AIProvider;
      model?: string;
    }) => d,
  )
  .handler(async function* ({ data }) {
    const { userId } = await getAuthContext();

    // Rate-limit BEFORE calling AI — protect free API quota
    // Throws RateLimitError (serialized as error string to client) if exceeded
    try {
      await checkRateLimit(`user:${userId}`, AI_CHAT_LIMITS);
    } catch (err) {
      if (err instanceof RateLimitError) {
        yield `⚠️ **Rate Limit**: ${err.message}`;
        return;
      }
      throw err;
    }

    const stream = await runAIChat(
      data.messages,
      data.sessionId,
      userId,
      data.provider,
      data.model,
    );
    for await (const chunk of stream) {
      yield chunk;
    }
  });

export const clearChatSessionFn = createServerFn({ method: 'POST' })
  .validator((d: { sessionId: string }) => d.sessionId)
  .handler(async ({ data: sessionId }) => {
    const { chatMemory } = await import('../services/ai.server');
    chatMemory.clear(sessionId);
    return { success: true };
  });