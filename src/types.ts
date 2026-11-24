enum AccountId {
  Acc001 = `ACC-001`,
  Acc002 = `ACC-002`,
}

enum AuthorizationState {
  Active = `ACTIVE`,
  Settled = `SETTLED`,
  Declined = `DECLINED`,
  Expired = `EXPIRED`,
  Cancelled = `CANCELLED`,
  Reversed = `REVERSED`,
}

enum CurrencyCode {
  Aed = `AED`,
  Bhd = `BHD`,
}

enum EntryKind {
  Credit = `CREDIT`,
  Debit = `DEBIT`,
  Fee = `FEE`,
  InterestCapitalization = `INTEREST_CAPITALIZATION`,
  Reversal = `REVERSAL`,
  Instalment = `INSTALMENT`,
}

enum ErrorCode {
  DuplicateAuthorization = `DUPLICATE_AUTHORIZATION`,
  UnknownAuthorization = `UNKNOWN_AUTHORIZATION`,
  AuthorizationNotActive = `AUTHORIZATION_NOT_ACTIVE`,
  SettlementExceedsHold = `SETTLEMENT_EXCEEDS_HOLD`,
  ReversalTargetMissing = `REVERSAL_TARGET_MISSING`,
  ReversalAlreadyApplied = `REVERSAL_ALREADY_APPLIED`,
  ReversalAmountMismatch = `REVERSAL_AMOUNT_MISMATCH`,
  NoFeeSchedule = `NO_FEE_SCHEDULE`,
}

enum EventKind {
  Credit = `CREDIT`,
  Debit = `DEBIT`,
  Authorization = `AUTHORIZATION`,
  Settlement = `SETTLEMENT`,
  Reversal = `REVERSAL`,
  InstalmentCredit = `INSTALMENT_CREDIT`,
}

enum EventStatus {
  Posted = `POSTED`,
  Approved = `APPROVED`,
  Declined = `DECLINED`,
  Rejected = `REJECTED`,
}

type Minor = bigint;
type Precision = 2 | 3;

interface Account {
  readonly id: AccountId;
  readonly currency: Currency;
  readonly openingBalance: Minor;
}

interface AccountDayClose {
  readonly accountId: AccountId;
  readonly preFeeBalance: Minor;
  readonly fee: Minor;
  readonly postFeeBalance: Minor;
  readonly accrual: Minor;
  readonly activeHolds: Minor;
  readonly available: Minor;
}

interface Accrual {
  readonly day: number;
  readonly accountId: AccountId;
  readonly closingBalance: Minor;
  readonly amount: Minor;
}

interface AmountFromDecimalInput {
  readonly value: string;
  readonly precision: Precision;
}

interface AccrueInput {
  readonly account: Account;
  readonly day: number;
  readonly balance: Minor;
}

interface AppendEntryInput {
  readonly sourceEventId: string;
  readonly accountId: AccountId;
  readonly amount: Minor;
  readonly valueDay: number;
  readonly postingDay: number;
  readonly kind: EntryKind;
  readonly description: string;
}

interface AssessFeeInput {
  readonly account: Account;
  readonly day: number;
  readonly balance: Minor;
}

interface AuthorizationEvent extends EventBase {
  readonly kind: EventKind.Authorization;
  readonly authorizationId: string;
}

interface AuthorizationRecord {
  readonly authorizationId: string;
  readonly accountId: AccountId;
  readonly requestedAmount: Minor;
  remainingHold: Minor;
  state: AuthorizationState;
  settledAmount: Minor;
  readonly createdDay: number;
  endedDay: number | null;
}

interface AuthorizationTransition {
  readonly sequence: number;
  readonly authorizationId: string;
  readonly accountId: AccountId;
  readonly day: number;
  readonly state: AuthorizationState;
  readonly holdAmount: Minor;
  readonly reason: string | null;
}

interface AuthorizationView {
  readonly authorizationId: string;
  readonly accountId: AccountId;
  readonly requestedAmount: Minor;
  readonly remainingHold: Minor;
  readonly state: AuthorizationState;
  readonly settledAmount: Minor;
  readonly createdDay: number;
  readonly endedDay: number | null;
}

interface BalanceAsOfInput {
  readonly accountId: AccountId;
  readonly day: number;
}

interface Capitalization {
  readonly accountId: AccountId;
  readonly amount: Minor;
  readonly entryId: string;
}

interface CreditEvent extends EventBase {
  readonly kind: EventKind.Credit;
}

interface Currency {
  readonly code: CurrencyCode;
  readonly precision: Precision;
}

interface DaySnapshot {
  readonly day: number;
  readonly accountCloses: ReadonlyMap<AccountId, AccountDayClose>;
  readonly authorizationStates: ReadonlyMap<string, AuthorizationState>;
  readonly restatement: readonly RestatementPoint[];
}

interface DebitEvent extends EventBase {
  readonly kind: EventKind.Debit;
}

interface EngineOptions {
  readonly accounts: readonly Account[];
  readonly feeSchedule: ReadonlyMap<CurrencyCode, Minor>;
  readonly interestRateNumerator: Minor;
  readonly interestRateDenominator: Minor;
}

interface EventBase {
  readonly id: string;
  readonly postingDay: number;
  readonly valueDay: number;
  readonly accountId: AccountId;
  readonly amount: Minor;
  readonly description: string;
}

interface EventRecord {
  readonly sequence: number;
  readonly event: InputEvent;
  readonly status: EventStatus;
  readonly reason: string | null;
  readonly generatedEntryIds: readonly string[];
}

interface FeeAssessment {
  readonly day: number;
  readonly accountId: AccountId;
  readonly amount: Minor;
}

interface FormatEventAmountInput {
  readonly event: InputEvent;
  readonly account: Account;
}

interface FormatMoneyInput {
  readonly amount: Minor;
  readonly precision: Precision;
  readonly includeSign?: boolean;
}

interface InstalmentCreditEvent extends EventBase {
  readonly kind: EventKind.InstalmentCredit;
  readonly instalmentCount: number;
}

interface LedgerEntry {
  readonly id: string;
  readonly sourceEventId: string;
  readonly accountId: AccountId;
  readonly amount: Minor;
  readonly valueDay: number;
  readonly postingDay: number;
  readonly kind: EntryKind;
  readonly description: string;
}

interface LedgerError {
  readonly day: number;
  readonly eventId: string;
  readonly code: ErrorCode;
  readonly message: string;
}

interface PostingResult {
  readonly status: EventStatus;
  readonly reason: string | null;
  readonly generatedEntryIds: readonly string[];
}

interface ReplayResult {
  readonly accounts: readonly Account[];
  readonly days: readonly DaySnapshot[];
  readonly eventLog: readonly EventRecord[];
  readonly entries: readonly LedgerEntry[];
  readonly authorizations: readonly AuthorizationView[];
  readonly transitions: readonly AuthorizationTransition[];
  readonly errors: readonly LedgerError[];
  readonly fees: readonly FeeAssessment[];
  readonly accruals: readonly Accrual[];
  readonly capitalizations: readonly Capitalization[];
  readonly finalBalances: ReadonlyMap<AccountId, Minor>;
}

interface RenderCloseInput {
  readonly close: AccountDayClose;
  readonly account: Account;
}

interface RenderRestatementInput {
  readonly points: readonly RestatementPoint[];
  readonly accounts: ReadonlyMap<AccountId, Account>;
}

interface RestatementPoint {
  readonly day: number;
  readonly balances: ReadonlyMap<AccountId, Minor>;
}

interface ReversalEvent extends EventBase {
  readonly kind: EventKind.Reversal;
  readonly reversesEventId: string;
}

interface RoundHalfUpInput {
  readonly numerator: Minor;
  readonly denominator: Minor;
}

interface SettlementEvent extends EventBase {
  readonly kind: EventKind.Settlement;
  readonly authorizationId: string;
}

interface SplitInstalmentsInput {
  readonly amount: Minor;
  readonly count: number;
}

interface TransitionInput {
  readonly authorizationId: string;
  readonly accountId: AccountId;
  readonly day: number;
  readonly state: AuthorizationState;
  readonly holdAmount: Minor;
  readonly reason: string | null;
}

type BalanceEvent = CreditEvent | DebitEvent | InstalmentCreditEvent;

type InputEvent =
  | CreditEvent
  | DebitEvent
  | AuthorizationEvent
  | SettlementEvent
  | ReversalEvent
  | InstalmentCreditEvent;

export {
  AccountId,
  AuthorizationState,
  CurrencyCode,
  EntryKind,
  ErrorCode,
  EventKind,
  EventStatus,
};

export type {
  Account,
  AccountDayClose,
  Accrual,
  AccrueInput,
  AmountFromDecimalInput,
  AppendEntryInput,
  AssessFeeInput,
  AuthorizationEvent,
  AuthorizationRecord,
  AuthorizationTransition,
  AuthorizationView,
  BalanceAsOfInput,
  BalanceEvent,
  Capitalization,
  Currency,
  DaySnapshot,
  EngineOptions,
  EventRecord,
  FeeAssessment,
  FormatEventAmountInput,
  FormatMoneyInput,
  InputEvent,
  LedgerEntry,
  LedgerError,
  Minor,
  PostingResult,
  Precision,
  RenderCloseInput,
  RenderRestatementInput,
  ReplayResult,
  RestatementPoint,
  ReversalEvent,
  RoundHalfUpInput,
  SettlementEvent,
  SplitInstalmentsInput,
  TransitionInput,
};
