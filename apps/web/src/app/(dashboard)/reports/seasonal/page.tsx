import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';
export default function SeasonalReport() {
  return (
    <div>
      <Masthead section="SEASONAL REVIEW" />
      <SectionDivider />
      <EmptyState title="Seasonal review" body="Pulls per-field yield from harvest_records + variance vs cropProfiles benchmark + cost from field-pnl. Render heavy ChartCards after data lands." />
    </div>
  );
}
