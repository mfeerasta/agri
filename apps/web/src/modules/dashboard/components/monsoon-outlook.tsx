import { fetchMonsoonForecast } from '@zameen/shared';

const INTENSITY_LABEL: Record<'below_normal' | 'normal' | 'above_normal', string> = {
  below_normal: 'Below normal',
  normal: 'Normal',
  above_normal: 'Above normal',
};

const INTENSITY_BG: Record<'below_normal' | 'normal' | 'above_normal', string> = {
  below_normal: 'bg-amber-50 border-amber-300 text-amber-900',
  normal: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  above_normal: 'bg-sky-50 border-sky-300 text-sky-900',
};

export async function MonsoonOutlook() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  if (month < 5 || month > 9) return null; // only show May - September
  const forecast = await fetchMonsoonForecast(now.getUTCFullYear());
  if (!forecast) {
    return (
      <section className="rounded border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold">Monsoon outlook</h3>
        <p className="mt-2 text-xs text-stone-500">Forecast unavailable.</p>
      </section>
    );
  }
  return (
    <section className={`rounded border p-4 ${INTENSITY_BG[forecast.expectedIntensity]}`}>
      <h3 className="text-sm font-semibold">Monsoon outlook</h3>
      <p className="mt-1 text-sm">
        Expected onset: <strong>{forecast.predictedOnsetDate}</strong>
      </p>
      <p className="text-sm">
        Intensity: <strong>{INTENSITY_LABEL[forecast.expectedIntensity]}</strong>
      </p>
      <p className="mt-1 text-xs opacity-80">
        Confidence {forecast.confidenceLevel} | source {forecast.source}
      </p>
    </section>
  );
}
