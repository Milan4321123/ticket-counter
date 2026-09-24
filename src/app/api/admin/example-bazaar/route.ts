import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** How many example shops are up right now (the seed script's marker). */
function exampleShopCount(): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE id LIKE 'seed-bazaar-%'`).get() as { n: number }).n;
}

interface Job {
  action: 'seed' | 'clean';
  startedAt: number;
  finishedAt: number | null;
  ok: boolean | null;
  /** The script's refusal line, or the tail of its output on failure. */
  note: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __exampleBazaarJob: Job | undefined;
}

function status() {
  const job = global.__exampleBazaarJob ?? null;
  return { shops: exampleShopCount(), job };
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
  }
  return NextResponse.json(status());
}

/**
 * Put up or take down the example bazaar (scripts/seed-bazaar.mjs) from the
 * admin panel — the same script, with the same refusals, run on the server so
 * the hosted site can be filled without a terminal. { action: 'seed' | 'clean' }.
 *
 * Runs in the BACKGROUND: rendering ~80 pictures takes minutes on a small
 * server, far longer than a request should wait. The panel polls GET.
 */
export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = body.action === 'clean' ? 'clean' : body.action === 'seed' ? 'seed' : null;
  if (!action) return NextResponse.json({ error: 'Unknown action.' } satisfies ApiErrorResponse, { status: 400 });
  const running = global.__exampleBazaarJob;
  if (running && running.finishedAt === null) {
    return NextResponse.json({ error: 'The example bazaar is already being updated — give it a few minutes.' } satisfies ApiErrorResponse, {
      status: 409,
    });
  }

  const script = path.join(process.cwd(), 'scripts', 'seed-bazaar.mjs');
  const args = action === 'clean' ? [script, '--clean'] : [script, '--all-shops', '--yes-seed-production'];
  const job: Job = { action, startedAt: Date.now(), finishedAt: null, ok: null, note: '' };
  global.__exampleBazaarJob = job;
  let output = '';
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-20_000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('close', (code) => {
    job.finishedAt = Date.now();
    job.ok = code === 0;
    job.note = code === 0 ? '' : /REFUSING TO SEED[^\n]*/.exec(output)?.[0] ?? output.trim().split('\n').slice(-3).join(' ').slice(0, 400);
    console.log(`[example-bazaar] ${action} exited ${code}:\n${output.slice(-4000)}`);
  });
  child.on('error', (e) => {
    job.finishedAt = Date.now();
    job.ok = false;
    job.note = String(e);
  });
  return NextResponse.json({ ok: true, started: true, ...status() }, { status: 202 });
}
