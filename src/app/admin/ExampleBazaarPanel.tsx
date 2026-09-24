'use client';

// Put the example bazaar up (or take it down) on the hosted site, without a
// terminal. The work runs in the background on the server (it renders ~80
// pictures); this panel polls until it is done. See api/admin/example-bazaar.
import { useEffect, useState } from 'react';

interface Job {
  action: 'seed' | 'clean';
  startedAt: number;
  finishedAt: number | null;
  ok: boolean | null;
  note: string;
}

export default function ExampleBazaarPanel({ initialShops }: { initialShops: number }) {
  const [shops, setShops] = useState(initialShops);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = job !== null && job.finishedAt === null;

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/example-bazaar', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { shops: number; job: Job | null };
        if (!alive) return;
        setShops(data.shops);
        setJob(data.job);
      } catch {
        /* next poll */
      }
    };
    void poll();
    const t = setInterval(poll, running ? 4000 : 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [running]);

  async function run(action: 'seed' | 'clean') {
    if (action === 'clean' && !window.confirm('Take every example shop off the site?')) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/example-bazaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as { job?: Job; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'That did not work — see the server log.');
        return;
      }
      setJob(data?.job ?? null);
    } catch {
      setError('Could not reach the server.');
    }
  }

  return (
    <div className="card">
      <div className="card-title">Example bazaar</div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Fill /market with clearly marked example shops (about 55 items with pictures), so a new visitor sees a
        stocked bazaar. They can never take an order or money. Right now: <strong>{shops}</strong> example shop
        {shops === 1 ? '' : 's'}. Take them down before changing how the site takes payments.
      </p>
      <p className="muted small">
        Organizer features are shown by the <a href="/demo">try-it demo</a> instead — every visitor gets their own
        full demo account on the live site, so nothing needs seeding for that.
      </p>
      {error && <div className="notice notice-error">{error}</div>}
      {running && (
        <div className="notice">
          <span className="spinner" aria-hidden /> {job?.action === 'clean' ? 'Taking the example shops down' : 'Putting the example shops up'}… this
          takes a few minutes (it draws every picture). You can leave this page.
        </div>
      )}
      {job && !running && job.ok && (
        <div className="notice notice-success">
          Done — {job.action === 'clean' ? 'the example shops are gone.' : `${shops} example shops are on the bazaar.`}
        </div>
      )}
      {job && !running && job.ok === false && <div className="notice notice-error">It stopped: {job.note || 'see the server log.'}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-brand" onClick={() => void run('seed')} disabled={running}>
          {shops > 0 ? 'Refresh example shops' : 'Put up the example bazaar'}
        </button>
        {shops > 0 && (
          <button type="button" className="btn btn-danger" onClick={() => void run('clean')} disabled={running}>
            Take them down
          </button>
        )}
      </div>
    </div>
  );
}
