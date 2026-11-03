// Words for the /work/momo demo in English, Deutsch and नेपाली. "Momo Gaadi"
// is a made-up momo truck; its stops, customers and numbers are invented. Stop
// names are public squares and parks, never a business.
//
// There is no money anywhere in here — no prices, totals, discounts or
// payments, and the stamp card earns a badge, nothing with a value. The only
// exception is the one honest note that says prices are hidden
// (`pricesHidden`, and the frame's "free while we grow"); tests/momoTruck.test.ts
// checks every other string.

import type { Filling, PlaceId, Status, Style, Town } from './truck';

export type Lang = 'en' | 'de' | 'ne';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'de', label: 'DE' },
  { id: 'ne', label: 'नेपाली' },
];

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

export type View = 'customer' | 'crew' | 'both';
export type Tab = 'truck' | 'order' | 'pickup' | 'stamps';
type S = (a: string) => string;
type S2 = (a: string, b: string) => string;

export type Copy = {
  name: string;
  tagline: string;
  madeUp: string;
  fast: string;
  clock: S;
  langLabel: string;
  reset: string;
  resetDone: string;
  viewsLabel: string;
  views: Record<View, string>;
  close: string;
  days: [string, string, string, string, string, string, string];
  daysShort: [string, string, string, string, string, string, string];
  towns: Record<Town, string>;
  places: Record<PlaceId, string>;

  // customer: tabs
  tabsLabel: string;
  tabs: Record<Tab, string>;

  // customer: where is the truck
  todayH: S;
  mapLabel: S;
  statusOpen: S;
  statusOpens: S;
  statusSoldOut: string;
  statusClosed: string;
  statusDriving: S2;
  statusLater: S;
  statusLeft: string;
  inMin: S;
  here: string;
  pausedNote: string;
  stopsH: string;
  weekH: string;
  todayTag: string;
  restDay: string;
  notifyOn: S;
  notifyOff: S;
  notifySet: S;
  notifyUnset: S;
  arrived: S;
  pushH: string;
  pushSub: string;
  pushAllow: string;
  pushOn: string;
  pushDenied: string;
  pushNone: string;
  pushPreview: string;
  nearH: string;
  nearPick: string;
  nearClear: string;
  nearNow: string;
  nearToday: S2;
  nearOther: S2;
  nearTag: string;
  orderAhead: string;
  doneToday: S2;

  // customer: order ahead
  menuH: string;
  menuSub: string;
  pricesHidden: string;
  fillings: Record<Filling, { name: string; ne: string; desc: string }>;
  veg: string;
  vegan: string;
  styles: Record<Style, string>;
  soldOut: string;
  plates: S;
  less: string;
  more: string;
  trayH: string;
  trayEmpty: string;
  trayMax: S;
  remove: string;
  acharH: string;
  achars: [string, string, string, string];
  slotH: string;
  slotSub: S;
  slotLeft: S;
  slotFull: string;
  noSlots: string;
  forNext: S;
  placeBtn: S;
  pickTime: string;
  placed: S;
  reasons: Record<'closed' | 'paused' | 'empty' | 'too-many' | 'sold-out' | 'no-slot' | 'full' | 'busy', string>;

  // customer: pickup
  noOrder: string;
  noOrderSub: string;
  yourNumber: string;
  showCode: string;
  codeLabel: S;
  steps: Record<Status, string>;
  ahead: S;
  aheadOne: string;
  aheadNone: string;
  pickupAt: S2;
  handBtn: string;
  handHint: string;
  thanks: string;
  readyH: string;
  readySub: S;
  readyOk: string;
  orderAgain: string;
  earlier: string;

  // customer: stamps
  stampsH: string;
  stampsSub: string;
  stampsN: S2;
  badgesH: string;
  badgeName: string;
  noBadge: S;
  badgeToast: string;
  stampToast: S2;

  // crew
  crewH: string;
  crewSub: string;
  pauseLabel: string;
  pauseOn: string;
  pauseOff: string;
  pausedToast: string;
  resumedToast: string;
  autoLabel: string;
  autoSub: string;
  steamersH: string;
  steamer: S;
  platesOf: S2;
  queueH: string;
  queueFor: S;
  queueEmpty: string;
  slotLoad: S2;
  go: Record<Exclude<Status, 'picked'>, string>;
  you: string;
  steamersFull: string;
  notHere: string;
  scanBtn: string;
  scanH: string;
  scanSub: string;
  scanNone: string;
  scanning: string;
  scanType: string;
  scanTypePh: string;
  scanGo: string;
  scanned: Record<'handed' | 'not-ready' | 'already' | 'unknown', S>;
  soldOutH: string;
  soldOutToast: S;
  backToast: S;
  capH: string;
  capSub: string;
  capVal: S;
  routeH: string;
  moveBtn: S;
  moveEnd: string;
  moveDay: S;
  movingTo: S;
  mineWaiting: string;
  movedToast: S;
  closedToast: string;
  newDayToast: S;
  servingBtn: string;
  servingH: string;
  servingReady: string;
  servingSteaming: string;
  servingNone: string;
  servingExit: string;
  servingSub: string;
  countsH: string;
  countsOrders: string;
  countsPlates: string;
  countsStops: string;
  perSlotH: string;
  perSlotNone: string;
  byFillingH: string;
  countsNote: string;
  sound: string;
};

const PLACE_NAMES: Record<PlaceId, string> = {
  'mz-rhein': 'Rheinufer',
  'mz-markt': 'Wochenmarkt',
  'wi-markt': 'Marktplatz',
  'wi-kurpark': 'Kurpark',
  'da-markt': 'Marktplatz',
  'da-garten': 'Herrngarten',
};

const en: Copy = {
  name: 'Momo Gaadi',
  tagline: 'Nepali momo on wheels · Mainz · Wiesbaden · Darmstadt',
  madeUp: 'A made-up momo truck — nothing is sent anywhere',
  fast: 'The day runs 12× faster',
  clock: (t) => `Truck time ${t}`,
  langLabel: 'Language',
  reset: 'Reset demo',
  resetDone: 'A fresh Friday on the road.',
  viewsLabel: 'Choose a view',
  views: { customer: 'Customer', crew: 'Crew view', both: 'Side by side' },
  close: 'Close',
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  towns: { mainz: 'Mainz', wiesbaden: 'Wiesbaden', darmstadt: 'Darmstadt' },
  places: PLACE_NAMES,

  tabsLabel: 'Momo Gaadi app',
  tabs: { truck: 'Truck', order: 'Order', pickup: 'Pickup', stamps: 'Stamps' },

  todayH: (d) => `Today, ${d}`,
  mapLabel: (s) => `Map of the truck's route. ${s}`,
  statusOpen: (t) => `Open now · until ${t}`,
  statusOpens: (t) => `Opens at ${t}`,
  statusSoldOut: 'Sold out here today',
  statusClosed: 'Done for today',
  statusDriving: (p, t) => `On the way to ${p} · arrives ≈ ${t}`,
  statusLater: (t) => `Opens ≈ ${t}`,
  statusLeft: 'Been and gone',
  inMin: (n) => `in ${n} min`,
  here: 'The truck is here',
  pausedNote: 'Online orders are paused for a moment — come to the window, the crew is still steaming.',
  stopsH: "Today's stops",
  weekH: 'This week',
  todayTag: 'Today',
  restDay: 'Rest day — the crew folds momo for the week',
  notifyOn: (p) => `Stop telling me about ${p}`,
  notifyOff: (p) => `Tell me when the truck reaches ${p}`,
  notifySet: (p) => `We'll tell you when Momo Gaadi reaches ${p}.`,
  notifyUnset: (p) => `No more notes for ${p}.`,
  arrived: (p) => `Momo Gaadi just parked at ${p} — the steamers are on!`,
  pushH: 'Phone notifications',
  pushSub: 'Off by default — the note shows on this page. Only if you tap below does your browser ask to show a real notification.',
  pushAllow: 'Allow phone notifications',
  pushOn: 'Phone notifications are on',
  pushDenied: 'Your browser said no — you still get the note on this page.',
  pushNone: 'This browser has no notifications — you still get the note on this page.',
  pushPreview: 'Show a preview',
  nearH: "I'm near…",
  nearPick: 'Pick the stop you are near (no location needed)',
  nearClear: 'Clear',
  nearNow: 'The truck is at your stop right now!',
  nearToday: (t, n) => `The truck is at your stop at ${t} (${n}).`,
  nearOther: (d, t) => `Next time at your stop: ${d}, ${t}.`,
  nearTag: 'Your stop',
  orderAhead: 'Order ahead',
  doneToday: (d, p) => `Done for today. Next: ${d} at ${p}.`,

  menuH: 'Menu',
  menuSub: '10 momo a plate · folded by hand, steamed in the truck',
  pricesHidden: 'Prices hidden in this demo',
  fillings: {
    chicken: { name: 'Chicken momo', ne: 'कुखुराको मःम', desc: 'Minced chicken, onion, ginger, fresh coriander' },
    veg: { name: 'Veg momo', ne: 'तरकारी मःम', desc: 'Cabbage, carrot, spring onion, a little cheese' },
    paneer: { name: 'Paneer momo', ne: 'पनिर मःम', desc: 'Crumbled paneer, spinach, cumin' },
    vegan: { name: 'Vegan momo', ne: 'भेगन मःम', desc: 'Tofu, mushroom, cabbage — no dairy, no egg' },
  },
  veg: 'Veggie',
  vegan: 'Vegan',
  styles: { steamed: 'Steamed', fried: 'Fried', jhol: 'Jhol', chilli: 'C-momo' },
  soldOut: 'Sold out',
  plates: (n) => (n === '1' ? '1 plate' : `${n} plates`),
  less: 'One plate less',
  more: 'One plate more',
  trayH: 'Your tray',
  trayEmpty: 'Choose a filling and a style, then add a plate or two.',
  trayMax: (n) => `Up to ${n} plates per order`,
  remove: 'Remove',
  acharH: 'Achar (dipping sauce)',
  achars: ['Mild', 'Medium', 'Hot', 'Dalle hot'],
  slotH: 'Pickup time',
  slotSub: (p) => `At ${p} · each 10-minute slot takes a few plates`,
  slotLeft: (n) => `${n} left`,
  slotFull: 'Full',
  noSlots: 'No pickup times left at this stop — try the next one.',
  forNext: (p) => `The truck is driving — order ahead for ${p}.`,
  placeBtn: (t) => `Order for ${t}`,
  pickTime: 'Pick a pickup time',
  placed: (n) => `Ordered! Your pickup number is ${n}.`,
  reasons: {
    closed: 'The truck is done for today.',
    paused: 'Online orders are paused — come to the window.',
    empty: 'Add a plate first.',
    'too-many': 'That is more than one order can take.',
    'sold-out': 'Something in your tray just sold out.',
    'no-slot': 'Pick a pickup time.',
    full: 'That slot just filled up — pick another.',
    busy: 'You already have two orders on the way.',
  },

  noOrder: 'No order yet',
  noOrderSub: 'Order ahead and skip the line — your number shows up here.',
  yourNumber: 'Your pickup number',
  showCode: 'Show this code at the window',
  codeLabel: (n) => `Pickup code for number ${n}`,
  steps: { placed: 'Ordered', steaming: 'Steaming', ready: 'Ready', picked: 'Picked up' },
  ahead: (n) => `${n} orders ahead of you`,
  aheadOne: '1 order ahead of you',
  aheadNone: "You're next!",
  pickupAt: (t, p) => `Pick up at ${t} · ${p}`,
  handBtn: 'Hand my code to the crew',
  handHint: 'In real life the crew scans it at the window.',
  thanks: 'Enjoy your momo! A stamp went on your card.',
  readyH: 'Your momo are ready!',
  readySub: (n) => `Show number ${n} at the window`,
  readyOk: 'On my way',
  orderAgain: 'Order again',
  earlier: 'Earlier today',

  stampsH: 'Stamp card',
  stampsSub: 'A stamp for every pickup. Eight stamps earn a Momo Master badge — just for fun.',
  stampsN: (a, b) => `${a} of ${b} stamps`,
  badgesH: 'Your badges',
  badgeName: 'Momo Master',
  noBadge: (n) => `No badge yet — ${n} more pickups to go.`,
  badgeToast: 'Eight stamps — you are a Momo Master!',
  stampToast: (a, b) => `Stamp ${a} of ${b} on your card.`,

  crewH: 'Crew view',
  crewSub: "The tablet in the truck: queue, steamers and the day's switches",
  pauseLabel: 'Pause online orders',
  pauseOn: 'Paused — window only',
  pauseOff: 'Taking orders',
  pausedToast: 'Online orders paused.',
  resumedToast: 'Online orders are back on.',
  autoLabel: 'Crew helpers',
  autoSub: 'Simulated crew steams and hands out by itself',
  steamersH: 'Steamers',
  steamer: (n) => `Steamer ${n}`,
  platesOf: (a, b) => `${a}/${b} plates`,
  queueH: 'Queue',
  queueFor: (p) => `Pickups at ${p}`,
  queueEmpty: 'No orders yet — the steam is up.',
  slotLoad: (a, b) => `${a}/${b} plates`,
  go: { placed: 'Start steaming', steaming: 'Mark ready', ready: 'Hand over' },
  you: 'You',
  steamersFull: 'All three steamers are full — wait for a batch.',
  notHere: 'That order is for another stop.',
  scanBtn: 'Scan pickup code',
  scanH: 'Scan a pickup code',
  scanSub: 'Simulated scanner: tap the code a customer is holding up, or type the number.',
  scanNone: 'No orders are ready yet.',
  scanning: 'Scanning…',
  scanType: 'Pickup number',
  scanTypePh: 'e.g. 42',
  scanGo: 'Check',
  scanned: {
    handed: (n) => `Number ${n} handed over. Enjoy!`,
    'not-ready': (n) => `Number ${n} is not ready yet.`,
    already: (n) => `Number ${n} was already picked up.`,
    unknown: () => 'That code is not in today’s queue here.',
  },
  soldOutH: 'Sold out today',
  soldOutToast: (f) => `${f} marked sold out.`,
  backToast: (f) => `${f} is back on the menu.`,
  capH: 'Plates per 10-minute slot',
  capSub: 'Fewer plates per slot = a shorter wait at the window',
  capVal: (n) => `${n} plates`,
  routeH: 'Route',
  moveBtn: (p) => `Move to next stop: ${p}`,
  moveEnd: 'Close for today',
  moveDay: (d) => `Start ${d}'s route`,
  movingTo: (p) => `Driving to ${p}…`,
  mineWaiting: 'Your own test order is still in the queue — hand it over first.',
  movedToast: (p) => `On the road to ${p}.`,
  closedToast: 'Closed for today. Steamers off.',
  newDayToast: (d) => `Good morning — ${d}'s route begins.`,
  servingBtn: 'Now Serving screen',
  servingH: 'Now serving',
  servingReady: 'Ready',
  servingSteaming: 'Steaming',
  servingNone: 'Steam is up — numbers soon',
  servingExit: 'Exit (Esc)',
  servingSub: 'For a tablet in the truck window',
  countsH: "Today's counts",
  countsOrders: 'Orders',
  countsPlates: 'Plates',
  countsStops: 'Stops',
  perSlotH: 'Orders per pickup slot · this stop',
  perSlotNone: 'No orders for this stop yet.',
  byFillingH: 'Plates by filling',
  countsNote: 'Counts only.',
  sound: 'Sound',
};

const de: Copy = {
  name: 'Momo Gaadi',
  tagline: 'Nepalesische Momos auf Rädern · Mainz · Wiesbaden · Darmstadt',
  madeUp: 'Ein erfundener Momo-Truck — nichts wird verschickt',
  fast: 'Der Tag läuft 12× schneller',
  clock: (t) => `Truck-Zeit ${t}`,
  langLabel: 'Sprache',
  reset: 'Demo zurücksetzen',
  resetDone: 'Ein frischer Freitag auf der Straße.',
  viewsLabel: 'Ansicht wählen',
  views: { customer: 'Kundschaft', crew: 'Crew-Ansicht', both: 'Nebeneinander' },
  close: 'Schließen',
  days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  daysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  towns: { mainz: 'Mainz', wiesbaden: 'Wiesbaden', darmstadt: 'Darmstadt' },
  places: PLACE_NAMES,

  tabsLabel: 'Momo-Gaadi-App',
  tabs: { truck: 'Truck', order: 'Bestellen', pickup: 'Abholung', stamps: 'Stempel' },

  todayH: (d) => `Heute, ${d}`,
  mapLabel: (s) => `Karte mit der Route des Trucks. ${s}`,
  statusOpen: (t) => `Jetzt geöffnet · bis ${t}`,
  statusOpens: (t) => `Öffnet um ${t}`,
  statusSoldOut: 'Hier heute ausverkauft',
  statusClosed: 'Für heute fertig',
  statusDriving: (p, t) => `Unterwegs nach ${p} · Ankunft ≈ ${t}`,
  statusLater: (t) => `Öffnet ≈ ${t}`,
  statusLeft: 'Schon weitergefahren',
  inMin: (n) => `in ${n} Min.`,
  here: 'Der Truck ist da',
  pausedNote: 'Online-Bestellungen sind kurz pausiert — komm ans Fenster, die Crew dämpft weiter.',
  stopsH: 'Heutige Stopps',
  weekH: 'Diese Woche',
  todayTag: 'Heute',
  restDay: 'Ruhetag — die Crew faltet Momos für die Woche',
  notifyOn: (p) => `Keine Nachricht mehr für ${p}`,
  notifyOff: (p) => `Sag mir, wenn der Truck in ${p} ankommt`,
  notifySet: (p) => `Wir sagen dir Bescheid, wenn Momo Gaadi in ${p} ankommt.`,
  notifyUnset: (p) => `Keine Nachrichten mehr für ${p}.`,
  arrived: (p) => `Momo Gaadi parkt jetzt in ${p} — die Dampfgarer laufen!`,
  pushH: 'Benachrichtigungen aufs Handy',
  pushSub: 'Standardmäßig aus — der Hinweis erscheint auf dieser Seite. Nur wenn du unten tippst, fragt dein Browser nach echten Benachrichtigungen.',
  pushAllow: 'Benachrichtigungen erlauben',
  pushOn: 'Benachrichtigungen sind an',
  pushDenied: 'Dein Browser hat abgelehnt — den Hinweis auf der Seite bekommst du trotzdem.',
  pushNone: 'Dieser Browser kann keine Benachrichtigungen — den Hinweis auf der Seite bekommst du trotzdem.',
  pushPreview: 'Vorschau zeigen',
  nearH: 'Ich bin in der Nähe von …',
  nearPick: 'Wähl deinen Stopp (ohne Standort)',
  nearClear: 'Löschen',
  nearNow: 'Der Truck steht gerade an deinem Stopp!',
  nearToday: (t, n) => `Der Truck ist um ${t} an deinem Stopp (${n}).`,
  nearOther: (d, t) => `Nächstes Mal an deinem Stopp: ${d}, ${t}.`,
  nearTag: 'Dein Stopp',
  orderAhead: 'Vorbestellen',
  doneToday: (d, p) => `Für heute fertig. Weiter: ${d} in ${p}.`,

  menuH: 'Karte',
  menuSub: '10 Momos pro Teller · von Hand gefaltet, im Truck gedämpft',
  pricesHidden: 'Preise sind in dieser Demo ausgeblendet',
  fillings: {
    chicken: { name: 'Hähnchen-Momo', ne: 'कुखुराको मःम', desc: 'Hähnchenhack, Zwiebel, Ingwer, frischer Koriander' },
    veg: { name: 'Gemüse-Momo', ne: 'तरकारी मःम', desc: 'Kohl, Karotte, Frühlingszwiebel, etwas Käse' },
    paneer: { name: 'Paneer-Momo', ne: 'पनिर मःम', desc: 'Zerbröselter Paneer, Spinat, Kreuzkümmel' },
    vegan: { name: 'Vegane Momo', ne: 'भेगन मःम', desc: 'Tofu, Pilze, Kohl — ohne Milch, ohne Ei' },
  },
  veg: 'Vegetarisch',
  vegan: 'Vegan',
  styles: { steamed: 'Gedämpft', fried: 'Frittiert', jhol: 'Jhol', chilli: 'C-Momo' },
  soldOut: 'Ausverkauft',
  plates: (n) => (n === '1' ? '1 Teller' : `${n} Teller`),
  less: 'Ein Teller weniger',
  more: 'Ein Teller mehr',
  trayH: 'Dein Tablett',
  trayEmpty: 'Wähl Füllung und Art, dann ein, zwei Teller dazu.',
  trayMax: (n) => `Bis zu ${n} Teller pro Bestellung`,
  remove: 'Entfernen',
  acharH: 'Achar (Dip-Soße)',
  achars: ['Mild', 'Mittel', 'Scharf', 'Dalle-scharf'],
  slotH: 'Abholzeit',
  slotSub: (p) => `In ${p} · jedes 10-Minuten-Fenster nimmt ein paar Teller`,
  slotLeft: (n) => `noch ${n}`,
  slotFull: 'Voll',
  noSlots: 'An diesem Stopp gibt es keine Abholzeiten mehr — versuch den nächsten.',
  forNext: (p) => `Der Truck ist unterwegs — bestell schon für ${p} vor.`,
  placeBtn: (t) => `Für ${t} bestellen`,
  pickTime: 'Wähl eine Abholzeit',
  placed: (n) => `Bestellt! Deine Abholnummer ist ${n}.`,
  reasons: {
    closed: 'Der Truck ist für heute fertig.',
    paused: 'Online-Bestellungen sind pausiert — komm ans Fenster.',
    empty: 'Leg erst einen Teller aufs Tablett.',
    'too-many': 'Das ist mehr, als eine Bestellung fasst.',
    'sold-out': 'Etwas auf deinem Tablett ist gerade ausverkauft.',
    'no-slot': 'Wähl eine Abholzeit.',
    full: 'Das Zeitfenster ist gerade voll geworden — wähl ein anderes.',
    busy: 'Du hast schon zwei Bestellungen unterwegs.',
  },

  noOrder: 'Noch keine Bestellung',
  noOrderSub: 'Vorbestellen und die Schlange überspringen — deine Nummer erscheint hier.',
  yourNumber: 'Deine Abholnummer',
  showCode: 'Zeig diesen Code am Fenster',
  codeLabel: (n) => `Abholcode für Nummer ${n}`,
  steps: { placed: 'Bestellt', steaming: 'Im Dampf', ready: 'Fertig', picked: 'Abgeholt' },
  ahead: (n) => `${n} Bestellungen vor dir`,
  aheadOne: '1 Bestellung vor dir',
  aheadNone: 'Du bist als Nächstes dran!',
  pickupAt: (t, p) => `Abholung um ${t} · ${p}`,
  handBtn: 'Code der Crew zeigen',
  handHint: 'In echt scannt die Crew ihn am Fenster.',
  thanks: 'Guten Appetit! Ein Stempel ist auf deiner Karte.',
  readyH: 'Deine Momos sind fertig!',
  readySub: (n) => `Zeig Nummer ${n} am Fenster`,
  readyOk: 'Bin unterwegs',
  orderAgain: 'Nochmal bestellen',
  earlier: 'Heute schon',

  stampsH: 'Stempelkarte',
  stampsSub: 'Ein Stempel pro Abholung. Acht Stempel bringen das Abzeichen „Momo Master“ — einfach so, zum Spaß.',
  stampsN: (a, b) => `${a} von ${b} Stempeln`,
  badgesH: 'Deine Abzeichen',
  badgeName: 'Momo Master',
  noBadge: (n) => `Noch kein Abzeichen — noch ${n} Abholungen.`,
  badgeToast: 'Acht Stempel — du bist Momo Master!',
  stampToast: (a, b) => `Stempel ${a} von ${b} auf deiner Karte.`,

  crewH: 'Crew-Ansicht',
  crewSub: 'Das Tablet im Truck: Schlange, Dampfgarer und die Schalter des Tages',
  pauseLabel: 'Online-Bestellungen pausieren',
  pauseOn: 'Pausiert — nur am Fenster',
  pauseOff: 'Nimmt Bestellungen an',
  pausedToast: 'Online-Bestellungen pausiert.',
  resumedToast: 'Online-Bestellungen laufen wieder.',
  autoLabel: 'Crew-Helfer',
  autoSub: 'Die simulierte Crew dämpft und gibt von selbst aus',
  steamersH: 'Dampfgarer',
  steamer: (n) => `Dampfgarer ${n}`,
  platesOf: (a, b) => `${a}/${b} Teller`,
  queueH: 'Schlange',
  queueFor: (p) => `Abholungen in ${p}`,
  queueEmpty: 'Noch keine Bestellungen — der Dampf steht.',
  slotLoad: (a, b) => `${a}/${b} Teller`,
  go: { placed: 'In den Dampf', steaming: 'Fertig melden', ready: 'Ausgeben' },
  you: 'Du',
  steamersFull: 'Alle drei Dampfgarer sind voll — warte auf eine Ladung.',
  notHere: 'Diese Bestellung ist für einen anderen Stopp.',
  scanBtn: 'Abholcode scannen',
  scanH: 'Abholcode scannen',
  scanSub: 'Simulierter Scanner: tipp auf den Code, den jemand hochhält, oder gib die Nummer ein.',
  scanNone: 'Noch ist nichts fertig.',
  scanning: 'Scanne …',
  scanType: 'Abholnummer',
  scanTypePh: 'z. B. 42',
  scanGo: 'Prüfen',
  scanned: {
    handed: (n) => `Nummer ${n} ausgegeben. Guten Appetit!`,
    'not-ready': (n) => `Nummer ${n} ist noch nicht fertig.`,
    already: (n) => `Nummer ${n} wurde schon abgeholt.`,
    unknown: () => 'Dieser Code ist heute hier nicht in der Schlange.',
  },
  soldOutH: 'Heute ausverkauft',
  soldOutToast: (f) => `${f} ist ausverkauft.`,
  backToast: (f) => `${f} ist wieder da.`,
  capH: 'Teller pro 10-Minuten-Fenster',
  capSub: 'Weniger Teller pro Fenster = kürzeres Warten am Fenster',
  capVal: (n) => `${n} Teller`,
  routeH: 'Route',
  moveBtn: (p) => `Weiter zum nächsten Stopp: ${p}`,
  moveEnd: 'Für heute schließen',
  moveDay: (d) => `Route für ${d} starten`,
  movingTo: (p) => `Fährt nach ${p} …`,
  mineWaiting: 'Deine eigene Test-Bestellung wartet noch — gib sie zuerst aus.',
  movedToast: (p) => `Auf dem Weg nach ${p}.`,
  closedToast: 'Für heute geschlossen. Dampfgarer aus.',
  newDayToast: (d) => `Guten Morgen — die Route für ${d} beginnt.`,
  servingBtn: '„Jetzt dran“-Anzeige',
  servingH: 'Jetzt dran',
  servingReady: 'Fertig',
  servingSteaming: 'Im Dampf',
  servingNone: 'Der Dampf steht — gleich gibt es Nummern',
  servingExit: 'Beenden (Esc)',
  servingSub: 'Für ein Tablet im Truck-Fenster',
  countsH: 'Heute gezählt',
  countsOrders: 'Bestellungen',
  countsPlates: 'Teller',
  countsStops: 'Stopps',
  perSlotH: 'Bestellungen pro Abholfenster · dieser Stopp',
  perSlotNone: 'Für diesen Stopp gibt es noch keine Bestellungen.',
  byFillingH: 'Teller nach Füllung',
  countsNote: 'Nur gezählt, sonst nichts.',
  sound: 'Ton',
};

const ne: Copy = {
  name: 'मःम गाडी',
  tagline: 'पाङ्ग्रामा नेपाली मःम · माइन्ज · वीसबाडेन · डार्मस्टाट',
  madeUp: 'काल्पनिक मःम ट्रक — केही पनि कतै पठाइँदैन',
  fast: 'दिन १२ गुणा छिटो चल्छ',
  clock: (t) => `ट्रकको समय ${t}`,
  langLabel: 'भाषा',
  reset: 'डेमो सुरुबाट',
  resetDone: 'बाटोमा नयाँ शुक्रबार।',
  viewsLabel: 'दृश्य छान्नुहोस्',
  views: { customer: 'ग्राहक', crew: 'टोलीको दृश्य', both: 'छेउछाउ' },
  close: 'बन्द',
  days: ['सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार', 'आइतबार'],
  daysShort: ['सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि', 'आइत'],
  towns: { mainz: 'माइन्ज', wiesbaden: 'वीसबाडेन', darmstadt: 'डार्मस्टाट' },
  places: PLACE_NAMES,

  tabsLabel: 'मःम गाडी एप',
  tabs: { truck: 'ट्रक', order: 'अर्डर', pickup: 'लिन आउनु', stamps: 'छाप' },

  todayH: (d) => `आज, ${d}`,
  mapLabel: (s) => `ट्रकको बाटोको नक्सा। ${s}`,
  statusOpen: (t) => `अहिले खुला · ${t} सम्म`,
  statusOpens: (t) => `${t} मा खुल्छ`,
  statusSoldOut: 'आज यहाँ सबै सकियो',
  statusClosed: 'आजलाई सकियो',
  statusDriving: (p, t) => `${p} तर्फ जाँदै · ≈ ${t} मा पुग्छ`,
  statusLater: (t) => `≈ ${t} मा खुल्छ`,
  statusLeft: 'आइसकेर गइसक्यो',
  inMin: (n) => `${n} मिनेटमा`,
  here: 'ट्रक यहीँ छ',
  pausedNote: 'अनलाइन अर्डर केही बेर रोकिएको छ — झ्यालमा आउनुहोस्, टोलीले मःम पकाइरहेको छ।',
  stopsH: 'आजका स्टप',
  weekH: 'यो हप्ता',
  todayTag: 'आज',
  restDay: 'बिदाको दिन — टोलीले हप्ताभरिका मःम बेर्छ',
  notifyOn: (p) => `${p} को सूचना बन्द गर्नुहोस्`,
  notifyOff: (p) => `ट्रक ${p} पुगेपछि मलाई भन्नुहोस्`,
  notifySet: (p) => `मःम गाडी ${p} पुगेपछि हामी तपाईंलाई भन्छौं।`,
  notifyUnset: (p) => `${p} को सूचना अब आउँदैन।`,
  arrived: (p) => `मःम गाडी भर्खरै ${p} मा आइपुग्यो — स्टिमर चालु छ!`,
  pushH: 'फोनमा सूचना',
  pushSub: 'सुरुमा बन्द — सूचना यही पेजमा देखिन्छ। तल थिच्नुभयो भने मात्र ब्राउजरले साँच्चैको सूचनाका लागि सोध्छ।',
  pushAllow: 'फोनमा सूचना अनुमति दिनुहोस्',
  pushOn: 'फोनमा सूचना चालु छ',
  pushDenied: 'ब्राउजरले मानेन — पेजमा सूचना भने आइरहन्छ।',
  pushNone: 'यो ब्राउजरमा सूचना चल्दैन — पेजमा सूचना भने आइरहन्छ।',
  pushPreview: 'नमुना हेर्नुहोस्',
  nearH: 'म नजिकै छु…',
  nearPick: 'नजिकको स्टप छान्नुहोस् (लोकेसन चाहिँदैन)',
  nearClear: 'हटाउनुहोस्',
  nearNow: 'ट्रक अहिले तपाईंकै स्टपमा छ!',
  nearToday: (t, n) => `ट्रक ${t} मा तपाईंको स्टपमा हुन्छ (${n})।`,
  nearOther: (d, t) => `तपाईंको स्टपमा अर्को पटक: ${d}, ${t}।`,
  nearTag: 'तपाईंको स्टप',
  orderAhead: 'पहिल्यै अर्डर',
  doneToday: (d, p) => `आजलाई सकियो। अर्को: ${d}, ${p}।`,

  menuH: 'मेनु',
  menuSub: 'एक प्लेटमा १० वटा मःम · हातले बेरेको, ट्रकमै पकाएको',
  pricesHidden: 'यो डेमोमा मूल्य लुकाइएको छ',
  fillings: {
    chicken: { name: 'कुखुराको मःम', ne: 'Kukhura Momo', desc: 'कुखुराको कीमा, प्याज, अदुवा, ताजा धनियाँ' },
    veg: { name: 'तरकारी मःम', ne: 'Tarkari Momo', desc: 'बन्दा, गाजर, हरियो प्याज, अलिकति चिज' },
    paneer: { name: 'पनिर मःम', ne: 'Paneer Momo', desc: 'पनिर, पालुङ्गो, जीरा' },
    vegan: { name: 'भेगन मःम', ne: 'Vegan Momo', desc: 'टोफु, च्याउ, बन्दा — दूध र अण्डा बिना' },
  },
  veg: 'शाकाहारी',
  vegan: 'भेगन',
  styles: { steamed: 'स्टिम', fried: 'फ्राई', jhol: 'झोल', chilli: 'सी-मःम' },
  soldOut: 'सकियो',
  plates: (n) => `${n} प्लेट`,
  less: 'एक प्लेट कम',
  more: 'एक प्लेट थप',
  trayH: 'तपाईंको थाल',
  trayEmpty: 'भित्रको मसला र किसिम छान्नुहोस्, अनि एक-दुई प्लेट थप्नुहोस्।',
  trayMax: (n) => `एउटा अर्डरमा बढीमा ${n} प्लेट`,
  remove: 'हटाउनुहोस्',
  acharH: 'अचार',
  achars: ['कम पिरो', 'मध्यम', 'पिरो', 'डल्ले पिरो'],
  slotH: 'लिन आउने समय',
  slotSub: (p) => `${p} मा · हरेक १० मिनेटमा केही प्लेट मात्र`,
  slotLeft: (n) => `${n} बाँकी`,
  slotFull: 'भरियो',
  noSlots: 'यो स्टपमा लिन आउने समय बाँकी छैन — अर्को स्टप हेर्नुहोस्।',
  forNext: (p) => `ट्रक बाटोमा छ — ${p} का लागि पहिल्यै अर्डर गर्नुहोस्।`,
  placeBtn: (t) => `${t} का लागि अर्डर`,
  pickTime: 'लिन आउने समय छान्नुहोस्',
  placed: (n) => `अर्डर भयो! तपाईंको नम्बर ${n} हो।`,
  reasons: {
    closed: 'ट्रक आजलाई बन्द भयो।',
    paused: 'अनलाइन अर्डर रोकिएको छ — झ्यालमा आउनुहोस्।',
    empty: 'पहिले एउटा प्लेट थप्नुहोस्।',
    'too-many': 'एउटा अर्डरमा यति धेरै मिल्दैन।',
    'sold-out': 'थालमा भएको कुनै मःम भर्खरै सकियो।',
    'no-slot': 'लिन आउने समय छान्नुहोस्।',
    full: 'त्यो समय भर्खरै भरियो — अर्को छान्नुहोस्।',
    busy: 'तपाईंका दुई अर्डर पहिल्यै बाटोमा छन्।',
  },

  noOrder: 'अहिलेसम्म अर्डर छैन',
  noOrderSub: 'पहिल्यै अर्डर गर्नुहोस्, लाइन बस्नु पर्दैन — तपाईंको नम्बर यहाँ देखिन्छ।',
  yourNumber: 'तपाईंको नम्बर',
  showCode: 'झ्यालमा यो कोड देखाउनुहोस्',
  codeLabel: (n) => `नम्बर ${n} को कोड`,
  steps: { placed: 'अर्डर भयो', steaming: 'पाक्दै', ready: 'तयार', picked: 'लगियो' },
  ahead: (n) => `तपाईंभन्दा अगाडि ${n} अर्डर`,
  aheadOne: 'तपाईंभन्दा अगाडि १ अर्डर',
  aheadNone: 'अब तपाईंकै पालो!',
  pickupAt: (t, p) => `${t} मा लिन आउनुहोस् · ${p}`,
  handBtn: 'टोलीलाई कोड देखाउनुहोस्',
  handHint: 'साँच्चै भने टोलीले झ्यालमा स्क्यान गर्छ।',
  thanks: 'मीठो मानेर खानुहोस्! कार्डमा एउटा छाप लाग्यो।',
  readyH: 'तपाईंको मःम तयार छ!',
  readySub: (n) => `झ्यालमा नम्बर ${n} देखाउनुहोस्`,
  readyOk: 'आउँदैछु',
  orderAgain: 'फेरि अर्डर',
  earlier: 'आज अघि',

  stampsH: 'छाप कार्ड',
  stampsSub: 'हरेक पटक लिन आउँदा एउटा छाप। आठ छाप पुगेपछि "मःम मास्टर" ब्याज — रमाइलोका लागि मात्र।',
  stampsN: (a, b) => `${b} मध्ये ${a} छाप`,
  badgesH: 'तपाईंका ब्याज',
  badgeName: 'मःम मास्टर',
  noBadge: (n) => `अहिलेसम्म ब्याज छैन — अझै ${n} पटक।`,
  badgeToast: 'आठ छाप — तपाईं मःम मास्टर हुनुभयो!',
  stampToast: (a, b) => `कार्डमा ${b} मध्ये ${a} औं छाप।`,

  crewH: 'टोलीको दृश्य',
  crewSub: 'ट्रकभित्रको ट्याब्लेट: लाइन, स्टिमर र दिनभरिका स्विच',
  pauseLabel: 'अनलाइन अर्डर रोक्नुहोस्',
  pauseOn: 'रोकिएको — झ्यालमा मात्र',
  pauseOff: 'अर्डर लिँदैछ',
  pausedToast: 'अनलाइन अर्डर रोकियो।',
  resumedToast: 'अनलाइन अर्डर फेरि खुल्यो।',
  autoLabel: 'सहयोगी टोली',
  autoSub: 'नक्कली टोलीले आफैं पकाउँछ र दिन्छ',
  steamersH: 'स्टिमर',
  steamer: (n) => `स्टिमर ${n}`,
  platesOf: (a, b) => `${a}/${b} प्लेट`,
  queueH: 'लाइन',
  queueFor: (p) => `${p} मा लिन आउने`,
  queueEmpty: 'अहिलेसम्म अर्डर छैन — बाफ तयार छ।',
  slotLoad: (a, b) => `${a}/${b} प्लेट`,
  go: { placed: 'पकाउन थाल्नुहोस्', steaming: 'तयार भयो', ready: 'हातमा दिनुहोस्' },
  you: 'तपाईं',
  steamersFull: 'तीनवटै स्टिमर भरिए — एक लट सकिन पर्खनुहोस्।',
  notHere: 'त्यो अर्डर अर्को स्टपको हो।',
  scanBtn: 'कोड स्क्यान गर्नुहोस्',
  scanH: 'लिन आएको कोड स्क्यान',
  scanSub: 'नक्कली स्क्यानर: ग्राहकले देखाएको कोड थिच्नुहोस्, वा नम्बर लेख्नुहोस्।',
  scanNone: 'अहिलेसम्म केही तयार छैन।',
  scanning: 'स्क्यान हुँदैछ…',
  scanType: 'नम्बर',
  scanTypePh: 'जस्तै ४२',
  scanGo: 'जाँच्नुहोस्',
  scanned: {
    handed: (n) => `नम्बर ${n} दिइयो। मीठो मानेर खानुहोस्!`,
    'not-ready': (n) => `नम्बर ${n} अझै तयार छैन।`,
    already: (n) => `नम्बर ${n} पहिल्यै लगिसकियो।`,
    unknown: () => 'यो कोड आज यहाँको लाइनमा छैन।',
  },
  soldOutH: 'आज सकिएका',
  soldOutToast: (f) => `${f} सकियो भनियो।`,
  backToast: (f) => `${f} फेरि मेनुमा।`,
  capH: 'हरेक १० मिनेटमा कति प्लेट',
  capSub: 'कम प्लेट = झ्यालमा छोटो पर्खाइ',
  capVal: (n) => `${n} प्लेट`,
  routeH: 'बाटो',
  moveBtn: (p) => `अर्को स्टपतिर: ${p}`,
  moveEnd: 'आजलाई बन्द',
  moveDay: (d) => `${d} को बाटो सुरु`,
  movingTo: (p) => `${p} तर्फ जाँदै…`,
  mineWaiting: 'तपाईंकै परीक्षण अर्डर लाइनमा छ — पहिले त्यो दिनुहोस्।',
  movedToast: (p) => `${p} तर्फ बाटोमा।`,
  closedToast: 'आजलाई बन्द। स्टिमर निभ्यो।',
  newDayToast: (d) => `शुभ बिहानी — ${d} को बाटो सुरु।`,
  servingBtn: '"अहिले पालो" स्क्रिन',
  servingH: 'अहिले पालो',
  servingReady: 'तयार',
  servingSteaming: 'पाक्दै',
  servingNone: 'बाफ तयार छ — नम्बर छिट्टै',
  servingExit: 'बाहिर (Esc)',
  servingSub: 'ट्रकको झ्यालमा राख्ने ट्याब्लेटका लागि',
  countsH: 'आजको गन्ती',
  countsOrders: 'अर्डर',
  countsPlates: 'प्लेट',
  countsStops: 'स्टप',
  perSlotH: 'हरेक समयमा अर्डर · यो स्टप',
  perSlotNone: 'यो स्टपका लागि अहिलेसम्म अर्डर छैन।',
  byFillingH: 'मसला अनुसार प्लेट',
  countsNote: 'गन्ती मात्र।',
  sound: 'आवाज',
};

export const COPY: Record<Lang, Copy> = { en, de, ne };

export type Frame = {
  badge: string;
  text: string;
  all: string;
  kicker: string;
  endH: string;
  endP: string;
  points: [string, string, string];
  talk: string;
  more: string;
  free: string;
};

export const FRAME: Record<Lang, Frame> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · a made-up momo truck, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want an app for your food truck or stall?',
    endP: 'For a momo truck, a market stall or a festival food tent: today’s stops on a map, ordering ahead with pickup times, a pickup number for every customer and a queue board for the crew — in your languages.',
    points: ['Live route map', 'Pickup slots and a queue board', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · ein erfundener Momo-Truck, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Eine App für deinen Foodtruck oder Stand?',
    endP: 'Für einen Momo-Truck, einen Marktstand oder ein Essenszelt auf dem Festival: die heutigen Stopps auf einer Karte, Vorbestellen mit Abholzeiten, eine Abholnummer für alle und eine Schlangen-Anzeige für die Crew — in deinen Sprachen.',
    points: ['Live-Routenkarte', 'Abholfenster und Schlangen-Anzeige', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · काल्पनिक मःम ट्रक, केही पनि पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नो फुड ट्रक वा स्टलका लागि एप चाहिन्छ?',
    endP: 'मःम ट्रक, बजारको स्टल वा महोत्सवको खाना पसलका लागि: आजका स्टप नक्सामा, लिन आउने समयसहित पहिल्यै अर्डर, हरेक ग्राहकलाई नम्बर र टोलीका लागि लाइनको बोर्ड — तपाईंकै भाषामा।',
    points: ['लाइभ बाटोको नक्सा', 'लिन आउने समय र लाइन बोर्ड', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
