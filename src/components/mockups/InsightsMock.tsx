import BrowserFrame from './BrowserFrame';

/**
 * Miniature per-event Insights "screenshot" — pure CSS plus one inline SVG
 * sparkline, no images. Money chips, a sales-over-time curve, a two-row
 * guests table and the top-referrers footnote: enough to say "you will know
 * your crowd" without cramming the real page into a card.
 */
export default function InsightsMock() {
  return (
    <div
      className="mock-scene mock-scene-rev"
      role="img"
      aria-label="Preview of the event insights page: money received and on its way, the share of guests already checked in, a sales-over-time chart, a guests table showing each buyer's tickets and check-in status, and the top referrers."
    >
      <div className="mock-tilt">
        <BrowserFrame url="martnepali.com/portal/events/7/insights">
          <div className="mock-h1">Insights</div>
          <div className="mock-sub">Dashain Night 2026 &middot; selling</div>

          <div className="mock-chips">
            <div className="mock-chip mock-chip-green">
              <span className="mock-chip-label">Money received</span>
              <span className="mock-chip-value">&euro;2,180</span>
            </div>
            <div className="mock-chip mock-chip-amber">
              <span className="mock-chip-label">On its way</span>
              <span className="mock-chip-value">&euro;340</span>
            </div>
            <div className="mock-chip">
              <span className="mock-chip-label">Checked in</span>
              <span className="mock-chip-value">74%</span>
            </div>
          </div>

          <div className="mock-card">
            <div className="mock-chip-label">Sales over time</div>
            {/* preserveAspectRatio="none" lets the curve stretch with the
                card; non-scaling-stroke keeps the line 2px however wide it
                gets stretched. */}
            <svg
              className="mock-spark"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polygon
                points="0,26 14,24 28,25 42,19 56,16 70,17 84,9 100,5 100,30 0,30"
                fill="var(--brand)"
                opacity="0.12"
              />
              <polyline
                points="0,26 14,24 28,25 42,19 56,16 70,17 84,9 100,5"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="mock-card mock-card-gap">
            <div className="mock-chip-label">Guests</div>
            <div className="mock-guest-row">
              <span className="mock-guest-name">Anisha Rai</span>
              <span className="mock-guest-meta">4 tickets &middot; &euro;80</span>
              <span className="mock-guest-tick">&#10003; in</span>
            </div>
            <div className="mock-guest-row">
              <span className="mock-guest-name">Bikash Thapa</span>
              <span className="mock-guest-meta">2 tickets &middot; &euro;40</span>
              <span className="mock-guest-tick mock-guest-tick-dim">not yet</span>
            </div>
            <div className="mock-refs">
              Top referrers &middot; Anisha (6) &middot; Prakash (3)
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
