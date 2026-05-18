import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Automation: overdue task triggers supervisor notification', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('recipe fires automation_runs row and notification', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    const db = adminClient();
    await signInDirector(page, seed.director);

    await page.goto('/app/admin/automation/new');
    await page.getByLabel(/name/i).fill(`Overdue ping ${tracker.tag}`);
    await page.getByLabel(/trigger/i).selectOption({ label: /task.*overdue/i });
    await page.getByLabel(/action/i).selectOption({ label: /notify supervisor/i });
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByRole('status')).toContainText(/saved|active/i);

    // Seed a task assigned to a supervisor.
    const [task] = await db
      .from('tasks')
      .insert({
        entity_id: seed.entityId,
        assigned_to: seed.supervisors[0].id,
        title: `Spray F1 ${tracker.tag}`,
        status: 'pending',
        due_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .select('id')
      .throwOnError();
    const taskId = (task as { id: string }).id;

    await db.from('tasks').update({ status: 'overdue' }).eq('id', taskId).throwOnError();

    await pollUntil(async () => {
      const { data } = await db
        .from('automation_runs')
        .select('id')
        .eq('source_record_id', taskId)
        .limit(1);
      return (data?.length ?? 0) > 0 ? data : null;
    }, { label: 'automation_runs row', timeoutMs: 20_000 });

    const notif = await pollUntil(async () => {
      const { data } = await db
        .from('notifications')
        .select('id')
        .eq('user_id', seed.supervisors[0].id)
        .limit(1);
      return (data?.length ?? 0) > 0 ? data : null;
    }, { label: 'notifications row' });
    expect(notif.length).toBeGreaterThan(0);
  });
});
