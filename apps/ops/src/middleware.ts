import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyOpsSecurityHeaders } from './lib/security-headers';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
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
    return applyOpsSecurityHeaders(NextResponse.redirect(url));
  }
  return applyOpsSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
};
