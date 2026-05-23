'use client';

import { ScenarioForm } from './scenario-form';
import { ComparisonGrid, type ScenarioRow } from './comparison-grid';
import type { CropPrefill } from '../actions';

interface Props {
  studyId: string;
  scenarios: ScenarioRow[];
  crops: CropPrefill[];
  fields: { id: string; code: string; acres: number }[];
}

export function StudyWorkbench({ studyId, scenarios, crops, fields }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-3">
        <ScenarioForm studyId={studyId} crops={crops} fields={fields} />
      </aside>
      <section>
        <ComparisonGrid scenarios={scenarios} />
      </section>
    </div>
  );
}
