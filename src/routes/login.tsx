import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useSession, signIn } from '../lib/auth-client';
import { getSessionFn } from '../server/auth.fn';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (session) throw redirect({ to: '/dashboard' });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { refetch } = useSession();
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
      const res = await signIn.email({ email, password });
      if (res.error) {
        // Check for rate limit in the error response
        const msg = res.error.message ?? '';
        if (res.error.status === 429 || msg.includes('Rate limit') || msg.includes('RATE_LIMIT')) {
          const match = msg.match(/(\d+) detik/);
          startCooldown(match ? parseInt(match[1], 10) : 900);
          setError('Terlalu banyak percobaan login. Tunggu sebentar sebelum mencoba lagi.');
        } else {
          setError(msg || 'Gagal masuk. Periksa email & kata sandi.');
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
          <p className="text-sm text-zinc-500">Masuk ke akunmu</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-zinc-900/40 border border-zinc-800 p-8">
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
              autoComplete="current-password"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm focus:border-zinc-500 outline-none transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || rateLimitCooldown > 0}
            className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 text-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
          >
            {rateLimitCooldown > 0 ? `Tunggu ${rateLimitCooldown}s...` : loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Belum punya akun?{' '}
          <Link to="/signup" className="text-zinc-300 hover:text-zinc-100 underline underline-offset-4">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}