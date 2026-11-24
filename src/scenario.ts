import {
  ACCOUNTS,
  DAILY_INTEREST_DENOMINATOR,
  DAILY_INTEREST_NUMERATOR,
  FEE_SCHEDULE,
  WINDOW_DAYS,
} from './constants.ts';
import { Ledger } from './engine.ts';
import { amountFromDecimal } from './money.ts';
import { AccountId, EventKind } from './types.ts';
import type { InputEvent, ReplayResult } from './types.ts';

const EVENTS: readonly InputEvent[] = [
  {
    id: `E1`,
    postingDay: 1,
    kind: EventKind.Credit,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `1200.00`, precision: 2 }),
    valueDay: 1,
    description: `Opening credit`,
  },
  {
    id: `E2`,
    postingDay: 1,
    kind: EventKind.Debit,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `950.00`, precision: 2 }),
    valueDay: 1,
    description: `Day one debit`,
  },
  {
    id: `E3`,
    postingDay: 2,
    kind: EventKind.Authorization,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `200.00`, precision: 2 }),
    valueDay: 2,
    authorizationId: `Auth-A`,
    description: `Hold for Auth-A`,
  },
  {
    id: `E4`,
    postingDay: 3,
    kind: EventKind.Credit,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `400.00`, precision: 2 }),
    valueDay: 3,
    description: `Day three credit`,
  },
  {
    id: `E5`,
    postingDay: 4,
    kind: EventKind.Settlement,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `185.00`, precision: 2 }),
    valueDay: 4,
    authorizationId: `Auth-A`,
    description: `Auth-A settlement`,
  },
  {
    id: `E6`,
    postingDay: 4,
    kind: EventKind.Settlement,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `180.00`, precision: 2 }),
    valueDay: 4,
    authorizationId: `Auth-Z`,
    description: `Unknown Auth-Z settlement`,
  },
  {
    id: `E7`,
    postingDay: 5,
    kind: EventKind.Debit,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `620.00`, precision: 2 }),
    valueDay: 2,
    description: `Backdated day two debit`,
  },
  {
    id: `E8`,
    postingDay: 5,
    kind: EventKind.Authorization,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `90.00`, precision: 2 }),
    valueDay: 5,
    authorizationId: `Auth-B`,
    description: `Hold for Auth-B`,
  },
  {
    id: `E9`,
    postingDay: 6,
    kind: EventKind.Reversal,
    accountId: AccountId.Acc001,
    amount: amountFromDecimal({ value: `620.00`, precision: 2 }),
    valueDay: 2,
    reversesEventId: `E7`,
    description: `Reversal of E7`,
  },
  {
    id: `E10`,
    postingDay: 5,
    kind: EventKind.InstalmentCredit,
    accountId: AccountId.Acc002,
    amount: amountFromDecimal({ value: `10.000`, precision: 3 }),
    valueDay: 5,
    instalmentCount: 3,
    description: `BHD credit in three instalments`,
  },
];

function replay(events: readonly InputEvent[]): ReplayResult {
  const ledger = new Ledger({
    accounts: ACCOUNTS,
    feeSchedule: FEE_SCHEDULE,
    interestRateNumerator: DAILY_INTEREST_NUMERATOR,
    interestRateDenominator: DAILY_INTEREST_DENOMINATOR,
  });
  const eventsByDay = new Map<number, InputEvent[]>();

  for (const event of events) {
    const dayEvents = eventsByDay.get(event.postingDay) ?? [];

    dayEvents.push(event);
    eventsByDay.set(event.postingDay, dayEvents);
  }

  for (let day = 1; day <= WINDOW_DAYS; day += 1) {
    const dayEvents = eventsByDay.get(day) ?? [];

    for (const event of dayEvents) {
      ledger.postEvent(event);
    }

    ledger.closeDay(day);
  }

  ledger.capitalize(WINDOW_DAYS);

  return ledger.getResult();
}

function replayScenario(): ReplayResult {
  return replay(EVENTS);
}

export {
  EVENTS,
  replay,
  replayScenario,
};
