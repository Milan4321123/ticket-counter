'use client';

import { useEffect, useState } from 'react';
import { readConsentRecord, setConsent, subscribeConsent, type ConsentRecord } from '@/lib/consent';

/**
 * Where a visitor changes their mind — on /privacy, where they went looking.
 *
 * Withdrawal has to be as easy as consent was (Art. 7(3) GDPR), which means a
 * button on a page they can find, not an email address and a wait. Pressing it
 * stops the tag within this page view and deletes the cookies Google already
 * set, so "withdrawn" means withdrawn rather than "stopped counting you under
 * the identifier we left on your device".
 *
 * It also states the CURRENT answer, including when it was given. A control
 * that does not say what it is currently set to leaves somebody pressing
 * buttons to find out, which for a privacy choice is the worst possible way to
 * learn.
 */
export default function ConsentControl() {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID ?? '';
  const [record, setRecord] = useState<ConsentRecord | null | undefined>(undefined);

  useEffect(() => {
    setRecord(readConsentRecord());
    return subscribeConsent(() => setRecord(readConsentRecord()));
  }, []);

  if (!measurementId) return null;
  // undefined = the browser has not been read yet. Rendering "you are not
  // being counted" before knowing would be a claim, and a wrong one half the
  // time.
  if (record === undefined) return null;

  const granted = record?.choice === 'granted';
  const when =
    record && record.at > 0
      ? new Date(record.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  return (
    <div className="consent-state">
      <span className="consent-state-now">
        {granted
          ? `You agreed to be counted${when ? ` on ${when}` : ''}.`
          : record
            ? 'You are not being counted.'
            : 'You have not been asked yet — nothing is running.'}
      </span>
      {granted ? (
        <button type="button" className="btn btn-sm" onClick={() => setConsent('denied')}>
          Stop counting me
        </button>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setConsent('granted')}>
          Count my visits
        </button>
      )}
    </div>
  );
}
