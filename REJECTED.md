# REJECTED

This document refuses the acceptance criteria that do not survive the rules and the replay. It also records approaches that were tried or considered and then abandoned.

## Criteria verdict

| Criterion | Verdict | Short reason |
|---|---|---|
| A. Day 2 close at end of Day 5 pre-fee is `-370.00` | **Accepted** | `250.00 - 620.00 = -370.00`; this is the restatement view, not the historical Day 2 close. |
| B. E7 causes exactly one fee on Day 2 | **Rejected** | One fee is assessed on Day 5. Under retroactive true-up there are three fees, on Days 2, 4, and 5. Never one on Day 2. |
| C. Day 4 Auth-A settlement accepted | **Accepted** | Auth-A is active with a `200.00` hold; the `185.00` settlement is within it. The residual `15.00` is released. |
| D. Unknown-auth settlement rejected, no funds leave | **Accepted, terminology corrected** | Auth-Z is unknown; E6 is rejected and no debit posts. Authorizations are not ledger entries; they are in the authorization register. |
| E. If Auth-B is approved, hold reduces available not ledger | **Rejected as stated; invariant accepted** | Auth-B is not approved. At E8 the ledger is `-155.00`; a `90.00` hold gives `-245.00` available. |
| F. After E9 all balances and fees return | **Rejected** | E9 reverses principal only. The Day 5 fee remains; final is `440.83`, not `466.03`. |
| G. Three BHD instalments each `3.334` | **Rejected** | `3 * 3.334 = 10.002`, which exceeds the `10.000` credit. |
| H. Interest remainder discarded | **Rejected** | The rounded daily accruals must sum exactly to the capitalised total. ACC-001 capitalises `0.83`, not `0.82`. |

## B. E7 causes exactly one fee on Day 2

This criterion is wrong under both defensible fee policies.

**Our policy: end-of-day as-at.** Day 2 closed at `250.00` before E7 existed. E7 posts on Day 5 and makes the Day 5 close `-155.00`. The fee is assessed on Day 5, with value date Day 5. That is one fee, but not on Day 2.

**Retroactive true-up.** If E7 reopens value-dated closes, the affected balances are:

| Day | Restated balance before fees | Negative? |
|---:|---:|---|
| 2 | -370.00 | Yes |
| 3 | +30.00 | No |
| 4 | -155.00 | Yes |
| 5 | -155.00 | Yes |

That is three fees, on Days 2, 4, and 5, totaling `75.00`. It is not one fee, and it is not a fee on Day 2 alone.

**Why Day 3 is positive.** Day 3 contains E4's `+400.00` credit. The sequence is `250.00 + 400.00 - 620.00 = +30.00`. A reviewer who assumes every day after a backdated debit is negative will overcount the retroactive fees.

The criterion fails on both the count and the day. The intentional failing test encodes the retroactive alternative to make this boundary visible.

## E. If Auth-B is approved, its hold reduces available but not ledger

The second clause is a correct invariant: a hold reduces available balance and does not create a ledger entry. The first clause is false for this run.

At E8:

```text
ledger balance before Auth-B        -155.00
active holds before Auth-B            0.00
available before Auth-B             -155.00
Auth-B hold requested                 90.00
available after applying hold        -245.00
```

The authorization rule requires available to remain at or above zero. `-245.00` is below zero, so Auth-B is declined. It has no remaining hold.

The criterion is written as a conditional. In formal logic, a false antecedent makes the implication vacuously true. That is not useful as an acceptance criterion: it does not tell a reviewer what the system should do. We refuse it as a statement about this run and accept the hold-accounting rule as a general invariant.

## F. After E9 all balances and fees return to pre-E7 values

E9 reverses E7's `620.00` principal. It does not reverse the Day 5 fee, and it does not retroactively accrue Day 5 interest.

| Item | Before E7 | After E9 |
|---|---:|---:|
| Day 5 close | 465.00 | -180.00 historical; 440.00 restated |
| Fee assessed | 0.00 | 25.00 |
| ACC-001 final | 466.03 if E7 never existed | 440.83 |
| Day 5 interest | 0.19 if E7 never existed | 0.00 |

The fee is a booked ledger event. E9 references E7, not the fee. Refunding it would require a separate credit event with its own approval and reason. The append-only event log would then show the reversal and the refund as two distinct decisions, which is the correct audit trail.

The `466.03` figure comes from the no-E7 path: balances `250.00`, `250.00`, `650.00`, `465.00`, `465.00`, `465.00`; accruals `0.10`, `0.10`, `0.26`, `0.19`, `0.19`, `0.19`; total `1.03`. The actual path pays a `25.00` fee and earns `0.83` interest.

## G. The three BHD instalments must each be BHD 3.334

`10.000 / 3` is `3.333333...`. At 3 decimal places, the choices are:

- `3.334 + 3.334 + 3.334 = 10.002`, which overstates the credit by `0.002`.
- `3.333 + 3.333 + 3.333 = 9.999`, which understates the credit by `0.001`.
- `3.334 + 3.333 + 3.333 = 10.000`, which is exact.

The engine uses largest-remainder allocation: base `3.333`, remainder `0.001`, extra minor unit to the first instalment. The three ledger entries sum exactly to the `10.000` credit.

## H. If the rounded daily interest accruals do not sum to the capitalized total, the remainder is discarded

The rule says the rounded daily accruals must sum exactly to the capitalised total. Discarding a remainder violates that requirement.

For ACC-001:

```text
rounded daily: 0.10 + 0.10 + 0.26 + 0.19 + 0.00 + 0.18 = 0.83
unrounded sum rounded once: round(0.822) = 0.82
```

The engine capitalises `0.83` because that is the sum of the daily accruals that the report displays. If a separate control total of `0.82` were imposed, the difference would be allocated to a daily accrual with a documented deterministic rule. It would not be discarded, and it would not be silently absorbed into an unexplained residual.

## A. Day 2 closing balance at the end of Day 5 pre-fee is negative 370

This criterion is accepted, with one clarification. The historical Day 2 close, measured when Day 2 actually closed, is `+250.00`. The `-370.00` figure is the value-dated restatement evaluated at the end of Day 5 before fees:

```text
1200.00 - 950.00 - 620.00 = -370.00
```

The qualifier "before any fee is assessed" matters if one considers retroactive fees. Under our policy the Day 2 restatement is unaffected by the Day 5 fee because the fee's value date is Day 5. Under a retroactive policy a Day 2 fee would make the figure `-395.00`.

## C. Day 4 Auth-A settlement must be accepted

Auth-A is approved on Day 2:

```text
ledger 250.00 - hold 200.00 = available 50.00
```

On Day 4, before E7 posts, the ledger is `465.00` and the active hold is `200.00`. The settlement is `185.00`, which is within the hold. The settlement is accepted, debits `185.00`, releases the `200.00` hold, and makes the residual `15.00` available. The final ledger is `465.00`.

E7 is posted on Day 5 and value dated Day 2. It does not retroactively invalidate a hold that was approved when the account had `50.00` available. Even if E7 were known, the settlement is within the hold; the authorization rule constrains approval, not settlement against an existing commitment.

## D. Any settlement referencing an authorization ID not present in the ledger must be rejected

The substance is accepted: E6 references Auth-Z, which has no authorization record, so E6 is rejected and no funds leave ACC-001. The wording needs a correction because authorizations are not ledger entries. Holds are off-ledger by design, as criterion E itself notes. A literal reading would also reject E5, because Auth-A is not "in the ledger" either.

The engine treats "present in the ledger" as "present in the authorization register." E6 is recorded in the input event log with status `REJECTED` and error `UNKNOWN_AUTHORIZATION`. No debit entry is created.

## Abandoned approaches

### Retroactive fee true-up

**What it was.** On E7's arrival, recompute Days 2 through 5 and assess a fee for each negative day that had not yet been charged.

**Why it was abandoned.** It reopens closed periods, creates a retroactive liability, and conflicts with the once-per-day and append-only framing. It would also produce three fees, not the one Day 2 fee criterion B claims. It requires a policy for whether fees themselves feed further fee calculations, and a policy for whether E9 refunds them.

**What it would produce.** Fees on Days 2, 4, and 5, total `75.00`; ACC-001 final `390.26`; ACC-002 final `10.008`. The intentional failing test records this alternative.

### Literal stream order for E10

**What it was.** Process E9 before E10 because the prompt lists E9 first, even though E10 is labeled Day 5.

**Why it was abandoned.** E10 would arrive after the Day 5 close. It would either reopen Day 5 or be treated as a Day 6 posting with a Day 5 value date, contradicting both of its labels. The event is on a separate account and does not affect any ACC-001 rule or criterion. The chosen posting-day grouping preserves the Day 5 close and value date.

**What it would produce.** ACC-002 would earn only the Day 6 accrual of `0.004`, for a final `10.004` instead of `10.008`. The README and `AMBIGUITIES.md` expose this difference rather than hiding it.

### Sorting the whole stream by value date

**What it was.** Put E7 and E9 at Day 2 because their value date is Day 2.

**Why it was abandoned.** It would move E7 before E3 and E5. At Day 2 the ledger would be `-370.00`; the Auth-A hold of `200.00` would be declined; E5 would then reference an authorization that was never active. The settlement would be rejected. That directly contradicts criterion C and the obvious intent of the stream. Posting order is the reconciliation key; value date is for as-of balances.

### Treating the authorization hold as a ledger entry

**What it was.** Book a `-200.00` entry when Auth-A is approved so that the ledger and available balances move together.

**Why it was abandoned.** It would make Auth-A's approval reduce ledger balance, contradicting criterion E's correct invariant and the distinction between ledger and available balance. Settlement would then need a second entry to release the hold, creating artificial volume and a confusing audit trail.

### Mutating authorization records or ledger entries in place

**What it was.** Update a single authorization object from `ACTIVE` to `SETTLED`, or edit E7 when E9 arrives.

**Why it was abandoned.** It violates the append-only requirement. The implementation appends authorization transitions and a reversal entry. The current authorization view is a projection that can be rebuilt from the transition log. Tests confirm that E7 and the fee entry remain after E9.

### Discarding the interest residual

**What it was.** Capitalize the aggregate rounded amount, `0.82`, and ignore the `0.01` difference from the daily accrual table.

**Why it was abandoned.** It violates the explicit requirement that the rounded daily accruals sum exactly to the capitalised total. It also creates a customer-visible mismatch between the daily report and the credit.

### Three equal BHD instalments of 3.334

**What it was.** Split `10.000` into three equal `3.334` entries.

**Why it was abandoned.** The sum is `10.002`, which overstates the credit. An append-only ledger cannot correct that without a second compensating entry, which would make the "three equal instalments" description false.

### Floating-point or `number` money

**What it was.** Store amounts as JavaScript numbers or floating-point decimals.

**Why it was abandoned.** Binary floating point cannot represent every decimal minor unit exactly. The ledger uses `bigint` and integer arithmetic, with formatting only at the output boundary.

### Half-even rounding

**What it was.** Use banker's rounding instead of half-up.

**Why it was abandoned.** The scenario does not require it, and the chosen amounts do not distinguish the two modes. Half-up is simpler to explain to a reviewer and matches the ordinary meaning of "rounded" without an extra banker's-rounding rule. A production system should choose based on its accounting policy, not by accident.

### A web layer, database, or UI

**What it was.** Add a service, persistence, and a browser view.

**Why it was abandoned.** The brief explicitly excludes them. Persistence and concurrency are discussed in the architecture document as production considerations, not implemented here.

### A snapshot per event

**What it was.** Store a full balance snapshot after every event to make as-of queries constant time.

**Why it was abandoned.** It multiplies memory by the number of events and days without improving the six-day result. A value-date index or periodic checkpoint is the cheaper structural change at higher volume.

## Known failing test

`known_failure/retroactive-fee.test.ts` asserts the retroactive policy's fee days:

```text
expected [2, 4, 5]
actual   [5]
```

The test is intentionally red. It is excluded from `npm test` and is run with `npm run test:known-failure`. The inline comments mark the policy boundary; this document explains the alternative and its numbers.
