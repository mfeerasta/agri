/**
 * Feasibility study detail. Renders all sections plus the comment thread.
 * Approval state shown when an approvalRequestId is linked.
 */
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import {
  db,
  feasibilityStudies,
  feasibilityComments,
  feasibilityAttachments,
  approvalRequests,
} from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { SubmitForApprovalButton } from './submit-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ScopeShape {
  objectives?: string[];
  deliverables?: string[];
  timelineMonths?: number;
  boundaries?: string;
}

interface RevenueShape {
  yearOnePkr?: number;
  yearTwoPkr?: number;
  yearThreePkr?: number;
  assumptions?: string[];
}

interface CostItem {
  category?: string;
  subcategory?: string;
  amountPkr?: number;
  notes?: string;
}

interface RiskItem {
  risk?: string;
  likelihood?: string;
  impact?: string;
  mitigation?: string;
}

interface RiskShape {
  operational?: RiskItem[];
  market?: RiskItem[];
  financial?: RiskItem[];
  regulatory?: RiskItem[];
}

export default async function FeasibilityDetailPage({ params }: PageProps) {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view this study.</div>;
  const { id } = await params;

  const [study] = await db.select().from(feasibilityStudies).where(eq(feasibilityStudies.id, id)).limit(1);
  if (!study) return notFound();

  const comments = await db
    .select()
    .from(feasibilityComments)
    .where(eq(feasibilityComments.feasibilityStudyId, id))
    .orderBy(desc(feasibilityComments.createdAt))
    .limit(50);

  const attachments = await db
    .select()
    .from(feasibilityAttachments)
    .where(eq(feasibilityAttachments.feasibilityStudyId, id));

  const approvalState =
    study.approvalRequestId
      ? (await db
          .select({ state: approvalRequests.state })
          .from(approvalRequests)
          .where(eq(approvalRequests.id, study.approvalRequestId))
          .limit(1))[0]?.state
      : null;

  const scope = study.scope as ScopeShape | null;
  const revenue = study.revenueProjection as RevenueShape | null;
  const costs = (study.costBreakdown as CostItem[] | null) ?? [];
  const risks = (study.riskAssessment as RiskShape | null) ?? {};

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-mono text-slate-500">{study.studyNumber}</div>
          <h1 className="text-2xl font-semibold">{study.title}</h1>
          {study.titleUr && <div className="text-slate-700">{study.titleUr}</div>}
        </div>
        <div className="text-right text-sm">
          <div>
            <span className="text-slate-500">Decision: </span>
            <span className="font-medium">{study.decision ?? 'pending'}</span>
          </div>
          {approvalState && (
            <div>
              <span className="text-slate-500">Approval: </span>
              <span className="font-medium">{approvalState}</span>
            </div>
          )}
          {!study.approvalRequestId && <SubmitForApprovalButton id={study.id} />}
        </div>
      </header>

      <Section title="Background">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{study.background}</p>
      </Section>

      <Section title="Scope">
        <div className="grid gap-3 sm:grid-cols-2">
          <List label="Objectives" items={scope?.objectives ?? []} />
          <List label="Deliverables" items={scope?.deliverables ?? []} />
        </div>
        <div className="mt-3 text-sm">
          <div>
            <span className="text-slate-500">Timeline: </span>
            {scope?.timelineMonths ?? 0} months
          </div>
          {scope?.boundaries && (
            <div>
              <span className="text-slate-500">Boundaries: </span>
              {scope.boundaries}
            </div>
          )}
        </div>
      </Section>

      <Section title="Cost breakdown">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-600">
            <tr>
              <th className="py-1">Category</th>
              <th className="py-1">Subcategory</th>
              <th className="py-1 text-right">Amount (PKR)</th>
              <th className="py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{c.category}</td>
                <td className="py-1">{c.subcategory ?? ''}</td>
                <td className="py-1 text-right tabular-nums">{(c.amountPkr ?? 0).toLocaleString()}</td>
                <td className="py-1 text-slate-600">{c.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td colSpan={2} className="py-2">
                Capex / Opex totals
              </td>
              <td className="py-2 text-right">
                {Number(study.capexEstimatePkr).toLocaleString()} / {Number(study.opexEstimatePkr).toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </Section>

      <Section title="Revenue projection">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Year 1" value={revenue?.yearOnePkr ?? 0} />
          <Metric label="Year 2" value={revenue?.yearTwoPkr ?? 0} />
          <Metric label="Year 3" value={revenue?.yearThreePkr ?? 0} />
        </div>
        <List label="Assumptions" items={revenue?.assumptions ?? []} />
      </Section>

      {study.sensitivity ? (
        <Section title="Sensitivity">
          <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(study.sensitivity, null, 2)}
          </pre>
        </Section>
      ) : null}

      <Section title="Risk assessment">
        {(['operational', 'market', 'financial', 'regulatory'] as const).map((bucket) => (
          <div key={bucket} className="mt-2">
            <h3 className="text-sm font-medium capitalize text-slate-700">{bucket}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {(risks[bucket] ?? []).map((r, i) => (
                <li key={i} className="rounded border border-slate-200 p-2">
                  <div className="font-medium">{r.risk}</div>
                  <div className="text-xs text-slate-500">
                    Likelihood: {r.likelihood} | Impact: {r.impact}
                  </div>
                  <div className="text-sm">Mitigation: {r.mitigation}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {study.statusQuoComparison ? (
        <Section title="Status-quo comparison">
          <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(study.statusQuoComparison, null, 2)}
          </pre>
        </Section>
      ) : null}

      <Section title="Attachments">
        {attachments.length === 0 ? (
          <div className="text-sm text-slate-500">No attachments.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.id}>
                <a className="text-emerald-700 underline" href={a.fileUrl} target="_blank" rel="noreferrer">
                  {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Comments">
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded border border-slate-200 p-2 text-sm">
              <div className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</div>
              <div className="whitespace-pre-wrap">{c.body}</div>
              {c.bodyUr && <div className="whitespace-pre-wrap text-slate-700">{c.bodyUr}</div>}
            </li>
          ))}
          {comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700">{label}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
        {items.length === 0 && <li className="list-none text-slate-500">(none)</li>}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">PKR {value.toLocaleString()}</div>
    </div>
  );
}
