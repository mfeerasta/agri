import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { getFieldSession } from '../../lib/session';
import { Masthead } from '@zameen/ui';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Home</Link>
      <Masthead section="Profile" />
      <div className="flex items-center gap-3">
        {session.workerPhotoUrl ? (
          <img src={session.workerPhotoUrl} alt={session.workerName} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-[var(--paper-2)] flex items-center justify-center text-xl">
            {session.workerName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-medium">{session.workerName}</div>
          <div className="text-xs text-[var(--ink)]/60 tabular">{session.phone}</div>
        </div>
      </div>
      <Link
        href="/me/score"
        className="flex items-center justify-between border border-[var(--rule)] p-3 min-h-[56px] hover:bg-[var(--paper-2)]"
        style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--paper))' }}
      >
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          <div>
            <div className="urdu text-sm">میرا سکور</div>
            <div className="text-xs text-[var(--ink)]/60">My monthly score</div>
          </div>
        </div>
        <span className="text-[var(--ink)]/50">›</span>
      </Link>
      <ProfileClient />
    </main>
  );
}
