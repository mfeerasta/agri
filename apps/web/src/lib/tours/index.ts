import type { TourStep } from '@zameen/ui';
import type { UserRole } from '@zameen/shared';

export const directorDashboardTour: TourStep[] = [
  { selector: '[data-tour="kpi-pending-approvals"]', title: 'Pending approvals', body: 'Items awaiting your decision. Click through to the Approver PWA for full context.', placement: 'bottom' },
  { selector: '[data-tour="kpi-workers-present"]', title: 'Workers present', body: 'Live geofence-verified attendance against headcount.', placement: 'bottom' },
  { selector: '[data-tour="kpi-diesel-stock"]', title: 'Diesel stock', body: 'Tank reading from the last reconciliation. Variance alerts surface in anomalies.', placement: 'bottom' },
  { selector: '[data-tour="kpi-cash"]', title: 'Cash on hand', body: 'Consolidated bank position. Drives the threshold gating on every approval.', placement: 'bottom' },
  { selector: '[data-tour="nav-approvals"]', title: 'Approvals queue', body: 'Triage everything that needs a decision. Auto-routed by amount and type.', placement: 'right' },
  { selector: '[data-tour="nav-finance"]', title: 'Finance & P&L', body: 'Per-field P&L, journal lines, cost allocations. Drill from any cost line back to source.', placement: 'right' },
  { selector: '[data-tour="nav-reports"]', title: 'Reports', body: 'Period exports for the auditor, board reports, regulatory filings.', placement: 'right' },
  { selector: '[data-tour="nav-admin"]', title: 'Admin', body: 'Users, entities, approval workflows. Profile is also where you restart this tour.', placement: 'right' },
];

export const farmManagerOnboardingTour: TourStep[] = [
  { selector: '[data-tour="nav-dashboard"]', title: 'Dashboard', body: 'Your morning view. Tasks, weather, anomalies.', placement: 'right' },
  { selector: '[data-tour="nav-fields"]', title: 'Fields', body: 'Polygon-mapped fields with crop stage and current activity.', placement: 'right' },
  { selector: '[data-tour="nav-crops"]', title: 'Crop plans', body: 'Per-field crop plans with stage progression and yield forecasts.', placement: 'right' },
  { selector: '[data-tour="nav-diesel"]', title: 'Diesel', body: 'Purchases, daily logs, stock reconciliation. Anomalies appear here.', placement: 'right' },
  { selector: '[data-tour="nav-repairs"]', title: 'Repairs', body: 'Multi-quote workflow with operator sign-off and warranty windows.', placement: 'right' },
  { selector: '[data-tour="nav-labor"]', title: 'Labor', body: 'Workers, attendance, piece-rate logs, payroll inputs.', placement: 'right' },
  { selector: '[data-tour="nav-inventory"]', title: 'Inventory', body: 'Inputs in storage. Issuance to fields is photo-evidenced.', placement: 'right' },
  { selector: '[data-tour="nav-approvals"]', title: 'Approvals', body: 'Where your sub-threshold and routed-to-you items live.', placement: 'right' },
  { selector: '[data-tour="kpi-pending-approvals"]', title: 'Quick KPI scan', body: 'Top row is your daily glance. Click any card for the drill-down.', placement: 'bottom' },
  { selector: '[data-tour="nav-reports"]', title: 'Reports', body: 'Generate per-field P&L, harvest summaries, labor cost reports.', placement: 'right' },
];

export const supervisorTour: TourStep[] = [
  { selector: '[data-tour="nav-dashboard"]', title: 'Your dashboard', body: 'Today’s tasks and the fields under your watch.', placement: 'right' },
  { selector: '[data-tour="nav-fields"]', title: 'Fields', body: 'Assign tasks and log inspections from any field.', placement: 'right' },
  { selector: '[data-tour="nav-diesel"]', title: 'Diesel logs', body: 'Verify worker submissions and flag anomalies.', placement: 'right' },
  { selector: '[data-tour="nav-repairs"]', title: 'Repairs', body: 'Approve sub-threshold repair quotes directly here.', placement: 'right' },
  { selector: '[data-tour="nav-approvals"]', title: 'Approvals queue', body: 'Items routed to you for sub-threshold sign-off.', placement: 'right' },
  { selector: '[data-tour="kpi-workers-present"]', title: 'Workers present', body: 'Confirm headcount matches your field plan.', placement: 'bottom' },
];

export const accountantTour: TourStep[] = [
  { selector: '[data-tour="nav-finance"]', title: 'Finance', body: 'Your home: journal, cost allocations, P&L per field.', placement: 'right' },
  { selector: '[data-tour="nav-procurement"]', title: 'Procurement', body: 'Vendor invoices and payable aging. Reconcile here.', placement: 'right' },
  { selector: '[data-tour="nav-sales"]', title: 'Sales', body: 'Mandi receipts, contract sales, receivable aging.', placement: 'right' },
  { selector: '[data-tour="nav-reports"]', title: 'Reports', body: 'Period exports to XLSX/PDF, GST/income-tax filing helpers.', placement: 'right' },
  { selector: '[data-tour="nav-compliance"]', title: 'Compliance', body: 'Tax filings, subsidy claims, lease deeds, mutations.', placement: 'right' },
];

export const auditorTour: TourStep[] = [
  { selector: '[data-tour="audit-banner"]', title: 'Read-only auditor session', body: 'You can view every record but cannot create, edit, or delete anything.', placement: 'bottom' },
  { selector: '[data-tour="nav-audit"]', title: 'Audit workspace', body: 'Per-period drill: source record → journal → approval chain. Export anything.', placement: 'right' },
];

export interface TourDefinition {
  id: string;
  steps: TourStep[];
  // Roles that should be auto-prompted with this tour on first dashboard load.
  autoStartRoles: UserRole[];
}

export const TOURS: Record<string, TourDefinition> = {
  'dashboard-director': {
    id: 'dashboard-director',
    steps: directorDashboardTour,
    autoStartRoles: ['director', 'super_admin'],
  },
  'dashboard-farm-manager': {
    id: 'dashboard-farm-manager',
    steps: farmManagerOnboardingTour,
    autoStartRoles: ['farm_manager'],
  },
  'dashboard-supervisor': {
    id: 'dashboard-supervisor',
    steps: supervisorTour,
    autoStartRoles: ['supervisor'],
  },
  'dashboard-accountant': {
    id: 'dashboard-accountant',
    steps: accountantTour,
    autoStartRoles: ['accountant'],
  },
  'dashboard-auditor': {
    id: 'dashboard-auditor',
    steps: auditorTour,
    autoStartRoles: ['auditor'],
  },
};

export function tourForRole(role: UserRole): TourDefinition | null {
  for (const def of Object.values(TOURS)) {
    if (def.autoStartRoles.includes(role)) return def;
  }
  return null;
}
