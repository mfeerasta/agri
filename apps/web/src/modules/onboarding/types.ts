/**
 * Wizard state shape. Persisted to zameen.onboarding_drafts.state so MF
 * can resume across sessions. Never store secrets in cleartext (Slack
 * webhooks, WhatsApp tokens, etc.); they go to digest_subscriptions on
 * finalize.
 */

export interface WizardEntityStep {
  mode: 'existing' | 'new';
  existingEntityId?: string;
  code?: string;
  name?: string;
  legalName?: string;
  kind?: 'proprietorship' | 'partnership' | 'private_limited';
  ntn?: string;
  registeredAddress?: string;
  fiscalYearStartMonth?: string;
  approvalThresholdsPkr?: Record<string, { supervisor: number | null; farm_manager: number | null; director: number | null }>;
}

export interface WizardFieldDraft {
  code: string;
  name: string;
  acres: number;
  geometryGeoJson: unknown;
  blockCode: string;
}

export interface WizardBlockDraft {
  code: string;
  name?: string;
  acres?: number;
  geometryGeoJson?: unknown;
}

export interface WizardLandStep {
  farmCode?: string;
  farmName?: string;
  district?: string;
  tehsil?: string;
  village?: string;
  centroidLat?: number;
  centroidLon?: number;
  totalAcres?: number;
  blocks: WizardBlockDraft[];
  fields: WizardFieldDraft[];
}

export interface WizardPersonDraft {
  fullName: string;
  phone?: string;
  email?: string;
  role: 'director' | 'farm_manager' | 'supervisor' | 'accountant';
}

export interface WizardPeopleStep {
  directorReuseMf: boolean;
  people: WizardPersonDraft[];
}

export interface WizardCropPlanDraft {
  cropProfileId: string;
  fieldCode: string;
  plannedSowingDate?: string;
  notes?: string;
}

export interface WizardCropsStep {
  selectedCropProfileIds: string[];
  plans: WizardCropPlanDraft[];
}

export interface WizardDigestPrefDraft {
  channel: 'slack' | 'email' | 'whatsapp';
  kind: 'daily' | 'weekly' | 'monthly';
  target: string;
  sendTimeLocal: string;
  timezone: string;
}

export interface WizardAutomationStep {
  approvalsAcknowledged: boolean;
  recommendedAutomationsEnabled: boolean;
  digestPrefs: WizardDigestPrefDraft[];
}

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  entityStep: WizardEntityStep;
  landStep: WizardLandStep;
  peopleStep: WizardPeopleStep;
  cropsStep: WizardCropsStep;
  automationStep: WizardAutomationStep;
}

export const initialWizardState: WizardState = {
  step: 1,
  entityStep: { mode: 'existing' },
  landStep: { blocks: [], fields: [] },
  peopleStep: { directorReuseMf: true, people: [] },
  cropsStep: { selectedCropProfileIds: [], plans: [] },
  automationStep: {
    approvalsAcknowledged: false,
    recommendedAutomationsEnabled: true,
    digestPrefs: [],
  },
};

export function canProceed(state: WizardState, step: WizardState['step']): { ok: boolean; reason?: string } {
  if (step === 1) {
    if (state.entityStep.mode === 'existing' && !state.entityStep.existingEntityId) {
      return { ok: false, reason: 'Pick an existing entity or switch to new.' };
    }
    if (state.entityStep.mode === 'new') {
      if (!state.entityStep.code || !state.entityStep.name) {
        return { ok: false, reason: 'Entity code and name are required.' };
      }
    }
    return { ok: true };
  }
  if (step === 2) {
    if (!state.landStep.farmCode || !state.landStep.farmName) {
      return { ok: false, reason: 'Farm code and name are required.' };
    }
    if (state.landStep.blocks.length === 0) return { ok: false, reason: 'Add at least one block.' };
    if (state.landStep.fields.length === 0) return { ok: false, reason: 'Add at least one field.' };
    return { ok: true };
  }
  if (step === 3) {
    if (!state.peopleStep.people.some((p) => p.role === 'farm_manager')) {
      return { ok: false, reason: 'At least one farm manager is required.' };
    }
    return { ok: true };
  }
  if (step === 4) {
    if (state.cropsStep.selectedCropProfileIds.length === 0) {
      return { ok: false, reason: 'Pick at least one crop.' };
    }
    return { ok: true };
  }
  if (step === 5) {
    if (!state.automationStep.approvalsAcknowledged) {
      return { ok: false, reason: 'Confirm approval thresholds before finalizing.' };
    }
    return { ok: true };
  }
  return { ok: true };
}
