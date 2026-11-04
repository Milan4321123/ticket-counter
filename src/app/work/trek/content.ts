// Words for "Yatri Treks" (/work/trek) in English, Deutsch and नेपाली: the
// made-up agency, the places (Devanagari names for नेपाली), the ready trips
// and their days, the packing list, permits, festivals and every line of the
// planner. The rules live in trek.ts.
//
// Yatri Treks is invented; so is everything it "offers" — no prices, permit
// fees, costs or amounts anywhere (tests/studioWords.test.ts and
// tests/trekPlanner.test.ts scan this file and the generated texts).
// Altitudes are the commonly quoted round figures. The altitude rule is
// general guidance, not medical advice, and says so.

import type { Day, DayInfo, FestivalId, L, Lang, Lodge, Mode, PackGroup, PackId, PeakId, PermitId, Region, StopId, TripId, Warning } from './trek';
import { STOPS, addDays, dayInfos, isDate, totals } from './trek';

export type { Lang };

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'ne', label: 'नेपाली', short: 'ने' },
];
export function asLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
/** Digits in Devanagari for नेपाली. */
export function num(s: string | number, lang: Lang): string {
  const v = String(s);
  return lang === 'ne' ? v.replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : v;
}
/** 5364 → "5,364" / "5.364" / "५,३६४"; 5.5 → "5.5" / "5,5" / "५.५". */
export function count(n: number, lang: Lang): string {
  const [int, frac] = String(Math.abs(Math.round(n * 10) / 10)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'de' ? '.' : ',');
  return num((n < 0 ? '−' : '') + grouped + (frac ? (lang === 'de' ? ',' : '.') + frac : ''), lang);
}
export const LOCALE: Record<Lang, string> = { en: 'en-GB', de: 'de-DE', ne: 'ne-NP' };

export const BRAND: L = { en: 'Yatri Treks', de: 'Yatri Treks', ne: 'यात्री ट्रेक्स' };

// ---------------------------------------------------------------- places

export const STOP_NAME: Record<StopId, L> = {
  ktm: { en: 'Kathmandu', de: 'Kathmandu', ne: 'काठमाडौं' },
  pkr: { en: 'Pokhara', de: 'Pokhara', ne: 'पोखरा' },
  chitwan: { en: 'Chitwan (Sauraha)', de: 'Chitwan (Sauraha)', ne: 'चितवन (सौराहा)' },
  lumbini: { en: 'Lumbini', de: 'Lumbini', ne: 'लुम्बिनी' },
  tilaurakot: { en: 'Tilaurakot', de: 'Tilaurakot', ne: 'तिलौराकोट' },
  lukla: { en: 'Lukla', de: 'Lukla', ne: 'लुक्ला' },
  phakding: { en: 'Phakding', de: 'Phakding', ne: 'फाक्दिङ' },
  namche: { en: 'Namche Bazaar', de: 'Namche Bazar', ne: 'नाम्चे बजार' },
  tengboche: { en: 'Tengboche', de: 'Tengboche', ne: 'तेङबोचे' },
  dingboche: { en: 'Dingboche', de: 'Dingboche', ne: 'डिङबोचे' },
  pheriche: { en: 'Pheriche', de: 'Pheriche', ne: 'फेरिचे' },
  lobuche: { en: 'Lobuche', de: 'Lobuche', ne: 'लोबुचे' },
  gorakshep: { en: 'Gorakshep', de: 'Gorak Shep', ne: 'गोरखशेप' },
  ebc: { en: 'Everest Base Camp', de: 'Everest-Basislager', ne: 'सगरमाथा आधार शिविर' },
  kalapatthar: { en: 'Kala Patthar', de: 'Kala Patthar', ne: 'कालापत्थर' },
  tikhedhunga: { en: 'Tikhedhunga', de: 'Tikhedhunga', ne: 'तिखेढुंगा' },
  ghorepani: { en: 'Ghorepani', de: 'Ghorepani', ne: 'घोरेपानी' },
  poonhill: { en: 'Poon Hill', de: 'Poon Hill', ne: 'पुनहिल' },
  tadapani: { en: 'Tadapani', de: 'Tadapani', ne: 'ताडापानी' },
  ghandruk: { en: 'Ghandruk', de: 'Ghandruk', ne: 'घान्द्रुक' },
  chhomrong: { en: 'Chhomrong', de: 'Chhomrong', ne: 'छोमरोङ' },
  jhinu: { en: 'Jhinu Danda', de: 'Jhinu Danda', ne: 'झिनु डाँडा' },
  bamboo: { en: 'Bamboo', de: 'Bamboo', ne: 'बाम्बु' },
  deurali: { en: 'Deurali', de: 'Deurali', ne: 'देउराली' },
  mbc: { en: 'Machapuchare Base Camp', de: 'Machapuchare-Basislager', ne: 'माछापुच्छ्रे आधार शिविर' },
  abc: { en: 'Annapurna Base Camp', de: 'Annapurna-Basislager', ne: 'अन्नपूर्ण आधार शिविर' },
  dhampus: { en: 'Dhampus', de: 'Dhampus', ne: 'धम्पुस' },
  syabrubesi: { en: 'Syabrubesi', de: 'Syabrubesi', ne: 'स्याब्रुबेसी' },
  lamahotel: { en: 'Lama Hotel', de: 'Lama Hotel', ne: 'लामा होटल' },
  langtang: { en: 'Langtang village', de: 'Dorf Langtang', ne: 'लाङटाङ गाउँ' },
  kyanjin: { en: 'Kyanjin Gompa', de: 'Kyanjin Gompa', ne: 'क्यान्जिन गुम्बा' },
  kyanjinri: { en: 'Kyanjin Ri', de: 'Kyanjin Ri', ne: 'क्यान्जिन री' },
  jomsom: { en: 'Jomsom', de: 'Jomsom', ne: 'जोमसोम' },
  lomanthang: { en: 'Lo Manthang (Upper Mustang)', de: 'Lo Manthang (Upper Mustang)', ne: 'लोमान्थाङ (माथिल्लो मुस्ताङ)' },
  rara: { en: 'Rara Lake', de: 'Rara-See', ne: 'रारा ताल' },
};

/** One line about each place (a day someone added gets this as its highlight). */
export const STOP_NOTE: Record<StopId, L> = {
  ktm: {
    en: 'Temples, old squares and the bustle of the capital.',
    de: 'Tempel, alte Plätze und das Gewusel der Hauptstadt.',
    ne: 'मन्दिर, पुराना दरबार क्षेत्र र राजधानीको चहलपहल।',
  },
  pkr: { en: 'A lakeside town under the Annapurnas.', de: 'Eine Stadt am See unter den Annapurnas.', ne: 'अन्नपूर्णमुनिको तालछेउको सहर।' },
  chitwan: { en: 'Jungle, rhinos and the Rapti river.', de: 'Dschungel, Nashörner und der Rapti-Fluss.', ne: 'जङ्गल, गैंडा र राप्ती नदी।' },
  lumbini: { en: 'The birthplace of the Buddha.', de: 'Der Geburtsort des Buddha.', ne: 'भगवान् बुद्धको जन्मस्थल।' },
  tilaurakot: { en: 'The ruins of old Kapilvastu.', de: 'Die Ruinen des alten Kapilvastu.', ne: 'पुरानो कपिलवस्तुका भग्नावशेष।' },
  lukla: { en: 'The mountain airstrip where the Everest trail starts.', de: 'Die Bergpiste, an der der Everest-Weg beginnt.', ne: 'सगरमाथा पदमार्ग सुरु हुने हिमाली विमानस्थल।' },
  phakding: { en: 'A riverside village on the Dudh Koshi.', de: 'Ein Dorf am Dudh Koshi.', ne: 'दूधकोशी किनारको गाउँ।' },
  namche: {
    en: 'The Sherpa capital: a horseshoe of lodges and shops.',
    de: 'Die Hauptstadt der Sherpa: ein Hufeisen aus Lodges und Läden.',
    ne: 'शेर्पाहरूको राजधानी: घोडानालजस्तो बस्ती।',
  },
  tengboche: { en: 'The great monastery facing Ama Dablam.', de: 'Das große Kloster gegenüber der Ama Dablam.', ne: 'आमा डब्लमतिर फर्केको ठूलो गुम्बा।' },
  dingboche: { en: 'Stone-walled fields in the Imja valley.', de: 'Felder hinter Steinmauern im Imja-Tal.', ne: 'इम्जा उपत्यकामा ढुङ्गाको पर्खालले घेरिएका खेत।' },
  pheriche: {
    en: 'A windy valley with a high-altitude aid post.',
    de: 'Ein windiges Tal mit einer Höhen-Hilfsstation.',
    ne: 'उच्च हिमाली उपचार केन्द्र भएको हावायुक्त उपत्यका।',
  },
  lobuche: { en: 'The last village before the glacier.', de: 'Das letzte Dorf vor dem Gletscher.', ne: 'हिमनदीअघिको अन्तिम बस्ती।' },
  gorakshep: { en: 'A sandy flat under Kala Patthar.', de: 'Eine Sandebene unter dem Kala Patthar.', ne: 'कालापत्थरमुनिको बलौटे समथर।' },
  ebc: { en: 'The foot of the Khumbu icefall.', de: 'Der Fuß des Khumbu-Eisbruchs.', ne: 'खुम्बु आइसफलको फेदी।' },
  kalapatthar: { en: 'The classic sunrise view of Everest.', de: 'Der klassische Blick auf den Everest bei Sonnenaufgang.', ne: 'सगरमाथामा सूर्योदय हेर्ने प्रख्यात ठाउँ।' },
  tikhedhunga: { en: 'Riverside teahouses below Ulleri.', de: 'Teehäuser am Fluss unterhalb von Ulleri.', ne: 'उल्लेरीमुनि खोलाछेउका लजहरू।' },
  ghorepani: { en: 'A rhododendron ridge below Poon Hill.', de: 'Ein Rhododendron-Kamm unter dem Poon Hill.', ne: 'पुनहिलमुनि लालीगुराँसको डाँडा।' },
  poonhill: { en: 'Sunrise over Dhaulagiri and Annapurna.', de: 'Sonnenaufgang über Dhaulagiri und Annapurna.', ne: 'धौलागिरि र अन्नपूर्णमाथि सूर्योदय।' },
  tadapani: { en: 'A forest clearing with mountain views.', de: 'Eine Waldlichtung mit Bergblick.', ne: 'हिमाल देखिने वनबीचको खुला ठाउँ।' },
  ghandruk: { en: 'A Gurung village of stone houses.', de: 'Ein Gurung-Dorf aus Steinhäusern.', ne: 'ढुङ्गाका घर भएको गुरुङ गाउँ।' },
  chhomrong: { en: 'The gateway to the Annapurna Sanctuary.', de: 'Das Tor zum Annapurna-Sanctuary.', ne: 'अन्नपूर्ण सेन्चुरीको प्रवेशद्वार।' },
  jhinu: { en: 'Hot springs down by the river.', de: 'Heiße Quellen unten am Fluss.', ne: 'खोलाछेउको तातोपानी।' },
  bamboo: { en: 'Teahouses in the bamboo forest.', de: 'Teehäuser im Bambuswald.', ne: 'बाँसको जङ्गलभित्रका लजहरू।' },
  deurali: { en: 'The last lodges before the sanctuary.', de: 'Die letzten Lodges vor dem Sanctuary.', ne: 'सेन्चुरीअघिका अन्तिम लजहरू।' },
  mbc: { en: 'Right under the Fishtail mountain.', de: 'Direkt unter dem „Fischschwanz“-Berg.', ne: 'माछापुच्छ्रेको ठीक मुनि।' },
  abc: { en: 'A ring of high peaks all around.', de: 'Ein Ring hoher Gipfel ringsum.', ne: 'चारैतिर अग्ला हिमालको घेरा।' },
  dhampus: { en: 'A homestay village with Annapurna views.', de: 'Ein Homestay-Dorf mit Annapurna-Blick.', ne: 'अन्नपूर्ण देखिने होमस्टे गाउँ।' },
  syabrubesi: { en: 'Where the Langtang trail starts.', de: 'Hier beginnt der Langtang-Weg.', ne: 'लाङटाङ पदमार्ग सुरु हुने ठाउँ।' },
  lamahotel: { en: 'Lodges in the forest by the river.', de: 'Lodges im Wald am Fluss.', ne: 'खोलाछेउ जङ्गलभित्रका लजहरू।' },
  langtang: { en: 'Yak pastures and prayer wheels.', de: 'Yakweiden und Gebetsmühlen.', ne: 'चौँरी खर्क र माने।' },
  kyanjin: { en: 'Monastery, cheese factory and glaciers.', de: 'Kloster, Käserei und Gletscher.', ne: 'गुम्बा, चिज कारखाना र हिमनदी।' },
  kyanjinri: { en: 'A viewpoint over Langtang Lirung.', de: 'Ein Aussichtspunkt über dem Langtang Lirung.', ne: 'लाङटाङ लिरुङ हेर्ने डाँडा।' },
  jomsom: { en: 'A windy town on the Kali Gandaki.', de: 'Eine windige Stadt am Kali Gandaki.', ne: 'कालीगण्डकी किनारको हावायुक्त सहर।' },
  lomanthang: { en: 'The walled town of Upper Mustang.', de: 'Die ummauerte Stadt im Upper Mustang.', ne: 'माथिल्लो मुस्ताङको पर्खालभित्रको सहर।' },
  rara: { en: 'Nepal’s biggest lake, in the far west.', de: 'Nepals größter See, im fernen Westen.', ne: 'सुदूर पश्चिमको, नेपालकै सबैभन्दा ठूलो ताल।' },
};

export const PEAK_NAME: Record<PeakId, L> = {
  everest: { en: 'Everest', de: 'Everest', ne: 'सगरमाथा' },
  kangchenjunga: { en: 'Kangchenjunga', de: 'Kangchendzönga', ne: 'कञ्चनजङ्घा' },
  makalu: { en: 'Makalu', de: 'Makalu', ne: 'मकालु' },
  choOyu: { en: 'Cho Oyu', de: 'Cho Oyu', ne: 'चोयु' },
  dhaulagiri: { en: 'Dhaulagiri', de: 'Dhaulagiri', ne: 'धौलागिरि' },
  manaslu: { en: 'Manaslu', de: 'Manaslu', ne: 'मनास्लु' },
  annapurna: { en: 'Annapurna', de: 'Annapurna', ne: 'अन्नपूर्ण' },
  machapuchare: { en: 'Machapuchare', de: 'Machapuchare', ne: 'माछापुच्छ्रे' },
  langtangLirung: { en: 'Langtang Lirung', de: 'Langtang Lirung', ne: 'लाङटाङ लिरुङ' },
};

export const REGION_NAME: Record<Region, L> = {
  everest: { en: 'Everest (Khumbu)', de: 'Everest (Khumbu)', ne: 'सगरमाथा (खुम्बु)' },
  annapurna: { en: 'Annapurna', de: 'Annapurna', ne: 'अन्नपूर्ण' },
  langtang: { en: 'Langtang', de: 'Langtang', ne: 'लाङटाङ' },
  mustang: { en: 'Mustang', de: 'Mustang', ne: 'मुस्ताङ' },
  rara: { en: 'Rara & the far west', de: 'Rara & der ferne Westen', ne: 'रारा र सुदूर पश्चिम' },
  lowland: { en: 'Valleys & plains', de: 'Täler & Tiefland', ne: 'उपत्यका र तराई' },
};

// ---------------------------------------------------------------- trips and their days

export const TRIP_TEXT: Record<TripId | 'custom', { name: L; blurb: L }> = {
  ebc: {
    name: { en: 'Everest Base Camp', de: 'Everest-Basislager', ne: 'सगरमाथा आधार शिविर' },
    blurb: {
      en: 'Fly to Lukla, Sherpa villages, two rest days, base camp and sunrise on Kala Patthar.',
      de: 'Flug nach Lukla, Sherpa-Dörfer, zwei Ruhetage, das Basislager und Sonnenaufgang auf dem Kala Patthar.',
      ne: 'लुक्ला उडान, शेर्पा गाउँ, दुई विश्राम दिन, आधार शिविर र कालापत्थरमा सूर्योदय।',
    },
  },
  abc: {
    name: { en: 'Annapurna Base Camp', de: 'Annapurna-Basislager', ne: 'अन्नपूर्ण आधार शिविर' },
    blurb: {
      en: 'Gurung villages, bamboo forest and a sunrise inside the Annapurna Sanctuary.',
      de: 'Gurung-Dörfer, Bambuswald und ein Sonnenaufgang mitten im Annapurna-Sanctuary.',
      ne: 'गुरुङ गाउँ, बाँसको जङ्गल र अन्नपूर्ण सेन्चुरीभित्र सूर्योदय।',
    },
  },
  poon: {
    name: { en: 'Poon Hill', de: 'Poon Hill', ne: 'पुनहिल' },
    blurb: {
      en: 'The short classic: rhododendron forest and sunrise over Dhaulagiri and Annapurna.',
      de: 'Der kurze Klassiker: Rhododendronwald und Sonnenaufgang über Dhaulagiri und Annapurna.',
      ne: 'छोटो र लोकप्रिय: लालीगुराँसको वन, धौलागिरि र अन्नपूर्णमाथि सूर्योदय।',
    },
  },
  langtang: {
    name: { en: 'Langtang Valley', de: 'Langtang-Tal', ne: 'लाङटाङ उपत्यका' },
    blurb: {
      en: 'Close to Kathmandu: yak pastures, Kyanjin Gompa and a climb up Kyanjin Ri.',
      de: 'Nah an Kathmandu: Yakweiden, Kyanjin Gompa und ein Aufstieg auf den Kyanjin Ri.',
      ne: 'काठमाडौं नजिकै: चौँरी खर्क, क्यान्जिन गुम्बा र क्यान्जिन री चढाइ।',
    },
  },
  family: {
    name: { en: 'Family visit + Chitwan + Pokhara', de: 'Familienbesuch + Chitwan + Pokhara', ne: 'परिवार भेट + चितवन + पोखरा' },
    blurb: {
      en: 'Days with family in Kathmandu, a jungle lodge in Chitwan, the lake in Pokhara and a village homestay.',
      de: 'Tage mit der Familie in Kathmandu, eine Dschungel-Lodge in Chitwan, der See in Pokhara und ein Homestay im Dorf.',
      ne: 'काठमाडौंमा परिवारसँग दिन, चितवनमा जङ्गल लज, पोखराको ताल र गाउँको होमस्टे।',
    },
  },
  lumbini: {
    name: { en: 'Lumbini pilgrimage', de: 'Pilgerreise nach Lumbini', ne: 'लुम्बिनी तीर्थयात्रा' },
    blurb: {
      en: 'The stupas of Kathmandu, then Lumbini — where the Buddha was born — and Tilaurakot.',
      de: 'Die Stupas von Kathmandu, dann Lumbini — wo der Buddha geboren wurde — und Tilaurakot.',
      ne: 'काठमाडौंका स्तूपा, अनि बुद्ध जन्मेको लुम्बिनी र तिलौराकोट।',
    },
  },
  custom: {
    name: { en: 'Build your own', de: 'Selbst zusammenstellen', ne: 'आफैं बनाउनुहोस्' },
    blurb: {
      en: 'Start in Kathmandu and add places from the map or the list.',
      de: 'In Kathmandu starten und Orte von der Karte oder aus der Liste hinzufügen.',
      ne: 'काठमाडौंबाट सुरु गरेर नक्सा वा सूचीबाट ठाउँ थप्नुहोस्।',
    },
  },
};

/** What each day of the ready trips is about. */
export const HL: Record<string, L> = {
  ebc1: {
    en: 'Land in Kathmandu, meet your guide, check gear and permits; dinner in Thamel.',
    de: 'Landung in Kathmandu, Treffen mit eurem Guide, Ausrüstung und Permits prüfen; Abendessen in Thamel.',
    ne: 'काठमाडौं आगमन, गाइडसँग भेट, सामान र अनुमतिपत्र जाँच; थमेलमा बेलुकीको खाना।',
  },
  ebc2: {
    en: 'Early flight to Lukla’s mountain airstrip, then an easy walk down the Dudh Koshi to Phakding.',
    de: 'Früher Flug zur Bergpiste von Lukla, dann gemütlich am Dudh Koshi entlang nach Phakding.',
    ne: 'बिहानै लुक्लाको हिमाली विमानस्थलसम्म उडान, अनि दूधकोशी किनारै सजिलो हिँडाइ फाक्दिङसम्म।',
  },
  ebc3: {
    en: 'Suspension bridges, the national park gate at Monjo and a long climb to Namche — the first glimpse of Everest on the way.',
    de: 'Hängebrücken, das Nationalpark-Tor in Monjo und ein langer Aufstieg nach Namche — unterwegs der erste Blick auf den Everest.',
    ne: 'झोलुङ्गे पुल, मोन्जोको राष्ट्रिय निकुञ्ज गेट र नाम्चेसम्म लामो उकालो — बाटोमै सगरमाथाको पहिलो झलक।',
  },
  ebc4: {
    en: 'Rest day: a short hike up above Syangboche for Everest and Ama Dablam, back down to sleep — climb high, sleep low.',
    de: 'Ruhetag: kurze Wanderung über Syangboche hinauf mit Blick auf Everest und Ama Dablam, zum Schlafen wieder runter — hoch steigen, tief schlafen.',
    ne: 'विश्राम दिन: सगरमाथा र आमा डब्लम हेर्न स्याङबोचेमाथि छोटो हिँडाइ, सुत्न तल फर्किने — माथि चढ्ने, तल सुत्ने।',
  },
  ebc5: {
    en: 'Down to the river, then up through pine and rhododendron to Tengboche monastery, with Ama Dablam ahead.',
    de: 'Hinab zum Fluss, dann durch Kiefern und Rhododendron hinauf zum Kloster Tengboche, die Ama Dablam vor Augen.',
    ne: 'खोलासम्म ओरालो, अनि सल्ला र लालीगुराँसको वन हुँदै तेङबोचे गुम्बासम्म उकालो, अगाडि आमा डब्लम।',
  },
  ebc6: {
    en: 'Past Pangboche into the Imja valley: stone-walled fields and big views of Ama Dablam and Lhotse.',
    de: 'Vorbei an Pangboche ins Imja-Tal: Felder hinter Steinmauern, weite Blicke auf Ama Dablam und Lhotse.',
    ne: 'पाङबोचे हुँदै इम्जा उपत्यका: ढुङ्गाको पर्खालभित्रका खेत, आमा डब्लम र ल्होत्सेको भव्य दृश्य।',
  },
  ebc7: {
    en: 'Rest day: climb towards Nangkartshang Peak for the view of Makalu, then back down to sleep.',
    de: 'Ruhetag: Aufstieg Richtung Nangkartshang mit Blick auf den Makalu, zum Schlafen wieder hinunter.',
    ne: 'विश्राम दिन: मकालु हेर्न नाङकार्त्साङतिर उकालो, सुत्न फेरि तल।',
  },
  ebc8: {
    en: 'Up the Thukla climb past the stone memorials for climbers, then beside the Khumbu glacier to Lobuche.',
    de: 'Den Thukla-Anstieg hinauf an den Steindenkmälern für Bergsteiger vorbei, dann am Khumbu-Gletscher entlang nach Lobuche.',
    ne: 'थुक्लाको उकालो, पर्वतारोहीका स्मृति-स्तम्भ हुँदै खुम्बु हिमनदीको छेउछेउ लोबुचेसम्म।',
  },
  ebc9: {
    en: 'To Gorakshep, drop the bags, then over the moraine to Everest Base Camp and the Khumbu icefall — back to Gorakshep for the night.',
    de: 'Nach Gorak Shep, Gepäck abstellen, dann über die Moräne zum Everest-Basislager und zum Khumbu-Eisbruch — zum Übernachten zurück.',
    ne: 'गोरखशेपमा झोला राखेर मोरेन हुँदै सगरमाथा आधार शिविर र खुम्बु आइसफल — रात बिताउन फेरि गोरखशेप।',
  },
  ebc10: {
    en: 'Before dawn up Kala Patthar for sunrise on Everest — the highest point of the trip — then a long walk down to Pheriche.',
    de: 'Vor der Dämmerung auf den Kala Patthar, Sonnenaufgang am Everest — der höchste Punkt der Reise — dann lange hinab nach Pheriche.',
    ne: 'बिहान सबेरै कालापत्थर चढेर सगरमाथामा सूर्योदय — यात्राकै सबैभन्दा अग्लो ठाउँ — अनि फेरिचेसम्म लामो ओरालो।',
  },
  ebc11: {
    en: 'Back down the valley past Tengboche to Namche — thicker air and hot showers again.',
    de: 'Das Tal hinab, an Tengboche vorbei, nach Namche — dichtere Luft und wieder warme Duschen.',
    ne: 'तेङबोचे हुँदै उपत्यका झरेर नाम्चे — बाक्लो हावा, फेरि तातो पानी।',
  },
  ebc12: {
    en: 'The last trail day, down to Lukla; an evening with your guide and porters.',
    de: 'Der letzte Wandertag hinab nach Lukla; ein Abend mit Guide und Trägern.',
    ne: 'लुक्लासम्म अन्तिम पदयात्रा; गाइड र भरियासँग एक साँझ।',
  },
  ebc13: {
    en: 'Morning flight back to Kathmandu; an afternoon to rest.',
    de: 'Morgenflug zurück nach Kathmandu; ein Nachmittag zum Ausruhen.',
    ne: 'बिहानको उडानमा काठमाडौं फिर्ता; दिउँसो आराम।',
  },
  ebc14: {
    en: 'A spare day in case the Lukla flights wait for the weather — if not, Patan or Boudhanath.',
    de: 'Ein Puffertag, falls die Lukla-Flüge aufs Wetter warten — sonst Patan oder Boudhanath.',
    ne: 'लुक्लाको उडान मौसमले रोकिए जगेडा दिन — नत्र पाटन वा बौद्धनाथ।',
  },

  abc1: {
    en: 'Arrive in Pokhara: a walk along Phewa lake and a gear check with your guide.',
    de: 'Ankunft in Pokhara: ein Spaziergang am Phewa-See und Ausrüstungscheck mit eurem Guide.',
    ne: 'पोखरा आगमन: फेवा तालको किनार घुमाइ र गाइडसँग सामान जाँच।',
  },
  abc2: {
    en: 'A short drive into the hills, then up stone steps to Ghandruk, a Gurung village under Annapurna South and Machapuchare.',
    de: 'Kurze Fahrt in die Hügel, dann Steinstufen hinauf nach Ghandruk, ein Gurung-Dorf unter Annapurna Süd und Machapuchare.',
    ne: 'पहाडतिर छोटो यात्रा, अनि ढुङ्गे सिँढी चढेर अन्नपूर्ण दक्षिण र माछापुच्छ्रेमुनिको गुरुङ गाउँ घान्द्रुक।',
  },
  abc3: {
    en: 'Down to the Kimrong river and over the ridge to Chhomrong, the gateway to the sanctuary.',
    de: 'Hinab zum Kimrong-Fluss und über den Kamm nach Chhomrong, dem Tor zum Sanctuary.',
    ne: 'किम्रोङ खोलासम्म ओरालो, अनि डाँडा काटेर सेन्चुरीको प्रवेशद्वार छोमरोङ।',
  },
  abc4: {
    en: 'Down Chhomrong’s long stone staircase and up into the bamboo forest of the Modi Khola gorge.',
    de: 'Chhomrongs lange Steintreppe hinab und hinauf in den Bambuswald der Modi-Khola-Schlucht.',
    ne: 'छोमरोङको लामो ढुङ्गे सिँढी झरेर मोदी खोलाको गल्छीको बाँस जङ्गलतिर उकालो।',
  },
  abc5: {
    en: 'Through bamboo and rhododendron, past Dovan and Himalaya, up to Deurali.',
    de: 'Durch Bambus und Rhododendron, vorbei an Dovan und Himalaya, hinauf nach Deurali.',
    ne: 'बाँस र लालीगुराँसको वन, दोभान र हिमालय हुँदै देउरालीसम्म।',
  },
  abc6: {
    en: 'A short day into the sanctuary to Machapuchare Base Camp — keeping the climb gentle.',
    de: 'Ein kurzer Tag ins Sanctuary zum Machapuchare-Basislager — damit der Aufstieg sanft bleibt.',
    ne: 'सेन्चुरीभित्र छोटो दिन, माछापुच्छ्रे आधार शिविरसम्म — उकालो बिस्तारै।',
  },
  abc7: {
    en: 'Up to Annapurna Base Camp for sunrise inside a ring of peaks, then all the way down to Bamboo.',
    de: 'Hinauf zum Annapurna-Basislager, Sonnenaufgang im Ring der Gipfel, dann ganz hinab nach Bamboo.',
    ne: 'हिमालको घेराभित्र सूर्योदय हेर्न अन्नपूर्ण आधार शिविर, अनि बाम्बुसम्म ओरालो।',
  },
  abc8: {
    en: 'Back over to Chhomrong and down to Jhinu Danda — hot springs by the river.',
    de: 'Zurück nach Chhomrong und hinab nach Jhinu Danda — heiße Quellen am Fluss.',
    ne: 'छोमरोङ फर्केर झिनु डाँडा झर्ने — खोलाछेउ तातोपानी।',
  },
  abc9: { en: 'Walk out to the road and drive back to Pokhara.', de: 'Zur Straße hinauswandern und zurück nach Pokhara fahren.', ne: 'सडकसम्म हिँडेर गाडीमा पोखरा फर्किने।' },
  abc10: { en: 'Fly back to Kathmandu.', de: 'Rückflug nach Kathmandu.', ne: 'उडानमा काठमाडौं फिर्ता।' },

  poon1: {
    en: 'Drive from Pokhara to the trailhead, then along the Bhurungdi river to Tikhedhunga.',
    de: 'Fahrt von Pokhara zum Ausgangspunkt, dann am Bhurungdi-Fluss entlang nach Tikhedhunga.',
    ne: 'पोखराबाट पदमार्गको सुरुसम्म गाडी, अनि भुरुङ्दी खोलाछेउ तिखेढुंगासम्म।',
  },
  poon2: {
    en: 'The long stone staircase up to Ulleri, then rhododendron forest to Ghorepani.',
    de: 'Die lange Steintreppe hinauf nach Ulleri, dann durch Rhododendronwald nach Ghorepani.',
    ne: 'उल्लेरीसम्म लामो ढुङ्गे सिँढी, अनि लालीगुराँसको वन हुँदै घोरेपानी।',
  },
  poon3: {
    en: 'Up Poon Hill before dawn for sunrise over Dhaulagiri and Annapurna, back for breakfast, then along the ridge to Tadapani.',
    de: 'Vor der Dämmerung auf den Poon Hill, Sonnenaufgang über Dhaulagiri und Annapurna, zurück zum Frühstück, dann den Kamm entlang nach Tadapani.',
    ne: 'बिहान सबेरै पुनहिल चढेर धौलागिरि र अन्नपूर्णमा सूर्योदय, फर्केर बिहानको खाजा, अनि डाँडै-डाँडा ताडापानी।',
  },
  poon4: {
    en: 'Down through the forest to Ghandruk: Gurung houses, a small museum and tea with a view.',
    de: 'Durch den Wald hinab nach Ghandruk: Gurung-Häuser, ein kleines Museum und Tee mit Aussicht.',
    ne: 'वन हुँदै घान्द्रुक झर्ने: गुरुङ घर, सानो सङ्ग्रहालय र हिमाल हेर्दै चिया।',
  },
  poon5: { en: 'Walk down to the road and drive back to Pokhara.', de: 'Hinab zur Straße und zurück nach Pokhara.', ne: 'सडकसम्म झरेर गाडीमा पोखरा फर्किने।' },

  lt1: {
    en: 'Drive north from Kathmandu along the Trishuli to Syabrubesi.',
    de: 'Fahrt von Kathmandu nach Norden, am Trishuli entlang nach Syabrubesi.',
    ne: 'काठमाडौंबाट त्रिशूली किनारै उत्तर लागेर स्याब्रुबेसी।',
  },
  lt2: {
    en: 'Along the Langtang Khola through forest, with monkeys in the trees, to Lama Hotel.',
    de: 'Am Langtang Khola entlang durch den Wald, Affen in den Bäumen, bis Lama Hotel.',
    ne: 'लाङटाङ खोलाछेउ वनैवन, रूखमा बाँदर, लामा होटलसम्म।',
  },
  lt3: {
    en: 'The valley opens: yak pastures, prayer wheels and Langtang village, rebuilt after the 2015 earthquake.',
    de: 'Das Tal öffnet sich: Yakweiden, Gebetsmühlen und das Dorf Langtang, nach dem Erdbeben 2015 neu aufgebaut.',
    ne: 'उपत्यका खुल्छ: चौँरी खर्क, माने र २०१५ को भूकम्पपछि फेरि बनेको लाङटाङ गाउँ।',
  },
  lt4: {
    en: 'A short climb to Kyanjin Gompa: the monastery, the cheese factory and glaciers all around.',
    de: 'Ein kurzer Aufstieg nach Kyanjin Gompa: das Kloster, die Käserei und Gletscher ringsum.',
    ne: 'क्यान्जिन गुम्बासम्म छोटो उकालो: गुम्बा, चिज कारखाना र वरिपरि हिमनदी।',
  },
  lt5: {
    en: 'Rest day: up Kyanjin Ri for the view of Langtang Lirung, back down for the night.',
    de: 'Ruhetag: auf den Kyanjin Ri mit Blick auf den Langtang Lirung, zur Nacht wieder hinunter.',
    ne: 'विश्राम दिन: लाङटाङ लिरुङ हेर्न क्यान्जिन री चढ्ने, रातका लागि फेरि तल।',
  },
  lt6: { en: 'All the way back down the valley to Lama Hotel.', de: 'Das ganze Tal zurück hinab bis Lama Hotel.', ne: 'उपत्यकाभरि ओरालो, लामा होटलसम्म।' },
  lt7: {
    en: 'Down to Syabrubesi; a last evening by the river.',
    de: 'Hinab nach Syabrubesi; ein letzter Abend am Fluss.',
    ne: 'स्याब्रुबेसी झर्ने; खोलाछेउ अन्तिम साँझ।',
  },
  lt8: { en: 'Drive back to Kathmandu.', de: 'Rückfahrt nach Kathmandu.', ne: 'गाडीमा काठमाडौं फिर्ता।' },

  fam1: {
    en: 'Arrive in Kathmandu — family at the airport, dal bhat at home.',
    de: 'Ankunft in Kathmandu — die Familie am Flughafen, Dal Bhat zu Hause.',
    ne: 'काठमाडौं आगमन — विमानस्थलमा परिवार, घरमा दालभात।',
  },
  fam2: {
    en: 'Pashupatinath by the Bagmati, then an evening walk round Boudhanath.',
    de: 'Pashupatinath an der Bagmati, abends eine Runde um Boudhanath.',
    ne: 'बागमती किनारको पशुपतिनाथ, साँझ बौद्धनाथको परिक्रमा।',
  },
  fam3: {
    en: 'A day in Bhaktapur: Durbar Square, the potters’ square and juju dhau.',
    de: 'Ein Tag in Bhaktapur: Durbar Square, der Töpferplatz und Juju Dhau.',
    ne: 'भक्तपुरमा एक दिन: दरबार क्षेत्र, कुमाल टोल र जुजु धौ।',
  },
  fam4: {
    en: 'Drive down to Chitwan; sunset by the Rapti river.',
    de: 'Fahrt hinunter nach Chitwan; Sonnenuntergang am Rapti.',
    ne: 'गाडीमा चितवन झर्ने; राप्ती किनारमा सूर्यास्त।',
  },
  fam5: {
    en: 'A canoe on the Rapti, a jungle walk with a naturalist and a Tharu village — rhinos if you are lucky.',
    de: 'Im Kanu auf dem Rapti, eine Dschungelwanderung mit Naturführer und ein Tharu-Dorf — mit Glück Nashörner.',
    ne: 'राप्तीमा डुङ्गा, प्रकृतिविद्सँग जङ्गल हिँडाइ र थारु गाउँ — भाग्यले साथ दिए गैंडा।',
  },
  fam6: {
    en: 'Drive up to Pokhara; an evening by Phewa lake.',
    de: 'Fahrt hinauf nach Pokhara; ein Abend am Phewa-See.',
    ne: 'गाडीमा पोखरा; फेवा तालछेउ साँझ।',
  },
  fam7: {
    en: 'A boat to the Tal Barahi temple, up to the Peace Pagoda, the lakeside at night.',
    de: 'Mit dem Boot zum Tal-Barahi-Tempel, hinauf zur Friedenspagode, abends die Seepromenade.',
    ne: 'डुङ्गामा तालबाराही मन्दिर, शान्ति स्तूपासम्म उकालो, राति तालको किनार।',
  },
  fam8: {
    en: 'A short drive and walk up to a village homestay in Dhampus — Annapurna from the terrace.',
    de: 'Kurze Fahrt und ein Aufstieg zu einem Homestay in Dhampus — die Annapurna von der Terrasse.',
    ne: 'छोटो यात्रा र हिँडाइपछि धम्पुसको होमस्टे — आँगनबाटै अन्नपूर्ण।',
  },
  fam9: {
    en: 'Sunrise on the mountains, walk down and back to Pokhara.',
    de: 'Sonnenaufgang an den Bergen, Abstieg und zurück nach Pokhara.',
    ne: 'हिमालमा सूर्योदय, ओरालो झरेर पोखरा फर्किने।',
  },
  fam10: {
    en: 'Fly back to Kathmandu (or a long day on the road).',
    de: 'Rückflug nach Kathmandu (oder ein langer Tag auf der Straße).',
    ne: 'उडानमा काठमाडौं फिर्ता (वा सडकमा लामो दिन)।',
  },
  fam11: {
    en: 'A family day: Asan bazaar, a puja and time with the grandparents.',
    de: 'Ein Familientag: der Asan-Basar, eine Puja und Zeit mit den Großeltern.',
    ne: 'परिवारसँगको दिन: असन बजार, पूजा र हजुरबा-हजुरआमासँग समय।',
  },
  fam12: { en: 'A last breakfast together, then the airport.', de: 'Ein letztes gemeinsames Frühstück, dann zum Flughafen.', ne: 'सँगै अन्तिम बिहानको खाजा, अनि विमानस्थल।' },

  lum1: {
    en: 'Arrive in Kathmandu; Swayambhunath at sunset.',
    de: 'Ankunft in Kathmandu; Swayambhunath bei Sonnenuntergang.',
    ne: 'काठमाडौं आगमन; सूर्यास्तमा स्वयम्भूनाथ।',
  },
  lum2: {
    en: 'The kora round Boudhanath with butter lamps, and a monastery visit.',
    de: 'Die Kora um Boudhanath mit Butterlampen und ein Klosterbesuch.',
    ne: 'बत्ती बाल्दै बौद्धनाथको परिक्रमा र गुम्बा भ्रमण।',
  },
  lum3: { en: 'Fly to Bhairahawa and drive on to Lumbini.', de: 'Flug nach Bhairahawa und weiter nach Lumbini.', ne: 'भैरहवासम्म उडान, अनि लुम्बिनी।' },
  lum4: {
    en: 'The Sacred Garden: the Maya Devi Temple, the Ashoka pillar and the pond; monasteries built by many countries.',
    de: 'Der Heilige Garten: Maya-Devi-Tempel, die Ashoka-Säule und der Teich; Klöster aus vielen Ländern.',
    ne: 'पवित्र उद्यान: मायादेवी मन्दिर, अशोक स्तम्भ र पोखरी; धेरै देशले बनाएका गुम्बा।',
  },
  lum5: {
    en: 'A day trip to Tilaurakot, the palace of old Kapilvastu, and back.',
    de: 'Ein Tagesausflug nach Tilaurakot, zum Palast des alten Kapilvastu, und zurück.',
    ne: 'पुरानो कपिलवस्तुको दरबार तिलौराकोटसम्म दिनभरको भ्रमण।',
  },
  lum6: { en: 'Fly back to Kathmandu.', de: 'Rückflug nach Kathmandu.', ne: 'उडानमा काठमाडौं फिर्ता।' },
};

export const LODGE_NAME: Record<Lodge, L> = {
  hotel: { en: 'Hotel', de: 'Hotel', ne: 'होटल' },
  teahouse: { en: 'Teahouse', de: 'Teehaus', ne: 'टी-हाउस (लज)' },
  homestay: { en: 'Homestay', de: 'Homestay', ne: 'होमस्टे' },
  lodge: { en: 'Jungle lodge', de: 'Dschungel-Lodge', ne: 'जङ्गल लज' },
};
export const MODE_NAME: Record<Mode, L> = {
  arrive: { en: 'Arrival', de: 'Ankunft', ne: 'आगमन' },
  walk: { en: 'On foot', de: 'Zu Fuß', ne: 'पैदल' },
  drive: { en: 'By road', de: 'Auf der Straße', ne: 'सडकबाट' },
  fly: { en: 'Flight', de: 'Flug', ne: 'उडान' },
  rest: { en: 'Rest day', de: 'Ruhetag', ne: 'विश्राम दिन' },
  visit: { en: 'Day out', de: 'Ausflugstag', ne: 'घुमघाम' },
};

// ---------------------------------------------------------------- packing, permits, festivals

export const PACK_GROUP_NAME: Record<PackGroup, L> = {
  papers: { en: 'Papers', de: 'Papiere', ne: 'कागजात' },
  clothes: { en: 'Clothes', de: 'Kleidung', ne: 'लुगा' },
  gear: { en: 'Gear', de: 'Ausrüstung', ne: 'सामान' },
  health: { en: 'Health', de: 'Gesundheit', ne: 'स्वास्थ्य' },
  extras: { en: 'Extras', de: 'Extras', ne: 'अरू' },
};
export const PACK_TEXT: Record<PackId, L> = {
  passport: {
    en: 'Passport (valid 6 months+) and visa papers',
    de: 'Reisepass (noch 6+ Monate gültig) und Visumsunterlagen',
    ne: 'राहदानी (६ महिनाभन्दा बढी म्याद) र भिसाका कागज',
  },
  insurance: {
    en: 'Travel insurance that covers trekking to your highest point',
    de: 'Reiseversicherung, die Trekking bis zum höchsten Punkt abdeckt',
    ne: 'सबैभन्दा अग्लो ठाउँसम्मको पदयात्रा समेट्ने यात्रा बीमा',
  },
  photos: { en: 'Passport photos for the permits', de: 'Passfotos für die Permits', ne: 'अनुमतिपत्रका लागि पासपोर्ट साइज फोटो' },
  itinerary: { en: 'This itinerary, printed or on your phone', de: 'Diesen Reiseplan, ausgedruckt oder auf dem Handy', ne: 'यो यात्रा तालिका, छापेर वा फोनमा' },
  adapter: { en: 'Plug adapter (Nepal uses round-pin sockets)', de: 'Steckdosenadapter (Nepal hat Rundstecker-Dosen)', ne: 'प्लग एडाप्टर (नेपालमा गोलो पिनका सकेट)' },
  layers: { en: 'Wicking base layers (merino or synthetic)', de: 'Funktionsunterwäsche (Merino oder Synthetik)', ne: 'पसिना सोस्ने भित्री लुगा (मेरिनो वा सिन्थेटिक)' },
  trousers: { en: 'Trekking trousers', de: 'Trekkinghose', ne: 'पदयात्रा पाइन्ट' },
  fleece: { en: 'Fleece or warm mid-layer', de: 'Fleece oder warme Zwischenschicht', ne: 'फ्लिस वा न्यानो बीचको तह' },
  shell: { en: 'Waterproof, windproof jacket', de: 'Wasser- und winddichte Jacke', ne: 'पानी र हावा नछिर्ने ज्याकेट' },
  down: { en: 'Down jacket for the evenings', de: 'Daunenjacke für die Abende', ne: 'साँझका लागि डाउन ज्याकेट' },
  warmhat: { en: 'Warm hat', de: 'Warme Mütze', ne: 'न्यानो टोपी' },
  gloves: { en: 'Gloves', de: 'Handschuhe', ne: 'पन्जा' },
  light: { en: 'Light, breathable clothes for the heat', de: 'Leichte, luftige Kleidung für die Hitze', ne: 'गर्मीका लागि हलुका, हावा छिर्ने लुगा' },
  sunhat: { en: 'Sun hat', de: 'Sonnenhut', ne: 'घाम छेक्ने टोपी' },
  quickdry: {
    en: 'Quick-dry clothes (it rains most afternoons)',
    de: 'Schnell trocknende Kleidung (fast jeden Nachmittag Regen)',
    ne: 'छिटो सुक्ने लुगा (प्रायः दिउँसो पानी पर्छ)',
  },
  neutral: {
    en: 'Clothes in muted greens and browns for jungle walks',
    de: 'Kleidung in gedeckten Grün- und Brauntönen für den Dschungel',
    ne: 'जङ्गल हिँडाइका लागि हरियो-खैरो रङका लुगा',
  },
  modest: { en: 'Clothes that cover shoulders and knees for temples', de: 'Kleidung, die Schultern und Knie bedeckt, für Tempel', ne: 'मन्दिरका लागि काँध र घुँडा ढाक्ने लुगा' },
  sandals: { en: 'Sandals', de: 'Sandalen', ne: 'चप्पल / स्यान्डल' },
  boots: { en: 'Broken-in trekking boots', de: 'Eingelaufene Trekkingschuhe', ne: 'पहिल्यै लगाएर बानी परेका पदयात्रा जुत्ता' },
  poles: { en: 'Trekking poles (knees will thank you on the way down)', de: 'Trekkingstöcke (die Knie danken es beim Abstieg)', ne: 'हाइकिङ लौरो (ओरालोमा घुँडालाई सजिलो)' },
  daypack: { en: 'Daypack, 25–35 litres', de: 'Tagesrucksack, 25–35 Liter', ne: '२५–३५ लिटरको सानो झोला' },
  duffel: { en: 'Duffel bag for the porter', de: 'Seesack für den Träger', ne: 'भरियाका लागि डफल झोला' },
  softbag: {
    en: 'A soft bag: small planes to Lukla have a weight limit — the agency tells you how much',
    de: 'Eine weiche Tasche: Die kleinen Flugzeuge nach Lukla haben ein Gewichtslimit — die Agentur sagt euch, wie viel',
    ne: 'नरम झोला: लुक्ला जाने साना विमानमा तौलको सीमा हुन्छ — कति भन्ने एजेन्सीले बताउँछ',
  },
  sleepingbag: {
    en: 'Warm sleeping bag (teahouse rooms are not heated)',
    de: 'Warmer Schlafsack (Teehaus-Zimmer sind nicht beheizt)',
    ne: 'न्यानो स्लिपिङ ब्याग (लजका कोठा तताइँदैनन्)',
  },
  headtorch: { en: 'Head torch and spare batteries', de: 'Stirnlampe und Ersatzbatterien', ne: 'हेड टर्च र थप ब्याट्री' },
  bottle: { en: 'Refillable water bottle', de: 'Wiederbefüllbare Trinkflasche', ne: 'फेरि भर्न मिल्ने पानीको बोतल' },
  raincover: { en: 'Rain cover for your pack', de: 'Regenhülle für den Rucksack', ne: 'झोलाको पानी छेक्ने खोल' },
  umbrella: { en: 'Small umbrella', de: 'Kleiner Regenschirm', ne: 'सानो छाता' },
  spikes: { en: 'Microspikes for icy trails', de: 'Grödel für vereiste Wege', ne: 'हिउँ-बरफका बाटोका लागि माइक्रोस्पाइक' },
  powerbank: { en: 'Power bank (charging gets scarce higher up)', de: 'Powerbank (Laden wird weiter oben knapp)', ne: 'पावर बैंक (माथि चार्ज गर्न गाह्रो)' },
  binoculars: { en: 'Binoculars for birds and rhinos', de: 'Fernglas für Vögel und Nashörner', ne: 'चरा र गैंडा हेर्न दुरबिन' },
  firstaid: { en: 'Small first-aid kit and your own medicines', de: 'Kleine Reiseapotheke und eure eigenen Medikamente', ne: 'सानो प्राथमिक उपचार किट र आफ्नै औषधि' },
  purify: { en: 'Water purification tablets or a filter', de: 'Wasserentkeimungstabletten oder ein Filter', ne: 'पानी शुद्ध पार्ने चक्की वा फिल्टर' },
  sunscreen: { en: 'Sunscreen, high factor', de: 'Sonnencreme mit hohem Schutzfaktor', ne: 'उच्च सुरक्षाको सनस्क्रिन' },
  sunglasses: { en: 'Sunglasses with UV protection', de: 'Sonnenbrille mit UV-Schutz', ne: 'युभी जोगाउने चस्मा' },
  lipbalm: { en: 'Lip balm with sun protection', de: 'Lippenpflege mit Sonnenschutz', ne: 'घामबाट जोगाउने लिप बाम' },
  altitude: {
    en: 'Ask your doctor about altitude before you go',
    de: 'Vorher mit eurer Ärztin oder eurem Arzt über die Höhe sprechen',
    ne: 'जानुअघि उचाइबारे आफ्नो डाक्टरसँग सल्लाह',
  },
  repellent: { en: 'Insect repellent', de: 'Insektenschutz', ne: 'लामखुट्टे भगाउने मलम' },
  leech: { en: 'Leech socks (the monsoon brings them out)', de: 'Blutegel-Socken (der Monsun lockt sie heraus)', ne: 'जुका छेक्ने मोजा (बर्खामा जुका धेरै)' },
  blister: { en: 'Blister plasters', de: 'Blasenpflaster', ne: 'फोका टाँस्ने प्लास्टर' },
  snacks: { en: 'Snacks from home for long days', de: 'Snacks von zu Hause für lange Tage', ne: 'लामो दिनका लागि घरबाटै खाजा' },
  tissue: { en: 'Tissues and hand sanitiser', de: 'Taschentücher und Handdesinfektion', ne: 'टिस्यु र ह्यान्ड स्यानिटाइजर' },
  slipons: {
    en: 'Shoes that slip off easily for temples and homes',
    de: 'Schuhe, die man an Tempeln und zu Hause schnell auszieht',
    ne: 'मन्दिर र घरमा सजिलै फुकाल्न मिल्ने जुत्ता',
  },
  gifts: { en: 'Small gifts from home for the family', de: 'Kleine Geschenke von zu Hause für die Familie', ne: 'परिवारका लागि घरबाट साना उपहार' },
  prints: { en: 'Printed photos for the grandparents', de: 'Ausgedruckte Fotos für die Großeltern', ne: 'हजुरबा-हजुरआमाका लागि छापिएका फोटो' },
};

export const PERMIT_TEXT: Record<PermitId, { name: L; line: L }> = {
  visa: {
    name: { en: 'Visa', de: 'Visum', ne: 'भिसा' },
    line: {
      en: 'Many passports get a visa on arrival — check the current rules for yours. Nepali passport holders don’t need one.',
      de: 'Viele Pässe bekommen das Visum bei der Ankunft — prüft die aktuellen Regeln für euren Pass. Mit nepalischem Pass braucht ihr keins.',
      ne: 'धेरै देशका राहदानीमा आगमनमै भिसा पाइन्छ — आफ्नो राहदानीको हालको नियम हेर्नुहोस्। नेपाली राहदानी भएकालाई चाहिँदैन।',
    },
  },
  guide: {
    name: { en: 'A licensed guide', de: 'Ein lizenzierter Guide', ne: 'इजाजतप्राप्त गाइड' },
    line: {
      en: 'Most trekking areas now ask foreign trekkers to walk with a licensed guide; the agency arranges one.',
      de: 'In den meisten Trekkinggebieten müssen ausländische Trekker inzwischen mit lizenziertem Guide gehen; die Agentur organisiert das.',
      ne: 'अधिकांश पदयात्रा क्षेत्रमा अब विदेशी पदयात्रीले इजाजतप्राप्त गाइडसँगै हिँड्नुपर्छ; एजेन्सीले मिलाउँछ।',
    },
  },
  sagarmatha: {
    name: { en: 'Sagarmatha National Park permit', de: 'Permit für den Sagarmatha-Nationalpark', ne: 'सगरमाथा राष्ट्रिय निकुञ्ज अनुमतिपत्र' },
    line: { en: 'Checked at the park gate in Monjo.', de: 'Wird am Parktor in Monjo kontrolliert.', ne: 'मोन्जोको निकुञ्ज गेटमा जाँचिन्छ।' },
  },
  khumbu: {
    name: { en: 'Khumbu local area permit', de: 'Permit der Gemeinde Khumbu', ne: 'खुम्बु स्थानीय क्षेत्र अनुमतिपत्र' },
    line: {
      en: 'The local municipality’s permit for the Everest trail, checked near Lukla.',
      de: 'Das Permit der Gemeinde für den Everest-Weg, kontrolliert bei Lukla.',
      ne: 'सगरमाथा पदमार्गका लागि गाउँपालिकाको अनुमतिपत्र, लुक्लानजिक जाँचिन्छ।',
    },
  },
  acap: {
    name: { en: 'Annapurna Conservation Area permit (ACAP)', de: 'Permit für das Annapurna-Schutzgebiet (ACAP)', ne: 'अन्नपूर्ण संरक्षण क्षेत्र अनुमतिपत्र (एक्याप)' },
    line: {
      en: 'For Poon Hill, the sanctuary, Mustang and the villages around them.',
      de: 'Für Poon Hill, das Sanctuary, Mustang und die Dörfer ringsum.',
      ne: 'पुनहिल, सेन्चुरी, मुस्ताङ र वरपरका गाउँका लागि।',
    },
  },
  upperMustang: {
    name: { en: 'Restricted area permit for Upper Mustang', de: 'Sondergenehmigung für Upper Mustang', ne: 'माथिल्लो मुस्ताङ विशेष क्षेत्र अनुमतिपत्र' },
    line: {
      en: 'Only through a registered agency, with a guide and at least two trekkers.',
      de: 'Nur über eine registrierte Agentur, mit Guide und mindestens zwei Trekkern.',
      ne: 'दर्ता भएको एजेन्सीमार्फत मात्र, गाइडसहित र कम्तीमा दुई जना।',
    },
  },
  langtangNp: {
    name: { en: 'Langtang National Park permit', de: 'Permit für den Langtang-Nationalpark', ne: 'लाङटाङ राष्ट्रिय निकुञ्ज अनुमतिपत्र' },
    line: { en: 'Checked on the road in and on the trail.', de: 'Wird auf der Anfahrt und auf dem Weg kontrolliert.', ne: 'जाने सडक र पदमार्गमा जाँचिन्छ।' },
  },
  tims: {
    name: { en: 'Trekkers’ information card (TIMS)', de: 'Trekker-Informationskarte (TIMS)', ne: 'पदयात्री सूचना कार्ड (टिम्स)' },
    line: {
      en: 'Asked for in some areas; the agency checks where your route needs it.',
      de: 'In manchen Gebieten verlangt; die Agentur prüft, wo eure Route sie braucht.',
      ne: 'केही क्षेत्रमा चाहिन्छ; तपाईंको बाटोमा कहाँ चाहिन्छ भनेर एजेन्सीले हेर्छ।',
    },
  },
  raraNp: {
    name: { en: 'Rara National Park permit', de: 'Permit für den Rara-Nationalpark', ne: 'रारा राष्ट्रिय निकुञ्ज अनुमतिपत्र' },
    line: { en: 'For the lake and the park around it.', de: 'Für den See und den Park ringsum.', ne: 'ताल र वरपरको निकुञ्जका लागि।' },
  },
  chitwanNp: {
    name: { en: 'Chitwan National Park entry', de: 'Eintritt in den Chitwan-Nationalpark', ne: 'चितवन राष्ट्रिय निकुञ्ज प्रवेश' },
    line: {
      en: 'For jungle walks and canoe trips inside the park; your lodge sorts it out.',
      de: 'Für Dschungelwanderungen und Kanufahrten im Park; eure Lodge kümmert sich darum.',
      ne: 'निकुञ्जभित्र जङ्गल हिँडाइ र डुङ्गा सयरका लागि; लजले मिलाउँछ।',
    },
  },
  lumbiniSite: {
    name: { en: 'Lumbini: no trekking permit', de: 'Lumbini: kein Trekking-Permit', ne: 'लुम्बिनी: पदयात्रा अनुमतिपत्र चाहिँदैन' },
    line: {
      en: 'Dress for temples and take your shoes off where asked.',
      de: 'Tempelgerechte Kleidung, Schuhe aus, wo darum gebeten wird.',
      ne: 'मन्दिरअनुसारको पहिरन, भनिएको ठाउँमा जुत्ता फुकाल्नुहोस्।',
    },
  },
};

export const FESTIVAL_TEXT: Record<FestivalId, { name: L; line: L }> = {
  dashain: {
    name: { en: 'Dashain', de: 'Dashain', ne: 'दशैँ' },
    line: {
      en: 'Nepal’s biggest festival, usually in October: families gather, offices close, buses and flights fill up.',
      de: 'Nepals größtes Fest, meist im Oktober: Familien kommen zusammen, Ämter schließen, Busse und Flüge sind voll.',
      ne: 'नेपालको सबैभन्दा ठूलो चाड, प्रायः असोज-कात्तिकमा: परिवार भेला हुन्छ, कार्यालय बन्द, बस र उडान भरिन्छन्।',
    },
  },
  tihar: {
    name: { en: 'Tihar', de: 'Tihar', ne: 'तिहार' },
    line: {
      en: 'The festival of lights, usually late October or November: oil lamps, marigolds and sel roti.',
      de: 'Das Lichterfest, meist Ende Oktober oder im November: Öllampen, Tagetes und Sel Roti.',
      ne: 'उज्यालोको चाड, प्रायः कात्तिकमा: दियो, सयपत्री र सेलरोटी।',
    },
  },
  holi: {
    name: { en: 'Holi', de: 'Holi', ne: 'होली' },
    line: {
      en: 'The festival of colours in March — expect to get painted in town.',
      de: 'Das Fest der Farben im März — in der Stadt wird man bunt.',
      ne: 'फागुनमा रङको चाड — सहरमा रङ लाग्ने पक्का।',
    },
  },
  buddha: {
    name: { en: 'Buddha Jayanti', de: 'Buddha Jayanti', ne: 'बुद्ध जयन्ती' },
    line: {
      en: 'The Buddha’s birthday, usually in May — Lumbini at its busiest and most festive.',
      de: 'Buddhas Geburtstag, meist im Mai — Lumbini ist dann am vollsten und festlichsten.',
      ne: 'बुद्धको जन्मोत्सव, प्रायः वैशाखमा — लुम्बिनी सबैभन्दा रमाइलो र भीडभाडमा।',
    },
  },
  maniRimdu: {
    name: { en: 'Mani Rimdu', de: 'Mani Rimdu', ne: 'मणि रिम्दु' },
    line: {
      en: 'Masked dances at Tengboche monastery, usually October or November.',
      de: 'Maskentänze im Kloster Tengboche, meist im Oktober oder November.',
      ne: 'तेङबोचे गुम्बामा मुकुण्डो नाच, प्रायः कात्तिक-मङ्सिरमा।',
    },
  },
  tiji: {
    name: { en: 'Tiji', de: 'Tiji', ne: 'तिजी' },
    line: {
      en: 'Three days of masked dances in Lo Manthang, usually in May.',
      de: 'Drei Tage Maskentänze in Lo Manthang, meist im Mai.',
      ne: 'लोमान्थाङमा तीन दिनको मुकुण्डो नाच, प्रायः वैशाख-जेठमा।',
    },
  },
};

// ---------------------------------------------------------------- the planner's words

export type Copy = {
  langLabel: string;
  tagline: string;
  madeUp: string;
  pickH: string;
  tripsLabel: string;
  daysN: (n: string) => string;
  yourVersion: string;
  backToOriginal: string;
  sum: {
    days: string;
    walkDays: string;
    onFoot: string;
    hours: string;
    maxSleep: string;
    maxTop: string;
  };
  mapH: string;
  mapLabel: (trip: string) => string;
  mapHelp: string;
  zoomIn: string;
  zoomOut: string;
  fitRoute: string;
  wholeNepal: string;
  legendRoute: string;
  legendSide: string;
  legendPeak: string;
  addH: string;
  addLabel: string;
  addBtn: (n: string) => string;
  addHint: string;
  placeAdd: string;
  placeClose: string;
  daysH: string;
  dayN: (n: string) => string;
  leg: (from: string, to: string) => string;
  restIn: (p: string) => string;
  dayIn: (p: string) => string;
  arriveIn: (p: string) => string;
  viaWord: string;
  sideWord: string;
  walkH: (h: string) => string;
  driveH: (h: string) => string;
  flyH: (h: string) => string;
  km: (n: string) => string;
  airKm: (n: string) => string;
  sleepAt: (m: string) => string;
  topAt: (m: string) => string;
  estimated: string;
  moveUp: (n: string) => string;
  moveDown: (n: string) => string;
  drag: (n: string) => string;
  another: string;
  anotherLabel: (n: string) => string;
  remove: (n: string) => string;
  showOnMap: (p: string) => string;
  emptyDays: string;
  profileH: string;
  profileLabel: (trip: string, max: string) => string;
  profileSleep: string;
  profileTop: string;
  profileLow: string;
  profileDay: string;
  profileTable: string;
  profilePoint: (n: string, place: string, sleep: string) => string;
  ruleH: string;
  ruleTag: string;
  rules: string[];
  ruleOk: string;
  warnGain: (day: string, place: string, gain: string, eased: boolean) => string;
  warnRest: (day: string, place: string, streak: string) => string;
  feelBad: string;
  seasonH: string;
  seasonSub: (trip: string) => string;
  score: string[];
  monthsShort: string[];
  months: string[];
  startLabel: string;
  startIs: (month: string, score: string) => string;
  best: (months: string) => string;
  festivalsH: string;
  festivalNote: string;
  seasonNotes: { monsoon: string; mustang: string; lowland: string };
  peopleLabel: string;
  packH: string;
  packSub: (month: string) => string;
  packed: (x: string, y: string) => string;
  untick: string;
  permitsH: string;
  permitsNote: string;
  enquiryH: string;
  enquiryP: string;
  fName: string;
  fContact: string;
  fNote: string;
  fNoteHint: string;
  build: string;
  sentH: string;
  sentP: string;
  copy: string;
  copied: string;
  edit: string;
  printBtn: string;
  icsBtn: string;
  icsDone: string;
  printTitle: (trip: string) => string;
  printFoot: string;
  howH: string;
  how: string[];
  reset: string;
  resetDone: string;
  moved: (n: string, to: string) => string;
  removed: (n: string) => string;
  added: (place: string, n: string) => string;
  restAdded: (place: string) => string;
  tripLoaded: (trip: string) => string;
  maxDays: string;
  summary: {
    head: string;
    trip: string;
    start: string;
    days: string;
    people: string;
    name: string;
    contact: string;
    note: string;
    flagged: string;
    none: string;
  };
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_NE = ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'];

export const COPY: Record<Lang, Copy> = {
  en: {
    langLabel: 'Language',
    tagline: 'Treks and family trips in Nepal — planned day by day, on a map.',
    madeUp: 'Yatri Treks is a made-up agency for this demo. Altitudes are the usual round figures; nothing you enter leaves this browser.',
    pickH: 'Pick a trip',
    tripsLabel: 'Ready trips',
    daysN: (n) => `${n} days`,
    yourVersion: 'your version',
    backToOriginal: 'Back to the original trip',
    sum: { days: 'days', walkDays: 'walking days', onFoot: 'km on foot', hours: 'hours walking', maxSleep: 'highest night', maxTop: 'highest point' },
    mapH: 'The route',
    mapLabel: (trip) => `Map of Nepal with the route of ${trip}`,
    mapHelp: 'Drag to move · wheel, pinch or + − to zoom · on the focused map: arrow keys, + − and 0',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitRoute: 'Fit the route',
    wholeNepal: 'All of Nepal',
    legendRoute: 'Route',
    legendSide: 'There and back',
    legendPeak: 'Big peaks',
    addH: 'Add a night',
    addLabel: 'Place',
    addBtn: (n) => `Add as day ${n}`,
    addHint: 'Or tap a place on the map.',
    placeAdd: 'Add as the next night',
    placeClose: 'Close',
    daysH: 'Day by day',
    dayN: (n) => `Day ${n}`,
    leg: (from, to) => `${from} → ${to}`,
    restIn: (p) => `Rest day in ${p}`,
    dayIn: (p) => `A day in ${p}`,
    arriveIn: (p) => `Arrive in ${p}`,
    viaWord: 'via',
    sideWord: 'up to',
    walkH: (h) => `${h} h walking`,
    driveH: (h) => `${h} h by road`,
    flyH: (h) => `${h} h flight`,
    km: (n) => `${n} km`,
    airKm: (n) => `${n} km by air`,
    sleepAt: (m) => `sleep at ${m} m`,
    topAt: (m) => `highest ${m} m`,
    estimated: 'estimated from the map — the day was moved or added',
    moveUp: (n) => `Move day ${n} up`,
    moveDown: (n) => `Move day ${n} down`,
    drag: (n) => `Drag day ${n} to reorder`,
    another: 'Another night here',
    anotherLabel: (n) => `Add another night after day ${n}`,
    remove: (n) => `Remove day ${n}`,
    showOnMap: (p) => `Show ${p} on the map`,
    emptyDays: 'Add your first place from the list or the map.',
    profileH: 'Altitude profile',
    profileLabel: (trip, max) => `Altitude profile of ${trip}: sleeping altitude per day, highest night ${max} m`,
    profileSleep: 'Sleeping altitude',
    profileTop: 'Highest point of the day',
    profileLow: 'This trip stays low — no altitude to plan around.',
    profileDay: 'Day',
    profileTable: 'Show as a table',
    profilePoint: (n, place, sleep) => `Day ${n}, ${place}, sleep at ${sleep} m`,
    ruleH: 'Acclimatisation check',
    ruleTag: 'General guidance, not medical advice',
    rules: [
      'Above 3,000 m, don’t sleep more than 500 m higher than the night before (the part below 3,000 m doesn’t count).',
      'Above 3,000 m, take a rest day — a night no higher than the one before — at least every third night.',
    ],
    ruleOk: 'No days flagged by the rule.',
    warnGain: (day, place, gain, eased) =>
      `Day ${day}, ${place}: ${gain} m higher than the night before.${eased ? ' A rest day follows — go slowly.' : ' Add a night in between or a rest day after.'}`,
    warnRest: (day, place, streak) => `Day ${day}, ${place}: night ${streak} in a row climbing above 3,000 m — time for a rest day.`,
    feelBad: 'Headache, nausea, no appetite? Go no higher. If it gets worse, go down. Your guide watches for this too.',
    seasonH: 'Best time to go',
    seasonSub: (trip) => `How each month suits ${trip}`,
    score: ['Monsoon or closed', 'Fair', 'Good', 'Best'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    months: MONTHS_EN,
    startLabel: 'Start date',
    startIs: (month, score) => `You start in ${month}: ${score}.`,
    best: (months) => `Best: ${months}.`,
    festivalsH: 'Festivals on the way',
    festivalNote: 'Festival dates follow the lunar calendar and move every year.',
    seasonNotes: {
      monsoon: 'June to September is the monsoon: rain most afternoons, clouds over the peaks, leeches on forest trails and landslides on the roads.',
      mustang: 'Mustang lies in the rain shadow behind the Annapurnas — it stays mostly dry in the monsoon, but winter there is bitter.',
      lowland: 'Kathmandu, Pokhara, Chitwan and Lumbini are hot in April and May; October to March is cool and clear.',
    },
    peopleLabel: 'People',
    packH: 'Packing list',
    packSub: (month) => `For this trip in ${month}. Ticks stay in this browser.`,
    packed: (x, y) => `${x} of ${y} packed`,
    untick: 'Untick all',
    permitsH: 'Permits & papers',
    permitsNote: 'Rules change: the agency checks the current permits and papers for your dates. This list is a starting point, not official advice.',
    enquiryH: 'Send this trip to the agency',
    enquiryP: 'Builds a summary of your days for the agency. In this demo nothing is sent.',
    fName: 'Your name',
    fContact: 'Email or phone',
    fNote: 'Anything we should know?',
    fNoteHint: 'E.g. travelling with grandparents, first trek, a birthday on the way…',
    build: 'Prepare my enquiry',
    sentH: 'Ready — and nothing was sent',
    sentP: 'On a real agency site this would land in their inbox, and they would write back about dates and guides. Here it stays on your screen.',
    copy: 'Copy the text',
    copied: 'Copied',
    edit: 'Change something',
    printBtn: 'Print the itinerary',
    icsBtn: 'Add to calendar (.ics)',
    icsDone: 'Calendar file saved — one event per day.',
    printTitle: (trip) => `${trip} — itinerary`,
    printFoot: 'Yatri Treks is a made-up agency · demo built by MartNepali · general guidance, not medical advice',
    howH: 'How this demo works',
    how: [
      'Everything runs in your browser; your trip is kept on this device only.',
      'Altitudes and distances are rounded and for planning only.',
      'The acclimatisation check is a simple rule, not medical advice.',
      'Made for agencies: ready trips, a map, the season and an enquiry on one page.',
    ],
    reset: 'Reset demo',
    resetDone: 'Demo reset.',
    moved: (n, to) => `Day ${n} is now day ${to}.`,
    removed: (n) => `Day ${n} removed.`,
    added: (place, n) => `${place} added as day ${n}.`,
    restAdded: (place) => `Another night in ${place}.`,
    tripLoaded: (trip) => `${trip} loaded.`,
    maxDays: 'That’s the longest trip this planner holds.',
    summary: {
      head: 'Trip enquiry — Yatri Treks',
      trip: 'Trip',
      start: 'Start',
      days: 'Days',
      people: 'People',
      name: 'Name',
      contact: 'Contact',
      note: 'Note',
      flagged: 'Days flagged by the acclimatisation check',
      none: 'none',
    },
  },
  de: {
    langLabel: 'Sprache',
    tagline: 'Treks und Familienreisen in Nepal — Tag für Tag geplant, auf der Karte.',
    madeUp: 'Yatri Treks ist eine erfundene Agentur für diese Demo. Höhen sind die üblichen runden Werte; nichts, was ihr eingebt, verlässt diesen Browser.',
    pickH: 'Reise wählen',
    tripsLabel: 'Fertige Reisen',
    daysN: (n) => `${n} Tage`,
    yourVersion: 'eure Version',
    backToOriginal: 'Zurück zur Originalreise',
    sum: { days: 'Tage', walkDays: 'Wandertage', onFoot: 'km zu Fuß', hours: 'Stunden Gehzeit', maxSleep: 'höchste Nacht', maxTop: 'höchster Punkt' },
    mapH: 'Die Route',
    mapLabel: (trip) => `Karte von Nepal mit der Route: ${trip}`,
    mapHelp: 'Ziehen zum Verschieben · Mausrad, zwei Finger oder + − zum Zoomen · auf der fokussierten Karte: Pfeiltasten, + − und 0',
    zoomIn: 'Hineinzoomen',
    zoomOut: 'Herauszoomen',
    fitRoute: 'Route einpassen',
    wholeNepal: 'Ganz Nepal',
    legendRoute: 'Route',
    legendSide: 'Hin und zurück',
    legendPeak: 'Hohe Gipfel',
    addH: 'Eine Nacht hinzufügen',
    addLabel: 'Ort',
    addBtn: (n) => `Als Tag ${n} hinzufügen`,
    addHint: 'Oder einen Ort auf der Karte antippen.',
    placeAdd: 'Als nächste Nacht hinzufügen',
    placeClose: 'Schließen',
    daysH: 'Tag für Tag',
    dayN: (n) => `Tag ${n}`,
    leg: (from, to) => `${from} → ${to}`,
    restIn: (p) => `Ruhetag in ${p}`,
    dayIn: (p) => `Ein Tag in ${p}`,
    arriveIn: (p) => `Ankunft in ${p}`,
    viaWord: 'über',
    sideWord: 'hinauf zum',
    walkH: (h) => `${h} Std. zu Fuß`,
    driveH: (h) => `${h} Std. Fahrt`,
    flyH: (h) => `${h} Std. Flug`,
    km: (n) => `${n} km`,
    airKm: (n) => `${n} km Luftlinie`,
    sleepAt: (m) => `Nacht auf ${m} m`,
    topAt: (m) => `höchstens ${m} m`,
    estimated: 'aus der Karte geschätzt — der Tag wurde verschoben oder hinzugefügt',
    moveUp: (n) => `Tag ${n} nach oben`,
    moveDown: (n) => `Tag ${n} nach unten`,
    drag: (n) => `Tag ${n} zum Umsortieren ziehen`,
    another: 'Noch eine Nacht hier',
    anotherLabel: (n) => `Nach Tag ${n} noch eine Nacht hinzufügen`,
    remove: (n) => `Tag ${n} entfernen`,
    showOnMap: (p) => `${p} auf der Karte zeigen`,
    emptyDays: 'Fügt euren ersten Ort aus der Liste oder von der Karte hinzu.',
    profileH: 'Höhenprofil',
    profileLabel: (trip, max) => `Höhenprofil: ${trip}, Schlafhöhe pro Tag, höchste Nacht ${max} m`,
    profileSleep: 'Schlafhöhe',
    profileTop: 'Höchster Punkt des Tages',
    profileLow: 'Diese Reise bleibt niedrig — keine Höhe, auf die man achten müsste.',
    profileDay: 'Tag',
    profileTable: 'Als Tabelle zeigen',
    profilePoint: (n, place, sleep) => `Tag ${n}, ${place}, Nacht auf ${sleep} m`,
    ruleH: 'Akklimatisierungs-Check',
    ruleTag: 'Allgemeine Orientierung, kein medizinischer Rat',
    rules: [
      'Über 3.000 m nicht mehr als 500 m höher schlafen als in der Nacht davor (der Teil unter 3.000 m zählt nicht).',
      'Über 3.000 m mindestens jede dritte Nacht einen Ruhetag einlegen — eine Nacht nicht höher als die davor.',
    ],
    ruleOk: 'Kein Tag wird von der Regel markiert.',
    warnGain: (day, place, gain, eased) =>
      `Tag ${day}, ${place}: ${gain} m höher als die Nacht davor.${eased ? ' Danach folgt ein Ruhetag — langsam gehen.' : ' Eine Nacht dazwischen oder einen Ruhetag danach einplanen.'}`,
    warnRest: (day, place, streak) => `Tag ${day}, ${place}: die ${streak}. Nacht in Folge höher über 3.000 m — Zeit für einen Ruhetag.`,
    feelBad: 'Kopfweh, Übelkeit, kein Appetit? Nicht höher gehen. Wird es schlimmer, absteigen. Euer Guide achtet auch darauf.',
    seasonH: 'Beste Reisezeit',
    seasonSub: (trip) => `Wie gut jeder Monat passt: ${trip}`,
    score: ['Monsun oder geschlossen', 'Mäßig', 'Gut', 'Am besten'],
    monthsShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    months: MONTHS_DE,
    startLabel: 'Startdatum',
    startIs: (month, score) => `Ihr startet im ${month}: ${score}.`,
    best: (months) => `Am besten: ${months}.`,
    festivalsH: 'Feste unterwegs',
    festivalNote: 'Die Festtage folgen dem Mondkalender und verschieben sich jedes Jahr.',
    seasonNotes: {
      monsoon: 'Juni bis September ist Monsun: fast jeden Nachmittag Regen, Wolken über den Gipfeln, Blutegel auf Waldwegen und Erdrutsche auf den Straßen.',
      mustang: 'Mustang liegt im Regenschatten hinter den Annapurnas — im Monsun bleibt es meist trocken, aber der Winter dort ist bitterkalt.',
      lowland: 'Kathmandu, Pokhara, Chitwan und Lumbini sind im April und Mai heiß; Oktober bis März ist kühl und klar.',
    },
    peopleLabel: 'Personen',
    packH: 'Packliste',
    packSub: (month) => `Für diese Reise im ${month}. Die Haken bleiben in diesem Browser.`,
    packed: (x, y) => `${x} von ${y} gepackt`,
    untick: 'Alle Haken entfernen',
    permitsH: 'Permits & Papiere',
    permitsNote: 'Regeln ändern sich: Die Agentur prüft die aktuellen Permits und Papiere für eure Daten. Diese Liste ist ein Startpunkt, keine offizielle Auskunft.',
    enquiryH: 'Diese Reise an die Agentur schicken',
    enquiryP: 'Erstellt eine Zusammenfassung eurer Tage für die Agentur. In dieser Demo wird nichts verschickt.',
    fName: 'Euer Name',
    fContact: 'E-Mail oder Telefon',
    fNote: 'Sollten wir etwas wissen?',
    fNoteHint: 'Z. B. mit den Großeltern unterwegs, erster Trek, ein Geburtstag unterwegs…',
    build: 'Anfrage vorbereiten',
    sentH: 'Fertig — und nichts wurde verschickt',
    sentP: 'Auf einer echten Agentur-Website käme das in ihrem Posteingang an, und sie würden wegen Daten und Guides zurückschreiben. Hier bleibt es auf eurem Bildschirm.',
    copy: 'Text kopieren',
    copied: 'Kopiert',
    edit: 'Etwas ändern',
    printBtn: 'Reiseplan drucken',
    icsBtn: 'In den Kalender (.ics)',
    icsDone: 'Kalenderdatei gespeichert — ein Termin pro Tag.',
    printTitle: (trip) => `${trip} — Reiseplan`,
    printFoot: 'Yatri Treks ist eine erfundene Agentur · Demo von MartNepali · allgemeine Orientierung, kein medizinischer Rat',
    howH: 'So funktioniert diese Demo',
    how: [
      'Alles läuft in eurem Browser; eure Reise bleibt nur auf diesem Gerät.',
      'Höhen und Entfernungen sind gerundet und nur zur Planung.',
      'Der Akklimatisierungs-Check ist eine einfache Regel, kein medizinischer Rat.',
      'Für Agenturen gemacht: fertige Reisen, Karte, Saison und Anfrage auf einer Seite.',
    ],
    reset: 'Demo zurücksetzen',
    resetDone: 'Demo zurückgesetzt.',
    moved: (n, to) => `Tag ${n} ist jetzt Tag ${to}.`,
    removed: (n) => `Tag ${n} entfernt.`,
    added: (place, n) => `${place} als Tag ${n} hinzugefügt.`,
    restAdded: (place) => `Noch eine Nacht in ${place}.`,
    tripLoaded: (trip) => `${trip} geladen.`,
    maxDays: 'Länger kann eine Reise in diesem Planer nicht werden.',
    summary: {
      head: 'Reiseanfrage — Yatri Treks',
      trip: 'Reise',
      start: 'Start',
      days: 'Tage',
      people: 'Personen',
      name: 'Name',
      contact: 'Kontakt',
      note: 'Hinweis',
      flagged: 'Vom Akklimatisierungs-Check markierte Tage',
      none: 'keine',
    },
  },
  ne: {
    langLabel: 'भाषा',
    tagline: 'नेपालमा पदयात्रा र पारिवारिक यात्रा — नक्सामा, दिनदिनको योजना।',
    madeUp: 'यात्री ट्रेक्स यो डेमोका लागि बनाइएको काल्पनिक एजेन्सी हो। उचाइ प्रचलित अनुमानित अङ्क हुन्; तपाईंले लेखेको केही पनि यो ब्राउजरबाट बाहिर जाँदैन।',
    pickH: 'यात्रा छान्नुहोस्',
    tripsLabel: 'तयारी यात्राहरू',
    daysN: (n) => `${n} दिन`,
    yourVersion: 'तपाईंको संस्करण',
    backToOriginal: 'मूल यात्रामा फर्कनुहोस्',
    sum: { days: 'दिन', walkDays: 'हिँड्ने दिन', onFoot: 'किमी पैदल', hours: 'घण्टा हिँडाइ', maxSleep: 'सबैभन्दा अग्लो रात', maxTop: 'सबैभन्दा अग्लो ठाउँ' },
    mapH: 'बाटो',
    mapLabel: (trip) => `${trip} को बाटोसहित नेपालको नक्सा`,
    mapHelp: 'तानेर सार्नुहोस् · माउस ह्वील, दुई औँला वा + − ले ठूलो-सानो · नक्सामा फोकस हुँदा: एरो किज, + − र ०',
    zoomIn: 'ठूलो गर्नुहोस्',
    zoomOut: 'सानो गर्नुहोस्',
    fitRoute: 'पूरै बाटो देखाउनुहोस्',
    wholeNepal: 'सिङ्गो नेपाल',
    legendRoute: 'बाटो',
    legendSide: 'गएर फर्किने',
    legendPeak: 'अग्ला हिमाल',
    addH: 'एक रात थप्नुहोस्',
    addLabel: 'ठाउँ',
    addBtn: (n) => `दिन ${n} को रूपमा थप्नुहोस्`,
    addHint: 'वा नक्सामा कुनै ठाउँ थिच्नुहोस्।',
    placeAdd: 'अर्को रातका रूपमा थप्नुहोस्',
    placeClose: 'बन्द गर्नुहोस्',
    daysH: 'दिनदिनको योजना',
    dayN: (n) => `दिन ${n}`,
    leg: (from, to) => `${from} → ${to}`,
    restIn: (p) => `${p} मा विश्राम दिन`,
    dayIn: (p) => `${p} मा एक दिन`,
    arriveIn: (p) => `${p} आगमन`,
    viaWord: 'हुँदै',
    sideWord: 'माथि',
    walkH: (h) => `${h} घण्टा हिँडाइ`,
    driveH: (h) => `${h} घण्टा सडक यात्रा`,
    flyH: (h) => `${h} घण्टा उडान`,
    km: (n) => `${n} किमी`,
    airKm: (n) => `${n} किमी हवाई दूरी`,
    sleepAt: (m) => `${m} मिटरमा बास`,
    topAt: (m) => `सबैभन्दा माथि ${m} मि`,
    estimated: 'नक्साबाट अनुमान — यो दिन सारिएको वा थपिएको',
    moveUp: (n) => `दिन ${n} माथि सार्नुहोस्`,
    moveDown: (n) => `दिन ${n} तल सार्नुहोस्`,
    drag: (n) => `क्रम बदल्न दिन ${n} तान्नुहोस्`,
    another: 'यहीँ अर्को रात',
    anotherLabel: (n) => `दिन ${n} पछि अर्को रात थप्नुहोस्`,
    remove: (n) => `दिन ${n} हटाउनुहोस्`,
    showOnMap: (p) => `${p} नक्सामा देखाउनुहोस्`,
    emptyDays: 'सूची वा नक्साबाट पहिलो ठाउँ थप्नुहोस्।',
    profileH: 'उचाइ चित्र',
    profileLabel: (trip, max) => `${trip} को उचाइ चित्र: हरेक दिन सुत्ने उचाइ, सबैभन्दा अग्लो रात ${max} मिटर`,
    profileSleep: 'सुत्ने उचाइ',
    profileTop: 'दिनको सबैभन्दा अग्लो ठाउँ',
    profileLow: 'यो यात्रा तल्लो भेगमै हुन्छ — उचाइको चिन्ता छैन।',
    profileDay: 'दिन',
    profileTable: 'तालिकामा हेर्नुहोस्',
    profilePoint: (n, place, sleep) => `दिन ${n}, ${place}, ${sleep} मिटरमा बास`,
    ruleH: 'उचाइमा अभ्यस्त हुने जाँच',
    ruleTag: 'सामान्य सुझाव मात्र, चिकित्सकीय सल्लाह होइन',
    rules: [
      '३,००० मिटरमाथि अघिल्लो रातभन्दा ५०० मिटरभन्दा बढी माथि नसुत्नुहोस् (३,००० मुनिको भाग गनिँदैन)।',
      '३,००० मिटरमाथि कम्तीमा हरेक तेस्रो रातमा विश्राम दिन राख्नुहोस् — अघिल्लो रातभन्दा माथि नसुत्ने रात।',
    ],
    ruleOk: 'नियमअनुसार कुनै दिन चिन्ह लगाइएको छैन।',
    warnGain: (day, place, gain, eased) =>
      `दिन ${day}, ${place}: अघिल्लो रातभन्दा ${gain} मिटर माथि।${eased ? ' त्यसपछि विश्राम दिन छ — बिस्तारै हिँड्नुहोस्।' : ' बीचमा एक रात वा पछि विश्राम दिन थप्नुहोस्।'}`,
    warnRest: (day, place, streak) => `दिन ${day}, ${place}: ३,००० मिटरमाथि लगातार ${streak} औँ रात माथि चढ्दै — अब विश्राम दिन चाहिन्छ।`,
    feelBad: 'टाउको दुख्ने, वाकवाकी, भोक नलाग्ने? माथि नजानुहोस्। झन् बिग्रिए तल झर्नुहोस्। तपाईंको गाइडले पनि ध्यान दिन्छ।',
    seasonH: 'जाने उपयुक्त समय',
    seasonSub: (trip) => `${trip} का लागि हरेक महिना कस्तो`,
    score: ['बर्खा वा बन्द', 'ठिकै', 'राम्रो', 'सबैभन्दा राम्रो'],
    monthsShort: ['जन', 'फेब', 'मार्च', 'अप्रि', 'मे', 'जुन', 'जुला', 'अग', 'सेप', 'अक्टो', 'नोभे', 'डिसे'],
    months: MONTHS_NE,
    startLabel: 'सुरु मिति',
    startIs: (month, score) => `तपाईं ${month} मा सुरु गर्दै हुनुहुन्छ: ${score}।`,
    best: (months) => `सबैभन्दा राम्रो: ${months}।`,
    festivalsH: 'बाटोमा पर्ने चाडपर्व',
    festivalNote: 'चाडपर्वका मिति चन्द्र पात्रोअनुसार हरेक वर्ष सर्छन्।',
    seasonNotes: {
      monsoon: 'जुनदेखि सेप्टेम्बर बर्खा: प्रायः दिउँसो पानी, हिमालमा बादल, वनका बाटोमा जुका र सडकमा पहिरो।',
      mustang: 'मुस्ताङ अन्नपूर्णपछाडिको वर्षा-छायामा पर्छ — बर्खामा पनि प्रायः सुक्खा, तर जाडो कडा।',
      lowland: 'काठमाडौं, पोखरा, चितवन र लुम्बिनी अप्रिल-मेमा गर्मी; अक्टोबरदेखि मार्च शीतल र सफा।',
    },
    peopleLabel: 'जना',
    packH: 'सामानको सूची',
    packSub: (month) => `${month} मा यो यात्राका लागि। चिन्हहरू यही ब्राउजरमा रहन्छन्।`,
    packed: (x, y) => `${y} मध्ये ${x} तयार`,
    untick: 'सबै चिन्ह हटाउनुहोस्',
    permitsH: 'अनुमतिपत्र र कागजात',
    permitsNote: 'नियम बदलिन्छन्: तपाईंको मितिका लागि हालका अनुमतिपत्र र कागजात एजेन्सीले जाँच्छ। यो सूची सुरुवात मात्र हो, आधिकारिक सल्लाह होइन।',
    enquiryH: 'यो यात्रा एजेन्सीलाई पठाउनुहोस्',
    enquiryP: 'एजेन्सीका लागि तपाईंका दिनहरूको सारांश बनाउँछ। यो डेमोमा केही पनि पठाइँदैन।',
    fName: 'तपाईंको नाम',
    fContact: 'इमेल वा फोन',
    fNote: 'हामीले थाहा पाउनुपर्ने केही?',
    fNoteHint: 'जस्तै: हजुरबा-हजुरआमासँग, पहिलो पदयात्रा, बाटोमै जन्मदिन…',
    build: 'सोधपुछ तयार गर्नुहोस्',
    sentH: 'तयार — र केही पनि पठाइएन',
    sentP: 'साँच्चैको एजेन्सीको वेबसाइटमा यो उनीहरूको इनबक्समा पुग्थ्यो, र उनीहरूले मिति र गाइडबारे जवाफ लेख्थे। यहाँ यो तपाईंकै स्क्रिनमा रहन्छ।',
    copy: 'पाठ कपी गर्नुहोस्',
    copied: 'कपी भयो',
    edit: 'केही बदल्नुहोस्',
    printBtn: 'यात्रा तालिका छाप्नुहोस्',
    icsBtn: 'क्यालेन्डरमा थप्नुहोस् (.ics)',
    icsDone: 'क्यालेन्डर फाइल सुरक्षित भयो — हरेक दिनको एउटा कार्यक्रम।',
    printTitle: (trip) => `${trip} — यात्रा तालिका`,
    printFoot: 'यात्री ट्रेक्स काल्पनिक एजेन्सी हो · MartNepali ले बनाएको डेमो · सामान्य सुझाव, चिकित्सकीय सल्लाह होइन',
    howH: 'यो डेमो कसरी चल्छ',
    how: [
      'सबै कुरा तपाईंको ब्राउजरमै चल्छ; तपाईंको यात्रा यही उपकरणमा मात्र रहन्छ।',
      'उचाइ र दूरी अनुमानित हुन्, योजनाका लागि मात्र।',
      'उचाइ जाँच एउटा सरल नियम हो, चिकित्सकीय सल्लाह होइन।',
      'एजेन्सीका लागि बनाइएको: तयारी यात्रा, नक्सा, मौसम र सोधपुछ एउटै पानामा।',
    ],
    reset: 'डेमो रिसेट गर्नुहोस्',
    resetDone: 'डेमो रिसेट भयो।',
    moved: (n, to) => `दिन ${n} अब दिन ${to} भयो।`,
    removed: (n) => `दिन ${n} हटाइयो।`,
    added: (place, n) => `${place} दिन ${n} को रूपमा थपियो।`,
    restAdded: (place) => `${place} मा अर्को रात।`,
    tripLoaded: (trip) => `${trip} खुल्यो।`,
    maxDays: 'यो योजनाकारमा यात्रा यति नै लामो हुन सक्छ।',
    summary: {
      head: 'यात्रा सोधपुछ — यात्री ट्रेक्स',
      trip: 'यात्रा',
      start: 'सुरु',
      days: 'दिन',
      people: 'जना',
      name: 'नाम',
      contact: 'सम्पर्क',
      note: 'टिप्पणी',
      flagged: 'उचाइ जाँचले चिन्ह लगाएका दिन',
      none: 'छैन',
    },
  },
};

// ---------------------------------------------------------------- texts built from a trip

/** "Day 3 · Phakding → Namche Bazaar", "Rest day in Namche Bazaar", "Arrive in Kathmandu". */
export function dayTitle(x: DayInfo, lang: Lang): string {
  const t = COPY[lang];
  const here = STOP_NAME[x.stop][lang];
  if (x.prev === null) {
    if (x.via) return t.leg(STOP_NAME[x.via][lang], here);
    return t.arriveIn(here);
  }
  if (x.prev === x.stop) return x.mode === 'rest' ? t.restIn(here) : t.dayIn(here);
  if (x.via && x.via !== x.prev) return t.leg(t.leg(STOP_NAME[x.prev][lang], STOP_NAME[x.via][lang]), here);
  return t.leg(STOP_NAME[x.prev][lang], here);
}

/** "5.5 h walking · 11 km · sleep at 3,440 m · highest 3,880 m · Teahouse". */
export function dayFacts(x: DayInfo, lang: Lang): string[] {
  const t = COPY[lang];
  const out: string[] = [];
  const h = count(x.h, lang);
  if ((x.mode === 'walk' || x.mode === 'rest') && x.h > 0) out.push(t.walkH(h));
  if (x.mode === 'drive' && x.h > 0) out.push(t.driveH(h));
  if (x.mode === 'fly' && x.h > 0) out.push(t.flyH(h));
  if (x.km > 0) out.push(x.mode === 'fly' ? t.airKm(count(x.km, lang)) : t.km(count(x.km, lang)));
  out.push(t.sleepAt(count(x.sleep, lang)));
  if (x.top > x.sleep) out.push(t.topAt(count(x.top, lang)));
  out.push(LODGE_NAME[x.lodge][lang]);
  return out;
}

export function dayHighlight(x: DayInfo, lang: Lang): string {
  return x.hl && HL[x.hl] ? HL[x.hl][lang] : STOP_NOTE[x.stop][lang];
}

export function warningText(w: Warning, days: Day[], lang: Lang): string {
  const t = COPY[lang];
  const place = STOP_NAME[days[w.day].stop][lang];
  return w.kind === 'gain' ? t.warnGain(num(w.day + 1, lang), place, count(w.gain, lang), w.eased) : t.warnRest(num(w.day + 1, lang), place, num(w.streak, lang));
}

export function dateLabel(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { ...opts, timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
  } catch {
    return date;
  }
}

export function tripName(base: TripId | 'custom', edited: boolean, lang: Lang): string {
  const n = TRIP_TEXT[base].name[lang];
  return edited && base !== 'custom' ? `${n} (${COPY[lang].yourVersion})` : n;
}

export type Enquiry = {
  name: string;
  contact: string;
  note: string;
  people: number;
};

/** The enquiry text: the trip, the dates, every day, the flagged days, the visitor's lines. Plain text, nothing is sent. */
export function enquiryText(days: Day[], trip: string, start: string | null, e: Enquiry, warnings: Warning[], lang: Lang): string {
  const t = COPY[lang];
  const s = t.summary;
  const infos = dayInfos(days);
  const tot = totals(days);
  const lines = [
    s.head,
    '',
    `${s.trip}: ${trip}`,
    `${s.days}: ${num(tot.days, lang)}`,
    ...(isDate(start) ? [`${s.start}: ${dateLabel(start, lang, { day: 'numeric', month: 'long', year: 'numeric' })}`] : []),
    `${s.people}: ${num(e.people, lang)}`,
    ...(e.name.trim() ? [`${s.name}: ${e.name.trim()}`] : []),
    ...(e.contact.trim() ? [`${s.contact}: ${e.contact.trim()}`] : []),
    ...(e.note.trim() ? [`${s.note}: ${e.note.trim()}`] : []),
    '',
    ...infos.map((x, i) => {
      const date = isDate(start) ? ` (${dateLabel(addDays(start, i), lang)})` : '';
      return `${t.dayN(num(i + 1, lang))}${date}: ${dayTitle(x, lang)} — ${dayFacts(x, lang).join(', ')}`;
    }),
    '',
    `${s.flagged}: ${warnings.length ? [...new Set(warnings.map((w) => num(w.day + 1, lang)))].join(', ') : s.none}`,
  ];
  return lines.join('\n');
}

/** The calendar's events: one per day. */
export function icsEvents(days: Day[], start: string, lang: Lang): { date: string; summary: string; description: string; location: string }[] {
  const t = COPY[lang];
  return dayInfos(days).map((x, i) => ({
    date: addDays(start, i),
    summary: `${t.dayN(num(i + 1, lang))} · ${dayTitle(x, lang)}`,
    description: `${dayHighlight(x, lang)}\n${dayFacts(x, lang).join(' · ')}\n${BRAND[lang]} — ${FRAME[lang].text}`,
    location: `${STOP_NAME[x.stop][lang]}, ${lang === 'ne' ? 'नेपाल' : 'Nepal'} (${STOPS[x.stop].lat.toFixed(4)}, ${STOPS[x.stop].lon.toFixed(4)})`,
  }));
}

// ---------------------------------------------------------------- the MartNepali frame around the demo

type Frame = {
  badge: string;
  text: string;
  all: string;
  kicker: string;
  endH: string;
  endP: string;
  points: string[];
  talk: string;
  more: string;
  pairs: string;
  free: string;
};
export const FRAME: Record<Lang, Frame> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · a made-up agency, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want a trip planner for your travel agency?',
    endP: 'For a trekking agency, a tour operator or a family business in Nepal: ready trips your visitors can change, a drawn map, altitude and season at a glance, and a clean enquiry — in English, Deutsch and नेपाली.',
    points: ['Ready trips + build your own', 'A drawn map with the route', 'Altitude profile and season', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    pairs: 'Pairs well with a website in 10 seconds →',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · eine erfundene Agentur, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Ein Reiseplaner für eure Reiseagentur?',
    endP: 'Für eine Trekking-Agentur, einen Reiseveranstalter oder einen Familienbetrieb in Nepal: fertige Reisen, die Besucher anpassen können, eine gezeichnete Karte, Höhe und Saison auf einen Blick und eine saubere Anfrage — auf English, Deutsch und नेपाली.',
    points: ['Fertige Reisen + selbst zusammenstellen', 'Gezeichnete Karte mit Route', 'Höhenprofil und Saison', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    pairs: 'Passt gut zur Website in 10 Sekunden →',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · काल्पनिक एजेन्सी, केही पनि पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'तपाईंको ट्राभल एजेन्सीका लागि यात्रा योजनाकार चाहिन्छ?',
    endP: 'नेपालको ट्रेकिङ एजेन्सी, टुर सञ्चालक वा पारिवारिक व्यवसायका लागि: आगन्तुकले बदल्न मिल्ने तयारी यात्रा, कोरिएको नक्सा, उचाइ र मौसम एकै नजरमा, अनि सफा सोधपुछ — English, Deutsch र नेपालीमा।',
    points: ['तयारी यात्रा + आफैं बनाउने', 'बाटोसहित कोरिएको नक्सा', 'उचाइ चित्र र मौसम', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    pairs: '१० सेकेन्डमा वेबसाइटसँग राम्रोसँग मिल्छ →',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
