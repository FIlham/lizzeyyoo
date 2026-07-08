# Lizzeyyoo — AI Financial Tracker (MVP)

> Catat keuangan harian lewat satu kolom teks dan konsultasikan kondisi finansialmu ke AI chatbot.

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Bun](https://bun.sh) v1.3+ (WAJIB, bukan Node.js) |
| **Framework** | [TanStack Start](https://tanstack.com/start) (full-stack React, SSR) |
| **Bundler** | [Vite](https://vite.dev) v6 |
| **Language** | TypeScript + React 19 |
| **Database** | PostgreSQL 16 via [Drizzle ORM](https://orm.drizzle.team) |
| **Cache** | Redis via [ioredis](https://github.com/redis/ioredis) |
| **Auth** | [Better Auth](https://better-auth.com) (email+password, cookie session) |
| **AI** | Google Gemini 2.5 Flash via [@tanstack/ai](https://tanstack.com/ai) |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — untuk Postgres & Redis
- [Bun](https://bun.sh) v1.3+

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Copy env template & isi variabel
cp .env.example .env
# Edit .env dengan credentials kamu (lihat bagian Environment Variables)

# 3. Start Postgres + Redis via Docker
docker compose up -d

# 4. Generate & apply migrasi database
bunx --bun drizzle-kit generate
bunx --bun drizzle-kit migrate

# 5. Development server (WAJIB pakai --bun flag)
bun --bun run dev
```

> ⚠️ **PENTING:** Selalu gunakan `bun --bun run dev`, BUKAN `bun run dev`. Tanpa flag `--bun`, child processes dijalankan oleh Node.js sehingga Bun-specific APIs tidak tersedia.

## Environment Variables

Buat file `.env` di root project:

```bash
# Postgres (sesuaikan dengan docker-compose.yml)
DATABASE_URL=postgresql://postgres:password123@localhost:5432/my_database

# Redis
REDIS_URL=redis://default:password123@localhost:6379

# Better Auth
BETTER_AUTH_SECRET=<random-string-min-32-chars>
BETTER_AUTH_URL=http://localhost:3000

# Google Gemini API Key
GEMINI_API_KEY=<your-gemini-api-key>
```

> 🔒 **JANGAN commit `.env`** — sudah ada di `.gitignore`.

## Project Structure

```
D:/Projects/lizzeyyoo/
├── .env                             # Environment variables (DO NOT COMMIT)
├── .gitignore                       # Git ignore rules
├── docker-compose.yml               # Postgres 16 + Redis Stack
├── drizzle.config.ts                # Drizzle Kit config
├── drizzle/                         # Auto-generated SQL migrations
│   └── 0000_peaceful_proteus.sql
├── package.json                     # Dependencies & scripts
├── vite.config.ts                   # Vite + TanStack Start plugin
├── tsconfig.json                    # TypeScript config
│
└── src/
    ├── global.css                   # Design system (dark mode, glassmorphism)
    ├── router.tsx                   # TanStack Router init
    ├── routeTree.gen.ts             # Auto-generated route tree (DO NOT EDIT)
    │
    ├── lib/
    │   └── auth-client.ts           # Better Auth React client (signIn, signUp, useSession)
    │
    ├── server/                      # Backend logic (server-only files marked *.server.ts)
    │   ├── schema.ts                # Drizzle table definitions — single source of truth
    │   ├── db.server.ts             # Drizzle instance (postgres-js connection)
    │   ├── redis.server.ts          # Redis client (ioredis)
    │   ├── cache.server.ts          # Cache helpers (cacheGetOrSet, cacheInvalidateUser)
    │   ├── ratelimit.server.ts      # Redis sliding window rate limiter (AI, auth, finance)
    │   ├── auth.ts                  # Better Auth instance + authHandlerWithRateLimit()
    │   ├── session.server.ts        # getAuthContext() — resolve userId from session
    │   ├── auth.fn.ts               # getSessionFn() — session check for route guards
    │   ├── finance.types.ts         # TypeScript interfaces (Transaction, Goal, etc.)
    │   ├── finance.service.ts       # Business logic — all queries userId-scoped via Drizzle
    │   └── finance.fn.ts            # createServerFn() RPC wrappers + rate-limit enforcement
    │
    ├── services/                    # AI integration
    │   └── ai.server.ts             # Gemini 2.5 Flash chatbot + 8 finance tools
    │
    └── routes/
        ├── __root.tsx               # Root layout (HTML shell + sticky navbar)
        ├── index.tsx                # Landing page (public)
        ├── login.tsx                # Login form (rate-limit 429 handling + countdown)
        ├── signup.tsx               # Signup form (rate-limit 429 handling + countdown)
        ├── dashboard.tsx            # Dashboard (protected — requires auth)
        ├── chat.tsx                 # AI Chatbot (protected, rate-limit progress bar UI)
        └── api/auth/$.tsx           # Better Auth handler — authHandlerWithRateLimit()
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
│                                                                  │
│   routes/index.tsx  routes/login.tsx  routes/dashboard.tsx  ... │
│         │                                   │                    │
│         └──────────── import ───────────────┘                   │
│                           │                                      │
│              server/finance.fn.ts  server/auth.fn.ts            │
│              (createServerFn RPCs)                               │
│                   │ (auto RPC bridge over HTTP)                  │
├───────────────────┼──────────────────────────────────────────────┤
│                   ▼              SERVER (Bun Runtime)            │
│                                                                  │
│         server/finance.fn.ts  server/auth.fn.ts                  │
│         (handler — calls getAuthContext first)                    │
│              │                                                   │
│         server/finance.service.ts                                │
│         (Drizzle queries, all userId-scoped)                     │
│              │                         │                         │
│         PostgreSQL (Drizzle)      Redis (ioredis)                │
│              │                         │                         │
│         schema.ts (tables)       cache.server.ts (TTL cache)     │
│                                                                  │
│   src/routes/api/auth/$.tsx → server/auth.ts (Better Auth)      │
│                                   │                              │
│                             PostgreSQL + Redis                   │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema (Postgres via Drizzle)

### Auth Tables (managed by Better Auth)
- `user` — id, name, email, emailVerified, createdAt
- `session` — id, token, userId (FK), expiresAt
- `account` — id, userId (FK), providerId, password
- `verification` — id, identifier, value, expiresAt

### Finance Tables (userId-scoped)
- `transactions` — id, userId (FK), date, type, amount, category, note, method, rawInput
- `budgets` — id, userId (FK), category, amount [UNIQUE per user+category]
- `goals` — id, userId (FK), name, target, current [UNIQUE per user]

Auto-seeding: Saat user baru mendaftar, Better Auth `databaseHooks.user.create.after` otomatis memasukkan default budgets (6 kategori) dan savings goal awal.

## Available Server Functions (RPC)

Semua didefinisikan di `src/server/finance.fn.ts`. Setiap call otomatis memvalidasi session via `getAuthContext()`.

| Function | Method | Description |
|---|---|---|
| `fetchTransactionsFn` | GET | Semua transaksi user (newest first) |
| `fetchRecentTransactionsFn` | GET | Transaksi dalam N hari terakhir |
| `createTransactionFn` | POST | Buat transaksi baru + invalidate cache |
| `deleteTransactionFn` | POST | Hapus transaksi by ID + invalidate cache |
| `fetchBudgetsFn` | GET | Budget limits per kategori (cached 5 menit) |
| `updateBudgetFn` | POST | Update budget kategori + invalidate cache |
| `fetchGoalFn` | GET | Savings goal (cached 5 menit) |
| `updateGoalFn` | POST | Update goal + invalidate cache |
| `fetchSummaryFn` | GET | 30-day summary — income/expense/balance/byCategory (cached 30 detik) |
| `sendChatMessageFn` | POST | Stream AI chat response |
| `clearChatSessionFn` | POST | Hapus server-side chat session memory |

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Multi-user auth (signup/login/logout) | ✅ Done | Better Auth + cookie session |
| Auto-seed budgets & goals saat signup | ✅ Done | Via databaseHooks |
| Manual transaction CRUD | ✅ Done | Form + table + delete |
| Summary cards (income/expense/balance) | ✅ Done | 30-day window, Redis cached |
| Category breakdown bars | ✅ Done | Percentage + amount |
| Budget limits per category | ✅ Done | Tampil di Dashboard, dapat di-update |
| Savings goal tracking | ✅ Done | Progress bar + update form |
| Smart Text Input (AI NL parser) | ✅ Done | Via AI Chatbot tools |
| AI Financial Insight Chatbot | ✅ Done | Route `/chat`, Gemini 2.5 Flash |
| Premium dark-mode UI | ✅ Done | Minimalist-industrial, GSAP animations |
| Data isolation per user | ✅ Done | Semua query WHERE userId |
| Redis cache invalidation | ✅ Done | Setelah setiap mutation |
| Rate-limiting (AI Chat) | ✅ Done | 10 msg/min + 60 msg/hr per user, Redis |
| Rate-limiting (Auth) | ✅ Done | 5 login/15min + 3 signup/hr per IP |
| Rate-limiting (Finance write) | ✅ Done | 30 ops/min per user |
| Production Dockerfile | ✅ Done | Multi-stage Alpine, non-root |
| Production Docker Compose | ✅ Done | 5 services: app+postgres+redis+nginx+certbot |
| Nginx + SSL (Let's Encrypt) | ✅ Done | Config siap, belum di-deploy |

## Critical Rules (MUST READ)

1. **Bun Runtime Required:** Always `bun --bun run dev`. Never `bun run dev`.
2. **File Naming Convention:**
   - `*.server.ts` → ONLY for pure server-side code (DB, Redis, secrets). **Cannot** be imported by routes.
   - `*.fn.ts` → For `createServerFn()` definitions. **Can** be imported by routes.
   - `*.types.ts` → Shared type definitions, importable anywhere.
3. **Auth Guard:** Every server function MUST call `getAuthContext()` to get userId before any DB operation.
4. **Cache Invalidation:** Every mutation MUST call `cacheInvalidateUser(userId)` after DB write.
5. **Rate-Limiting:** Write mutations & AI chat MUST call `checkRateLimit()` from `ratelimit.server.ts`. Auth endpoints handled by `authHandlerWithRateLimit()` in `auth.ts`.
6. **Production Hostname:** Di `.env.production`, database host = `db`, Redis host = `redis` (Docker service names, bukan `localhost`).
7. **CSS Import:** Use side-effect import (`import '../global.css'`).
8. **routeTree.gen.ts:** Auto-generated. Never edit manually.

---

## Todo Status

| # | Item | Status |
|---|------|--------|
| 1 | Route Better Auth handler `/api/auth/$` | ✅ Done |
| 2 | Generate & jalankan migrasi Drizzle | ✅ Done |
| 3 | Smoke test runtime dev server | ✅ Done |
| 4 | Verifikasi query finance userId-scoped | ✅ Done |
| 5 | Cache invalidation setelah mutation | ✅ Done |
| 6 | Sinkronkan doc dengan arsitektur baru | ✅ Done |
| 7 | Tambah `.gitignore` | ✅ Done |

---

## Troubleshooting

### Signup error: `null value in column "created_at" violates not-null constraint`

**Penyebab:** Tabel `budgets` atau `goals` dibuat dari migration lama tanpa `DEFAULT NOW()` di level kolom Postgres. Drizzle mengirim `DEFAULT` keyword yang tidak dikenali DB.

**Fix DB (jalankan sekali):**
```sql
-- Via docker exec
docker exec postgres_local psql -U postgres -d my_database -c "
  ALTER TABLE budgets     ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE budgets     ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE goals       ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE goals       ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT NOW();
"
```

Sudah di-fix juga di kode: `src/server/auth.ts` sekarang explicitly pass `createdAt: new Date()` saat seed budgets & goals.

### Dev server jalan di port 3001 bukan 3000

Normal — Rsbuild otomatis fallback ke port berikutnya jika 3000 sudah terpakai. Cek proses mana yang memakai port 3000 atau tutup proses tersebut sebelum `bun --bun run dev`.

---

## Changelog

### Sesi Terbaru — Rate-Limiting & Deployment

- **Rate-Limiting (Redis Sliding Window):**
  - Buat `src/server/ratelimit.server.ts` — generic rate limiter dengan `checkRateLimit()`, `RateLimitError`, dan pre-defined limit profiles.
  - AI Chat dibatasi 10 msg/menit + 60 msg/jam per user (protect free Gemini quota).
  - Finance write mutations dibatasi 30 ops/menit per user.
  - Auth sign-in dibatasi 5x/15 menit per IP; sign-up 3x/jam per IP via `authHandlerWithRateLimit()`.
  - Chat UI menampilkan progress bar msg/min dan countdown timer saat rate-limited.
  - Login & signup menampilkan pesan error 429 dengan countdown timer Bahasa Indonesia.

- **Deployment Production:**
  - `Dockerfile` multi-stage (builder Alpine → runner Alpine, non-root user).
  - `docker-compose.prod.yml` dengan 5 services dan health checks.
  - `nginx/` — reverse proxy + SSL termination + Nginx-level rate-limit + 120s timeout AI streaming.
  - Let's Encrypt via Certbot, auto-renew setiap 12 jam.
  - `.env.production.example` sebagai template secrets.

### Sesi Sebelumnya

- **UI Overhaul:** Peralihan penuh dari desain bercahaya (neon) ke estetika *minimalist-industrial* berbasis *Tailwind Zinc palette*.
- **GSAP Integration:** Animasi transisi dan *ScrollTrigger* di setiap halaman.
- **Improved Layouts:** Restrukturisasi seksi "About" dan "Connect" pada *landing page*.
- **Chat Scrolling Fix:** Area percakapan `/chat` mengulir hanya pada kontainernya. Nama agen kini "Lizzy".

