import type {
  CalculationError,
  InvestmentInput,
  InvestmentParameters,
} from "./investmentTypes";

export const LIMITS = {
  amount: 1e15,
  years: 1000,
  maxReturnRate: 100,
  minReturnRate: -1,
} as const;
export const numericFields = [
  "startingAmount",
  "endAmount",
  "contribution",
  "returnRate",
  "years",
] as const;
const names = {
  startingAmount: "初始本金",
  endAmount: "目标期末金额",
  contribution: "追加投入",
  returnRate: "年化收益率",
  years: "投资期限",
};

export function validateInput(
  input: InvestmentInput,
): CalculationError | undefined {
  if (
    !input ||
    typeof input !== "object" ||
    !numericFields.includes(input.mode)
  ) {
    return { code: "INVALID_INPUT", message: "请选择有效的计算模式。" };
  }
  const choices = {
    compoundFrequency: ["annually", "monthly"],
    contributionFrequency: ["monthly", "yearly"],
    contributionTiming: ["beginning", "end"],
  } as const;
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if (!(choices[key] as readonly string[]).includes(input[key])) {
      return {
        code: "INVALID_INPUT",
        message: "请选择有效的复利频率、投入频率和投入时点。",
        field: key,
      };
    }
  }
  const values = input as Partial<InvestmentParameters>;
  for (const field of numericFields) {
    if (field === input.mode) continue;
    const value = values[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return {
        code: "INVALID_INPUT",
        message: `请填写有效的${names[field]}。`,
        field,
      };
    }
    if (field === "returnRate") {
      if (value <= LIMITS.minReturnRate || value > LIMITS.maxReturnRate) {
        return {
          code: "OUT_OF_RANGE",
          message: "年化收益率必须大于 -100%，且不超过 10,000%。",
          field,
        };
      }
    } else if (field === "years") {
      if (value <= 0 || value > LIMITS.years) {
        return {
          code: "OUT_OF_RANGE",
          message: "投资期限必须大于 0 年，且不超过 1,000 年。",
          field,
        };
      }
    } else if (value < 0 || value > LIMITS.amount) {
      return {
        code: "OUT_OF_RANGE",
        message: `${names[field]}需为 0 或正数，且不超过 1,000 万亿元。`,
        field,
      };
    }
  }
}
