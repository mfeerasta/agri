import { describe, expect, it, beforeEach } from 'vitest';
import { assertSameOrigin, CsrfError } from '../csrf';

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://example.com/api/test', { method: 'POST', headers });
}

describe('assertSameOrigin', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_WEB_URL = 'https://agri.feerasta.ai';
    process.env.NEXT_PUBLIC_FIELD_URL = 'https://field.agri.feerasta.ai';
    process.env.NEXT_PUBLIC_OPS_URL = 'https://ops.agri.feerasta.ai';
    process.env.NEXT_PUBLIC_APPROVE_URL = 'https://approve.agri.feerasta.ai';
  });

  it('rejects requests with no Origin or Referer', () => {
    expect(() => assertSameOrigin(reqWith({}))).toThrow(CsrfError);
  });

  it('rejects requests from disallowed origins', () => {
    expect(() => assertSameOrigin(reqWith({ origin: 'https://evil.example' }))).toThrow(CsrfError);
  });

  it('accepts requests from allowed app URLs', () => {
    expect(() => assertSameOrigin(reqWith({ origin: 'https://agri.feerasta.ai' }))).not.toThrow();
    expect(() => assertSameOrigin(reqWith({ origin: 'https://field.agri.feerasta.ai' }))).not.toThrow();
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(() => assertSameOrigin(reqWith({ referer: 'https://approve.agri.feerasta.ai/queue' }))).not.toThrow();
  });
});
