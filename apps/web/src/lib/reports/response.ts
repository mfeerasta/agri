import { renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap

export async function pdfResponse(doc: ReactElement<DocumentProps>, filename: string): Promise<Response> {
  const buf = await renderToBuffer(doc);
  if (buf.byteLength > MAX_BYTES) {
    return streamingBuffer(buf, filename, 'application/pdf');
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export function xlsxResponse(buf: Buffer, filename: string): Response {
  if (buf.byteLength > MAX_BYTES) {
    return streamingBuffer(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

function streamingBuffer(buf: Buffer, filename: string, mime: string): Response {
  const chunkSize = 64 * 1024;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= buf.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, buf.byteLength);
      controller.enqueue(new Uint8Array(buf.subarray(offset, end)));
      offset = end;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': mime,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export function badRequest(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export function serverError(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}
