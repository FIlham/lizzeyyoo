// src/services/ai.server.ts
import { chat, toolDefinition, combineStrategies, maxIterations, untilFinishReason } from '@tanstack/ai'
import { geminiText } from '@tanstack/ai-gemini'
import { createOpenRouterText } from '@tanstack/ai-openrouter'
import { z } from 'zod'
import * as FinanceService from '../server/finance.service'

export type AIProvider = 'gemini' | 'openrouter'

// --- Default models per provider ---
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'nvidia/nemotron-3-ultra-550b-a55b:free',
}

// --- Available OpenRouter models for UI ---
export const OPENROUTER_MODELS = [
  { name: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nvidia Nemotron Ultra 550B (Free)' },
  { name: 'google/gemma-4-31b-it:free', label: 'Google Gemma 4 31B (Free)' },
  { name: 'openai/gpt-oss-120b:free', label: 'OpenAI GPT OSS 120B (Free)' },
]

class ChatMemoryManager {
  private sessions = new Map<string, Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>()

  get(sessionId: string) {
    return this.sessions.get(sessionId) || []
  }

  set(sessionId: string, messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
    this.sessions.set(sessionId, messages)
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId)
  }
}

export const chatMemory = new ChatMemoryManager()

export async function* runAIChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  sessionId: string,
  userId: string,
  provider: AIProvider = 'gemini',
  model?: string,
) {
  const resolvedModel = model || DEFAULT_MODELS[provider]

  // --- Validate API keys ---
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      yield 'Error: API Key Gemini (GEMINI_API_KEY) belum dikonfigurasi di environment server.'
      return
    }
  } else if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      yield 'Error: OPENROUTER_API_KEY belum dikonfigurasi di environment server. Silakan tambahkan key di file .env.'
      return
    }
  }

  chatMemory.set(sessionId, messages)

  const tools = [
    toolDefinition({
      name: 'listTransactions',
      description: 'Mendapatkan daftar semua transaksi keuangan yang tercatat di database.',
      inputSchema: z.object({}),
    }).server(async () => await FinanceService.getAllTransactions(userId)),

    toolDefinition({
      name: 'addTransaction',
      description: 'Menambahkan transaksi pengeluaran (expense) atau pemasukan (income) baru ke database.',
      inputSchema: z.object({
        type: z.enum(['income', 'expense']).describe('Tipe transaksi: "income" untuk pemasukan, "expense" untuk pengeluaran'),
        amount: z.number().describe('Nominal uang dalam Rupiah'),
        category: z.string().describe('Kategori transaksi (contoh: Makanan, Transportasi, Hiburan, Belanja, Tagihan, Lainnya)'),
        note: z.string().describe('Keterangan atau catatan singkat tentang transaksi'),
        method: z.string().optional().describe('Metode pembayaran (contoh: Cash, Transfer, Debit, E-Wallet)'),
      }),
    }).server(async (data) => await FinanceService.addTransaction(userId, data)),

    toolDefinition({
      name: 'deleteTransaction',
      description: 'Menghapus suatu transaksi dari database berdasarkan ID.',
      inputSchema: z.object({
        id: z.string().describe('ID transaksi unik yang ingin dihapus'),
      }),
    }).server(async ({ id }) => await FinanceService.deleteTransaction(userId, id)),

    toolDefinition({
      name: 'getBudgets',
      description: 'Mendapatkan batas budget bulanan per kategori.',
      inputSchema: z.object({}),
    }).server(async () => await FinanceService.getBudgets(userId)),

    toolDefinition({
      name: 'updateBudget',
      description: 'Mengatur atau mengubah nominal batas budget bulanan untuk kategori tertentu.',
      inputSchema: z.object({
        category: z.string().describe('Kategori budget yang ingin diubah/dibuat'),
        amount: z.number().describe('Batas nominal budget bulanan dalam Rupiah'),
      }),
    }).server(async ({ category, amount }) => await FinanceService.updateBudget(userId, category, amount)),

    toolDefinition({
      name: 'getGoal',
      description: 'Mendapatkan data target tabungan/goals saat ini (nama target, nominal target, dan jumlah tabungan terkumpul).',
      inputSchema: z.object({}),
    }).server(async () => await FinanceService.getGoal(userId)),

    toolDefinition({
      name: 'updateGoal',
      description: 'Mengatur atau memperbarui data target tabungan (goal), seperti nama goal, nominal target, dan tabungan saat ini.',
      inputSchema: z.object({
        name: z.string().optional().describe('Nama goal baru (misal: "Beli Laptop", "Liburan")'),
        target: z.number().optional().describe('Nominal target tabungan dalam Rupiah'),
        current: z.number().optional().describe('Jumlah tabungan yang terkumpul saat ini dalam Rupiah'),
      }),
    }).server(async (data) => await FinanceService.updateGoal(userId, data)),

    toolDefinition({
      name: 'getFinanceSummary',
      description: 'Mendapatkan ringkasan statistik keuangan 30 hari terakhir termasuk total pemasukan, pengeluaran, saldo bersih, dan breakdown per kategori.',
      inputSchema: z.object({}),
    }).server(async () => await FinanceService.getFinanceSummary(userId, 30)),
  ]

  const SYSTEM_PROMPT = `
Kamu adalah Lizzy AI, asisten keuangan pribadi yang suportif, ramah, dan solutif.
Tugas utamanya adalah membantu pengguna mengelola keuangan secara natural dan memberikan insight yang relevan.

Panduan Perilaku:
1. Jawab selalu menggunakan Bahasa Indonesia yang ramah, sopan, dan bersahabat. Gunakan panggilan "kamu" untuk pengguna dan "aku" untuk dirimu.
2. Kamu bisa melakukan CRUD data keuangan (transaksi, budget, goal) menggunakan tools yang disediakan.
3. JANGAN berasumsi data. Jika pengguna bertanya tentang keuangannya, panggil tool yang relevan (misal: getFinanceSummary, getBudgets, getGoal) untuk mendapatkan data terbaru.
4. Ketika kamu berhasil memodifikasi data (menambah/menghapus transaksi, mengubah budget/goal), informasikan detail perubahan tersebut kepada pengguna dengan jelas.
5. AI hanya memberikan saran dan ringkasan (summary) ketika diminta oleh pengguna, tidak secara otomatis agar tidak membingungkan.
6. Kamu BISA dan HARUS mencatat beberapa transaksi sekaligus dalam satu permintaan jika pengguna memintanya. Panggil tool 'addTransaction' beberapa kali secara berurutan atau paralel untuk memproses semua transaksi yang diberikan pengguna.
`

  console.log({ provider, resolvedModel })

  // --- Select adapter based on provider ---
  const adapter = provider === 'openrouter'
    ? createOpenRouterText(resolvedModel, process.env.OPENROUTER_API_KEY!, {
      appTitle: 'Lizzeyyoo AI Financial Tracker',
      httpReferer: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    })
    : geminiText(resolvedModel)

  try {
    const stream = chat({
      adapter,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      tools,
      agentLoopStrategy: combineStrategies([
        maxIterations(5),
        untilFinishReason(['stop']),
      ]),
    })

    let fullResponse = ''
    for await (const chunk of stream) {
      if (chunk.type === 'TEXT_MESSAGE_CONTENT') {
        fullResponse += chunk.delta
        yield chunk.delta
      }
    }

    chatMemory.set(sessionId, [
      ...messages,
      { role: 'assistant' as const, content: fullResponse },
    ])
  } catch (error: any) {
    console.error(`[${provider}/${resolvedModel}] Chat Stream Error:`, error)
    yield `Error: Terjadi kesalahan saat memproses chat AI dengan provider ${provider}. (${error?.message || error})`
  }
}