'use client';

import { useState, useTransition } from 'react';
import { saveDigestSubscription } from './actions';

interface EntityOption {
  id: string;
  name: string;
}

export function DigestEditor({ entities }: { entities: EntityOption[] }) {
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [channel, setChannel] = useState<'slack' | 'email' | 'whatsapp'>('slack');
  const [kind, setKind] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [target, setTarget] = useState('');
  const [sendTimeLocal, setSendTimeLocal] = useState('07:00');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [isPending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    start(async () => {
      const res = await saveDigestSubscription({
        entityId,
        channel,
        kind,
        target,
        sendTimeLocal,
        timezone,
      });
      if (res.ok) {
        setMessage('Subscription saved.');
        setTarget('');
      } else {
        setMessage(`Error: ${res.error}`);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="smallcaps text-[0.7rem]">Entity</span>
          <select
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[0.7rem]">Channel</span>
          <select
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5"
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
          >
            <option value="slack">Slack</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[0.7rem]">Kind</span>
          <select
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[0.7rem]">Send time (local)</span>
          <input
            type="time"
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5"
            value={sendTimeLocal}
            onChange={(e) => setSendTimeLocal(e.target.value)}
          />
        </label>
        <label className="block col-span-2">
          <span className="smallcaps text-[0.7rem]">
            Target {channel === 'slack' ? '(Slack webhook URL)' : channel === 'email' ? '(email address)' : '(phone with country code)'}
          </span>
          <input
            type={channel === 'slack' ? 'password' : 'text'}
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5 font-mono text-[0.8rem]"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={
              channel === 'slack'
                ? 'https://hooks.slack.com/services/...'
                : channel === 'email'
                  ? 'meer@feerasta.ai'
                  : '+9230001234567'
            }
          />
        </label>
        <label className="block col-span-2">
          <span className="smallcaps text-[0.7rem]">Timezone</span>
          <input
            type="text"
            className="block w-full mt-1 border border-[var(--rule)] rounded px-2 py-1.5"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>
      </div>
      <button
        onClick={submit}
        disabled={isPending || !entityId || !target}
        className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save subscription'}
      </button>
      {message && <div className="text-[0.85rem] text-[var(--ink)]/70">{message}</div>}
    </div>
  );
}
