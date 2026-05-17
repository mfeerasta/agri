'use client';
import { compressImage } from './photo-compress.js';
import { enqueuePhoto } from './offline-queue.js';

export async function uploadPhotoToR2(file: File, prefix = 'field'): Promise<string> {
  const compressed = await compressImage(file);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueuePhoto({
      blob: compressed,
      contentType: compressed.type,
      targetResource: prefix,
      targetField: 'photoUrls',
    });
    // Return a tombstone URL; server-side action should treat queued: prefix as deferred.
    return `queued:${prefix}:${Date.now()}`;
  }
  const presignRes = await fetch('/api/uploads/r2-presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: compressed.type, prefix }),
  });
  if (!presignRes.ok) throw new Error('Could not get upload URL');
  const { uploadUrl, publicUrl } = (await presignRes.json()) as { uploadUrl: string; publicUrl: string };
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': compressed.type },
    body: compressed,
  });
  if (!put.ok) throw new Error('Upload failed');
  return publicUrl;
}
