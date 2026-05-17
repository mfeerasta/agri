'use client';
import { useTransition } from 'react';
import { toggleRecipe } from './actions';

export function ToggleRecipeButton({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => void toggleRecipe(id, !enabled))}
      disabled={pending}
      className={`inline-flex w-9 h-5 rounded-full transition-colors ${
        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`block w-4 h-4 my-0.5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
