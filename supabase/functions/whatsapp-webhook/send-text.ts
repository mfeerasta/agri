// Deno-side WhatsApp Cloud API text sender for inbound replies.
// Mirrors packages/shared/src/whatsapp.ts sendTextMessage, but uses
// Deno.env so it works inside the edge function runtime.

const GRAPH_VERSION = 'v20.0';

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = Deno.env.get('META_WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) {
    console.warn('META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID not set; reply suppressed');
    return;
  }
  const truncated = body.length > 1024 ? body.slice(0, 1021) + '...' : body;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: truncated, preview_url: false },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('whatsapp text send failed', res.status, errText);
  }
}

export function normalisePhone(input: string): string[] {
  // Returns plausible variants to search by, since users.phone may store
  // e.g. "03001234567" or "+923001234567".
  const digits = input.replace(/[^\d]/g, '');
  const variants = new Set<string>();
  variants.add(digits);
  variants.add('+' + digits);
  if (digits.startsWith('92')) {
    variants.add('0' + digits.slice(2));
    variants.add(digits.slice(2));
  }
  if (digits.startsWith('0')) {
    variants.add('92' + digits.slice(1));
    variants.add('+92' + digits.slice(1));
  }
  return Array.from(variants);
}
