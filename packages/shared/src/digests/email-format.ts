/**
 * Weekly digest email formatter. Renders inline HTML plus a plain-text
 * fallback. Charts are server-rendered SVGs so the email never depends on
 * a remote image host.
 */

import type { WeeklyDigest } from './builders.js';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const PAPER = '#faf7f1';

function pkr(n: number): string {
  return `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function kg(n: number): string {
  return `${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })} kg`;
}

function yieldBarChart(data: Record<string, number>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return `<div style="padding:16px;color:#888;font-style:italic;">No harvest recorded this week.</div>`;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const width = 480;
  const barHeight = 22;
  const gap = 10;
  const labelWidth = 110;
  const chartWidth = width - labelWidth - 60;
  const height = entries.length * (barHeight + gap) + 10;

  const rows = entries
    .map(([name, value], i) => {
      const y = i * (barHeight + gap) + 4;
      const barLen = Math.max(2, (value / max) * chartWidth);
      return [
        `<text x="0" y="${y + 15}" font-family="system-ui,sans-serif" font-size="12" fill="#222">${escapeXml(name)}</text>`,
        `<rect x="${labelWidth}" y="${y}" width="${barLen}" height="${barHeight}" fill="${DEEP_GREEN}" rx="3" />`,
        `<text x="${labelWidth + barLen + 6}" y="${y + 15}" font-family="system-ui,sans-serif" font-size="12" fill="#333">${kg(value)}</text>`,
      ].join('');
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function costTable(data: Record<string, number>): string {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) {
    return `<p style="color:#888;font-style:italic;">No costs allocated this week.</p>`;
  }
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const rows = entries
    .map(
      ([pool, amount]) => `
    <tr>
      <td style="padding:6px 10px;border-top:1px solid #eee;text-transform:capitalize;">${escapeXml(pool.replace(/_/g, ' '))}</td>
      <td style="padding:6px 10px;border-top:1px solid #eee;text-align:right;">${pkr(amount)}</td>
      <td style="padding:6px 10px;border-top:1px solid #eee;text-align:right;color:#666;">${((amount / total) * 100).toFixed(1)}%</td>
    </tr>`,
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:${PAPER};">
          <th style="padding:6px 10px;text-align:left;">Category</th>
          <th style="padding:6px 10px;text-align:right;">Amount</th>
          <th style="padding:6px 10px;text-align:right;">Share</th>
        </tr>
      </thead>
      <tbody>${rows}
        <tr>
          <td style="padding:8px 10px;border-top:2px solid ${DEEP_GREEN};font-weight:600;">Total</td>
          <td style="padding:8px 10px;border-top:2px solid ${DEEP_GREEN};text-align:right;font-weight:600;">${pkr(total)}</td>
          <td style="padding:8px 10px;border-top:2px solid ${DEEP_GREEN};text-align:right;">100%</td>
        </tr>
      </tbody>
    </table>`;
}

export interface WeeklyEmailPayload {
  subject: string;
  html: string;
  text: string;
}

export function weeklyDigestToEmail(digest: WeeklyDigest): WeeklyEmailPayload {
  const subject = `${digest.entityName} weekly digest, ${digest.weekStart} to ${digest.weekEnd}`;

  const anomaliesList =
    digest.topAnomalies.length === 0
      ? `<li style="color:#888;font-style:italic;">No anomalies flagged this week.</li>`
      : digest.topAnomalies
          .map(
            (a) =>
              `<li><strong>[${escapeXml(a.severity)}]</strong> ${escapeXml(a.kind)}: ${escapeXml(a.description)}</li>`,
          )
          .join('');

  const upcomingList =
    digest.upcomingDates.length === 0
      ? `<li style="color:#888;font-style:italic;">No scheduled tasks in the coming week.</li>`
      : digest.upcomingDates
          .map((u) => `<li><strong>${escapeXml(u.when)}</strong>: ${escapeXml(u.what)}</li>`)
          .join('');

  const decisionsList =
    digest.decisionsBySender.length === 0
      ? `<li style="color:#888;font-style:italic;">No approval decisions this week.</li>`
      : digest.decisionsBySender
          .map(
            (d) =>
              `<li>${escapeXml(d.approverName)}: ${d.approvedCount} approved, ${d.rejectedCount} rejected</li>`,
          )
          .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escapeXml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f5f1ea;font-family:system-ui,sans-serif;color:#222;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d6;">
    <div style="background:${DEEP_GREEN};padding:24px 28px;">
      <div style="font-size:22px;font-weight:700;color:${OCHRE};">Zameen</div>
      <div style="font-size:14px;color:#fff;margin-top:4px;">${escapeXml(digest.entityName)} week of ${escapeXml(digest.weekStart)}</div>
    </div>
    <div style="padding:28px;line-height:1.55;">
      <h2 style="margin:0 0 12px 0;font-size:18px;">Yield this week</h2>
      ${yieldBarChart(digest.yieldKgByCrop)}

      <h2 style="margin:24px 0 12px 0;font-size:18px;">Cost breakdown</h2>
      ${costTable(digest.costsByCategoryPkr)}

      <h2 style="margin:24px 0 12px 0;font-size:18px;">Top anomalies</h2>
      <ul style="padding-left:18px;margin:0;">${anomaliesList}</ul>

      <h2 style="margin:24px 0 12px 0;font-size:18px;">Approval decisions</h2>
      <ul style="padding-left:18px;margin:0;">${decisionsList}</ul>

      <h2 style="margin:24px 0 12px 0;font-size:18px;">Upcoming dates</h2>
      <ul style="padding-left:18px;margin:0;">${upcomingList}</ul>
    </div>
    <div style="padding:16px 28px;background:${PAPER};border-top:1px solid #eee;font-size:12px;color:#666;">
      Sent by Zameen. Adjust digests at agri.feerasta.ai/admin/digests
    </div>
  </div>
</body></html>`;

  const text = [
    `${digest.entityName} weekly digest`,
    `Week of ${digest.weekStart} to ${digest.weekEnd}`,
    '',
    'Yield:',
    ...Object.entries(digest.yieldKgByCrop).map(([k, v]) => `  ${k}: ${kg(v)}`),
    '',
    'Costs:',
    ...Object.entries(digest.costsByCategoryPkr).map(([k, v]) => `  ${k}: ${pkr(v)}`),
    '',
    `Anomalies: ${digest.topAnomalies.length}`,
    `Upcoming tasks: ${digest.upcomingDates.length}`,
    '',
    'agri.feerasta.ai/admin/digests',
  ].join('\n');

  return { subject, html, text };
}
