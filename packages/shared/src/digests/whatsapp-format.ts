/**
 * WhatsApp digest formatter. Plain text, kept under 1024 chars so it
 * always fits in one message. Links back to the approver PWA queue
 * instead of trying to render full context inline.
 */

import type { DailyDigest } from './builders.js';

const APPROVER_PWA_BASE = 'https://approve.agri.feerasta.ai';
const MAX_LEN = 1024;

function pkrShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n.toFixed(0)}`;
}

export function dailyDigestToWhatsApp(digest: DailyDigest): string {
  const y = digest.yesterday;
  const lines = [
    `Zameen daily: ${digest.entityName}`,
    `${digest.date}`,
    '',
    `Yesterday:`,
    `- Tasks ${y.tasksCompleted} done, ${y.tasksOpen} open`,
    `- Attendance ${y.workersPresent}/${y.workersExpected}`,
    `- Diesel ${y.dieselConsumedLiters.toFixed(0)}L (Rs ${pkrShort(y.dieselCostPkr)})`,
    `- Repairs opened ${y.repairOpensCount}`,
    `- Anomalies ${y.anomaliesFlagged}`,
    '',
    `Today: ${digest.today.tasksScheduled} tasks scheduled`,
    '',
    `Pending approvals: ${digest.pendingApprovals.length}`,
    `Queue: ${APPROVER_PWA_BASE}`,
  ];

  let out = lines.join('\n');
  if (out.length > MAX_LEN) {
    out = `${out.slice(0, MAX_LEN - 15)}\n[truncated]`;
  }
  return out;
}
