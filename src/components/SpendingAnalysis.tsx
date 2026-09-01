import { useEffect, useState } from 'react';
import { makeAnalysisRange } from '../utils/analysisRange';
import type { AnalysisPreset, AnalysisRange, Transaction, TransactionsResponse } from '../types';

interface SpendingAnalysisProps {
  response: TransactionsResponse;
  previousResponse: TransactionsResponse;
  range: AnalysisRange;
  onRangeChange: (range: AnalysisRange) => void;
}

interface GroupRow {
  label: string;
  value: number;
  count: number;
}

interface CashFlowRow {
  label: string;
  expense: number;
  income: number;
}

const presetOptions: Array<{ value: AnalysisPreset; label: string }> = [
  { value: 'day', label: '今天' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: 'month', label: '本月' },
  { value: '3m', label: '最近 3 个月' },
  { value: 'year', label: '今年' },
  { value: '12m', label: '最近 12 个月' },
  { value: '3y', label: '最近 3 年' },
  { value: 'custom', label: '自定义日期' },
];

export function SpendingAnalysis({ response, previousResponse, range, onRangeChange }: SpendingAnalysisProps) {
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);
  const transactions = response.transactions;
  const expenses = transactions.filter((item) => item.type === 'expense');
  const incomes = transactions.filter((item) => item.type === 'income');
  const dayCount = daysBetween(range.from, range.to);
  const trendUnit = dayCount <= 62 ? 'day' : 'month';
  const trendRows = buildTrendRows(expenses, range, trendUnit);
  const cashFlowRows = buildCashFlowRows(transactions, range, trendUnit);
  const categoryRows = topGroups(expenses, (item) => item.category, 8);
  const detailRows = topGroups(expenses, (item) => `${item.category}${item.subcategory ? `/${item.subcategory}` : ''}`, 8);
  const paymentRows = topGroups(expenses, (item) => item.payment_method || '未标记', 6);
  const merchantRows = topGroups(expenses.filter((item) => item.merchant), (item) => item.merchant || '未识别', 6);
  const weekdayRows = buildWeekdayRows(expenses);
  const sizeRows = buildSizeRows(expenses);
  const maxDaily = Math.max(...trendRows.map((row) => row.value), 0);
  const activeDays = new Set(expenses.map((item) => item.transaction_date)).size;
  const averageSpend = activeDays > 0 ? response.total_expense / activeDays : 0;
  const balance = response.total_income - response.total_expense;
  const savingsRate = response.total_income > 0 ? (balance / response.total_income) * 100 : null;
  const largestExpense = expenses.reduce<Transaction | null>((current, item) => (!current || item.amount > current.amount ? item : current), null);
  const largestIncome = incomes.reduce<Transaction | null>((current, item) => (!current || item.amount > current.amount ? item : current), null);
  const topExpenses = [...expenses].sort((left, right) => right.amount - left.amount).slice(0, 5);
  const lowConfidence = transactions.filter((item) => typeof item.confidence === 'number' && item.confidence < 0.7).length;
  const missingConfidence = transactions.filter((item) => item.confidence === null).length;
  const uncategorized = transactions.filter((item) => item.category === '其它').length;
  const voiceCount = transactions.filter((item) => item.source === 'pwa_voice' || item.source === 'shortcuts').length;

  useEffect(() => {
    if (range.preset !== 'custom') {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  }, [range.from, range.preset, range.to]);

  function handlePresetChange(preset: AnalysisPreset) {
    if (preset === 'custom') {
      onRangeChange({ preset, from: customFrom, to: customTo, label: `${customFrom} 至 ${customTo}` });
      return;
    }
    onRangeChange(makeAnalysisRange(preset));
  }

  function applyCustomRange() {
    onRangeChange(makeAnalysisRange('custom', new Date(), customFrom, customTo));
  }

  return (
    <section className="analysis-board" aria-labelledby="analysis-title">
      <div className="section-heading analysis-heading">
        <div>
          <h2 id="analysis-title">支出分析</h2>
          <p>{range.from} 至 {range.to} · {transactions.length} 笔记录</p>
        </div>
        <div className="analysis-controls">
          <label>
            <span>复盘范围</span>
            <select value={range.preset} onChange={(event) => handlePresetChange(event.target.value as AnalysisPreset)}>
              {presetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {range.preset === 'custom' ? <div className="custom-range-controls">
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="复盘开始日期" />
            <span>至</span>
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} aria-label="复盘结束日期" />
            <button type="button" onClick={applyCustomRange}>应用</button>
          </div> : null}
        </div>
      </div>

      <div className="analysis-summary-grid">
        <SummaryStat label="支出笔数" value={`${expenses.length} 笔`} />
        <SummaryStat label="收入笔数" value={`${incomes.length} 笔`} />
        <SummaryStat label="活跃支出日" value={`${activeDays} / ${dayCount} 天`} />
        <SummaryStat label="储蓄率" value={savingsRate === null ? '无收入' : `${savingsRate.toFixed(1)}%`} tone={savingsRate !== null && savingsRate < 0 ? 'negative' : 'positive'} />
      </div>

      <div className="analysis-grid">
        <article className="chart-card chart-card-large">
          <div className="card-header">
            <div>
              <h3>{trendUnit === 'day' ? '每日支出走势' : '月度支出走势'}</h3>
              <p>{trendUnit === 'day' ? `峰值 ${maxDaily > 0 ? formatMoney(maxDaily) : '暂无'}，有支出日期 ${activeDays} 天。` : `按月汇总 ${trendRows.length} 个周期。`}</p>
            </div>
            <span className="metric-chip">日均 {formatMoney(averageSpend)}</span>
          </div>
          <TrendChart rows={trendRows} unit={trendUnit} />
        </article>

        <article className="chart-card chart-card-large">
          <CardTitle title="收支走势" description="同一时间尺度对比支出和收入。" />
          <CashFlowBars rows={cashFlowRows} />
        </article>

        <article className="chart-card">
          <CardTitle title="分类排行" description="按一级分类汇总支出。" />
          <RankBars rows={categoryRows} total={response.total_expense} emptyText="暂无支出分类" />
        </article>

        <article className="chart-card">
          <CardTitle title="分类明细" description="按二级分类定位消费去向。" />
          <RankBars rows={detailRows} total={response.total_expense} emptyText="暂无分类明细" />
        </article>

        <article className="chart-card">
          <CardTitle title="工作日分布" description="看哪几天更容易发生支出。" />
          <RankBars rows={weekdayRows} total={response.total_expense} emptyText="暂无工作日数据" />
        </article>

        <article className="chart-card">
          <CardTitle title="支付方式" description="识别不到支付方式时进入未标记。" />
          <PaymentSplit rows={paymentRows} total={response.total_expense} />
        </article>

        <article className="chart-card">
          <CardTitle title="单笔金额区间" description="看小额高频，还是大额偶发。" />
          <RankBars rows={sizeRows} total={expenses.length} valueMode="count" emptyText="暂无金额区间" />
        </article>

        <article className="chart-card">
          <CardTitle title="商户排行" description="只统计 AI 识别出商户的记录。" />
          <RankBars rows={merchantRows} total={response.total_expense} emptyText="暂无商户信息" />
        </article>

        <article className="chart-card insight-card">
          <CardTitle title="复核线索" description="集中查看可能需要手动确认的记录。" />
          <div className="checklist">
            <CheckItem label="低置信度" value={`${lowConfidence} 笔`} tone={lowConfidence > 0 ? 'warn' : 'ok'} />
            <CheckItem label="未返回置信度" value={`${missingConfidence} 笔`} tone={missingConfidence > 0 ? 'quiet' : 'ok'} />
            <CheckItem label="其它分类" value={`${uncategorized} 笔`} tone={uncategorized > 0 ? 'warn' : 'ok'} />
            <CheckItem label="语音来源" value={`${voiceCount} 笔`} tone="quiet" />
          </div>
        </article>

        <article className="chart-card insight-card">
          <CardTitle title="与上一周期" description="用相同长度的上一段时间作参考。" />
          <div className="comparison-list">
            <ChangeItem label="支出" current={response.total_expense} previous={previousResponse.total_expense} inverse />
            <ChangeItem label="收入" current={response.total_income} previous={previousResponse.total_income} />
            <ChangeItem label="支出笔数" current={expenses.length} previous={previousResponse.transactions.filter((item) => item.type === 'expense').length} count inverse />
          </div>
        </article>

        <article className="chart-card narrative-card">
          <CardTitle title="本期重点" description="优先检查金额最大或重复出现的记录。" />
          <div className="focus-grid">
            <dl className="fact-list">
              <div>
                <dt>结余</dt>
                <dd className={balance < 0 ? 'negative-text' : ''}>{formatMoney(balance)}</dd>
              </div>
              <div>
                <dt>最大支出</dt>
                <dd>{largestExpense ? `${largestExpense.description || largestExpense.category} · ${formatMoney(largestExpense.amount)}` : '暂无'}</dd>
              </div>
              <div>
                <dt>最大收入</dt>
                <dd>{largestIncome ? `${largestIncome.description || largestIncome.category} · ${formatMoney(largestIncome.amount)}` : '暂无'}</dd>
              </div>
              <div>
                <dt>主要分类</dt>
                <dd>{categoryRows[0] ? `${categoryRows[0].label} · ${formatMoney(categoryRows[0].value)}` : '暂无'}</dd>
              </div>
            </dl>
            <div className="large-expense-list">
              <span className="mini-label">TOP 支出</span>
              {topExpenses.length > 0 ? topExpenses.map((item) => (
                <div className="large-expense-row" key={item.id}>
                  <span>{item.description || item.merchant || item.category}</span>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
              )) : <span className="empty-state compact">暂无</span>}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function SummaryStat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'positive' | 'negative' }) {
  return <div className={`summary-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function CardTitle({ title, description }: { title: string; description: string }) {
  return <div className="card-header"><div><h3>{title}</h3><p>{description}</p></div></div>;
}

function TrendChart({ rows, unit }: { rows: GroupRow[]; unit: 'day' | 'month' }) {
  const width = 640;
  const height = 188;
  const pad = 22;
  const max = Math.max(...rows.map((row) => row.value), 0);
  const points = rows.map((row, index) => {
    const x = pad + (index / Math.max(rows.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (max > 0 ? row.value / max : 0) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return <div className="daily-chart" aria-label={unit === 'day' ? '每日支出趋势图' : '月度支出趋势图'}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" preserveAspectRatio="none">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="axis-line" />
      <line x1={pad} x2={pad} y1={pad} y2={height - pad} className="axis-line" />
      <polygon points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`} className="trend-area" />
      <polyline points={points} className="trend-line" />
      {rows.map((row, index) => {
        if (row.value <= 0) return null;
        const x = pad + (index / Math.max(rows.length - 1, 1)) * (width - pad * 2);
        const y = height - pad - (max > 0 ? row.value / max : 0) * (height - pad * 2);
        return <circle key={row.label} cx={x} cy={y} r="3" className="trend-dot" />;
      })}
    </svg>
    <div className="chart-axis-labels"><span>{rows[0]?.label ?? ''}</span><span>{rows[rows.length - 1]?.label ?? ''}</span></div>
  </div>;
}

function CashFlowBars({ rows }: { rows: CashFlowRow[] }) {
  const max = Math.max(...rows.flatMap((row) => [row.expense, row.income]), 1);
  if (rows.length === 0 || max === 1 && rows.every((row) => row.expense === 0 && row.income === 0)) return <div className="empty-state compact">暂无收支数据</div>;
  return <div className="cash-flow-list">
    <div className="cash-flow-legend"><span><i className="flow-expense" />支出</span><span><i className="flow-income" />收入</span></div>
    {rows.map((row) => <div className="cash-flow-row" key={row.label}>
      <span>{row.label}</span>
      <div className="flow-bars"><b className="flow-expense" style={{ width: `${Math.max((row.expense / max) * 100, row.expense > 0 ? 3 : 0)}%` }} /><b className="flow-income" style={{ width: `${Math.max((row.income / max) * 100, row.income > 0 ? 3 : 0)}%` }} /></div>
    </div>)}
  </div>;
}

function RankBars({ rows, total, emptyText, valueMode = 'money' }: { rows: GroupRow[]; total: number; emptyText: string; valueMode?: 'money' | 'count' }) {
  if (rows.length === 0 || rows.every((row) => row.value === 0)) return <div className="empty-state compact">{emptyText}</div>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="rank-list">{rows.map((row) => {
    const percent = total > 0 ? (row.value / total) * 100 : 0;
    return <div className="rank-row" key={row.label}>
      <div className="rank-meta"><span>{row.label}</span><strong>{valueMode === 'count' ? `${row.value} 笔` : formatMoney(row.value)}</strong></div>
      <div className="rank-track" aria-hidden="true"><span style={{ width: `${Math.max((row.value / max) * 100, 3)}%` }} /></div>
      <small>{valueMode === 'count' ? `${percent.toFixed(1)}% 的记录` : `${row.count} 笔 · ${percent.toFixed(1)}%`}</small>
    </div>;
  })}</div>;
}

function PaymentSplit({ rows, total }: { rows: GroupRow[]; total: number }) {
  if (rows.length === 0) return <div className="empty-state compact">暂无支付方式</div>;
  return <div className="payment-block">
    <div className="split-bar" aria-hidden="true">{rows.map((row, index) => <span className={`split-tone-${index % 4}`} key={row.label} style={{ width: `${Math.max((row.value / total) * 100, 4)}%` }} />)}</div>
    <div className="legend-list">{rows.map((row, index) => <div key={row.label}><i className={`split-tone-${index % 4}`} /><span>{row.label}</span><strong>{formatMoney(row.value)}</strong></div>)}</div>
  </div>;
}

function CheckItem({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'quiet' }) {
  return <div className={`check-item ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ChangeItem({ label, current, previous, count = false, inverse = false }: { label: string; current: number; previous: number; count?: boolean; inverse?: boolean }) {
  const change = previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
  const unfavorable = change !== null && (inverse ? change > 0 : change < 0);
  return <div className="change-item"><span>{label}</span><strong>{count ? `${current} 笔` : formatMoney(current)}</strong><small className={unfavorable ? 'negative-text' : 'positive-text'}>{change === null ? '上一周期无记录' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</small></div>;
}

function topGroups(items: Transaction[], getLabel: (item: Transaction) => string, limit: number): GroupRow[] {
  const groups = new Map<string, GroupRow>();
  for (const item of items) {
    const label = getLabel(item);
    const current = groups.get(label) ?? { label, value: 0, count: 0 };
    current.value += item.amount;
    current.count += 1;
    groups.set(label, current);
  }
  return Array.from(groups.values()).sort((left, right) => right.value - left.value).slice(0, limit);
}

function buildTrendRows(items: Transaction[], range: AnalysisRange, unit: 'day' | 'month'): GroupRow[] {
  const keys = buildPeriodKeys(range, unit);
  const rows = keys.map((label) => ({ label, value: 0, count: 0 }));
  const indexes = new Map(keys.map((key, index) => [key, index]));
  for (const item of items) {
    const key = unit === 'day' ? item.transaction_date : item.transaction_date.slice(0, 7);
    const row = rows[indexes.get(key) ?? -1];
    if (row) {
      row.value += item.amount;
      row.count += 1;
    }
  }
  return rows;
}

function buildCashFlowRows(items: Transaction[], range: AnalysisRange, unit: 'day' | 'month'): CashFlowRow[] {
  const keys = buildPeriodKeys(range, unit);
  const rows = keys.map((label) => ({ label, expense: 0, income: 0 }));
  const indexes = new Map(keys.map((key, index) => [key, index]));
  for (const item of items) {
    const key = unit === 'day' ? item.transaction_date : item.transaction_date.slice(0, 7);
    const row = rows[indexes.get(key) ?? -1];
    if (!row) continue;
    if (item.type === 'income') row.income += item.amount;
    else row.expense += item.amount;
  }
  return rows;
}

function buildPeriodKeys(range: AnalysisRange, unit: 'day' | 'month'): string[] {
  const from = parseDate(range.from);
  const to = parseDate(range.to);
  if (!from || !to || from > to) return [];
  const keys: string[] = [];
  if (unit === 'month') {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }
  const cursor = new Date(from);
  while (cursor <= to) {
    keys.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function buildWeekdayRows(items: Transaction[]): GroupRow[] {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const rows = labels.map((label) => ({ label, value: 0, count: 0 }));
  for (const item of items) {
    const date = parseDate(item.transaction_date);
    if (!date) continue;
    const weekday = (date.getDay() + 6) % 7;
    rows[weekday].value += item.amount;
    rows[weekday].count += 1;
  }
  return rows;
}

function buildSizeRows(items: Transaction[]): GroupRow[] {
  const rows = [
    { label: '0–30 元', value: 0, count: 0 },
    { label: '30–100 元', value: 0, count: 0 },
    { label: '100–500 元', value: 0, count: 0 },
    { label: '500 元以上', value: 0, count: 0 },
  ];
  for (const item of items) {
    const index = item.amount < 30 ? 0 : item.amount < 100 ? 1 : item.amount < 500 ? 2 : 3;
    rows[index].value += 1;
    rows[index].count += 1;
  }
  return rows;
}

function daysBetween(fromText: string, toText: string): number {
  const from = parseDate(fromText);
  const to = parseDate(toText);
  if (!from || !to) return 0;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}
