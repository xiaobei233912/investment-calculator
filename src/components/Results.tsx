import { useState } from "react";
import type { InvestmentResult } from "../lib/investmentTypes";
import {
  formatAmount,
  formatDuration,
  formatRate,
  formatYears,
} from "../lib/investmentFormatting";
import { GrowthChart } from "./GrowthChart";

export function Results({ result }: { result: InvestmentResult }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const rows = detailsOpen ? result.annualBreakdown.slice(page * pageSize, (page + 1) * pageSize) : [];
  const { parameters: p, mode } = result;
  const withdrawals = p.contribution < 0;
  const titles = {
    endAmount: "期末金额",
    contribution: `所需每${p.contributionFrequency === "monthly" ? "月" : "年"}追加投入`,
    returnRate: "所需年化收益率",
    startingAmount: "所需初始本金",
    years: "所需投资期限",
  };
  const headline =
    mode === "returnRate"
      ? formatRate(result.solvedValue)
      : mode === "years"
        ? `${formatYears(result.solvedValue)} 年`
        : formatAmount(result.solvedValue);
  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="section-heading">
        <h2 id="results-heading">计算结果</h2>
        <span className="result-status">
          <span />
          已计算
        </span>
      </div>
      <div className="headline-result">
        <p>{titles[mode]}</p>
        <strong className="headline-value">{headline}</strong>
        <span>
          {mode === "years"
            ? formatDuration(result.solvedValue)
            : `${formatYears(p.years)} 年投资期限 · ${formatRate(p.returnRate)} 年化收益率`}
        </span>
      </div>
      {withdrawals && <p className="withdrawal-note">负追加投入表示定期提取。累计净投入 = 初始本金 − 累计提取，可为负数；不代表资产欠款。</p>}
      <dl className="result-summary">
        {mode !== "endAmount" && (
          <div>
            <dt>期末金额</dt>
            <dd>{formatAmount(result.endAmount)}</dd>
          </div>
        )}
        <div>
          <dt>初始本金</dt>
          <dd>{formatAmount(p.startingAmount)}</dd>
        </div>
        <div>
          <dt>{withdrawals ? "累计提取金额" : "累计追加投入"}</dt>
          <dd>{formatAmount(withdrawals ? -result.totalContributions : result.totalContributions)}</dd>
        </div>
        <div>
          <dt>累计投资收益</dt>
          <dd className={result.totalInterest >= 0 ? "positive" : "negative"}>
            {formatAmount(result.totalInterest)}
          </dd>
        </div>
      </dl>
      <GrowthChart data={result.chartData} withdrawals={withdrawals} />
      <details className="annual-details" onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>
          查看年度明细
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="年度明细，可横向滚动"
        >
          <table>
            <caption>
              {withdrawals ? "当年净投入为负数表示提取；初始本金单独列示。末行含不足一年的部分。" : "当年投入仅含追加投入；初始本金单独列示。末行含不足一年的部分。"}
            </caption>
            <thead>
              <tr>
                <th scope="col">年份</th>
                <th scope="col">{withdrawals ? "当年净投入" : "当年投入"}</th>
                <th scope="col">当年收益</th>
                <th scope="col">年末资产</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">
                    第 {page * pageSize + index + 1} 年
                    {row.duration < 1 - 1e-9 && (
                      <small>截至 {formatYears(row.year)} 年</small>
                    )}
                  </th>
                  <td>{formatAmount(row.contribution)}</td>
                  <td>{formatAmount(row.interest)}</td>
                  <td>{formatAmount(row.endAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detailsOpen && result.annualBreakdown.length > pageSize && <div className="annual-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
          <span aria-live="polite">第 {page + 1} / {Math.ceil(result.annualBreakdown.length / pageSize)} 页</span>
          <button type="button" disabled={(page + 1) * pageSize >= result.annualBreakdown.length} onClick={() => setPage(page + 1)}>下一页</button>
        </div>}
      </details>
    </section>
  );
}
