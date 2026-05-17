/**
 * Vendor and workshop scorecard. Computed on demand from purchase/repair
 * history. Not cached because the read volume is low (handful of users
 * checking before raising a PO) and freshness matters.
 */
import { and, eq } from 'drizzle-orm';
import {
  db,
  vendors,
  purchaseOrders,
  goodsReceivedNotes,
  purchaseInvoices,
  repairQuotes,
  repairWorkOrders,
  repairRequests,
} from '@zameen/db';

export interface VendorScore {
  vendorId: string;
  vendorName: string;
  totalSpendPkr: number;
  orderCount: number;
  avgQuoteAccuracyPct: number;
  onTimeDeliveryPct: number;
  qcFailRate: number;
  daysToPayAvg: number;
}

export interface WorkshopScore {
  workshopName: string;
  repairCount: number;
  avgQuoteAccuracyPct: number;
  avgEtaAccuracyDays: number;
  warrantyFailureRate: number;
  totalSpendPkr: number;
}

function daysBetween(a: Date | string, b: Date | string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return (d2 - d1) / (1000 * 60 * 60 * 24);
}

export async function computeVendorScores(entityId: string): Promise<VendorScore[]> {
  const vendorRows = await db.select().from(vendors).where(eq(vendors.entityId, entityId));
  const out: VendorScore[] = [];

  for (const v of vendorRows) {
    const pos = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.vendorId, v.id), eq(purchaseOrders.entityId, entityId)));
    if (pos.length === 0) {
      out.push({
        vendorId: v.id,
        vendorName: v.name,
        totalSpendPkr: 0,
        orderCount: 0,
        avgQuoteAccuracyPct: 0,
        onTimeDeliveryPct: 0,
        qcFailRate: 0,
        daysToPayAvg: 0,
      });
      continue;
    }

    let onTime = 0;
    let onTimeDenom = 0;
    let qcFail = 0;
    let qcDenom = 0;

    for (const po of pos) {
      const grns = await db
        .select()
        .from(goodsReceivedNotes)
        .where(eq(goodsReceivedNotes.purchaseOrderId, po.id));
      for (const g of grns) {
        qcDenom += 1;
        if (!g.qualityCheckPassed) qcFail += 1;
        if (po.expectedDeliveryDate) {
          onTimeDenom += 1;
          if (new Date(g.receivedOn) <= new Date(po.expectedDeliveryDate)) onTime += 1;
        }
      }
    }

    const invs = await db
      .select()
      .from(purchaseInvoices)
      .where(and(eq(purchaseInvoices.vendorId, v.id), eq(purchaseInvoices.entityId, entityId)));

    const totalSpend = invs.reduce((s, i) => s + Number(i.totalPkr), 0);

    let accSum = 0;
    let accDenom = 0;
    for (const inv of invs) {
      if (!inv.purchaseOrderId) continue;
      const po = pos.find((p) => p.id === inv.purchaseOrderId);
      if (!po) continue;
      const quoted = Number(po.totalPkr);
      const billed = Number(inv.totalPkr);
      if (quoted <= 0) continue;
      const diffPct = Math.abs(billed - quoted) / quoted;
      accSum += Math.max(0, 1 - diffPct);
      accDenom += 1;
    }

    let payDays = 0;
    let payDenom = 0;
    for (const inv of invs) {
      if (inv.status === 'paid' && inv.dueDate) {
        payDays += daysBetween(inv.invoiceDate, new Date());
        payDenom += 1;
      }
    }

    out.push({
      vendorId: v.id,
      vendorName: v.name,
      totalSpendPkr: Number(totalSpend.toFixed(2)),
      orderCount: pos.length,
      avgQuoteAccuracyPct: accDenom > 0 ? Number(((accSum / accDenom) * 100).toFixed(1)) : 0,
      onTimeDeliveryPct: onTimeDenom > 0 ? Number(((onTime / onTimeDenom) * 100).toFixed(1)) : 0,
      qcFailRate: qcDenom > 0 ? Number(((qcFail / qcDenom) * 100).toFixed(1)) : 0,
      daysToPayAvg: payDenom > 0 ? Number((payDays / payDenom).toFixed(1)) : 0,
    });
  }

  return out.sort((a, b) => b.totalSpendPkr - a.totalSpendPkr);
}

export async function computeWorkshopScores(entityId: string): Promise<WorkshopScore[]> {
  const reqs = await db
    .select()
    .from(repairRequests)
    .where(eq(repairRequests.entityId, entityId));
  const reqIds = new Set(reqs.map((r) => r.id));
  const reqAssetByReq = new Map(reqs.map((r) => [r.id, r.assetId]));

  const allQuotes = await db.select().from(repairQuotes);
  const quotes = allQuotes.filter((q) => reqIds.has(q.repairRequestId));
  const allWos = await db.select().from(repairWorkOrders);
  const wos = allWos.filter((w) => reqIds.has(w.repairRequestId));

  const byShop = new Map<string, { quotes: typeof quotes; wos: typeof wos }>();
  for (const q of quotes) {
    if (!byShop.has(q.workshopName)) byShop.set(q.workshopName, { quotes: [], wos: [] });
    byShop.get(q.workshopName)!.quotes.push(q);
  }
  for (const w of wos) {
    const q = quotes.find((qq) => qq.id === w.selectedQuoteId);
    if (!q) continue;
    if (!byShop.has(q.workshopName)) byShop.set(q.workshopName, { quotes: [], wos: [] });
    byShop.get(q.workshopName)!.wos.push(w);
  }

  const out: WorkshopScore[] = [];
  for (const [name, { wos: shopWos }] of byShop.entries()) {
    let accSum = 0;
    let accDenom = 0;
    let etaSum = 0;
    let etaDenom = 0;
    let totalSpend = 0;
    let warrFails = 0;
    let warrDenom = 0;

    for (const w of shopWos) {
      const q = quotes.find((qq) => qq.id === w.selectedQuoteId);
      if (!q) continue;
      const quoted = Number(q.totalQuotePkr);
      if (w.finalInvoicePkr && quoted > 0) {
        const billed = Number(w.finalInvoicePkr);
        accSum += Math.max(0, 1 - Math.abs(billed - quoted) / quoted);
        accDenom += 1;
        totalSpend += billed;
      }
      if (w.expectedCompletionAt && w.actualCompletionAt) {
        etaSum += daysBetween(w.expectedCompletionAt, w.actualCompletionAt);
        etaDenom += 1;
      }
      if (w.warrantyEnd && w.actualCompletionAt) {
        warrDenom += 1;
        const assetId = reqAssetByReq.get(w.repairRequestId);
        if (assetId) {
          const subsequent = reqs.find(
            (rr) =>
              rr.assetId === assetId &&
              new Date(rr.reportedAt) > new Date(w.actualCompletionAt!) &&
              new Date(rr.reportedAt) < new Date(w.warrantyEnd!),
          );
          if (subsequent) warrFails += 1;
        }
      }
    }

    out.push({
      workshopName: name,
      repairCount: shopWos.length,
      avgQuoteAccuracyPct: accDenom > 0 ? Number(((accSum / accDenom) * 100).toFixed(1)) : 0,
      avgEtaAccuracyDays: etaDenom > 0 ? Number((etaSum / etaDenom).toFixed(1)) : 0,
      warrantyFailureRate: warrDenom > 0 ? Number(((warrFails / warrDenom) * 100).toFixed(1)) : 0,
      totalSpendPkr: Number(totalSpend.toFixed(2)),
    });
  }

  return out.sort((a, b) => b.totalSpendPkr - a.totalSpendPkr);
}
