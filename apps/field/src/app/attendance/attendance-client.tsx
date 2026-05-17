'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BigButton } from '@zameen/ui';
import { t } from '@zameen/locale';
import { useLocaleStore } from '../../lib/locale-store';
import { captureGps } from '../../lib/gps';
import { enqueue, makeIdempotencyKey } from '../../lib/offline-queue';
import { checkIn, checkOut } from './actions';

interface Props {
  checkedIn: boolean;
  checkedOut: boolean;
  withinGeofence: boolean | null;
}

export function AttendanceClient({ checkedIn, checkedOut, withinGeofence }: Props) {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [busy, setBusy] = React.useState(false);
  const [warn, setWarn] = React.useState<string | null>(null);

  async function doCheckIn() {
    setBusy(true);
    setWarn(null);
    try {
      const gps = await captureGps();
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueue({
          resource: 'attendance',
          operation: 'insert',
          payload: { action: 'check_in', gps },
          priority: 'critical',
          idempotencyKey: makeIdempotencyKey(),
        });
        setWarn(t('offline.queued', locale));
      } else {
        const r = await checkIn(gps);
        if (!r.ok) setWarn(r.error);
        else if (r.withinGeofence === false) setWarn(t('attendance.outside_geofence', locale));
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut() {
    setBusy(true);
    setWarn(null);
    try {
      const gps = await captureGps();
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueue({
          resource: 'attendance',
          operation: 'update',
          payload: { action: 'check_out', gps },
          priority: 'critical',
          idempotencyKey: makeIdempotencyKey(),
        });
        setWarn(t('offline.queued', locale));
      } else {
        const r = await checkOut(gps);
        if (!r.ok) setWarn(r.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  let status: string;
  if (checkedOut) status = t('attendance.checked_out', locale);
  else if (checkedIn) status = t('attendance.checked_in', locale);
  else status = t('attendance.not_yet', locale);

  return (
    <div className="space-y-3">
      <div className="border border-[var(--rule)] p-3">
        <div className="smallcaps text-[0.72rem] text-[var(--ink)]/70 mb-1">{t('attendance.title', locale)}</div>
        <div className="text-lg">{status}</div>
        {withinGeofence === false ? (
          <div className="mt-1 text-xs text-[var(--rust)]">{t('attendance.outside_geofence', locale)}</div>
        ) : null}
      </div>

      {!checkedIn ? (
        <BigButton tone="success" label={busy ? '...' : t('attendance.check_in', locale)} onClick={doCheckIn} disabled={busy} />
      ) : !checkedOut ? (
        <BigButton tone="warning" label={busy ? '...' : t('attendance.check_out', locale)} onClick={doCheckOut} disabled={busy} />
      ) : (
        <div className="text-sm text-[var(--ink)]/60">{t('form.submit_success', locale)}</div>
      )}

      {warn ? <div className="text-sm text-[var(--clay)]">{warn}</div> : null}
    </div>
  );
}
