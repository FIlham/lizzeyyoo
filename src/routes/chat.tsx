// src/routes/chat.tsx
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchSummaryFn, sendChatMessageFn, clearChatSessionFn } from '../server/finance.fn';
import { getSessionFn } from '../server/auth.fn';

type AIProvider = 'gemini' | 'openrouter'

const GEMINI_MODELS = [
  { name: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { name: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { name: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
]

const OPENROUTER_MODELS = [
  { name: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nvidia Nemotron Ultra 550B (Free)' },
  { name: 'google/gemma-4-31b-it:free', label: 'Google Gemma 4 31B (Free)' },
  { name: 'openai/gpt-oss-120b:free', label: 'OpenAI GPT OSS 120B (Free)' },
]

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: '/login' });
    return { session };
  },
  loader: async () => {
    const summary = await fetchSummaryFn();
    return { summary };
  },
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'Berapa pengeluaran saya 30 hari terakhir?',
  'Catat pengeluaran makan bakso 25 ribu pakai cash',
  'Tolong buat ringkasan kondisi keuangan saya saat ini',
  'Set target tabungan Beli Laptop sebesar 6 juta',
  'Berapa sisa budget bulanan Makanan saya?',
];

function ChatPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { summary } = Route.useLoaderData();

  gsap.registerPlugin(useGSAP);

  useGSAP(() => {
    const tl = gsap.timeline();

    tl.from('.chat-header', {
      y: -20,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out'
    });

    tl.from('.chat-sidebar', {
      x: -30,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out'
    }, '-=0.4');

    tl.from('.chat-main', {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.2');

  }, { scope: containerRef });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Halo! Aku Lizzy, asisten keuangan pribadimu. Ada yang bisa aku bantu hari ini?',
    },
  ]);
  const [sessionId, setSessionId] = useState('default-session');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

  // Rate limit tracking — mirrors server-side AI_CHAT_LIMITS (10/min, 60/hr)
  const [msgCountMin, setMsgCountMin] = useState(0);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0); // seconds remaining
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MSG_LIMIT_PER_MIN = 10;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let sid = localStorage.getItem('lizzeyyoo_chat_session_id');
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem('lizzeyyoo_chat_session_id', sid);
      }
      setSessionId(sid);

      const saved = localStorage.getItem('lizzeyyoo_chat_history');
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {
          console.error('Error parsing chat history:', e);
        }
      }

      const savedProvider = localStorage.getItem('lizzeyyoo_ai_provider') as AIProvider | null;
      const savedModel = localStorage.getItem('lizzeyyoo_ai_model');
      if (savedProvider) setSelectedProvider(savedProvider);
      if (savedModel) setSelectedModel(savedModel);

      setIsHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isHistoryLoaded && typeof window !== 'undefined') {
      localStorage.setItem('lizzeyyoo_chat_history', JSON.stringify(messages));
    }
  }, [messages, isHistoryLoaded]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Start a visual countdown when rate-limited
  const startCooldown = (seconds: number) => {
    setRateLimitCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          setMsgCountMin(0); // reset local counter after cooldown
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending || rateLimitCooldown > 0) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    setMsgCountMin((prev) => prev + 1);

    const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const formattedHistory = [...messages, userMessage].map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const stream = await sendChatMessageFn({
        data: {
          messages: formattedHistory,
          sessionId,
          provider: selectedProvider,
          model: selectedModel,
        },
      });

      let accumulated = '';
      for await (const chunk of stream) {
        accumulated += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          }
          return updated;
        });
      }

      // Detect rate limit response from server (yields ⚠️ Rate Limit: ... prefix)
      if (accumulated.startsWith('⚠️ **Rate Limit**')) {
        // Extract retry-after from message: "... coba lagi dalam X detik."
        const match = accumulated.match(/(\d+) detik/);
        const retryAfter = match ? parseInt(match[1], 10) : 60;
        startCooldown(retryAfter);
      }

      if (!accumulated.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              role: 'assistant',
              content: 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.',
            };
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error in chat request:', error);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.',
          };
        }
        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleClearChat = async () => {
    const defaultWelcome: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Chat telah dibersihkan. Bagaimana aku bisa membantumu mengelola keuangan lagi?',
      },
    ];
    setMessages(defaultWelcome);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lizzeyyoo_chat_history', JSON.stringify(defaultWelcome));
    }
    try {
      await clearChatSessionFn({ data: { sessionId } });
    } catch (e) { }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  return (
    <div ref={containerRef} className="w-full py-8 max-w-6xl mx-auto px-6 text-zinc-100 font-sans flex flex-col">
      <header className="space-y-1 mb-6 chat-header shrink-0">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">AI Interface</div>
        <h1 className="text-3xl font-semibold tracking-tight">Financial Insight</h1>
        <p className="text-sm text-zinc-400">Consult your data. Speak naturally.</p>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
        {/* Sidebar */}
        <aside className="lg:col-span-4 flex flex-col gap-6 chat-sidebar h-full">
          <div className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-6">
            <h3 className="text-sm font-medium tracking-tight border-b border-zinc-800 pb-2">Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500">Balance</span>
                <span className="text-lg font-mono text-zinc-200">{fmt(summary.balance)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500">Expenses (30d)</span>
                <span className="text-lg font-mono text-zinc-400">{fmt(summary.totalExpense)}</span>
              </div>
            </div>
          </div>

          {/* Model Selector */}
          <div className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-4">
            <h3 className="text-sm font-medium tracking-tight border-b border-zinc-800 pb-2">AI Model</h3>

            {/* Provider Toggle */}
            <div className="flex gap-1 bg-zinc-950 p-1">
              {(['gemini', 'openrouter'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelectedProvider(p);
                    const defaultModel = p === 'gemini' ? 'gemini-2.5-flash' : 'nvidia/nemotron-3-ultra-550b-a55b:free';
                    setSelectedModel(defaultModel);
                    localStorage.setItem('lizzeyyoo_ai_provider', p);
                    localStorage.setItem('lizzeyyoo_ai_model', defaultModel);
                  }}
                  className={`flex-1 text-xs py-1.5 font-mono transition-colors ${selectedProvider === p
                      ? 'bg-zinc-200 text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                  {p === 'gemini' ? 'Gemini' : 'OpenRouter'}
                </button>
              ))}
            </div>

            {/* Model select */}
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                localStorage.setItem('lizzeyyoo_ai_model', e.target.value);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-3 py-2 focus:outline-none focus:border-zinc-600 transition-colors"
            >
              {(selectedProvider === 'gemini' ? GEMINI_MODELS : OPENROUTER_MODELS).map((m) => (
                <option key={m.name} value={m.name}>{m.label}</option>
              ))}
            </select>

            <p className="text-xs text-zinc-600 font-mono">
              {selectedProvider === 'openrouter' ? 'via OpenRouter API' : 'via Google AI Studio'}
            </p>

            {/* Rate limit indicator */}
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 font-mono">Msg / min</span>
                <span className={`text-xs font-mono tabular-nums ${
                  msgCountMin >= MSG_LIMIT_PER_MIN ? 'text-red-400' :
                  msgCountMin >= MSG_LIMIT_PER_MIN * 0.7 ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {msgCountMin} / {MSG_LIMIT_PER_MIN}
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-0.5">
                <div
                  className={`h-0.5 transition-all duration-300 ${
                    msgCountMin >= MSG_LIMIT_PER_MIN ? 'bg-red-500' :
                    msgCountMin >= MSG_LIMIT_PER_MIN * 0.7 ? 'bg-amber-500' : 'bg-zinc-400'
                  }`}
                  style={{ width: `${Math.min((msgCountMin / MSG_LIMIT_PER_MIN) * 100, 100)}%` }}
                />
              </div>
              {rateLimitCooldown > 0 && (
                <p className="text-xs text-red-400 font-mono">
                  ⏳ Cooldown: {rateLimitCooldown}s
                </p>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-4">
            <h3 className="text-sm font-medium tracking-tight border-b border-zinc-800 pb-2">Examples</h3>
            <ul className="text-sm text-zinc-400 space-y-3 font-light">
              <li>"Catat jajan kopi 30 ribu debit"</li>
              <li>"Berapa total pemasukan saya bulan ini?"</li>
              <li>"Set budget Makanan jadi 2 juta"</li>
              <li>"Set goal tabungan laptop baru 8 juta"</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 mt-auto">
            <button
              onClick={handleClearChat}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2 text-left"
            >
              Reset Conversation
            </button>
            <Link to="/dashboard" className="w-full text-center py-3 bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="lg:col-span-8 flex flex-col border border-zinc-800 bg-zinc-900/20 chat-main h-[calc(100vh-160px)] min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-none overflow-hidden flex-shrink-0 border border-zinc-700">
                    <img src="/lizzy/10.jpg" alt="AI Avatar" className="w-full h-full object-cover grayscale" />
                  </div>
                )}
                <div
                  className={`p-4 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-zinc-200 text-zinc-900 font-medium'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                    }`}
                >
                  {msg.content === '' && isSending && index === messages.length - 1 ? (
                    <span className="text-zinc-500 flex items-center gap-1 h-5">
                      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    <div className="markdown-content [&_p]:mb-3 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-zinc-100 [&_table]:w-full [&_table]:mb-3 [&_th]:border-b [&_th]:border-zinc-700 [&_th]:pb-2 [&_th]:text-left [&_td]:py-2 [&_td]:border-b [&_td]:border-zinc-800/50">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />

            {messages.length <= 1 && (
              <div className="pt-8">
                <p className="text-xs font-mono text-zinc-500 mb-4 uppercase">Suggested queries</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      className="text-xs border border-zinc-700 bg-zinc-900 text-zinc-400 px-3 py-2 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                      onClick={() => handleSend(prompt)}
                      disabled={isSending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="border-t border-zinc-800 bg-zinc-950 p-4 flex gap-4">
            <input
              type="text"
              placeholder="Ask anything or record a transaction..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              required
              className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm focus:border-zinc-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim() || rateLimitCooldown > 0}
              className="bg-zinc-100 text-zinc-950 font-medium px-8 text-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
            >
              {rateLimitCooldown > 0 ? `${rateLimitCooldown}s` : isSending ? '...' : 'Send'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
