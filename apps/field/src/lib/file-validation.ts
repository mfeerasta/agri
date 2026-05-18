/**
 * Field-app copy of the magic-number MIME validator. Kept local rather than
 * lifted to @zameen/shared because validators are run in route handlers
 * that already depend on Next + Web API File/Blob.
 */

interface MagicEntry {
  bytes: number[];
  offset?: number;
}

const MAGIC_NUMBERS: Record<string, MagicEntry> = {
  'image/jpeg': { bytes: [0xff, 0xd8, 0xff] },
  'image/png': { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/webp': { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  'image/heic': { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], offset: 4 },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46] },
  'image/gif': { bytes: [0x47, 0x49, 0x46, 0x38] },
};

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  detectedMime?: string;
}

export interface FileValidationOptions {
  allowedMimes: string[];
  maxBytes: number;
}

export async function validateFileUpload(
  file: File | Blob,
  { allowedMimes, maxBytes }: FileValidationOptions,
): Promise<FileValidationResult> {
  if (file.size > maxBytes) {
    return { ok: false, error: `File too large (${file.size} > ${maxBytes})` };
  }
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let detected: string | undefined;
  for (const [mime, { bytes, offset = 0 }] of Object.entries(MAGIC_NUMBERS)) {
    if (bytes.every((b, i) => buf[offset + i] === b)) {
      detected = mime;
      break;
    }
  }
  if (!detected) return { ok: false, error: 'Unrecognised file type' };
  if (!allowedMimes.includes(detected)) {
    return { ok: false, error: `File type not allowed: ${detected}`, detectedMime: detected };
  }
  return { ok: true, detectedMime: detected };
}

export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
