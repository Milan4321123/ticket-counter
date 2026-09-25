// The FAQ from the organizer's notes when the AI cannot write it (busy, over
// its daily quota, no key): each note sentence that answers a question guests
// really ask — parking, food, children, doors, paying, collecting — becomes
// that question with the organizer's own sentence as the answer. Plain and
// honest: nothing is invented, and notes that fit no question are left out.

interface Topic {
  re: RegExp;
  en: string;
  de: string;
}

const TOPICS: Topic[] = [
  { re: /\b(park\w*|parkplatz|parken|parking)\b/i, en: 'Is there parking?', de: 'Gibt es Parkplätze?' },
  { re: /\b(vegan|vegetarian|veg|veggie|vegetarisch|halal|gluten)\b/i, en: 'Are there vegetarian or vegan options?', de: 'Gibt es vegetarische oder vegane Optionen?' },
  { re: /\b(pay|paying|payment|cash|card|paypal|bar|bezahl\w*|zahl\w*)\b/i, en: 'How can I pay?', de: 'Wie kann ich bezahlen?' },
  { re: /\b(child\w*|kids?|kinder?|baby|babies|family|familie)\b/i, en: 'Can children come?', de: 'Können Kinder mitkommen?' },
  { re: /\b(doors?|einlass|opens?|starts?|beginn\w*|from \d{1,2}[:.]?\d{0,2})\b/i, en: 'When do doors open?', de: 'Wann ist Einlass?' },
  { re: /\b(dinner|food|meal|buffet|essen|khana|snacks?|drinks?|getränke)\b/i, en: 'Is there food and drink?', de: 'Gibt es Essen und Getränke?' },
  { re: /\b(pick ?up|collect\w*|abhol\w*|pickup)\b/i, en: 'When and where do I collect my order?', de: 'Wann und wo hole ich meine Bestellung ab?' },
  { re: /\b(fresh\w*|home-?made|hausgemacht|frisch)\b/i, en: 'Is everything made fresh?', de: 'Wird alles frisch gemacht?' },
  { re: /\b(bring|mitbringen)\b/i, en: 'What should I bring?', de: 'Was soll ich mitbringen?' },
  { re: /\b(dress|kleidung|dresscode)\b/i, en: 'Is there a dress code?', de: 'Gibt es einen Dresscode?' },
  { re: /\b(refund\w*|cancel\w*|erstatt\w*|storn\w*)\b/i, en: 'Can I get a refund?', de: 'Kann ich stornieren?' },
  { re: /\b(u-?bahn|s-?bahn|bus|train|tram|station|bahnhof|haltestelle|get there)\b/i, en: 'How do I get there?', de: 'Wie komme ich hin?' },
  { re: /\b(wheelchair|accessible|rollstuhl|barrierefrei)\b/i, en: 'Is it accessible?', de: 'Ist es barrierefrei?' },
];

const GERMAN = /\b(und|nicht|gibt|wir|ist|sind|kostenlos|bitte|mit|für|ab|uhr)\b|[äöüß]/i;

/** Question-and-answer pairs from the notes; at most one per question, in note order. */
export function faqFromNotes(notes: string, existingQuestions: string[] = []): { question: string; answer: string }[] {
  const sentences = notes
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);
  const seen = new Set(existingQuestions.map((q) => q.trim().toLowerCase()));
  const out: { question: string; answer: string }[] = [];
  for (const sentence of sentences) {
    const topic = TOPICS.find((t) => t.re.test(sentence));
    if (!topic) continue;
    const question = GERMAN.test(sentence) ? topic.de : topic.en;
    const same = out.find((f) => f.question === question);
    const answer = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    if (same) {
      // A second note on the same question belongs in the same answer.
      if (same.answer.length + answer.length < 900) same.answer = `${same.answer} ${answer}`;
      continue;
    }
    if (seen.has(question.toLowerCase())) continue;
    out.push({ question, answer: answer.charAt(0).toUpperCase() + answer.slice(1) });
  }
  return out.slice(0, 8);
}
