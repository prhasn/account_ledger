import { deepEqual, equal, throws } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { amountFromDecimal, formatMoney, roundHalfUp, splitInstalments } from '../src/money.ts';

describe(`money`, () => {
  it(`parses decimal amounts into minor units`, () => {
    equal(amountFromDecimal({ value: `1200.00`, precision: 2 }), 120000n);
    equal(amountFromDecimal({ value: `10.000`, precision: 3 }), 10000n);
    equal(amountFromDecimal({ value: `-0.05`, precision: 2 }), -5n);
  });

  it(`rejects amounts beyond the currency precision`, () => {
    throws(() => amountFromDecimal({ value: `1.234`, precision: 2 }), /precision/);
    throws(() => amountFromDecimal({ value: `not-a-number`, precision: 2 }), /Invalid/);
  });

  it(`formats minor units with the currency precision`, () => {
    equal(formatMoney({ amount: 120000n, precision: 2 }), `1,200.00`);
    equal(formatMoney({ amount: -5n, precision: 2 }), `-0.05`);
    equal(formatMoney({ amount: 10008n, precision: 3 }), `10.008`);
    equal(formatMoney({ amount: 250n, precision: 2, includeSign: true }), `+2.50`);
  });

  it(`rounds half up at the currency precision`, () => {
    equal(roundHalfUp({ numerator: 186000n, denominator: 10000n }), 19n);
    equal(roundHalfUp({ numerator: 176000n, denominator: 10000n }), 18n);
    equal(roundHalfUp({ numerator: 100000n, denominator: 10000n }), 10n);
    equal(roundHalfUp({ numerator: -186000n, denominator: 10000n }), -19n);
  });

  it(`splits 10.000 BHD into three exact instalments`, () => {
    const instalments = splitInstalments({ amount: 10000n, count: 3 });

    deepEqual(instalments, [3334n, 3333n, 3333n]);
    equal(instalments.reduce((total, amount) => total + amount, 0n), 10000n);
  });
});
