/**
 * New feasibility study. AI-draft starter + editable form + submit.
 * Director-only approval (per DEFAULT_APPROVAL_THRESHOLDS_PKR).
 */
import { NewFeasibilityForm } from './new-feasibility-form';

export default function NewFeasibilityPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">New feasibility study</h1>
      <NewFeasibilityForm />
    </div>
  );
}
