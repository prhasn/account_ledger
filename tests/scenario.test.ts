import { deepEqual, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderReplay } from '../src/render.ts';
import { replayScenario } from '../src/scenario.ts';
import {
  AccountId,
  AuthorizationState,
  EntryKind,
  ErrorCode,
} from '../src/types.ts';

describe(`six-day scenario`, () => {
  it(`replays all ten input events by posting day`, () => {
    const result = replayScenario();

    deepEqual(
      result.eventLog.map((record) => record.event.id),
      [`E1`, `E2`, `E3`, `E4`, `E5`, `E6`, `E7`, `E8`, `E10`, `E9`],
    );
    equal(result.days.length, 6);
  });

  it(`matches the daily closing balances`, () => {
    const result = replayScenario();
    const dayOne = result.days[0]?.accountCloses.get(AccountId.Acc001);
    const dayTwo = result.days[1]?.accountCloses.get(AccountId.Acc001);
    const dayThree = result.days[2]?.accountCloses.get(AccountId.Acc001);
    const dayFour = result.days[3]?.accountCloses.get(AccountId.Acc001);
    const dayFive = result.days[4]?.accountCloses.get(AccountId.Acc001);
    const daySix = result.days[5]?.accountCloses.get(AccountId.Acc001);

    equal(dayOne?.postFeeBalance, 25000n);
    equal(dayTwo?.postFeeBalance, 25000n);
    equal(dayThree?.postFeeBalance, 65000n);
    equal(dayFour?.postFeeBalance, 46500n);
    equal(dayFive?.preFeeBalance, -15500n);
    equal(dayFive?.fee, 2500n);
    equal(dayFive?.postFeeBalance, -18000n);
    equal(daySix?.postFeeBalance, 44000n);
    equal(result.finalBalances.get(AccountId.Acc001), 44083n);
  });

  it(`books exactly one fee on day five`, () => {
    const result = replayScenario();
    const fee = result.fees[0];

    equal(result.fees.length, 1);
    equal(fee?.day, 5);
    equal(fee?.accountId, AccountId.Acc001);
    equal(fee?.amount, 2500n);
  });

  it(`settles Auth-A and declines Auth-B`, () => {
    const result = replayScenario();
    const authA = result.authorizations.find((authorization) => authorization.authorizationId === `Auth-A`);
    const authB = result.authorizations.find((authorization) => authorization.authorizationId === `Auth-B`);

    equal(authA?.state, AuthorizationState.Settled);
    equal(authA?.settledAmount, 18500n);
    equal(authA?.remainingHold, 0n);
    equal(authB?.state, AuthorizationState.Declined);
    equal(authB?.remainingHold, 0n);
    deepEqual(
      result.transitions.map((transition) => `${transition.authorizationId}:${transition.state}`),
      [`Auth-A:ACTIVE`, `Auth-A:SETTLED`, `Auth-B:DECLINED`],
    );
  });

  it(`rejects the unknown Auth-Z settlement without a debit`, () => {
    const result = replayScenario();
    const unknownEntries = result.entries.filter((entry) => entry.sourceEventId === `E6`);

    equal(result.errors.length, 1);
    equal(result.errors[0]?.eventId, `E6`);
    equal(result.errors[0]?.code, ErrorCode.UnknownAuthorization);
    equal(unknownEntries.length, 0);
  });

  it(`restates day two to minus 370 before day five fees`, () => {
    const result = replayScenario();
    const dayFive = result.days[4];
    const dayTwoPoint = dayFive?.restatement.find((point) => point.day === 2);
    const dayThreePoint = dayFive?.restatement.find((point) => point.day === 3);
    const dayFourPoint = dayFive?.restatement.find((point) => point.day === 4);
    const dayFivePoint = dayFive?.restatement.find((point) => point.day === 5);

    equal(dayTwoPoint?.balances.get(AccountId.Acc001), -37000n);
    equal(dayThreePoint?.balances.get(AccountId.Acc001), 3000n);
    equal(dayFourPoint?.balances.get(AccountId.Acc001), -15500n);
    equal(dayFivePoint?.balances.get(AccountId.Acc001), -15500n);
  });

  it(`splits the BHD credit into exact three-decimal instalments`, () => {
    const result = replayScenario();
    const instalmentEntries = result.entries.filter((entry) => entry.sourceEventId === `E10`);
    const amounts = instalmentEntries.map((entry) => entry.amount);

    deepEqual(amounts, [3334n, 3333n, 3333n]);
    equal(amounts.reduce((total, amount) => total + amount, 0n), 10000n);
    equal(result.finalBalances.get(AccountId.Acc002), 10008n);
  });

  it(`capitalizes the exact sum of rounded daily accruals`, () => {
    const result = replayScenario();
    const acc001 = result.accruals
      .filter((accrual) => accrual.accountId === AccountId.Acc001)
      .map((accrual) => accrual.amount);
    const acc002 = result.accruals
      .filter((accrual) => accrual.accountId === AccountId.Acc002)
      .map((accrual) => accrual.amount);
    const capitalized001 = result.capitalizations.find(
      (capitalization) => capitalization.accountId === AccountId.Acc001,
    );
    const capitalized002 = result.capitalizations.find(
      (capitalization) => capitalization.accountId === AccountId.Acc002,
    );

    deepEqual(acc001, [10n, 10n, 26n, 19n, 18n]);
    deepEqual(acc002, [4n, 4n]);
    equal(acc001.reduce((total, amount) => total + amount, 0n), 83n);
    equal(acc002.reduce((total, amount) => total + amount, 0n), 8n);
    equal(capitalized001?.amount, 83n);
    equal(capitalized002?.amount, 8n);
  });

  it(`keeps the fee after the E9 reversal`, () => {
    const result = replayScenario();
    const feeEntries = result.entries.filter((entry) => entry.kind === EntryKind.Fee);
    const originalDebit = result.entries.filter((entry) => entry.sourceEventId === `E7`);

    equal(feeEntries.length, 1);
    equal(originalDebit.length, 1);
    equal(result.fees.length, 1);
    equal(result.days[4]?.accountCloses.get(AccountId.Acc001)?.postFeeBalance, -18000n);
  });

  it(`renders the final balances and the day five restatement`, () => {
    const output = renderReplay(replayScenario());

    equal(output.includes(`ACC-001: 440.83 AED`), true);
    equal(output.includes(`ACC-002: 10.008 BHD`), true);
    equal(output.includes(`Day 2: ACC-001 -370.00 AED`), true);
  });
});
