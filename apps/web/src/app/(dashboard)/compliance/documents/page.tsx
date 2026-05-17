import Link from 'next/link';
import { db, documents } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const rows = await db.select().from(documents).orderBy(desc(documents.uploadedAt)).limit(200);
  return (
    <div>
      <Masthead section="DOCUMENTS" />
      <SectionDivider />
      <div className="flex justify-between mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">{rows.length} documents</div>
        <Link href={'/compliance/documents/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Upload</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>All documents</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No documents.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Title</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Type</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Issued</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
              </tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2"><a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a></td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{d.documentType}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(d.issuedOn)}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(d.expiresOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
