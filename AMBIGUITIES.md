# AMBIGUITIES

This document records every material ambiguity found while building the ledger, the options considered, the resolution chosen, and the impact of that choice. It is intentionally not short. Several entries are visible in the reported numbers; others are guardrails for production behavior.

The two decisions that change the reported figures are:

1. Fees and interest are assessed at each day's close on the ledger known at that close. Backdated postings do not reopen closed days for fee or interest purposes.
2. Events are grouped by posting day. Within a day, input order is preserved. E10 is a Day 5 event even though it appears after E9 in the prompt.

## A1. Posting order versus value-date order

**Ambiguity.** The stream gives posting days and value days. E7 posts on Day 5 with value date Day 2. E9 posts on Day 6 with value date Day 2. Should the engine sort events by value date, by posting date, or preserve input order?

**Options.** Sort by value date; sort by posting date; preserve the listed stream order; group by posting day and preserve order within a day.

**Chosen.** Posting day is authoritative. Events are grouped by posting day, and within a day they keep the input order. Value date is used only to compute as-of balances and restatements.

**Why.** Sorting by value date would move E7 and E9 before E5 and change the relationship between the Auth-A hold, its settlement, and the backdated debit. The prompt identifies each event by its posting day and says the stream is replayed in order. Posting day is the least surprising reconciliation key.

**Impact.** Auth-A is approved on Day 2 and settled on Day 4. E7 affects the Day 5 close and the Day 2 to Day 5 restatements, but it does not retroactively invalidate the Auth-A decision. E9 affects the Day 6 close and the restated closes, but it does not undo the Day 5 fee.

## A2. Fee assessment timing with backdated entries

**Ambiguity.** E7 is posted on Day 5 but value dated Day 2. Does it trigger a fee for Day 2, Day 3, Day 4, Day 5, or some subset?

**Options.**

- **End-of-day as-at:** assess a fee at each day's close using the entries posted by then. E7 affects Day 5's close because its value date is at or before Day 5.
- **Retroactive true-up:** on E7's arrival, recompute every affected value-dated close and assess a fee for every negative day that has not been assessed.
- **Value-date-only:** treat E7 as if it posted on Day 2 and assess the fee whose value date matches the transaction.

**Chosen.** End-of-day as-at. The Day 5 close is `-155.00`, so one fee is booked on Day 5 with value date Day 5.

**Why.** A closing balance is a point-in-time measurement. The Day 2 close was `+250.00` when Day 2 actually closed. Reopening it later would make closed periods mutable in economic effect, create an unbounded retroactive liability, and conflict with the append-only and once-per-day language. The fee's value date is the day it is assessed, not the value date of the transaction that happened to push the balance negative.

**Impact.** One fee, not three. Under retroactive true-up, E7 would make Day 2, Day 4, and Day 5 negative. Day 3 restates to `+30.00`, so even the retroactive alternative does not produce the single Day 2 fee claimed in criterion B. The intentional failing test encodes the retroactive alternative.

## A3. Day 3 restatement and the fee count

**Ambiguity.** Does E7 make every day from Day 2 onward negative?

**Options.** Assume all later days are negative; compute each day; assess only the first negative day.

**Chosen.** Compute each day independently. The restated balances are Day 2 `-370.00`, Day 3 `+30.00`, Day 4 `-155.00`, Day 5 `-155.00`.

**Why.** Day 3 already contains the `400.00` credit from E4. It absorbs most of E7 and remains positive. This is arithmetic, not policy.

**Impact.** A retroactive policy would assess three fees, not four: Days 2, 4, and 5. Criterion B's "exactly one" is wrong on count as well as day.

## A4. Interest restatement after backdated entries

**Ambiguity.** Day 2, 3, and 4 accrue interest at their historical closes. E7 later restates those closes. Are the accrued amounts recalculated?

**Options.** Recompute all daily accruals at the end; keep each day's accrual as assessed at its close; recompute only the capitalization total.

**Chosen.** Keep each day's accrual as assessed at its close. Day 2, 3, and 4 keep `0.10`, `0.26`, and `0.19`. Day 5 gets zero because its historical post-fee close is negative. Day 6 gets `0.18`. The capitalization is `0.83`.

**Why.** This is the same closed-period finality as the fee policy. It also avoids a second, inconsistent policy where fees are final but interest is revisable. The customer earned interest on the balances that actually closed each day.

**Impact.** A full restatement of interest would give a different total. It would also require choosing whether E9 restores Day 5 interest, which would make the final result depend on the order of reversal and capitalization. The chosen policy is deterministic and matches the day-by-day report.

## A5. Closing balance before or after the fee

**Ambiguity.** The fee rule says to assess when the closing balance is negative. Is the closing balance the pre-fee balance or the balance after the fee is booked?

**Options.** Trigger on pre-fee close; trigger on post-fee close; trigger twice.

**Chosen.** Trigger on the pre-fee close. If it is negative, book one fee. The post-fee close includes the fee. No second assessment is made for the same day.

**Why.** If the fee were included in the trigger test, a negative balance would always be negative after the fee and the "once per day" rule would be doing all the work. The natural reading is: measure the close, assess if negative, then book.

**Impact.** Day 5 reports pre-fee `-155.00`, fee `25.00`, post-fee `-180.00`. Day 5 interest is zero on the post-fee balance.

## A6. Fee and interest ordering

**Ambiguity.** Does interest accrue before or after the fee? Does the fee reduce the same day's interest base?

**Options.** Interest first; fee first; both in parallel from the pre-fee balance.

**Chosen.** Fee first, then interest on the post-fee close.

**Why.** Fees are booked ledger entries. Interest is a memo accrual until capitalization. A booked fee changes the ledger balance that the closing interest rule refers to.

**Impact.** On Day 5 the fee pushes the close to `-180.00`, so interest is zero. Without that ordering, Day 5 might accrue on `-155.00` or another figure. On Day 6 the fee reduces the interest base from `465.00` to `440.00`, which changes the accrual from `0.19` to `0.18`.

## A7. Overdraft fee currency for ACC-002

**Ambiguity.** The fee is stated as AED 25.00. ACC-002 is a BHD account. If ACC-002 closed negative, would it be charged AED 25.00, BHD 25.000, or an FX-converted amount?

**Options.** Charge AED 25.00 and debit a BHD account at an implied FX rate; charge BHD 25.000 by numeric analogy; do not configure a BHD fee and raise an explicit error if the case arises.

**Chosen.** No BHD fee is configured. ACC-002 never closes negative in this window, so no fee is assessed. If it did, the engine records `NO_FEE_SCHEDULE` rather than inventing an FX rate.

**Why.** The scenario gives no FX rate and no BHD fee. Numeric analogy would be economically different from AED 25.00. An explicit error is safer than a silent conversion.

**Impact.** Zero effect on this scenario. A production fee schedule must be currency-specific or reference a documented FX source and accounting treatment.

## A8. Fee when the close is exactly zero

**Ambiguity.** Does a zero closing balance attract the fee?

**Options.** Zero is not negative; zero is treated as overdrawn; use a tolerance.

**Chosen.** Zero is not negative. No fee.

**Why.** The rule says negative. Zero is not negative. No tolerance is introduced because the currency precision already defines the smallest unit.

**Impact.** No scenario day closes at zero, but the boundary is tested in the engine suite for a positive close and for a negative close.

## A9. Fee on a day with no events, and once per day

**Ambiguity.** If an account is negative and no events post on the next day, is another fee assessed? Does "once per day" mean one fee ever, or one per day?

**Options.** One fee per overdraft episode; one fee per account per day while negative; one fee only on event days.

**Chosen.** One fee per account per day while the close is negative, including days with no events. A set keyed by account and day prevents duplicates.

**Why.** The rule says once per day per account. A carried-forward negative balance is still that day's closing balance. Days with no events still close.

**Impact.** The scenario has one negative close, Day 5, so one fee. A synthetic test closes a negative account on two consecutive days and confirms two fees, one per day.

## A10. Authorization approval at exactly zero available

**Ambiguity.** The rule says available must remain at or above zero. Is exactly zero approved?

**Options.** Zero approved; zero declined; use a buffer.

**Chosen.** Zero is approved.

**Why.** "At or above zero" includes zero. No buffer is stated.

**Impact.** A test with a `100.00` balance and a `100.00` hold passes. A `100.01` hold declines.

## A11. Holds and the ledger balance

**Ambiguity.** Is an authorization a ledger entry? Does it reduce the ledger balance or only available balance?

**Options.** Book a hold as a debit; keep holds in a separate authorization register; book a memo entry.

**Chosen.** Holds live in a separate authorization projection. They reduce available balance and do not change ledger balance.

**Why.** This is the standard distinction between ledger balance and available balance. It also keeps settlement as the only event that moves funds for an authorization.

**Impact.** Day 2 ledger remains `250.00`; available is `50.00`. Criterion E's mechanics are correct, even though its premise about Auth-B is not.

## A12. Settlement amount versus hold amount

**Ambiguity.** Auth-A holds `200.00` but settles for `185.00`. What happens to the `15.00` difference? What if a settlement exceeds the hold?

**Options.** Release the remainder; keep the remainder active; reject any settlement that is not exactly the hold; allow over-settlement up to available balance.

**Chosen.** A settlement may be less than or equal to the remaining hold. The hold is fully released, the actual amount is debited, and the remainder becomes available. A settlement above the remaining hold is rejected.

**Why.** Partial capture is a normal card and merchant pattern. Over-settlement is a new credit decision, not a settlement of the original authorization.

**Impact.** E5 debits `185.00`, releases `200.00`, and leaves `465.00` available. E6 is rejected for an unknown authorization before any amount comparison.

## A13. Unknown authorization and the word "ledger"

**Ambiguity.** Criterion D says an authorization ID "not present in the ledger" must be rejected. Authorizations are not ledger entries in this model.

**Options.** Treat the wording literally and reject every settlement; interpret "ledger" as the authorization register; create placeholder authorization entries so the wording is true.

**Chosen.** Interpret "present in the ledger" as present in the authorization register. E6 references Auth-Z, which has no authorization record, so it is rejected with `UNKNOWN_AUTHORIZATION`. No debit is posted.

**Why.** Holds are explicitly off-ledger. A literal reading would make E5 fail too, because Auth-A is also not a ledger entry. The substantive requirement is clear: an unknown authorization must not move funds.

**Impact.** E6 is in the input event log with a `REJECTED` outcome and an error. It has no ledger entry and no effect on available balance.

## A14. Auth-B and the conditional criterion

**Ambiguity.** Criterion E says "If Auth-B is approved, its hold reduces available balance but not ledger balance." Is Auth-B approved?

**Options.** Approve Auth-B using the pre-E7 balance; decline it using the current balance; treat the conditional as an abstract invariant.

**Chosen.** Decline Auth-B. At E8 the ledger is `-155.00`; a `90.00` hold would leave `-245.00` available.

**Why.** E7 posts before E8. Available balance is ledger balance minus active holds. The Auth-A hold is already released. There is no positive balance to support the new hold.

**Impact.** Auth-B state is `DECLINED` with no hold. The hold mechanics described in the criterion are true as a general invariant, but the criterion is not a description of this run. It is refused as stated and accepted only as an invariant in `REJECTED.md`.

## A15. Auth-A settlement versus the backdated E7

**Ambiguity.** E7 is value dated Day 2, before the Day 4 Auth-A settlement. If E7 were considered known at Day 4, would Auth-A still settle?

**Options.** Invalidate Auth-A retroactively; reject the settlement; honor the hold and accept the settlement.

**Chosen.** Honor the hold and accept the settlement.

**Why.** Auth-A was approved on Day 2 when available was `50.00`. E7 did not exist in the posted ledger until Day 5. Even if E7 were known, the settlement is within the `200.00` hold and the hold was a prior commitment. The authorization rule constrains approval, not later settlement against an existing hold.

**Impact.** E5 posts `-185.00` and releases the hold. The ledger after E5 is `465.00`. The backdated E7 later reduces the Day 4 restatement to `-155.00`, but does not reopen E5.

## A16. Reversal scope

**Ambiguity.** E9 reverses E7. Does it reverse only principal, or also fees and interest caused by E7? Does it re-open Auth-B?

**Options.** Reverse principal only; reverse principal plus fees; reverse principal plus fees and interest; reverse all downstream decisions.

**Chosen.** Reverse principal only. E9 posts `+620.00` with value date Day 2. The Day 5 fee remains. Day 5 interest remains zero. Auth-B remains declined.

**Why.** Append-only and once-per-day mean an assessed fee is a booked event. The reversal references E7, not the fee. Reopening authorization decisions would rewrite history and could create funds that were never approved. A production system may issue a separate fee refund or goodwill credit, but that is a new event, not an implicit reversal.

**Impact.** Final ACC-001 is `440.83`, not `466.03`. The Day 5 close remains `-180.00`; the Day 5 restatement after E9 is `440.00` because the `25.00` fee is still there.

## A17. E10 stream order versus posting day

**Ambiguity.** The prompt lists E9 (Day 6) before E10 (Day 5). The stream is said to be replayed in order. E10's posting day and value date are both Day 5. Which wins?

**Options.**

- **Literal stream order:** process E9, then E10. E10 would arrive after the Day 5 close and would either reopen Day 5 or be treated as a Day 6 posting with a Day 5 value date.
- **Posting-day grouping:** process all Day 5 events, including E10, before closing Day 5; then process Day 6 events, including E9.
- **Reject E10 as out of order:** not viable, because E10 is a valid credit and the prompt expects it.

**Chosen.** Posting-day grouping. E10 is processed on Day 5. E9 is processed on Day 6. Input order is preserved within a day.

**Why.** The day labels and the per-day report make posting day the operational key. E10 has `Day 5` and value date Day 5, so treating it as a Day 6 arrival would contradict both labels. The relative position of E9 and E10 in the prompt is cross-account presentation order, not a same-account sequence that affects authorization or fees.

**Impact.** ACC-002 earns `0.004` on Day 5 and `0.004` on Day 6, for `10.008` final. Literal stream order would post E10 after the Day 5 close, so Day 5 interest would be zero and the final would be `10.004`. ACC-001 and every acceptance criterion are unaffected. The ambiguity is called out in the README so a reviewer can see the alternative number.

## A18. Instalment allocation order

**Ambiguity.** `10.000 / 3` is not an exact 3-decimal amount. Which instalment gets the extra `0.001`?

**Options.** First instalment; last instalment; largest balance; random; reject the credit.

**Chosen.** Largest-remainder allocation with the extra minor unit on the first instalment. The entries are `3.334`, `3.333`, `3.333`.

**Why.** The order is deterministic and auditable. All three post on the same day and to the same account, so the closing balance is unaffected by which one gets the extra unit. The event log and ledger entry order show the allocation.

**Impact.** The sum is exactly `10.000`. Criterion G's three equal `3.334` values would sum to `10.002` and are refused.

## A19. Interest rounding residual

**Ambiguity.** The rule says rounded daily accruals must sum exactly to the capitalized total. Is the capitalized total the sum of the daily rounded accruals, or a separately computed aggregate rounded once?

**Options.** Capitalize the sum of daily rounded accruals; compute the aggregate and round once; compute the aggregate and allocate the difference to one day.

**Chosen.** Capitalize the sum of the daily rounded accruals. ACC-001 capitalizes `0.83`. The unrounded aggregate would round to `0.82`, but that is not used.

**Why.** The daily accrual table is the customer-visible calculation. The rule explicitly requires the rounded daily accruals to sum to the capitalised total. Using `0.82` would either lose `0.01` or require silently changing a daily accrual. The code treats the table as the source of truth.

**Impact.** Final ACC-001 is `440.83`. If a separate control total of `0.82` were required by a downstream system, the residual would need an explicit allocation rule, not a discard. Criterion H is refused because it discards the residual.

## A20. Day count and same-day accrual

**Ambiguity.** Does a credit posted on Day 1 earn interest on Day 1? Is the day count actual/365, actual/360, or a fixed daily rate? Are weekends and holidays excluded?

**Options.** Same-day close accrual at the stated daily rate every day; next-day accrual; business-day accrual; actual/365 or actual/360.

**Chosen.** Same-day close accrual at `0.04%` of the closing balance for each of the six abstract days. No day-count fraction and no holiday calendar.

**Why.** The scenario gives a daily rate, not an annual rate or a business calendar. Applying it to each day's close is the most direct reading. There is no weekend or holiday data.

**Impact.** Day 1 earns `0.10` on `250.00`. A next-day convention would shift all accruals and change the total. A production system must document its day-count convention and calendar before go-live.

## A21. Day 6 closing balance and capitalization

**Ambiguity.** Is the capitalized interest included in the Day 6 closing balance? Does Day 6 interest accrue before or after capitalization?

**Options.** Accrue Day 6, then capitalize, and show both pre-cap and final; capitalize first, then accrue; show only final.

**Chosen.** Accrue Day 6 on the pre-capitalization close, then post one capitalization credit per account. The day block shows the Day 6 pre-capitalization close. The final table shows the post-capitalization balance.

**Why.** Capitalization is described as the end of Day 6. The Day 6 accrual must be computed before that credit exists, otherwise the accrual would depend on the capitalization itself. Showing both avoids hiding the transition.

**Impact.** Day 6 ACC-001 close is `440.00`; capitalization is `0.83`; final is `440.83`. Day 6 ACC-002 close is `10.000`; capitalization is `0.008`; final is `10.008`.

## A22. Multi-currency totals and FX

**Ambiguity.** Can AED and BHD balances be summed into a single portfolio total? Is there an FX rate?

**Options.** Sum numeric minor units; convert at a supplied rate; report each account separately.

**Chosen.** Report each account separately. No FX rate is used. The summary's fee total is AED because only AED fees are configured. There is no cross-currency net total.

**Why.** Adding AED fils to BHD fils is meaningless. The scenario provides no FX rate. A production ledger would need a rate source, rate date, and accounting policy.

**Impact.** No combined total is printed. Each currency keeps its own precision and final balance.

## A23. Business days, holidays, and time zones

**Ambiguity.** Are the six days calendar days, business days, or cut-off windows? When does a day close?

**Options.** Abstract integer days; UTC calendar days; UAE business days; a specific cut-off time.

**Chosen.** Abstract integer days, `1` through `6`. There is no wall-clock close and no holiday calendar.

**Why.** The scenario defines days as labels and does not provide dates, time zones, or cut-offs. Introducing a calendar would add unstated behavior.

**Impact.** The output is deterministic regardless of machine time zone. A production system needs an explicit cut-off, time zone, and holiday calendar before value dating can be operational.

## A24. Errors versus business declines

**Ambiguity.** Is a declined authorization an error? Is a rejected unknown settlement an error? What appears in the per-day error list?

**Options.** Treat both as errors; treat both as normal outcomes; separate declines from invalid events.

**Chosen.** A declined authorization is a normal business outcome with state `DECLINED` and no ledger effect. An invalid settlement or reversal is a rejected event with an error code. Both remain in the append-only event log.

**Why.** An authorization decline is an expected answer to a valid request. An unknown authorization is an invalid reference. Mixing them would make the error list noisy and hide data-quality failures.

**Impact.** Day 4 shows E6 as an error. Day 5 shows Auth-B as `DECLINED` in the authorization states, not in the error list.

## A25. Append-only scope

**Ambiguity.** Does append-only apply to input events, ledger entries, authorization states, projections, or all of them?

**Options.** Freeze everything; append immutable records and allow derived projections to update; mutate input events in place.

**Chosen.** Input events and ledger entries are immutable and append-only. Authorization transitions are appended. The current authorization map and day snapshots are derived projections that can be rebuilt from the logs.

**Why.** A projection is an index, not a source of truth. Requiring every projection update to be an event would be valid but heavier. The important guarantee is that no source record is mutated or deleted.

**Impact.** E7 remains in the ledger after E9. The fee entry remains after E9. Replaying the same input produces the same event log and entries. Tests assert the input array is unchanged and entry identifiers are unique.

## A26. Opening balance date

**Ambiguity.** Is the opening balance effective before Day 1, on Day 1, or at the start of the replay?

**Options.** Opening balance as a Day 0 entry; opening balance as a Day 1 entry; opening balance as an account field outside the event log.

**Chosen.** Opening balance is an account field outside the event log, included in every balance calculation regardless of day.

**Why.** The opening balances are zero in this scenario. Treating them as a Day 0 entry would add a synthetic event with no effect. Keeping them as account state is simpler and matches the account definition.

**Impact.** No effect on reported numbers. A production ledger should record the opening balance as an audited migration or seed entry with its own effective date.

## A27. Authorization expiry at the window end

**Ambiguity.** Auth-B is never settled. Does it expire at the end of Day 6? Does Auth-A's residual hold expire?

**Options.** Expire at Day 6; keep active indefinitely; apply a configured hold lifetime.

**Chosen.** No expiry rule is implemented. Auth-B is declined, so there is no active hold. Auth-A is settled, so there is no residual hold.

**Why.** The scenario gives no expiry period. Adding one would be an invented rule. A production system must define hold lifetimes by authorization type and network.

**Impact.** No active holds remain at the end. If Auth-B had been approved, this policy would leave it active because the scenario does not say when it expires.

## A28. Output formatting and signs

**Ambiguity.** Should amounts be printed with explicit plus signs, currency codes, or parenthesized negatives?

**Options.** Signed decimal with currency; accounting parentheses; minor units only.

**Chosen.** Signed decimal amounts at the account's precision, with currency codes in event and balance lines. Negative amounts use a leading minus. A plus sign is used for credits in event lines. Debit event lines show a minus.

**Why.** The report is meant to be read by a human and compared to the acceptance numbers. Minor-unit output would be exact but hard to audit visually.

**Impact.** `-370.00` is printed as `-370.00`, not `(370.00)`. The underlying value remains `-37000n` fils.

## A29. E6 and "funds must not leave the account"

**Ambiguity.** Must a rejected settlement leave no trace, or must it remain in the event log?

**Options.** Drop rejected events; record them with a rejected outcome; record them in a separate error log only.

**Chosen.** Record E6 in the input event log with status `REJECTED`, reason `Unknown authorization`, and an error entry. Post no ledger entry.

**Why.** An append-only audit trail must show what was attempted, not only what succeeded. Dropping the event would make the rejection invisible and weaken the audit story.

**Impact.** Input event count is 10, ledger entries are 12, and errors are 1. The account balance is unchanged by E6.

## A30. Input validation and currency matching

**Ambiguity.** What if an event amount is negative, zero, or in a different currency than the account? What if a settlement currency differs from the authorization currency?

**Options.** Trust the scenario; validate and reject; convert with FX.

**Chosen.** The scenario is trusted for amount signs and account currency. The engine does not carry a currency field on each event; the account determines precision and currency. FX conversion is out of scope.

**Why.** The scenario is fixed and internally consistent. Adding FX or a full validation layer would enlarge the surface without changing the required result.

**Impact.** No effect on the scenario. A production API must validate currency, amount sign, precision, and authorization-account consistency before append.

## A31. Reversal amount, value date, and idempotency

**Ambiguity.** Must E9 reverse exactly E7's amount? Must its value date match E7's? Can E7 be reversed twice?

**Options.** Trust the reversal; validate amount and idempotency; allow partial reversals.

**Chosen.** E9 must reference an existing non-reversed ledger entry. Its amount must equal the absolute original amount. It posts the opposite amount with E9's value date, which is Day 2 in the scenario. A second reversal of E7 is rejected.

**Why.** A reversal is a correcting entry, not a new discretionary debit. Matching the amount prevents accidental over-correction. Idempotency prevents double credits.

**Impact.** E9 posts `+620.00` and restores principal. The fee is not reversed because it is not the referenced entry. A second E9 would be rejected with `REVERSAL_ALREADY_APPLIED`.

## A32. Same-day event ordering

**Ambiguity.** Events on the same day can affect each other. Does E7 before E8 matter? Does E5 before E6 matter?

**Options.** Preserve input order; sort by value date; sort by event type; process all credits before debits.

**Chosen.** Preserve input order within each posting day.

**Why.** The stream is the source of truth. E7 before E8 is why Auth-B is declined: the debit lands first and makes available negative. Reordering would change the authorization outcome and hide the intended stress.

**Impact.** E5 is accepted before the invalid E6. E7 reduces available before E8 is evaluated. E10 is independent because it is on ACC-002.

## A33. Fee refunds and waivers

**Ambiguity.** Can a fee be refunded or waived? Does a reversal automatically refund it?

**Options.** Auto-refund on reversal; never refund; require a separate credit event.

**Chosen.** Never auto-refund. A refund would be a separate append-only event with its own approval and reason.

**Why.** The reversal references E7, not the fee. Implicit refunds would make the fee rule depend on later events and complicate the audit trail.

**Impact.** The Day 5 fee remains after E9. If operations wanted to make the customer whole, it would post a `FEE_REFUND` credit, which the current scenario does not include.

## A34. Negative interest and negative rates

**Ambiguity.** Does a negative balance accrue negative interest? Can the rate be negative?

**Options.** Accrue negative interest; accrue zero; support negative rates as a separate rule.

**Chosen.** Interest is zero on zero or negative balances. The rate is fixed positive `0.04%`.

**Why.** The rule says positive balances only. Charging negative interest would be a different product term and is not stated.

**Impact.** Days 2, 4, and 5 have negative restated closes at some point, but historical accrual is based on the day's close. Day 5 gets zero because its post-fee close is negative.

## A35. Per-day report versus event-log order

**Ambiguity.** Should the report show events strictly in input order, or grouped by day?

**Options.** Strict input order with day headers when the day changes; grouped by posting day; grouped by value date.

**Chosen.** Grouped by posting day, preserving input order within the group. The event log itself is the order in which events were posted, which for E10 is before E9.

**Why.** The deliverable asks for a per-day report and closing balances. Grouping by posting day is the only presentation that keeps each day's close adjacent to its events.

**Impact.** The event log order is E1 to E8, then E10, then E9. The input stream order in the prompt is E1 to E10. The difference is only E9/E10 and is explained in A17.
