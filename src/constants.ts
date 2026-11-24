import { amountFromDecimal } from './money.ts';
import { AccountId, CurrencyCode } from './types.ts';
import type { Account, Currency, Minor } from './types.ts';

const AED: Currency = { code: CurrencyCode.Aed, precision: 2 };
const BHD: Currency = { code: CurrencyCode.Bhd, precision: 3 };
const OPENING_BALANCE: Minor = 0n;
const WINDOW_DAYS = 6;

const ACCOUNTS: readonly Account[] = [
  { id: AccountId.Acc001, currency: AED, openingBalance: OPENING_BALANCE },
  { id: AccountId.Acc002, currency: BHD, openingBalance: OPENING_BALANCE },
];

const ACCOUNT_ORDER: readonly AccountId[] = [AccountId.Acc001, AccountId.Acc002];
const AED_OVERDRAFT_FEE = amountFromDecimal({ value: `25.00`, precision: 2 });
const FEE_SCHEDULE: ReadonlyMap<CurrencyCode, Minor> = new Map([
  [CurrencyCode.Aed, AED_OVERDRAFT_FEE],
]);
const DAILY_INTEREST_NUMERATOR = 4n;
const DAILY_INTEREST_DENOMINATOR = 10000n;

export {
  ACCOUNTS,
  ACCOUNT_ORDER,
  AED_OVERDRAFT_FEE,
  DAILY_INTEREST_DENOMINATOR,
  DAILY_INTEREST_NUMERATOR,
  FEE_SCHEDULE,
  WINDOW_DAYS,
};
