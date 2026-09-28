import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { calculateInvestment } from "./lib/investmentEngine";
import {
  displayNumericInput,
  groupAmountInput,
  parseNumericInput,
} from "./lib/investmentFormatting";
import type {
  CalculationError,
  CalculationMode,
  CompoundFrequency,
  ContributionFrequency,
  ContributionTiming,
  InvestmentInput,
  InvestmentResult,
} from "./lib/investmentTypes";
import { Results } from "./components/Results";

const modes: { value: CalculationMode; label: string }[] = [
  { value: "endAmount", label: "算期末金额" },
  { value: "contribution", label: "算追加投入" },
  { value: "returnRate", label: "算收益率" },
  { value: "startingAmount", label: "算初始本金" },
  { value: "years", label: "算投资期限" },
];
const defaults: InvestmentInput = {
  mode: "endAmount",
  startingAmount: 20000,
  contribution: 1000,
  returnRate: 0.06,
  years: 10,
  compoundFrequency: "annually",
  contributionFrequency: "monthly",
  contributionTiming: "end",
};
const initial = calculateInvestment(defaults);

export default function App() {
  const [mode, setMode] = useState<CalculationMode>("endAmount");
  const [values, setValues] = useState<Record<CalculationMode, string>>({
    startingAmount: "20,000",
    endAmount: String(initial.ok ? initial.result.endAmount : 198290.396358),
    contribution: "1,000",
    returnRate: "6",
    years: "10",
  });
  const [compoundFrequency, setCompoundFrequency] =
    useState<CompoundFrequency>("annually");
  const [contributionFrequency, setContributionFrequency] =
    useState<ContributionFrequency>("monthly");
  const [contributionTiming, setContributionTiming] =
    useState<ContributionTiming>("end");
  const [result, setResult] = useState<InvestmentResult | null>(
    initial.ok ? initial.result : null,
  );
  const [error, setError] = useState<CalculationError | null>(null);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [focusedField, setFocusedField] = useState<CalculationMode | null>(
    null,
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function markDirty() {
    setDirty(true);
    setResult(null);
    setError(null);
  }
  function changeMode(next: CalculationMode) {
    setMode(next);
    markDirty();
  }
  function handleTabKey(event: KeyboardEvent, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % modes.length
        : event.key === "ArrowLeft"
          ? (index + modes.length - 1) % modes.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? modes.length - 1
              : undefined;
    if (next !== undefined) {
      event.preventDefault();
      changeMode(modes[next].value);
      tabRefs.current[next]?.focus();
    }
  }
  const fields: {
    name: CalculationMode;
    label: string;
    unit: string;
    money?: boolean;
  }[] = [
    { name: "startingAmount", label: "初始本金", unit: "元", money: true },
    { name: "endAmount", label: "目标期末金额", unit: "元", money: true },
    {
      name: "contribution",
      label: `每${contributionFrequency === "monthly" ? "月" : "年"}追加投入`,
      unit: "元",
      money: true,
    },
    { name: "returnRate", label: "年化收益率", unit: "%" },
    { name: "years", label: "投资期限", unit: "年" },
  ];

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed: Partial<Record<CalculationMode, number>> = {};
    for (const field of fields.filter((field) => field.name !== mode)) {
      const value = parseNumericInput(values[field.name]);
      if (value === undefined) {
        setError({
          code: "INVALID_INPUT",
          field: field.name,
          message: `请填写有效的${field.label}。`,
        });
        document.getElementById(field.name)?.focus();
        return;
      }
      parsed[field.name] = field.name === "returnRate" ? value / 100 : value;
    }
    const input = {
      ...parsed,
      mode,
      compoundFrequency,
      contributionFrequency,
      contributionTiming,
    } as InvestmentInput;
    const outcome = calculateInvestment(input);
    if (outcome.ok) {
      setResult(outcome.result);
      setError(null);
      setDirty(false);
      setRevision((value) => value + 1);
      // Preserve the unrounded solved value for subsequent mode changes and round trips.
      setValues((current) => ({
        ...current,
        [mode]: String(
          outcome.result.solvedValue * (mode === "returnRate" ? 100 : 1),
        ),
      }));
    } else {
      setResult(null);
      setError(outcome.error);
      if (outcome.error.field)
        document.getElementById(outcome.error.field)?.focus();
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <h1>投资计算器</h1>
        <p>计算复利投资中的期末金额、定投金额、收益率、初始本金或投资期限。</p>
      </header>
      <div className="calculator">
        <div className="mode-tabs" role="tablist" aria-label="选择求解变量">
          {modes.map((item, index) => (
            <button
              key={item.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${item.value}`}
              aria-selected={mode === item.value}
              aria-controls="calculator-panel"
              tabIndex={mode === item.value ? 0 : -1}
              className={mode === item.value ? "mode-tab active" : "mode-tab"}
              onClick={() => changeMode(item.value)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="calculator-panel"
          aria-labelledby={`tab-${mode}`}
        >
          <form noValidate onSubmit={submit}>
            <div className="form-heading">
              <h2>投资参数</h2>
              <span>填写已知条件</span>
            </div>
            <div className="input-grid">
              {fields
                .filter((field) => field.name !== mode)
                .map((field) => (
                  <div className="field" key={field.name}>
                    <label htmlFor={field.name}>{field.label}</label>
                    <div
                      className={`input-wrap ${error?.field === field.name ? "invalid" : ""}`}
                    >
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        value={
                          focusedField === field.name
                            ? values[field.name]
                            : displayNumericInput(
                                values[field.name],
                                field.name,
                              )
                        }
                        placeholder="请输入"
                        aria-invalid={error?.field === field.name}
                        aria-describedby={
                          error?.field === field.name
                            ? "calculation-error"
                            : undefined
                        }
                        onFocus={() => {
                          setFocusedField(field.name);
                          if (field.money)
                            setValues((current) => ({
                              ...current,
                              [field.name]: current[field.name].replaceAll(
                                ",",
                                "",
                              ),
                            }));
                        }}
                        onBlur={() => {
                          setFocusedField(null);
                          if (field.money)
                            setValues((current) => ({
                              ...current,
                              [field.name]: groupAmountInput(
                                current[field.name],
                              ),
                            }));
                        }}
                        onChange={(event) => {
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }));
                          markDirty();
                        }}
                      />
                      <span>{field.unit}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="settings-grid">
              <div className="field">
                <label htmlFor="compoundFrequency">复利频率</label>
                <select
                  id="compoundFrequency"
                  value={compoundFrequency}
                  onChange={(event) => {
                    setCompoundFrequency(
                      event.target.value as CompoundFrequency,
                    );
                    markDirty();
                  }}
                >
                  <option value="annually">每年</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="contributionFrequency">追加投入频率</label>
                <select
                  id="contributionFrequency"
                  value={contributionFrequency}
                  onChange={(event) => {
                    setContributionFrequency(
                      event.target.value as ContributionFrequency,
                    );
                    markDirty();
                  }}
                >
                  <option value="monthly">每月追加</option>
                  <option value="yearly">每年追加</option>
                </select>
              </div>
              <div className="field timing-field">
                <label htmlFor="contributionTiming">追加投入时点</label>
                <select
                  id="contributionTiming"
                  value={contributionTiming}
                  onChange={(event) => {
                    setContributionTiming(
                      event.target.value as ContributionTiming,
                    );
                    markDirty();
                  }}
                >
                  <option value="end">每期期末</option>
                  <option value="beginning">每期期初</option>
                </select>
              </div>
            </div>
            <p className="input-note">
              {compoundFrequency === "annually"
                ? "按年复利"
                : "按月复利，月利率 = 年化收益率 ÷ 12"}{" "}
              · {contributionFrequency === "monthly" ? "每月" : "每年"}
              {contributionTiming === "end" ? "期末" : "期初"}投入
            </p>
            {error && (
              <p role="alert" id="calculation-error" className="error-message">
                {error.message}
              </p>
            )}
            <button className="calculate-button" type="submit">
              开始计算
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {result
            ? `计算完成，${modes.find((item) => item.value === mode)?.label}结果已更新。`
            : dirty
              ? "参数已更新，请点击开始计算。"
              : ""}
        </div>
        {result ? (
          <Results key={revision} result={result} />
        ) : (
          !error && (
            <p className="empty-result">
              参数已更新，点击「开始计算」查看结果。
            </p>
          )
        )}
      </div>
    </main>
  );
}
