'use client';

import Np from '@/components/Np';
import { useState } from 'react';
import {
  BS_MONTHS,
  BS_RANGE,
  adToBs,
  bsMonthLength,
  bsToAd,
  formatBs,
  formatBsNe,
} from '@/lib/patro';

// The two-way converter. Client-side because it is pure table arithmetic
// (lib/patro embeds the calendar data) and the answer should appear as you
// type, without a round trip for something a wall calendar does for free.

/** '2027-04-14' -> 'Wednesday, 14 April 2027' — a converter result deserves the weekday. */
function humanAd(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const RANGE_NOTE = `This table covers ${BS_RANGE.first}–${BS_RANGE.last} BS (2023–2039 AD).`;

export default function PatroConverter({ todayIso }: { todayIso: string }) {
  const [adInput, setAdInput] = useState(todayIso);
  const [bsYear, setBsYear] = useState(adToBs(todayIso)?.year ?? BS_RANGE.first);
  const [bsMonth, setBsMonth] = useState(adToBs(todayIso)?.month ?? 1);
  const [bsDay, setBsDay] = useState(adToBs(todayIso)?.day ?? 1);

  const bsResult = adInput ? adToBs(adInput) : null;
  const adResult = bsToAd(bsYear, bsMonth, bsDay);
  const dayMax = bsMonthLength(bsYear, bsMonth) ?? 32;

  return (
    <div className="feed-grid" style={{ marginTop: 18 }}>
      <div className="card anim-fade-up">
        <h2 className="card-title">English date → Nepali date (AD → BS)</h2>
        <div className="field">
          <label htmlFor="patro-ad">Gregorian date</label>
          <input
            id="patro-ad"
            className="input"
            type="date"
            value={adInput}
            onChange={(e) => setAdInput(e.target.value)}
          />
        </div>
        <p style={{ margin: '12px 0 0' }}>
          {bsResult ? (
            <>
              <strong>{formatBs(bsResult)} BS</strong>{' '}
              <span className="muted">
                · <Np>{formatBsNe(bsResult)}</Np>
              </span>
            </>
          ) : (
            <span className="muted small">
              {adInput ? `Outside this table. ${RANGE_NOTE}` : 'Pick a date to convert.'}
            </span>
          )}
        </p>
      </div>

      <div className="card anim-fade-up anim-d1">
        <h2 className="card-title">Nepali date → English date (BS → AD)</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 90px' }}>
            <label htmlFor="patro-bs-year">Year (BS)</label>
            <input
              id="patro-bs-year"
              className="input"
              type="number"
              min={BS_RANGE.first}
              max={BS_RANGE.last}
              value={bsYear}
              onChange={(e) => setBsYear(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: '1 1 130px' }}>
            <label htmlFor="patro-bs-month">Month</label>
            <select
              id="patro-bs-month"
              className="input"
              value={bsMonth}
              onChange={(e) => setBsMonth(Number(e.target.value))}
            >
              {BS_MONTHS.map((m, i) => (
                /* lang on the <option> itself: an option's label is a flat
                   string, so there is nowhere inside it to mark one half. The
                   whole row is declared Nepali because the half that needs the
                   Nepali voice is the half a wrong voice ruins — "बैशाख" read
                   as English is unusable, while "Baishakh" read with a Nepali
                   voice is still recognisable. */
                <option key={m.name} value={i + 1} lang="ne">
                  {m.name} · {m.nameNe}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 80px' }}>
            <label htmlFor="patro-bs-day">Day</label>
            <input
              id="patro-bs-day"
              className="input"
              type="number"
              min={1}
              max={dayMax}
              value={bsDay}
              onChange={(e) => setBsDay(Number(e.target.value))}
            />
          </div>
        </div>
        <p style={{ margin: '12px 0 0' }}>
          {adResult ? (
            <strong>{humanAd(adResult)}</strong>
          ) : (
            <span className="muted small">
              That day does not exist in this month. {RANGE_NOTE}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
