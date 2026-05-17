import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders } from './lib/security-headers';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries) => {
          entries.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  if (!data.user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    return applySecurityHeaders(redirect, 'web');
  }

  // Fire-and-forget page-view tracking. Never block the response.
  const path = request.nextUrl.pathname;
  if (
    data.user &&
    !path.startsWith('/api/') &&
    !path.startsWith('/admin/analytics') &&
    !path.startsWith('/_next')
  ) {
    const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    void trackPageView({
      userId: data.user.id,
      entityId: (meta.default_entity_id as string) ?? null,
      path,
      userAgent: request.headers.get('user-agent') ?? null,
    });
  }

  return applySecurityHeaders(response, 'web');
}

interface TrackPageViewInput {
  userId: string;
  entityId: string | null;
  path: string;
  userAgent: string | null;
}

async function trackPageView(input: TrackPageViewInput): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  try {
    await fetch(`${url}/rest/v1/platform_events`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
        'Content-Profile': 'zameen',
      },
      body: JSON.stringify({
        event_name: 'page_view',
        event_props: { path: input.path },
        user_id: input.userId,
        entity_id: input.entityId,
        user_agent: input.userAgent,
      }),
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    // never block
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
};
