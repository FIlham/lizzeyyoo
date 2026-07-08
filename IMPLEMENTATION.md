# Implementation Notes — Lizzeyyoo

> Detail teknis implementasi untuk referensi developer/AI agent.

---

## 1. Keputusan Arsitektur & Alasannya

### Stack: TanStack Start + Rsbuild + Bun + Postgres + Redis + Better Auth

Proyek ini di-upgrade dari MVP single-user (`Bun.file()+db.json`) ke arsitektur multi-user full-stack:

| Layer | Teknologi | Alasan |
|---|---|---|
| **Runtime** | Bun v1.3+ | Native speed, Bun API, flag `--bun` wajib |
| **Framework** | TanStack Start | Full-stack React + SSR + server functions |
| **Bundler** | Rsbuild (Rspack-based) | Build speed, native TanStack plugin |
| **Database** | PostgreSQL via Drizzle ORM | Relational, multi-user, type-safe queries |
| **Cache** | Redis (ioredis) | TTL per-user cache untuk summary & budgets |
| **Auth** | Better Auth | Cookie session + Drizzle adapter + Redis secondary storage |
| **AI** | Gemini 2.5 Flash via @tanstack/ai | Function calling, streaming, bahasa Indonesia |

### Kenapa File `.fn.ts` untuk Server Functions?

TanStack Start v1.168+ memiliki `import-protection` plugin yang memblokir file `*.server.*` dari client bundle. Karena `createServerFn()` perlu diimpor di kedua sisi, file definisinya **tidak boleh** match pola `*.server.*`.

Konvensi `.fn.ts` dipilih karena:
- Tidak di-block oleh import-protection
- Mudah dibedakan dari `.service.ts` (pure logic) dan `.types.ts` (interfaces)

---

## 2. Detail Implementasi per File

### `src/server/schema.ts`

Single source of truth untuk semua tabel Drizzle. Berisi:
- **Auth tables**: `user`, `session`, `account`, `verification` (required by Better Auth)
- **Finance tables**: `transactions`, `budgets`, `goals` (semua userId-scoped via FK ke `user.id`)
- **`DEFAULT_BUDGETS`**: Seed values untuk user baru (Makanan, Transportasi, Hiburan, dll.)

Semua tabel finance punya constraint `userId` dengan `onDelete: 'cascade'`.

### `src/server/db.server.ts`

Drizzle instance via `postgres-js`. Export `db` dan `schema` untuk dipakai di service layer.

### `src/server/redis.server.ts`

`ioredis` client yang connect ke `REDIS_URL`. `lazyConnect: false` — koneksi dibuat saat startup.

### `src/server/cache.server.ts`

Helper cache di atas Redis:
- `cacheGetOrSet(key, ttlSec, fn)` — read-through cache
- `cacheInvalidateUser(userId)` — hapus semua key `u:${userId}:*` via KEYS scan

### `src/server/auth.ts`

Better Auth instance dengan:
- **Drizzle adapter** — persist user/session/account ke Postgres
- **Redis secondary storage** — session token lookup via Redis (performa)
- **`emailAndPassword`** — enabled, tanpa email verification untuk MVP
- **`databaseHooks.user.create.after`** — auto-seed budgets & goal untuk user baru

### `src/server/session.server.ts`

`getAuthContext()` — resolve `userId` dari Better Auth session header. Dipanggil di setiap server function handler. Throws `UNAUTHENTICATED` jika tidak ada session.

### `src/server/finance.service.ts`

Service layer dengan Drizzle queries, **semua userId-scoped**:

```
getAllTransactions(userId)       → SELECT WHERE userId
getRecentTransactions(userId, days) → SELECT WHERE userId AND date >= cutoff
addTransaction(userId, tx)       → INSERT + cacheInvalidateUser(userId)
deleteTransaction(userId, id)    → DELETE WHERE id AND userId + cacheInvalidateUser(userId)

getBudgets(userId)               → cacheGetOrSet(`u:${userId}:budgets`, 300s, ...)
updateBudget(userId, cat, amt)   → UPSERT + cacheInvalidateUser(userId)

getGoal(userId)                  → cacheGetOrSet(`u:${userId}:goal`, 300s, ...)
updateGoal(userId, updates)      → UPSERT + cacheInvalidateUser(userId)

getFinanceSummary(userId, days)  → cacheGetOrSet(`u:${userId}:summary:30d`, 30s, ...)
```

### `src/server/finance.fn.ts`

TanStack `createServerFn()` wrappers. Setiap handler memanggil `getAuthContext()` dulu untuk mendapatkan `userId`.

### `src/routes/api/auth/$.tsx`

Mount point Better Auth. Menerima semua request ke `/api/auth/*` dan meneruskan ke `auth.handler(request)`. Menggunakan `server.handlers.ANY` di TanStack route definition.

### `src/routes/index.tsx`

Landing page publik. Tidak memerlukan session.

### `src/routes/login.tsx` & `src/routes/signup.tsx`

Form auth dengan Better Auth React client. `beforeLoad` guard: jika sudah login, redirect ke `/dashboard`.

### `src/routes/dashboard.tsx`

Dashboard utama (protected). Loader mengambil summary, budgets, dan goal. Komponen menampilkan transaksi, form input, budget progress, savings goal.

### `src/routes/chat.tsx`

AI Chatbot page. Streaming response via `sendChatMessageFn`, localStorage cache, react-markdown rendering.

### `src/services/ai.server.ts`

LLM integration dengan Gemini 2.5 Flash. Semua 8 tools (listTransactions, addTransaction, etc.) meneruskan `userId` ke FinanceService — tidak ada cross-user data access.

---

## 3. Data Flow Diagrams

### Auth Flow

```
User fills signup form → signUp.email({ name, email, password })
  │
  ├─ [Client] Better Auth client → POST /api/auth/sign-up/email
  │
  ├─ [Server] auth.handler(request) → src/routes/api/auth/$.tsx
  │     ├─ Drizzle: INSERT user, account
  │     └─ databaseHooks.after: INSERT budgets (DEFAULT_BUDGETS) + goals (seed)
  │
  ├─ Session cookie set (7 days)
  │
  └─ navigate({ to: '/dashboard' })
```

### Create Transaction (Authenticated)

```
User fills form → clicks "Simpan"
  │
  ├─ [Client] createTransactionFn({ data: {...} })
  │     │
  │     ├─ [Server] getAuthContext() → userId dari cookie session
  │     │
  │     └─ FinanceService.addTransaction(userId, data)
  │           ├─ db.insert(transactions).values({ userId, ... }).returning()
  │           └─ cacheInvalidateUser(userId) → redis KEYS + DEL
  │
  ├─ router.invalidate() → re-run loader → fetchSummaryFn() → fresh data
  └─ Reset form
```

### Page Load (SSR)

```
Browser requests GET /dashboard
  │
  ├─ [Server] Route beforeLoad: getSessionFn() → check session
  │     └─ No session → redirect /login
  │
  ├─ [Server] Route loader: fetchSummaryFn() + fetchBudgetsFn() + fetchGoalFn()
  │     └─ cacheGetOrSet → Redis HIT or Postgres query
  │
  └─ [Client] React hydrates with loader data
```

---

## 4. AI Integration Points

Lokasi: `src/services/ai.server.ts` — importable dari `.fn.ts` handler (bukan dari routes langsung).

### TanStack AI & Gemini 2.5 Flash
SDK `@tanstack/ai` + adapter `@tanstack/ai-gemini`. Agent loop dengan max 5 iterasi + stop-on-finish.

### AI Function Calling (Tools) — userId-scoped
Semua 8 tools meneruskan `userId` (dari server function context) ke FinanceService:
1. `listTransactions(userId)` 
2. `addTransaction(userId, data)`
3. `deleteTransaction(userId, id)`
4. `getBudgets(userId)`
5. `updateBudget(userId, category, amount)`
6. `getGoal(userId)`
7. `updateGoal(userId, updates)`
8. `getFinanceSummary(userId, 30)`

### Caching & Memory Management
- **Client:** localStorage (`lizzeyyoo_chat_history`, `lizzeyyoo_chat_session_id`)
- **Server session memory:** `ChatMemoryManager` Map per sessionId (in-process, reset saat restart)

---

## 5. Known Limitations

1. **No pagination** — Semua transaksi 30 hari di-load sekaligus
2. **No offline support** — Butuh koneksi ke dev server
3. **Redis KEYS scan** — `cacheInvalidateUser` pakai `KEYS u:userId:*`; acceptable untuk low-traffic MVP, switch ke SCAN cursor untuk high-throughput
4. **Server session memory (chatMemory)** — Reset saat dev server restart; tidak persist cross-instance
5. **No email verification** — `requireEmailVerification: false` untuk kemudahan local dev

---

## 6. Catatan Build Fix (Sesi Ini)

- **Peer dep `@opentelemetry/api@1.9.1`** di-install untuk memenuhi kebutuhan `@better-auth/core`.
- **`rsbuild.config.ts`** pernah disentuh secara salah (menambahkan `server.externals`). Di-revert ke bentuk bersih.
- **Drizzle migration** berhasil di-generate (`drizzle/0000_peaceful_proteus.sql`). 7 tabel (account, budgets, goals, session, transactions, user, verification) berhasil di-apply ke Postgres.
- **Smoke test** berhasil: GET `http://localhost:3001/` → 200, `/login` → 200, `/signup` → 200. Tidak ada ECONNREFUSED ke Postgres/Redis di log.
- **Bug fix signup — `null value in column "created_at"` (PostgresError code 23502):**
  - **Root cause:** Tabel `budgets` dan `goals` dibuat dari migration lama yang tidak meng-apply `DEFAULT NOW()` di level kolom Postgres. Drizzle ORM mengirim `DEFAULT` keyword, tapi Postgres tidak memiliki default value → `null` → NOT NULL violation.
  - **Fix DB:** `ALTER TABLE budgets/goals/transactions ALTER COLUMN created_at SET DEFAULT NOW()` (juga `updated_at`).
  - **Fix kode di `src/server/auth.ts`:** Explicitly pass `createdAt: now, updatedAt: now` di insert values `databaseHooks.user.create.after` — tidak lagi mengandalkan `DEFAULT` Postgres.
  - **File yang diubah:** [`src/server/auth.ts`](src/server/auth.ts) baris seed budgets & goals.

---

## 7. Todo Status (Lintas Sesi)

> Semua todo selesai.

### 🔴 Prioritas Tinggi

- [x] **1. Buat route Better Auth handler `/api/auth/$`.**
  - ✅ `src/routes/api/auth/$.tsx` — `server.handlers.ANY: ({ request }) => auth.handler(request)`

- [x] **2. Generate & jalankan migrasi Drizzle.**
  - ✅ `drizzle/0000_peaceful_proteus.sql` di-generate. 7 tabel berhasil di-apply ke Postgres.

- [x] **3. Smoke test runtime dev server.**
  - ✅ `/` → 200, `/login` → 200, `/signup` → 200. Tidak ada ECONNREFUSED.

### 🟡 Prioritas Menengah

- [x] **4. Verifikasi semua query finance sudah `userId`-scoped.**
  - ✅ Semua Drizzle query + AI tools meneruskan dan menggunakan `userId`.

- [x] **5. Validasi cache invalidation (`cacheInvalidateUser`) dipanggil setelah mutation.**
  - ✅ Dipanggil di semua 4 mutation: `addTransaction`, `deleteTransaction`, `updateBudget`, `updateGoal`.

- [x] **6. Sinkronkan ketiga doc dengan arsitektur baru multi-user Postgres+Redis+Better Auth.**
  - ✅ AGENTS.md, IMPLEMENTATION.md, README.md sudah mencerminkan arsitektur baru.

### 🟢 Prioritas Rendah

- [x] **7. Tambah `.gitignore` sebelum `git init`.**
  - ✅ `.gitignore` berisi `node_modules/`, `.env`, `.dev-*.log`, `dist/`, dll.
