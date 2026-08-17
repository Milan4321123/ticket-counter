import { platformWordmark } from '@/lib/platform';

/**
 * The logo lockup: a crimson double-pennant mark (a nod to Nepal's flag — two
 * stacked triangles with subtle white moon/sun dots) next to the two-tone
 * wordmark. Pure inline SVG + text, so it renders crisply at any size — small
 * in the sticky header, larger in the footer and feed hero.
 *
 * The wordmark used to be the two literal strings "Nepali" and "Concert", which
 * meant PLATFORM_NAME renamed the emails and the page titles while the logo on
 * every single page carried on showing the old name. It now comes from the same
 * splitter the email masthead uses.
 *
 * Every call site is a server component, so reading the environment here is
 * fine; if one ever becomes a client component this needs to arrive as a prop.
 */
export default function Logo({ size = 24 }: { size?: number }) {
  const { head, accent } = platformWordmark();
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
        <span className="logo-word-np">{head}</span>
        {accent && <span className="logo-word-co">{accent}</span>}
      </span>
    </span>
  );
}
