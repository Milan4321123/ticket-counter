'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <label className="checkbox-row" htmlFor="ev-sales-open">
        <input
          id="ev-sales-open"
          type="checkbox"
          checked={salesOpen}
          onChange={(e) => setSalesOpen(e.target.checked)}
        />
        <span>
          <strong style={{ color: 'var(--text)' }}>Ticket sales open</strong> — switch off to pause sales without
          taking the page down (buyers see &ldquo;sales are closed&rdquo;).
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
