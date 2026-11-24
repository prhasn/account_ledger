import { deepEqual, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Ledger } from '../src/engine.ts';
import {
  AccountId,
  AuthorizationState,
  CurrencyCode,
  ErrorCode,
  EventKind,
} from '../src/types.ts';
import type { Account, InputEvent } from '../src/types.ts';

const TEST_ACCOUNT: Account = {
  id: AccountId.Acc001,
  currency: { code: CurrencyCode.Aed, precision: 2 },
  openingBalance: 10000n,
};
const FEE_SCHEDULE: ReadonlyMap<CurrencyCode, bigint> = new Map([
  [CurrencyCode.Aed, 2500n],
]);

function makeLedger(accounts: readonly Account[] = [TEST_ACCOUNT]): Ledger {
  return new Ledger({
    accounts,
    feeSchedule: FEE_SCHEDULE,
    interestRateNumerator: 4n,
    interestRateDenominator: 10000n,
  });
}

describe(`ledger engine`, () => {
  it(`approves an authorization that leaves available at zero`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 10000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `Exact boundary`,
    };

    ledger.postEvent(authorization);
    ledger.closeDay(1);
    const result = ledger.getResult();
    const close = result.days[0]?.accountCloses.get(AccountId.Acc001);

    equal(result.authorizations[0]?.state, AuthorizationState.Active);
    equal(result.authorizations[0]?.remainingHold, 10000n);
    equal(close?.available, 0n);
  });

  it(`declines an authorization that would leave available below zero`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 10001n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `One minor unit too much`,
    };

    ledger.postEvent(authorization);
    ledger.closeDay(1);
    const result = ledger.getResult();

    equal(result.authorizations[0]?.state, AuthorizationState.Declined);
    equal(result.authorizations[0]?.remainingHold, 0n);
  });

  it(`reduces available without changing the ledger balance`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 8000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `Partial hold`,
    };

    ledger.postEvent(authorization);
    ledger.closeDay(1);
    const result = ledger.getResult();
    const close = result.days[0]?.accountCloses.get(AccountId.Acc001);

    equal(close?.postFeeBalance, 10000n);
    equal(close?.activeHolds, 8000n);
    equal(close?.available, 2000n);
    equal(result.finalBalances.get(AccountId.Acc001), 10000n);
  });

  it(`releases the remainder of a hold when a partial settlement posts`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 8000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `Partial hold`,
    };
    const settlement: InputEvent = {
      id: `S1`,
      postingDay: 2,
      kind: EventKind.Settlement,
      accountId: AccountId.Acc001,
      amount: 5000n,
      valueDay: 2,
      authorizationId: `Auth-1`,
      description: `Partial settlement`,
    };

    ledger.postEvent(authorization);
    ledger.closeDay(1);
    ledger.postEvent(settlement);
    ledger.closeDay(2);
    const result = ledger.getResult();
    const close = result.days[1]?.accountCloses.get(AccountId.Acc001);

    equal(result.authorizations[0]?.state, AuthorizationState.Settled);
    equal(result.authorizations[0]?.remainingHold, 0n);
    equal(result.finalBalances.get(AccountId.Acc001), 5000n);
    equal(close?.activeHolds, 0n);
    equal(close?.available, 5000n);
  });

  it(`rejects a settlement for an unknown authorization`, () => {
    const ledger = makeLedger();
    const settlement: InputEvent = {
      id: `S1`,
      postingDay: 1,
      kind: EventKind.Settlement,
      accountId: AccountId.Acc001,
      amount: 5000n,
      valueDay: 1,
      authorizationId: `Auth-Z`,
      description: `Unknown authorization`,
    };

    ledger.postEvent(settlement);
    ledger.closeDay(1);
    const result = ledger.getResult();

    equal(result.errors[0]?.code, ErrorCode.UnknownAuthorization);
    equal(result.finalBalances.get(AccountId.Acc001), 10000n);
    equal(result.entries.length, 0);
  });

  it(`rejects a settlement larger than the remaining hold`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 5000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `Small hold`,
    };
    const settlement: InputEvent = {
      id: `S1`,
      postingDay: 1,
      kind: EventKind.Settlement,
      accountId: AccountId.Acc001,
      amount: 6000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `Over settlement`,
    };

    ledger.postEvent(authorization);
    ledger.postEvent(settlement);
    ledger.closeDay(1);
    const result = ledger.getResult();

    equal(result.errors[0]?.code, ErrorCode.SettlementExceedsHold);
    equal(result.finalBalances.get(AccountId.Acc001), 10000n);
    equal(result.authorizations[0]?.remainingHold, 5000n);
  });

  it(`assesses at most one fee per account per negative day`, () => {
    const account: Account = { ...TEST_ACCOUNT, openingBalance: 0n };
    const ledger = makeLedger([account]);
    const debit: InputEvent = {
      id: `D1`,
      postingDay: 1,
      kind: EventKind.Debit,
      accountId: AccountId.Acc001,
      amount: 1000n,
      valueDay: 1,
      description: `Overdraft`,
    };

    ledger.postEvent(debit);
    ledger.closeDay(1);
    ledger.closeDay(2);
    const result = ledger.getResult();

    deepEqual(
      result.fees.map((fee) => fee.day),
      [1, 2],
    );
    equal(result.fees[0]?.amount, 2500n);
    equal(result.finalBalances.get(AccountId.Acc001), -6000n);
  });

  it(`does not assess a fee on a zero or positive close`, () => {
    const ledger = makeLedger();

    ledger.closeDay(1);
    const result = ledger.getResult();

    equal(result.fees.length, 0);
  });

  it(`accrues daily interest on a positive close and none on a negative close`, () => {
    const positive = makeLedger();
    const negative = makeLedger([{ ...TEST_ACCOUNT, openingBalance: 0n }]);
    const debit: InputEvent = {
      id: `D1`,
      postingDay: 1,
      kind: EventKind.Debit,
      accountId: AccountId.Acc001,
      amount: 1000n,
      valueDay: 1,
      description: `Overdraft`,
    };

    positive.closeDay(1);
    negative.postEvent(debit);
    negative.closeDay(1);
    const positiveResult = positive.getResult();
    const negativeResult = negative.getResult();

    equal(positiveResult.accruals[0]?.amount, 4n);
    equal(negativeResult.accruals.length, 0);
  });

  it(`keeps the fee after a later reversal`, () => {
    const ledger = makeLedger();
    const debit: InputEvent = {
      id: `D1`,
      postingDay: 1,
      kind: EventKind.Debit,
      accountId: AccountId.Acc001,
      amount: 30000n,
      valueDay: 1,
      description: `Overdraft`,
    };
    const reversal: InputEvent = {
      id: `R1`,
      postingDay: 2,
      kind: EventKind.Reversal,
      accountId: AccountId.Acc001,
      amount: 30000n,
      valueDay: 1,
      reversesEventId: `D1`,
      description: `Reverse overdraft`,
    };

    ledger.postEvent(debit);
    ledger.closeDay(1);
    ledger.postEvent(reversal);
    ledger.closeDay(2);
    const result = ledger.getResult();

    equal(result.fees.length, 1);
    equal(result.finalBalances.get(AccountId.Acc001), 7500n);
  });

  it(`rejects duplicate authorization identifiers`, () => {
    const ledger = makeLedger();
    const authorization: InputEvent = {
      id: `A1`,
      postingDay: 1,
      kind: EventKind.Authorization,
      accountId: AccountId.Acc001,
      amount: 1000n,
      valueDay: 1,
      authorizationId: `Auth-1`,
      description: `First authorization`,
    };
    const duplicate: InputEvent = {
      ...authorization,
      id: `A2`,
      description: `Duplicate authorization`,
    };

    ledger.postEvent(authorization);
    ledger.postEvent(duplicate);
    ledger.closeDay(1);
    const result = ledger.getResult();

    equal(result.errors[0]?.code, ErrorCode.DuplicateAuthorization);
    equal(result.authorizations.length, 1);
  });
});
