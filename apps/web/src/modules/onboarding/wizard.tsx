'use client';

import { useState, useTransition } from 'react';
import {
  initialWizardState,
  canProceed,
  type WizardState,
  type WizardBlockDraft,
  type WizardFieldDraft,
  type WizardPersonDraft,
  type WizardDigestPrefDraft,
} from './types';
import { saveDraftState, finalizeOnboarding } from './actions';

interface EntityOption {
  id: string;
  name: string;
}

interface CropProfileOption {
  id: string;
  name: string;
  nameUr?: string | null;
  season?: string;
}

interface OnboardingWizardProps {
  entities: EntityOption[];
  cropProfiles: CropProfileOption[];
  initialDraftId?: string | null;
  initialState?: WizardState;
}

export function OnboardingWizard(props: OnboardingWizardProps) {
  const [state, setState] = useState<WizardState>(props.initialState ?? initialWizardState);
  const [draftId, setDraftId] = useState<string | null>(props.initialDraftId ?? null);
  const [isPending, start] = useTransition();
  const [log, setLog] = useState<string[]>([]);
  const [finalError, setFinalError] = useState<string | null>(null);

  const check = canProceed(state, state.step);

  function autosave(next: WizardState) {
    setState(next);
    start(async () => {
      const res = await saveDraftState(draftId, next);
      if (res.ok) setDraftId(res.id);
    });
  }

  function goto(step: WizardState['step']) {
    autosave({ ...state, step });
  }

  async function finalize() {
    if (!draftId) {
      const res = await saveDraftState(null, state);
      if (!res.ok) {
        setFinalError(res.error);
        return;
      }
      setDraftId(res.id);
    }
    setLog(['Finalizing…']);
    start(async () => {
      const id = draftId ?? (await saveDraftState(null, state)).valueOf();
      const useId = typeof id === 'string' ? id : draftId!;
      const res = await finalizeOnboarding(useId, state);
      setLog(res.log);
      if (!res.ok) setFinalError(res.error ?? 'Failed');
    });
  }

  return (
    <div className="space-y-6">
      <Stepper current={state.step} onChange={(s) => goto(s)} />

      {state.step === 1 && (
        <Step1Entity
          state={state}
          entities={props.entities}
          onChange={(entityStep) => autosave({ ...state, entityStep })}
        />
      )}
      {state.step === 2 && (
        <Step2Land state={state} onChange={(landStep) => autosave({ ...state, landStep })} />
      )}
      {state.step === 3 && (
        <Step3People state={state} onChange={(peopleStep) => autosave({ ...state, peopleStep })} />
      )}
      {state.step === 4 && (
        <Step4Crops
          state={state}
          cropProfiles={props.cropProfiles}
          onChange={(cropsStep) => autosave({ ...state, cropsStep })}
        />
      )}
      {state.step === 5 && (
        <Step5Automations state={state} onChange={(automationStep) => autosave({ ...state, automationStep })} />
      )}

      <div className="flex items-center justify-between pt-4 border-t border-[var(--rule)]">
        <button
          onClick={() => goto(Math.max(1, state.step - 1) as WizardState['step'])}
          disabled={state.step === 1}
          className="px-4 py-2 border border-[var(--rule)] rounded disabled:opacity-30"
        >
          Back
        </button>
        <div className="text-[0.85rem] text-[var(--ink)]/60">
          {check.ok ? 'Ready' : check.reason}
        </div>
        {state.step < 5 ? (
          <button
            onClick={() => goto((state.step + 1) as WizardState['step'])}
            disabled={!check.ok}
            className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            onClick={finalize}
            disabled={!check.ok || isPending}
            className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded disabled:opacity-50"
          >
            {isPending ? 'Finalizing…' : 'Finalize'}
          </button>
        )}
      </div>

      {log.length > 0 && (
        <div className="rounded border border-[var(--rule)] p-3 bg-[var(--paper-2)] text-[0.8rem] font-mono">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {finalError && <div className="text-red-700">Error: {finalError}</div>}
        </div>
      )}
    </div>
  );
}

function Stepper({ current, onChange }: { current: WizardState['step']; onChange: (s: WizardState['step']) => void }) {
  const labels = ['Entity', 'Land', 'People', 'Crops', 'Automations'];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const step = (i + 1) as WizardState['step'];
        const active = step === current;
        const past = step < current;
        return (
          <button
            key={label}
            onClick={() => onChange(step)}
            className={`px-3 py-1.5 rounded text-[0.8rem] border ${active ? 'bg-[var(--ink)] text-[var(--paper)]' : past ? 'border-[var(--ink)]' : 'border-[var(--rule)] text-[var(--ink)]/60'}`}
          >
            {i + 1}. {label}
          </button>
        );
      })}
    </div>
  );
}

function Step1Entity({
  state,
  entities,
  onChange,
}: {
  state: WizardState;
  entities: EntityOption[];
  onChange: (s: WizardState['entityStep']) => void;
}) {
  const s = state.entityStep;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Entity setup</h2>
      <div className="flex gap-3 text-sm">
        <label><input type="radio" checked={s.mode === 'existing'} onChange={() => onChange({ ...s, mode: 'existing' })} /> Use existing entity</label>
        <label><input type="radio" checked={s.mode === 'new'} onChange={() => onChange({ ...s, mode: 'new' })} /> Create new entity</label>
      </div>
      {s.mode === 'existing' ? (
        <select className="border border-[var(--rule)] rounded px-2 py-1.5" value={s.existingEntityId ?? ''} onChange={(e) => onChange({ ...s, existingEntityId: e.target.value })}>
          <option value="">Pick entity…</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Code (e.g. RUPA2)" value={s.code ?? ''} onChange={(e) => onChange({ ...s, code: e.target.value })} />
          <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Name" value={s.name ?? ''} onChange={(e) => onChange({ ...s, name: e.target.value })} />
          <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Legal name" value={s.legalName ?? ''} onChange={(e) => onChange({ ...s, legalName: e.target.value })} />
          <select className="border border-[var(--rule)] rounded px-2 py-1.5" value={s.kind ?? 'proprietorship'} onChange={(e) => onChange({ ...s, kind: e.target.value as WizardState['entityStep']['kind'] })}>
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="private_limited">Private Limited</option>
          </select>
          <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="NTN" value={s.ntn ?? ''} onChange={(e) => onChange({ ...s, ntn: e.target.value })} />
          <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Fiscal year start month (01-12)" value={s.fiscalYearStartMonth ?? '07'} onChange={(e) => onChange({ ...s, fiscalYearStartMonth: e.target.value })} />
          <textarea className="col-span-2 border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Registered address" value={s.registeredAddress ?? ''} onChange={(e) => onChange({ ...s, registeredAddress: e.target.value })} />
        </div>
      )}
    </section>
  );
}

function Step2Land({ state, onChange }: { state: WizardState; onChange: (s: WizardState['landStep']) => void }) {
  const s = state.landStep;
  function addBlock() {
    const next: WizardBlockDraft = { code: `B${s.blocks.length + 1}` };
    onChange({ ...s, blocks: [...s.blocks, next] });
  }
  function addField() {
    const next: WizardFieldDraft = {
      code: `F${s.fields.length + 1}`,
      name: `Field ${s.fields.length + 1}`,
      acres: 5,
      blockCode: s.blocks[0]?.code ?? 'B1',
      geometryGeoJson: { type: 'MultiPolygon', coordinates: [] },
    };
    onChange({ ...s, fields: [...s.fields, next] });
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Farm and land</h2>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Farm code" value={s.farmCode ?? ''} onChange={(e) => onChange({ ...s, farmCode: e.target.value })} />
        <input className="border border-[var(--rule)] rounded px-2 py-1.5 col-span-2" placeholder="Farm name" value={s.farmName ?? ''} onChange={(e) => onChange({ ...s, farmName: e.target.value })} />
        <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="District" value={s.district ?? ''} onChange={(e) => onChange({ ...s, district: e.target.value })} />
        <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Tehsil" value={s.tehsil ?? ''} onChange={(e) => onChange({ ...s, tehsil: e.target.value })} />
        <input className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Village" value={s.village ?? ''} onChange={(e) => onChange({ ...s, village: e.target.value })} />
        <input type="number" step="0.0001" className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Centroid lat" value={s.centroidLat ?? ''} onChange={(e) => onChange({ ...s, centroidLat: e.target.value ? Number(e.target.value) : undefined })} />
        <input type="number" step="0.0001" className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Centroid lon" value={s.centroidLon ?? ''} onChange={(e) => onChange({ ...s, centroidLon: e.target.value ? Number(e.target.value) : undefined })} />
        <input type="number" step="0.01" className="border border-[var(--rule)] rounded px-2 py-1.5" placeholder="Total acres" value={s.totalAcres ?? ''} onChange={(e) => onChange({ ...s, totalAcres: e.target.value ? Number(e.target.value) : undefined })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Blocks ({s.blocks.length})</h3>
          <button className="text-[0.8rem] underline" onClick={addBlock}>+ add block</button>
        </div>
        {s.blocks.map((b, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 text-sm">
            <input className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Code" value={b.code} onChange={(e) => {
              const nb = [...s.blocks]; nb[i] = { ...b, code: e.target.value }; onChange({ ...s, blocks: nb });
            }} />
            <input className="border border-[var(--rule)] rounded px-2 py-1 col-span-2" placeholder="Name" value={b.name ?? ''} onChange={(e) => {
              const nb = [...s.blocks]; nb[i] = { ...b, name: e.target.value }; onChange({ ...s, blocks: nb });
            }} />
            <input type="number" step="0.01" className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Acres" value={b.acres ?? ''} onChange={(e) => {
              const nb = [...s.blocks]; nb[i] = { ...b, acres: e.target.value ? Number(e.target.value) : undefined }; onChange({ ...s, blocks: nb });
            }} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Fields ({s.fields.length})</h3>
          <button className="text-[0.8rem] underline" onClick={addField}>+ add field</button>
        </div>
        {s.fields.map((f, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 text-sm">
            <input className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Code" value={f.code} onChange={(e) => {
              const nf = [...s.fields]; nf[i] = { ...f, code: e.target.value }; onChange({ ...s, fields: nf });
            }} />
            <input className="border border-[var(--rule)] rounded px-2 py-1 col-span-2" placeholder="Name" value={f.name} onChange={(e) => {
              const nf = [...s.fields]; nf[i] = { ...f, name: e.target.value }; onChange({ ...s, fields: nf });
            }} />
            <input type="number" step="0.01" className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Acres" value={f.acres} onChange={(e) => {
              const nf = [...s.fields]; nf[i] = { ...f, acres: Number(e.target.value) }; onChange({ ...s, fields: nf });
            }} />
            <select className="border border-[var(--rule)] rounded px-2 py-1" value={f.blockCode} onChange={(e) => {
              const nf = [...s.fields]; nf[i] = { ...f, blockCode: e.target.value }; onChange({ ...s, fields: nf });
            }}>
              {s.blocks.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
            </select>
          </div>
        ))}
      </div>

      <p className="text-[0.8rem] text-[var(--ink)]/60">
        Tip: paste GeoJSON polygons later via the field editor. Acres + block assignment is enough to proceed.
      </p>
    </section>
  );
}

function Step3People({ state, onChange }: { state: WizardState; onChange: (s: WizardState['peopleStep']) => void }) {
  const s = state.peopleStep;
  function add(role: WizardPersonDraft['role']) {
    onChange({ ...s, people: [...s.people, { fullName: '', role }] });
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">People</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.directorReuseMf} onChange={(e) => onChange({ ...s, directorReuseMf: e.target.checked })} />
        Use MF (current user) as director
      </label>
      <div className="flex gap-2 text-sm">
        <button className="underline" onClick={() => add('farm_manager')}>+ farm manager</button>
        <button className="underline" onClick={() => add('supervisor')}>+ supervisor</button>
        <button className="underline" onClick={() => add('accountant')}>+ accountant</button>
      </div>
      {s.people.map((p, i) => (
        <div key={i} className="grid grid-cols-4 gap-2 text-sm">
          <input className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Full name" value={p.fullName} onChange={(e) => {
            const np = [...s.people]; np[i] = { ...p, fullName: e.target.value }; onChange({ ...s, people: np });
          }} />
          <input className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Phone" value={p.phone ?? ''} onChange={(e) => {
            const np = [...s.people]; np[i] = { ...p, phone: e.target.value }; onChange({ ...s, people: np });
          }} />
          <input className="border border-[var(--rule)] rounded px-2 py-1" placeholder="Email" value={p.email ?? ''} onChange={(e) => {
            const np = [...s.people]; np[i] = { ...p, email: e.target.value }; onChange({ ...s, people: np });
          }} />
          <select className="border border-[var(--rule)] rounded px-2 py-1" value={p.role} onChange={(e) => {
            const np = [...s.people]; np[i] = { ...p, role: e.target.value as WizardPersonDraft['role'] }; onChange({ ...s, people: np });
          }}>
            <option value="director">Director</option>
            <option value="farm_manager">Farm manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>
      ))}
    </section>
  );
}

function Step4Crops({
  state,
  cropProfiles,
  onChange,
}: {
  state: WizardState;
  cropProfiles: CropProfileOption[];
  onChange: (s: WizardState['cropsStep']) => void;
}) {
  const s = state.cropsStep;
  function toggle(id: string) {
    const next = s.selectedCropProfileIds.includes(id)
      ? s.selectedCropProfileIds.filter((x) => x !== id)
      : [...s.selectedCropProfileIds, id];
    onChange({ ...s, selectedCropProfileIds: next });
  }
  function addPlan() {
    if (state.landStep.fields.length === 0 || s.selectedCropProfileIds.length === 0) return;
    onChange({
      ...s,
      plans: [
        ...s.plans,
        { cropProfileId: s.selectedCropProfileIds[0]!, fieldCode: state.landStep.fields[0]!.code },
      ],
    });
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Crops and first plan</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        {cropProfiles.map((c) => (
          <label key={c.id} className="flex items-center gap-2 border border-[var(--rule)] rounded px-2 py-1">
            <input type="checkbox" checked={s.selectedCropProfileIds.includes(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}{c.nameUr ? ` (${c.nameUr})` : ''}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Crop plans</h3>
        <button className="text-[0.8rem] underline" onClick={addPlan}>+ add plan</button>
      </div>
      {s.plans.map((p, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 text-sm">
          <select className="border border-[var(--rule)] rounded px-2 py-1" value={p.cropProfileId} onChange={(e) => {
            const np = [...s.plans]; np[i] = { ...p, cropProfileId: e.target.value }; onChange({ ...s, plans: np });
          }}>
            {cropProfiles.filter((c) => s.selectedCropProfileIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="border border-[var(--rule)] rounded px-2 py-1" value={p.fieldCode} onChange={(e) => {
            const np = [...s.plans]; np[i] = { ...p, fieldCode: e.target.value }; onChange({ ...s, plans: np });
          }}>
            {state.landStep.fields.map((f) => <option key={f.code} value={f.code}>{f.code} - {f.name}</option>)}
          </select>
          <input type="date" className="border border-[var(--rule)] rounded px-2 py-1" value={p.plannedSowingDate ?? ''} onChange={(e) => {
            const np = [...s.plans]; np[i] = { ...p, plannedSowingDate: e.target.value }; onChange({ ...s, plans: np });
          }} />
        </div>
      ))}
    </section>
  );
}

function Step5Automations({ state, onChange }: { state: WizardState; onChange: (s: WizardState['automationStep']) => void }) {
  const s = state.automationStep;
  function addDigest() {
    const next: WizardDigestPrefDraft = {
      channel: 'slack',
      kind: 'daily',
      target: '',
      sendTimeLocal: '07:00',
      timezone: 'Asia/Karachi',
    };
    onChange({ ...s, digestPrefs: [...s.digestPrefs, next] });
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Approvals, automations, and digests</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.approvalsAcknowledged} onChange={(e) => onChange({ ...s, approvalsAcknowledged: e.target.checked })} />
        I have reviewed default approval thresholds (defaults from system constants will apply)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.recommendedAutomationsEnabled} onChange={(e) => onChange({ ...s, recommendedAutomationsEnabled: e.target.checked })} />
        Enable 6 recommended automation recipes
      </label>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Digest subscriptions ({s.digestPrefs.length})</h3>
        <button className="text-[0.8rem] underline" onClick={addDigest}>+ add digest</button>
      </div>
      {s.digestPrefs.map((d, i) => (
        <div key={i} className="grid grid-cols-5 gap-2 text-sm">
          <select className="border border-[var(--rule)] rounded px-2 py-1" value={d.channel} onChange={(e) => {
            const np = [...s.digestPrefs]; np[i] = { ...d, channel: e.target.value as WizardDigestPrefDraft['channel'] }; onChange({ ...s, digestPrefs: np });
          }}>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <select className="border border-[var(--rule)] rounded px-2 py-1" value={d.kind} onChange={(e) => {
            const np = [...s.digestPrefs]; np[i] = { ...d, kind: e.target.value as WizardDigestPrefDraft['kind'] }; onChange({ ...s, digestPrefs: np });
          }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input className="border border-[var(--rule)] rounded px-2 py-1 col-span-2 font-mono text-[0.75rem]" placeholder="Target" value={d.target} onChange={(e) => {
            const np = [...s.digestPrefs]; np[i] = { ...d, target: e.target.value }; onChange({ ...s, digestPrefs: np });
          }} />
          <input type="time" className="border border-[var(--rule)] rounded px-2 py-1" value={d.sendTimeLocal} onChange={(e) => {
            const np = [...s.digestPrefs]; np[i] = { ...d, sendTimeLocal: e.target.value }; onChange({ ...s, digestPrefs: np });
          }} />
        </div>
      ))}
    </section>
  );
}
