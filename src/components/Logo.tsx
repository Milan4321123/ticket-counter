/**
 * NepaliConcert logo lockup: a crimson double-pennant mark (a nod to Nepal's
 * flag — two stacked triangles with subtle white moon/sun dots) next to the
 * two-tone wordmark. Pure inline SVG + text, so it renders crisply at any
 * size — small in the sticky header, larger in the footer and feed hero.
 */
export default function Logo({ size = 24 }: { size?: number }) {
  const markWidth = Math.round((size * 28) / 32);
  return (
    <span className="logo-lockup" style={{ gap: Math.max(6, Math.round(size * 0.3)) }}>
      <svg
        width={markWidth}
        height={size}
        viewBox="0 0 28 32"
        aria-hidden="true"
        focusable="false"
      >
        {/* Double pennant with the flag's deep-blue border */}
        <path
          d="M4 1.5 L24 13 H11.5 L26 29 H4 Z"
          fill="#DC143C"
          stroke="#003893"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Moon (upper pennant) and sun (lower pennant), kept as subtle dots */}
        <circle cx="10" cy="9.3" r="1.7" fill="#fff" opacity="0.92" />
        <circle cx="10.5" cy="22.5" r="2.1" fill="#fff" opacity="0.92" />
      </svg>
      <span className="logo-word" style={{ fontSize: Math.round(size * 0.84) }}>
        <span className="logo-word-np">Nepali</span>
        <span className="logo-word-co">Concert</span>
      </span>
    </span>
  );
}
