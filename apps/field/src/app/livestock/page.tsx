import Link from 'next/link';
import { BigButton } from '@zameen/ui';
import { Milk, Wheat, Stethoscope } from 'lucide-react';

export default function LivestockHome() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">مویشی</h1>
      <Link href={'/livestock/milk' as never}><BigButton icon={<Milk />} label="دودھ درج کریں" sublabel="Milk" tone="primary" /></Link>
      <Link href={'/livestock/feed' as never}><BigButton icon={<Wheat />} label="چارہ درج کریں" sublabel="Feed" tone="success" /></Link>
      <Link href={'/livestock/health' as never}><BigButton icon={<Stethoscope />} label="صحت / علاج" sublabel="Health" tone="warning" /></Link>
    </main>
  );
}
