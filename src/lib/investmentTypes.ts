export type CalculationMode =
  | "endAmount"
  | "contribution"
  | "returnRate"
  | "startingAmount"
  | "years";
export type CompoundFrequency = "annually" | "monthly";
export type ContributionFrequency = "monthly" | "yearly";
export type ContributionTiming = "beginning" | "end";

export interface InvestmentParameters {
  startingAmount: number;
  endAmount: number;
  /** Signed per-period cash flow: positive deposits, negative withdrawals. */
  contribution: number;
  /** Decimal nominal annual rate: 0.06 means 6%. */
  returnRate: number;
  years: number;
  compoundFrequency: CompoundFrequency;
  contributionFrequency: ContributionFrequency;
  contributionTiming: ContributionTiming;
}

/** The unknown variable is absent, rather than an ignored required input. */
export type InvestmentInput = {
  [M in CalculationMode]: Omit<InvestmentParameters, M> & { mode: M };
}[CalculationMode];

export interface AnnualBreakdownItem {
  year: number;
  duration: number;
  contribution: number;
  interest: number;
  endAmount: number;
}

export interface GrowthPoint {
  year: number;
  assets: number;
  /** Principal plus cumulative signed contributions; may be negative. */
  invested: number;
}

export interface InvestmentResult {
  mode: CalculationMode;
  solvedValue: number;
  parameters: InvestmentParameters;
  endAmount: number;
  totalContributions: number;
  totalInterest: number;
  annualBreakdown: AnnualBreakdownItem[];
  chartData: GrowthPoint[];
}

export type ErrorCode =
  | "INVALID_INPUT"
  | "NO_SOLUTION"
  | "NON_UNIQUE"
  | "OUT_OF_RANGE"
  | "OVERFLOW"
  | "CONVERGENCE";
export interface CalculationError {
  code: ErrorCode;
  message: string;
  field?: keyof InvestmentParameters;
}
export type CalculationOutcome =
  | { ok: true; result: InvestmentResult }
  | { ok: false; error: CalculationError };
