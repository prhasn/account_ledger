# In-Memory Account Ledger Core

A deterministic, in-memory account ledger that replays a six-day event stream and prints, per day:

- closing ledger balances
- overdraft fee assessments
- authorization states and available balances
- rejected events and errors
- daily interest accruals

There is no web layer, no database, no persistence, and no UI. Money is stored as `bigint` minor units. The event log is append-only, and every projection is rebuildable from it.

Repository: https://github.com/prhasn/account_ledger
Architecture (GitHub Pages): https://prhasn.github.io/account_ledger/architecture.html
Architecture PDF: https://prhasn.github.io/account_ledger/architecture.pdf

## Requirements

- Node.js 20 or newer
- npm 10 or newer

No application runtime libraries. TypeScript, `tsx`, and Node types are development tooling used to execute and check the TypeScript source.

## Run

```bash
npm ci
npm start
npm test
npm run test:known-failure
npm run typecheck
npm run pdf
```

`npm start` prints the six-day report. `npm test` type-checks the project and runs the passing suite. `npm run test:known-failure` runs exactly one test that is designed to fail, and exits with status 1. The committed `docs/architecture.pdf` is the deliverable; `npm run pdf` regenerates it and requires Chromium and `pdfinfo`.

`make install`, `make start`, `make test`, `make known-failure`, `make typecheck`, and `make pdf` are equivalent shortcuts.

### Editor note

`tsconfig.json` targets ES2020, the minimum target for BigInt literals, and `npm run typecheck` passes. If an editor still reports `BigInt literals are not available when targeting lower than ES2020`, the editor is checking the files with a different compiler configuration. Use these steps:

1. Open the repository root as the workspace, not a parent folder.
2. Run `npm ci` so `node_modules/typescript/lib` exists.
3. In VS Code, run `TypeScript: Select TypeScript Version`, then choose **Use Workspace Version**.
4. Run `TypeScript: Restart TS Server`, then `Developer: Reload Window`.
5. Run `npm run typecheck`. Do not run `tsc` against a single file, which ignores `tsconfig.json`.

The `.vscode/settings.json` file points VS Code at the workspace TypeScript compiler.

## How to read the output

Each day block contains:

1. Input events posted that day, with event id, kind, account, amount, value day, and status.
2. Ledger closes per account, showing the pre-fee close, fee, post-fee close, interest accrual, active holds, and available balance.
3. Authorization states at the close of that day.
4. Errors raised that day.

At the end the report prints:

- restatements of each value-dated close at the end of Day 5, before fees
- restatements at the end of Day 6, before capitalization
- fee assessments
- daily interest accruals
- the single capitalization credit per account
- final balances
- append-only counts

## Expected result

Historical end-of-day closes under the chosen policy:

| Day | ACC-001 pre-fee | Fee | ACC-001 post-fee | ACC-001 interest | ACC-002 close | ACC-002 interest |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 250.00 | 0.00 | 250.00 | 0.10 | 0.000 | 0.000 |
| 2 | 250.00 | 0.00 | 250.00 | 0.10 | 0.000 | 0.000 |
| 3 | 650.00 | 0.00 | 650.00 | 0.26 | 0.000 | 0.000 |
| 4 | 465.00 | 0.00 | 465.00 | 0.19 | 0.000 | 0.000 |
| 5 | -155.00 | 25.00 | -180.00 | 0.00 | 10.000 | 0.004 |
| 6 | 440.00 | 0.00 | 440.00 | 0.18 | 10.000 | 0.004 |

Capitalization at the end of Day 6:

- ACC-001: `0.10 + 0.10 + 0.26 + 0.19 + 0.00 + 0.18 = 0.83`
- ACC-002: `0.004 + 0.004 = 0.008`

Final balances:

- ACC-001: **440.83 AED**
- ACC-002: **10.008 BHD**

## Restatements

At the end of Day 5, before the fee is assessed, the value-dated closes are:

| Day | ACC-001 | ACC-002 |
|---:|---:|---:|
| 1 | 250.00 | 0.000 |
| 2 | -370.00 | 0.000 |
| 3 | 30.00 | 0.000 |
| 4 | -155.00 | 0.000 |
| 5 | -155.00 | 10.000 |

Day 3 is positive. This matters: a retroactive fee policy would assess fees on Days 2, 4, and 5, not on Day 3, and not only on Day 2.

At the end of Day 6, before capitalization, the restated closes are:

| Day | ACC-001 | ACC-002 |
|---:|---:|---:|
| 1 | 250.00 | 0.000 |
| 2 | 250.00 | 0.000 |
| 3 | 650.00 | 0.000 |
| 4 | 465.00 | 0.000 |
| 5 | 440.00 | 10.000 |
| 6 | 440.00 | 10.000 |

The Day 5 fee remains after E9. The reversal restores E7's principal, not the fee, and not the interest that was not accrued on Day 5.

## Authorizations and errors

- `Auth-A`: approved on Day 2 with `50.00` available after the `200.00` hold. Settles on Day 4 for `185.00`; the remaining `15.00` hold is released. Final state: `SETTLED`.
- `Auth-B`: declined on Day 5. The ledger is `-155.00` before the hold; a `90.00` hold would leave `-245.00` available. Final state: `DECLINED`, no hold.
- `Auth-Z`: unknown. E6 is rejected with `UNKNOWN_AUTHORIZATION`; no debit is posted. E6 remains in the input event log with a `REJECTED` outcome.
- Overdraft fee: one assessment, Day 5, ACC-001, `25.00 AED`.
- Errors: one, E6.

## Design decisions

**Posting order is authoritative.** The stream is processed by posting day; events within a day keep their input order. A value date changes the as-of balance for reporting, but it does not reorder events that have already posted.

**End-of-day, as-at assessment.** Fees and interest are assessed at each day's close using the ledger as known at that close. A backdated entry posted later affects current and future closes and the restatement view, but it does not reopen a closed day's fee or interest decision. The alternative, retroactive true-up, is documented and rejected; the intentional failing test encodes it.

**Fees before interest.** The fee is booked first. Interest is accrued on the post-fee close, so a fee that pushes the close negative prevents that day's interest.

**Interest is the sum of rounded daily accruals.** The capitalization credit equals the sum of the daily rounded accruals, not the rounded sum of unrounded daily balances. This preserves `0.83` for ACC-001 instead of losing a minor unit to an aggregate `0.82`.

**Instalments use largest remainder.** `10.000 / 3` becomes `3.334 + 3.333 + 3.333`. Three equal `3.334` instalments would total `10.002`; three equal `3.333` would total `9.999`.

**Holds are off-ledger.** An authorization changes available balance and authorization state. It does not create a ledger entry. A settlement creates the ledger debit and releases the hold.

**Append-only.** Input events are never mutated. Ledger entries, fee entries, capitalization entries, and authorization transitions are appended. The authorization map and daily snapshots are derived projections.

## Acceptance criteria verdict

| Criterion | Verdict |
|---|---|
| A. Day 2 close at end of Day 5 pre-fee is `-370.00` | Accepted |
| B. E7 causes exactly one fee on Day 2 | Rejected |
| C. Day 4 Auth-A settlement accepted | Accepted |
| D. Unknown-auth settlement rejected, no funds leave | Accepted, with terminology correction |
| E. If Auth-B is approved, hold reduces available not ledger | Rejected as stated; hold mechanics accepted |
| F. After E9 all balances and fees return | Rejected |
| G. Three BHD instalments each `3.334` | Rejected |
| H. Interest remainder discarded | Rejected |

Full reasons are in `REJECTED.md`. The main calculation differences are in `NUMBERS.md`. Every ambiguity, including the E10 stream-order question, is in `AMBIGUITIES.md`.

## Stream order note for E10

The prompt lists E9 (Day 6) before E10 (Day 5). The engine groups by posting day, so E10 is processed on Day 5 and E9 on Day 6. Within a day, input order is preserved. This is a deliberate resolution of the conflicting order signals: the Day 5 label and value date control the close, while E10's position in the prompt is treated as presentation order.

Impact: ACC-002 earns `0.004` on Day 5 and `0.004` on Day 6, for `10.008` final. Literal stream order would post E10 after the Day 5 close, producing only Day 6 interest and `10.004` final. ACC-001 and all acceptance criteria are unaffected. See `AMBIGUITIES.md` entry A17.

## Repository map

```text
src/types.ts       all interfaces, types, and enums
src/money.ts       bigint minor units, parsing, formatting, rounding, splitting
src/constants.ts   account, fee, interest, and window constants
src/engine.ts      append-only ledger, holds, settlement, reversal, fees, interest
src/scenario.ts    the ten input events and replay loop
src/render.ts      day blocks, restatements, capitalizations, summary
src/main.ts        CLI entrypoint
tests/             30 passing tests
known_failure/     one intentionally failing, annotated test
docs/              architecture HTML source and PDF
```

## Documents

- `NUMBERS.md`: constants, derivations, and why each value was chosen.
- `AMBIGUITIES.md`: every ambiguity and its resolution.
- `REJECTED.md`: refused criteria and abandoned approaches.
- `WORKLOG.md`: timestamped build log.
- `docs/architecture.pdf`: 2 to 4 page architecture and trade-offs document.
- GitHub Pages version: https://prhasn.github.io/account_ledger/architecture.html

## Known failure

`known_failure/retroactive-fee.test.ts` asserts that E7 would retroactively charge Days 2, 4, and 5. The actual result is one Day 5 fee. The test is intentionally red and is excluded from `npm test`. The inline comments mark the policy boundary; `REJECTED.md` explains the alternative and why it was not adopted.
