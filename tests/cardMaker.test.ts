/**
 * THE LINK PAGE MAKER ONLY EVER LINKS WHERE IT SHOULD.
 *
 * /work/card lets a visitor type links that other people will tap, and packs
 * the whole page into a shareable #p=… link that anyone can craft. These pin
 * the rules in card.ts: the scheme allowlist (http(s), mailto, tel — never
 * javascript: or data:), what each link type accepts, that a published link
 * is cleaned and re-checked when it is opened and stays within its size cap
 * (the photo goes first), vCard escaping and folding, reordering — and that
 * no word in any language talks money.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_STATE,
  HASH_MAX,
  LIMITS,
  LINK_TYPES,
  QR_MAX,
  THEME_IDS,
  addLink,
  buildVCard,
  cardContacts,
  decodeState,
  encodeForLink,
  encodeState,
  foldLine,
  hrefOf,
  linkHref,
  moveLink,
  moveLinkBy,
  mulberry32,
  nextLinkId,
  normalizeState,
  onColor,
  pageColors,
  qrTarget,
  readHash,
  removeLink,
  safeHref,
  seedStats,
  tickStats,
  updateLink,
  vcardEscape,
  type CardState,
  type LinkItem,
} from '../src/app/work/card/card.ts';
import { COPY, TEMPLATES, TEMPLATE_IDS, templateState } from '../src/app/work/card/content.ts';
import { contrast } from '../src/app/work/samaj/samaj.ts';

const ok = (r: ReturnType<typeof linkHref>) => (r.ok ? r.href : null);

test('only http(s), mailto and tel get through the last gate', () => {
  for (const bad of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://x.com/1',
    'ftp://example.com',
    'https://bank.example.com@evil.example',
    'https://user:pw@example.com',
    'https://localhost/x',
    'https:// example.com',
    'java\tscript:alert(1)',
    '',
    42,
  ])
    assert.equal(safeHref(bad), null, String(bad));
  assert.equal(safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHref('mailto:a@example.com'), 'mailto:a@example.com');
  assert.equal(safeHref('tel:+4930123456'), 'tel:+4930123456');
});

test('every link type refuses script and data addresses, however they are written', () => {
  const attacks = ['javascript:alert(1)', ' JAVASCRIPT:alert(document.cookie)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x', 'file:///c:/x'];
  for (const type of LINK_TYPES)
    for (const a of attacks) {
      const r = linkHref(type, a);
      if (r.ok) {
        // The only thing allowed to "accept" one is the map search, which turns it into a plain https search.
        assert.equal(type, 'maps', `${type} accepted ${JSON.stringify(a)}`);
        assert.match(r.href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
      }
      if (r.ok) assert.ok(safeHref(r.href));
    }
  assert.deepEqual(linkHref('website', 'javascript:alert(1)'), { ok: false, error: 'scheme' });
  assert.deepEqual(linkHref('maps', 'javascript:alert(1)'), { ok: false, error: 'scheme' });
});

test('web addresses: https added when missing, only http(s) kept, a real host needed', () => {
  assert.equal(ok(linkHref('website', 'example.com')), 'https://example.com/');
  assert.equal(ok(linkHref('website', 'http://example.com/menu')), 'http://example.com/menu');
  assert.equal(ok(linkHref('menu', '//example.com/x')), 'https://example.com/x');
  assert.equal(ok(linkHref('website', 'www.example.com:8080/x')), 'https://www.example.com:8080/x');
  assert.deepEqual(linkHref('website', 'not a url'), { ok: false, error: 'invalid' });
  assert.deepEqual(linkHref('website', 'example'), { ok: false, error: 'invalid' });
  assert.deepEqual(linkHref('website', ''), { ok: false, error: 'empty' });
  assert.deepEqual(linkHref('website', 'mailto:a@example.com'), { ok: false, error: 'scheme' });
  const r = linkHref('website', 'example.com/a-very-long-path/that-keeps-going/and-going/forever');
  assert.ok(r.ok && r.display.length <= 42);
});

test('handles, numbers, emails, maps and MartNepali events become the right addresses', () => {
  assert.equal(ok(linkHref('instagram', '@tatomomo.demo')), 'https://www.instagram.com/tatomomo.demo/');
  assert.equal(ok(linkHref('instagram', 'https://instagram.com/x')), 'https://instagram.com/x');
  assert.equal(ok(linkHref('tiktok', 'beats')), 'https://www.tiktok.com/@beats');
  assert.equal(ok(linkHref('youtube', '@chan_1')), 'https://www.youtube.com/@chan_1');
  assert.equal(ok(linkHref('facebook', 'my.page')), 'https://www.facebook.com/my.page');
  assert.equal(ok(linkHref('whatsapp', '+49 151 2345 6789')), 'https://wa.me/4915123456789');
  assert.equal(ok(linkHref('whatsapp', '0049 151 2345')), 'https://wa.me/491512345');
  assert.equal(ok(linkHref('whatsapp', 'https://wa.me/4915123')), 'https://wa.me/4915123');
  assert.deepEqual(linkHref('whatsapp', 'https://evil.example/wa'), { ok: false, error: 'host' });
  assert.deepEqual(linkHref('whatsapp', '12'), { ok: false, error: 'phone' });
  assert.equal(ok(linkHref('email', 'asha@example.com')), 'mailto:asha@example.com');
  assert.equal(ok(linkHref('email', 'mailto:asha@example.com')), 'mailto:asha@example.com');
  assert.deepEqual(linkHref('email', 'asha@example.com?bcc=x@y.com'), { ok: false, error: 'email' });
  assert.deepEqual(linkHref('email', 'not-an-email'), { ok: false, error: 'email' });
  assert.equal(ok(linkHref('phone', '+49 (30) 123-456')), 'tel:+4930123456');
  assert.equal(ok(linkHref('phone', 'tel:030123456')), 'tel:030123456');
  assert.deepEqual(linkHref('phone', 'call me'), { ok: false, error: 'phone' });
  assert.equal(ok(linkHref('maps', 'Marktplatz, Darmstadt')), 'https://www.google.com/maps/search/?api=1&query=Marktplatz%2C%20Darmstadt');
  assert.equal(ok(linkHref('maps', 'https://maps.example.com/x')), 'https://maps.example.com/x');
  assert.equal(ok(linkHref('maps', 'Opening times: Sat')), 'https://www.google.com/maps/search/?api=1&query=Opening%20times%3A%20Sat');
  assert.equal(ok(linkHref('event', 'https://www.martnepali.com/e/dashain')), 'https://www.martnepali.com/e/dashain');
  assert.equal(ok(linkHref('event', 'martnepali.com/events')), 'https://martnepali.com/events');
  assert.equal(ok(linkHref('event', '/e/tihar')), 'https://www.martnepali.com/e/tihar');
  assert.deepEqual(linkHref('event', 'https://martnepali.com.evil.example/e'), { ok: false, error: 'host' });
  assert.deepEqual(linkHref('event', 'https://example.com/e'), { ok: false, error: 'host' });
});

test('add, edit, reorder and delete', () => {
  let links: LinkItem[] = [];
  links = addLink(links, { type: 'website', value: ' example.com ', label: 'Site' });
  links = addLink(links, { type: 'email', value: 'a@example.com', label: '' });
  links = addLink(links, { type: 'phone', value: '+49 30 123456', label: 'Call\u0000 me' });
  assert.deepEqual(links.map((l) => l.id), ['l1', 'l2', 'l3']);
  assert.equal(links[0].value, 'example.com');
  assert.equal(links[2].label, 'Call me');
  assert.deepEqual(moveLink(links, 0, 2).map((l) => l.id), ['l2', 'l3', 'l1']);
  assert.deepEqual(moveLink(links, 2, 0).map((l) => l.id), ['l3', 'l1', 'l2']);
  assert.deepEqual(moveLink(links, 1, 99).map((l) => l.id), ['l1', 'l3', 'l2'], 'clamped');
  assert.equal(moveLink(links, 1, 1), links, 'no move, same list');
  assert.equal(moveLink(links, -1, 0), links);
  assert.equal(moveLink(links, 5, 0), links);
  assert.equal(moveLinkBy(links, 'l1', -1), links, 'the first cannot go up');
  assert.equal(moveLinkBy(links, 'l3', 1), links, 'the last cannot go down');
  assert.deepEqual(moveLinkBy(links, 'l2', -1).map((l) => l.id), ['l2', 'l1', 'l3']);
  assert.equal(moveLinkBy(links, 'nope', 1), links);
  links = updateLink(links, 'l2', { value: 'b@example.com', type: 'email' });
  assert.equal(links[1].value, 'b@example.com');
  links = removeLink(links, 'l1');
  assert.deepEqual(links.map((l) => l.id), ['l2', 'l3']);
  assert.equal(nextLinkId(links), 'l4', 'ids are never reused while the list holds a higher one');
  for (let i = 0; i < 20; i++) links = addLink(links, { type: 'website', value: 'example.com', label: '' });
  assert.equal(links.length, LIMITS.links);
});

test('a published link round-trips and stays short', () => {
  for (const id of TEMPLATE_IDS)
    for (const lang of ['en', 'de', 'ne'] as const) {
      const s = templateState(id, lang);
      const code = encodeState(s);
      assert.ok(code.length < 1600, `${id}/${lang}: ${code.length}`);
      assert.match(code, /^[A-Za-z0-9_-]+$/);
      const back = decodeState(code)!;
      assert.equal(back.name, s.name);
      assert.equal(back.role, s.role);
      assert.equal(back.bio, s.bio);
      assert.equal(back.theme, s.theme);
      assert.equal(back.button, s.button);
      assert.equal(back.font, s.font);
      assert.equal(back.animated, s.animated);
      assert.deepEqual(
        back.links.map((l) => [l.type, l.value, l.label]),
        s.links.map((l) => [l.type, l.value, l.label])
      );
      assert.deepEqual(readHash(`#p=${code}`), back);
    }
});

test('opening a link cleans it again: junk, bad links and markup never come back out', () => {
  const evil = Buffer.from(
    JSON.stringify({
      v: 1,
      n: '<img src=x onerror=alert(1)>\u202E Name\u0000',
      r: 'x'.repeat(500),
      a: 'data:text/html;base64,PHNjcmlwdD4=',
      t: 'nope',
      c: 'red; background:url(x)',
      s: 'blink',
      f: '../../etc',
      l: [
        ['w', 'javascript:alert(1)', 'click'],
        ['zz', 'example.com'],
        ['w', 'example.com', 'ok'],
        'garbage',
        ['em', 'a@example.com?bcc=x@y.com'],
      ],
    })
  ).toString('base64url');
  const s = decodeState(evil)!;
  assert.ok(s);
  assert.ok(!/[<>\u0000\u202E]/.test(s.name), s.name);
  assert.ok(Array.from(s.role).length <= LIMITS.role);
  assert.equal(s.avatar, '', 'only data:image pictures');
  assert.equal(s.theme, 'himalaya');
  assert.equal(s.accent, '');
  assert.equal(s.button, 'pill');
  assert.equal(s.font, 'clean');
  assert.deepEqual(s.links.map((l) => [l.type, l.value]), [['website', 'example.com']]);
  for (const bad of ['', 'p=', '!!!', 'eyJ2IjoyfQ', Buffer.from('[1,2]').toString('base64url'), Buffer.from('{"v":1').toString('base64url'), 'A'.repeat(500_000)])
    assert.equal(decodeState(bad), null, bad.slice(0, 20));
  assert.equal(readHash('#x=1'), null);
  assert.equal(readHash(''), null);
  assert.equal(readHash('#p=abc def'), null);
});

test('too big for a link: the photo goes first and says so, then links from the end', () => {
  const s = templateState('dj', 'en');
  const small = { ...s, avatar: `data:image/jpeg;base64,${'A'.repeat(2000)}` };
  const a = encodeForLink(small);
  assert.equal(a.droppedAvatar, false);
  assert.equal(decodeState(a.code)!.avatar, small.avatar);
  const big = { ...s, avatar: `data:image/jpeg;base64,${'A'.repeat(40_000)}` };
  const b = encodeForLink(big);
  assert.equal(b.droppedAvatar, true);
  assert.equal(b.droppedLinks, 0);
  assert.ok(b.code.length <= HASH_MAX);
  assert.equal(decodeState(b.code)!.avatar, '');
  const c = encodeForLink(s, 300);
  assert.ok(c.code.length <= 300 || decodeState(c.code)!.links.length === 0);
  assert.ok(c.droppedLinks > 0);
  assert.equal(decodeState(c.code)!.links.length, s.links.length - c.droppedLinks);
  assert.equal(encodeForLink(s).droppedLinks, 0);
});

test('the QR points at the page when it fits a small code, else the fallback', () => {
  assert.deepEqual(qrTarget('https://x.example/p', 'https://f.example'), { text: 'https://x.example/p', full: true });
  assert.deepEqual(qrTarget(`https://x.example/${'a'.repeat(QR_MAX)}`, 'https://f.example'), { text: 'https://f.example', full: false });
});

test('vCard: escaped, folded at 75 octets, CRLF, no way to start a new property', () => {
  assert.equal(vcardEscape('a\\b,c;d\ne'), 'a\\\\b\\,c\\;d\\ne');
  const s: CardState = {
    ...EMPTY_STATE,
    name: 'Asha; Didi, \\ the\nEND:VCARD',
    role: 'Nepali — कखरा, songs; stories',
    bio: 'x'.repeat(200),
    links: [
      { id: 'l1', type: 'phone', value: '+49 30 123456', label: '' },
      { id: 'l2', type: 'email', value: 'asha@example.com', label: '' },
      { id: 'l3', type: 'website', value: 'example.com', label: '' },
      { id: 'l4', type: 'instagram', value: '@asha.demo', label: '' },
      { id: 'l5', type: 'website', value: 'javascript:alert(1)', label: '' },
    ],
  };
  const v = buildVCard(s, 'https://www.martnepali.com/work/card#p=abc');
  assert.ok(v.endsWith('\r\n'));
  const lines = v.split('\r\n').slice(0, -1);
  assert.equal(lines[0], 'BEGIN:VCARD');
  assert.equal(lines[lines.length - 1], 'END:VCARD');
  assert.equal(lines.filter((l) => l === 'END:VCARD').length, 1, 'a newline in the name cannot end the card');
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `${Buffer.byteLength(l)}: ${l}`);
  const unfolded = v.replace(/\r\n /g, '');
  assert.match(unfolded, /\r\nFN:Asha\\; Didi\\, \\\\ the\\nEND:VCARD\r\n/);
  assert.match(unfolded, /\r\nTITLE:Nepali — कखरा\\, songs\\; stories\r\n/);
  assert.match(unfolded, /\r\nTEL;TYPE=CELL:\+4930123456\r\n/);
  assert.match(unfolded, /\r\nEMAIL;TYPE=INTERNET:asha@example\.com\r\n/);
  assert.match(unfolded, /\r\nURL:https:\/\/example\.com\/\r\n/);
  assert.match(unfolded, /\r\nX-SOCIALPROFILE;TYPE=instagram:https:\/\/www\.instagram\.com\/asha\.demo\/\r\n/);
  assert.match(unfolded, /\r\nURL:https:\/\/www\.martnepali\.com\/work\/card#p=abc\r\n/);
  assert.doesNotMatch(unfolded, /javascript/i);
  // Folding never splits a character.
  const f = foldLine(`NOTE:${'क'.repeat(60)}`);
  for (const part of f.split('\r\n')) assert.ok(Buffer.byteLength(part, 'utf8') <= 75);
  assert.equal(f.replace(/\r\n /g, ''), `NOTE:${'क'.repeat(60)}`);
});

test('the card front shows phone, email and web as chosen', () => {
  const s = templateState('tutor', 'en');
  assert.deepEqual(cardContacts(s).map((c) => c.kind), ['phone', 'email', 'web']);
  assert.deepEqual(cardContacts({ ...s, front: { phone: false, email: true, web: false } }).map((c) => c.kind), ['email']);
  assert.deepEqual(cardContacts({ ...EMPTY_STATE }), []);
});

test('themes read well: button text on its button, outline borders show', () => {
  for (const theme of THEME_IDS)
    for (const button of ['pill', 'square', 'outline'] as const) {
      const c = pageColors({ theme, accent: '', button });
      if (button !== 'outline') assert.ok(contrast(c.btnText, c.btnBg) >= 3, `${theme}/${button}`);
      else assert.ok(contrast(c.btnBorder, c.bg) >= 2.2, `${theme} outline border`);
      assert.ok(contrast(c.text, c.bg) >= 4.5, `${theme} text`);
    }
  // A visitor's own colour still gets readable text.
  for (const hex of ['#ffff00', '#000000', '#22d3ee', '#7f1d1d']) assert.ok(contrast(onColor(hex), hex) >= 3, hex);
});

test('stored state is cleaned but half-typed links are kept for the editor', () => {
  const raw = { name: 'X', links: [{ id: 'l1', type: 'website', value: 'exam', label: '' }, { id: 'l1', type: 'email', value: 'a@example.com', label: '' }] };
  const loose = normalizeState(raw);
  assert.equal(loose.links.length, 2);
  assert.notEqual(loose.links[0].id, loose.links[1].id, 'duplicate ids are renumbered');
  assert.equal(normalizeState(raw, true).links.length, 1);
  assert.equal(hrefOf(loose.links[0]), null);
  assert.deepEqual(normalizeState(null), { ...EMPTY_STATE, links: [], front: { phone: true, email: true, web: true } });
});

test('simulated stats only go up and follow the list', () => {
  const rnd = mulberry32(1);
  const links = [{ id: 'l1' }, { id: 'l2' }];
  let st = seedStats(links, rnd);
  assert.ok(st.views > 0 && st.clicks.l1 > 0);
  const before = st.views;
  for (let i = 0; i < 50; i++) st = tickStats(st, links, rnd);
  assert.ok(st.views > before);
  st = tickStats(st, [{ id: 'l2' }, { id: 'l9' }], rnd);
  assert.deepEqual(Object.keys(st.clicks).sort(), ['l2', 'l9']);
});

test('templates are complete, made up and valid in every language', () => {
  for (const id of TEMPLATE_IDS) {
    const tp = TEMPLATES[id];
    for (const lang of ['en', 'de', 'ne'] as const) {
      const s = templateState(id, lang);
      assert.ok(s.name && s.role && s.bio, `${id}/${lang}`);
      assert.ok(s.links.length >= 4);
      for (const l of s.links) assert.ok(hrefOf(l), `${id}/${lang}: ${l.type} ${l.value}`);
    }
    for (const l of tp.links) {
      // Only reserved example addresses, 000 numbers, .demo handles and martnepali.com.
      assert.match(l.value, /example\.com|\.demo$|^\+49 000 |martnepali\.com|^[A-Za-zÀ-ÿ ,]+$/, l.value);
    }
  }
});

test('every word is there in all three languages, and none is about money or hiring', () => {
  const money =
    /€|\$|\beur\b|euro|\bprices?\b|\bpricing|\bfees?\b|\bcosts?\b|\bcheap|\bbudgets?\b|\bestimat\w*|\bquotes?\b|\brates?\b|\bpackages?\b|\bhire|\bhiring|\bpay\b|\bpaid\b|\binvoice|preis|gebühr|\bkosten\b|budget|angebot|honorar|bezahl|rechnung|\bpaket|(?<!निः)शुल्क|मूल्य|भुक्तानी|पैसा|रुपैयाँ|(?<![\u0900-\u097F])दाम|बजेट|खर्च|भाडा/i;
  const strings = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const r = (v as (...a: string[]) => unknown)('X', 'Y');
      if (typeof r === 'string') out.push(r);
    } else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
    return out;
  };
  const en = strings(COPY.en);
  for (const lang of ['en', 'de', 'ne'] as const) {
    const all = strings(COPY[lang]);
    assert.equal(all.length, en.length, `${lang} has every string`);
    for (const s of all) {
      assert.ok(s.trim(), `${lang}: empty string`);
      assert.doesNotMatch(s, money, `${lang}: ${s}`);
    }
  }
  for (const s of strings(TEMPLATES)) assert.doesNotMatch(s, money, s);
});
