import type {
  CalculationError,
  CalculationOutcome,
  InvestmentInput,
  InvestmentParameters,
  InvestmentResult,
} from "./investmentTypes";
import { LIMITS, validateInput } from "./investmentValidation";

type Plan = Omit<InvestmentParameters, "endAmount">;
class EngineError extends Error {
  constructor(readonly detail: CalculationError) {
    super(detail.message);
  }
}
function fail(
  code: CalculationError["code"],
  message = "在当前参数条件下无法达到目标金额，请调整输入。",
): never {
  throw new EngineError({ code, message });
}

export function periodsPerYear(
  frequency: Plan["contributionFrequency"],
): number {
  return frequency === "monthly" ? 12 : 1;
}

/** log1p preserves tiny rates; log growth avoids prematurely overflowing annual factors. */
function periodLogGrowth(plan: Plan): number {
  const annualLog =
    plan.compoundFrequency === "annually"
      ? Math.log1p(plan.returnRate)
      : 12 * Math.log1p(plan.returnRate / 12);
  return annualLog / periodsPerYear(plan.contributionFrequency);
}

function factors(plan: Plan, years = plan.years) {
  const n = years * periodsPerYear(plan.contributionFrequency);
  const x = periodLogGrowth(plan);
  const growth = Math.exp(n * x);
  // Exactly zero uses the analytic limit. expm1 keeps nonzero rates near zero accurate.
  const annuity = x === 0 ? n : Math.expm1(n * x) / Math.expm1(x);
  return {
    growth,
    annuity:
      annuity * (plan.contributionTiming === "beginning" ? Math.exp(x) : 1),
  };
}

/** Internal evaluation may return +Infinity while bracketing; it never escapes the public API. */
function futureValue(plan: Plan, years = plan.years): number {
  if (years === 0) return plan.startingAmount;
  const { growth, annuity } = factors(plan, years);
  return (
    (plan.startingAmount === 0 ? 0 : plan.startingAmount * growth) +
    (plan.contribution === 0 ? 0 : plan.contribution * annuity)
  );
}

function checkedAmount(value: number): number {
  if (!Number.isFinite(value) || value > LIMITS.amount) {
    fail(
      "OVERFLOW",
      "计算金额超出支持范围（1,000 万亿元），请降低金额、收益率或投资期限。",
    );
  }
  if (value < 0) fail("NO_SOLUTION");
  return value;
}

/** Validated forward function for platform adapters that do not need a full result. */
export function calculateFutureValue(plan: Plan): number {
  const error = validateInput({ ...plan, mode: "endAmount" });
  if (error) throw new EngineError(error);
  return checkedAmount(futureValue(plan));
}

const MAX_ITERATIONS = 240;
const RELATIVE_TOLERANCE = 2e-13;

function bisect(
  fn: (x: number) => number,
  target: number,
  low: number,
  high: number,
): number {
  const increasing = fn(high) > fn(low);
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const middle = low + (high - low) / 2;
    const value = fn(middle);
    if (
      Math.abs(value - target) <=
      Math.max(Number.MIN_VALUE, Math.abs(target) * RELATIVE_TOLERANCE)
    )
      return middle;
    if (middle === low || middle === high) {
      if (Math.abs(value - target) <= Math.max(1e-8, Math.abs(target) * 1e-10))
        return middle;
      fail("CONVERGENCE", "当前参数接近数值边界，无法可靠求解，请调整输入。");
    }
    if (value < target === increasing) low = middle;
    else high = middle;
  }
  fail("CONVERGENCE", "计算未能收敛，请调整输入。");
}

function solveRate(plan: Plan, target: number): number {
  const n = plan.years * periodsPerYear(plan.contributionFrequency);
  if (plan.startingAmount === 0 && plan.contribution === 0) {
    fail(
      target === 0 ? "NON_UNIQUE" : "NO_SOLUTION",
      target === 0 ? "没有本金或追加投入，无法确定唯一的收益率。" : undefined,
    );
  }
  // Finite rates above -100% cannot turn a positive cash flow into exactly zero.
  // Reject before evaluating the lower bracket, where floating-point underflow is possible.
  if (target === 0) fail("NO_SOLUTION");
  if (
    n === 1 &&
    plan.startingAmount === 0 &&
    plan.contributionTiming === "end"
  ) {
    fail(
      target === plan.contribution ? "NON_UNIQUE" : "NO_SOLUTION",
      "只有一次期末投入，收益率无法改变期末金额，无法求得唯一解。",
    );
  }
  // Search log(1+r) for annual compounding and 12*log(1+r/12) for monthly.
  const annual = plan.compoundFrequency === "annually";
  const toRate = (x: number) =>
    annual ? Math.expm1(x) : 12 * Math.expm1(x / 12);
  const toLog = (r: number) =>
    annual ? Math.log1p(r) : 12 * Math.log1p(r / 12);
  const lower = toLog(-1 + Number.EPSILON);
  const upper = toLog(LIMITS.maxReturnRate);
  const evaluate = (x: number) =>
    futureValue({ ...plan, returnRate: toRate(x) });

  // The generalized annuity with 0<N<1 can have TWO rate roots (end contributions).
  // It is decreasing or has a single minimum when P<PMT. Split at that minimum,
  // and reject multiple roots instead of silently selecting an arbitrary return.
  if (
    n < 1 &&
    plan.contributionTiming === "end" &&
    plan.startingAmount < plan.contribution
  ) {
    let a = lower;
    let b = upper;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let c = b - ratio * (b - a);
    let d = a + ratio * (b - a);
    for (let iteration = 0; iteration < 160 && b - a > 1e-13; iteration++) {
      if (evaluate(c) < evaluate(d)) {
        b = d;
        d = c;
        c = b - ratio * (b - a);
      } else {
        a = c;
        c = d;
        d = a + ratio * (b - a);
      }
    }
    const minimum = (a + b) / 2;
    const minValue = evaluate(minimum);
    if (target < minValue) fail("NO_SOLUTION");
    const leftRoot = target <= evaluate(lower);
    const rightRoot = target <= evaluate(upper);
    if (leftRoot && rightRoot)
      fail(
        "NON_UNIQUE",
        "不足一个投入周期时，这组参数可能对应多个收益率，无法确定唯一解。请调整期限或投入。",
      );
    if (!leftRoot && !rightRoot) fail("NO_SOLUTION");
    return toRate(
      leftRoot
        ? bisect(evaluate, target, lower, minimum)
        : bisect(evaluate, target, minimum, upper),
    );
  }

  const atLower = evaluate(lower);
  if (target < atLower || target > evaluate(upper))
    fail(
      "NO_SOLUTION",
      "在支持的年化收益率范围（大于 -100% 至 10,000%）内无法达到目标金额。",
    );
  if (futureValue({ ...plan, returnRate: 0 }) === target) return 0;
  // Start at 10%, expand up to the documented domain, with a hard bound.
  let high = toLog(0.1);
  while (evaluate(high) < target && high < upper)
    high = Math.min(upper, high * 2);
  return toRate(bisect(evaluate, target, lower, high));
}

function solveYears(plan: Plan, target: number): number {
  const p = periodsPerYear(plan.contributionFrequency);
  const x = periodLogGrowth(plan);
  if (x === 0) {
    if (plan.contribution === 0)
      fail(
        target === plan.startingAmount ? "NON_UNIQUE" : "NO_SOLUTION",
        "零收益且无追加投入，无法求得唯一的投资期限。",
      );
    const years = (target - plan.startingAmount) / (plan.contribution * p);
    if (!(years > 0) || years > LIMITS.years)
      fail("NO_SOLUTION", "在大于 0 年至 1,000 年的期限内无法达到目标金额。");
    return years;
  }
  const adjustedContribution =
    plan.contribution *
    (plan.contributionTiming === "beginning" ? Math.exp(x) : 1);
  // FV(t) = P + (P*i + adjustedPMT) * expm1(N*x)/i.
  // Its sign of change never reverses; an equilibrium balance has no unique duration.
  const change = plan.startingAmount * Math.expm1(x) + adjustedContribution;
  if (change === 0)
    fail(
      target === plan.startingAmount ? "NON_UNIQUE" : "NO_SOLUTION",
      "当前投入与收益相抵，资产保持不变，无法求得投资期限。",
    );
  if ((target - plan.startingAmount) * change <= 0) fail("NO_SOLUTION");
  if (x < 0) {
    const asymptote = -adjustedContribution / Math.expm1(x);
    if (
      (change > 0 && target >= asymptote) ||
      (change < 0 && target <= asymptote)
    )
      fail("NO_SOLUTION");
  }
  const endpoint = futureValue(plan, LIMITS.years);
  if ((change > 0 && target > endpoint) || (change < 0 && target < endpoint))
    fail("NO_SOLUTION", "在大于 0 年至 1,000 年的期限内无法达到目标金额。");
  const result = bisect(
    (years) => futureValue(plan, years),
    target,
    0,
    LIMITS.years,
  );
  if (!(result > 0)) fail("NO_SOLUTION");
  return result;
}

function buildResult(
  mode: InvestmentInput["mode"],
  plan: Plan,
): InvestmentResult {
  const endAmount = checkedAmount(futureValue(plan));
  const totalContributions = checkedAmount(
    plan.contribution * periodsPerYear(plan.contributionFrequency) * plan.years,
  );
  const parameters = { ...plan, endAmount };
  const annualBreakdown: InvestmentResult["annualBreakdown"] = [];
  const chartData: InvestmentResult["chartData"] = [
    { year: 0, assets: plan.startingAmount, invested: plan.startingAmount },
  ];
  let previousYear = 0;
  let previousAssets = plan.startingAmount;
  let previousContributions = 0;
  // Avoid a microscopic extra annual row when a numerical inverse lands just above an integer.
  for (let year = 1; previousYear < plan.years; year++) {
    const finalRow = year >= plan.years || Math.abs(year - plan.years) < 1e-10;
    const endpoint = finalRow ? plan.years : year;
    const assets = finalRow
      ? endAmount
      : checkedAmount(futureValue(plan, endpoint));
    const cumulative = finalRow
      ? totalContributions
      : plan.contribution *
        periodsPerYear(plan.contributionFrequency) *
        endpoint;
    const contribution = cumulative - previousContributions;
    annualBreakdown.push({
      year: endpoint,
      duration: endpoint - previousYear,
      contribution,
      interest: assets - previousAssets - contribution,
      endAmount: assets,
    });
    chartData.push({
      year: endpoint,
      assets,
      invested: checkedAmount(plan.startingAmount + cumulative),
    });
    previousYear = endpoint;
    previousAssets = assets;
    previousContributions = cumulative;
  }
  return {
    mode,
    solvedValue: parameters[mode],
    parameters,
    endAmount,
    totalContributions,
    totalInterest: endAmount - plan.startingAmount - totalContributions,
    annualBreakdown,
    chartData,
  };
}

/** Public, framework-independent entry point: structured input, structured success/error. */
export function calculateInvestment(
  input: InvestmentInput,
): CalculationOutcome {
  const error = validateInput(input);
  if (error) return { ok: false, error };
  try {
    const plan: Plan = {
      startingAmount: 0,
      contribution: 0,
      returnRate: 0,
      years: 1,
      ...input,
    };
    switch (input.mode) {
      case "endAmount":
        break;
      case "startingAmount": {
        const { growth, annuity } = factors(plan);
        if (
          !Number.isFinite(growth) ||
          growth === 0 ||
          !Number.isFinite(annuity)
        )
          fail(
            "OVERFLOW",
            "当前参数超出可靠反向计算范围，请调整收益率或期限。",
          );
        const remainder = input.endAmount - plan.contribution * annuity;
        // Permit only machine-level cancellation at the nonnegative boundary.
        plan.startingAmount =
          remainder < 0 &&
          Math.abs(remainder) <=
            Number.EPSILON * Math.max(1, input.endAmount) * 8
            ? 0
            : checkedAmount(remainder / growth);
        break;
      }
      case "contribution": {
        const { growth, annuity } = factors(plan);
        if (
          !Number.isFinite(growth) ||
          !Number.isFinite(annuity) ||
          annuity === 0
        )
          fail("OVERFLOW");
        const remainder = input.endAmount - plan.startingAmount * growth;
        plan.contribution =
          remainder < 0 &&
          Math.abs(remainder) <=
            Number.EPSILON * Math.max(1, input.endAmount) * 8
            ? 0
            : checkedAmount(remainder / annuity);
        break;
      }
      case "returnRate":
        plan.returnRate = solveRate(plan, input.endAmount);
        break;
      case "years":
        plan.years = solveYears(plan, input.endAmount);
        break;
    }
    const result = buildResult(input.mode, plan);
    return { ok: true, result };
  } catch (error: unknown) {
    if (error instanceof EngineError) return { ok: false, error: error.detail };
    return {
      ok: false,
      error: {
        code: "OVERFLOW",
        message: "当前参数无法可靠计算，请调整输入。",
      },
    };
  }
}
