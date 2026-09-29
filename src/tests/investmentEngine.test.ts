import { describe, expect, it } from "vitest";
import {
  calculateFutureValue,
  calculateInvestment,
} from "../lib/investmentEngine";
import type {
  CalculationMode,
  InvestmentInput,
  InvestmentParameters,
} from "../lib/investmentTypes";

const base: InvestmentParameters = {
  startingAmount: 20000,
  contribution: 1000,
  returnRate: 0.06,
  years: 10,
  endAmount: 198290.396358,
  compoundFrequency: "annually",
  contributionFrequency: "monthly",
  contributionTiming: "end",
};
function success(input: InvestmentInput) {
  const outcome = calculateInvestment(input);
  if (!outcome.ok)
    throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  return outcome.result;
}
function close(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    Math.max(1, Math.abs(expected)) * tolerance,
  );
}
function inverse(plan: InvestmentParameters, mode: CalculationMode) {
  return success({ ...plan, mode } as InvestmentInput).solvedValue;
}

describe("Calculator.net reference and five-mode consistency", () => {
  it("matches reference amounts and full precision", () => {
    const result = success({ ...base, mode: "endAmount" });
    expect(Math.abs(result.endAmount - 198290.396358)).toBeLessThan(1e-6);
    expect(result.endAmount.toFixed(2)).toBe("198290.40");
    expect(result.totalContributions).toBe(120000);
    expect(Math.abs(result.totalInterest - 58290.396358)).toBeLessThan(1e-6);
  });
  it.each(["startingAmount", "contribution", "returnRate", "years"] as const)(
    "round-trips %s",
    (mode) => {
      const plan = { ...base, endAmount: calculateFutureValue(base) };
      close(inverse(plan, mode), plan[mode], 1e-10);
    },
  );
});

describe("frequencies, timing and annual reporting", () => {
  for (const compoundFrequency of ["annually", "monthly"] as const) {
    for (const contributionFrequency of ["monthly", "yearly"] as const) {
      for (const contributionTiming of ["beginning", "end"] as const) {
        it(`${compoundFrequency} / ${contributionFrequency} / ${contributionTiming} agrees with an independent cash-flow recurrence`, () => {
          const p = contributionFrequency === "monthly" ? 12 : 1;
          const plan = {
            ...base,
            compoundFrequency,
            contributionFrequency,
            contributionTiming,
          };
          const factor =
            (compoundFrequency === "annually"
              ? 1 + plan.returnRate
              : (1 + plan.returnRate / 12) ** 12) **
            (1 / p);
          let balance = plan.startingAmount;
          for (let period = 0; period < plan.years * p; period++) {
            if (contributionTiming === "beginning")
              balance += plan.contribution;
            balance *= factor;
            if (contributionTiming === "end") balance += plan.contribution;
          }
          const result = success({ ...plan, mode: "endAmount" });
          close(result.endAmount, balance, 1e-12);
          expect(result.chartData.at(-1)?.assets).toBe(result.endAmount);
          expect(result.annualBreakdown.at(-1)?.endAmount).toBe(
            result.endAmount,
          );
          close(
            result.annualBreakdown.reduce((sum, row) => sum + row.interest, 0),
            result.totalInterest,
          );
          close(
            result.annualBreakdown.reduce(
              (sum, row) => sum + row.contribution,
              0,
            ),
            result.totalContributions,
          );
        });
      }
    }
  }
  it("reports fractional final years without rounding period count", () => {
    const result = success({ ...base, years: 10.42, mode: "endAmount" });
    expect(result.annualBreakdown).toHaveLength(11);
    expect(result.annualBreakdown.at(-1)?.year).toBe(10.42);
    close(result.annualBreakdown.at(-1)!.contribution, 5040);
    expect(result.chartData.at(-1)?.assets).toBe(result.endAmount);
  });
});

describe("zero, near zero, negative and large values", () => {
  it.each(["beginning", "end"] as const)(
    "supports zero return for ALL inverse modes, %s",
    (contributionTiming) => {
      const plan = {
        ...base,
        contributionTiming,
        returnRate: 0,
        endAmount: 140000,
      };
      expect(calculateFutureValue(plan)).toBe(140000);
      for (const mode of [
        "startingAmount",
        "contribution",
        "returnRate",
        "years",
      ] as const)
        close(inverse(plan, mode), plan[mode], 1e-10);
    },
  );
  it.each([1e-14, -1e-14, 1e-9, -1e-9])(
    "avoids cancellation at a near-zero rate %s",
    (returnRate) => {
      close(calculateFutureValue({ ...base, returnRate }), 140000, 1e-8);
    },
  );
  it("supports no contributions", () => {
    const plan = { ...base, contribution: 0, endAmount: 20000 * 1.06 ** 10 };
    close(calculateFutureValue(plan), plan.endAmount, 1e-12);
    for (const mode of [
      "startingAmount",
      "contribution",
      "returnRate",
      "years",
    ] as const)
      close(inverse(plan, mode), plan[mode]);
  });
  it("returns zero for zero capital and contribution in forward mode", () => {
    const result = success({
      ...base,
      startingAmount: 0,
      contribution: 0,
      returnRate: 0,
      mode: "endAmount",
    });
    expect(result.endAmount).toBe(0);
  });
  it.each(["annually", "monthly"] as const)(
    "supports a return close to -100%, %s",
    (compoundFrequency) => {
      const plan = {
        ...base,
        compoundFrequency,
        returnRate: -0.9999,
        years: 2,
      };
      const endAmount = calculateFutureValue(plan);
      expect(Number.isFinite(endAmount)).toBe(true);
      close(
        inverse({ ...plan, endAmount }, "returnRate"),
        plan.returnRate,
        1e-9,
      );
    },
  );
  it("supports decreasing balances and a negative return duration inverse", () => {
    const plan = {
      ...base,
      startingAmount: 100000,
      contribution: 0,
      returnRate: -0.12,
      years: 8,
    };
    const endAmount = calculateFutureValue(plan);
    close(inverse({ ...plan, endAmount }, "years"), 8);
  });
  it("supports large finite balances", () => {
    const result = success({
      ...base,
      startingAmount: 1e13,
      contribution: 1e10,
      mode: "endAmount",
    });
    expect(Number.isFinite(result.endAmount)).toBe(true);
  });
  it("expands the return search interval past 10%", () => {
    const plan = { ...base, returnRate: 2, years: 3 };
    close(
      inverse({ ...plan, endAmount: calculateFutureValue(plan) }, "returnRate"),
      2,
    );
  });
});

describe("invalid, impossible and non-unique cases", () => {
  it.each([
    { startingAmount: -1 },
    { contribution: -1e16 },
    { years: 0 },
    { years: -1 },
    { returnRate: -1 },
    { returnRate: -2 },
    { returnRate: 101 },
    { years: 1001 },
    { startingAmount: NaN },
    { contribution: Infinity },
    { startingAmount: 1e100 },
    { years: undefined },
    { startingAmount: "" },
    { compoundFrequency: "daily" },
    { contributionFrequency: "weekly" },
    { contributionTiming: "invalid" },
  ])("rejects invalid input %j", (change) => {
    const result = calculateInvestment({
      ...base,
      ...change,
      mode: "endAmount",
    } as InvestmentInput);
    expect(result.ok).toBe(false);
  });
  it.each([
    { mode: "returnRate", startingAmount: 0, contribution: 0, endAmount: 100 },
    { mode: "returnRate", startingAmount: 0, contribution: 0, endAmount: 0 },
    {
      mode: "returnRate",
      startingAmount: 0,
      contribution: 100,
      endAmount: 100,
      years: 1 / 12,
    },
    { mode: "returnRate", endAmount: 0 },
    { mode: "returnRate", endAmount: 0, contribution: 0, years: 1000 },
    { mode: "years", returnRate: 0, contribution: 0, endAmount: 30000 },
    { mode: "years", returnRate: 0, contribution: 0, endAmount: 20000 },
    { mode: "years", endAmount: 10000 },
    {
      mode: "years",
      startingAmount: 0,
      contribution: 100,
      returnRate: -0.1,
      contributionFrequency: "yearly",
      endAmount: 1000,
    },
    { mode: "startingAmount", endAmount: 10 },
    { mode: "contribution", endAmount: -10 },
    { mode: "endAmount", years: 1000, returnRate: 100 },
    {
      mode: "returnRate",
      years: 0.5,
      contributionFrequency: "yearly",
      startingAmount: 10,
      contribution: 100,
      endAmount: 50,
    },
  ])("returns a structured error for %j", (change) => {
    const result = calculateInvestment({
      ...base,
      ...change,
    } as InvestmentInput);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).not.toMatch(/NaN|Infinity|undefined/);
  });
  it("handles a unique decreasing fractional-period rate root", () => {
    const plan = {
      ...base,
      years: 0.5,
      contributionFrequency: "yearly" as const,
      startingAmount: 0,
      contribution: 100,
    };
    close(
      inverse({ ...plan, endAmount: calculateFutureValue(plan) }, "returnRate"),
      0.06,
      1e-8,
    );
  });
});

describe("seeded random round trips", () => {
  let seed = 20260928;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  }
  const cases = Array.from({ length: 120 }, (_, index) => ({
    ...base,
    startingAmount: 1000 + random() * 100000,
    contribution: 100 + random() * 3000,
    returnRate: -0.08 + random() * 0.25,
    years: 1.1 + random() * 25,
    compoundFrequency: index % 2 ? ("annually" as const) : ("monthly" as const),
    contributionFrequency:
      index % 4 < 2 ? ("monthly" as const) : ("yearly" as const),
    contributionTiming:
      index % 8 < 4 ? ("beginning" as const) : ("end" as const),
  }));
  it.each(cases)("recovers all unknowns for seeded case %#", (plan) => {
    const complete = { ...plan, endAmount: calculateFutureValue(plan) };
    for (const mode of [
      "startingAmount",
      "contribution",
      "returnRate",
      "years",
    ] as const)
      close(inverse(complete, mode), complete[mode], 2e-7);
  });
});
