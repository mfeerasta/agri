import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export default function DelegatePage() {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 font-display text-2xl">Delegation</h1>
      <Card>
        <CardHeader><CardTitle>Set delegate</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ink)]/70">
            Pick a delegate and a date range. Writes to user_entity_roles.delegate_user_id + delegation_start/end.
            Active delegation routes approvals to the delegate during the window.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
