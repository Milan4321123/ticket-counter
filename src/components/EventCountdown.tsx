'use client';

// "12 days · 04 h · 30 min" until the event — the festival and neon layouts'
// countdown. Renders nothing once the start has passed or when the date is
// unknown; the time comes from the page's "Doors 18:00" when there is one.
import { useEffect, useState } from 'react';

export default function EventCountdown({ date, time }: { date: string; time?: string }) {
  const target = Date.parse(`${date}T${time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '19:00'}:00`);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null || !Number.isFinite(target) || target <= now) return null;
  const mins = Math.floor((target - now) / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const cells = d > 0 ? [[d, d === 1 ? 'day' : 'days'], [h, 'h'], [m, 'min']] : [[h, 'h'], [m, 'min']];
  return (
    <div className="evl-countdown" aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}>
      {cells.map(([n, label]) => (
        <span key={String(label)} className="evl-cd-cell">
          <strong>{String(n).padStart(2, '0')}</strong>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
