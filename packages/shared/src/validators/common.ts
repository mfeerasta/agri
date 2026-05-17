import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const pkrAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), 'Invalid PKR amount');

export const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const timestampIsoSchema = z.string().datetime({ offset: true });

export const photoUrlSchema = z.string().url();
export const photoUrlsSchema = z.array(photoUrlSchema).default([]);

export const gpsPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().optional(),
  capturedAt: timestampIsoSchema.optional(),
});

export const phonePkSchema = z
  .string()
  .regex(/^(\+92|0)?3\d{9}$/, 'Pakistani mobile number expected');
