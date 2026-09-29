// What counts as someone's details or a site code (lib/personalText): the
// filter in front of the page translator and the contact chat's model.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findPhones, looksPersonal, redactContact } from '../src/lib/personalText.ts';

describe('looksPersonal', () => {
  it('catches contact details and the codes the site mints', () => {
    for (const s of [
      'ram.sharma@example.de',
      'Write to ram@example.com please',
      'Call 0176 12345678',
      '+49 176 1234567',
      '06151/123456',
      '(0)6151-123456',
      'Mobile 9841234567',
      'DE89 3704 0044 0532 0130 00',
      'DE89370400440532013000',
      'Reference TICKETS-AB12CD34',
      'TICKETS-S-0F1E2D3C',
      'Your ticket K7KQ-M3XP',
      'Share code Q7KX2M9A',
      'Order 3f2b8c1e-9d4a-4b7e-8c21-0a1b2c3d4e5f',
      'card c7k2mqp9xw4ht6rz8vn3bd5f',
    ]) {
      assert.equal(looksPersonal(s), true, s);
    }
  });

  it('lets ordinary page text through — dates, times, prices, postcodes, names of things', () => {
    for (const s of [
      'Collect on Saturdays',
      'Doors 18:00 – 23:00',
      'Saturday, 12.10.2026 · Doors 18:00',
      '2026-10-12 18:00',
      'Season 2025 - 2026',
      '1500 - 2000 guests',
      '€ 1.500,00',
      'Tickets: 25 / 35 / 45 €',
      'Donnersbergring 26, 64295 Darmstadt',
      'Musterstraße 12 64295 Darmstadt',
      'COVID19 rules apply',
      'DASHAIN2026 is the code for 10% off',
      'Early bird 100EUR',
      'MP3 and 4K video',
      'Chicken momo (10 pcs)',
      'FREE-WIFI in the hall',
    ]) {
      assert.equal(looksPersonal(s), false, s);
    }
  });
});

describe('redactContact', () => {
  it('replaces addresses and numbers, and hands them back for local use', () => {
    const r = redactContact('I am Ram, ram@example.de or 0176 1234 5678, event on 12.10.2026');
    assert.equal(r.text, 'I am Ram, [email] or [phone], event on 12.10.2026');
    assert.deepEqual(r.emails, ['ram@example.de']);
    assert.deepEqual(r.phones, ['0176 1234 5678']);
  });

  it('leaves a message with neither untouched', () => {
    const msg = 'A website for our Dashain festival, about 300 people';
    assert.deepEqual(redactContact(msg), { text: msg, emails: [], phones: [] });
  });

  it('finds several numbers', () => {
    assert.deepEqual(findPhones('+49 6151 123456 or 0176-9876543'), ['+49 6151 123456', '0176-9876543']);
  });
});
