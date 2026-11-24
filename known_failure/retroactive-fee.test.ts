import { deepEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { replayScenario } from '../src/scenario.ts';

describe(`known failure`, () => {
  it(`retroactive policy would charge days 2, 4 and 5`, () => {
    /*
     * Intentional red test.
     * Encodes retroactive fee policy.
     * Our policy charges day 5.
     * Day 3 restates positive.
     * Reveals closed-period finality choice.
     */
    const result = replayScenario();

    deepEqual(
      result.fees.map((fee) => fee.day),
      [2, 4, 5],
    );
  });
});
