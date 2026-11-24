import { roundHalfUp, splitInstalments } from './money.ts';
import {
  AccountId,
  AuthorizationState,
  EntryKind,
  ErrorCode,
  EventKind,
  EventStatus,
} from './types.ts';
import type {
  Account,
  AccountDayClose,
  Accrual,
  AccrueInput,
  AppendEntryInput,
  AssessFeeInput,
  AuthorizationEvent,
  AuthorizationRecord,
  AuthorizationTransition,
  AuthorizationView,
  BalanceAsOfInput,
  BalanceEvent,
  Capitalization,
  CurrencyCode,
  DaySnapshot,
  EngineOptions,
  EventRecord,
  FeeAssessment,
  InputEvent,
  LedgerEntry,
  LedgerError,
  Minor,
  PostingResult,
  ReplayResult,
  RestatementPoint,
  ReversalEvent,
  SettlementEvent,
  TransitionInput,
} from './types.ts';

class Ledger {
  private readonly accounts: ReadonlyMap<AccountId, Account>;
  private readonly feeSchedule: ReadonlyMap<CurrencyCode, Minor>;
  private readonly interestRateNumerator: Minor;
  private readonly interestRateDenominator: Minor;
  private readonly entries: LedgerEntry[] = [];
  private readonly eventLog: EventRecord[] = [];
  private readonly authorizationRecords = new Map<string, AuthorizationRecord>();
  private readonly authorizationTransitions: AuthorizationTransition[] = [];
  private readonly errors: LedgerError[] = [];
  private readonly assessedFees = new Map<string, FeeAssessment>();
  private readonly accruals = new Map<AccountId, Accrual[]>();
  private readonly snapshots: DaySnapshot[] = [];
  private readonly reversedEventIds = new Set<string>();
  private readonly fees: FeeAssessment[] = [];
  private readonly capitalizations: Capitalization[] = [];
  private nextEventSequence = 1;
  private nextEntrySequence = 1;
  private nextTransitionSequence = 1;

  constructor(options: EngineOptions) {
    const accounts = new Map<AccountId, Account>();

    for (const account of options.accounts) {
      accounts.set(account.id, account);
      this.accruals.set(account.id, []);
    }

    this.accounts = accounts;
    this.feeSchedule = options.feeSchedule;
    this.interestRateNumerator = options.interestRateNumerator;
    this.interestRateDenominator = options.interestRateDenominator;
  }

  postEvent(event: InputEvent): EventRecord {
    let result: PostingResult | null = null;

    switch (event.kind) {
      case EventKind.Credit:
      case EventKind.Debit:
      case EventKind.InstalmentCredit:
        result = this.postBalanceEvent(event);
        break;
      case EventKind.Authorization:
        result = this.authorize(event);
        break;
      case EventKind.Settlement:
        result = this.settle(event);
        break;
      case EventKind.Reversal:
        result = this.reverse(event);
        break;
    }

    if (!result) {
      throw new Error(`Unhandled event kind: ${event.kind}`);
    }

    const record: EventRecord = {
      sequence: this.nextEventSequence,
      event,
      status: result.status,
      reason: result.reason,
      generatedEntryIds: result.generatedEntryIds,
    };

    this.nextEventSequence += 1;
    this.eventLog.push(record);

    return record;
  }

  closeDay(day: number): void {
    const restatement: RestatementPoint[] = [];

    for (let asOfDay = 1; asOfDay <= day; asOfDay += 1) {
      const balances = new Map<AccountId, Minor>();

      for (const account of this.accounts.values()) {
        balances.set(account.id, this.balanceAsOf({ accountId: account.id, day: asOfDay }));
      }

      restatement.push({ day: asOfDay, balances });
    }

    const accountCloses = new Map<AccountId, AccountDayClose>();

    for (const account of this.accounts.values()) {
      const preFeeBalance = this.balanceAsOf({ accountId: account.id, day });
      const fee = this.assessFee({ account, day, balance: preFeeBalance });
      const postFeeBalance = this.balanceAsOf({ accountId: account.id, day });
      const accrual = this.accrue({ account, day, balance: postFeeBalance });
      const activeHolds = this.activeHolds(account.id);
      const available = postFeeBalance - activeHolds;

      accountCloses.set(account.id, {
        accountId: account.id,
        preFeeBalance,
        fee,
        postFeeBalance,
        accrual,
        activeHolds,
        available,
      });
    }

    const authorizationStates = new Map<string, AuthorizationState>();

    for (const authorization of this.authorizationRecords.values()) {
      authorizationStates.set(authorization.authorizationId, authorization.state);
    }

    this.snapshots.push({ day, accountCloses, authorizationStates, restatement });
  }

  capitalize(day: number): void {
    for (const account of this.accounts.values()) {
      const accruals = this.accruals.get(account.id);

      if (!accruals) {
        throw new Error(`Missing accrual bucket: ${account.id}`);
      }

      let total = 0n;

      for (const accrual of accruals) {
        total += accrual.amount;
      }

      if (total === 0n) {
        continue;
      }

      const entry = this.appendEntry({
        sourceEventId: `SYSTEM-INTEREST-${account.id}-DAY-${day}`,
        accountId: account.id,
        amount: total,
        valueDay: day,
        postingDay: day,
        kind: EntryKind.InterestCapitalization,
        description: `Capitalized interest for day ${day}`,
      });

      this.capitalizations.push({ accountId: account.id, amount: total, entryId: entry.id });
    }
  }

  getResult(): ReplayResult {
    const authorizations: AuthorizationView[] = [];

    for (const authorization of this.authorizationRecords.values()) {
      authorizations.push({ ...authorization });
    }

    const finalBalances = new Map<AccountId, Minor>();

    for (const account of this.accounts.values()) {
      finalBalances.set(account.id, this.balance(account.id));
    }

    return {
      accounts: [...this.accounts.values()],
      days: [...this.snapshots],
      eventLog: [...this.eventLog],
      entries: [...this.entries],
      authorizations,
      transitions: [...this.authorizationTransitions],
      errors: [...this.errors],
      fees: [...this.fees],
      accruals: [...this.accruals.values()].flat(),
      capitalizations: [...this.capitalizations],
      finalBalances,
    };
  }

  private postBalanceEvent(event: BalanceEvent): PostingResult {
    if (event.kind === EventKind.Credit) {
      const entry = this.appendEntry({
        sourceEventId: event.id,
        accountId: event.accountId,
        amount: event.amount,
        valueDay: event.valueDay,
        postingDay: event.postingDay,
        kind: EntryKind.Credit,
        description: event.description,
      });

      return { status: EventStatus.Posted, reason: null, generatedEntryIds: [entry.id] };
    }

    if (event.kind === EventKind.Debit) {
      const entry = this.appendEntry({
        sourceEventId: event.id,
        accountId: event.accountId,
        amount: -event.amount,
        valueDay: event.valueDay,
        postingDay: event.postingDay,
        kind: EntryKind.Debit,
        description: event.description,
      });

      return { status: EventStatus.Posted, reason: null, generatedEntryIds: [entry.id] };
    }

    const instalments = splitInstalments({
      amount: event.amount,
      count: event.instalmentCount,
    });
    const generatedEntryIds: string[] = [];

    for (const instalment of instalments) {
      const entry = this.appendEntry({
        sourceEventId: event.id,
        accountId: event.accountId,
        amount: instalment,
        valueDay: event.valueDay,
        postingDay: event.postingDay,
        kind: EntryKind.Instalment,
        description: `${event.description} instalment`,
      });

      generatedEntryIds.push(entry.id);
    }

    return { status: EventStatus.Posted, reason: null, generatedEntryIds };
  }

  private authorize(event: AuthorizationEvent): PostingResult {
    if (this.authorizationRecords.has(event.authorizationId)) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.DuplicateAuthorization,
        message: `Authorization already exists: ${event.authorizationId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Duplicate authorization`,
        generatedEntryIds: [],
      };
    }

    const available = this.balance(event.accountId) - this.activeHolds(event.accountId);
    const approved = available - event.amount >= 0n;
    const authorization: AuthorizationRecord = {
      authorizationId: event.authorizationId,
      accountId: event.accountId,
      requestedAmount: event.amount,
      remainingHold: approved ? event.amount : 0n,
      state: approved ? AuthorizationState.Active : AuthorizationState.Declined,
      settledAmount: 0n,
      createdDay: event.postingDay,
      endedDay: approved ? null : event.postingDay,
    };

    this.authorizationRecords.set(event.authorizationId, authorization);
    this.appendTransition({
      authorizationId: event.authorizationId,
      accountId: event.accountId,
      day: event.postingDay,
      state: authorization.state,
      holdAmount: authorization.remainingHold,
      reason: approved ? null : `Insufficient available balance`,
    });

    return {
      status: approved ? EventStatus.Approved : EventStatus.Declined,
      reason: approved ? null : `Insufficient available balance`,
      generatedEntryIds: [],
    };
  }

  private settle(event: SettlementEvent): PostingResult {
    const authorization = this.authorizationRecords.get(event.authorizationId);

    if (!authorization) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.UnknownAuthorization,
        message: `Unknown authorization: ${event.authorizationId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Unknown authorization`,
        generatedEntryIds: [],
      };
    }

    if (authorization.state !== AuthorizationState.Active) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.AuthorizationNotActive,
        message: `Authorization is not active: ${event.authorizationId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Authorization is not active`,
        generatedEntryIds: [],
      };
    }

    if (event.amount > authorization.remainingHold) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.SettlementExceedsHold,
        message: `Settlement exceeds hold: ${event.authorizationId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Settlement exceeds hold`,
        generatedEntryIds: [],
      };
    }

    const entry = this.appendEntry({
      sourceEventId: event.id,
      accountId: event.accountId,
      amount: -event.amount,
      valueDay: event.valueDay,
      postingDay: event.postingDay,
      kind: EntryKind.Debit,
      description: event.description,
    });

    authorization.remainingHold = 0n;
    authorization.state = AuthorizationState.Settled;
    authorization.settledAmount = event.amount;
    authorization.endedDay = event.postingDay;

    this.appendTransition({
      authorizationId: event.authorizationId,
      accountId: event.accountId,
      day: event.postingDay,
      state: authorization.state,
      holdAmount: authorization.remainingHold,
      reason: null,
    });

    return { status: EventStatus.Posted, reason: null, generatedEntryIds: [entry.id] };
  }

  private reverse(event: ReversalEvent): PostingResult {
    const original = this.entries.find(
      (entry) =>
        entry.sourceEventId === event.reversesEventId &&
        (entry.kind === EntryKind.Credit ||
          entry.kind === EntryKind.Debit ||
          entry.kind === EntryKind.Instalment),
    );

    if (!original) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.ReversalTargetMissing,
        message: `Reversal target not found: ${event.reversesEventId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Reversal target not found`,
        generatedEntryIds: [],
      };
    }

    if (this.reversedEventIds.has(event.reversesEventId)) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.ReversalAlreadyApplied,
        message: `Reversal already applied: ${event.reversesEventId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Reversal already applied`,
        generatedEntryIds: [],
      };
    }

    const originalAbsolute = original.amount < 0n ? -original.amount : original.amount;

    if (event.amount !== originalAbsolute) {
      this.recordError({
        day: event.postingDay,
        eventId: event.id,
        code: ErrorCode.ReversalAmountMismatch,
        message: `Reversal amount does not match: ${event.reversesEventId}`,
      });

      return {
        status: EventStatus.Rejected,
        reason: `Reversal amount mismatch`,
        generatedEntryIds: [],
      };
    }

    const entry = this.appendEntry({
      sourceEventId: event.id,
      accountId: event.accountId,
      amount: -original.amount,
      valueDay: event.valueDay,
      postingDay: event.postingDay,
      kind: EntryKind.Reversal,
      description: event.description,
    });

    this.reversedEventIds.add(event.reversesEventId);

    return { status: EventStatus.Posted, reason: null, generatedEntryIds: [entry.id] };
  }

  private assessFee(input: AssessFeeInput): Minor {
    const feeKey = `${input.account.id}:${input.day}`;

    if (input.balance >= 0n || this.assessedFees.has(feeKey)) {
      return 0n;
    }

    const feeAmount = this.feeSchedule.get(input.account.currency.code);

    if (feeAmount === undefined) {
      this.recordError({
        day: input.day,
        eventId: `SYSTEM-FEE-${input.account.id}`,
        code: ErrorCode.NoFeeSchedule,
        message: `No overdraft fee configured for ${input.account.currency.code}`,
      });

      return 0n;
    }

    this.appendEntry({
      sourceEventId: `SYSTEM-FEE-${input.account.id}-DAY-${input.day}`,
      accountId: input.account.id,
      amount: -feeAmount,
      valueDay: input.day,
      postingDay: input.day,
      kind: EntryKind.Fee,
      description: `Overdraft fee for day ${input.day}`,
    });
    const assessment: FeeAssessment = {
      day: input.day,
      accountId: input.account.id,
      amount: feeAmount,
    };

    this.assessedFees.set(feeKey, assessment);
    this.fees.push(assessment);

    return feeAmount;
  }

  private accrue(input: AccrueInput): Minor {
    if (input.balance <= 0n) {
      return 0n;
    }

    const amount = roundHalfUp({
      numerator: input.balance * this.interestRateNumerator,
      denominator: this.interestRateDenominator,
    });

    if (amount === 0n) {
      return 0n;
    }

    const accruals = this.accruals.get(input.account.id);

    if (!accruals) {
      throw new Error(`Missing accrual bucket: ${input.account.id}`);
    }

    const accrual: Accrual = {
      day: input.day,
      accountId: input.account.id,
      closingBalance: input.balance,
      amount,
    };

    accruals.push(accrual);

    return amount;
  }

  private appendEntry(input: AppendEntryInput): LedgerEntry {
    const entry: LedgerEntry = {
      id: `ENTRY-${this.nextEntrySequence.toString().padStart(3, `0`)}`,
      ...input,
    };

    this.nextEntrySequence += 1;
    this.entries.push(entry);

    return entry;
  }

  private appendTransition(input: TransitionInput): void {
    const transition: AuthorizationTransition = {
      sequence: this.nextTransitionSequence,
      ...input,
    };

    this.nextTransitionSequence += 1;
    this.authorizationTransitions.push(transition);
  }

  private recordError(error: LedgerError): void {
    this.errors.push(error);
  }

  private activeHolds(accountId: AccountId): Minor {
    let total = 0n;

    for (const authorization of this.authorizationRecords.values()) {
      if (
        authorization.accountId === accountId &&
        authorization.state === AuthorizationState.Active
      ) {
        total += authorization.remainingHold;
      }
    }

    return total;
  }

  private balance(accountId: AccountId): Minor {
    const account = this.accounts.get(accountId);

    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    let total = account.openingBalance;

    for (const entry of this.entries) {
      if (entry.accountId === accountId) {
        total += entry.amount;
      }
    }

    return total;
  }

  private balanceAsOf(input: BalanceAsOfInput): Minor {
    const account = this.accounts.get(input.accountId);

    if (!account) {
      throw new Error(`Unknown account: ${input.accountId}`);
    }

    let total = account.openingBalance;

    for (const entry of this.entries) {
      if (entry.accountId === input.accountId && entry.valueDay <= input.day) {
        total += entry.amount;
      }
    }

    return total;
  }
}

export { Ledger };
