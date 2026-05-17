import { z } from 'zod';
import { photoUrlsSchema, timestampIsoSchema, uuidSchema } from './common.js';

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(4);

export const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ringSchema).min(1),
});

export const geoJsonMultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(ringSchema).min(1)).min(1),
});

export const fieldCreateSchema = z.object({
  blockId: uuidSchema,
  code: z.string().min(1).max(16),
  name: z.string().max(256).optional(),
  nameUr: z.string().max(256).optional(),
  acres: z.coerce.number().positive(),
  geometry: z.union([geoJsonPolygonSchema, geoJsonMultiPolygonSchema]),
  khasraNumbers: z.array(z.string()).default([]),
  khatooniNumber: z.string().max(32).optional(),
  tenure: z.enum(['owned', 'leased_in', 'leased_out', 'sharecropped']),
  tenureDetails: z.record(z.unknown()).optional(),
});
export type FieldCreateInput = z.infer<typeof fieldCreateSchema>;

export const fieldUpdateSchema = fieldCreateSchema.partial().extend({ id: uuidSchema });
export type FieldUpdateInput = z.infer<typeof fieldUpdateSchema>;

export const soilTestCreateSchema = z.object({
  fieldId: uuidSchema,
  testedOn: timestampIsoSchema,
  laboratory: z.string().max(256).optional(),
  ph: z.coerce.number().min(0).max(14).optional(),
  nitrogenPpm: z.coerce.number().nonnegative().optional(),
  phosphorusPpm: z.coerce.number().nonnegative().optional(),
  potassiumPpm: z.coerce.number().nonnegative().optional(),
  organicMatterPct: z.coerce.number().nonnegative().optional(),
  texture: z.string().max(32).optional(),
  salinityEc: z.coerce.number().nonnegative().optional(),
  reportPhotoUrls: photoUrlsSchema,
});
export type SoilTestCreateInput = z.infer<typeof soilTestCreateSchema>;
