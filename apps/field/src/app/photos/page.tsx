'use client';
import * as React from 'react';
import { Card, CardContent } from '@zameen/ui';

export default function PhotosQueuePage() {
  const [pending, setPending] = React.useState(0);
  React.useEffect(() => {
    // Stub: read pending photos count from IDB queue. Wired up in lib/offline-queue.
    setPending(0);
  }, []);
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">تصاویر کی قطار</h1>
      <Card>
        <CardContent>
          <p className="urdu text-sm">{pending} تصاویر بھیجنے کے لیے باقی</p>
        </CardContent>
      </Card>
    </main>
  );
}
