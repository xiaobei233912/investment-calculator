/** Currency is a presentation concern; the engine never imports this module. */
const amountFormat = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rateFormat = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const yearFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
export const formatAmount = (value: number): string =>
  Number.isFinite(value) ? `¥${amountFormat.format(value)}` : "—";
export const formatRate = (value: number): string =>
  Number.isFinite(value) ? `${rateFormat.format(value * 100)}%` : "—";
export const formatYears = (value: number): string =>
  Number.isFinite(value) ? yearFormat.format(value) : "—";
export function formatDuration(years: number): string {
  if (!Number.isFinite(years) || years < 0) return "—";
  const months = Math.round(years * 12);
  if (months === 0 && years > 0) return "不足 1 个月";
  return `约 ${Math.floor(months / 12)} 年 ${months % 12} 个月`;
}
export function parseNumericInput(raw: string): number | undefined {
  const text = raw.trim();
  // Accept plain decimals and correctly grouped pasted amounts. Reject partial parses.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/.test(text))
    return undefined;
  const value = Number(text.replaceAll(",", ""));
  return Number.isFinite(value) ? value : undefined;
}
/** Format only on blur; preserve trailing decimals and all typed fractional digits. */
export function groupAmountInput(raw: string): string {
  if (parseNumericInput(raw) === undefined) return raw;
  const [whole, decimal] = raw.trim().replaceAll(",", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? grouped : `${grouped}.${decimal}`;
}
/** A friendly unfocused display without replacing the full-precision backing string. */
export function displayNumericInput(
  raw: string,
  field:
    | "startingAmount"
    | "endAmount"
    | "contribution"
    | "returnRate"
    | "years",
): string {
  const value = parseNumericInput(raw);
  if (value === undefined) return raw;
  return new Intl.NumberFormat("zh-CN", {
    useGrouping: field !== "returnRate" && field !== "years",
    maximumFractionDigits: field === "returnRate" ? 4 : 2,
  }).format(value);
}
export function formatAxisAmount(amount: number): string {
  if (amount >= 1e12) return `${formatYears(amount / 1e12)}万亿`;
  if (amount >= 1e8) return `${formatYears(amount / 1e8)}亿`;
  if (amount >= 1e4) return `${formatYears(amount / 1e4)}万`;
  return formatYears(amount);
}
