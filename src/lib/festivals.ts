// The festival calendar — a hand-kept table, and deliberately so.
//
// These pages exist because "Dashain kahile ho?" (when is Dashain?) is a
// question the community genuinely searches and asks in WhatsApp groups every
// single year, and a page that answers it is worth sharing even when no event
// is listed yet. The dates are Bikram Sambat lunar dates that shift against
// the Gregorian calendar every year, published by panchang; no formula in this
// codebase should pretend to compute them. Once a year, someone looks the new
// dates up and adds one entry per festival below. That is the entire
// maintenance burden, and it is the same burden every Nepali household carries.
//
// Dates for 2026 were checked against multiple panchang sources (drikpanchang,
// timeanddate, chautarihub) in August 2026. Where panchang traditions differ
// by a day (Laxmi Puja famously does), the page says so rather than picking a
// side — the diaspora celebrates on both.

export interface FestivalOccurrence {
  /** Gregorian year this occurrence falls in. */
  year: number;
  /** First day of the festival period, ISO date. */
  start: string;
  /** Last day, ISO date. */
  end: string;
  /** The headline day (Tika, Bhai Tika…), ISO date. */
  mainDay: string;
  /** What the headline day is called, e.g. 'Vijaya Dashami (Tika)'. */
  mainDayName: string;
  /** Bikram Sambat year, for the people who count properly. */
  bsYear: number;
  /** Day-by-day highlights, in order. Keep it short — this is a card, not a scripture. */
  days: { date: string; name: string }[];
  /** One honest sentence when sources disagree; '' when they don't. */
  dateNote: string;
}

export interface Festival {
  /** URL segment and stable key: /dashain, /tihar. */
  slug: string;
  name: string;
  /** The name written in Devanagari, shown beside the Latin one. */
  nameNe: string;
  /** One-line greeting shown on the page, in Nepali. */
  greetingNe: string;
  /** Two or three sentences for someone who has never heard of it. */
  about: string;
  occurrences: FestivalOccurrence[];
}

export const FESTIVALS: Festival[] = [
  {
    slug: 'dashain',
    name: 'Dashain',
    nameNe: 'दशैं',
    greetingNe: 'शुभ विजया दशमी!',
    about:
      'Dashain is the biggest festival of the year for Nepalis everywhere — fifteen days of family, ' +
      'blessings and feasting, celebrating the victory of good over evil. The heart of it is Tika day, ' +
      'when elders place tika and jamara and give their blessing. Far from home, the diaspora gathers ' +
      'wherever it can: cultural nights, community dinners, and a phone call to Nepal that day.',
    occurrences: [
      {
        year: 2026,
        start: '2026-10-11',
        end: '2026-10-26',
        mainDay: '2026-10-21',
        mainDayName: 'Vijaya Dashami (Tika)',
        bsYear: 2083,
        days: [
          { date: '2026-10-11', name: 'Ghatasthapana — jamara is sown' },
          { date: '2026-10-17', name: 'Phulpati' },
          { date: '2026-10-18', name: 'Maha Ashtami' },
          { date: '2026-10-20', name: 'Maha Navami' },
          { date: '2026-10-21', name: 'Vijaya Dashami — Tika (auspicious time ~11:53 NPT)' },
          { date: '2026-10-26', name: 'Kojagrat Purnima' },
        ],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'tihar',
    name: 'Tihar',
    nameNe: 'तिहार',
    greetingNe: 'शुभ दीपावली!',
    about:
      'Tihar is the festival of lights — five days honouring crows, dogs, cows, wealth and, on the ' +
      'final day, the bond between brothers and sisters. Homes glow with diyo and fairy lights, ' +
      'Laxmi Puja fills doorways with rangoli, and Bhai Tika closes the festival with the year’s ' +
      'warmest family moment. Deusi–bhailo singing goes door to door — in Germany, flat to flat.',
    occurrences: [
      {
        year: 2026,
        start: '2026-11-07',
        end: '2026-11-11',
        mainDay: '2026-11-11',
        mainDayName: 'Bhai Tika',
        bsYear: 2083,
        days: [
          { date: '2026-11-07', name: 'Kag Tihar (crow) / start of the lights' },
          { date: '2026-11-08', name: 'Kukur Tihar (dog)' },
          { date: '2026-11-09', name: 'Laxmi Puja — the night of lights' },
          { date: '2026-11-10', name: 'Govardhan Puja / Mha Puja (Nepal Sambat new year)' },
          { date: '2026-11-11', name: 'Bhai Tika (auspicious time ~11:39 NPT)' },
        ],
        dateNote:
          'Panchang traditions differ by a day on Laxmi Puja in 2026 — some observe the evening of ' +
          'Nov 8, others Nov 9. Communities celebrate on both; check what yours follows.',
      },
    ],
  },
];

export function getFestival(slug: string): Festival | null {
  return FESTIVALS.find((f) => f.slug === slug) ?? null;
}

/**
 * The occurrence a visitor opening the page today cares about: the next one
 * coming, or the one just past when nothing future is on file yet. Festival
 * pages are evergreen — the URL stays /dashain forever — so "the current one"
 * has to be decided at request time, not baked into the page.
 *
 * Kept visible for ~2 months after it ends: "how was Dashain this year" and
 * late deusi rounds are real traffic, and a page that snaps to "dates coming
 * soon" on the day after Tika would go blank at peak interest.
 */
export function currentOccurrence(festival: Festival, today = new Date()): FestivalOccurrence | null {
  const iso = today.toISOString().slice(0, 10);
  const upcoming = festival.occurrences
    .filter((o) => o.end >= iso)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming.length > 0) return upcoming[0];

  const past = festival.occurrences
    .filter((o) => o.end < iso)
    .sort((a, b) => b.end.localeCompare(a.end));
  if (past.length > 0) {
    const end = new Date(past[0].end + 'T00:00:00Z');
    const daysSince = (today.getTime() - end.getTime()) / 86_400_000;
    if (daysSince <= 60) return past[0];
  }
  return null;
}

/**
 * How strongly an event belongs on this festival's page.
 *
 * Two grades, because the two claims are different and the page must not blur
 * them. 'named' — the organizer put the festival in the event's own name;
 * showing it under "Dashain events" repeats what they said. 'nearby' — the
 * date merely lands near the festival window; the diaspora does celebrate on
 * surrounding weekends (a hall on Tika day itself is a luxury), but a jazz
 * night that happens to fall in Dashain week did not become a Dashain event,
 * so these render under their own honest "also on around…" heading. A name
 * that names a DIFFERENT festival never matches: Tihar Deusi Night inside
 * Dashain's generous window belongs to /tihar, not both.
 */
export function festivalMatch(
  festival: Festival,
  occurrence: FestivalOccurrence,
  event: { name: string; eventDate: string | null }
): 'named' | 'nearby' | null {
  const name = event.name.toLowerCase();
  if (name.includes(festival.slug) || name.includes(festival.name.toLowerCase())) return 'named';
  for (const other of FESTIVALS) {
    if (other.slug === festival.slug) continue;
    if (name.includes(other.slug) || name.includes(other.name.toLowerCase())) return null;
  }
  if (!event.eventDate) return null;
  const from = shiftDays(occurrence.start, -21);
  const to = shiftDays(occurrence.end, 7);
  return event.eventDate >= from && event.eventDate <= to ? 'nearby' : null;
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
