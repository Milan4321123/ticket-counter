'use client';

// "Tell me about it" — the editor's setup assistant, as a small chat. The
// seller writes (or says) what their event or shop is; the assistant answers
// with every field it would fill, each with a tick box; "Fill it in" saves the
// ticked ones through the normal editor save (saveEvent), so every rule the
// form enforces still applies. More messages refine the same proposal.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SpeechInput from '@/components/SpeechInput';
import { formatMoney } from '@/lib/money';
import { saveEvent, type SavedTier } from './save';

interface ProposedTier {
  name: string;
  priceCents: number;
  cap: number;
  description: string;
  studentOnly: boolean;
}

interface Proposal {
  name?: string;
  artist?: string;
  description?: string;
  dateDisplay?: string;
  eventDate?: string;
  venueName?: string;
  address?: string;
  city?: string;
  totalCapacity?: number;
  pickupInfo?: string;
  category?: string;
  tiers?: ProposedTier[];
}

interface Message {
  from: 'bot' | 'me';
  text: string;
  proposal?: Proposal;
}

const LABELS: Record<string, string> = {
  name: 'Name',
  artist: 'Artists',
  description: 'Description',
  dateDisplay: 'Date (as shown)',
  eventDate: 'Calendar date',
  venueName: 'Venue',
  address: 'Address',
  city: 'City',
  totalCapacity: 'Capacity',
  pickupInfo: 'Collection',
  category: 'Shelf in the bazaar',
};

export default function SetupAssistant({
  eventId,
  kind,
  currency,
  existingTiers,
}: {
  eventId: string;
  kind: 'event' | 'shop';
  currency: string;
  existingTiers: SavedTier[];
}) {
  const router = useRouter();
  const unit = kind === 'shop' ? 'item' : 'ticket type';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'bot',
      text:
        kind === 'shop'
          ? 'Tell me about your shop in a sentence or two — what you sell, prices, where people collect. I fill in the form; you check it.'
          : 'Tell me about your event in a sentence or two — name, date, place, how many people, ticket prices. I fill in the form; you check it.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [base, setBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  /** field key (or `tier:<i>`) → ticked */
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  const said = messages.filter((m) => m.from === 'me').map((m) => m.text);
  const latest = [...messages].reverse().find((m) => m.proposal)?.proposal ?? null;

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...messages, { from: 'me' as const, text }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/setup-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Everything said so far, so a later message refines the same picture.
        body: JSON.stringify({ text: [...said, text].join('\n') }),
      });
      const data = (await res.json().catch(() => null)) as { proposal?: Proposal; reply?: string; error?: string } | null;
      if (!res.ok || !data?.proposal) {
        setMessages([...next, { from: 'bot', text: data?.error ?? 'Something went wrong — please try again.' }]);
      } else {
        const p = data.proposal;
        const t: Record<string, boolean> = {};
        for (const k of Object.keys(p)) if (k !== 'tiers') t[k] = true;
        (p.tiers ?? []).forEach((_, i) => (t[`tier:${i}`] = true));
        setTicks(t);
        setMessages([...next, { from: 'bot', text: data.reply ?? 'Here is what I would fill in.', proposal: p }]);
      }
    } catch {
      setMessages([...next, { from: 'bot', text: 'Could not reach the server — please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!latest || saving) return;
    setSaving(true);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(latest)) if (k !== 'tiers' && ticks[k]) patch[k] = v;
    const chosen = (latest.tiers ?? []).filter((_, i) => ticks[`tier:${i}`]);
    if (chosen.length) {
      // Merge, never wipe: existing types stay; one with the same name is
      // updated in place (price, and quantity if said); the rest are added.
      const tiers: (Omit<SavedTier, 'tierKey'> & { tierKey: string | null })[] = existingTiers.map((t) => ({ ...t }));
      for (const c of chosen) {
        const same = tiers.find((t) => t.name.trim().toLowerCase() === c.name.trim().toLowerCase());
        if (same) {
          same.priceCents = c.priceCents;
          if (c.cap > 0) {
            same.cap = c.cap;
            same.unlimited = false;
          }
          if (c.description) same.description = c.description;
        } else {
          tiers.push({
            tierKey: null,
            name: c.name,
            priceCents: c.priceCents,
            cap: c.cap > 0 ? c.cap : 0,
            unlimited: c.cap === 0,
            status: 'on-sale',
            studentOnly: c.studentOnly,
            description: c.description,
            details: '',
            mediaId: null,
            seatsPerUnit: 1,
          });
        }
      }
      patch.tiers = tiers;
    }
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      return;
    }
    const result = await saveEvent(eventId, patch);
    setSaving(false);
    if (result.ok) {
      const n = Object.keys(patch).filter((k) => k !== 'tiers').length + chosen.length;
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: `Done ✓ — I filled in ${n} ${n === 1 ? 'thing' : 'things'}. The cards below are updated; open any to adjust. Still yours to do: your bank details for payouts (in Basics — I never touch those) and a photo. Anything else to add?`,
        },
      ]);
      router.refresh();
    } else {
      setMessages((m) => [...m, { from: 'bot', text: result.error ?? 'That could not be saved — please check the details.' }]);
    }
  }

  const fmt = (k: string, v: unknown): string => {
    if (k === 'totalCapacity') return `${v} ${kind === 'shop' ? 'items' : 'people'}`;
    return String(v);
  };

  if (!open) {
    return (
      <button type="button" className="sa-open" onClick={() => setOpen(true)}>
        <span className="sa-open-icon" aria-hidden="true">
          ✨
        </span>
        <span className="sa-open-text">
          <strong>Fill it in for me</strong>
          <span>Describe your {kind === 'shop' ? 'shop' : 'event'} in a sentence — or say it — and I fill in the form.</span>
        </span>
      </button>
    );
  }

  return (
    <section className="sa" aria-label="Setup assistant">
      <header className="sa-head">
        <strong>✨ Setup assistant</strong>
        <button type="button" className="sa-close" onClick={() => setOpen(false)} aria-label="Close the assistant">
          ×
        </button>
      </header>
      <div className="sa-log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`sa-msg sa-${m.from}`}>
            <p>{m.text}</p>
            {m.proposal && m === messages[messages.length - 1] && (
              <div className="sa-proposal">
                {Object.entries(m.proposal)
                  .filter(([k]) => k !== 'tiers')
                  .map(([k, v]) => (
                    <label key={k} className="sa-line">
                      <input type="checkbox" checked={Boolean(ticks[k])} onChange={(e) => setTicks((t) => ({ ...t, [k]: e.target.checked }))} />
                      <span className="sa-key">{LABELS[k] ?? k}</span>
                      <span className="sa-val">{fmt(k, v)}</span>
                    </label>
                  ))}
                {(m.proposal.tiers ?? []).map((t, ti) => (
                  <label key={`t${ti}`} className="sa-line">
                    <input
                      type="checkbox"
                      checked={Boolean(ticks[`tier:${ti}`])}
                      onChange={(e) => setTicks((x) => ({ ...x, [`tier:${ti}`]: e.target.checked }))}
                    />
                    <span className="sa-key">{kind === 'shop' ? 'Item' : 'Ticket'}</span>
                    <span className="sa-val">
                      {t.name} · {formatMoney(t.priceCents, currency)}
                      {t.cap > 0 ? ` · ${t.cap} available` : ''}
                      {t.studentOnly ? ' · student' : ''}
                    </span>
                  </label>
                ))}
                <button type="button" className="btn btn-brand sa-apply" onClick={() => void apply()} disabled={saving}>
                  {saving ? 'Filling in…' : 'Fill it in ✓'}
                </button>
                <p className="sa-note">
                  Existing {unit}s stay; one with the same name gets the new price. Nothing is published.
                </p>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="sa-msg sa-bot">
            <p className="sa-typing">
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
      </div>
      <form
        className="sa-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={1500}
          placeholder={
            kind === 'shop'
              ? 'e.g. Home-made momo, chicken 9€ and veg 8€, collect in Berlin-Neukölln on Saturdays'
              : 'e.g. Dashain Night on 10 October at Kulturhaus Berlin, 200 people, standard 25€, VIP 45€'
          }
          aria-label="Tell the assistant about your listing"
        />
        <div className="sa-actions">
          <SpeechInput onStart={() => setBase(draft)} onText={(t) => setDraft(`${base ? `${base} ` : ''}${t}`)} label="Say it instead" />
          <button className="btn btn-brand btn-sm" disabled={busy || !draft.trim()}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
