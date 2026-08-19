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
// Dates for 2026–2027 were checked against multiple panchang sources
// (drikpanchang, hamropatro, timeanddate, Nepal's official 2083 holiday list)
// and independently cross-verified in August 2026. Where panchang traditions
// differ by a day (Laxmi Puja famously does), the page says so rather than
// picking a side — the diaspora celebrates on both.

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
  {
    slug: 'teej',
    name: 'Teej',
    nameNe: 'हरितालिका तीज',
    greetingNe: 'तीजको हार्दिक शुभकामना!',
    about:
      'Teej is the biggest celebration of Nepali women: dressed in red, they gather to sing, dance ' +
      'and fast in honour of the goddess Parvati, praying for the wellbeing of loved ones. It opens ' +
      'with Dar Khane Din, a joyous feast before the fast, and closes with the purification rites of ' +
      'Rishi Panchami. Across Germany the diaspora throws Teej specials — red saris, dar feasts and ' +
      'dohori dancing, usually on the nearest weekend to the main day.',
    occurrences: [
      {
        year: 2026,
        start: '2026-09-13',
        end: '2026-09-15',
        mainDay: '2026-09-14',
        mainDayName: 'Haritalika Teej (fasting day)',
        bsYear: 2083,
        days: [
          { date: '2026-09-13', name: 'Dar Khane Din' },
          { date: '2026-09-14', name: 'Haritalika Teej — the fasting day' },
          { date: '2026-09-15', name: 'Rishi Panchami' },
        ],
        dateNote:
          'Nepali calendars agree on Sep 14 for Teej and Sep 15 for Rishi Panchami, but the Panchami ' +
          'tithi runs into the morning of Sep 16, so a few listings put Rishi Panchami a day later.',
      },
    ],
  },
  {
    slug: 'chhath',
    name: 'Chhath',
    nameNe: 'छठ पर्व',
    greetingNe: 'छठ पर्वको हार्दिक मंगलमय शुभकामना!',
    about:
      'Chhath is a four-day festival of gratitude to the Sun god and Chhathi Maiya, held especially ' +
      'dear by families from Nepal’s Terai and the Mithila region. Devotees keep a rigorous fast and ' +
      'offer arghya to the setting and then the rising sun while standing in water, with baskets of ' +
      'thekuwa and fruit prepared at home. In Germany the diaspora recreates the ghats at local lakes ' +
      'and riverbanks, gathering at the water’s edge for the Sandhya Arghya evening.',
    occurrences: [
      {
        year: 2026,
        start: '2026-11-13',
        end: '2026-11-16',
        mainDay: '2026-11-15',
        mainDayName: 'Sandhya Arghya',
        bsYear: 2083,
        days: [
          { date: '2026-11-13', name: 'Nahay Khay' },
          { date: '2026-11-14', name: 'Kharna' },
          { date: '2026-11-15', name: 'Sandhya Arghya — evening offering to the setting sun' },
          { date: '2026-11-16', name: 'Usha Arghya (Parana)' },
        ],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'nepali-new-year',
    name: 'Nepali New Year',
    nameNe: 'नेपाली नयाँ वर्ष',
    greetingNe: 'नयाँ वर्ष २०८४ को हार्दिक शुभकामना!',
    about:
      'Nepal follows the Bikram Sambat calendar, which runs about 57 years ahead of the Gregorian ' +
      'one, and Baisakh 1 — mid-April — is New Year’s Day, greeted with family outings, picnics and ' +
      'street festivals like Bhaktapur’s Bisket Jatra. For the diaspora it is the big spring ' +
      'get-together: Nepali societies across Germany host New Year melas with food stalls, music and ' +
      'cultural programmes. On 14 April 2027, the year 2084 BS begins.',
    occurrences: [
      {
        year: 2027,
        start: '2027-04-14',
        end: '2027-04-14',
        mainDay: '2027-04-14',
        mainDayName: 'Navavarsha — Baisakh 1, 2084 BS',
        bsYear: 2084,
        days: [{ date: '2027-04-14', name: 'Nepali New Year (Baisakh 1, 2084)' }],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'holi',
    name: 'Holi',
    nameNe: 'होली (फागु पूर्णिमा)',
    greetingNe: 'फागु पूर्णिमाको रङ्गीन शुभकामना!',
    about:
      'Holi, called Fagu Purnima in Nepal, is the spring festival of colours: friends and strangers ' +
      'alike douse each other in abir powder and water to celebrate good over evil and the end of ' +
      'winter. Nepal celebrates it over two days — the hills and Kathmandu Valley first, the Terai ' +
      'the following day. Diaspora groups in Germany usually save the colour-throwing for a weekend ' +
      'park or hall event, with music, water balloons and plenty of gulal.',
    occurrences: [
      {
        year: 2027,
        start: '2027-03-21',
        end: '2027-03-22',
        mainDay: '2027-03-21',
        mainDayName: 'Holi — hills & Kathmandu Valley',
        bsYear: 2083,
        days: [
          { date: '2027-03-21', name: 'Fagu Purnima — hill districts & Kathmandu Valley' },
          { date: '2027-03-22', name: 'Fagu Purnima — Terai/Madhesh districts' },
        ],
        dateNote:
          'The two dates are not a disagreement but the traditional split: the hills and Kathmandu ' +
          'play Holi on Mar 21 (Chaitra 7), the Terai one day later on Mar 22.',
      },
    ],
  },
  {
    slug: 'sonam-lhosar',
    name: 'Sonam Lhosar',
    nameNe: 'सोनाम ल्होसार',
    greetingNe: 'सोनाम ल्होसारको हार्दिक शुभकामना!',
    about:
      'Sonam Lhosar is the New Year of Nepal’s Tamang community, falling on the first day of the ' +
      'waxing moon of Magh. Families clean and decorate their homes, visit monasteries, share sel ' +
      'roti and feasts, and dance to the beat of the damphu drum in traditional dress. Tamang ' +
      'societies in Europe mark it with cultural nights full of tamang selo music — a highlight of ' +
      'the diaspora winter calendar.',
    occurrences: [
      {
        year: 2027,
        start: '2027-02-07',
        end: '2027-02-07',
        mainDay: '2027-02-07',
        mainDayName: 'Sonam Lhosar (Magh 24, 2083 BS)',
        bsYear: 2083,
        days: [{ date: '2027-02-07', name: 'Sonam Lhosar' }],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'tamu-lhosar',
    name: 'Tamu Lhosar',
    nameNe: 'तमु ल्होसार',
    greetingNe: 'तमु ल्होसारको हार्दिक शुभकामना!',
    about:
      'Tamu Lhosar is the New Year of the Gurung (Tamu) community, fixed on Poush 15 of the Nepali ' +
      'calendar — almost always 30 December. It marks the turn of the lho, the twelve-year animal ' +
      'cycle, with feasts, monastery visits and grand processions in Pokhara and Kathmandu. Gurung ' +
      'associations abroad, including many ex-Gurkha families across Europe, celebrate with community ' +
      'feasts and dances in traditional dress just before the western New Year.',
    occurrences: [
      {
        year: 2026,
        start: '2026-12-30',
        end: '2026-12-30',
        mainDay: '2026-12-30',
        mainDayName: 'Tamu Lhosar (Poush 15, 2083 BS)',
        bsYear: 2083,
        days: [{ date: '2026-12-30', name: 'Tamu Lhosar' }],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'gyalpo-lhosar',
    name: 'Gyalpo Lhosar',
    nameNe: 'ग्याल्पो ल्होसार',
    greetingNe: 'ग्याल्पो ल्होसारको शुभकामना — ताशी देलेक!',
    about:
      'Gyalpo Lhosar is the New Year of the Sherpa, Hyolmo and Bhote communities of Nepal’s high ' +
      'Himalaya, following the Tibetan lunar calendar. Homes and monasteries are decorated, khapse ' +
      'pastries and changkol are shared, and masked lama dances chase away the old year’s ' +
      'misfortunes. Himalayan-community associations in Europe celebrate with monastery visits and ' +
      'gatherings where “Tashi Delek” greetings are exchanged.',
    occurrences: [
      {
        year: 2027,
        start: '2027-03-09',
        end: '2027-03-09',
        mainDay: '2027-03-09',
        mainDayName: 'Gyalpo Lhosar (Falgun 25, 2083 BS)',
        bsYear: 2083,
        days: [{ date: '2027-03-09', name: 'Gyalpo Lhosar' }],
        dateNote:
          'Nepal’s official 2083 holiday list and Hamro Patro both give Falgun 25 / March 9, 2027; ' +
          'some international sites list March 5. Tibetan-calendar reckonings can differ — we follow ' +
          'the Nepali calendar date.',
      },
    ],
  },
  {
    slug: 'saraswati-puja',
    name: 'Saraswati Puja',
    nameNe: 'सरस्वती पूजा (श्रीपञ्चमी)',
    greetingNe: 'श्रीपञ्चमीको हार्दिक शुभकामना!',
    about:
      'Shree Panchami, or Basanta Panchami, welcomes spring and honours Saraswati, the goddess of ' +
      'knowledge, music and the arts. In Nepal it is the day children traditionally write their ' +
      'first letters, students have their pens and books blessed, and temples like Kathmandu’s ' +
      'Saraswati sthans overflow with pupils. Diaspora families keep the tradition alive with a ' +
      'small puja at home, blessing schoolbooks and instruments, and community pujas where there is ' +
      'a temple nearby.',
    occurrences: [
      {
        year: 2027,
        start: '2027-02-11',
        end: '2027-02-11',
        mainDay: '2027-02-11',
        mainDayName: 'Shree Panchami / Saraswati Puja',
        bsYear: 2083,
        days: [{ date: '2027-02-11', name: 'Saraswati Puja / Basanta Panchami (Magh 28, 2083)' }],
        dateNote: '',
      },
    ],
  },
  {
    slug: 'buddha-jayanti',
    name: 'Buddha Jayanti',
    nameNe: 'बुद्ध जयन्ती',
    greetingNe: 'बुद्ध जयन्तीको शुभकामना — भवतु सब्ब मङ्गलम्!',
    about:
      'Buddha Jayanti, on the full moon of Baisakh, celebrates the birth, enlightenment and passing ' +
      'of Gautam Buddha — born in Lumbini, Nepal, a point of deep pride for Nepalis everywhere. ' +
      'Swayambhunath and Boudhanath glow with butter lamps as devotees circle the stupas and share ' +
      'sweet kheer. Diaspora Buddhists and well-wishers in Germany join Vesak events at local ' +
      'monasteries and Nepali community prayer gatherings.',
    occurrences: [
      {
        year: 2027,
        start: '2027-05-20',
        end: '2027-05-20',
        mainDay: '2027-05-20',
        mainDayName: 'Buddha Jayanti (Baisakh Purnima)',
        bsYear: 2084,
        days: [{ date: '2027-05-20', name: 'Buddha Jayanti (Baisakh Purnima)' }],
        dateNote: '',
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
