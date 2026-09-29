import { useId, useState } from "react";
import type { GrowthPoint } from "../lib/investmentTypes";
import {
  formatAmount,
  formatAxisAmount,
  formatYears,
} from "../lib/investmentFormatting";

export function GrowthChart({ data, withdrawals = false }: { data: GrowthPoint[]; withdrawals?: boolean }) {
  const [selected, setSelected] = useState(data.length - 1);
  const titleId = useId();
  const width = 600;
  const height = 258;
  const left = 64;
  const right = 12;
  const top = 20;
  const bottom = 38;
  const maxYear = data[data.length - 1].year;
  const maxAmount =
    data.reduce((max, point) => Math.max(max, point.assets, point.invested), 1) *
    1.08;
  const minAmount = data.reduce((min, point) => Math.min(min, point.assets, point.invested), 0) * 1.08;
  const investedLabel = withdrawals ? "累计净投入" : "累计投入本金";
  const tickAmount = (tick: number) => minAmount + (maxAmount - minAmount) * tick;
  const x = (year: number) => left + (year / maxYear) * (width - left - right);
  const y = (amount: number) =>
    height - bottom - ((amount - minAmount) / (maxAmount - minAmount)) * (height - top - bottom);
  const path = (key: "assets" | "invested") =>
    data
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(point.year)},${y(point[key])}`,
      )
      .join(" ");
  const active = data[Math.min(selected, data.length - 1)];
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <section className="growth-section" aria-labelledby={titleId}>
      <div className="section-heading">
        <h3 id={titleId}>资产增长</h3>
        <span className="chart-unit">单位：元</span>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-assets" />
          总资产
        </span>
        <span>
          <i className="legend-invested" />
          {investedLabel}
        </span>
      </div>
      <svg
        className="growth-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`资产增长曲线，展示总资产与${investedLabel}。可用下方滑块查看各年金额。`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tickAmount(tick))}
              y2={y(tickAmount(tick))}
              className="grid-line"
            />
            <text x={left - 10} y={y(tickAmount(tick)) + 4} textAnchor="end">
              {formatAxisAmount(tickAmount(tick))}
            </text>
            <text
              x={x(maxYear * tick)}
              y={height - 13}
              textAnchor={tick === 1 ? "end" : tick === 0 ? "start" : "middle"}
            >
              {formatYears(maxYear * tick)} 年
            </text>
          </g>
        ))}
        <path
          d={`${path("assets")} L${x(maxYear)},${y(0)} L${x(0)},${y(0)} Z`}
          className="asset-area"
        />
        <path d={path("invested")} className="invested-line" />
        <path d={path("assets")} className="asset-line" />
        <line
          x1={x(active.year)}
          x2={x(active.year)}
          y1={top}
          y2={height - bottom}
          className="cursor-line"
        />
        <circle
          cx={x(active.year)}
          cy={y(active.assets)}
          r="4.5"
          className="asset-dot"
        />
      </svg>
      <label className="chart-slider-label" htmlFor={`${titleId}-slider`}>
        第 {formatYears(active.year)} 年 <span>滑动查看年度金额</span>
      </label>
      <input
        id={`${titleId}-slider`}
        className="chart-slider"
        type="range"
        min="0"
        max={data.length - 1}
        step="1"
        value={Math.min(selected, data.length - 1)}
        onChange={(event) => setSelected(Number(event.target.value))}
        aria-valuetext={`第 ${formatYears(active.year)} 年，总资产 ${formatAmount(active.assets)}，${investedLabel} ${formatAmount(active.invested)}`}
      />
      <div className="chart-readout">
        <span>
          总资产<strong>{formatAmount(active.assets)}</strong>
        </span>
        <span>
          {investedLabel}<strong>{formatAmount(active.invested)}</strong>
        </span>
      </div>
    </section>
  );
}
