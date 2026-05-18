import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // no-op in marketing layout
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (user) {
    redirect('/app');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur sticky top-0 z-30">
        <nav className="max-w-[1200px] mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span
              aria-hidden
              className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] group-hover:scale-110 transition-transform"
            />
            <span className="text-[15px] tracking-wide font-semibold">Zameen</span>
            <span className="text-[12px] uppercase tracking-[0.18em] text-[var(--fg-muted)] hidden sm:inline">
              Rupafab Agri
            </span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/features" className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition">
              Features
            </Link>
            <Link href="/about" className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition">
              About
            </Link>
            <Link href="/api/docs" className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition hidden sm:inline">
              API
            </Link>
            <Link href="/contact" className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition hidden sm:inline">
              Contact
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition text-[var(--fg)]"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-[1200px] mx-auto px-5 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--fg-muted)]">
          <div className="space-y-1">
            <div className="text-[var(--fg)] text-sm font-medium">Zameen</div>
            <div>Rupafab Agri, Raiwind, Lahore</div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/features" className="hover:text-[var(--fg)]">Features</Link>
            <Link href="/about" className="hover:text-[var(--fg)]">About</Link>
            <Link href="/contact" className="hover:text-[var(--fg)]">Contact</Link>
            <Link href="/privacy" className="hover:text-[var(--fg)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--fg)]">Terms</Link>
            <Link href="/api/docs" className="hover:text-[var(--fg)]">API</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
