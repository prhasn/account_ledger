# NUMBERS

Every number in the implementation is either fixed by the scenario or chosen as a policy constant. This document lists both, explains why the value is what it is, and says why half of it would not work.

All money is stored as `bigint` minor units. AED has 2 decimal places, so `1 AED = 100 fils`. BHD has 3 decimal places, so `1 BHD = 1000 fils`.

## Scenario constants

These values come from the event stream. Halving them would change the scenario rather than improve the design.

| Constant | Value | Why this value | Why not half |
|---|---:|---|---|
| AED precision | 2 | ISO 4217 currency precision; AED amounts are fils. | Half would be 1 decimal place, which cannot represent `0.05`. |
| BHD precision | 3 | ISO 4217 currency precision; BHD amounts are fils. | Half would be 2 decimal places, which cannot represent `0.001`. |
| Opening balance, ACC-001 | `0.00 AED` | Given. | Half is still zero; the question is moot. |
| Opening balance, ACC-002 | `0.000 BHD` | Given. | Half is still zero; the question is moot. |
| Overdraft fee | `25.00 AED` | Given. Stored as `2500n` fils. | Half would be `12.50`, not the stated fee. |
| Daily interest rate | `0.04%` | Given. Stored as `4 / 10000`, or 4 basis points. | Half would be 2 basis points and would halve every accrual. |
| Window | 6 days | Given, Day 1 through Day 6. | Half would be 3 days and would omit Days 4 to 6. |
| E10 principal | `10.000 BHD` | Given. Stored as `10000n` fils. | Half would be `5.000`, a different credit. |
| E10 instalments | 3 | Given. | Half is 1.5, not a valid number of instalments. |
| Auth-A hold | `200.00 AED` | Given. Stored as `20000n` fils. | Half would be `100.00`, a different hold. |
| Auth-A settlement | `185.00 AED` | Given. Stored as `18500n` fils. | Half would be `92.50`, a different settlement. |
| Auth-B hold | `90.00 AED` | Given. Stored as `9000n` fils. | Half would be `45.00`, a different hold. |
| E7 debit | `620.00 AED` | Given. Stored as `62000n` fils. | Half would be `310.00`, a different debit. |
| E1 credit | `1200.00 AED` | Given. Stored as `120000n` fils. | Half would be `600.00`, a different credit. |
| E2 debit | `950.00 AED` | Given. Stored as `95000n` fils. | Half would be `475.00`, a different debit. |
| E4 credit | `400.00 AED` | Given. Stored as `40000n` fils. | Half would be `200.00`, a different credit. |
| E6 settlement | `180.00 AED` | Given. Stored as `18000n` fils. | Half would be `90.00`, a different rejected request. |
| Input events | 10 | Given. | Half would be 5 events and would omit half the scenario. |

## Representation constants

| Constant | Value | Why this value | Why not half |
|---|---:|---|---|
| Minor-unit base | `10n` | Decimal currency. | Half of the base is not a decimal base. |
| AED factor | `100n` | `10 ^ 2`. | Half would be `50n`, which is not `10 ^ precision`. |
| BHD factor | `1000n` | `10 ^ 3`. | Half would be `500n`, which is not `10 ^ precision`. |
| Rounding mode | half up | Rounds `0.005` up at AED precision and `0.0005` up at BHD precision. | Half of the rounding increment would be below the smallest representable unit. |
| Interest numerator | `4n` | 4 basis points. | Half would be `2n`, or 2 basis points. |
| Interest denominator | `10000n` | 10000 basis points in 100 percent. | Half would be `5000n`, doubling the rate. |
| Overflow strategy | `bigint` | Exact integer arithmetic; no floating-point drift. | Half-precision floating point is not exact for money. |

The rounding helper is:

```text
roundHalfUp(numerator, denominator) = sign * floor((abs(numerator) + denominator / 2) / denominator)
```

For ACC-001 Day 4, `46500n * 4n = 186000n`; dividing by `10000n` gives `18.6` fils, which rounds to `19n` fils, or `0.19 AED`.

For ACC-001 Day 6, `44000n * 4n = 176000n`; dividing by `10000n` gives `17.6` fils, which rounds to `18n` fils, or `0.18 AED`.

## Policy constants

These are choices, not scenario inputs.

| Constant | Value | Why this value | Why not half |
|---|---:|---|---|
| Fee timing | end of day | The rule is based on a closing balance. Fees are assessed after all events posted that day, before interest. | Half a day would require an intraday cut-off that the scenario does not define. |
| Interest timing | end of day, after fees | Interest uses the post-fee closing ledger balance. | Half a day would require an intraday balance and a time zone. |
| Backdating policy | no retroactive fee or interest reopening | Closed days are final. A later backdated entry changes current and future closes and the restatement view, not past assessments. | A half measure, such as reopening only fees but not interest, is harder to explain and audit. |
| Day 6 accrual order | accrue before capitalization | Day 6 interest is earned on the pre-capitalization Day 6 close. | Half a day would make the accrual depend on the capitalization time. |
| Day 6 capitalization | sum of rounded daily accruals | The booked credit equals the accrual table exactly. | Half of the `0.02` aggregate difference is `0.01`; it would either be lost or create a mismatch. |
| Instalment allocation | largest remainder, first instalment first | `10000n / 3n` has base `3333n` and remainder `1n`; the first instalment receives the extra minor unit. | Half of the `0.001` remainder is `0.0005`, below BHD precision. |
| Over-settlement policy | reject | A settlement above the remaining hold is not authorised. | Half of a rejected settlement is still a settlement; the policy is binary. |
| BHD overdraft fee | not configured | The stated fee is AED 25.00. ACC-002 never closes negative, so the case is not reached. | Half of an unconfigured fee is still unconfigured. Inventing `25.000 BHD` or an AED-to-BHD conversion would add an unstated FX rule. |
| Authorization expiry | none in the six-day window | No expiry rule is given. Auth-B is declined before it could become active. | Half of the window is 3 days, which would require an arbitrary expiry rule. |
| Day boundary | abstract integer day | The scenario defines days, not timestamps or business calendars. | Half a day would require a time zone, cut-off, and holiday calendar. |
| Error policy | reject invalid event, keep event record | Append-only audit trail; a rejected event is still evidence. | Half a rejection is not a state. |

## Derived numbers

These are outcomes, not constants. They are listed so every reported number can be traced.

| Number | Derivation |
|---:|---|
| Day 1 ACC-001 close | `1200.00 - 950.00 = 250.00` |
| Day 2 ACC-001 close | No new ledger entry; `250.00` |
| Day 3 ACC-001 close | `250.00 + 400.00 = 650.00` |
| Day 4 ACC-001 close | `650.00 - 185.00 = 465.00`; E6 rejected |
| Day 5 ACC-001 pre-fee | `465.00 - 620.00 = -155.00` |
| Day 5 fee | One fee because the close is negative; `25.00` |
| Day 5 ACC-001 post-fee | `-155.00 - 25.00 = -180.00` |
| Day 5 ACC-001 interest | Zero because the post-fee close is negative |
| Day 6 ACC-001 close | `-180.00 + 620.00 = 440.00` |
| Day 6 ACC-001 interest | `440.00 * 0.0004 = 0.176`, rounded to `0.18` |
| ACC-001 capitalization | `0.10 + 0.10 + 0.26 + 0.19 + 0.00 + 0.18 = 0.83` |
| ACC-001 final | `440.00 + 0.83 = 440.83` |
| Day 5 ACC-002 close | `10.000` from three instalments |
| Day 5 ACC-002 interest | `10.000 * 0.0004 = 0.004` |
| Day 6 ACC-002 interest | `10.000 * 0.0004 = 0.004` |
| ACC-002 capitalization | `0.004 + 0.004 = 0.008` |
| ACC-002 final | `10.000 + 0.008 = 10.008` |
| Day 2 restatement at end of Day 5 | `250.00 - 620.00 = -370.00` |
| Day 3 restatement at end of Day 5 | `250.00 + 400.00 - 620.00 = 30.00` |
| Day 4 restatement at end of Day 5 | `650.00 - 185.00 - 620.00 = -155.00` |
| E10 instalments | `10000n = 3334n + 3333n + 3333n` |

## Interest rounding residual

The unrounded daily interest amounts for ACC-001 are:

```text
0.100 + 0.100 + 0.260 + 0.186 + 0.000 + 0.176 = 0.822
```

Rounding that aggregate once gives `0.82`. The rounded daily accruals are:

```text
0.10 + 0.10 + 0.26 + 0.19 + 0.00 + 0.18 = 0.83
```

The chosen capitalized total is `0.83`, because the rule requires the rounded daily accruals to sum exactly to the capitalization credit. The `0.01` difference is not discarded and is not quietly rounded away. If a separate control total of `0.82` were mandated, the residual would be allocated across the accrual table so that the table and the booked credit still agree. The scenario does not impose such a control total, so the table is the source of truth.

For ACC-002, both calculations give `0.008`, so the residual issue does not arise in BHD.

## Why the fee is Day 5, not Day 2

At the end of Day 2, the entries posted by then are E1 and E2. The close is `250.00`, so no fee is assessed. E7 is not posted until Day 5. At the end of Day 5, E7 is in the ledger with value date Day 2, so the Day 5 close is `-155.00` and the fee is assessed on Day 5, with value date Day 5.

The Day 2 restatement at the end of Day 5 is `-370.00`, but it is a reporting view of a closed day. Reopening it would mean a fee of `25.00` on Day 2, a fee on Day 4, and a fee on Day 5. Day 3 restates to `+30.00` and would not attract a fee. That alternative is documented and rejected; it does not produce the single Day 2 fee claimed by criterion B.

## Why the BHD instalments are not all 3.334

`10000n / 3n` is `3333n` with remainder `1n`. Largest-remainder allocation gives the extra minor unit to one instalment:

```text
3.334 + 3.333 + 3.333 = 10.000
```

Three equal `3.334` values total `10.002`, which is `0.002 BHD` more than the credit. Three equal `3.333` values total `9.999`, which is `0.001 BHD` short. Neither is acceptable for an append-only credit.
