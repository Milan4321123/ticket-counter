'use client';

// "Tell me about it" — the editor's setup assistant, as a small chat.
//
//  1. The seller writes (or says) what their event or shop is — or asks the
//     assistant to come up with one. It answers with every field it would fill,
//     each with a tick box; "Fill it in" saves the ticked ones through the
//     normal editor save (saveEvent), so every rule the form enforces applies.
//  2. Then it checks what the REQUIRED steps still lack and asks for each, one
//     short question at a time, saving every answer as it comes — until the
//     to-do list is done. Bank details go straight to the save route, never to
//     the AI. A photo and publishing open their own section.
//
// Speaks English, German and Nepali (the site's language cookie).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SpeechInput from '@/components/SpeechInput';
import { formatMoney } from '@/lib/money';
import { GOTO_TAB_EVENT } from './GoToTab';
import { saveEvent, type SavedTier } from './save';

type Lang = 'en' | 'de' | 'ne';

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
  suggested?: boolean;
  /** A button under the message that opens an editor section. */
  goto?: { tab: string; label: string };
}

type Words = {
  openTitle: string;
  openLine: (k: string) => string;
  hello: (shop: boolean) => string;
  fill: string;
  filling: string;
  send: string;
  say: string;
  suggested: string;
  note: string;
  filled: (n: number) => string;
  allDone: string;
  resume: string;
  skip: string;
  saved: string;
  notDate: string;
  notIban: string;
  error: string;
  offline: string;
  typing: string;
  placeholder: (shop: boolean) => string;
  q: Record<string, string>;
  buttons: { photo: string; publish: string };
  labels: Record<string, string>;
};

// ---- Words -----------------------------------------------------------------

const T: Record<Lang, Words> = {
  en: {
    openTitle: 'Fill it in for me',
    openLine: (k) => `Describe your ${k} in a sentence — or say it — and I fill in the form and ask for anything missing.`,
    hello: (shop) =>
      shop
        ? 'Tell me about your shop — what you sell, prices, where people collect. Or ask me to come up with one. I fill in the form, then ask for whatever is still missing.'
        : 'Tell me about your event — name, date, place, how many people, ticket prices. Or ask me to come up with one. I fill in the form, then ask for whatever is still missing.',
    fill: 'Fill it in ✓',
    filling: 'Filling in…',
    send: 'Send',
    say: 'Say it instead',
    suggested: '✨ Suggestions — made up for you. Change or untick anything before filling in.',
    note: 'Existing entries stay; one with the same name gets the new price. Nothing is published.',
    filled: (n) => `Done ✓ — filled in ${n}. Let me check what is still needed…`,
    allDone: 'Everything required is done ✓ — have a last look, then publish when you are ready.',
    resume: 'Let’s finish it — I will ask only for what is still missing. (Say “skip” to leave one for later.)',
    skip: 'Skipped — you can add it in the form later.',
    saved: 'Saved ✓',
    notDate: 'I could not read that date — try e.g. “14 March 2027”.',
    notIban: 'That IBAN does not look right — please check it (e.g. DE89 3704 0044 0532 0130 00).',
    error: 'Something went wrong — please try again.',
    offline: 'Could not reach the server — please try again.',
    typing: 'Answer here… (or “skip”)',
    placeholder: (shop) =>
      shop
        ? 'e.g. Home-made momo, chicken 9€ and veg 8€, collect in Berlin-Neukölln on Saturdays'
        : 'e.g. Dashain Night on 10 October at Kulturhaus Berlin, 200 people, standard 25€, VIP 45€',
    q: {
      name: 'What is it called?',
      eventDate: 'Which day is it? (e.g. 14 March 2027, doors 18:00)',
      venueName: 'Where is it — the name of the venue?',
      address: 'And the venue’s street address? (street, number, postcode, city)',
      pickupInfo: 'How and when do buyers collect their order? (e.g. Saturdays 16–19h at our shop in Berlin-Neukölln)',
      description: 'A short description for the page — write one, or say “you write it”.',
      tiers: 'What do you sell, and for how much? (e.g. Standard 25€, VIP 45€)',
      payoutHolder:
        'Where should the money go? First: the name on your bank account (the account holder). Or send your PayPal.me link instead.',
      payoutIban: 'And the IBAN of that account?',
      payoutDemo:
        'This is a demo account, so its payment details are fixed — in a real account I would ask for your IBAN here. Moving on.',
      photo: 'Add at least one photo — tap below, pick one, then come back and say “done”.',
      publish: 'Last step: publish. Tap below to check everything and put it live.',
    },
    buttons: { photo: 'Add a photo →', publish: 'Go to Publish →' },
    labels: {
      name: 'Name', artist: 'Artists', description: 'Description', dateDisplay: 'Date (as shown)', eventDate: 'Calendar date',
      venueName: 'Venue', address: 'Address', city: 'City', totalCapacity: 'Capacity', pickupInfo: 'Collection',
      category: 'Shelf in the bazaar', item: 'Item', ticket: 'Ticket', available: 'available', student: 'student',
      people: 'people', items: 'items',
    },
  },
  de: {
    openTitle: 'Für mich ausfüllen',
    openLine: (k) =>
      `Beschreib ${k === 'shop' ? 'deinen Laden' : 'dein Event'} in einem Satz – oder sprich es ein – ich fülle aus und frage nach dem Rest.`,
    hello: (shop) =>
      shop
        ? 'Erzähl mir von deinem Laden – was du verkaufst, Preise, wo abgeholt wird. Oder lass mich einen ausdenken. Ich fülle aus und frage dann nach dem, was noch fehlt.'
        : 'Erzähl mir von deinem Event – Name, Datum, Ort, wie viele Leute, Ticketpreise. Oder lass mich eins ausdenken. Ich fülle aus und frage dann nach dem, was noch fehlt.',
    fill: 'Ausfüllen ✓',
    filling: 'Wird ausgefüllt…',
    send: 'Senden',
    say: 'Einsprechen',
    suggested: '✨ Vorschläge – für dich ausgedacht. Ändere oder entferne vor dem Ausfüllen, was nicht passt.',
    note: 'Bestehende Einträge bleiben; einer mit gleichem Namen bekommt den neuen Preis. Nichts wird veröffentlicht.',
    filled: (n) => `Erledigt ✓ – ${n} ausgefüllt. Ich prüfe, was noch fehlt…`,
    allDone: 'Alles Nötige ist erledigt ✓ – schau noch einmal drüber und veröffentliche, wenn du bereit bist.',
    resume: 'Lass es uns fertig machen – ich frage nur nach dem, was noch fehlt. („überspringen“ lässt eins für später.)',
    skip: 'Übersprungen – du kannst es später im Formular ergänzen.',
    saved: 'Gespeichert ✓',
    notDate: 'Das Datum konnte ich nicht lesen – z. B. „14. März 2027“.',
    notIban: 'Die IBAN sieht nicht richtig aus – bitte prüfen (z. B. DE89 3704 0044 0532 0130 00).',
    error: 'Etwas ist schiefgelaufen – bitte noch einmal.',
    offline: 'Server nicht erreichbar – bitte noch einmal.',
    typing: 'Antwort hier… (oder „überspringen“)',
    placeholder: (shop) =>
      shop
        ? 'z. B. Hausgemachte Momo, Hähnchen 9€ und Veggie 8€, Abholung samstags in Berlin-Neukölln'
        : 'z. B. Dashain-Nacht am 10. Oktober im Kulturhaus Berlin, 200 Leute, Standard 25€, VIP 45€',
    q: {
      name: 'Wie heißt es?',
      eventDate: 'An welchem Tag? (z. B. 14. März 2027, Einlass 18 Uhr)',
      venueName: 'Wo findet es statt – Name des Ortes?',
      address: 'Und die Adresse? (Straße, Nr., PLZ, Stadt)',
      pickupInfo: 'Wie und wann holen Käufer ab? (z. B. samstags 16–19 Uhr in unserem Laden in Neukölln)',
      description: 'Eine kurze Beschreibung – schreib eine oder sag „schreib du“.',
      tiers: 'Was verkaufst du und zu welchem Preis? (z. B. Standard 25€, VIP 45€)',
      payoutHolder: 'Wohin soll das Geld? Zuerst: der Name auf deinem Konto (Kontoinhaber). Oder schick deinen PayPal.me-Link.',
      payoutIban: 'Und die IBAN dieses Kontos?',
      payoutDemo:
        'Das ist ein Demo-Konto, die Zahlungsdaten sind fest – in einem echten Konto würde ich hier nach deiner IBAN fragen. Weiter.',
      photo: 'Füge mindestens ein Foto hinzu – unten tippen, eins wählen, dann zurückkommen und „fertig“ sagen.',
      publish: 'Letzter Schritt: veröffentlichen. Unten tippen, alles prüfen und live stellen.',
    },
    buttons: { photo: 'Foto hinzufügen →', publish: 'Zum Veröffentlichen →' },
    labels: {
      name: 'Name', artist: 'Künstler', description: 'Beschreibung', dateDisplay: 'Datum (Anzeige)', eventDate: 'Kalenderdatum',
      venueName: 'Ort', address: 'Adresse', city: 'Stadt', totalCapacity: 'Kapazität', pickupInfo: 'Abholung',
      category: 'Regal im Basar', item: 'Artikel', ticket: 'Ticket', available: 'verfügbar', student: 'Student',
      people: 'Personen', items: 'Artikel',
    },
  },
  ne: {
    openTitle: 'मेरो लागि भरिदिनुहोस्',
    openLine: (k) => `आफ्नो ${k === 'shop' ? 'पसल' : 'कार्यक्रम'}बारे एक वाक्यमा लेख्नुहोस् वा बोल्नुहोस् — म फारम भर्छु र बाँकी सोध्छु।`,
    hello: (shop) =>
      shop
        ? 'आफ्नो पसलबारे बताउनुहोस् — के बेच्नुहुन्छ, मूल्य, कहाँ लिन आउने। वा मलाई नै एउटा बनाउन भन्नुहोस्। म फारम भर्छु, अनि बाँकी कुरा सोध्छु।'
        : 'आफ्नो कार्यक्रमबारे बताउनुहोस् — नाम, मिति, ठाउँ, कति जना, टिकटको मूल्य। वा मलाई नै एउटा बनाउन भन्नुहोस्। म फारम भर्छु, अनि बाँकी कुरा सोध्छु।',
    fill: 'भर्नुहोस् ✓',
    filling: 'भर्दै…',
    send: 'पठाउनुहोस्',
    say: 'बोलेर भन्नुहोस्',
    suggested: '✨ सुझावहरू — तपाईंका लागि बनाइएको। भर्नुअघि जे मिलेन त्यो बदल्नुहोस् वा हटाउनुहोस्।',
    note: 'भइरहेका टिकट/सामान रहन्छन्; उही नामको भए नयाँ मूल्य लाग्छ। केही प्रकाशित हुँदैन।',
    filled: (n) => `भयो ✓ — ${n} कुरा भरियो। अब के बाँकी छ हेर्छु…`,
    allDone: 'चाहिने सबै भयो ✓ — एकपटक हेर्नुहोस्, अनि तयार भएपछि प्रकाशित गर्नुहोस्।',
    resume: 'यसलाई सक्ने गरौं — म बाँकी रहेको मात्र सोध्छु। (कुनै पछि गर्न “छोड्नुहोस्” भन्नुहोस्।)',
    skip: 'छोडियो — पछि फारममा थप्न सक्नुहुन्छ।',
    saved: 'सुरक्षित भयो ✓',
    notDate: 'मिति बुझिन — जस्तै “14 March 2027” लेख्नुहोस्।',
    notIban: 'IBAN मिलेन — कृपया जाँच्नुहोस् (जस्तै DE89 3704 0044 0532 0130 00)।',
    error: 'केही गडबड भयो — फेरि प्रयास गर्नुहोस्।',
    offline: 'सर्भरसम्म पुग्न सकिएन — फेरि प्रयास गर्नुहोस्।',
    typing: 'यहाँ जवाफ लेख्नुहोस्… (वा “छोड्नुहोस्”)',
    placeholder: (shop) =>
      shop ? 'जस्तै: घरमा बनेको मम, चिकन 9€ र भेज 8€, शनिबार बर्लिनमा लिन आउने' : 'जस्तै: दशैं साँझ, 10 अक्टोबर, बर्लिन कुल्टुरहाउस, 200 जना, सामान्य 25€, VIP 45€',
    q: {
      name: 'यसको नाम के हो?',
      eventDate: 'कुन दिन हो? (जस्तै 14 March 2027, साँझ 6 बजे)',
      venueName: 'कहाँ हुन्छ — ठाउँको नाम?',
      address: 'अनि ठेगाना? (सडक, नम्बर, पोस्टकोड, शहर)',
      pickupInfo: 'ग्राहकले कहिले र कहाँ सामान लिन आउने? (जस्तै शनिबार 4–7 बजे हाम्रो पसलमा)',
      description: 'पेजको लागि छोटो विवरण — आफैं लेख्नुहोस् वा “तपाईं लेख्नुहोस्” भन्नुहोस्।',
      tiers: 'के बेच्नुहुन्छ र कति पर्छ? (जस्तै सामान्य 25€, VIP 45€)',
      payoutHolder: 'पैसा कहाँ जाने? पहिले: बैंक खातामा भएको नाम। वा आफ्नो PayPal.me लिङ्क पठाउनुहोस्।',
      payoutIban: 'अनि त्यो खाताको IBAN?',
      payoutDemo: 'यो डेमो खाता हो, भुक्तानी विवरण परिवर्तन हुँदैन — साँचो खातामा म यहाँ IBAN सोध्थें। अगाडि बढौं।',
      photo: 'कम्तीमा एउटा फोटो थप्नुहोस् — तल थिच्नुहोस्, फोटो छान्नुहोस्, अनि फर्केर “भयो” भन्नुहोस्।',
      publish: 'अन्तिम काम: प्रकाशित गर्नुहोस्। तल थिचेर सबै जाँच्नुहोस् र लाइभ गर्नुहोस्।',
    },
    buttons: { photo: 'फोटो थप्नुहोस् →', publish: 'प्रकाशनमा जानुहोस् →' },
    labels: {
      name: 'नाम', artist: 'कलाकार', description: 'विवरण', dateDisplay: 'मिति (देखिने)', eventDate: 'क्यालेन्डर मिति',
      venueName: 'ठाउँ', address: 'ठेगाना', city: 'शहर', totalCapacity: 'क्षमता', pickupInfo: 'लिन आउने',
      category: 'बजारको खण्ड', item: 'सामान', ticket: 'टिकट', available: 'उपलब्ध', student: 'विद्यार्थी',
      people: 'जना', items: 'वटा',
    },
  },
};

/** The order the required pieces are asked for. */
const ORDER = ['name', 'eventDate', 'venueName', 'address', 'pickupInfo', 'description', 'tiers', 'payout', 'payoutDemo', 'photo', 'publish'];

const SKIP_RE = /^\s*(skip|later|next|überspringen|später|weiter|छोड्नुहोस्|छोड|पछि)\s*[.!]?\s*$/i;
const WRITE_IT_RE = /\b(you write|write it|you do it|schreib du|du schreibst)\b|तपाईं लेख्नुहोस्|तपाईं नै लेख्नुहोस्|आफैं लेख्नुहोस्/i;

export default function SetupAssistant({
  eventId,
  kind,
  currency,
  existingTiers,
  lang = 'en',
  startedAlready = false,
}: {
  eventId: string;
  kind: 'event' | 'shop';
  currency: string;
  existingTiers: SavedTier[];
  lang?: Lang;
  /** The listing already has content — open on what is still missing. */
  startedAlready?: boolean;
}) {
  const t = T[lang] ?? T.en;
  const router = useRouter();
  const isShop = kind === 'shop';
  const unit = isShop ? t.labels.item : t.labels.ticket;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: t.hello(isShop) }]);
  const [draft, setDraft] = useState('');
  const [base, setBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  /** The required piece being asked for right now, and those after it. */
  const [asking, setAsking] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [holder, setHolder] = useState('');
  const [tiers, setTiers] = useState<SavedTier[]>(existingTiers);

  const said = messages.filter((m) => m.from === 'me').map((m) => m.text);
  const latest = [...messages].reverse().find((m) => m.proposal)?.proposal ?? null;
  const say = (m: Message) => setMessages((prev) => [...prev, m]);

  async function propose(text: string): Promise<{ proposal?: Proposal; reply?: string; suggested?: boolean; error?: string } | null> {
    const res = await fetch(`/api/portal/events/${eventId}/setup-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return (await res.json().catch(() => null)) as never;
  }

  /** Merge proposed items into the listing's types (never wipes any) and save. */
  async function saveTiers(chosen: ProposedTier[]): Promise<boolean> {
    const next: (Omit<SavedTier, 'tierKey'> & { tierKey: string | null })[] = tiers.map((x) => ({ ...x }));
    for (const c of chosen) {
      const same = next.find((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      if (same) {
        same.priceCents = c.priceCents;
        if (c.cap > 0) {
          same.cap = c.cap;
          same.unlimited = false;
        }
        if (c.description) same.description = c.description;
      } else {
        next.push({
          tierKey: null, name: c.name, priceCents: c.priceCents, cap: c.cap > 0 ? c.cap : 0, unlimited: c.cap === 0,
          status: 'on-sale', studentOnly: c.studentOnly, description: c.description, details: '', mediaId: null, seatsPerUnit: 1,
        });
      }
    }
    const r = await saveEvent(eventId, { tiers: next });
    if (r.ok && r.data?.tiers) setTiers(r.data.tiers);
    if (!r.ok) say({ from: 'bot', text: r.error ?? t.error });
    return r.ok;
  }

  // ---- Step 2: ask for what is still missing, one at a time ----------------

  async function askNext(pendingIn?: string[]) {
    let pending = pendingIn;
    if (!pending) {
      try {
        const r = await fetch(`/api/portal/events/${eventId}/setup-assistant`, { cache: 'no-store' });
        const data = (await r.json()) as { missing?: string[] };
        pending = ORDER.filter((k) => (data.missing ?? []).includes(k));
      } catch {
        pending = [];
      }
    }
    if (pending.length === 0) {
      setAsking(null);
      setQueue([]);
      say({ from: 'bot', text: t.allDone });
      return;
    }
    const [key, ...rest] = pending;
    setQueue(rest);
    if (key === 'payout') {
      setAsking('payoutHolder');
      say({ from: 'bot', text: t.q.payoutHolder });
    } else if (key === 'payoutDemo') {
      say({ from: 'bot', text: t.q.payoutDemo });
      await askNext(rest);
    } else if (key === 'photo' || key === 'publish') {
      setAsking(key);
      say({ from: 'bot', text: t.q[key], goto: { tab: key === 'photo' ? 'media' : 'publish', label: t.buttons[key] } });
    } else {
      setAsking(key);
      say({ from: 'bot', text: t.q[key] });
    }
  }

  /** The seller answered the current question. */
  async function answer(key: string, text: string) {
    if (SKIP_RE.test(text)) {
      say({ from: 'bot', text: t.skip });
      await askNext(queue);
      return;
    }
    let ok = false;
    if (key === 'name' || key === 'venueName' || key === 'address' || key === 'pickupInfo') {
      const r = await saveEvent(eventId, { [key]: text.slice(0, key === 'pickupInfo' ? 600 : 240) });
      ok = r.ok;
      if (!ok) say({ from: 'bot', text: r.error ?? t.error });
    } else if (key === 'eventDate') {
      const p = (await propose(`The event is on ${text}`))?.proposal;
      if (!p?.eventDate) {
        say({ from: 'bot', text: t.notDate });
        return;
      }
      const r = await saveEvent(eventId, { eventDate: p.eventDate, ...(p.dateDisplay ? { dateDisplay: p.dateDisplay } : {}) });
      ok = r.ok;
      if (!ok) say({ from: 'bot', text: r.error ?? t.error });
    } else if (key === 'description') {
      let desc = text;
      if (WRITE_IT_RE.test(text) || text.trim().length < 8) {
        const p = (await propose(`Suggest a warm 2-3 sentence description for my ${kind}. ${said.join(' ')}`))?.proposal;
        desc = p?.description ?? text;
      }
      const r = await saveEvent(eventId, { description: desc.slice(0, 1500) });
      ok = r.ok;
      if (ok && desc !== text) say({ from: 'bot', text: `“${desc}”` });
      if (!ok) say({ from: 'bot', text: r.error ?? t.error });
    } else if (key === 'tiers') {
      const p = (await propose(text))?.proposal;
      if (!p?.tiers?.length) {
        say({ from: 'bot', text: t.q.tiers });
        return;
      }
      ok = await saveTiers(p.tiers);
    } else if (key === 'payoutHolder') {
      if (/paypal/i.test(text)) {
        // PayPal.me instead of a bank account.
        const r = await saveEvent(eventId, { paypalAccount: text.trim() });
        ok = r.ok;
        if (!ok) say({ from: 'bot', text: r.error ?? t.error });
      } else {
        // Held here and saved together with the IBAN — never sent to the AI.
        setHolder(text.trim().slice(0, 120));
        setAsking('payoutIban');
        say({ from: 'bot', text: t.q.payoutIban });
        return;
      }
    } else if (key === 'payoutIban') {
      const iban = text.replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) {
        say({ from: 'bot', text: t.notIban });
        return;
      }
      const r = await saveEvent(eventId, { bankAccountHolder: holder, bankIban: iban });
      ok = r.ok;
      if (!ok) say({ from: 'bot', text: r.error ?? t.notIban });
    } else if (key === 'photo' || key === 'publish') {
      // Anything ("done") after using that section: look again at what is left.
      ok = true;
    }
    if (ok) {
      if (key !== 'photo' && key !== 'publish') say({ from: 'bot', text: t.saved });
      router.refresh();
      await askNext(key === 'photo' || key === 'publish' ? undefined : queue);
    }
  }

  // ---- Step 1: describe it, get a proposal --------------------------------

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { from: 'me', text }]);
    setDraft('');
    setBusy(true);
    try {
      if (asking) {
        await answer(asking, text);
        return;
      }
      const data = await propose([...said, text].join('\n'));
      if (!data?.proposal) {
        say({ from: 'bot', text: data?.error ?? t.error });
      } else {
        const p = data.proposal;
        const tk: Record<string, boolean> = {};
        for (const k of Object.keys(p)) if (k !== 'tiers') tk[k] = true;
        (p.tiers ?? []).forEach((_, i) => (tk[`tier:${i}`] = true));
        setTicks(tk);
        say({ from: 'bot', text: data.reply ?? '', proposal: p, suggested: Boolean(data.suggested) });
      }
    } catch {
      say({ from: 'bot', text: t.offline });
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
    let ok = true;
    if (Object.keys(patch).length) {
      const r = await saveEvent(eventId, patch);
      ok = r.ok;
      if (!ok) say({ from: 'bot', text: r.error ?? t.error });
    }
    if (ok && chosen.length) ok = await saveTiers(chosen);
    setSaving(false);
    if (ok) {
      say({ from: 'bot', text: t.filled(Object.keys(patch).length + chosen.length) });
      router.refresh();
      setBusy(true);
      await askNext();
      setBusy(false);
    }
  }

  /**
   * Open the chat. A listing that is already under way (it has a description
   * or something for sale) goes straight to the questions for what its
   * required steps still lack; a fresh one starts with "tell me about it".
   */
  async function openChat() {
    setOpen(true);
    if (!startedAlready) return;
    setBusy(true);
    say({ from: 'bot', text: t.resume });
    await askNext();
    setBusy(false);
  }

  const fmt = (k: string, v: unknown): string =>
    k === 'totalCapacity' ? `${v} ${isShop ? t.labels.items : t.labels.people}` : String(v);

  if (!open) {
    return (
      <button type="button" className="sa-open" onClick={() => void openChat()}>
        <span className="sa-open-icon" aria-hidden="true">
          ✨
        </span>
        <span className="sa-open-text">
          <strong>{t.openTitle}</strong>
          <span>{t.openLine(kind)}</span>
        </span>
      </button>
    );
  }

  const last = messages[messages.length - 1];

  return (
    <section className="sa" aria-label={t.openTitle}>
      <header className="sa-head">
        <strong>✨ {t.openTitle}</strong>
        <button type="button" className="sa-close" onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>
      <div className="sa-log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`sa-msg sa-${m.from}`}>
            {m.text ? <p>{m.text}</p> : null}
            {m.goto && (
              <button
                type="button"
                className="btn btn-brand btn-sm sa-goto"
                onClick={() => window.dispatchEvent(new CustomEvent(GOTO_TAB_EVENT, { detail: m.goto!.tab }))}
              >
                {m.goto.label}
              </button>
            )}
            {m.proposal && m === last && !asking && (
              <div className="sa-proposal">
                {m.suggested && <p className="sa-suggested">{t.suggested}</p>}
                {Object.entries(m.proposal)
                  .filter(([k]) => k !== 'tiers')
                  .map(([k, v]) => (
                    <label key={k} className="sa-line">
                      <input type="checkbox" checked={Boolean(ticks[k])} onChange={(e) => setTicks((x) => ({ ...x, [k]: e.target.checked }))} />
                      <span className="sa-key">{t.labels[k] ?? k}</span>
                      <span className="sa-val">{fmt(k, v)}</span>
                    </label>
                  ))}
                {(m.proposal.tiers ?? []).map((tier, ti) => (
                  <label key={`t${ti}`} className="sa-line">
                    <input
                      type="checkbox"
                      checked={Boolean(ticks[`tier:${ti}`])}
                      onChange={(e) => setTicks((x) => ({ ...x, [`tier:${ti}`]: e.target.checked }))}
                    />
                    <span className="sa-key">{unit}</span>
                    <span className="sa-val">
                      {tier.name} · {formatMoney(tier.priceCents, currency)}
                      {tier.cap > 0 ? ` · ${tier.cap} ${t.labels.available}` : ''}
                      {tier.studentOnly ? ` · ${t.labels.student}` : ''}
                    </span>
                  </label>
                ))}
                <button type="button" className="btn btn-brand sa-apply" onClick={() => void apply()} disabled={saving}>
                  {saving ? t.filling : t.fill}
                </button>
                <p className="sa-note">{t.note}</p>
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
          placeholder={asking ? t.typing : t.placeholder(isShop)}
          aria-label={t.openTitle}
          autoComplete={asking === 'payoutIban' ? 'off' : undefined}
        />
        <div className="sa-actions">
          <SpeechInput onStart={() => setBase(draft)} onText={(x) => setDraft(`${base ? `${base} ` : ''}${x}`)} label={t.say} />
          <button className="btn btn-brand btn-sm" disabled={busy || !draft.trim()}>
            {t.send}
          </button>
        </div>
      </form>
    </section>
  );
}
