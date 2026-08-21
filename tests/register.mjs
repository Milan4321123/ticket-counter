/**
 * Test bootstrap. Loaded with `--import` so it runs BEFORE any test module is
 * evaluated — which is the whole point of it existing.
 *
 * Node's test runner forwards this flag to every per-file child process, so
 * each test FILE gets its own process and therefore its own copy of everything
 * below. That is what makes "a fresh database per test file" true rather than
 * hopeful: lib/db.ts caches its connection on a module global, and a per-file
 * process is the only place that cache is guaranteed empty.
 *
 * Three jobs, in this order:
 *   1. Point the app at a THROWAWAY data directory before lib/db.ts can read
 *      the variable. It resolves DATA_DIR once, at first getDb(), from
 *      process.env — so setting it here is early enough and setting it inside
 *      a test file would not be.
 *   2. Move cwd into that throwaway directory too. lib/db.ts's platform
 *      migration seeds the legacy event.config.json as a first event when a
 *      database has none, resolved from process.cwd(); a test process that
 *      stayed in the repo would start every file with a stray published event
 *      and a stray organizer nobody asked for. In the sandbox that file does
 *      not exist, so tests begin on a genuinely empty platform — and any other
 *      cwd-relative write (uploads, backups) lands in the throwaway too.
 *   3. Teach Node's resolver to read this repo's TypeScript import style.
 */
import { registerHooks } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

// ---------------- 1 + 2: the throwaway database ----------------

// Only in the runner's child processes. The parent process discovers test
// files against the repo's cwd, so chdir'ing there would break the glob.
if (process.env.NODE_TEST_CONTEXT) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), 'ticket-counter-test-'));

  // Belt and braces: if this ever resolved to the real data directory, the
  // suite must die rather than run migrations over the live database.
  const real = path.join(REPO_ROOT, 'data');
  if (sandbox === real || sandbox.startsWith(real + path.sep)) {
    throw new Error(`Refusing to run tests against the real data directory (${sandbox})`);
  }

  process.env.DATA_DIR = sandbox;
  process.chdir(sandbox);

  const clean = () => {
    try {
      rmSync(sandbox, { recursive: true, force: true });
    } catch {
      // A leftover temp directory is a nuisance, never a test failure.
    }
  };
  process.on('exit', clean);
}

// ---------------- 3: resolving the repo's TypeScript ----------------

/**
 * Two things Node's own resolver will not do, and which this repo's source
 * assumes because it is normally compiled by Next:
 *
 *   - extensionless relative imports (`import { getDb } from './db'`), which
 *     ESM requires an extension for;
 *   - the `@/*` alias from tsconfig.json's `paths`, which Node never reads.
 *
 * Rewriting the ~19k lines of src/ to please the test runner would be the tail
 * wagging the dog, and would mean the tests exercise a differently-spelled
 * copy of the app. So the resolver learns the repo's dialect instead. Nothing
 * here invents a module: every rewrite must land on a file that exists, or the
 * specifier is passed through untouched and Node reports the miss as usual.
 */
const SOURCE_EXT = /\.[cm]?[jt]sx?$/;

function firstExisting(hrefs) {
  for (const href of hrefs) {
    if (existsSync(fileURLToPath(href))) return href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;

    if (spec === '@' || spec.startsWith('@/')) {
      spec = pathToFileURL(path.join(REPO_ROOT, 'src', spec.slice(2))).href;
    }

    const relative = spec.startsWith('./') || spec.startsWith('../');
    if ((relative || spec.startsWith('file:')) && !SOURCE_EXT.test(spec)) {
      const base = relative ? new URL(spec, context.parentURL).href : spec;
      const hit = firstExisting([`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]);
      if (hit) return nextResolve(hit, context);
    }

    try {
      return nextResolve(spec, context);
    } catch (err) {
      // Bare subpaths that only a bundler resolves. `next/headers` is a real
      // file (node_modules/next/headers.js) with no "exports" entry, so ESM
      // will not find it without the extension while webpack will. Retrying
      // with .js keeps lib/organizers.ts importable AS WRITTEN rather than
      // making the app spell its imports to suit the test runner.
      const missing = err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
      if (missing && !relative && !SOURCE_EXT.test(spec) && spec.includes('/')) {
        return nextResolve(`${spec}.js`, context);
      }
      throw err;
    }
  },
});
