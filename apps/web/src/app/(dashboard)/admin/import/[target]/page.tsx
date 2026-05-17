import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { IMPORT_TARGETS, type ImportTargetKey } from '@/modules/admin/import-targets';
import { ImportRunner } from './import-runner';

export const dynamic = 'force-dynamic';

const KEYS: ImportTargetKey[] = ['fields', 'workers', 'inputs', 'vendors', 'buyers', 'diesel-purchases'];

export default async function ImportTargetPage({ params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  if (!KEYS.includes(target as ImportTargetKey)) notFound();
  const spec = IMPORT_TARGETS[target as ImportTargetKey];
  return (
    <div>
      <Masthead section={`IMPORT · ${spec.label.toUpperCase()}`} />
      <SectionDivider />
      <Link href={'/admin/import' as never} className="text-xs text-[var(--accent)] underline">
        ← back to import hub
      </Link>
      <Card className="mt-3">
        <CardContent className="p-4">
          <ImportRunner target={spec.key} />
        </CardContent>
      </Card>
    </div>
  );
}
