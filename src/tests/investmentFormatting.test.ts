import { describe, expect, it } from "vitest";
import {
  displayNumericInput,
  formatAmount,
  formatDuration,
  formatRate,
  formatYears,
  groupAmountInput,
  parseNumericInput,
} from "../lib/investmentFormatting";

describe("formatting and stable input", () => {
  it.each([
    [10000, "¥10,000.00"],
    [-10000, "-¥10,000.00"],
    [0, "¥0.00"],
    [-0, "¥0.00"],
    [0.004999, "¥0.00"],
    [-0.004999, "¥0.00"],
    [Number.MIN_VALUE, "¥0.00"],
    [-Number.MIN_VALUE, "¥0.00"],
    [0.005, "¥0.01"],
    [-0.005, "-¥0.01"],
  ])("formats signed amount %s as %s", (value, expected) => {
    expect(formatAmount(value as number)).toBe(expected);
  });
  it.each([
    [10, "约 10 年"],
    [10.42, "约 10 年 5 个月"],
    [0.42, "约 5 个月"],
    [1 / 12, "约 1 个月"],
    [0.08, "不足 1 个月"],
    [0.01, "不足 1 个月"],
    [0, "不足 1 个月"],
    [11.9999, "约 12 年"],
    [-1, "—"],
    [NaN, "—"],
    [Infinity, "—"],
  ])("formats duration %s as %s", (value, expected) => {
    expect(formatDuration(value as number)).toBe(expected);
  });
  it("formats money, rates and fractional duration only at display time", () => {
    expect(formatAmount(198290.396358)).toBe("¥198,290.40");
    expect(formatRate(0.06)).toBe("6.00%");
    expect(formatRate(0.07123456789)).toBe("7.1235%");
    expect(formatYears(12.416666666)).toBe("12.42");
    expect(formatDuration(12.416666666)).toBe("约 12 年 5 个月");
    expect(formatDuration(1.9999)).toBe("约 2 年");
  });
  it.each([
    "",
    " ",
    "NaN",
    "Infinity",
    "1e100",
    "12,34",
    "2元",
    "--1",
    "1.2.3",
  ])("rejects malformed input %s", (text) => {
    expect(parseNumericInput(text)).toBeUndefined();
  });
  it("supports paste, negative decimals and trailing decimal points", () => {
    expect(parseNumericInput(" 100,000.50 ")).toBe(100000.5);
    expect(parseNumericInput("-.5")).toBe(-0.5);
    expect(parseNumericInput("100.")).toBe(100);
    expect(groupAmountInput("100000.")).toBe("100,000.");
    expect(groupAmountInput("100000.00010")).toBe("100,000.00010");
  });
  it("never renders nonfinite numeric strings", () => {
    expect(formatAmount(NaN)).toBe("—");
    expect(formatRate(Infinity)).toBe("—");
  });
  it("displays inverse values without exposing floating-point tails", () => {
    expect(displayNumericInput("999.9999999999801", "contribution")).toBe(
      "1,000",
    );
    expect(displayNumericInput("6.000000000000274", "returnRate")).toBe("6");
    expect(displayNumericInput("198290.39635869532", "endAmount")).toBe(
      "198,290.4",
    );
  });
});
