// The picture a link to this site turns into when somebody pastes it into a
// WhatsApp group.
//
// That is the main way anything travels here. The digest page exists to be
// copied into community groups; organizers share their event into one the hour
// they publish; the bazaar spreads by an auntie forwarding a shop. A link with
// no og:image renders as a grey box with a line of text under it, and in a
// feed of photographs it is the one nobody taps — so twenty-eight of this
// site's pages, including the home page and the whole bazaar, were arriving
// as grey boxes.
//
// Event and item pages have always had their own picture, and they keep it.
// This is the fallback for every page that has no photograph of its own: the
// festival calendar, the patro, /market, a department, /organizers.
//
// WHY AN SVG RENDERED BY SHARP, and not next/og's ImageResponse: sharp is
// already a dependency here (it makes every photo variant on the site), so
// this adds nothing to install and nothing to the bundle. ImageResponse would
// pull in a layout engine and, more to the point, would need a Devanagari font
// shipped and loaded to render a single Nepali word — and an OG image full of
// tofu boxes is worse than no OG image at all.
//
// That same reasoning is why there is NO NEPALI TEXT in this card. It is the
// one place on the site where text is rasterised on a server whose fonts we do
// not control, and the failure mode is silent: nobody sees the broken preview
// except the people we were trying to reach. The card is drawn from shapes and
// Latin text only, and the Nepali belongs on the page it links to.

/** 1200x630 — the size every chat app and social network crops from. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgCard {
  /** The wordmark, split the way the site's own logo splits it. */
  head: string;
  accent: string;
  /** One line under it. Latin only — see the note above. */
  tagline: string;
}

/** XML-escape, because a platform name comes from the environment. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The card as SVG. Pure — no sharp, no filesystem, no environment — so the
 * shape of it can be asserted in a test without rasterising anything.
 *
 * The composition is the site's own: the dark ground it uses everywhere, the
 * crimson double-pennant from components/Logo (a nod to Nepal's flag), the
 * two-tone wordmark, one line of explanation, and a violet glow in the corner
 * that matches the accent the whole site is built around. It is drawn large
 * because a preview card is usually seen at about 300px wide in a chat list.
 */
export function ogCardSvg({ head, accent, tagline }: OgCard): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="0.82" cy="0.18" r="0.62">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.40"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#DC143C"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>

  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#0a0b10"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>

  <!-- The pennant mark, the same path the header logo draws, scaled up. -->
  <g transform="translate(96 168) scale(7.2)">
    <path d="M4 1.5 L24 13 H11.5 L26 29 H4 Z" fill="#DC143C" stroke="#003893" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="10" cy="9.3" r="1.7" fill="#ffffff" opacity="0.92"/>
    <circle cx="10.5" cy="22.5" r="2.1" fill="#ffffff" opacity="0.92"/>
  </g>

  <!-- Generic families only, in the order a server is most likely to have
       one: this is rasterised wherever the app runs, and naming a font that
       is not installed loses the text silently. -->
  <text x="330" y="300" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="104" font-weight="700" fill="#ffffff">${esc(head)}<tspan fill="#DC143C">${esc(accent)}</tspan></text>
  <rect x="332" y="336" width="150" height="7" rx="3.5" fill="url(#rule)"/>
  <text x="330" y="416" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="41" fill="#c9cede">${esc(tagline)}</text>
</svg>`;
}
