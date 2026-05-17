'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RECIPE_TEMPLATES } from '@zameen/automations';
import { createRecipe } from './actions';

export function ApplyTemplateButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const tpl = RECIPE_TEMPLATES.find((t) => t.slug === slug);
  if (!tpl) return null;
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const res = await createRecipe({
            entityId: null,
            name: tpl.name,
            description: tpl.description,
            triggerKind: tpl.triggerKind,
            triggerConfig: tpl.triggerConfig,
            conditions: tpl.conditions,
            actions: tpl.actions,
            enabled: true,
          });
          if (res.ok) router.push('/admin/automations');
        })
      }
      disabled={pending}
      className="self-start text-xs px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
    >
      {pending ? 'Adding...' : 'Use template'}
    </button>
  );
}
