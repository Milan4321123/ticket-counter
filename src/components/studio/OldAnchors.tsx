'use client';

import { useEffect } from 'react';

/** Sections that lived on the homepage until Nov 2026 and are now on /events. */
const MOVED = ['#events', '#shops', '#picks', '#watch', '#food'];

/**
 * Old links ("/#events" in a shared message, a cached Ask answer) land on the
 * studio homepage now — send them on to the same section of /events. Runs on
 * load and on a same-page hash change (a client-side Link keeps the page).
 */
export default function OldAnchors() {
  useEffect(() => {
    const go = () => {
      if (MOVED.includes(window.location.hash)) window.location.replace(`/events${window.location.hash}`);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, []);
  return null;
}
