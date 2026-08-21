# Tests

```sh
npm test              # the whole suite
npm test -- tests/money.test.ts        # one file
npm test -- --test-name-pattern=percent  # one test, by name
npm run test:watch    # re-run on change
```

No test framework is installed. The runner is Node's own (`node:test` +
`node:assert/strict`) reading this repo's TypeScript directly through
`--experimental-transform-types`. There is no build step and no new dependency.

## What is here

| file | what it is |
| --- | --- |
| `register.mjs` | the bootstrap: throwaway database, sandboxed cwd, module resolution. Loaded with `--import`, before any test module exists. |
| `helpers.ts` | the fixture layer: `makeOrganizer`, `makeEvent`, `makeTier`, `makeOrder`, `makePaidOrder`, `makePromo`. |
| `harness.test.ts` | the harness testing itself — the fixtures reach the real lib functions, and the database really is empty and really is a temp file. |
| `tenancy.test.ts` | the exception to the naming rule: one AREA, not one module. Tenant isolation and privacy are properties of how `events`/`orders`/`analytics`/`retention`/`marketing`/`cards`/`stalls` behave *together*, and its fixture — two organizers with the same buyers, the same tier keys and the same promo code string — is the whole point. |
| `orders.per-address-ceiling.test.ts` | the other exception: it calls an exported route handler (`POST /api/orders`) in-process. The anti-hoarding ceiling is written inline in that handler and exists in no lib function, so a test here could only re-derive its formula — and agree with a broken one. In-process means a plain `Request` object: no server, no socket, and SMTP unset so every send short-circuits. |
| `*.test.ts` | one file per module under test, named after it. |

## The database

**Every test file gets its own brand-new SQLite database in a temp directory,
and `data/tickets.db` is never opened.**

`register.mjs` makes that true, and it has to run before anything else because
`lib/db.ts` reads `DATA_DIR` once, at the first `getDb()`. Node's test runner
gives every test *file* its own process and forwards `--import` to each one, so
"fresh per file" is a property of the process, not of a cleanup routine that
somebody has to remember to call. Within one file, state accumulates — order
your tests accordingly, or build a fresh organizer per test (`makeOrganizer()`
never collides).

The bootstrap also moves `cwd` into the same temp directory. That is not
tidiness: `lib/db.ts`'s platform migration seeds `event.config.json` as a first
event whenever a database has none, resolved from `process.cwd()`, so a test
process left in the repo would start with a stray published event and a stray
organizer. In the sandbox that file does not exist and the platform starts
genuinely empty. Real migrations still run in full — the schema under test is
the schema production gets.

`helpers.ts`'s `db()` re-checks, on every call, that `DATA_DIR` is under the
system temp directory, and throws rather than proceed. If you ever see that
error, you are not running through `npm test`.

## What belongs here

Money and the rules around it — `orders`, `referrals`, `promos`, `inventory`,
`capacity`, `payout`, `retention`, `money`. Roughly 3,800 lines that decide what
a person is charged, what a seller is owed, and how many seats exist. That is
what this harness was built for.

Not here: React components, route handlers as HTTP, anything needing a running
server, and anything that would send an email or reach the network.

The one carve-out is a rule about money that lives ONLY in a route handler and
nowhere else — today that is the per-address ceiling. Import the exported
handler and call it with a `Request`; that is a function call, not HTTP, and it
keeps the "a test must fail if the behaviour changes" rule ahead of the layer
boundary. Do not reach for it when a lib function holds the same rule.

## The rules

**A fixture goes through the real lib function.** `makePaidOrder()` runs
`createOrder` → `claimInventory` → `finalizePaidOrder`, because an order poked
to `'paid'` with an `UPDATE` has no tickets, has consumed no inventory, and
would let a broken `finalizePaidOrder` pass every test built on it. Raw SQL is
allowed only where no lib function exists — today that is events and tiers,
which the portal's route handlers write inline; those two `INSERT`s mirror the
handlers' own and are marked in `helpers.ts`. If you add a fixture, look for the
lib function first.

**A test must fail if the behaviour it describes changes.** This is the whole
point of the harness and the only rule with no exceptions. A test that still
passes after you break the rule it names is worse than no test: it is a green
tick that says the money is safe when it is not. Two concrete habits:

- Assert the *number*, not that a number came back. `assert.equal(d, 200)` bites
  when rounding flips; `assert.ok(d > 0)` does not.
- Prove it, once, by hand. Break the behaviour in `src/`, watch the test fail,
  put it back. If nothing went red, the test is decoration.

**If a test surfaces a real bug, report the bug.** Do not adjust the expectation
to match what the code does today. Write the test for the behaviour that is
correct, and say so in the comment above it — a failing test naming a real
defect is a working test.

**Say why in a comment.** Same house rule as the rest of the repo. A test whose
comment explains which rule it protects survives a refactor; one that only
restates its own assertions gets deleted by the next person.
