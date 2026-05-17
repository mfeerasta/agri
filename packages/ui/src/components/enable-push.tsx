'use client';
import * as React from 'react';

/**
 * EnablePush — opt-in widget that registers the service worker, requests
 * Notification permission, subscribes to the browser's PushManager with the
 * project's VAPID public key, and posts the subscription JSON to the app's
 * own /api/push/subscribe endpoint.
 *
 * Status surface is intentionally minimal: each app can wrap this with its
 * own card chrome. The widget never logs the VAPID private key (which is
 * server-only anyway) and never persists keys client-side.
 */

export interface EnablePushProps {
  vapidPublicKey: string;
  subscribePath?: string;
  unsubscribePath?: string;
  deviceLabel?: string;
  className?: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'denied' }
  | { kind: 'busy' }
  | { kind: 'enabled' }
  | { kind: 'error'; message: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof window !== 'undefined' ? window.atob(base64) : '';
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function EnablePush(props: EnablePushProps): React.ReactElement {
  const subscribePath = props.subscribePath ?? '/api/push/subscribe';
  const unsubscribePath = props.unsubscribePath ?? '/api/push/unsubscribe';
  const [status, setStatus] = React.useState<Status>({ kind: 'idle' });

  React.useEffect(() => {
    let cancelled = false;
    async function probe(): Promise<void> {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) {
        if (!cancelled) setStatus({ kind: 'unsupported', reason: 'no_notification_api' });
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setStatus({ kind: 'unsupported', reason: 'no_push_api' });
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus({ kind: 'denied' });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub && !cancelled) setStatus({ kind: 'enabled' });
      } catch {
        // ignore
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable(): Promise<void> {
    setStatus({ kind: 'busy' });
    try {
      if (typeof window === 'undefined') return;
      if (!props.vapidPublicKey) {
        setStatus({ kind: 'error', message: 'VAPID public key missing' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus({ kind: 'denied' });
        return;
      }
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(props.vapidPublicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      const json = subscription.toJSON();
      const res = await fetch(subscribePath, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          deviceLabel: props.deviceLabel,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `subscribe_failed_${res.status}`);
      }
      setStatus({ kind: 'enabled' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'unknown' });
    }
  }

  async function disable(): Promise<void> {
    setStatus({ kind: 'busy' });
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(unsubscribePath, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'unknown' });
    }
  }

  const label = (() => {
    switch (status.kind) {
      case 'idle':
      case 'checking':
        return 'Enable push notifications';
      case 'busy':
        return 'Working...';
      case 'enabled':
        return 'Push enabled · click to disable';
      case 'denied':
        return 'Notifications blocked in browser settings';
      case 'unsupported':
        return 'Push not supported in this browser';
      case 'error':
        return `Error: ${status.message}`;
    }
  })();

  const disabled =
    status.kind === 'busy' || status.kind === 'unsupported' || status.kind === 'denied';

  return (
    <div className={props.className}>
      <button
        type="button"
        onClick={status.kind === 'enabled' ? disable : enable}
        disabled={disabled}
        className="min-h-[44px] w-full rounded-lg border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--paper)]/80 disabled:opacity-60"
      >
        {label}
      </button>
    </div>
  );
}
