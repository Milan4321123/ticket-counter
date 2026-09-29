'use client';

// Deutsch or नेपाली for the WHOLE site, not only the strings the hand-written
// dictionary (lib/i18n) knows. Mounted by the root layout when the visitor has
// picked a language other than English: it finds the English text on screen —
// long copy, sellers' descriptions and items, every portal page — and swaps in
// the translation from /api/translate (lib/translate caches each string once
// for everybody). New text that appears later (client navigation, a dialog,
// React re-rendering a line back to English) is caught by a MutationObserver.
//
// Only text nodes' VALUES are changed, never the nodes themselves, so React
// keeps working on the same DOM. What is never sent away: form fields, code,
// anything marked translate="no" or data-private (every buyer, customer,
// reviewer or asker name, email, phone, note and address is rendered inside
// one), strings that look like an email address, a phone number, a link, an
// IBAN or one of the site's codes (lib/personalText — checked again on the
// server), and the routes in SKIP_ROUTE.
//
// Why it matters: the text goes to Google's Gemini (unpaid tier, no processing
// terms — lib/gemini) and into a cache shared by every visitor (lib/translate).
// Only the site's own and the sellers' PUBLISHED words may make that trip.
import { useEffect } from 'react';
import type { Lang } from '@/lib/i18n';
import { looksPersonal } from '@/lib/personalText';

/**
 * Pages never translated: the platform's own admin and the staff door
 * scanner. The seller's orders, kitchen, check-in, live screen, insights and
 * statements ARE translated — every buyer name, email, note and reference on
 * them is marked translate="no", so only the page's own words are sent. So
 * are a buyer's own pages (order, ticket, account, customer card, subscribe):
 * a German buyer needs those in German most of all, and on each of them the
 * person's details are a few marked lines, not the page.
 */
const SKIP_ROUTE = /^\/(admin|scan)(\/|$)/;
const SKIP_INSIDE =
  'script,style,noscript,textarea,input,code,pre,kbd,samp,svg,[translate="no"],[data-private],.notranslate,[contenteditable="true"],.mono';
/**
 * Marks that keep an element's own attributes (a title or aria-label with a
 * buyer's name) at home too. data-private-attrs protects ONLY the element's
 * own attributes, for a card whose label names someone but whose text is ours.
 */
const PRIVATE_MARK = '[translate="no"],[data-private],[data-private-attrs],.notranslate';
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const LETTER = /\p{L}/u;
const DEVANAGARI = /[ऀ-ॿ]/;
const PRIVATE = /@|https?:\/\/|www\.|\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/;
const CODE_LIKE = /^[#A-Z0-9-]{2,40}$/;
const STORE_MAX = 5000;
/**
 * The browser's own copy of translations. v1 was written before names and
 * notes were kept out, so it is dropped (with the server's cache, lib/translate).
 */
const STORE_PREFIX = 'tx:v2:';
const OLD_PREFIXES = ['tx:v1:'];

export default function AutoTranslate({ lang }: { lang: Lang }) {
  useEffect(() => {
    if (lang === 'en') return;
    const root = document.documentElement;
    const storeKey = `${STORE_PREFIX}${lang}`;
    const cache = new Map<string, string>();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && OLD_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
      }
    } catch {
      // No storage: nothing old to clear.
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? '{}') as Record<string, string>;
      for (const [k, v] of Object.entries(saved)) cache.set(k, v);
    } catch {
      // No storage (private window): the server cache still answers.
    }

    // What each node said in English, and what we last wrote into it — so our
    // own writes are not mistaken for new English.
    const origText = new WeakMap<Text, string>();
    const wroteText = new WeakMap<Text, string>();
    const origAttr = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], string>>>();
    const waiting = new Map<string, Set<Text | [Element, (typeof ATTRS)[number]]>>();
    let disposed = false;

    const wanted = (s: string) =>
      s.length >= 2 &&
      s.length <= 1200 &&
      LETTER.test(s) &&
      !PRIVATE.test(s) &&
      !CODE_LIKE.test(s) &&
      !looksPersonal(s) &&
      !(lang === 'ne' && DEVANAGARI.test(s));

    const skipped = (el: Element | null) => !el || Boolean(el.closest(SKIP_INSIDE));

    function applyText(node: Text, core: string) {
      const english = origText.get(node) ?? '';
      const out = cache.get(core);
      if (!out) return false;
      const lead = english.match(/^\s*/)?.[0] ?? '';
      const trail = english.match(/\s*$/)?.[0] ?? '';
      const next = lead + out + trail;
      if (node.nodeValue !== next) {
        wroteText.set(node, next);
        node.nodeValue = next;
      }
      return true;
    }

    function applyAttr(el: Element, attr: (typeof ATTRS)[number], core: string) {
      const out = cache.get(core);
      if (!out) return false;
      if (el.getAttribute(attr) !== out) el.setAttribute(attr, out);
      return true;
    }

    function wait(core: string, item: Text | [Element, (typeof ATTRS)[number]]) {
      let set = waiting.get(core);
      if (!set) waiting.set(core, (set = new Set()));
      set.add(item);
    }

    function visitText(node: Text) {
      const value = node.nodeValue ?? '';
      if (wroteText.get(node) === value) return; // our own translation
      const core = value.trim();
      if (!wanted(core) || skipped(node.parentElement)) return;
      origText.set(node, value);
      if (!applyText(node, core)) wait(core, node);
    }

    function visitAttrs(el: Element) {
      if (skipped(el.parentElement) || el.matches(PRIVATE_MARK)) return;
      for (const attr of ATTRS) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const store = origAttr.get(el) ?? {};
        // Our own write looks like a translation of the stored English.
        if (store[attr] && cache.get(store[attr]!) === value) continue;
        const core = value.trim();
        if (!wanted(core)) continue;
        store[attr] = core;
        origAttr.set(el, store);
        if (!applyAttr(el, attr, core)) wait(core, [el, attr]);
      }
    }

    function scan(from: Node) {
      if (SKIP_ROUTE.test(location.pathname)) return;
      if (from.nodeType === Node.TEXT_NODE) {
        visitText(from as Text);
        return;
      }
      if (!(from instanceof Element)) return;
      if (skipped(from.parentElement)) return;
      if (from.hasAttributes()) visitAttrs(from);
      if (from.matches(SKIP_INSIDE)) return;
      const walker = document.createTreeWalker(from, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
          const el = n as Element;
          if (!el.matches(SKIP_INSIDE)) return NodeFilter.FILTER_ACCEPT;
          // A form field's own text is the visitor's; its hint is ours.
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') visitAttrs(el);
          return NodeFilter.FILTER_REJECT;
        },
      });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) visitText(n as Text);
        else if ((n as Element).hasAttributes()) visitAttrs(n as Element);
      }
    }

    let saveTimer = 0;
    function persist() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try {
          const entries = [...cache.entries()].slice(-STORE_MAX);
          localStorage.setItem(storeKey, JSON.stringify(Object.fromEntries(entries)));
        } catch {
          // Full or blocked storage: fine, the server remembers.
        }
      }, 800);
    }

    async function flush(): Promise<void> {
      const texts = [...waiting.keys()].filter((t) => !cache.has(t)).slice(0, 80);
      if (texts.length === 0 || disposed) return;
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, texts }),
        });
        const data = (await res.json().catch(() => null)) as { map?: Record<string, string> } | null;
        const map = data?.map ?? {};
        for (const t of texts) {
          const out = map[t];
          const items = waiting.get(t);
          waiting.delete(t);
          if (!out || !items) continue;
          cache.set(t, out);
          for (const item of items) {
            if (Array.isArray(item)) {
              if (item[0].isConnected) applyAttr(item[0], item[1], t);
            } else if (item.isConnected && origText.get(item)?.trim() === t) {
              applyText(item, t);
            }
          }
        }
        if (Object.keys(map).length) persist();
        // Strings that got no answer are dropped for this page view; the
        // English stays, and the next page view asks again.
        for (const t of texts) waiting.delete(t);
      } catch {
        for (const t of texts) waiting.delete(t);
      }
      if (waiting.size && !disposed) await flush();
    }

    let flushTimer = 0;
    const scheduleFlush = () => {
      window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => void flush(), 120);
    };

    const reveal = () => root.classList.remove('tx-wait');

    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') scan(r.target);
        else if (r.type === 'attributes') {
          if (r.target instanceof Element) visitAttrs(r.target);
        } else r.addedNodes.forEach((n) => scan(n));
      }
      if (waiting.size) scheduleFlush();
    });

    // Start once the page has finished hydrating, so React never meets text
    // it did not render. Until then the page is kept faded (html.tx-wait).
    const start = () => {
      if (disposed) return;
      scan(document.body);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRS],
      });
      if (waiting.size === 0) reveal();
      else {
        // Show the page as soon as the first answer lands — or after a short
        // wait at most; slow translations then fill in where they stand.
        const cap = window.setTimeout(reveal, 900);
        void flush().finally(() => {
          window.clearTimeout(cap);
          reveal();
        });
      }
    };
    let startTimer = 0;
    if (document.readyState === 'complete') startTimer = window.setTimeout(start, 0);
    else window.addEventListener('load', () => (startTimer = window.setTimeout(start, 0)), { once: true });

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(startTimer);
      window.clearTimeout(flushTimer);
      window.clearTimeout(saveTimer);
      reveal();
    };
  }, [lang]);
  return null;
}
