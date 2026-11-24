import { deepEqual, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EVENTS, replayScenario } from '../src/scenario.ts';
import { AccountId } from '../src/types.ts';

describe(`append-only guarantees`, () => {
  it(`does not mutate the input event stream`, () => {
    const snapshot = EVENTS.map((event) => ({ ...event }));

    replayScenario();
    deepEqual(EVENTS, snapshot);
  });

  it(`keeps the original debit and the fee after the reversal`, () => {
    const result = replayScenario();
    const original = result.entries.find((entry) => entry.sourceEventId === `E7`);
    const fee = result.entries.find(
      (entry) => entry.sourceEventId === `SYSTEM-FEE-ACC-001-DAY-5`,
    );

    equal(original?.amount, -62000n);
    equal(fee?.amount, -2500n);
    equal(result.eventLog.filter((record) => record.event.id === `E7`).length, 1);
    equal(result.eventLog.filter((record) => record.event.id === `E9`).length, 1);
  });

  it(`creates unique ledger entry identifiers`, () => {
    const result = replayScenario();
    const identifiers = new Set(result.entries.map((entry) => entry.id));

    equal(identifiers.size, result.entries.length);
    equal(result.eventLog.length, 10);
    equal(result.entries.length, 12);
  });

  it(`produces the same result on a second replay`, () => {
    const first = replayScenario();
    const second = replayScenario();

    deepEqual(
      first.eventLog.map((record) => record.event.id),
      second.eventLog.map((record) => record.event.id),
    );
    deepEqual(
      first.entries.map((entry) => `${entry.id}:${entry.amount.toString()}`),
      second.entries.map((entry) => `${entry.id}:${entry.amount.toString()}`),
    );
    equal(first.finalBalances.get(AccountId.Acc001), second.finalBalances.get(AccountId.Acc001));
    equal(first.finalBalances.get(AccountId.Acc002), second.finalBalances.get(AccountId.Acc002));
  });
});
