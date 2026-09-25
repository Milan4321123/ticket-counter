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
import { useEffect, useRef, useState } from 'react';
import SpeechInput from '@/components/SpeechInput';
import { formatMoney } from '@/lib/money';
import { ASSISTANT_AWAY_EVENT, ASSISTANT_RETURN_EVENT, GOTO_TAB_EVENT } from './GoToTab';
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
  /** Offer "Publish now" right in the chat. */
  publishNow?: boolean;
  /** A link to the published page. */
  view?: string;
  /** The view link's label, when it is not "View your page". */
  viewLabel?: string;
  /** A "get a real account" link under this message. */
  account?: boolean;
  /** One-tap replies under this message (sent as if typed). */
  chips?: string[];
  /** Show the "which listing?" picker under this message. */
  picker?: boolean;
  /** "Done so far / could still add" — shown once the required steps are in. */
  progress?: Progress;
  /** Pages mentioned in a general answer, as buttons (open in a new tab). */
  links?: { label: string; href: string; icon: string }[];
}

/**
 * A general question, not something for the page: "how do I get paid?",
 * "is it free?", "what is the kitchen screen?", "wie funktioniert…",
 * "kasari…". Anything with a number or a price in it is page content
 * ("can you make momo 10 euro?") and stays with the form filling.
 */
const GENERAL_Q =
  /\?\s*$|^\s*(how|what|why|when|where|who|which|can i|could i|do i|does|is it|is there|are there|will|should i|wie|was|warum|wann|wo|kann ich|gibt es|ist es|kasari|ke |k |kina|kaha|kun|कसरी|के |किन|कहाँ)\b/i;
/** Asking the assistant to DO something ("can you make one up?") is not a general question. */
const TO_THE_HELPER = /\b(can you|could you|would you|will you|kannst du|können sie|please|bitte|suggest|make (one |it )?up|come up|sample|dummy|example|fill|garnus|dinus|banaidinus|milaidinus)\b/i;
const PAGE_DATA = /\d|€|\beuro|\b(change|set|make|add|remove|rename|update|put|write)\b.*\b(price|name|title|date|time|ticket|item|description|address|photo)/i;

/** "[label](/path)" in an answer as real links; the editor stays open. */
function withLinks(text: string) {
  const out: (string | React.ReactElement)[] = [];
  const re = /\[([^\]]{1,60})\]\((\/[^)\s]{0,80})\)|\*\*([^*]{1,80})\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] ? (
        <a key={m.index} href={m[2]} target="_blank" rel="noopener" className="sa-inline">
          {m[1]}
        </a>
      ) : (
        <strong key={m.index}>{m[3]}</strong>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Progress {
  filled: string[];
  extras: { tab: string; label: string; done: boolean }[];
}

/** The progress card's own words (the rest of the chat is in T). */
const PW: Record<Lang, { done: string; more: string; ready: string }> = {
  en: { done: 'On your page', more: 'Could still add — optional', ready: 'Everything optional is in too 🎉' },
  de: { done: 'Auf deiner Seite', more: 'Noch möglich — optional', ready: 'Auch alles Optionale ist drin 🎉' },
  ne: { done: 'तपाईंको पेजमा', more: 'अझै थप्न सकिन्छ — ऐच्छिक', ready: 'ऐच्छिक सबै पनि भयो 🎉' },
};

interface ListingChoice {
  id: string;
  name: string;
  kind: 'event' | 'shop';
  status: string;
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
  buttons: { photo: string; publish: string; publishNow: string; view: string; preview: string; account: string; tools: string };
  demoPreview: string;
  published: string;
  switchBtn: string;
  whatChange: string;
  makeOneUp: string;
  which: string;
  newShop: string;
  newEvent: string;
  current: string;
  draft: string;
  live: string;
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
      confirm: 'All the details are in ✓ — anything to change? Tell me (e.g. “veg momo 7€ instead”), or say “done” when you are happy.',
      photo: 'Now add at least one photo — tap below, pick one, then “Return to the chat”. You can still type changes here.',
      publish: 'Everything is ready. Publish it now?',
    },
    buttons: { photo: 'Add a photo →', publish: 'Open the Publish section', publishNow: '🚀 Publish now', view: 'View your page →', preview: 'Preview my page →', account: 'Apply with this page →', tools: '▦ Your tools: orders, insights… →' },
    demoPreview: 'All done ✓ This is a demo, so your page stays private — it can’t go live. Have a look at it here — and to sell for real, send this page as your application: once approved, it moves into your own account.',
    published: 'Published 🎉 — your page is live.',
    switchBtn: '⇄ Switch',
    makeOneUp: '✨ Make one up for me',
    whatChange: 'Sure — what shall I change or add? E.g. “add 4 more items”, “veg momo 7€”, “write a nicer description”. Say “done” when you are happy.',
    which: 'Which one shall we work on? Pick one, or start a new one.',
    newShop: '＋ New shop',
    newEvent: '＋ New event',
    current: 'open now',
    draft: 'draft',
    live: 'live',
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
      confirm: 'Alle Angaben sind drin ✓ – noch etwas ändern? Sag es mir (z. B. „Veggie-Momo doch 7€“) oder „fertig“, wenn alles passt.',
      photo: 'Jetzt mindestens ein Foto – unten tippen, eins wählen, dann „Zurück zum Chat“. Änderungen kannst du hier weiter tippen.',
      publish: 'Alles bereit. Jetzt veröffentlichen?',
    },
    buttons: { photo: 'Foto hinzufügen →', publish: 'Bereich Veröffentlichen öffnen', publishNow: '🚀 Jetzt veröffentlichen', view: 'Deine Seite ansehen →', preview: 'Vorschau ansehen →', account: 'Mit dieser Seite bewerben →', tools: '▦ Deine Tools: Bestellungen, Statistik… →' },
    demoPreview: 'Fertig ✓ Das ist eine Demo, deine Seite bleibt also privat – sie kann nicht online gehen. Hier kannst du sie ansehen – und um wirklich zu verkaufen, schick diese Seite als Bewerbung: Nach der Freigabe zieht sie in dein eigenes Konto um.',
    published: 'Veröffentlicht 🎉 – deine Seite ist online.',
    switchBtn: '⇄ Wechseln',
    makeOneUp: '✨ Denk dir eins aus',
    whatChange: 'Klar – was soll ich ändern oder ergänzen? Z. B. „füge 4 Artikel hinzu“, „Veggie-Momo 7€“, „schreib eine schönere Beschreibung“. Sag „fertig“, wenn alles passt.',
    which: 'Woran sollen wir arbeiten? Wähle eins aus oder fang neu an.',
    newShop: '＋ Neuer Laden',
    newEvent: '＋ Neues Event',
    current: 'gerade offen',
    draft: 'Entwurf',
    live: 'online',
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
      confirm: 'सबै विवरण भरियो ✓ — केही बदल्नु छ? भन्नुहोस् (जस्तै “veg momo 7 euro”), वा सबै ठीक भए “bhayo” भन्नुहोस्।',
      photo: 'अब कम्तीमा एउटा फोटो थप्नुहोस् — तल थिच्नुहोस्, फोटो छान्नुहोस्, अनि “Return to the chat”। यहाँ परिवर्तन लेख्न सक्नुहुन्छ।',
      publish: 'सबै तयार छ। अहिले प्रकाशित गर्ने?',
    },
    buttons: { photo: 'फोटो थप्नुहोस् →', publish: 'प्रकाशन खण्ड खोल्नुहोस्', publishNow: '🚀 अहिले प्रकाशित गर्नुहोस्', view: 'आफ्नो पेज हेर्नुहोस् →', preview: 'पेजको पूर्वावलोकन →', account: 'यो पेजसहित आवेदन दिनुहोस् →', tools: '▦ तपाईंका उपकरण: अर्डर, तथ्याङ्क… →' },
    demoPreview: 'सबै सकियो ✓ यो डेमो हो, त्यसैले तपाईंको पेज निजी रहन्छ — लाइभ हुँदैन। यहाँ हेर्नुहोस् — साँच्चै बेच्न यही पेज आवेदनको रूपमा पठाउनुहोस्: स्वीकृत भएपछि यो तपाईंको आफ्नै खातामा सर्छ।',
    published: 'प्रकाशित भयो 🎉 — तपाईंको पेज लाइभ छ।',
    switchBtn: '⇄ अर्को',
    makeOneUp: '✨ आफैं बनाइदिनुस्',
    whatChange: 'हुन्छ — के बदल्ने वा थप्ने? जस्तै “arko 4 item thapnus”, “veg momo 7 euro”, “ramro description lekhnus”। सबै ठीक भए “bhayo” भन्नुहोस्।',
    which: 'कुनमा काम गर्ने? एउटा छान्नुहोस्, वा नयाँ सुरु गर्नुहोस्।',
    newShop: '＋ नयाँ पसल',
    newEvent: '＋ नयाँ कार्यक्रम',
    current: 'अहिले खुला',
    draft: 'ड्राफ्ट',
    live: 'लाइभ',
    labels: {
      name: 'नाम', artist: 'कलाकार', description: 'विवरण', dateDisplay: 'मिति (देखिने)', eventDate: 'क्यालेन्डर मिति',
      venueName: 'ठाउँ', address: 'ठेगाना', city: 'शहर', totalCapacity: 'क्षमता', pickupInfo: 'लिन आउने',
      category: 'बजारको खण्ड', item: 'सामान', ticket: 'टिकट', available: 'उपलब्ध', student: 'विद्यार्थी',
      people: 'जना', items: 'वटा',
    },
  },
};

/**
 * The first message, the same in every site language: hello in all three,
 * and the fact that Nepali typed in English letters works too — most people
 * type Nepali that way on an English keyboard.
 */
const GREETING =
  'Namaste 🙏 · Hallo · Hello! Write in English, Deutsch or Nepali — Nepali in English letters is fine too, ' +
  'e.g. “k cha, sanchai xa? mero momo pasal cha, chicken momo 9 euro, sanibar Berlin ma lina aaunus”.';

/** The order the required pieces are asked for. */
const ORDER = ['name', 'eventDate', 'venueName', 'address', 'pickupInfo', 'description', 'tiers', 'payout', 'payoutDemo', 'photo', 'publish', 'preview'];

/** "done" in the languages people type — including Roman Nepali. */
const DONE_RE = /^\s*(done|ok|okay|yes|yep|ready|ja|fertig|erledigt|passt|bhayo|bhaeo|sakiyo|thik cha|thik xa|thik chha|huncha|hunchha|hunxa|ho|भयो|सकियो|ठीक छ|हो)\s*[.!✓]*\s*$/i;
/** Just "edit" / "change it" with nothing said about what — ask what. */
const EDIT_ONLY_RE = /^\s*(i want to |i'?d like to |let'?s |lets |can i |please )?(edit|change|modify|update|fix|correct)( it| this| something| more| the page| my (shop|page|event))?( please)?\s*[.!?]*\s*$|^\s*(bearbeiten|ändern|etwas ändern|korrigieren|badalnu( cha| chha| xa)?|edit garnu( cha| chha| xa)?|milaunu( cha| chha| xa)?|बदल्नु छ|सच्याउनु छ)\s*[.!?]*\s*$/i;

/** Asking to work on a different listing, in any of the three languages. */
const SWITCH_RE = /\b(another|other|different|new|next|second)\s+(shop|store|event|listing|business|page)\b|\b(anderen?|neuen?|weiteren?)\s+(laden|shop|event)\b|\b(arko|naya|aarko|dosro)\s+(pasal|karyakram|dokan|shop|event)\b|अर्को पसल|नयाँ पसल|अर्को कार्यक्रम/i;

/** Questions during which the seller can keep chatting changes. */
const FREE_CHAT = new Set(['confirm', 'photo', 'publish']);

const SKIP_RE = /^\s*(skip|later|next|überspringen|später|weiter|छोड्नुहोस्|छोड|पछि|chodnus|chhodnus|chodnu|pachi|pachhi|pachhi garchu)\s*[.!]?\s*$/i;
const WRITE_IT_RE = /\b(you write|write it|you do it|schreib du|du schreibst|tapai(le)? lekh(nus|idinus|nuhos)|timi(le)? lekh|aafai lekh|lekhidinus)\b|तपाईं लेख्नुहोस्|तपाईं नै लेख्नुहोस्|आफैं लेख्नुहोस्/i;

export default function SetupAssistant({
  eventId,
  kind,
  currency,
  existingTiers,
  lang = 'en',
  startedAlready = false,
  slug = '',
  listings = [],
}: {
  eventId: string;
  kind: 'event' | 'shop';
  currency: string;
  existingTiers: SavedTier[];
  lang?: Lang;
  /** The listing already has content — open on what is still missing. */
  startedAlready?: boolean;
  /** Its address, for "View your page" after publishing. */
  slug?: string;
  /** The seller's other listings, for "which one shall we work on?". */
  listings?: ListingChoice[];
}) {
  const t = T[lang] ?? T.en;
  const router = useRouter();
  const isShop = kind === 'shop';
  const unit = isShop ? t.labels.item : t.labels.ticket;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: 'bot', text: GREETING },
    { from: 'bot', text: t.hello(isShop) },
  ]);
  const [draft, setDraft] = useState('');
  const [base, setBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  /** The required piece being asked for right now, and those after it. */
  const [asking, setAsking] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [holder, setHolder] = useState('');
  /** The seller said the details are right; photo and publish come next. */
  const confirmed = useRef(false);
  const [tiers, setTiers] = useState<SavedTier[]>(existingTiers);

  const said = messages.filter((m) => m.from === 'me').map((m) => m.text);
  /** Something was filled in during this chat (so "what to change?" makes sense). */
  const filledOnce = useRef(false);
  const latest = [...messages].reverse().find((m) => m.proposal)?.proposal ?? null;
  const say = (m: Message) => setMessages((prev) => [...prev, m]);
  const progressRef = useRef<Progress | null>(null);
  /** Steps the seller said "skip" to in this conversation. */
  const skipped = useRef(new Set<string>());

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
        const data = (await r.json()) as { missing?: string[]; progress?: Progress };
        pending = ORDER.filter((k) => (data.missing ?? []).includes(k) && !skipped.current.has(k));
        progressRef.current = data.progress ?? null;
      } catch {
        pending = [];
      }
    }
    if (pending.length === 0) {
      setAsking(null);
      setQueue([]);
      say({ from: 'bot', text: t.allDone, progress: progressRef.current ?? undefined });
      return;
    }
    // Only photo / publish left: first ask whether the details are right.
    if (!confirmed.current && pending.every((k) => k === 'photo' || k === 'publish' || k === 'preview' || k === 'payoutDemo')) {
      if (pending[0] === 'payoutDemo') say({ from: 'bot', text: t.q.payoutDemo });
      setAsking('confirm');
      setQueue(pending.filter((k) => k !== 'payoutDemo'));
      say({ from: 'bot', text: t.q.confirm });
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
    } else if (key === 'photo') {
      setAsking('photo');
      say({ from: 'bot', text: t.q.photo, goto: { tab: 'media', label: t.buttons.photo } });
    } else if (key === 'preview') {
      setAsking(null);
      setQueue([]);
      say({ from: 'bot', text: t.demoPreview, view: `/e/${slug}`, viewLabel: t.buttons.preview, account: true });
      if (progressRef.current) say({ from: 'bot', text: '', progress: progressRef.current });
    } else if (key === 'publish') {
      setAsking('publish');
      say({ from: 'bot', text: t.q.publish, publishNow: true });
    } else {
      setAsking(key);
      say({ from: 'bot', text: t.q[key] });
    }
  }

  /** "Which one shall we work on?" — the picker, as a chat message. */
  function showPicker() {
    say({ from: 'bot', text: t.which, picker: true });
  }

  /** Open another listing's editor with the assistant ready. */
  function openListing(id: string) {
    window.location.href = `/portal/events/${id}/edit?assistant=1`;
  }

  async function startNew(newKind: 'shop' | 'event') {
    setBusy(true);
    try {
      const res = await fetch('/api/portal/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKind === 'shop' ? 'My new shop' : 'My new event', kind: newKind }),
      });
      const data = (await res.json().catch(() => null)) as { eventId?: string; error?: string } | null;
      if (data?.eventId) openListing(data.eventId);
      else {
        say({ from: 'bot', text: data?.error ?? t.error });
        setBusy(false);
      }
    } catch {
      say({ from: 'bot', text: t.offline });
      setBusy(false);
    }
  }

  /** "Publish now" in the chat: the normal save, so every publishing rule applies. */
  async function publishNow() {
    if (busy) return;
    setBusy(true);
    const r = await saveEvent(eventId, { status: 'published' });
    setBusy(false);
    if (r.ok) {
      setAsking(null);
      setQueue([]);
      say({ from: 'bot', text: t.published, view: `/e/${r.data?.slug ?? slug}` });
      if (progressRef.current) say({ from: 'bot', text: '', progress: progressRef.current });
      router.refresh();
    } else {
      // Say exactly what is in the way, and offer the section that has it all.
      say({ from: 'bot', text: r.error ?? t.error, goto: { tab: 'publish', label: t.buttons.publish } });
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

  async function send(typed?: string) {
    const text = (typed ?? draft).trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { from: 'me', text }]);
    setDraft('');
    // "another shop", "new event", "arko pasal"… — offer the picker.
    if (SWITCH_RE.test(text)) {
      showPicker();
      return;
    }
    // A bare "edit": ask what, and hold the photo / publish steps until they
    // say "done" again — never loop back to "publish?" without answering.
    // A general question — answered from the site's own knowledge (the same
    // as the homepage chat), then back to the page right where we were.
    if (GENERAL_Q.test(text) && !PAGE_DATA.test(text) && !TO_THE_HELPER.test(text) && !DONE_RE.test(text)) {
      setBusy(true);
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            from: 'editor',
            history: messages.slice(-6).map((m) => ({ from: m.from, text: m.text })),
          }),
        });
        const d = (await res.json().catch(() => null)) as {
          answer?: string | null;
          note?: string | null;
          links?: { label: string; href: string; icon: string }[];
          error?: string;
        } | null;
        say({ from: 'bot', text: d?.answer ?? d?.note ?? d?.error ?? t.error, links: d?.links?.slice(0, 4) });
        // Back to the page, right where we were.
        const pendingQ = asking ? (t.q as Record<string, string | undefined>)[asking] : undefined;
        if (pendingQ) say({ from: 'bot', text: pendingQ });
      } catch {
        say({ from: 'bot', text: t.offline });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (EDIT_ONLY_RE.test(text)) {
      confirmed.current = false;
      setAsking('confirm');
      say({ from: 'bot', text: t.whatChange });
      return;
    }
    setBusy(true);
    try {
      if (asking && FREE_CHAT.has(asking)) {
        if (DONE_RE.test(text) || SKIP_RE.test(text)) {
          if (asking === 'confirm') confirmed.current = true;
          // "skip" on the photo / publish step: leave it for later instead of
          // asking the same thing again.
          if (SKIP_RE.test(text) && asking !== 'confirm') skipped.current.add(asking);
          await askNext();
          return;
        }
        // Anything else is a change to make — the normal proposal below.
      } else if (asking) {
        await answer(asking, text);
        return;
      }
      const data = await propose([...said, text].join('\n'));
      if (!data?.proposal) {
        say({ from: 'bot', text: data?.error ?? t.error });
      } else {
        const p = data.proposal;
        if (Object.keys(p).filter((k) => k !== 'tiers').length === 0 && !(p.tiers ?? []).length) {
          // Nothing to fill in. On a page that already has content, ask what
          // to change; on an empty one, offer to make one up — never "what
          // shall I change?" when nothing is there yet.
          const hasContent = startedAlready || filledOnce.current;
          if (hasContent) {
            if (data.reply) say({ from: 'bot', text: data.reply });
            confirmed.current = false;
            setAsking('confirm');
            say({ from: 'bot', text: t.whatChange });
          } else {
            say({ from: 'bot', text: data.reply ?? t.error, chips: [t.makeOneUp] });
          }
          return;
        }
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
      filledOnce.current = true;
      confirmed.current = false;
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

  // Back from the section it sent the seller to (photos, publish): look again
  // at what is left — the photo they just added counts at once.
  useEffect(() => {
    const onReturn = () => {
      if (asking !== 'photo' && asking !== 'publish') return;
      setBusy(true);
      void askNext().finally(() => setBusy(false));
    };
    window.addEventListener(ASSISTANT_RETURN_EVENT, onReturn);
    return () => window.removeEventListener(ASSISTANT_RETURN_EVENT, onReturn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking]);

  // ?assistant=1 (the "Try the AI assistant" door): open straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('assistant') === '1') {
      // Sent from the homepage Ask chat ("set up a shop with momo for €30…"):
      // that request is the first message, so the seller never types it twice.
      let handed = '';
      try {
        handed = sessionStorage.getItem('setup:ask') ?? '';
        sessionStorage.removeItem('setup:ask');
      } catch {
        // No storage: the assistant simply opens and asks.
      }
      void openChat().then(() => {
        if (handed.trim()) void send(handed.trim().slice(0, 500));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button type="button" className="sa-switch" onClick={showPicker}>
          {t.switchBtn}
        </button>
        <button type="button" className="sa-close" onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>
      <div className="sa-log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`sa-msg sa-${m.from}`}>
            {m.text ? <p style={{ whiteSpace: 'pre-line' }}>{m.links ? withLinks(m.text) : m.text}</p> : null}
            {m.links && m.links.length > 0 && (
              <div className="ks-presets" style={{ marginTop: 8 }}>
                {m.links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener" className="btn btn-sm">
                    <span aria-hidden="true">{l.icon}</span> {l.label} ↗
                  </a>
                ))}
              </div>
            )}
            {m.chips && m === last && (
              <div className="ks-presets" style={{ marginTop: 8 }}>
                {m.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="btn btn-brand btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void send(c === t.makeOneUp ? `${c} — come up with a complete sample ${kind} yourself` : c)
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {m.picker && (
              <div className="sa-picker">
                {listings.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`sa-pick${l.id === eventId ? ' is-current' : ''}`}
                    disabled={l.id === eventId || busy}
                    onClick={() => openListing(l.id)}
                  >
                    <span aria-hidden="true">{l.kind === 'shop' ? '🛍' : '🎟'}</span>
                    <span className="sa-pick-name">{l.name}</span>
                    <span className="sa-pick-state">
                      {l.id === eventId ? t.current : l.status === 'published' ? t.live : t.draft}
                    </span>
                  </button>
                ))}
                <div className="sa-pick-new">
                  <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={() => void startNew('shop')}>
                    {t.newShop}
                  </button>
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void startNew('event')}>
                    {t.newEvent}
                  </button>
                </div>
              </div>
            )}
            {m.publishNow && m === last && (
              <button type="button" className="btn btn-brand sa-goto" onClick={() => void publishNow()} disabled={busy}>
                {t.buttons.publishNow}
              </button>
            )}
            {m.view && (
              <a href={m.view} target="_blank" rel="noopener" className="btn btn-green btn-sm sa-goto">
                {m.viewLabel ?? t.buttons.view}
              </a>
            )}
            {m.view && (
              <a href={`/portal/events/${eventId}`} className="btn btn-sm sa-goto">
                {t.buttons.tools}
              </a>
            )}
            {m.account && (
              <a href={`/portal/apply?event=${eventId}`} className="btn btn-brand btn-sm sa-goto">
                {t.buttons.account}
              </a>
            )}
            {m.progress && (
              <div className="sa-progress">
                <p className="sa-progress-h">{(PW[lang] ?? PW.en).done}</p>
                <div className="sa-progress-done">
                  {m.progress.filled.map((f) => (
                    <span key={f} className="sa-chip-done">
                      ✓ {f}
                    </span>
                  ))}
                  {m.progress.extras
                    .filter((x) => x.done)
                    .map((x) => (
                      <span key={x.label} className="sa-chip-done">
                        ✓ {x.label}
                      </span>
                    ))}
                </div>
                {m.progress.extras.some((x) => !x.done) ? (
                  <>
                    <p className="sa-progress-h">{(PW[lang] ?? PW.en).more}</p>
                    <div className="sa-progress-more">
                      {m.progress.extras
                        .filter((x) => !x.done)
                        .map((x) => (
                          <button
                            key={x.label}
                            type="button"
                            className="sa-chip-add"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent(ASSISTANT_AWAY_EVENT));
                              window.dispatchEvent(new CustomEvent(GOTO_TAB_EVENT, { detail: x.tab }));
                            }}
                          >
                            ＋ {x.label}
                          </button>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="sa-progress-h">{(PW[lang] ?? PW.en).ready}</p>
                )}
              </div>
            )}
            {m.goto && (
              <button
                type="button"
                className="btn btn-brand btn-sm sa-goto"
                onClick={() => {
                  // Tell the editor to offer "Return to the chat", then go.
                  window.dispatchEvent(new CustomEvent(ASSISTANT_AWAY_EVENT));
                  window.dispatchEvent(new CustomEvent(GOTO_TAB_EVENT, { detail: m.goto!.tab }));
                }}
              >
                {m.goto.label}
              </button>
            )}
            {m.proposal && m === last && (!asking || FREE_CHAT.has(asking)) && (
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
