# WORKLOG

All times are UTC. The repository uses timestamps from the build session; commit times are local `+07:00` and appear in `git log`.

## 2026-11-24

**11:49Z** Inspected the repository. It was empty with no commits. The configured remote is `https://github.com/prhasn/account_ledger`, the GitHub CLI is authenticated as `prhasn`, and the repository is public and empty. Python 3.14, Node 24.8, npm 11.6, Chromium, and `pdfinfo` were available. No `pytest` or `tsx` was installed.

**11:55Z** Designed the ledger semantics before writing code. The main decision was end-of-day as-at assessment: fees and interest use the close as known at that close, and a later backdated entry restates the as-of view without reopening closed periods. The alternative retroactive true-up was kept as a documented rejection.

**12:10Z** Recalculated the event stream. The restated closes at the end of Day 5 are Day 2 `-370.00`, Day 3 `+30.00`, Day 4 `-155.00`, Day 5 `-155.00`. The Day 3 positive balance was easy to miss and is important for the fee-count argument. The selected policy produces one Day 5 fee; retroactive true-up would produce three fees on Days 2, 4, and 5.

**12:25Z** Switched the implementation plan to TypeScript at the user's request. Loaded the DegreeSign coding skill and read `skills/coding/typescript.md` and `skills/coding/workflow.md`. Adjusted the plan to a dedicated `src/types.ts`, enums for shared statuses, object parameters, no `forEach`, exports at the end of files, and no em dashes.

**12:52Z** Created the project scaffold: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, and `Makefile`. Installed 32 development packages with `npm install --no-audit --no-fund`. Committed as `chore: scaffold typescript ledger project`.

**12:54Z** Added `src/types.ts`, `src/money.ts`, and `src/constants.ts`. Money is `bigint` minor units. Added half-up rounding, exact decimal parsing, formatting, and largest-remainder instalment splitting. Committed as `feat: add bigint money and domain types`.

**12:56Z** Added `src/engine.ts`: append-only ledger entries, authorization projection and transitions, partial settlement, unknown-auth rejection, reversal, fee assessment, daily accrual, and capitalization. Committed as `feat: implement append-only ledger engine`.

**12:57Z** Added `src/scenario.ts`, `src/render.ts`, and `src/main.ts`. The first CLI run produced the expected numbers: Day 2 restatement `-370.00`, Day 3 `+30.00`, Day 5 pre-fee `-155.00`, fee `25.00`, final ACC-001 `440.83`, final ACC-002 `10.008`. Committed as `feat: add scenario replay and cli report`.

**13:00Z** Wrote the first version of the scenario test with the event log expected in literal prompt order, `E1` through `E10`. The test failed: the actual order was `E1` through `E8`, then `E10`, then `E9`. The cause is posting-day grouping: E10 is Day 5 and E9 is Day 6. This exposed the stream-order ambiguity in A17. Decided to keep posting-day grouping, document the alternative, and change the test to assert the actual replay order.

**13:09Z** Ran the full passing suite: 30 tests, 30 pass. Ran `npm run test:known-failure`: one test, one failure, actual `[5]` versus expected `[2, 4, 5]`. The failure is the intended retroactive-fee boundary. Committed the suite and known failure as `test: add passing suite and annotated known failure`.

**13:10Z** An editor reported `BigInt literals are not available when targeting lower than ES2020`. `npx tsc --noEmit` passed with `target: ES2023`. The editor was not using the workspace TypeScript. Added `.vscode/settings.json` pointing at `node_modules/typescript/lib`. The local compiler has remained green since then.

**13:18Z** Started the required documents. `README.md`, `NUMBERS.md`, `AMBIGUITIES.md`, and `REJECTED.md` were drafted with the exact reported numbers, the E10 ordering note, the rejected criteria, and the abandoned approaches.

**13:55Z** Wrote `docs/architecture.html` with the four required sections. Added `scripts/build-pdf.sh` and generated the PDF with headless Chromium. The first layout pass was three pages, but a forced page break before section 3 left a nearly empty second page. Removed that break, kept the break before section 4, and rebuilt. Final PDF is three A4 pages. Verified with `pdfinfo` and inspected page images.

**14:06Z** Re-ran `npm test`: 30 tests pass. Re-ran `npm run test:known-failure`: one intentional failure, actual `[5]` versus expected `[2, 4, 5]`. Checked the repository for em dashes and en dashes, and found none. Confirmed `git status` contains only the new documentation and PDF files.

**14:10Z** Committed the documentation and PDF locally. Per the user's instruction, no push or remote sync was performed.

**14:16Z** Ran `npm ci` and `npm test` from a clean dependency install: 30 tests pass. Re-ran the known-failure command: one failure, actual `[5]` versus expected `[2, 4, 5]`. Confirmed the PDF is three A4 pages, the working tree is clean, and no em dashes or en dashes remain. No push was made.

**14:47Z** Added GitHub Pages links for `architecture.html` and `architecture.pdf` to `README.md`, assuming GitHub Pages serves the `docs` directory as the site root. Folded the documentation commits into one local commit as requested; the feature, test, and style commits remain. Re-ran `npm test`: 30 tests pass. No push was made.
