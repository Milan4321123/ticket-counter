'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoToTab from './GoToTab';
import ContactPhotoFramer from '@/components/ContactPhotoFramer';
import SpeechInput from '@/components/SpeechInput';
import { saveEvent } from './save';
import { SHOP_CATEGORIES } from '@/lib/categories';
import { ONLINE_CLOSE_CHOICES, onlineSales, wallClockLabel } from '@/lib/onlineSales';
import OnlineSalesSwitch from '../../../OnlineSalesSwitch';
import { vocabFor } from '@/lib/vocab';
import type { EventKind } from '@/lib/types';

interface Props {
  eventId: string;
  isDraft: boolean;
  kind: EventKind;
  /**
   * Online sales right now, as the server sees them (lib/onlineSales). Read
   * from props, not copied into state, so "Stop online sales now" shows its
   * new answer the moment the page refreshes.
   */
  online: { closed: boolean; reason: 'stopped' | 'clock' | null; clockPassed: boolean; closesLabel: string | null; counter: boolean };
  initial: {
    name: string;
    artist: string;
    description: string;
    dateDisplay: string;
    eventDate: string; // '' when unset
    venueName: string;
    pickupInfo: string;
    /** Shops only: a lib/categories key, or '' while none is picked. */
    category: string;
    address: string;
    city: string;
    currency: string;
    totalCapacity: number;
    showRemaining: boolean;
    maxPerOrder: number;
    payWithinDays: number;
    salesOpen: boolean;
    /** 'HH:MM' the show starts, or ''. Events only. */
    showTime: string;
    /** Minutes before the start that online sales close; null = never. */
    onlineCloseMin: number | null;
    counterSales: boolean;
    counterNote: string;
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

/** "Saturday 24 October 2026 · Doors 19:00", from the calendar date and doors time. */
// Spelled out by hand: the server's and the browser's date formatting disagree
// ("Saturday 17 October" vs "Saturday, 17 October"), and that difference
// rendered a different form on each side (a hydration error).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function writtenDate(date: string, doors: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const day = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return doors ? `${day} · Doors ${doors}` : day;
}
/** The same date written with or without commas is not "written by hand". */
const sameWritten = (a: string, b: string) => a.replace(/,/g, '').replace(/\s+/g, ' ').trim() === b.replace(/,/g, '').replace(/\s+/g, ' ').trim();

export default function DetailsForm({ eventId, isDraft, kind, online, initial }: Props) {
  const router = useRouter();
  // A shop and an event fill in different halves of this form: a shop has no
  // date and no line-up, and answers "when do I come and get it?" instead.
  // Everything they share — money, limits, WhatsApp, photos — is untouched.
  const isShop = kind === 'shop';
  const v = vocabFor(kind);
  const [name, setName] = useState(initial.name);
  const [artist, setArtist] = useState(initial.artist);
  const [description, setDescription] = useState(initial.description);
  const [dateDisplay, setDateDisplay] = useState(initial.dateDisplay);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  // The written-out date is built from the calendar date and the doors time,
  // so an organizer picks a day once instead of typing it twice. A text that
  // was written by hand (and does not match what we would build) stays theirs.
  const [doors, setDoors] = useState(() => initial.dateDisplay.match(/Doors (\d{1,2}:\d{2})/)?.[1] ?? '');
  const [customDate, setCustomDate] = useState(
    () =>
      initial.dateDisplay.trim() !== '' &&
      !sameWritten(initial.dateDisplay, writtenDate(initial.eventDate, initial.dateDisplay.match(/Doors (\d{1,2}:\d{2})/)?.[1] ?? ''))
  );
  const [venueName, setVenueName] = useState(initial.venueName);
  const [pickupInfo, setPickupInfo] = useState(initial.pickupInfo);
  const [category, setCategory] = useState(initial.category);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [totalCapacity, setTotalCapacity] = useState(String(initial.totalCapacity));
  const [showRemaining, setShowRemaining] = useState(initial.showRemaining);
  const [maxPerOrder, setMaxPerOrder] = useState(String(initial.maxPerOrder));
  const [payWithinDays, setPayWithinDays] = useState(String(initial.payWithinDays));
  const [salesOpen, setSalesOpen] = useState(initial.salesOpen);
  const [showTime, setShowTime] = useState(initial.showTime);
  const [onlineCloseMin, setOnlineCloseMin] = useState<number | null>(initial.onlineCloseMin);
  const [counterSales, setCounterSales] = useState(initial.counterSales);
  const [counterNote, setCounterNote] = useState(initial.counterNote);
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
  const pickupSpeechBase = useRef('');

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
      setError(`Please give your ${v.listing} a name.`);
      return;
    }
    const capacity = intOf(totalCapacity, isShop ? 'The total you can sell' : 'Total capacity', 1, 200000);
    const perOrder = intOf(maxPerOrder, `Max ${v.units} per order`, 1, 50);
    const payDays = intOf(payWithinDays, 'The payment deadline', 1, 30);
    if (capacity === null || perOrder === null || payDays === null) return;

    setBusy(true);
    const result = await saveEvent(eventId, {
      name: name.trim(),
      artist,
      description,
      dateDisplay: isShop || customDate ? dateDisplay : writtenDate(eventDate, doors),
      eventDate,
      venueName,
      pickupInfo,
      // Only a shop's form shows the picker, so only a shop's save sends the
      // field — an event must not quietly overwrite a column it never edits.
      ...(isShop ? { category } : {}),
      address,
      city,
      totalCapacity: capacity,
      showRemaining,
      maxPerOrder: perOrder,
      payWithinDays: payDays,
      salesOpen,
      // The show-night handover is an event's: a shop has no start to count back from.
      ...(isShop ? {} : { showTime, onlineCloseMin, counterSales, counterNote }),
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

  const catIcon: Record<string, string> = {
    'khaja-food': '🥟',
    'sweets-bakery': '🍬',
    'groceries-spices': '🌶️',
    'clothing-fabrics': '🧣',
    jewellery: '💍',
    handicrafts: '🪔',
    other: '🛍️',
  };
  const builtDate = writtenDate(eventDate, doors);
  /**
   * When online sales would close with what is on screen now — worked out by
   * the same lib the buyer's page uses, so the sentence under the picker is the
   * minute the page will actually close.
   */
  const plannedOnline = onlineSales({
    kind,
    eventDate: eventDate || null,
    dateDisplay: customDate ? dateDisplay : builtDate,
    showTime,
    onlineCloseMin,
    onlineStopped: false,
    counterSales,
    counterNote,
  });

  // Step numbers follow what is shown, so a shop and an event both count 1, 2, 3.
  return (
    <form onSubmit={submit} className="ks bf">
      {error && (
        <div className="notice notice-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* ---- 1. What is it ---- */}
      <section className="ks-step">
        <h3 className="ks-q">
          <span className="ks-num">1</span> What is it called?
        </h3>
        <input
          id="ev-name"
          className="input bf-big"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={isShop ? 'e.g. Didi’s Momo Kitchen' : 'e.g. Dashain Night 2026'}
          aria-label={`${v.Listing} name`}
        />
        {!isShop && (
          <input
            id="ev-artist"
            className="input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={120}
            placeholder="Who is performing? (optional)"
            aria-label="Artist / act"
          />
        )}
        {isShop && (
          <div>
            <div className="bf-label">What do you sell?</div>
            <div className="ks-presets" role="radiogroup" aria-label="Category">
              {SHOP_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={category === c.key}
                  className={`ks-chip${category === c.key ? ' is-on' : ''}`}
                  onClick={() => setCategory(category === c.key ? '' : c.key)}
                >
                  {catIcon[c.key] ?? '🛍️'} {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isDraft && (
          <p className="muted small" style={{ margin: 0 }}>
            While it is a draft, renaming also updates its web address.
          </p>
        )}
      </section>

      {/* ---- 2. About ---- */}
      <section className="ks-step">
        <h3 className="ks-q">
          <span className="ks-num">2</span> Tell people about it
        </h3>
        <textarea
          id="ev-description"
          className="input"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={8000}
          aria-label="Description"
          placeholder={
            isShop
              ? 'What you make, how it is cooked, where it comes from…'
              : 'The line-up, the atmosphere, what to expect…'
          }
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
      </section>

      {/* ---- 3. When & where / how to collect ---- */}
      {isShop ? (
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">3</span> How do people get their order?
          </h3>
          <textarea
            id="ev-pickup"
            className="input"
            rows={3}
            value={pickupInfo}
            onChange={(e) => setPickupInfo(e.target.value)}
            maxLength={2000}
            aria-label="How to collect"
            placeholder="e.g. Collect Saturdays 4–7pm, ring the bell marked Sharma."
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div className="speech-row">
            <SpeechInput
              label="Dictate the collection details"
              hint="Tap the mic and just say when people should come."
              onStart={() => {
                pickupSpeechBase.current = pickupInfo.trim() ? pickupInfo.trimEnd() + ' ' : '';
              }}
              onText={(text) => setPickupInfo(pickupSpeechBase.current + text)}
            />
          </div>
          <div className="bf-row">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-city">City</label>
              <input id="ev-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="e.g. Berlin" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-venue">Place (optional)</label>
              <input
                id="ev-venue"
                className="input"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                maxLength={160}
                placeholder="e.g. Sunita’s kitchen, Neukölln"
              />
            </div>
          </div>
          <details className="bf-inline" open={address ? true : undefined}>
            <summary>+ Add a street address (optional)</summary>
            <input
              id="ev-address"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={240}
              placeholder="Street and number — for the Open in Maps link"
              aria-label="Street address"
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Leave it empty if you would rather not publish where you live — tell buyers after they order.
            </p>
          </details>
        </section>
      ) : (
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">3</span> When and where?
          </h3>
          <div className="bf-row">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-date">Day</label>
              <input id="ev-date" className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-doors">Doors open (optional)</label>
              <input id="ev-doors" className="input" type="time" value={doors} onChange={(e) => setDoors(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-show-time">Show starts</label>
              <input id="ev-show-time" className="input" type="time" value={showTime} onChange={(e) => setShowTime(e.target.value)} />
            </div>
          </div>
          {/* On the night: the website stops selling before the start and the
              counter at the venue takes over (lib/onlineSales). */}
          <div className="os-box">
            <div className="bf-label">On the night — online sales &amp; the counter</div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-online-close">Stop selling online</label>
              <select
                id="ev-online-close"
                className="input"
                value={onlineCloseMin === null ? 'never' : String(onlineCloseMin)}
                onChange={(e) => setOnlineCloseMin(e.target.value === 'never' ? null : Number(e.target.value))}
              >
                {ONLINE_CLOSE_CHOICES.map((c) => (
                  <option key={c.min ?? 'never'} value={c.min === null ? 'never' : String(c.min)}>
                    {c.min === null || c.min === 0 ? c.label : `${c.label} the show`}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted small os-preview">
              {onlineCloseMin === null
                ? 'Online sales stay open until you stop them yourself.'
                : !plannedOnline.start
                  ? 'Add the show start (or the doors time) so online sales can close automatically.'
                  : plannedOnline.closesAt
                    ? `Online sales will close ${wallClockLabel(plannedOnline.closesAt)}${
                        plannedOnline.start.source === 'doors' ? ' — counted from the doors time, since no show start is set' : ''
                      }.`
                    : null}
            </p>
            <label className="bf-switch" htmlFor="ev-counter-sales">
              <input id="ev-counter-sales" type="checkbox" checked={counterSales} onChange={(e) => setCounterSales(e.target.checked)} />
              <span>
                <strong>Tickets also sold at the counter</strong>
                <span className="muted small">
                  After online sales close, anyone who taps Get tickets is told to buy at the counter at the venue.
                </span>
              </span>
            </label>
            {counterSales && (
              <input
                id="ev-counter-note"
                className="input"
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
                maxLength={160}
                placeholder="Optional: e.g. Counter opens 17:30 · cash and card · €30 at the door"
                aria-label="A line about the counter"
              />
            )}
            <OnlineSalesSwitch
              eventId={eventId}
              closed={online.closed}
              reason={online.reason}
              clockPassed={online.clockPassed}
              closesLabel={online.closesLabel}
              counter={online.counter}
              onReopened={(autoCloseCleared) => {
                if (autoCloseCleared) setOnlineCloseMin(null);
              }}
            />
          </div>
          {customDate ? (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-date-display">Written on the page as</label>
              <input
                id="ev-date-display"
                className="input"
                value={dateDisplay}
                onChange={(e) => setDateDisplay(e.target.value)}
                maxLength={120}
              />
              <button type="button" className="bf-link" onClick={() => setCustomDate(false)}>
                Write it for me instead
              </button>
            </div>
          ) : (
            builtDate && (
              <p className="ks-preview">
                Shown as: {builtDate}{' '}
                <button
                  type="button"
                  className="bf-link"
                  onClick={() => {
                    setDateDisplay(builtDate);
                    setCustomDate(true);
                  }}
                >
                  Change the wording
                </button>
              </p>
            )
          )}
          <div className="bf-row">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-venue">Venue</label>
              <input id="ev-venue" className="input" value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={160} placeholder="e.g. Stadthalle" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-city">City</label>
              <input id="ev-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="e.g. Berlin" />
            </div>
          </div>
          <input
            id="ev-address"
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={240}
            placeholder="Street and number — for the Open in Maps link"
            aria-label="Street address"
          />
          <div>
            <div className="bf-label">How many people fit?</div>
            <div className="ks-presets">
              {[50, 100, 200, 300, 500, 1000].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ks-chip${totalCapacity === String(n) ? ' is-on' : ''}`}
                  onClick={() => setTotalCapacity(String(n))}
                >
                  {n}
                </button>
              ))}
              <input
                id="ev-capacity"
                className="input bf-num"
                type="number"
                inputMode="numeric"
                min={1}
                max={200000}
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(e.target.value)}
                aria-label="Total capacity"
              />
            </div>
          </div>
        </section>
      )}

      {/* ---- Optional: WhatsApp ---- */}
      <details className="ks-step ks-more" open={whatsapp ? true : undefined}>
        <summary className="ks-q">
          <span className="ks-num">💬</span> WhatsApp bubble <span className="badge">optional</span>
        </summary>
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          Buyers tap a bubble on your page and message you directly. Leave the number empty for no bubble.
        </p>
        <div className="bf-row">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ev-whatsapp-num">WhatsApp number</label>
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
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ev-whatsapp-name">Name on the bubble</label>
            <input
              id="ev-whatsapp-name"
              className="input"
              value={whatsappName}
              onChange={(e) => setWhatsappName(e.target.value)}
              placeholder={initial.accountName}
              data-private-attrs=""
              maxLength={60}
            />
          </div>
        </div>
        {whatsapp.trim() && (
          <div style={{ marginTop: 12 }}>
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
              Press <strong style={{ color: 'var(--text)' }}>Save</strong> to keep the framing.
            </p>
          </div>
        )}
          </div>
        )}
      </details>

      {/* ---- Optional: everything else ---- */}
      <details className="ks-step ks-more">
        <summary className="ks-q">
          <span className="ks-num">⚙︎</span> More settings <span className="badge">optional</span>
        </summary>
        <div className="bf-row">
          {isShop && (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-artist">Who is behind it</label>
              <input
                id="ev-artist"
                className="input"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={120}
                placeholder="The cook, the maker, the family name"
              />
            </div>
          )}
          {isShop && (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ev-capacity">Most you can sell in total</label>
              <input
                id="ev-capacity"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={200000}
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(e.target.value)}
              />
            </div>
          )}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ev-max-per-order">Most {v.units} in one order</label>
            <input
              id="ev-max-per-order"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={maxPerOrder}
              onChange={(e) => setMaxPerOrder(e.target.value)}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ev-pay-days">Bank transfer within (days)</label>
            <input
              id="ev-pay-days"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={payWithinDays}
              onChange={(e) => setPayWithinDays(e.target.value)}
            />
          </div>
        </div>
        <label className="bf-switch">
          <input type="checkbox" checked={showRemaining} onChange={(e) => setShowRemaining(e.target.checked)} />
          <span>
            <strong>Show how many are left</strong>
            <span className="muted small">
              {isShop ? '“Only 3 left” makes people order now.' : 'Turn off if you sell early-bird tickets — “only 8 left” can scare people off.'}
            </span>
          </span>
        </label>
        <label className="bf-switch" htmlFor="ev-sales-open">
          <input id="ev-sales-open" type="checkbox" checked={salesOpen} onChange={(e) => setSalesOpen(e.target.checked)} />
          <span>
            <strong>{v.Sales} open</strong>
            <span className="muted small">Switch off to pause all sales without taking the page down.</span>
          </span>
        </label>
      </details>

      <div className="ks-save">
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
