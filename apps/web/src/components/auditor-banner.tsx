export function AuditorBanner() {
  return (
    <div
      data-tour="audit-banner"
      role="status"
      className="sticky top-0 z-40 mb-3 rounded border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <span className="font-medium">Read-only auditor session.</span>{' '}
      <span className="text-amber-800/80">You can view every record. Inserts, updates, and deletes are blocked at the database level.</span>
    </div>
  );
}
