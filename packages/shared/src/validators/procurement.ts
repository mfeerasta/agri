import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const vendorCreateSchema = z.object({
  entityId: uuidSchema,
  code: z.string().min(1).max(24),
  name: z.string().min(1).max(256),
  nameUr: z.string().max(256).optional(),
  category: z.string().max(32).optional(),
  phone: z.string().max(24).optional(),
  address: z.string().max(1024).optional(),
  ntn: z.string().max(32).optional(),
  creditTermsDays: z.coerce.number().int().nonnegative().default(0),
});
export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;

export const poLineSchema = z.object({
  inputId: uuidSchema.optional(),
  description: z.string().min(1).max(256),
  qty: z.coerce.number().positive(),
  unit: z.string().min(1).max(16),
  unitPricePkr: z.coerce.number().nonnegative(),
});

export const purchaseOrderCreateSchema = z
  .object({
    entityId: uuidSchema,
    vendorId: uuidSchema,
    poDate: dateIsoSchema,
    expectedDeliveryDate: dateIsoSchema.optional(),
    lines: z.array(poLineSchema).min(1),
    taxPkr: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(2000).optional(),
  })
  .transform((v) => {
    const subtotalPkr = Number(
      v.lines.reduce((a, l) => a + l.qty * l.unitPricePkr, 0).toFixed(2),
    );
    const totalPkr = Number((subtotalPkr + v.taxPkr).toFixed(2));
    return { ...v, subtotalPkr, totalPkr };
  });
export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>;

export const grnCreateSchema = z.object({
  purchaseOrderId: uuidSchema,
  receivedOn: dateIsoSchema,
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(256),
        qtyOrdered: z.coerce.number().nonnegative(),
        qtyReceived: z.coerce.number().nonnegative(),
        unit: z.string().min(1).max(16),
      }),
    )
    .min(1),
  qualityCheckPassed: z.boolean().default(true),
  qcNotes: z.string().max(2000).optional(),
  photoUrls: photoUrlsSchema,
});
export type GrnCreateInput = z.infer<typeof grnCreateSchema>;

export const purchaseInvoiceSchema = z.object({
  entityId: uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  vendorId: uuidSchema,
  invoiceNumber: z.string().min(1).max(64),
  invoiceDate: dateIsoSchema,
  dueDate: dateIsoSchema.optional(),
  subtotalPkr: pkrAmountSchema,
  taxPkr: pkrAmountSchema,
  totalPkr: pkrAmountSchema,
  invoicePhotoUrls: photoUrlsSchema,
});
export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceSchema>;

export const invoicePaymentSchema = z.object({
  invoiceId: uuidSchema,
  paidOn: dateIsoSchema,
  amountPkr: pkrAmountSchema,
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'card']),
  reference: z.string().max(128).optional(),
});
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;
