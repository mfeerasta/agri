// Spray training gate
// Blocks worker assignment to spray tasks unless they have a current
// "Pesticide handling and PPE" certification. Suggests alternates from
// the active roster who do have it.

export const PESTICIDE_TRAINING_NAME = 'Pesticide handling and PPE';

export interface TrainingCompletionLite {
  workerId: string;
  programName: string;
  completedOn: string;
  expiresOn: string | null;
  passed: boolean;
}

export interface WorkerLite {
  id: string;
  fullName: string;
  isActive: boolean;
}

export interface AssignmentGateResult {
  blocked: string[];
  reasons: Record<string, string>;
  alternates: WorkerLite[];
}

export function checkSprayAssignmentGate(args: {
  proposedWorkerIds: string[];
  roster: WorkerLite[];
  completions: TrainingCompletionLite[];
  today?: string;
  programName?: string;
}): AssignmentGateResult {
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  const programName = args.programName ?? PESTICIDE_TRAINING_NAME;

  const validIds = new Set<string>();
  for (const c of args.completions) {
    if (c.programName !== programName) continue;
    if (!c.passed) continue;
    if (c.expiresOn && c.expiresOn < today) continue;
    validIds.add(c.workerId);
  }

  const blocked: string[] = [];
  const reasons: Record<string, string> = {};
  for (const wid of args.proposedWorkerIds) {
    if (!validIds.has(wid)) {
      blocked.push(wid);
      reasons[wid] = `Missing current ${programName} training`;
    }
  }

  const alternates = args.roster.filter((w) => w.isActive && validIds.has(w.id) && !args.proposedWorkerIds.includes(w.id));

  return { blocked, reasons, alternates };
}
