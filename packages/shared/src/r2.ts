/**
 * Cloudflare R2 presign client.
 *
 * Photo evidence (receipts, repair items, attendance) is uploaded directly
 * from the field PWA to R2 via presigned PUT URLs so we never proxy binary
 * data through Next.js. GETs are also presigned because the bucket is private.
 */

import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials missing');
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function bucket(): string {
  const b = process.env.CLOUDFLARE_R2_BUCKET;
  if (!b) throw new Error('CLOUDFLARE_R2_BUCKET not set');
  return b;
}

export interface PresignedPut {
  url: string;
  headers: Record<string, string>;
}

/**
 * Issue a short-lived PUT URL. Mandatory for field-PWA uploads, which must
 * not proxy binary data through Next.js server routes.
 */
export async function presignPut({
  key,
  contentType,
  expiresSec = 600,
}: {
  key: string;
  contentType: string;
  expiresSec?: number;
}): Promise<PresignedPut> {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  const url = await getSignedUrl(client(), cmd, { expiresIn: expiresSec });
  return { url, headers: { 'Content-Type': contentType } };
}

/** Issue a short-lived GET URL so private R2 objects can be rendered. */
export async function presignGet({
  key,
  expiresSec = 600,
}: {
  key: string;
  expiresSec?: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(client(), cmd, { expiresIn: expiresSec });
}

/** Hard delete a single object. Audit log row should be written by caller. */
export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
