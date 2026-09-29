import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Results } from "../components/Results";
import { calculateInvestment } from "../lib/investmentEngine";

it("does not create 1000 hidden annual rows before the user expands the details", () => {
  const outcome = calculateInvestment({ mode: "endAmount", startingAmount: 1000, contribution: 1, returnRate: 0, years: 1000, compoundFrequency: "annually", contributionFrequency: "yearly", contributionTiming: "end" });
  if (!outcome.ok) throw new Error(outcome.error.message);
  expect(outcome.result.annualBreakdown).toHaveLength(1000);
  const html = renderToStaticMarkup(<Results result={outcome.result} />);
  expect(html).toContain("查看年度明细");
  expect(html).toContain("<tbody></tbody>");
  expect(html).toContain("¥2,000.00");
});
