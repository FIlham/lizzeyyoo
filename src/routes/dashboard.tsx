// src/routes/dashboard.tsx
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import type { FormEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  createTransactionFn,
  deleteTransactionFn,
  fetchBudgetsFn,
  fetchGoalFn,
  fetchSummaryFn,
  updateBudgetFn,
  updateGoalFn,
} from '../server/finance.fn';
import type { Transaction, TransactionType } from '../server/finance.types';
import { getSessionFn } from '../server/auth.fn';

gsap.registerPlugin(useGSAP);

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: '/login' });
    return { session };
  },
  loader: async () => {
    const [summary, budgets, goal] = await Promise.all([
      fetchSummaryFn(),
      fetchBudgetsFn(),
      fetchGoalFn(),
    ]);
    return { summary, budgets, goal };
  },
});

const CATEGORIES = [
  'Makanan',
  'Transportasi',
  'Hiburan',
  'Belanja',
  'Tagihan',
  'Kesehatan',
  'Pendidikan',
  'Lainnya',
];
const METHODS = ['Cash', 'Transfer', 'Debit', 'Kredit', 'E-Wallet'];

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const fmt = (n: number) => rupiahFormatter.format(n);
const digitsOnly = (value: string) => value.replace(/\D/g, '');
const formatCurrencyInput = (value: string) => (value ? fmt(Number(value)) : '');

function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { summary, budgets, goal } = Route.useLoaderData();
  const router = useRouter();

  useGSAP(() => {
    const tl = gsap.timeline();
    
    tl.from('.dash-header', {
      y: -20,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out'
    });

    tl.from('.dash-summary', {
      scale: 0.95,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out'
    }, '-=0.4');

    tl.from('.dash-section', {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power3.out'
    }, '-=0.2');

  }, { scope: containerRef });

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const firstBudgetCategory = Object.keys(budgets)[0] ?? 'Makanan';
  const [budgetCategory, setBudgetCategory] = useState(firstBudgetCategory);
  const [budgetAmount, setBudgetAmount] = useState(String(budgets[firstBudgetCategory] ?? ''));
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  
  const [goalName, setGoalName] = useState(goal.name);
  const [goalTarget, setGoalTarget] = useState(String(goal.target));
  const [goalCurrent, setGoalCurrent] = useState(String(goal.current));
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!amountValue || isNaN(amountValue)) return;

    setIsSubmitting(true);
    try {
      await createTransactionFn({
        data: {
          type,
          amount: amountValue,
          category,
          note,
          method,
        },
      });
      router.invalidate();
      setAmount('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBudgetCategoryChange = (nextCategory: string) => {
    setBudgetCategory(nextCategory);
    setBudgetAmount(String(budgets[nextCategory] ?? ''));
  };

  const handleBudgetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amountValue = Number(budgetAmount);
    if (!budgetCategory || isNaN(amountValue)) return;

    setIsSavingBudget(true);
    try {
      await updateBudgetFn({ data: { category: budgetCategory, amount: amountValue } });
      await router.invalidate();
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleGoalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetValue = Number(goalTarget);
    const currentValue = Number(goalCurrent);
    if (!goalName.trim() || isNaN(targetValue) || isNaN(currentValue)) return;

    setIsSavingGoal(true);
    try {
      await updateGoalFn({
        data: {
          name: goalName.trim(),
          target: targetValue,
          current: currentValue,
        },
      });
      await router.invalidate();
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTransactionFn({ data: { id } });
      router.invalidate();
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto px-6 py-12 space-y-12 text-zinc-100 font-sans">
      
      {/* Header */}
      <header className="space-y-2 dash-header">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">MVP Phase</div>
        <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-zinc-400">Manage daily entries and track goals without the visual noise.</p>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/40 border border-zinc-800 p-6 flex flex-col gap-2 dash-summary">
          <span className="text-sm font-medium text-zinc-400">Income (30d)</span>
          <span className="text-3xl font-semibold">{fmt(summary.totalIncome)}</span>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800 p-6 flex flex-col gap-2 dash-summary">
          <span className="text-sm font-medium text-zinc-400">Expense (30d)</span>
          <span className="text-3xl font-semibold">{fmt(summary.totalExpense)}</span>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800 p-6 flex flex-col gap-2 dash-summary">
          <span className="text-sm font-medium text-zinc-400">Net Balance</span>
          <span className="text-3xl font-semibold">{fmt(summary.balance)}</span>
        </div>
      </section>

      {/* Two Column Layout for Plannings & Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Form & History */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Add Transaction */}
          <section className="space-y-6 dash-section">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Record Entry</h2>
            </div>

            <form onSubmit={handleSubmit} className="bg-zinc-900/20 border border-zinc-800 p-6 space-y-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'expense' ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  onClick={() => setType('expense')}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'income' ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  onClick={() => setType('income')}
                >
                  Income
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-xs font-medium text-zinc-400">Amount</label>
                  <input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="25.000"
                    value={formatCurrencyInput(amount)}
                    onChange={(e) => setAmount(digitsOnly(e.target.value))}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="category" className="text-xs font-medium text-zinc-400">Category</label>
                  <select 
                    id="category" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none transition-colors"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="method" className="text-xs font-medium text-zinc-400">Method</label>
                  <select 
                    id="method" 
                    value={method} 
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none transition-colors"
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="note" className="text-xs font-medium text-zinc-400">Note</label>
                  <input
                    id="note"
                    type="text"
                    placeholder="Coffee..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 text-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Add Entry'}
              </button>
            </form>
          </section>

          {/* History */}
          <section className="space-y-6 dash-section">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Recent Activity</h2>
              <span className="text-xs font-mono text-zinc-500">{summary.recentTransactions.length} entries</span>
            </div>

            {summary.recentTransactions.length === 0 ? (
              <div className="p-12 border border-zinc-800 text-center text-zinc-500 text-sm">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-900/50 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {summary.recentTransactions.map((tx: Transaction) => (
                      <tr key={tx.id} className="hover:bg-zinc-900/20 transition-colors group">
                        <td className="px-4 py-3 text-zinc-500">{fmtDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200">{tx.note}</div>
                          <div className="text-xs text-zinc-500">{tx.category}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{tx.method ?? '—'}</td>
                        <td className={`px-4 py-3 text-right font-mono ${tx.type === 'expense' ? 'text-zinc-100' : 'text-zinc-400'}`}>
                          {tx.type === 'expense' ? '-' : '+'}{fmt(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                            className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all px-2"
                            title="Delete"
                          >
                            {deletingId === tx.id ? '...' : '×'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Budgets & Goals */}
        <div className="lg:col-span-5 space-y-12">

          {/* Category Breakdown */}
          {Object.keys(summary.byCategory).length > 0 && (
            <section className="space-y-6 dash-section">
              <h2 className="text-xl font-medium tracking-tight">Spending</h2>
              <div className="border border-zinc-800 p-6 space-y-4">
                {Object.entries(summary.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => {
                    const pct = Math.min(100, Math.round((amount / summary.totalExpense) * 100));
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-300">{cat}</span>
                          <span className="text-zinc-400 font-mono">{fmt(amount)}</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-900 relative">
                          <div className="absolute top-0 left-0 h-full bg-zinc-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Budgets */}
          <section className="space-y-6 dash-section">
            <h2 className="text-xl font-medium tracking-tight">Budgets</h2>
            <div className="border border-zinc-800 p-6 space-y-6">
              <div className="space-y-4">
                {Object.entries(budgets).map(([cat, limit]) => {
                  const spent = summary.byCategory[cat] ?? 0;
                  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
                  const isOver = spent > limit;

                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-300">{cat}</span>
                        <span className={`font-mono ${isOver ? 'text-zinc-100' : 'text-zinc-500'}`}>
                          {fmt(spent)} / {fmt(limit)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-zinc-900 relative">
                        <div className={`absolute top-0 left-0 h-full ${isOver ? 'bg-zinc-300' : 'bg-zinc-600'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500 text-right pt-1">
                        {isOver ? `Over by ${fmt(spent - limit)}` : `${fmt(limit - spent)} left`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleBudgetSubmit} className="pt-4 border-t border-zinc-800/50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Category</label>
                    <select
                      value={budgetCategory}
                      onChange={(e) => handleBudgetCategoryChange(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Limit</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(budgetAmount)}
                      onChange={(e) => setBudgetAmount(digitsOnly(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isSavingBudget} className="w-full py-2 bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
                  {isSavingBudget ? 'Updating...' : 'Set Budget'}
                </button>
              </form>
            </div>
          </section>

          {/* Goal */}
          <section className="space-y-6 dash-section">
            <h2 className="text-xl font-medium tracking-tight">Goal</h2>
            <div className="border border-zinc-800 p-6 space-y-6">
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-medium text-zinc-200">{goal.name}</span>
                  <span className="text-sm font-mono text-zinc-400">{fmt(goal.current)} / {fmt(goal.target)}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 relative">
                  <div 
                    className="absolute top-0 left-0 h-full bg-zinc-100" 
                    style={{ width: `${goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0}%` }} 
                  />
                </div>
                <div className="text-xs text-zinc-500 text-right pt-1">
                  {goal.target > goal.current ? `${fmt(goal.target - goal.current)} remaining` : 'Goal reached!'}
                </div>
              </div>

              <form onSubmit={handleGoalSubmit} className="pt-4 border-t border-zinc-800/50 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Goal Name</label>
                  <input
                    type="text"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Current</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(goalCurrent)}
                      onChange={(e) => setGoalCurrent(digitsOnly(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Target</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(goalTarget)}
                      onChange={(e) => setGoalTarget(digitsOnly(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 outline-none"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isSavingGoal} className="w-full py-2 bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
                  {isSavingGoal ? 'Updating...' : 'Update Goal'}
                </button>
              </form>
            </div>
          </section>

        </div>
      </div>
      
    </div>
  );
}
