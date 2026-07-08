import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useSession, signUp } from '../lib/auth-client';
import { getSessionFn } from '../server/auth.fn';

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (session) throw redirect({ to: '/dashboard' });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { refetch } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  const startCooldown = (seconds: number) => {
    setRateLimitCooldown(seconds);
    const iv = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimitCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await signUp.email({ name, email, password });
      if (res.error) {
        const msg = res.error.message ?? '';
        if (res.error.status === 429 || msg.includes('Rate limit') || msg.includes('RATE_LIMIT')) {
          const match = msg.match(/(\d+) detik/);
          startCooldown(match ? parseInt(match[1], 10) : 3600);
          setError('Terlalu banyak percobaan pendaftaran. Coba lagi dalam 1 jam.');
        } else {
          setError(msg || 'Gagal mendaftar.');
        }
        return;
      }
      await refetch();
      navigate({ to: '/dashboard' });
    } catch (err: any) {
      setError(err?.message ?? 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link to="/" className="text-3xl font-medium tracking-tight">Lizzeyyoo</Link>
          <p className="text-sm text-zinc-500">Buat akun baru</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-zinc-900/40 border border-zinc-800 p-8">
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm focus:border-zinc-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm focus:border-zinc-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Kata Sandi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm focus:border-zinc-500 outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600">Minimal 8 karakter.</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || rateLimitCooldown > 0}
            className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 text-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
          >
            {rateLimitCooldown > 0 ? `Tunggu ${rateLimitCooldown}s...` : loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-zinc-300 hover:text-zinc-100 underline underline-offset-4">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}