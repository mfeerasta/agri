import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DemoRequestInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  organization: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
});

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  const limit = rateLimit(`demo-request:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = DemoRequestInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    db: { schema: 'zameen' },
  });

  const userAgent = req.headers.get('user-agent') ?? null;
  const insert = await supabase
    .from('demo_requests')
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      organization: parsed.data.organization ?? null,
      phone: parsed.data.phone ?? null,
      message: parsed.data.message ?? null,
      source: 'marketing-site',
      ip_address: ip,
      user_agent: userAgent,
      status: 'new',
    })
    .select('id')
    .single();

  if (insert.error) {
    return NextResponse.json({ error: 'Could not save request' }, { status: 500 });
  }

  // Notify MF via Resend. Failure here must not fail the request.
  void notifyMf(parsed.data, ip).catch(() => {
    // swallow: lead is already saved
  });

  return NextResponse.json({ ok: true, id: insert.data?.id ?? null }, { status: 201 });
}

interface NotifyInput {
  name: string;
  email: string;
  organization?: string | null;
  phone?: string | null;
  message?: string | null;
}

async function notifyMf(input: NotifyInput, ip: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ZAMEEN_DEMO_NOTIFY_TO ?? 'meerfeerasta@gmail.com';
  const from = process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>';
  if (!apiKey) return;
  const { Resend } = await import('resend');
  const client = new Resend(apiKey);
  const text = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Organization: ${input.organization ?? '-'}`,
    `Phone: ${input.phone ?? '-'}`,
    `Message: ${input.message ?? '-'}`,
    `IP: ${ip}`,
  ].join('\n');
  await client.emails.send({
    from,
    to,
    subject: `Zameen demo request from ${input.name}`,
    text,
  });
}
