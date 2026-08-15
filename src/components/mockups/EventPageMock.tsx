/**
 * Miniature public event page in a phone frame — pure CSS, no images.
 * Gradient cover with carousel dots, overlapping avatar, title, a Get
 * tickets button and two ticket-tier rows.
 */
export default function EventPageMock() {
  return (
    <div
      className="mock-scene"
      role="img"
      aria-label="Preview of a public event page on a phone: photo cover with carousel dots, event avatar, Dashain Night 2026 title, a Get tickets button and Standard and Student ticket tiers."
    >
      <div className="mock-tilt">
        <div className="mock-phone">
          <div className="mock-phone-screen">
            <span className="mock-phone-notch" />
            <div className="mock-cover">
              <div className="mock-cover-dots">
                <span className="mock-cdot mock-cdot-on" />
                <span className="mock-cdot" />
                <span className="mock-cdot" />
              </div>
            </div>
            <div className="mock-avatar">DN</div>
            <div className="mock-phone-body">
              <div className="mock-ev-title">Dashain Night 2026</div>
              <div className="mock-ev-meta">Sat 17 Oct &middot; Amsterdam</div>
              <span className="mock-btn-cta">Get tickets</span>
              <div className="mock-tier">
                <span>Standard</span>
                <span className="mock-tier-price">&euro;30</span>
              </div>
              <div className="mock-tier">
                <span>
                  Student
                  <span className="mock-tier-badge">ID</span>
                </span>
                <span className="mock-tier-price">&euro;18</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
