# Agent Instructions — Lizzeyyoo Project

> Dokumen ini adalah konteks wajib bagi AI agent yang bekerja di codebase ini.
> Baca seluruhnya sebelum melakukan perubahan apapun.

## Identity

Proyek ini bernama **Lizzeyyoo** — AI Financial Tracker MVP.
Stack: **TanStack Start + Vite + Bun + Postgres + Redis + Better Auth**
Bahasa utama pengguna: **Bahasa Indonesia**.

---

## ⛔ Pitfall & Gotchas (CRITICAL)

### 1. Bun Runtime — WAJIB flag `--bun`

```bash
# ✅ BENAR
bun --bun run dev

# ❌ SALAH — akan fallback ke Node.js, semua Bun API crash
bun run dev
```

Alasan: `bun run dev` menjalankan script `vite dev` menggunakan Node.js sebagai child process. Flag `--bun` memaksa Bun sebagai runtime untuk semua child process.

### 2. File Naming Convention — `import-protection`

TanStack Start memiliki fitur `import-protection` yang **memblokir** file dengan pola `*.server.*` dari diimpor oleh client bundle.

| Pattern | Boleh diimpor dari route? | Digunakan untuk |
|---|---|---|
| `*.server.ts` | ❌ **TIDAK** — akan di-block | Pure server logic (DB queries, Redis, secrets) |
| `*.fn.ts` | ✅ **YA** | `createServerFn()` definitions (TanStack auto-generates RPC stub) |
| `*.types.ts` | ✅ **YA** | Shared TypeScript interfaces |

**Aturan tegas:**
- `createServerFn()` HARUS didefinisikan di file **non-`.server.*`** (kita pakai `.fn.ts`).
- File `.fn.ts` boleh meng-import dari `.server.ts` (karena `.fn.ts` handler hanya dieksekusi di server).
- Route files (`src/routes/*.tsx`) hanya boleh import dari `.fn.ts` dan `.types.ts`.

**Chain import yang benar:**
```
routes/*.tsx → server/finance.fn.ts → server/finance.service.ts (*.server.ts) → Postgres via Drizzle
     (client+server)    (client+server)       (server only)
```

### 3. CSS Import di Vite

```tsx
// ✅ BENAR — side-effect import
import '../global.css'
```

### 4. Peer Deps yang Sering Hilang

`@better-auth/core` membutuhkan peer dep `@opentelemetry/api@^1.9.0`. Jika build melempar error "Cannot find module '@opentelemetry/api'", jalankan `bun add @opentelemetry/api`. Sudah di-install (v1.9.1).

### 5. Vite Configuration

Gunakan `vite.config.ts` untuk mengonfigurasi plugins TanStack Start, React, dan Tailwind CSS v4.

### 6. routeTree.gen.ts

File `src/routeTree.gen.ts` di-generate otomatis oleh TanStack Start saat dev server berjalan. **Jangan edit manual.** Jika kamu menambah/menghapus file di `src/routes/`, restart dev server agar file ini di-regenerate.

### 7. Better Auth Handler Route

File `src/routes/api/auth/$.tsx` adalah mount point untuk Better Auth. Route ini menggunakan `server.handlers.ANY` untuk meneruskan semua request ke `auth.handler`. **Jangan hapus atau modifikasi ini.**

### 8. Drizzle `defaultNow()` vs Postgres Column DEFAULT

Drizzle schema yang mendefinisikan `.defaultNow()` **tidak otomatis** menambahkan `DEFAULT NOW()` di level kolom Postgres jika migration lama dijalankan sebelum kolom itu ditambahkan. Jika tabel dibuat dari migration lama, kolom `created_at`/`updated_at` bisa tidak memiliki default DB.

**Gejala:** `PostgresError: null value in column "created_at" violates not-null constraint` saat insert.

**Fix:** Dua lapisan perlindungan:
1. Alter tabel secara manual:
   ```sql
   ALTER TABLE budgets ALTER COLUMN created_at SET DEFAULT NOW();
   ALTER TABLE budgets ALTER COLUMN updated_at SET DEFAULT NOW();
   ALTER TABLE goals   ALTER COLUMN created_at SET DEFAULT NOW();
   ALTER TABLE goals   ALTER COLUMN updated_at SET DEFAULT NOW();
   ```
2. **Selalu pass timestamp eksplisit** di insert values — jangan andalkan `DEFAULT`:
   ```ts
   const now = new Date();
   db.insert(schema.budgets).values({ ..., createdAt: now, updatedAt: now })
   ```

---

## Arsitektur Layer

```
Layer 1: Routes (src/routes/)
  ├─ UI components + React hooks
  ├─ Route loaders (SSR data fetching via createServerFn)
  └─ Imports: *.fn.ts, *.types.ts

Layer 2: Server Functions (src/server/finance.fn.ts, auth.fn.ts)
  ├─ createServerFn() definitions
  ├─ getAuthContext() → userId dari Better Auth session
  └─ Imports: *.service.ts, *.server.ts

Layer 3: Service (src/server/finance.service.ts)
  ├─ Drizzle ORM queries ke Postgres
  ├─ Redis cache via cache.server.ts
  ├─ Business logic — semua query userId-scoped
  └─ Imports: finance.types.ts, db.server.ts, cache.server.ts

Layer 4: Infrastructure (src/server/*.server.ts)
  ├─ db.server.ts — Drizzle + postgres-js connection
  ├─ redis.server.ts — ioredis client
  ├─ cache.server.ts — cacheGetOrSet + cacheInvalidateUser
  └─ session.server.ts — getAuthContext() via Better Auth

Layer 5: Schema & Types
  ├─ src/server/schema.ts — Drizzle table definitions (single source of truth)
  └─ src/server/finance.types.ts — TypeScript interfaces untuk routes

Layer 6: Auth
  ├─ src/server/auth.ts — Better Auth instance (Drizzle adapter + Redis secondary storage)
  └─ src/lib/auth-client.ts — Better Auth React client
```

---

## Konvensi Kode

1. **Server functions** — Selalu buat di `finance.fn.ts` dengan pola:
   ```ts
   export const myFn = createServerFn({ method: 'POST' })
     .validator((data: MyType) => data)
     .handler(async ({ data }) => {
       const { userId } = await getAuthContext(); // WAJIB
       return await MyService.doSomething(userId, data);
     });
   ```

2. **Memanggil server function dari route** — Dua cara:
   ```tsx
   // Di loader (SSR)
   loader: async () => {
     const data = await myFn();
     return { data };
   }

   // Di component (client-side call)
   const result = await myFn({ data: payload });
   router.invalidate(); // refresh loader data
   ```

3. **Menambah endpoint baru:**
   - Tambah fungsi di `finance.service.ts` (logic, userId-scoped)
   - Tambah `createServerFn` di `finance.fn.ts` (RPC, panggil getAuthContext)
   - Import dan panggil dari route

4. **Menambah route baru:**
   - Buat file di `src/routes/nama-route.tsx`
   - Gunakan `createFileRoute('/nama-route')({...})`
   - Restart dev server agar `routeTree.gen.ts` terupdate

---

## Environment Variables (Wajib di `.env`)

```
DATABASE_URL=postgresql://postgres:password123@localhost:5432/my_database
REDIS_URL=redis://default:password123@localhost:6379
BETTER_AUTH_SECRET=<random-secret-min-32-chars>
BETTER_AUTH_URL=http://localhost:3000
GEMINI_API_KEY=<google-gemini-api-key>
```

## Setup Infrastruktur

```bash
# 1. Start Postgres + Redis via Docker
docker compose up -d

# 2. Generate SQL migration dari schema.ts
bunx --bun drizzle-kit generate

# 3. Apply migration ke database
bunx --bun drizzle-kit migrate

# 4. Jalankan dev server (WAJIB --bun flag)
bun --bun run dev
```

---

## Fitur yang Telah Diimplementasikan

### Auth (Better Auth + Drizzle + Redis)
- **Status:** ✅ Lengkap
- Route handler: `src/routes/api/auth/$.tsx` — meneruskan semua `/api/auth/*` ke `auth.handler`
- Signup → auto-seed default budgets + goals via `databaseHooks.user.create.after`
- Session disimpan di Redis (TTL 7 hari), cookie cache 5 menit untuk performa
- Guard route via `getSessionFn()` di `beforeLoad`

### Fitur 1 & 3: Smart Text Input & Financial Insight Chatbot
- **Status:** ✅ Sudah diimplementasikan secara penuh.
- **Implementasi:** Menggunakan `@tanstack/ai` dan `@tanstack/ai-gemini` (`gemini-2.5-flash`).
- **Aliran Kerja:** Chatbot interaktif di `/chat` dibekali tools server-side (CRUD transaksi, budget, goal, summary) untuk membaca dan memperbarui data keuangan pengguna secara realtime.
- **Caching & Caching Persistensi:**
  - Client menggunakan `localStorage` untuk menyimpan riwayat chat (`lizzeyyoo_chat_history`) dan `sessionId`.
  - Server menggunakan Map object `chatMemory` di `ai.server.ts` per session ID.
- **Format Rendering:** Markdown terformat dengan `react-markdown` dan `remark-gfm`.

### Fitur 2: Budget & Goals UI
- **Status:** ✅ Sudah diimplementasikan di `src/routes/dashboard.tsx`.
- Dashboard loader mengambil `summary`, `budgets`, dan `goal` sekaligus.
- Budget progress dan savings goal tampil di dashboard.

### Multi-User & Data Isolation
- **Status:** ✅ Lengkap
- Setiap query Drizzle menggunakan `where eq(schema.X.userId, userId)`.
- AI tools di `ai.server.ts` meneruskan `userId` ke semua FinanceService calls.
- `cacheInvalidateUser(userId)` dipanggil setelah setiap mutation.

---

## Environment

- **OS:** Windows
- **Package Manager:** Bun v1.3+
- **Port:** localhost:3000 (fallback ke 3001 jika port sedang dipakai)
- **Database:** PostgreSQL 16 (Docker container `postgres_local`)
- **Cache:** Redis via redis-stack (Docker container `redis_upstash_local`)

---

## Todo Status (Lintas Sesi)

> Tandai `[x]` saat selesai.

### 🔴 Prioritas Tinggi

- [x] **1. Buat route Better Auth handler `/api/auth/$`.**
  - ✅ Selesai: `src/routes/api/auth/$.tsx` sudah ada dan meneruskan request ke `auth.handler`.

- [x] **2. Generate & jalankan migrasi Drizzle.**
  - ✅ Selesai: `bunx --bun drizzle-kit generate` → `drizzle/0000_peaceful_proteus.sql`. Semua 7 tabel ada di DB (account, budgets, goals, session, transactions, user, verification).

- [x] **3. Smoke test runtime dev server.**
  - ✅ Selesai: Dev server boot tanpa ECONNREFUSED. Route `/` → 200, `/login` & `/signup` render form.

### 🟡 Prioritas Menengah

- [x] **4. Verifikasi semua query finance sudah `userId`-scoped.**
  - ✅ Selesai: `finance.service.ts` — semua fungsi terima `userId` parameter, semua query Drizzle `where eq(schema.X.userId, userId)`. AI tools di `ai.server.ts` meneruskan `userId` ke FinanceService.

- [x] **5. Validasi cache invalidation (`cacheInvalidateUser`) dipanggil setelah mutation.**
  - ✅ Selesai: `addTransaction`, `deleteTransaction`, `updateBudget`, `updateGoal` — semua memanggil `cacheInvalidateUser(userId)`.

- [x] **6. Sinkronkan ketiga doc dengan arsitektur baru multi-user Postgres+Redis+Better Auth.**
  - ✅ Selesai: AGENTS.md, IMPLEMENTATION.md, README.md sudah diupdate.

### 🟢 Prioritas Rendah

- [x] **7. Tambah `.gitignore` sebelum `git init`.**
  - ✅ Selesai: `.gitignore` berisi `node_modules/`, `.env`, `.dev-*.log`, `dist/`, dll.

### 🔵 Redesign UI & GSAP Animation (Sesi Terbaru)
- **Status:** ✅ Selesai
- **Desain:** Mengubah tema "cyberpunk glow" menjadi *minimalist-industrial* dengan palet zinc neutral.
- **Animasi:** Integrasi `@gsap/react` dan `gsap` untuk animasi masuk dan `ScrollTrigger` di semua halaman (`__root.tsx`, `index.tsx`, `dashboard.tsx`, `chat.tsx`).
- **Tata Letak:** Perbaikan layout di landing page (About 2-kolom, Connect bergaya *Bento Grid*) dan perbaikan scrolling di `/chat` agar *sidebar* tetap *fixed*.
- **Identitas AI:** Diperbarui menjadi "Lizzy".
