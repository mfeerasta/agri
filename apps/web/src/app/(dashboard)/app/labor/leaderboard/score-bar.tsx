/**
 * Stacked-bar visualization of a worker's composite score.
 * Single bar with the score value to the right. Uses brand accent.
 */
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 border"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: `color-mix(in srgb, var(--accent) ${50 + pct / 2}%, var(--paper))`,
          }}
        />
      </div>
      <span className="tabular text-xs w-10 text-right">{score.toFixed(1)}</span>
    </div>
  );
}
