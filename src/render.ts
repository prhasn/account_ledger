import { ACCOUNT_ORDER } from './constants.ts';
import { formatMoney } from './money.ts';
import { AccountId, EventKind } from './types.ts';
import type {
  Account,
  Accrual,
  FormatEventAmountInput,
  Minor,
  RenderCloseInput,
  RenderRestatementInput,
  ReplayResult,
} from './types.ts';

function formatEventAmount(input: FormatEventAmountInput): string {
  const amount = formatMoney({
    amount: input.event.amount,
    precision: input.account.currency.precision,
  });
  const currency = input.account.currency.code;

  switch (input.event.kind) {
    case EventKind.Credit:
      return `+${amount} ${currency}`;
    case EventKind.Debit:
      return `-${amount} ${currency}`;
    case EventKind.Authorization:
      return `hold ${amount} ${currency}`;
    case EventKind.Settlement:
      return `settle ${amount} ${currency}`;
    case EventKind.Reversal:
      return `reverse ${amount} ${currency}`;
    case EventKind.InstalmentCredit:
      return `+${amount} ${currency} (${input.event.instalmentCount} instalments)`;
    default:
      throw new Error(`Unhandled event kind`);
  }
}

function renderClose(input: RenderCloseInput): string {
  const money = (amount: Minor): string =>
    formatMoney({ amount, precision: input.account.currency.precision });
  const currency = input.account.currency.code;

  return [
    `${input.close.accountId}`,
    `pre-fee ${money(input.close.preFeeBalance)} ${currency}`,
    `fee ${money(input.close.fee)}`,
    `post-fee ${money(input.close.postFeeBalance)}`,
    `interest ${money(input.close.accrual)}`,
    `holds ${money(input.close.activeHolds)}`,
    `available ${money(input.close.available)}`,
  ].join(`  `);
}

function renderRestatement(input: RenderRestatementInput): string[] {
  const lines: string[] = [];

  for (const point of input.points) {
    const balances: string[] = [];

    for (const accountId of ACCOUNT_ORDER) {
      const account = input.accounts.get(accountId);
      const balance = point.balances.get(accountId);

      if (!account || balance === undefined) {
        continue;
      }

      balances.push(
        `${accountId} ${formatMoney({
          amount: balance,
          precision: account.currency.precision,
        })} ${account.currency.code}`,
      );
    }

    lines.push(`  Day ${point.day}: ${balances.join(`  |  `)}`);
  }

  return lines;
}

function renderReplay(result: ReplayResult): string {
  const lines: string[] = [];
  const accounts = new Map<AccountId, Account>();

  for (const account of result.accounts) {
    accounts.set(account.id, account);
  }

  lines.push(
    `In-memory account ledger replay`,
    `Posting order is authoritative. Value dates drive as-of balances.`,
    ``,
  );

  for (const snapshot of result.days) {
    lines.push(`=== Day ${snapshot.day} ===`);

    let eventCount = 0;

    for (const record of result.eventLog) {
      if (record.event.postingDay !== snapshot.day) {
        continue;
      }

      const account = accounts.get(record.event.accountId);

      if (!account) {
        throw new Error(`Unknown account: ${record.event.accountId}`);
      }

      const status = record.reason ? `${record.status} (${record.reason})` : record.status;

      lines.push(
        `  ${record.event.id}  ${record.event.kind}  ${record.event.accountId}  ${formatEventAmount({
          event: record.event,
          account,
        })}  value day ${record.event.valueDay}  ${status}  (${record.event.description})`,
      );
      eventCount += 1;
    }

    if (eventCount === 0) {
      lines.push(`  none`);
    }

    lines.push(`Ledger close:`);

    for (const accountId of ACCOUNT_ORDER) {
      const close = snapshot.accountCloses.get(accountId);
      const account = accounts.get(accountId);

      if (!close || !account) {
        continue;
      }

      lines.push(`  ${renderClose({ close, account })}`);
    }

    lines.push(`Authorizations:`);

    if (snapshot.authorizationStates.size === 0) {
      lines.push(`  none`);
    } else {
      for (const [authorizationId, state] of snapshot.authorizationStates) {
        lines.push(`  ${authorizationId}: ${state}`);
      }
    }

    lines.push(`Errors:`);

    let errorCount = 0;

    for (const error of result.errors) {
      if (error.day !== snapshot.day) {
        continue;
      }

      lines.push(`  ${error.eventId}: ${error.code} (${error.message})`);
      errorCount += 1;
    }

    if (errorCount === 0) {
      lines.push(`  none`);
    }

    lines.push(``);
  }

  lines.push(`Restatement at end of Day 5, before fees:`);
  const dayFive = result.days.find((snapshot) => snapshot.day === 5);

  if (dayFive) {
    for (const line of renderRestatement({ points: dayFive.restatement, accounts })) {
      lines.push(line);
    }
  }

  lines.push(``, `Restatement at end of Day 6, before capitalization:`);
  const daySix = result.days.find((snapshot) => snapshot.day === 6);

  if (daySix) {
    for (const line of renderRestatement({ points: daySix.restatement, accounts })) {
      lines.push(line);
    }
  }

  lines.push(``, `Fees:`);

  if (result.fees.length === 0) {
    lines.push(`  none`);
  } else {
    for (const fee of result.fees) {
      const account = accounts.get(fee.accountId);

      if (!account) {
        continue;
      }

      lines.push(
        `  Day ${fee.day} ${fee.accountId}: ${formatMoney({
          amount: fee.amount,
          precision: account.currency.precision,
        })} ${account.currency.code}`,
      );
    }
  }

  lines.push(``, `Interest accruals:`);
  const accrualsByAccount = new Map<AccountId, Accrual[]>();

  for (const accrual of result.accruals) {
    const accountAccruals = accrualsByAccount.get(accrual.accountId) ?? [];

    accountAccruals.push(accrual);
    accrualsByAccount.set(accrual.accountId, accountAccruals);
  }

  for (const accountId of ACCOUNT_ORDER) {
    const account = accounts.get(accountId);
    const accruals = accrualsByAccount.get(accountId) ?? [];

    if (!account) {
      continue;
    }

    const parts: string[] = [];

    for (const accrual of accruals) {
      parts.push(
        `day ${accrual.day} ${formatMoney({
          amount: accrual.amount,
          precision: account.currency.precision,
        })}`,
      );
    }

    lines.push(`  ${accountId}: ${parts.join(`, `) || `none`}`);
  }

  lines.push(``, `Capitalization at end of Day 6:`);
  const capitalizedByAccount = new Map<AccountId, Minor>();

  for (const capitalization of result.capitalizations) {
    capitalizedByAccount.set(capitalization.accountId, capitalization.amount);
  }

  for (const accountId of ACCOUNT_ORDER) {
    const account = accounts.get(accountId);

    if (!account) {
      continue;
    }

    const amount = capitalizedByAccount.get(accountId) ?? 0n;

    lines.push(
      `  ${accountId}: ${formatMoney({
        amount,
        precision: account.currency.precision,
      })} ${account.currency.code}`,
    );
  }

  lines.push(``, `Final balances:`);

  for (const accountId of ACCOUNT_ORDER) {
    const account = accounts.get(accountId);
    const balance = result.finalBalances.get(accountId);

    if (!account || balance === undefined) {
      continue;
    }

    lines.push(
      `  ${accountId}: ${formatMoney({
        amount: balance,
        precision: account.currency.precision,
      })} ${account.currency.code}`,
    );
  }

  const totalFees = result.fees.reduce((total, fee) => total + fee.amount, 0n);

  lines.push(
    ``,
    `Summary:`,
    `  input events ${result.eventLog.length}`,
    `  ledger entries ${result.entries.length}`,
    `  authorization transitions ${result.transitions.length}`,
    `  fees assessed ${result.fees.length} (total ${formatMoney({ amount: totalFees, precision: 2 })} AED)`,
    `  accruals ${result.accruals.length}`,
    `  errors ${result.errors.length}`,
  );

  return lines.join(`\n`);
}

export { renderReplay };
