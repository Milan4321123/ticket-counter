/**
 * THE STUDIO'S PROJECT LIST STAYS HONEST AND NAVIGABLE.
 *
 * lib/projects.ts drives /studio (with its filter chips), the homepage's demo
 * strip, the /work gallery and each demo's prev / next links. These pin the
 * pure helpers behind all four — and the labelling rule: a live demo is always
 * marked as a demo and never as real client work.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_DEMOS,
  PROJECTS,
  PROJECT_FILTERS,
  asProjectFilter,
  demoHref,
  demoNeighbours,
  filterCounts,
  isLiveDemo,
  projectFilters,
} from '../src/lib/projects.ts';

test('live demos are the projects with a /work/* page, in list order', () => {
  assert.deepEqual(
    LIVE_DEMOS.map((p) => p.id),
    PROJECTS.filter((p) => p.links.some((l) => l.href.startsWith('/work/'))).map((p) => p.id)
  );
  assert.ok(LIVE_DEMOS.length >= 5);
  for (const p of LIVE_DEMOS) {
    assert.match(demoHref(p)!, /^\/work\/[a-z-]+$/);
    assert.ok(p.cover.src && p.cover.width && p.cover.height, `${p.id} needs a sized cover`);
    assert.ok(p.tryIt, `${p.id} needs a one-line tryIt`);
  }
});

test('a demo is labelled a demo and never as real client work', () => {
  for (const p of PROJECTS) {
    if (isLiveDemo(p)) {
      assert.equal(p.example, true, `${p.id} is a demo`);
      assert.notEqual(p.real, true, `${p.id} must not claim to be real`);
      assert.match(p.client, /demo/i, `${p.id}'s client line says demo`);
    }
    if (p.real) assert.notEqual(p.example, true, `${p.id} cannot be real and an example`);
  }
  assert.ok(PROJECTS.some((p) => p.real), 'some real client work is marked');
});

test('no prices or hire wording in any project text', () => {
  const words = /€|\beur\b|\bprice|\bquote|\brate[sd]?\b|\bpackage|\bhire\b|\bfee\b/i;
  for (const p of PROJECTS) {
    const text = [p.title, p.client, p.outcome, p.tryIt ?? '', ...p.points, ...p.links.map((l) => l.label)].join(' ');
    assert.doesNotMatch(text, words, p.id);
  }
});

test('filters and their counts follow the tags, plus "demos"', () => {
  const wedding = PROJECTS.find((p) => p.id === 'wedding')!;
  assert.deepEqual(projectFilters(wedding), ['websites', 'demos']);
  const npjoe = PROJECTS.find((p) => p.id === 'npjoe')!;
  assert.deepEqual(projectFilters(npjoe), ['websites', 'videos']);

  const counts = filterCounts(PROJECTS);
  assert.equal(counts.all, PROJECTS.length);
  assert.equal(counts.demos, LIVE_DEMOS.length);
  assert.equal(counts.apps, PROJECTS.filter((p) => p.tags.includes('App')).length);
  assert.equal(counts.websites, PROJECTS.filter((p) => p.tags.includes('Website')).length);
  assert.equal(counts.videos, PROJECTS.filter((p) => p.tags.includes('Video')).length);
  assert.deepEqual(filterCounts([]), { all: 0, apps: 0, websites: 0, videos: 0, demos: 0 });
});

test('?tag= takes singular, plural and "live", anything else is all', () => {
  for (const f of PROJECT_FILTERS) assert.equal(asProjectFilter(f), f);
  assert.equal(asProjectFilter('app'), 'apps');
  assert.equal(asProjectFilter('Website'), 'websites');
  assert.equal(asProjectFilter('demo'), 'demos');
  assert.equal(asProjectFilter('live'), 'demos');
  assert.equal(asProjectFilter('video'), 'videos');
  assert.equal(asProjectFilter('prices'), 'all');
  assert.equal(asProjectFilter(''), 'all');
  assert.equal(asProjectFilter(undefined), 'all');
  assert.equal(asProjectFilter(['apps']), 'all');
});

test('prev / next walk the demos in order and wrap round', () => {
  const ids = LIVE_DEMOS.map((p) => p.id);
  const first = demoNeighbours(ids[0])!;
  assert.equal(first.prev.id, ids[ids.length - 1]);
  assert.equal(first.next.id, ids[1]);
  const last = demoNeighbours(ids[ids.length - 1])!;
  assert.equal(last.next.id, ids[0]);
  assert.equal(demoNeighbours('npjoe'), null, 'not a demo');
  assert.equal(demoNeighbours('nope'), null);
  assert.equal(demoNeighbours(ids[0], [LIVE_DEMOS[0]]), null, 'one demo has no neighbours');
});
