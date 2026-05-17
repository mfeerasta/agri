import * as React from 'react';

/**
 * Paper-grain noise layer. Renders as an absolutely-positioned SVG over a
 * container at 4% opacity multiply blend. Use inside a `relative` wrapper.
 */
export function Grain({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: 'multiply', opacity }}
    >
      <filter id="zameen-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.06  0 0 0 0 0.10  0 0 0 0 0.07  0 0 0 0.7 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#zameen-grain)" />
    </svg>
  );
}
