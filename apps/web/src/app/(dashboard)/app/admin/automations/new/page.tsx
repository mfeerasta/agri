import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { RECIPE_TEMPLATES, TRIGGER_KINDS } from '@zameen/automations';
import { RecipeBuilder } from '@/modules/automations/recipe-builder';
import { ApplyTemplateButton } from '@/modules/automations/apply-template-button';

export const dynamic = 'force-dynamic';

export default function NewAutomationPage() {
  return (
    <div>
      <Masthead section="NEW AUTOMATION" />
      <SectionDivider />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RECIPE_TEMPLATES.map((t) => (
              <div
                key={t.slug}
                className="border border-[var(--rule)] rounded-md p-4 flex flex-col gap-2"
              >
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-[var(--fg-muted)]">{t.description}</div>
                <div className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">
                  trigger: {t.triggerKind}
                </div>
                <ApplyTemplateButton slug={t.slug} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Build from scratch</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeBuilder triggerKinds={[...TRIGGER_KINDS]} />
        </CardContent>
      </Card>
    </div>
  );
}
