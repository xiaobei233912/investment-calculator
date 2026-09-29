import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import App from "../App";

it("shows default inputs and guidance, without precomputed results on first entry", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("填写参数并点击「开始计算」查看结果。");
  expect(html).toContain('value="20,000"');
  expect(html).toContain('value="1,000"');
  expect(html).toContain('value="6"');
  expect(html).toContain('value="10"');
  expect(html).not.toContain('class="results"');
  expect(html).not.toContain("¥198,290.40");
  expect(html).not.toContain("计算完成");
  const ids = [...html.matchAll(/(?:input|select) id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids).toEqual(["startingAmount", "endAmount", "returnRate", "years", "contributionFrequency", "contribution", "compoundFrequency", "contributionTiming"]);
  expect(html).toMatch(/id="endAmount"[^>]*disabled=""[^>]*value="待计算"/);
  expect(html).toContain('<details class="advanced-options">');
});
