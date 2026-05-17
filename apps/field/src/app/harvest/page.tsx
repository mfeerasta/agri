import Link from 'next/link';
import { BigButton } from '@zameen/ui';
import { Wheat } from 'lucide-react';

export default function HarvestHome() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">کٹائی</h1>
      <Link href={'/harvest/new' as never}>
        <BigButton icon={<Wheat />} label="نئی کٹائی درج کریں" sublabel="New harvest entry" tone="primary" />
      </Link>
    </main>
  );
}
