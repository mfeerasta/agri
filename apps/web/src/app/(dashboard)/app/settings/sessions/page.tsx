import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../../../lib/session';
import { listSessions } from '../../../../../modules/settings/session-actions';
import { SessionsClient } from './sessions-client';

export const dynamic = 'force-dynamic';

export default async function SessionsSettingsPage(): Promise<React.ReactElement> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const sessions = await listSessions();

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Active sessions</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Every device signed into your account. Revoke any session you do not recognize. Passkey
          sessions show the credential name attached.
        </p>
      </header>
      <SessionsClient initial={sessions} />
    </main>
  );
}
