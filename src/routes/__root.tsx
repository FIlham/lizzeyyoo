import type { ReactNode } from 'react'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import { useSession, signOut } from '../lib/auth-client'
import '../global.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Lizzeyyoo – AI Financial Tracker' },
      { name: 'description', content: 'Catat keuangan dengan cepat dan tanya kondisi keuanganmu ke AI.' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const location = useLocation()
  const router = useRouter()
  const isLandingPage = location.pathname === '/'
  const navRef = useRef<HTMLElement>(null);
  const { data: session, isPending } = useSession()

  gsap.registerPlugin(useGSAP);

  useGSAP(() => {
    if (!isLandingPage && navRef.current) {
      gsap.from(navRef.current, {
        y: -100,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      });
    }
  }, [isLandingPage]);

  const handleSignOut = async () => {
    await signOut()
    router.invalidate()
    router.navigate({ to: '/' })
  }

  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body className="bg-zinc-950 text-zinc-100 font-sans min-h-screen selection:bg-zinc-700">
        {!isLandingPage && (
          <nav ref={navRef} className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
            <Link to="/" className="text-xl font-medium tracking-tight text-zinc-100 hover:text-zinc-300 transition-colors">
              Lizzeyyoo
            </Link>
            <div className="flex items-center gap-8">
              <Link
                to="/dashboard"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                activeProps={{ className: 'text-zinc-100 font-medium' }}
              >
                Dashboard
              </Link>
              <Link
                to="/chat"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                activeProps={{ className: 'text-zinc-100 font-medium' }}
              >
                AI Chat
              </Link>
              {session ? (
                <>
                  <span className="text-xs text-zinc-600 hidden sm:inline">{session.user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                !isPending && (
                  <Link to="/login" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                    Login
                  </Link>
                )
              )}
            </div>
          </nav>
        )}
        {children}
        <Scripts />
      </body>
    </html>
  )
}
