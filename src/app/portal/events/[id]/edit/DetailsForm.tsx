'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoToTab from './GoToTab';
import ContactPhotoFramer from '@/components/ContactPhotoFramer';
import SpeechInput from '@/components/SpeechInput';
import { saveEvent } from './save';

interface Props {
  eventId: string;
  isDraft: boolean;
  initial: {
    name: string;
    artist: string;
    description: string;
    dateDisplay: string;
    eventDate: string; // '' when unset
    venueName: string;
    address: string;
    city: string;
    currency: string;
    totalCapacity: number;
    showRemaining: boolean;
    maxPerOrder: number;
    payWithinDays: number;
    salesOpen: boolean;
    whatsapp: string;
    whatsappName: string;
    /** The bubble's OWN photo, or '' — chosen right here, separate from below. */
    whatsappPhotoUrl: string;
    /** Which part of it sits in the circle, as CSS object-position. */
    whatsappFocus: string;
    /** The event's round profile photo, or '' — used only as a fallback. */
    profilePhotoUrl: string;
    /** The account name, used when no bubble name is set. */
    accountName: string;
  };
}

export default function DetailsForm({ eventId, isDraft, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [artist, setArtist] = useState(initial.artist);
  const [description, setDescription] = useState(initial.description);
  const [dateDisplay, setDateDisplay] = useState(initial.dateDisplay);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  const [venueName, setVenueName] = useState(initial.venueName);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [totalCapacity, setTotalCapacity] = useState(String(initial.totalCapacity));
  const [showRemaining, setShowRemaining] = useState(initial.showRemaining);
  const [maxPerOrder, setMaxPerOrder] = useState(String(initial.maxPerOrder));
  const [payWithinDays, setPayWithinDays] = useState(String(initial.payWithinDays));
  const [salesOpen, setSalesOpen] = useState(initial.salesOpen);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ? `+${initial.whatsapp}` : '');
  const [whatsappName, setWhatsappName] = useState(initial.whatsappName);
  /**
   * The bubble's own photo, held in state rather than read from `initial`, so an
   * upload shows immediately instead of after a refresh.
   *
   * It uploads on its own the moment a file is picked — it does NOT wait for
   * Save details. A file input cannot survive a form round-trip, and a photo
   * that appeared to be chosen but was silently dropped by pressing the wrong
   * button is worse than one extra request.
   */
  const [bubbleOwnPhoto, setBubbleOwnPhoto] = useState(initial.whatsappPhotoUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Percentages rather than the string, because the framer works in numbers.
  const [fx, setFx] = useState(() => Number.parseInt(initial.whatsappFocus.split(' ')[0], 10) || 50);
  const [fy, setFy] = useState(() => Number.parseInt(initial.whatsappFocus.split(' ')[1], 10) || 50);
  /** What the circle shows: its own photo, else the page's, else an initial. */
  const bubblePhoto = bubbleOwnPhoto || initial.profilePhotoUrl;

  async function uploadBubblePhoto(file: File) {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append('photo', file);
      const res = await fetch(`/api/portal/events/${eventId}/whatsapp-photo`, { method: 'POST', body });
      const data = (await res.json().catch(() => null)) as { photoUrl?: string; error?: string } | null;
      if (!res.ok || typeof data?.photoUrl !== 'string') {
        setPhotoError(data?.error ?? 'That photo could not be uploaded.');
        return;
      }
      setBubbleOwnPhoto(data.photoUrl);
      router.refresh();
    } catch {
      setPhotoError('Could not reach the server — please check your connection.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removeBubblePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/whatsapp-photo`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setPhotoError(data?.error ?? 'That photo could not be removed.');
        return;
      }
      setBubbleOwnPhoto('');
      router.refresh();
    } catch {
      setPhotoError('Could not reach the server — please check your connection.');
    } finally {
      setPhotoBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Description text as it was when dictation started; the live transcript
  // is appended after it, so interim words refine in place.
  const descSpeechBase = useRef('');

  function intOf(value: string, label: string, min: number, max: number): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      setError(`${label} must be a whole number between ${min} and ${max}.`);
      return null;
    }
    return n;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!name.trim()) {
      setError('Please give your event a name.');
      return;
    }
    const capacity = intOf(totalCapacity, 'Total capacity', 1, 200000);
    const perOrder = intOf(maxPerOrder, 'Max tickets per order', 1, 50);
    const payDays = intOf(payWithinDays, 'The payment deadline', 1, 30);
    if (capacity === null || perOrder === null || payDays === null) return;

    setBusy(true);
    const result = await saveEvent(eventId, {
      name: name.trim(),
      artist,
      description,
      dateDisplay,
      eventDate,
      venueName,
      address,
      city,
      totalCapacity: capacity,
      showRemaining,
      maxPerOrder: perOrder,
      payWithinDays: payDays,
      salesOpen,
      whatsapp,
      whatsappName,
      whatsappFocus: `${fx}% ${fy}%`,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    columnGap: 16,
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div style={grid}>
        <div className="field">
          <label htmlFor="ev-name">Event name</label>
          <input id="ev-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          {isDraft && (
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              While the event is a draft, renaming it also updates its web address.
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="ev-artist">Artist / act</label>
          <input
            id="ev-artist"
            className="input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={120}
            placeholder="Who is performing?"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ev-description">Description</label>
        <textarea
          id="ev-description"
          className="input"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={8000}
          placeholder="Tell people what makes this night special — the lineup, the atmosphere, what to expect."
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div className="speech-row">
          <SpeechInput
            label="Dictate the description"
            hint="Tap the mic and just talk — you can edit the text after."
            onStart={() => {
              descSpeechBase.current = description.trim() ? description.trimEnd() + ' ' : '';
            }}
            onText={(text) => setDescription(descSpeechBase.current + text)}
          />
        </div>
      </div>
      <div style={grid}>
        <div className="field">
          <label htmlFor="ev-date-display">Date, as shown to buyers</label>
          <input
            id="ev-date-display"
            className="input"
            value={dateDisplay}
            onChange={(e) => setDateDisplay(e.target.value)}
            maxLength={120}
            placeholder="e.g. Saturday, 24 October 2026 · Doors 19:00"
          />
        </div>
        <div className="field">
          <label htmlFor="ev-date">Calendar date (sorts the public feed)</label>
          <input
            id="ev-date"
            className="input"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>
      <div style={grid}>
        <div className="field">
          <label htmlFor="ev-venue">Venue name</label>
          <input
            id="ev-venue"
            className="input"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            maxLength={160}
            placeholder="e.g. Stadthalle"
          />
        </div>
        <div className="field">
          <label htmlFor="ev-address">Street address</label>
          <input
            id="ev-address"
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={240}
            placeholder="Street and number — feeds the Open in Maps link"
          />
        </div>
        <div className="field">
          <label htmlFor="ev-city">City</label>
          <input id="ev-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
        </div>
      </div>
      <div style={grid}>
        <div className="field">
          <label htmlFor="ev-capacity">Total capacity</label>
          <input
            id="ev-capacity"
            className="input"
            type="number"
            min={1}
            max={200000}
            value={totalCapacity}
            onChange={(e) => setTotalCapacity(e.target.value)}
          />
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            How many people the venue holds. Your event fee is worked out from this — the exact
            amount is on the Publish tab.
          </p>
          {/* There is no longer a way to opt out of the ceiling. The fee is
              priced from this number, so an event that could sell past it would
              be one where the fee and the tickets describe different events.
              Hiding the COUNT is a different question, and it is the switch
              below — which is what an organizer actually wanted when they
              reached for "no limit". */}
          <label className="checkbox-row" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={showRemaining}
              onChange={(e) => setShowRemaining(e.target.checked)}
            />
            <span>
              Show buyers how many tickets are left
              <span className="muted small" style={{ display: 'block' }}>
                Turn this OFF if you sell early-bird tickets. &ldquo;Only 8 left&rdquo; is read as
                the whole event nearly selling out, when it only means the cheap tier is nearly
                gone — and that puts people off an event with hundreds of seats free. Your limits
                still apply either way; this only decides whether the number is shown.
              </span>
            </span>
          </label>
        </div>
        <div className="field">
          <label htmlFor="ev-max-per-order">Max tickets per order</label>
          <input
            id="ev-max-per-order"
            className="input"
            type="number"
            min={1}
            max={50}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ev-pay-days">Bank transfer due within (days)</label>
          <input
            id="ev-pay-days"
            className="input"
            type="number"
            min={1}
            max={30}
            value={payWithinDays}
            onChange={(e) => setPayWithinDays(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ev-currency">Currency</label>
          <input id="ev-currency" className="input" value={initial.currency} disabled aria-label="Currency (fixed)" />
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            All events use EUR for now.
          </p>
        </div>
      </div>
      <div className="field" style={{ maxWidth: 640 }}>
        <label htmlFor="ev-whatsapp">Talk to buyers on WhatsApp (optional)</label>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Puts a bubble on your event page and on the payment page. Buyers tap it and reach{' '}
          <strong style={{ color: 'var(--text)' }}>you</strong>, with your event&rsquo;s name already
          in the message. It is the fastest way to settle the one thing people hesitate over before
          paying — whether the bank account is really yours. Leave the number empty and no bubble
          appears.
        </p>
        <div style={grid}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="ev-whatsapp-num" className="small">
              WhatsApp number
            </label>
            <input
              id="ev-whatsapp-num"
              className="input"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+49 170 1234567"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Start with your country code.
            </p>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="ev-whatsapp-name" className="small">
              Name on the bubble
            </label>
            <input
              id="ev-whatsapp-name"
              className="input"
              value={whatsappName}
              onChange={(e) => setWhatsappName(e.target.value)}
              placeholder={initial.accountName}
              maxLength={60}
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Whoever actually answers. Empty uses {initial.accountName}.
            </p>
          </div>
        </div>

        {/* The real bubble, with its own upload beside it. An organizer should
            not have to publish and open their own page to find out what their
            bubble looks like — and this photo is deliberately its own, not the
            page's profile photo: the face you want beside a WhatsApp number is
            usually a person, while the page's profile photo is often a logo. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
          }}
        >
          <span className="contact-fab-photo-wrap" style={{ position: 'relative', display: 'inline-flex' }}>
            {bubblePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bubblePhoto}
                alt=""
                className="contact-fab-photo"
                style={{
                  borderRadius: '50%',
                  // Only the bubble's own photo is framed here; the profile
                  // photo arrives already cropped.
                  ...(bubbleOwnPhoto ? { objectPosition: `${fx}% ${fy}%` } : {}),
                }}
              />
            ) : (
              <span className="contact-fab-photo contact-fab-initial" aria-hidden="true">
                {((whatsappName || initial.accountName).trim().charAt(0) || 'O').toUpperCase()}
              </span>
            )}
            <span className="contact-fab-wa-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" role="presentation">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.09c-.25.69-1.45 1.32-1.99 1.37-.53.05-1.02.24-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.37.26-.29.57-.36.76-.36l.54.01c.17 0 .41-.07.64.49.24.58.81 2 .88 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48l-.42.49c-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.69-.81.88-1.09.19-.29.38-.24.64-.14.26.09 1.66.78 1.95.93.28.14.47.21.54.33.07.12.07.69-.18 1.37Z" />
              </svg>
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700 }}>
              WhatsApp {(whatsappName || initial.accountName).trim().split(/\s+/)[0] || 'you'}
            </div>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              {photoError ? (
                <span style={{ color: 'var(--danger, #f87171)' }}>{photoError}</span>
              ) : bubbleOwnPhoto ? (
                <>This is your bubble, with the photo you chose for it.</>
              ) : initial.profilePhotoUrl ? (
                <>
                  Using your page&rsquo;s profile photo for now. Upload a different one here if you
                  want a person&rsquo;s face beside the number instead.
                </>
              ) : (
                <>A face gets far more messages than a letter. Upload one for the bubble.</>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* A plain file input behind a button: the styled label is the
                control, the input itself stays reachable by keyboard. */}
            <label className="btn btn-sm" style={{ cursor: photoBusy ? 'default' : 'pointer' }}>
              {photoBusy ? <span className="spinner" aria-hidden /> : null}
              {photoBusy ? 'Uploading…' : bubbleOwnPhoto ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                disabled={photoBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadBubblePhoto(f);
                }}
              />
            </label>
            {bubbleOwnPhoto && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={photoBusy}
                onClick={() => void removeBubblePhoto()}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Framing is a spatial job, so it gets a spatial control: the whole
            photo with a bright circle over the part that will show. Only for the
            bubble's own photo — a group shot centred on nobody is exactly the
            case this exists for. */}
        {bubbleOwnPhoto && (
          <div style={{ marginTop: 12 }}>
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Drag the circle to choose which part of the photo the bubble shows.
            </p>
            <ContactPhotoFramer
              photoUrl={bubbleOwnPhoto}
              fx={fx}
              fy={fy}
              onChange={(x, y) => {
                setFx(x);
                setFy(y);
              }}
            />
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              Press <strong style={{ color: 'var(--text)' }}>Save details</strong> to keep the framing.
            </p>
          </div>
        )}
      </div>
      <label className="checkbox-row" htmlFor="ev-sales-open">
        <input
          id="ev-sales-open"
          type="checkbox"
          checked={salesOpen}
          onChange={(e) => setSalesOpen(e.target.checked)}
        />
        <span>
          <strong style={{ color: 'var(--text)' }}>Ticket sales open</strong> — switch off to pause
          sales on the whole event without taking the page down. Buyers see{' '}
          <strong style={{ color: 'var(--text)' }}>Sales closed</strong>.
          <span className="muted small" style={{ display: 'block' }}>
            To announce a ticket instead of selling it, leave this on and set that ticket to{' '}
            <strong>Coming soon</strong> in the Tickets tab — it is a property of a ticket, not of
            the event.
          </span>
        </span>
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
