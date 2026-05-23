'use server';

/**
 * Source-record integration helpers. When a forward_contract or
 * lease_contract row is created, the owning module calls
 * `bootstrapEnvelopeForRecord` to spin up a signing envelope without
 * forcing the caller to know about envelope mechanics.
 */

import { createEnvelope } from './actions';
import type { CreateEnvelopeInput } from '@zameen/shared';

export interface BootstrapInput {
  entityId: string;
  title: string;
  documentKind: 'lease_contract' | 'forward_contract' | 'vendor_agreement' | 'employment_contract';
  sourceRecordKind: 'lease_contract' | 'forward_contract' | 'vendor_agreement' | 'employment_contract';
  sourceRecordId: string;
  pdfStorageUrl: string;
  pdfSha256: string;
  expiresAt?: string;
  signers: CreateEnvelopeInput['signers'];
}

export async function bootstrapEnvelopeForRecord(input: BootstrapInput) {
  return createEnvelope({
    entityId: input.entityId,
    title: input.title,
    documentKind: input.documentKind,
    sourceRecordKind: input.sourceRecordKind,
    sourceRecordId: input.sourceRecordId,
    pdfStorageUrl: input.pdfStorageUrl,
    pdfSha256: input.pdfSha256,
    expiresAt: input.expiresAt,
    signers: input.signers,
  });
}
