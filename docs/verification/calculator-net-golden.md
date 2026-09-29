# Calculator.net 外部 Golden 参考

核对日期：2026-09-28。来源：[Calculator.net Investment Calculator](https://www.calculator.net/investment-calculator.html)。

通过参考站实际表单参数发起 HTTP GET，读取服务端返回的结果表和反解结果句。以下数值直接记录自外部结果，不通过本地引擎、其他反解函数或 Round-trip 生成。未保存或复制参考站 HTML、CSS、JavaScript 或视觉资产。

所有案例初始本金 20,000、每期追加 1,000。参考站以美元展示；本引擎与币种无关，测试只比较 number。

| 案例 | 名义年化率 | 年数 | 复利 | 追加频率 | 时点 | 外部显示结果 | 绝对容差 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 原基准 | 6% | 10 | 每年 | 每月 | 期末 | End Balance $198,290.40 | 0.005 |
| 每月复利 | 6% | 10 | 每月 | 每月 | 期末 | End Balance $200,267.28 | 0.005 |
| 每年追加 | 6% | 10 | 每年 | 每年 | 期末 | End Balance $48,997.75 | 0.005 |
| 期初追加 | 6% | 10 | 每年 | 每月 | 期初 | End Balance $199,081.24 | 0.005 |
| 期限反解，目标 200,000 | 6% | 未知 | 每年 | 每月 | 期末 | 10.073 years | 0.0005 年 |
| 收益率反解，目标 200,000 | 未知 | 10 | 每年 | 每月 | 期末 | 6.145% | 0.000005（小数利率） |

容差采用外部显示末位的半个单位：金额到分，期限到 0.001 年，收益率到 0.001 个百分点。外部未提供更多可靠尾数，因此不伪造全精度 Golden Value，也不对本地引擎的中间值舍入。测试离线执行，不依赖参考站在线可用性。

## 可复核链接

- [原基准](https://www.calculator.net/investment-calculator.html?ctype=endamount&ctargetamountv=1000000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=annually&ccontributeamountv=1000&cadditionat1=end&ciadditionat1=monthly&printit=0&x=Calculate)
- [每月复利](https://www.calculator.net/investment-calculator.html?ctype=endamount&ctargetamountv=1000000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=monthly&ccontributeamountv=1000&cadditionat1=end&ciadditionat1=monthly&printit=0&x=Calculate)
- [每年追加](https://www.calculator.net/investment-calculator.html?ctype=endamount&ctargetamountv=1000000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=annually&ccontributeamountv=1000&cadditionat1=end&ciadditionat1=annually&printit=0&x=Calculate)
- [期初追加](https://www.calculator.net/investment-calculator.html?ctype=endamount&ctargetamountv=1000000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=annually&ccontributeamountv=1000&cadditionat1=beginning&ciadditionat1=monthly&printit=0&x=Calculate)
- [投资期限反解](https://www.calculator.net/investment-calculator.html?ctype=investlength&ctargetamountv=200000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=annually&ccontributeamountv=1000&cadditionat1=end&ciadditionat1=monthly&printit=0&x=Calculate)
- [收益率反解](https://www.calculator.net/investment-calculator.html?ctype=returnrate&ctargetamountv=200000&cstartingprinciplev=20000&cyearsv=10&cinterestratev=6&ccompound=annually&ccontributeamountv=1000&cadditionat1=end&ciadditionat1=monthly&printit=0&x=Calculate)

六个案例均已取得外部显示值，无待填 TODO。后续若更换参数，应重新从参考站核对，不能用本地输出回填预期值。
