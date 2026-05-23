import { NextResponse } from 'next/server';
import { safeStringify, toUserMessage, errorStatus } from '@zameen/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  validateFileUpload,
  DOCUMENT_MIMES,
  DOCUMENT_MAX_BYTES,
} from '@/lib/file-validation';

const BUCKET = 'zameen-compliance-documents';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const verdict = await validateFileUpload(file, {
      allowedMimes: DOCUMENT_MIMES,
      maxBytes: DOCUMENT_MAX_BYTES,
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error ?? 'invalid file' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${userData.user.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: verdict.detectedMime ?? file.type,
      cacheControl: '3600',
    });
    if (error) {
      console.error(safeStringify({ scope: 'uploads/compliance-document', err: String(error) }));
      return NextResponse.json({ error: 'upload failed' }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (e) {
    console.error(safeStringify({ scope: 'uploads/compliance-document', err: String(e) }));
    return NextResponse.json({ error: toUserMessage(e) }, { status: errorStatus(e) });
  }
}
