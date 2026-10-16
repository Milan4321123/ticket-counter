// Festival greeting cards — what /card offers for each festival: the looks,
// the ready-made wishes, and the order the festivals are offered in.
//
// The card itself is drawn in the visitor's own browser (components/greeting/
// drawCard.ts) and never touches this server: no upload, no image work on the
// host, and a family photo that never leaves the phone it was chosen on. This
// file only decides WHAT can be drawn, so the page can hand it to the maker as
// plain data.
//
// Why this exists at all: at Dashain and Tihar every Nepali phone sends and
// receives dozens of greeting images, forwarded from group to group. A card a
// person made with their own name and photo is one they actually send — and
// every one carries the site's address into a family group no advert reaches.
import { currentOccurrence, FESTIVALS, type Festival } from './festivals';
import { toDevanagariDigits } from './patro';

export type CardLook =
  | 'kites'
  | 'tika'
  | 'diyo'
  | 'rangoli'
  | 'marigold'
  | 'bhaitika'
  | 'festive'
  | 'classic';

export interface CardWish {
  /** The big line, in Nepali. */
  ne: string;
  /** The smaller line underneath, in English. */
  en: string;
}

export interface CardFestival {
  slug: string;
  name: string;
  nameNe: string;
  year: number;
  bsYear: number;
  /** "२०८३" — for the kicker line on the card. */
  bsYearNe: string;
  start: string;
  end: string;
  mainDay: string;
  mainDayName: string;
  looks: { id: CardLook; label: string }[];
  wishes: CardWish[];
}

export const LOOK_LABELS: Record<CardLook, string> = {
  kites: 'Kites in the sky',
  tika: 'Tika & jamara',
  diyo: 'Diyo lights',
  rangoli: 'Rangoli',
  marigold: 'Sayapatri mala',
  bhaitika: 'Bhai Tika',
  festive: 'Festive',
  classic: 'Classic',
};

const LOOKS: Record<string, CardLook[]> = {
  dashain: ['kites', 'tika', 'classic'],
  tihar: ['diyo', 'rangoli', 'marigold', 'bhaitika'],
};

/** Said by people far from home, which is everybody who reads this site. */
const FAR_FROM_HOME = 'Far from home, close at heart.';

function wishesFor(f: Festival, bsYearNe: string): CardWish[] {
  if (f.slug === 'dashain') {
    return [
      {
        ne: 'विजया दशमीको हार्दिक मंगलमय शुभकामना!',
        en: 'Happy Dashain! Wishing you and your family health, happiness and success.',
      },
      { ne: `बडा दशैं ${bsYearNe} को हार्दिक शुभकामना!`, en: `${FAR_FROM_HOME} Happy Dashain to everyone back home and here.` },
      { ne: 'शुभ विजया दशमी!', en: 'May the blessings of this Dashain stay with you all year.' },
    ];
  }
  if (f.slug === 'tihar') {
    return [
      { ne: 'शुभ दीपावली!', en: 'Happy Tihar! May the festival of lights fill your home with joy.' },
      { ne: 'तिहारको हार्दिक शुभकामना!', en: 'Wishing you light, prosperity and good fortune this Tihar.' },
      { ne: 'भाइटीकाको हार्दिक शुभकामना!', en: 'To my brothers and sisters, near and far — happy Bhai Tika!' },
      { ne: 'शुभ दीपावली!', en: `${FAR_FROM_HOME} Happy Tihar from our home to yours.` },
    ];
  }
  return [
    { ne: f.greetingNe, en: `Happy ${f.name}! Warm wishes from our family to yours.` },
    { ne: f.greetingNe, en: `${FAR_FROM_HOME} Happy ${f.name}.` },
  ];
}

/**
 * Every festival with a current or coming occurrence, soonest first — so the
 * maker opens on whatever the community is celebrating now. A festival that
 * ended more than two months ago has no occurrence (lib/festivals) and is not
 * offered: a Holi card in October helps nobody.
 */
export function cardFestivals(today = new Date()): CardFestival[] {
  const out: CardFestival[] = [];
  for (const f of FESTIVALS) {
    const o = currentOccurrence(f, today);
    if (!o) continue;
    const bsYearNe = toDevanagariDigits(o.bsYear);
    const looks = (LOOKS[f.slug] ?? ['festive', 'classic']).map((id) => ({ id, label: LOOK_LABELS[id] }));
    out.push({
      slug: f.slug,
      name: f.name,
      nameNe: f.nameNe,
      year: o.year,
      bsYear: o.bsYear,
      bsYearNe,
      start: o.start,
      end: o.end,
      mainDay: o.mainDay,
      mainDayName: o.mainDayName,
      looks,
      wishes: wishesFor(f, bsYearNe),
    });
  }
  const iso = today.toISOString().slice(0, 10);
  // On now first (ends soonest), then coming up (starts soonest), then the
  // recently-ended tail that currentOccurrence keeps alive for two months.
  const rank = (c: CardFestival) => (c.end < iso ? 2 : c.start <= iso ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || a.start.localeCompare(b.start));
}

/** The festival a card link names, else the one on now (or next). */
export function pickCardFestival(list: CardFestival[], slug: string | undefined): CardFestival | null {
  return list.find((c) => c.slug === slug) ?? list[0] ?? null;
}

/**
 * The festival worth a "make your card" nudge on the homepage: one that is on
 * now or starts within `leadDays`. Null the rest of the year, so the band only
 * appears when people are actually sending greetings.
 */
export function cardFestivalInSeason(today = new Date(), leadDays = 10): CardFestival | null {
  const iso = today.toISOString().slice(0, 10);
  const lead = new Date(today.getTime() + leadDays * 86_400_000).toISOString().slice(0, 10);
  return cardFestivals(today).find((c) => c.start <= lead && c.end >= iso) ?? null;
}
