// Words for the /work/restaurant demo in English, Deutsch and नेपाली.
// "Himalayan Chulo" in Köln is a made-up restaurant; its menu, tables and
// guests are invented. Dish names stay Nepali in every language (Roman and
// Devanagari) with a translation underneath.
//
// There is no money anywhere in here — no prices, totals, tips or payments.
// The only exception is the one honest note that says prices are hidden
// (`pricesHidden`); tests/restaurantDemo.test.ts checks every other string.

import type { Cat, Station, Status, Style, TableStatus } from './order';

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

export type View = 'guest' | 'kitchen' | 'waiter' | 'all';

type DishText = { tr: string; desc: string };

export type Copy = {
  name: string;
  city: string;
  tagline: string;
  madeUp: string;
  viewsLabel: string;
  views: Record<View, string>;
  viewsShort: Record<View, string>;
  langLabel: string;
  reset: string;
  resetDone: string;
  clock: (t: string) => string;
  fast: string;
  close: string;

  // guest phone
  table: (n: string) => string;
  scanned: (n: string) => string;
  welcome: string;
  pricesHidden: string;
  tabs: { menu: string; orders: string };
  search: string;
  searchPh: string;
  noResults: string;
  clearSearch: string;
  allDishes: string;
  cats: Record<Cat, string>;
  popular: string;
  veg: string;
  vegan: string;
  gf: string;
  spicy: string;
  spiceLevels: [string, string, string];
  allergensH: string;
  allergens: Record<string, string>;
  soldOut: string;
  soldOutNote: string;
  add: string;
  addN: (n: string) => string;
  styleH: string;
  styles: Record<Style, string>;
  spiceH: string;
  acharH: string;
  acharSub: string;
  qty: string;
  less: string;
  more: string;
  added: (dish: string) => string;
  dishes: Record<string, DishText>;
  cartBar: (n: string) => string;
  cartOpen: string;
  cartH: string;
  cartEmpty: string;
  cartHint: string;
  send: string;
  sent: (n: string) => string;
  reasons: { 'sold-out': string; full: string; busy: string; empty: string; unknown: string };
  removeSoldOut: string;
  ordersEmpty: string;
  orderNo: (n: string) => string;
  statuses: Record<Status, string>;
  statusHelp: Record<Status, string>;
  eta: (n: string) => string;
  callWaiter: string;
  called: string;
  onTheWay: string;
  askBill: string;
  billAsked: string;
  summaryH: string;
  summarySub: string;
  summaryNone: string;
  summaryServed: (a: string, b: string) => string;
  summaryNote: string;
  summaryItems: (n: string) => string;
  newVisit: string;
  statusToast: (dish: string, status: string) => string;

  // kitchen
  kitchenH: string;
  stationsLabel: string;
  stations: Record<Station | 'all', string>;
  cols: { received: string; cooking: string; ready: string };
  go: { received: string; cooking: string; ready: string };
  tapHint: string;
  colEmpty: string;
  mins: (n: string) => string;
  tableShort: (n: string) => string;
  other: (n: string) => string;
  soundOn: string;
  soundOff: string;
  live: string;

  // waiter / owner
  floorH: string;
  floorSub: string;
  status: Record<TableStatus, string>;
  calling: string;
  wantsBill: string;
  you: string;
  seats: (n: string) => string;
  guests: (n: string) => string;
  window: string;
  bar: string;
  pass: string;
  door: string;
  tableH: (n: string) => string;
  ack: string;
  clearTable: string;
  noOrders: string;
  readyH: string;
  readyNone: string;
  serve: string;
  alertsH: string;
  alertsNone: string;
  todayH: string;
  kOrders: string;
  kDishes: string;
  kPrep: string;
  kPrepVal: (n: string) => string;
  topH: string;
  countsNote: string;
  menuH: string;
  menuSub: string;
  available: string;
  printBtn: string;
  printH: string;
  printSub: string;
  printNow: string;
  scanToOrder: string;
  tableQr: (n: string) => string;
  callToast: (n: string) => string;
  billToast: (n: string) => string;
  soldOutToast: (dish: string) => string;
  backToast: (dish: string) => string;
};

const en: Copy = {
  name: 'Himalayan Chulo',
  city: 'Köln',
  tagline: 'Nepali kitchen · QR table ordering',
  madeUp: 'A made-up restaurant — nothing is sent anywhere',
  viewsLabel: 'Choose a view',
  views: { guest: 'Guest phone', kitchen: 'Kitchen board', waiter: 'Waiter & owner', all: 'All three' },
  viewsShort: { guest: 'Guest', kitchen: 'Kitchen', waiter: 'Waiter', all: 'All three' },
  langLabel: 'Language',
  reset: 'Reset demo',
  resetDone: 'The evening starts again at 18:47.',
  clock: (t) => `Service clock ${t}`,
  fast: 'The evening runs 8× faster',
  close: 'Close',

  table: (n) => `Table ${n}`,
  scanned: (n) => `You scanned the QR code on table ${n}`,
  welcome: 'Order from your phone — we bring it to your table.',
  pricesHidden: 'Prices hidden in this demo',
  tabs: { menu: 'Menu', orders: 'My orders' },
  search: 'Search the menu',
  searchPh: 'Search: momo, vegan, chiya…',
  noResults: 'Nothing found. Try “momo” or “vegan”.',
  clearSearch: 'Clear search',
  allDishes: 'All',
  cats: { momo: 'Momo', thali: 'Thali', chowmein: 'Chowmein', newari: 'Newari khaja', drinks: 'Drinks', desserts: 'Desserts' },
  popular: 'Guest favourite',
  veg: 'Veg',
  vegan: 'Vegan',
  gf: 'Gluten-free',
  spicy: 'Spicy',
  spiceLevels: ['Mild', 'Medium', 'Hot'],
  allergensH: 'Allergens',
  allergens: { A: 'Gluten', C: 'Egg', F: 'Soy', G: 'Milk', H: 'Nuts', I: 'Celery', K: 'Sesame' },
  soldOut: 'Sold out',
  soldOutNote: 'The kitchen has run out of this for tonight.',
  add: 'Add',
  addN: (n) => `Add ${n} to my order`,
  styleH: 'How would you like them?',
  styles: { steamed: 'Steamed', fried: 'Fried', jhol: 'Jhol (in soup)', chilli: 'Chilli (C-momo)' },
  spiceH: 'Spice level',
  acharH: 'Extra achar',
  acharSub: 'A second bowl of tomato–sesame pickle',
  qty: 'How many',
  less: 'One less',
  more: 'One more',
  added: (d) => `${d} added to your order`,
  dishes: {
    'veg-momo': { tr: 'Vegetable dumplings', desc: 'Cabbage, carrot and paneer, folded by hand. With tomato–sesame achar.' },
    'chicken-momo': { tr: 'Chicken dumplings', desc: 'Minced chicken with ginger, garlic and fresh coriander.' },
    'buff-momo': { tr: 'Buffalo dumplings', desc: 'The Kathmandu classic: buffalo mince, onion and timur pepper.' },
    'tofu-momo': { tr: 'Tofu dumplings', desc: 'Smoked tofu, spinach and spring onion — vegan through and through.' },
    'dal-bhat': { tr: 'Lentils, rice and vegetables', desc: 'Black lentil dal, basmati rice, seasonal tarkari, saag and achar. Refills welcome.' },
    'khasi-thali': { tr: 'Goat curry thali', desc: 'Slow-cooked goat on the bone with rice, dal, saag and raita.' },
    'kukhura-thali': { tr: 'Chicken curry thali', desc: 'Home-style chicken curry with rice, dal, saag and achar.' },
    'veg-chowmein': { tr: 'Vegetable noodles', desc: 'Wok-tossed noodles with cabbage, carrot and spring onion.' },
    'chicken-chowmein': { tr: 'Chicken noodles', desc: 'Street-style chowmein with chicken and egg.' },
    thukpa: { tr: 'Himalayan noodle soup', desc: 'A warming broth with hand-pulled noodles and chicken.' },
    'samay-baji': { tr: 'Newari festival platter', desc: 'Beaten rice, choila, boiled egg, spiced soybeans, ginger and achar.' },
    choila: { tr: 'Spiced grilled buffalo', desc: 'Flame-grilled buffalo with timur, garlic and fenugreek.' },
    bara: { tr: 'Lentil patty', desc: 'A crisp black-lentil patty from the Kathmandu valley.' },
    chatamari: { tr: 'Rice-flour crêpe', desc: 'A thin rice crêpe topped with egg and vegetables — the Newari pizza.' },
    'masala-chiya': { tr: 'Spiced milk tea', desc: 'Black tea boiled with milk, cardamom, clove and ginger.' },
    'aduwa-chiya': { tr: 'Ginger tea', desc: 'Fresh ginger and lemon, sweetened with jaggery.' },
    'mango-lassi': { tr: 'Mango lassi', desc: 'Yoghurt shaken with ripe mango and a pinch of cardamom.' },
    'nimbu-pani': { tr: 'Fresh lime soda', desc: 'Lime, soda, black salt and mint — sweet or salty.' },
    'juju-dhau': { tr: 'King curd from Bhaktapur', desc: 'Thick, sweet set yoghurt in a clay pot.' },
    'sel-roti': { tr: 'Festival rice rings', desc: 'Crisp, sweet rice-flour rings, just like at Tihar.' },
    kheer: { tr: 'Rice pudding', desc: 'Rice slow-cooked in milk with cardamom, cashews and raisins.' },
  },
  cartBar: (n) => `My order · ${n}`,
  cartOpen: 'View order',
  cartH: 'My order',
  cartEmpty: 'Nothing here yet — tap a dish to add it.',
  cartHint: 'The kitchen starts as soon as you send it.',
  send: 'Send to kitchen',
  sent: (n) => `Order ${n} is with the kitchen`,
  reasons: {
    'sold-out': 'Something in your order just sold out — remove it to send the rest.',
    full: 'Your order is as long as it can get in this demo.',
    busy: 'You already have four orders on the way — wait for one to arrive.',
    empty: 'Add a dish first.',
    unknown: 'That dish is not on the menu.',
  },
  removeSoldOut: 'Remove sold-out dishes',
  ordersEmpty: 'No orders yet. Pick something from the menu and send it to the kitchen.',
  orderNo: (n) => `Order #${n}`,
  statuses: { received: 'Received', cooking: 'Cooking', ready: 'Ready', served: 'Served' },
  statusHelp: {
    received: 'The kitchen has your order.',
    cooking: 'On the stove right now.',
    ready: 'Ready at the pass — coming to your table.',
    served: 'On your table. Mitho sanga khanus!',
  },
  eta: (n) => `about ${n} min`,
  callWaiter: 'Call waiter',
  called: 'Waiter called — someone is coming.',
  onTheWay: 'A waiter is on the way',
  askBill: 'Ask for the bill',
  billAsked: 'The waiter knows you are ready to leave.',
  summaryH: 'Your order summary',
  summarySub: 'Everything you ordered at this table tonight.',
  summaryNone: 'You have not ordered anything yet.',
  summaryServed: (a, b) => `${a} of ${b} on the table`,
  summaryNote: 'In this demo the summary lists what you ordered and how many — nothing more.',
  summaryItems: (n) => `Dishes and drinks: ${n}`,
  newVisit: 'Table cleared — thanks for coming! A new visit starts.',
  statusToast: (d, s) => `${d}: ${s}`,

  kitchenH: 'Kitchen board',
  stationsLabel: 'Station',
  stations: { all: 'All stations', momo: 'Momo station', curry: 'Curry & wok', bar: 'Bar & sweets' },
  cols: { received: 'New', cooking: 'Cooking', ready: 'Ready' },
  go: { received: 'Cook →', cooking: 'Ready →', ready: 'Served ✓' },
  tapHint: 'Tap a ticket to move it along.',
  colEmpty: 'Nothing here',
  mins: (n) => `${n} min`,
  tableShort: (n) => `T${n}`,
  other: (n) => `+${n} for other stations`,
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  live: 'Live',

  floorH: 'Floor plan',
  floorSub: 'Tap a table for its orders.',
  status: { free: 'Free', ordering: 'Ordering', waiting: 'Waiting for food', eating: 'Eating', bill: 'Wants the bill' },
  calling: 'Calling a waiter',
  wantsBill: 'Wants the bill',
  you: 'You',
  seats: (n) => `${n} seats`,
  guests: (n) => `${n} guests`,
  window: 'Window',
  bar: 'Bar',
  pass: 'Kitchen pass',
  door: 'Door',
  tableH: (n) => `Table ${n}`,
  ack: 'On my way',
  clearTable: 'Clear table',
  noOrders: 'No orders at this table.',
  readyH: 'Ready at the pass',
  readyNone: 'Nothing waiting — the kitchen is keeping up.',
  serve: 'Serve',
  alertsH: 'Alerts',
  alertsNone: 'No table needs you right now.',
  todayH: 'Today so far',
  kOrders: 'Orders',
  kDishes: 'Dishes & drinks',
  kPrep: 'Avg. kitchen time',
  kPrepVal: (n) => `${n} min`,
  topH: 'Top dishes tonight',
  countsNote: 'Counts of plates sent out.',
  menuH: 'Menu availability',
  menuSub: 'Mark a dish sold out — guests see it greyed out at once.',
  available: 'Available',
  printBtn: 'Print table QR codes',
  printH: 'QR codes for every table',
  printSub: 'Print, cut and stand one on each table. Guests scan, order and the kitchen sees it.',
  printNow: 'Print',
  scanToOrder: 'Scan to see the menu and order',
  tableQr: (n) => `QR code for table ${n}`,
  callToast: (n) => `Table ${n} is calling a waiter`,
  billToast: (n) => `Table ${n} wants the bill`,
  soldOutToast: (d) => `${d} is sold out — greyed out for guests`,
  backToast: (d) => `${d} is back on the menu`,
};

const de: Copy = {
  name: 'Himalayan Chulo',
  city: 'Köln',
  tagline: 'Nepalesische Küche · Bestellen per QR am Tisch',
  madeUp: 'Ein erfundenes Restaurant — nichts wird gesendet',
  viewsLabel: 'Ansicht wählen',
  views: { guest: 'Handy des Gasts', kitchen: 'Küchen-Board', waiter: 'Service & Chef', all: 'Alle drei' },
  viewsShort: { guest: 'Gast', kitchen: 'Küche', waiter: 'Service', all: 'Alle drei' },
  langLabel: 'Sprache',
  reset: 'Demo zurücksetzen',
  resetDone: 'Der Abend beginnt wieder um 18:47.',
  clock: (t) => `Service-Uhr ${t}`,
  fast: 'Der Abend läuft 8× schneller',
  close: 'Schließen',

  table: (n) => `Tisch ${n}`,
  scanned: (n) => `Du hast den QR-Code an Tisch ${n} gescannt`,
  welcome: 'Bestell mit dem Handy — wir bringen es an deinen Tisch.',
  pricesHidden: 'Preise sind in dieser Demo ausgeblendet',
  tabs: { menu: 'Speisekarte', orders: 'Meine Bestellungen' },
  search: 'Speisekarte durchsuchen',
  searchPh: 'Suche: Momo, vegan, Chiya…',
  noResults: 'Nichts gefunden. Probier „Momo“ oder „vegan“.',
  clearSearch: 'Suche leeren',
  allDishes: 'Alle',
  cats: { momo: 'Momo', thali: 'Thali', chowmein: 'Chowmein', newari: 'Newari-Khaja', drinks: 'Getränke', desserts: 'Desserts' },
  popular: 'Lieblingsgericht der Gäste',
  veg: 'Vegetarisch',
  vegan: 'Vegan',
  gf: 'Glutenfrei',
  spicy: 'Scharf',
  spiceLevels: ['Mild', 'Mittel', 'Scharf'],
  allergensH: 'Allergene',
  allergens: { A: 'Gluten', C: 'Ei', F: 'Soja', G: 'Milch', H: 'Schalenfrüchte', I: 'Sellerie', K: 'Sesam' },
  soldOut: 'Ausverkauft',
  soldOutNote: 'Davon ist heute Abend nichts mehr da.',
  add: 'Dazu',
  addN: (n) => `${n} zur Bestellung`,
  styleH: 'Wie hättest du sie gern?',
  styles: { steamed: 'Gedämpft', fried: 'Frittiert', jhol: 'Jhol (in Suppe)', chilli: 'Chili (C-Momo)' },
  spiceH: 'Schärfe',
  acharH: 'Extra Achar',
  acharSub: 'Eine zweite Schale Tomaten-Sesam-Pickle',
  qty: 'Wie viele',
  less: 'Eins weniger',
  more: 'Eins mehr',
  added: (d) => `${d} ist in deiner Bestellung`,
  dishes: {
    'veg-momo': { tr: 'Gemüse-Teigtaschen', desc: 'Weißkohl, Karotte und Paneer, von Hand gefaltet. Mit Tomaten-Sesam-Achar.' },
    'chicken-momo': { tr: 'Hähnchen-Teigtaschen', desc: 'Hähnchenhack mit Ingwer, Knoblauch und frischem Koriander.' },
    'buff-momo': { tr: 'Büffel-Teigtaschen', desc: 'Der Klassiker aus Kathmandu: Büffelhack, Zwiebel und Timur-Pfeffer.' },
    'tofu-momo': { tr: 'Tofu-Teigtaschen', desc: 'Räuchertofu, Spinat und Frühlingszwiebel — durch und durch vegan.' },
    'dal-bhat': { tr: 'Linsen, Reis und Gemüse', desc: 'Schwarze Linsen, Basmatireis, Gemüse der Saison, Saag und Achar. Nachschlag gern.' },
    'khasi-thali': { tr: 'Ziegencurry-Thali', desc: 'Langsam geschmortes Ziegenfleisch mit Reis, Dal, Saag und Raita.' },
    'kukhura-thali': { tr: 'Hähnchencurry-Thali', desc: 'Hähnchencurry wie zu Hause, mit Reis, Dal, Saag und Achar.' },
    'veg-chowmein': { tr: 'Gebratene Gemüsenudeln', desc: 'Im Wok geschwenkte Nudeln mit Kohl, Karotte und Frühlingszwiebel.' },
    'chicken-chowmein': { tr: 'Gebratene Hähnchennudeln', desc: 'Chowmein wie vom Straßenstand, mit Hähnchen und Ei.' },
    thukpa: { tr: 'Himalaya-Nudelsuppe', desc: 'Wärmende Brühe mit handgezogenen Nudeln und Hähnchen.' },
    'samay-baji': { tr: 'Newari-Festplatte', desc: 'Reisflocken, Choila, gekochtes Ei, gewürzte Sojabohnen, Ingwer und Achar.' },
    choila: { tr: 'Gewürztes Büffelfleisch vom Grill', desc: 'Über der Flamme gegrillt, mit Timur, Knoblauch und Bockshornklee.' },
    bara: { tr: 'Linsen-Puffer', desc: 'Knuspriger Puffer aus schwarzen Linsen, aus dem Kathmandu-Tal.' },
    chatamari: { tr: 'Reismehl-Crêpe', desc: 'Dünner Reis-Crêpe mit Ei und Gemüse — die Newari-Pizza.' },
    'masala-chiya': { tr: 'Gewürz-Milchtee', desc: 'Schwarztee, mit Milch, Kardamom, Nelke und Ingwer aufgekocht.' },
    'aduwa-chiya': { tr: 'Ingwertee', desc: 'Frischer Ingwer und Zitrone, mit Rohrzucker gesüßt.' },
    'mango-lassi': { tr: 'Mango-Lassi', desc: 'Joghurt mit reifer Mango und einer Prise Kardamom.' },
    'nimbu-pani': { tr: 'Frisches Limetten-Soda', desc: 'Limette, Soda, Schwarzsalz und Minze — süß oder salzig.' },
    'juju-dhau': { tr: 'Königsjoghurt aus Bhaktapur', desc: 'Dicker, süßer Joghurt im Tontopf.' },
    'sel-roti': { tr: 'Festtags-Reiskringel', desc: 'Knusprige, süße Kringel aus Reismehl, wie zu Tihar.' },
    kheer: { tr: 'Milchreis', desc: 'In Milch gegarter Reis mit Kardamom, Cashews und Rosinen.' },
  },
  cartBar: (n) => `Meine Bestellung · ${n}`,
  cartOpen: 'Ansehen',
  cartH: 'Meine Bestellung',
  cartEmpty: 'Noch leer — tipp auf ein Gericht, um es hinzuzufügen.',
  cartHint: 'Die Küche legt los, sobald du sendest.',
  send: 'An die Küche senden',
  sent: (n) => `Bestellung ${n} ist in der Küche`,
  reasons: {
    'sold-out': 'Etwas in deiner Bestellung ist gerade ausverkauft — entferne es, dann geht der Rest raus.',
    full: 'Länger kann die Bestellung in dieser Demo nicht werden.',
    busy: 'Vier Bestellungen sind schon unterwegs — warte, bis eine ankommt.',
    empty: 'Wähle zuerst ein Gericht.',
    unknown: 'Das Gericht steht nicht auf der Karte.',
  },
  removeSoldOut: 'Ausverkauftes entfernen',
  ordersEmpty: 'Noch keine Bestellung. Such dir etwas aus und schick es an die Küche.',
  orderNo: (n) => `Bestellung #${n}`,
  statuses: { received: 'Eingegangen', cooking: 'Wird gekocht', ready: 'Fertig', served: 'Serviert' },
  statusHelp: {
    received: 'Die Küche hat deine Bestellung.',
    cooking: 'Steht gerade auf dem Herd.',
    ready: 'Fertig an der Ausgabe — kommt gleich an deinen Tisch.',
    served: 'Steht auf deinem Tisch. Guten Appetit — mitho sanga khanus!',
  },
  eta: (n) => `ca. ${n} Min.`,
  callWaiter: 'Service rufen',
  called: 'Service gerufen — gleich kommt jemand.',
  onTheWay: 'Jemand vom Service ist unterwegs',
  askBill: 'Rechnung bitte',
  billAsked: 'Der Service weiß, dass ihr gehen möchtet.',
  summaryH: 'Deine Bestellübersicht',
  summarySub: 'Alles, was an diesem Tisch heute Abend bestellt wurde.',
  summaryNone: 'Du hast noch nichts bestellt.',
  summaryServed: (a, b) => `${a} von ${b} am Tisch`,
  summaryNote: 'In dieser Demo zeigt die Übersicht nur, was und wie viel bestellt wurde.',
  summaryItems: (n) => `Gerichte und Getränke: ${n}`,
  newVisit: 'Tisch abgeräumt — danke für den Besuch! Ein neuer Besuch beginnt.',
  statusToast: (d, s) => `${d}: ${s}`,

  kitchenH: 'Küchen-Board',
  stationsLabel: 'Posten',
  stations: { all: 'Alle Posten', momo: 'Momo-Posten', curry: 'Curry & Wok', bar: 'Bar & Süßes' },
  cols: { received: 'Neu', cooking: 'Am Kochen', ready: 'Fertig' },
  go: { received: 'Kochen →', cooking: 'Fertig →', ready: 'Serviert ✓' },
  tapHint: 'Tipp auf einen Bon, um ihn weiterzuschieben.',
  colEmpty: 'Nichts da',
  mins: (n) => `${n} Min.`,
  tableShort: (n) => `T${n}`,
  other: (n) => `+${n} für andere Posten`,
  soundOn: 'Ton an',
  soundOff: 'Ton aus',
  live: 'Live',

  floorH: 'Tischplan',
  floorSub: 'Tipp auf einen Tisch für seine Bestellungen.',
  status: { free: 'Frei', ordering: 'Bestellt gerade', waiting: 'Wartet aufs Essen', eating: 'Isst', bill: 'Möchte die Rechnung' },
  calling: 'Ruft den Service',
  wantsBill: 'Möchte die Rechnung',
  you: 'Du',
  seats: (n) => `${n} Plätze`,
  guests: (n) => `${n} Gäste`,
  window: 'Fenster',
  bar: 'Bar',
  pass: 'Küchenausgabe',
  door: 'Eingang',
  tableH: (n) => `Tisch ${n}`,
  ack: 'Komme sofort',
  clearTable: 'Tisch abräumen',
  noOrders: 'An diesem Tisch gibt es keine Bestellung.',
  readyH: 'Fertig an der Ausgabe',
  readyNone: 'Nichts wartet — die Küche kommt hinterher.',
  serve: 'Servieren',
  alertsH: 'Hinweise',
  alertsNone: 'Gerade braucht dich kein Tisch.',
  todayH: 'Heute bisher',
  kOrders: 'Bestellungen',
  kDishes: 'Gerichte & Getränke',
  kPrep: 'Ø Küchenzeit',
  kPrepVal: (n) => `${n} Min.`,
  topH: 'Die beliebtesten Gerichte heute',
  countsNote: 'Anzahl der ausgegebenen Teller.',
  menuH: 'Was heute da ist',
  menuSub: 'Markiere ein Gericht als ausverkauft — die Gäste sehen es sofort ausgegraut.',
  available: 'Verfügbar',
  printBtn: 'QR-Codes für die Tische drucken',
  printH: 'QR-Codes für jeden Tisch',
  printSub: 'Drucken, ausschneiden, auf jeden Tisch stellen. Gäste scannen, bestellen — die Küche sieht es.',
  printNow: 'Drucken',
  scanToOrder: 'Scannen, Speisekarte sehen und bestellen',
  tableQr: (n) => `QR-Code für Tisch ${n}`,
  callToast: (n) => `Tisch ${n} ruft den Service`,
  billToast: (n) => `Tisch ${n} möchte die Rechnung`,
  soldOutToast: (d) => `${d} ist ausverkauft — für Gäste ausgegraut`,
  backToast: (d) => `${d} ist wieder auf der Karte`,
};

const ne: Copy = {
  name: 'हिमालयन चुलो',
  city: 'क्योल्न',
  tagline: 'नेपाली भान्सा · टेबलमै QR बाट अर्डर',
  madeUp: 'काल्पनिक रेस्टुरेन्ट — कतै केही पठाइँदैन',
  viewsLabel: 'हेर्ने तरिका छान्नुहोस्',
  views: { guest: 'पाहुनाको फोन', kitchen: 'भान्साको बोर्ड', waiter: 'वेटर र मालिक', all: 'तीनै वटा' },
  viewsShort: { guest: 'पाहुना', kitchen: 'भान्सा', waiter: 'वेटर', all: 'तीनै वटा' },
  langLabel: 'भाषा',
  reset: 'डेमो सुरुबाट',
  resetDone: 'साँझ फेरि १८:४७ बाट सुरु भयो।',
  clock: (t) => `सेवाको घडी ${t}`,
  fast: 'यो साँझ ८ गुणा छिटो चल्छ',
  close: 'बन्द',

  table: (n) => `टेबल ${n}`,
  scanned: (n) => `तपाईंले टेबल ${n} को QR कोड स्क्यान गर्नुभयो`,
  welcome: 'फोनबाटै अर्डर गर्नुहोस् — हामी टेबलमै ल्याइदिन्छौं।',
  pricesHidden: 'यो डेमोमा मूल्य लुकाइएको छ',
  tabs: { menu: 'मेनु', orders: 'मेरो अर्डर' },
  search: 'मेनुमा खोज्नुहोस्',
  searchPh: 'खोज: मःम, भिगन, चिया…',
  noResults: 'केही भेटिएन। “मःम” वा “भिगन” खोज्नुहोस्।',
  clearSearch: 'खोज हटाउनुहोस्',
  allDishes: 'सबै',
  cats: { momo: 'मःम', thali: 'थाली', chowmein: 'चाउमिन', newari: 'नेवारी खाजा', drinks: 'पेय', desserts: 'मिठाई' },
  popular: 'पाहुनाको मनपर्ने',
  veg: 'शाकाहारी',
  vegan: 'भिगन',
  gf: 'ग्लुटेन-रहित',
  spicy: 'पिरो',
  spiceLevels: ['कम पिरो', 'मध्यम', 'धेरै पिरो'],
  allergensH: 'एलर्जी गराउने कुरा',
  allergens: { A: 'ग्लुटेन', C: 'अण्डा', F: 'भटमास', G: 'दूध', H: 'नट', I: 'सेलेरी', K: 'तिल' },
  soldOut: 'सकियो',
  soldOutNote: 'आज साँझका लागि भान्सामा यो सकिएको छ।',
  add: 'थप्नुहोस्',
  addN: (n) => `${n} वटा अर्डरमा थप्नुहोस्`,
  styleH: 'कस्तो खानुहुन्छ?',
  styles: { steamed: 'स्टिम', fried: 'फ्राइ', jhol: 'झोल', chilli: 'चिली (सी-मःम)' },
  spiceH: 'पिरो कति',
  acharH: 'थप अचार',
  acharSub: 'गोलभेडा–तिलको अचार अर्को कचौरा',
  qty: 'कति वटा',
  less: 'एउटा घटाउनुहोस्',
  more: 'एउटा थप्नुहोस्',
  added: (d) => `${d} अर्डरमा थपियो`,
  dishes: {
    'veg-momo': { tr: 'तरकारी मःम', desc: 'बन्दा, गाजर र पनिर, हातैले बेरिएको। गोलभेडा–तिलको अचारसँग।' },
    'chicken-momo': { tr: 'कुखुराको मःम', desc: 'अदुवा, लसुन र ताजा धनियाँ हालेको कुखुराको मासु।' },
    'buff-momo': { tr: 'बफ मःम', desc: 'काठमाडौंको पुरानो स्वाद: रांगाको मासु, प्याज र टिमुर।' },
    'tofu-momo': { tr: 'टोफु मःम', desc: 'धुवाँ लागेको टोफु, पालुङ्गो र हरियो प्याज — पूरै भिगन।' },
    'dal-bhat': { tr: 'दाल भात तरकारी', desc: 'कालो दाल, बासमती भात, मौसमी तरकारी, साग र अचार। फेरि थप्न पाइन्छ।' },
    'khasi-thali': { tr: 'खसीको मासु थाली', desc: 'बिस्तारै पकाएको खसीको मासु, भात, दाल, साग र रायतासँग।' },
    'kukhura-thali': { tr: 'कुखुराको थाली', desc: 'घरमै जस्तो कुखुराको मासु, भात, दाल, साग र अचारसँग।' },
    'veg-chowmein': { tr: 'तरकारी चाउमिन', desc: 'बन्दा, गाजर र हरियो प्याजसँग वोकमा भुटेको चाउमिन।' },
    'chicken-chowmein': { tr: 'कुखुराको चाउमिन', desc: 'कुखुराको मासु र अण्डासहितको सडक-शैलीको चाउमिन।' },
    thukpa: { tr: 'थुक्पा', desc: 'हातले तानेको चाउचाउ र कुखुरासहितको न्यानो हिमाली झोल।' },
    'samay-baji': { tr: 'समय बजि', desc: 'चिउरा, छोयला, उसिनेको अण्डा, भटमास, अदुवा र अचार।' },
    choila: { tr: 'छोयला', desc: 'आगोमा पोलेको रांगाको मासु, टिमुर, लसुन र मेथीसँग।' },
    bara: { tr: 'बारा', desc: 'उपत्यकाको कुरकुरे मासको बारा।' },
    chatamari: { tr: 'चतामरी', desc: 'अण्डा र तरकारी राखेको पातलो चामलको रोटी — नेवारी पिज्जा।' },
    'masala-chiya': { tr: 'मसला चिया', desc: 'दूध, अलैंची, ल्वाङ र अदुवा हालेर उमालेको चिया।' },
    'aduwa-chiya': { tr: 'अदुवा चिया', desc: 'ताजा अदुवा र कागती, सख्खरले गुलियो।' },
    'mango-lassi': { tr: 'आँपको लस्सी', desc: 'पाकेको आँप र अलिकति अलैंची हालेको दही।' },
    'nimbu-pani': { tr: 'निबुपानी', desc: 'कागती, सोडा, कालो नुन र पुदिना — गुलियो वा नुनिलो।' },
    'juju-dhau': { tr: 'जुजु धौ', desc: 'माटोको कटौरामा जमाएको भक्तपुरको बाक्लो, गुलियो दही।' },
    'sel-roti': { tr: 'सेल रोटी', desc: 'तिहारमा जस्तै कुरकुरे, गुलियो सेल रोटी।' },
    kheer: { tr: 'खीर', desc: 'दूधमा पकाएको चामल, अलैंची, काजु र किसमिससँग।' },
  },
  cartBar: (n) => `मेरो अर्डर · ${n}`,
  cartOpen: 'हेर्नुहोस्',
  cartH: 'मेरो अर्डर',
  cartEmpty: 'अहिलेसम्म केही छैन — थप्न परिकारमा थिच्नुहोस्।',
  cartHint: 'पठाउने बित्तिकै भान्सामा काम सुरु हुन्छ।',
  send: 'भान्सामा पठाउनुहोस्',
  sent: (n) => `अर्डर ${n} भान्सामा पुग्यो`,
  reasons: {
    'sold-out': 'तपाईंको अर्डरको एउटा परिकार भर्खरै सकियो — त्यो हटाएर बाँकी पठाउनुहोस्।',
    full: 'यो डेमोमा अर्डर योभन्दा लामो हुँदैन।',
    busy: 'चार वटा अर्डर आउँदै छन् — एउटा आइपुगेसम्म पर्खनुहोस्।',
    empty: 'पहिले एउटा परिकार छान्नुहोस्।',
    unknown: 'यो परिकार मेनुमा छैन।',
  },
  removeSoldOut: 'सकिएका परिकार हटाउनुहोस्',
  ordersEmpty: 'अहिलेसम्म अर्डर छैन। मेनुबाट छानेर भान्सामा पठाउनुहोस्।',
  orderNo: (n) => `अर्डर #${n}`,
  statuses: { received: 'पाइयो', cooking: 'पाक्दै', ready: 'तयार', served: 'टेबलमा' },
  statusHelp: {
    received: 'भान्सामा तपाईंको अर्डर पुग्यो।',
    cooking: 'अहिले चुलोमा छ।',
    ready: 'तयार भयो — टेबलमा आउँदै छ।',
    served: 'टेबलमा आइपुग्यो। मीठो सँग खानुस्!',
  },
  eta: (n) => `करिब ${n} मिनेट`,
  callWaiter: 'वेटर बोलाउनुहोस्',
  called: 'वेटरलाई बोलाइयो — कोही आउँदै हुनुहुन्छ।',
  onTheWay: 'वेटर आउँदै हुनुहुन्छ',
  askBill: 'बिल माग्नुहोस्',
  billAsked: 'तपाईं निस्कन तयार हुनुहुन्छ भनेर वेटरलाई थाहा छ।',
  summaryH: 'तपाईंको अर्डरको सारांश',
  summarySub: 'आज साँझ यो टेबलबाट मगाइएका सबै परिकार।',
  summaryNone: 'तपाईंले अहिलेसम्म केही मगाउनुभएको छैन।',
  summaryServed: (a, b) => `${b} मध्ये ${a} टेबलमा`,
  summaryNote: 'यो डेमोको सारांशमा परिकारको नाम र गन्ती मात्र छन्।',
  summaryItems: (n) => `परिकार र पेय: ${n}`,
  newVisit: 'टेबल सफा भयो — आउनुभएकोमा धन्यवाद! नयाँ भेट सुरु भयो।',
  statusToast: (d, s) => `${d}: ${s}`,

  kitchenH: 'भान्साको बोर्ड',
  stationsLabel: 'स्टेसन',
  stations: { all: 'सबै स्टेसन', momo: 'मःम स्टेसन', curry: 'तरकारी र वोक', bar: 'बार र मिठाई' },
  cols: { received: 'नयाँ', cooking: 'पाक्दै', ready: 'तयार' },
  go: { received: 'पकाउनुहोस् →', cooking: 'तयार →', ready: 'पस्कियो ✓' },
  tapHint: 'अर्को चरणमा सार्न टिकटमा थिच्नुहोस्।',
  colEmpty: 'केही छैन',
  mins: (n) => `${n} मिनेट`,
  tableShort: (n) => `टे${n}`,
  other: (n) => `+${n} अरू स्टेसनका`,
  soundOn: 'आवाज खुला',
  soundOff: 'आवाज बन्द',
  live: 'लाइभ',

  floorH: 'टेबलको नक्सा',
  floorSub: 'अर्डर हेर्न टेबलमा थिच्नुहोस्।',
  status: { free: 'खाली', ordering: 'अर्डर गर्दै', waiting: 'खाना पर्खँदै', eating: 'खाँदै', bill: 'बिल माग्दै' },
  calling: 'वेटर बोलाउँदै',
  wantsBill: 'बिल माग्दै',
  you: 'तपाईं',
  seats: (n) => `${n} सिट`,
  guests: (n) => `${n} जना`,
  window: 'झ्याल',
  bar: 'बार',
  pass: 'भान्साको काउन्टर',
  door: 'ढोका',
  tableH: (n) => `टेबल ${n}`,
  ack: 'आउँदै छु',
  clearTable: 'टेबल सफा',
  noOrders: 'यो टेबलमा अर्डर छैन।',
  readyH: 'काउन्टरमा तयार',
  readyNone: 'केही पर्खिरहेको छैन — भान्सा समयमै छ।',
  serve: 'पस्कनुहोस्',
  alertsH: 'सूचना',
  alertsNone: 'अहिले कुनै टेबललाई तपाईं चाहिएको छैन।',
  todayH: 'आज अहिलेसम्म',
  kOrders: 'अर्डर',
  kDishes: 'परिकार र पेय',
  kPrep: 'भान्साको औसत समय',
  kPrepVal: (n) => `${n} मिनेट`,
  topH: 'आज साँझका मनपर्ने परिकार',
  countsNote: 'पस्किएका प्लेटको गन्ती।',
  menuH: 'आज के-के छ',
  menuSub: 'परिकार सकियो भनेर चिनो लगाउनुहोस् — पाहुनाले तुरुन्तै खैरो देख्छन्।',
  available: 'उपलब्ध',
  printBtn: 'टेबलका QR कोड छाप्नुहोस्',
  printH: 'हरेक टेबलका लागि QR कोड',
  printSub: 'छाप्नुहोस्, काट्नुहोस् र हरेक टेबलमा राख्नुहोस्। पाहुनाले स्क्यान गरेर अर्डर गर्छन्, भान्साले देख्छ।',
  printNow: 'छाप्नुहोस्',
  scanToOrder: 'मेनु हेर्न र अर्डर गर्न स्क्यान गर्नुहोस्',
  tableQr: (n) => `टेबल ${n} को QR कोड`,
  callToast: (n) => `टेबल ${n} ले वेटर बोलाउँदै छ`,
  billToast: (n) => `टेबल ${n} ले बिल माग्दै छ`,
  soldOutToast: (d) => `${d} सकियो — पाहुनाका लागि खैरो देखिन्छ`,
  backToast: (d) => `${d} फेरि मेनुमा छ`,
};

export const COPY: Record<Lang, Copy> = { en, de, ne };
