import BrowserFrame from './BrowserFrame';

const STEPS = ['Details', 'Photos', 'Tickets', 'Design', 'Story', 'Bank', 'Publish'];

/**
 * Miniature event-editor "screenshot" — pure CSS, no images. Numbered steps
 * sidebar, a filled-in details form, a photo thumbnail row and a crimson
 * Save button.
 */
export default function EditorMock() {
  return (
    <div
      className="mock-scene mock-scene-rev"
      role="img"
      aria-label="Preview of the event editor: a seven-step sidebar from Details to Publish, a form with the event name, date and venue filled in, photo thumbnails and a Save button."
    >
      <div className="mock-tilt">
        <BrowserFrame url="martnepali.com/portal/events/7/edit">
          <div className="mock-editor">
            <div className="mock-steps">
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`mock-step${i === 0 ? ' mock-step-active' : ''}`}
                >
                  <span className="mock-step-num">{i + 1}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="mock-form">
              <div className="mock-field">
                <div className="mock-label">Event name</div>
                <div className="mock-input">Dashain Night 2026</div>
              </div>
              <div className="mock-field-row">
                <div className="mock-field">
                  <div className="mock-label">Date</div>
                  <div className="mock-input">Sat 17 Oct &middot; 19:00</div>
                </div>
                <div className="mock-field">
                  <div className="mock-label">Venue</div>
                  <div className="mock-input">De Meervaart, Amsterdam</div>
                </div>
              </div>
              <div className="mock-field">
                <div className="mock-label">Photos</div>
                <div className="mock-thumbs">
                  <span className="mock-thumb mock-thumb-a" />
                  <span className="mock-thumb mock-thumb-b" />
                  <span className="mock-thumb mock-thumb-c" />
                  <span className="mock-thumb mock-thumb-add">+</span>
                </div>
              </div>
              <div className="mock-form-foot">
                <span className="mock-btn mock-btn-brand">Save</span>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
