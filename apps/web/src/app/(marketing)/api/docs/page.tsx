import type { Metadata } from 'next';
import { SwaggerUi } from './swagger-ui';

export const metadata: Metadata = {
  title: 'API · Zameen',
  description: 'OpenAPI documentation for the Zameen platform.',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-[80vh]">
      <div className="max-w-[1100px] mx-auto px-5 pt-12 pb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">
          API
        </div>
        <h1 className="font-serif text-4xl tracking-tight">API documentation.</h1>
        <p className="mt-3 text-[var(--fg-muted)] max-w-[60ch] leading-relaxed">
          OpenAPI 3.1 spec for the Zameen platform. Most endpoints require an authenticated
          session. The raw spec is available at{' '}
          <a className="text-[var(--accent)] hover:underline" href="/openapi.json">
            /openapi.json
          </a>
          .
        </p>
      </div>
      <SwaggerUi specUrl="/openapi.json" />
    </div>
  );
}
