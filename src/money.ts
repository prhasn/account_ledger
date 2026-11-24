import type {
  AmountFromDecimalInput,
  FormatMoneyInput,
  Minor,
  Precision,
  RoundHalfUpInput,
  SplitInstalmentsInput,
} from './types.ts';

const DECIMAL_BASE = 10n;
const DIGIT_GROUP = /\B(?=(\d{3})+(?!\d))/g;
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

function amountFromDecimal(input: AmountFromDecimalInput): Minor {
  const match = DECIMAL_PATTERN.exec(input.value);

  if (!match) {
    throw new Error(`Invalid decimal amount: ${input.value}`);
  }

  const sign = match[1] === `-` ? -1n : 1n;
  const wholePart = BigInt(match[2] ?? `0`);
  const fractionText = match[3] ?? ``;

  if (fractionText.length > input.precision) {
    throw new Error(`Amount exceeds precision ${input.precision}: ${input.value}`);
  }

  const paddedFraction = fractionText.padEnd(input.precision, `0`);
  const fractionPart = paddedFraction === `` ? 0n : BigInt(paddedFraction);
  const factor = DECIMAL_BASE ** BigInt(input.precision);

  return sign * (wholePart * factor + fractionPart);
}

function formatMoney(input: FormatMoneyInput): string {
  const isNegative = input.amount < 0n;
  const absolute = isNegative ? -input.amount : input.amount;
  const factor = DECIMAL_BASE ** BigInt(input.precision);
  const wholePart = (absolute / factor).toString();
  const fractionPart = (absolute % factor).toString().padStart(input.precision, `0`);
  const sign = isNegative ? `-` : input.includeSign && input.amount > 0n ? `+` : ``;

  return `${sign}${wholePart.replace(DIGIT_GROUP, `,`)}.${fractionPart}`;
}

function roundHalfUp(input: RoundHalfUpInput): Minor {
  if (input.denominator <= 0n) {
    throw new Error(`Denominator must be positive: ${input.denominator}`);
  }

  const sign = input.numerator < 0n ? -1n : 1n;
  const absolute = input.numerator < 0n ? -input.numerator : input.numerator;
  const rounded = (absolute + input.denominator / 2n) / input.denominator;

  return sign * rounded;
}

function splitInstalments(input: SplitInstalmentsInput): readonly Minor[] {
  if (input.count <= 0) {
    throw new Error(`Instalment count must be positive: ${input.count}`);
  }

  if (input.amount < 0n) {
    throw new Error(`Instalment amount must not be negative: ${input.amount}`);
  }

  const count = BigInt(input.count);
  const baseAmount = input.amount / count;
  const remainder = input.amount % count;
  const instalments: Minor[] = [];

  for (let index = 0; index < input.count; index += 1) {
    const extra = BigInt(index) < remainder ? 1n : 0n;
    instalments.push(baseAmount + extra);
  }

  return instalments;
}

export { amountFromDecimal, formatMoney, roundHalfUp, splitInstalments };
