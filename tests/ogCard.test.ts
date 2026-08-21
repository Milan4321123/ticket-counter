/**
 * THE PICTURE A SHARED LINK TURNS INTO.
 *
 * Almost everything on this site travels by somebody forwarding a link into a
 * WhatsApp group, and a link with no og:image arrives as a grey box that
 * nobody taps. So /api/og draws a card for every page that has no photograph
 * of its own.
 *
 * It is rasterised by sharp from an SVG, which means it depends on a FONT
 * BEING INSTALLED WHERE THE APP RUNS — and that is a dependency with a silent
 * failure mode: if no sans-serif is present, librsvg drops the text and serves
 * a perfectly valid PNG of a logo and an empty space. Nobody notices, because
 * nobody sees their own link previews.
 *
 * The last test here is the whole reason this file exists: it renders the card
 * twice, once with the text and once with the text elements stripped out, and
 * insists the two differ. That is the only way from inside a test to ask "did
 * the words actually appear".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { OG_HEIGHT, OG_WIDTH, ogCardSvg } from '../src/lib/ogCard.ts';

const CARD = { head: 'Mart', accent: 'Nepali', tagline: 'Nepali events, tickets & bazaar — across Germany' };

test('the card is the size every chat app crops from', async () => {
  const png = await sharp(Buffer.from(ogCardSvg(CARD))).png().toBuffer();
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png', 'chat apps refuse an SVG og:image — this must rasterise');
  assert.equal(meta.width, OG_WIDTH);
  assert.equal(meta.height, OG_HEIGHT);
});

test('a platform name with markup in it cannot break the SVG', async () => {
  // The name comes from the environment, so it is untrusted input to an XML
  // document. Unescaped, a stray "&" alone is enough to make the whole card
  // fail to parse and the route serve a 500 instead of a picture.
  const nasty = ogCardSvg({ head: 'Mart & <Co>', accent: '"Nepali"', tagline: "it's fine" });
  assert.ok(!nasty.includes('<Co>'), 'the angle brackets must be escaped');
  assert.ok(nasty.includes('&amp;'));
  await assert.doesNotReject(() => sharp(Buffer.from(nasty)).png().toBuffer());
});

test('the words actually render — a server with no font would fail this', async () => {
  const withText = await sharp(Buffer.from(ogCardSvg(CARD)))
    .raw()
    .toBuffer();
  // The same card with every <text> element removed. Everything else — the
  // background, the glow, the pennant, the rule under the wordmark — is
  // identical, so any difference between the two IS the text.
  const stripped = ogCardSvg(CARD).replace(/<text[\s\S]*?<\/text>/g, '');
  const withoutText = await sharp(Buffer.from(stripped)).raw().toBuffer();

  assert.equal(withText.length, withoutText.length, 'same canvas, so the same number of bytes');

  let differing = 0;
  for (let i = 0; i < withText.length; i++) {
    if (withText[i] !== withoutText[i]) differing++;
  }
  const share = differing / withText.length;
  assert.ok(
    share > 0.01,
    `the text made no visible difference (${(share * 100).toFixed(3)}% of the canvas changed) — ` +
      'this is what a machine with no sans-serif font installed looks like, and the card would ' +
      'go out as a logo on an empty background'
  );
});
