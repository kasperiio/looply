/**
 * Looply brand mark: a loop one step from closing, start dot at the top.
 * Single source of truth for the mark inside the app; public/favicon.svg,
 * public/icon-512.svg and the og-image repeat the same geometry for surfaces
 * React can't reach. Dash + gap must sum to the circumference 2*PI*20 = 125.66.
 */
export default function LooplyMark({ size = 24, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g transform="rotate(-90 32 32)">
        <circle
          cx="32"
          cy="32"
          r="20"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="101.7 24"
        />
      </g>
      <circle cx="32" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}
