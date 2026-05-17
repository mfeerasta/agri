import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (entries) => {
          try {
            for (const { name, value, options } of entries) cookieStore.set(name, value, options);
          } catch {
            // Set in middleware response when invoked in a Server Component.
          }
        },
      },
    },
  );
}
