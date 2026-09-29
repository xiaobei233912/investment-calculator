import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateInvestment } from "../lib/investmentEngine";
import { formatAxisAmount } from "../lib/investmentFormatting";
import type { InvestmentInput, InvestmentParameters } from "../lib/investmentTypes";
import { Results } from "../components/Results";

const base: InvestmentParameters = {
  startingAmount: 100000, endAmount: 0, contribution: -1000, returnRate: 0.06, years: 5,
  compoundFrequency: "annually", contributionFrequency: "monthly", contributionTiming: "end",
};
function success(input: InvestmentInput) {
  const result = calculateInvestment(input);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.result;
}
function close(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(Math.max(1, Math.abs(expected)) * 1e-8);
}

describe("signed contributions", () => {
  for (const compoundFrequency of ["annually", "monthly"] as const)
    for (const contributionFrequency of ["monthly", "yearly"] as const)
      for (const contributionTiming of ["beginning", "end"] as const)
        it(`withdrawal recurrence and four inverses: ${compoundFrequency}/${contributionFrequency}/${contributionTiming}`, () => {
          const plan = { ...base, compoundFrequency, contributionFrequency, contributionTiming };
          const p = contributionFrequency === "monthly" ? 12 : 1;
          const q = (compoundFrequency === "annually" ? 1.06 : 1.005 ** 12) ** (1 / p);
          let balance = plan.startingAmount;
          for (let k = 0; k < plan.years * p; k++) {
            if (contributionTiming === "beginning") balance += plan.contribution;
            balance *= q;
            if (contributionTiming === "end") balance += plan.contribution;
          }
          const result = success({ ...plan, mode: "endAmount" });
          close(result.endAmount, balance);
          expect(result.totalContributions).toBe(-1000 * p * 5);
          expect(result.chartData.at(-1)!.assets).toBe(result.endAmount);
          expect(result.annualBreakdown.at(-1)!.endAmount).toBe(result.endAmount);
          close(result.annualBreakdown.reduce((sum, row) => sum + row.interest, 0), result.totalInterest);
          for (const mode of ["startingAmount", "contribution", "returnRate", "years"] as const)
            close(success({ ...plan, endAmount: balance, mode }).solvedValue, plan[mode]);
        });

  it.each([0, 1e-14, -1e-14, -0.06])("supports withdrawal inverses at rate %s", (returnRate) => {
    const plan = { ...base, returnRate };
    const endAmount = success({ ...plan, mode: "endAmount" }).endAmount;
    for (const mode of ["startingAmount", "contribution", "returnRate", "years"] as const)
      close(success({ ...plan, endAmount, mode }).solvedValue, plan[mode]);
  });
  it("can fund spending from growth after net invested capital becomes negative", () => {
    const result = success({ ...base, contributionFrequency: "yearly", returnRate: 0.1, contribution: -10000, years: 20, mode: "endAmount" });
    close(result.endAmount, 100000);
    expect(result.totalContributions).toBe(-200000);
    expect(result.chartData.at(-1)!.invested).toBe(-100000);
    close(result.totalInterest, 200000);
    const html = renderToStaticMarkup(<Results result={result} />);
    expect(html).toContain("累计提取金额");
    expect(html).toContain("累计净投入");
    expect(html).toContain("-¥100,000.00");
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    expect(formatAxisAmount(-100000)).toBe("-10万");
  });
  it.each([0, 0.06, -0.06])("solves time until exhaustion at rate %s", (returnRate) => {
    const result = success({ ...base, returnRate, mode: "years", endAmount: 0 });
    expect(result.solvedValue).toBeGreaterThan(0);
    expect(result.endAmount).toBeLessThan(1e-7);
    expect(result.endAmount).toBeGreaterThanOrEqual(0);
  });
  it("solves the zero terminal balance rate", () => {
    const result = success({ ...base, startingAmount: 120000, years: 10, endAmount: 0, mode: "returnRate" });
    expect(result.solvedValue).toBe(0);
  });
  it.each([0.1, -0.1, -0.9999, 2])("solves exhaustion rate %s without a negative residual balance", (returnRate) => {
    const result = success({ ...base, startingAmount: 1000, contribution: -1000 * (1 + returnRate), years: 1, contributionFrequency: "yearly", endAmount: 0, mode: "returnRate" });
    close(result.solvedValue, returnRate);
    expect(result.endAmount).toBeGreaterThanOrEqual(0);
    expect(result.endAmount).toBeLessThan(1e-7);
  });
  it("rejects overdrawn plans clearly", () => {
    const result = calculateInvestment({ ...base, years: 100, mode: "endAmount" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("资产不足");
  });
  it("rejects no-capital withdrawals and impossible time direction", () => {
    expect(calculateInvestment({ ...base, startingAmount: 0, mode: "returnRate" }).ok).toBe(false);
    expect(calculateInvestment({ ...base, returnRate: 0, endAmount: 200000, mode: "years" }).ok).toBe(false);
  });
  it("recognizes non-unique rate with one fully withdrawn beginning period", () => {
    const result = calculateInvestment({ ...base, startingAmount: 1000, years: 1, contributionFrequency: "yearly", contributionTiming: "beginning", endAmount: 0, mode: "returnRate" });
    expect(result).toMatchObject({ ok: false, error: { code: "NON_UNIQUE" } });
  });
  it("rejects an equilibrium time inverse", () => {
    const result = calculateInvestment({ ...base, contribution: -10000, returnRate: 0.1, contributionFrequency: "yearly", endAmount: 100000, mode: "years" });
    expect(result).toMatchObject({ ok: false, error: { code: "NON_UNIQUE" } });
  });
  it("does not choose between two fractional-due rate roots", () => {
    // With N=.5, P=75, W=100: FV=75*s - 100*s*s/(s+1), s=sqrt(1+r).
    // FV=20 has two roots: s=(55 +/- sqrt(1025))/50.
    const result = calculateInvestment({ ...base, startingAmount: 75, contribution: -100, years: 0.5, contributionFrequency: "yearly", contributionTiming: "beginning", endAmount: 20, mode: "returnRate" });
    expect(result).toMatchObject({ ok: false, error: { code: "NON_UNIQUE" } });
  });
  it("supports a unique fractional-due negative return", () => {
    const plan = { ...base, years: 0.42, contributionFrequency: "yearly" as const, contributionTiming: "beginning" as const, returnRate: -0.5 };
    const result = success({ ...plan, mode: "endAmount" });
    close(success({ ...plan, endAmount: result.endAmount, mode: "returnRate" }).solvedValue, -0.5);
  });
  it.each([-1e16, -Infinity, NaN])("rejects invalid signed contribution %s", (contribution) => {
    expect(calculateInvestment({ ...base, contribution, mode: "endAmount" }).ok).toBe(false);
  });
});

describe("seeded withdrawal round trips including fractional terms", () => {
  let seed = 20260929;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cases = Array.from({ length: 64 }, (_, index) => ({
    ...base, startingAmount: 100000 + random() * 100000, contribution: -10 - random() * 100,
    returnRate: -0.02 + random() * 0.15, years: 1.1 + random() * 10,
    compoundFrequency: index % 2 ? "annually" as const : "monthly" as const,
    contributionFrequency: index % 4 < 2 ? "monthly" as const : "yearly" as const,
    contributionTiming: index % 8 < 4 ? "beginning" as const : "end" as const,
  }));
  it.each(cases)("recovers signed-cash-flow case %#", (plan) => {
    const result = success({ ...plan, mode: "endAmount" });
    for (const mode of ["startingAmount", "contribution", "returnRate", "years"] as const)
      close(success({ ...plan, endAmount: result.endAmount, mode }).solvedValue, plan[mode]);
  });
});
