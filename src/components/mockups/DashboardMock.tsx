import BrowserFrame from './BrowserFrame';

/**
 * Miniature organizer dashboard "screenshot" — pure CSS, no images.
 * Money chips, one live event card with a capacity meter and the
 * Edit / Orders / Check-in actions.
 */
export default function DashboardMock() {
  return (
    <div
      className="mock-scene"
      role="img"
      aria-label="Preview of the organizer dashboard: money received and awaiting payment at a glance, and an event card with a capacity meter and Edit, Orders and Check-in buttons."
    >
      <div className="mock-tilt">
        <BrowserFrame url="nepaliconcert.com/portal">
          <div className="mock-h1">Namaste, Anita</div>
          <div className="mock-sub">Plan active &middot; 1 event live</div>

          <div className="mock-chips">
            <div className="mock-chip mock-chip-green">
              <span className="mock-chip-label">Money received</span>
              <span className="mock-chip-value">&euro;1,240</span>
            </div>
            <div className="mock-chip mock-chip-amber">
              <span className="mock-chip-label">Awaiting</span>
              <span className="mock-chip-value">&euro;260</span>
            </div>
          </div>

          <div className="mock-card">
            <div className="mock-card-row">
              <span className="mock-card-title">Dashain Night 2026</span>
              <span className="mock-badge-live">Live</span>
            </div>
            <div className="mock-card-meta">Sat 17 Oct &middot; De Meervaart, Amsterdam</div>
            <div className="mock-meter">
              <span className="mock-meter-track">
                <span className="mock-meter-fill" />
              </span>
              <span className="mock-meter-num">86 / 120 sold</span>
            </div>
            <div className="mock-btns">
              <span className="mock-btn">Edit</span>
              <span className="mock-btn">Orders</span>
              <span className="mock-btn mock-btn-brand">Check-in</span>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
