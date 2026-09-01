import type { Transaction, TransactionsResponse } from '../types';

interface SpendingAnalysisProps {
  response: TransactionsResponse;
  month: string;
}

interface GroupRow {
  label: string;
  value: number;
  count: number;
}

export function SpendingAnalysis({ response, month }: SpendingAnalysisProps) {
  const transactions = response.transactions;
  const expenses = transactions.filter((item) => item.type === 'expense');
  const incomes = transactions.filter((item) => item.type === 'income');
  const categoryRows = topGroups(expenses, (item) => `${item.category}${item.subcategory ? `/${item.subcategory}` : ''}`, 6);
  const paymentRows = topGroups(expenses, (item) => item.payment_method || '未标记', 5);
  const merchantRows = topGroups(expenses.filter((item) => item.merchant), (item) => item.merchant || '未识别', 5);
  const dailyRows = buildDailyRows(expenses, month);
  const weekdayRows = buildWeekdayRows(expenses);
  const sizeRows = buildSizeRows(expenses);
  const maxDaily = Math.max(...dailyRows.map((row) => row.value), 0);
  const activeDays = dailyRows.filter((row) => row.value > 0).length;
  const averageSpend = activeDays > 0 ? response.total_expense / activeDays : 0;
  const largestExpense = expenses.reduce<Transaction | null>((current, item) => (!current || item.amount > current.amount ? item : current), null);
  const largestIncome = incomes.reduce<Transaction | null>((current, item) => (!current || item.amount > current.amount ? item : current), null);
  const topExpenses = [...expenses].sort((left, right) => right.amount - left.amount).slice(0, 5);
  const lowConfidence = transactions.filter((item) => typeof item.confidence === 'number' && item.confidence < 0.7).length;
  const missingConfidence = transactions.filter((item) => item.confidence === null).length;
  const uncategorized = transactions.filter((item) => item.category === '其它').length;
  const voiceCount = transactions.filter((item) => item.source === 'pwa_voice' || item.source === 'shortcuts').length;

  return (
    <section className="analysis-board" aria-labelledby="analysis-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Monthly workbench</p>
          <h2 id="analysis-title">账单复盘</h2>
        </div>
        <p>按 {month} 已加载账单即时计算，数字只来自实际入库记录。</p>
      </div>

      <div className="analysis-grid">
        <article className="chart-card chart-card-large">
          <div className="card-header">
            <div>
              <h3>每日支出走势</h3>
              <p>峰值 {maxDaily > 0 ? formatMoney(maxDaily) : '暂无'}，有支出日期 {activeDays} 天。</p>
            </div>
            <span className="metric-chip">日均 {formatMoney(averageSpend)}</span>
          </div>
          <DailyTrend rows={dailyRows} />
        </article>

        <article className="chart-card">
          <CardTitle title="分类排行" description="按支出金额排序。" />
          <RankBars rows={categoryRows} total={response.total_expense} emptyText="暂无支出分类" />
        </article>

        <article className="chart-card">
          <CardTitle title="工作日分布" description="按交易日期统计支出。" />
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
          <CardTitle title="复核线索" description="用于发现 AI 解析可能不稳的记录。" />
          <div className="checklist">
            <CheckItem label="低置信度" value={`${lowConfidence} 笔`} tone={lowConfidence > 0 ? 'warn' : 'ok'} />
            <CheckItem label="未返回置信度" value={`${missingConfidence} 笔`} tone={missingConfidence > 0 ? 'quiet' : 'ok'} />
            <CheckItem label="其它分类" value={`${uncategorized} 笔`} tone={uncategorized > 0 ? 'warn' : 'ok'} />
            <CheckItem label="语音来源" value={`${voiceCount} 笔`} tone="quiet" />
          </div>
        </article>

        <article className="chart-card narrative-card">
          <CardTitle title="本月重点" description="金额最大的记录优先检查。" />
          <div className="focus-grid">
            <dl className="fact-list">
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

function CardTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="card-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function DailyTrend({ rows }: { rows: GroupRow[] }) {
  const width = 640;
  const height = 188;
  const pad = 22;
  const max = Math.max(...rows.map((row) => row.value), 0);
  const points = rows
    .map((row, index) => {
      const x = pad + (index / Math.max(rows.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - (max > 0 ? row.value / max : 0) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="daily-chart" aria-label="每日支出趋势图">
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
      <div className="chart-axis-labels">
        <span>1日</span>
        <span>{rows.length}日</span>
      </div>
    </div>
  );
}

function RankBars({ rows, total, emptyText, valueMode = 'money' }: { rows: GroupRow[]; total: number; emptyText: string; valueMode?: 'money' | 'count' }) {
  if (rows.length === 0 || rows.every((row) => row.value === 0)) {
    return <div className="empty-state compact">{emptyText}</div>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rank-list">
      {rows.map((row) => {
        const percent = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <div className="rank-row" key={row.label}>
            <div className="rank-meta">
              <span>{row.label}</span>
              <strong>{valueMode === 'count' ? `${row.value} 笔` : formatMoney(row.value)}</strong>
            </div>
            <div className="rank-track" aria-hidden="true">
              <span style={{ width: `${Math.max((row.value / max) * 100, 3)}%` }} />
            </div>
            <small>{valueMode === 'count' ? `${percent.toFixed(1)}% 的记录` : `${row.count} 笔 · ${percent.toFixed(1)}%`}</small>
          </div>
        );
      })}
    </div>
  );
}

function PaymentSplit({ rows, total }: { rows: GroupRow[]; total: number }) {
  if (rows.length === 0) {
    return <div className="empty-state compact">暂无支付方式</div>;
  }

  return (
    <div className="payment-block">
      <div className="split-bar" aria-hidden="true">
        {rows.map((row, index) => (
          <span className={`split-tone-${index % 4}`} key={row.label} style={{ width: `${Math.max((row.value / total) * 100, 4)}%` }} />
        ))}
      </div>
      <div className="legend-list">
        {rows.map((row, index) => (
          <div key={row.label}>
            <i className={`split-tone-${index % 4}`} />
            <span>{row.label}</span>
            <strong>{formatMoney(row.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckItem({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'quiet' }) {
  return (
    <div className={`check-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

  return Array.from(groups.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

function buildDailyRows(items: Transaction[], month: string): GroupRow[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const days = Number.isInteger(year) && Number.isInteger(monthIndex) ? new Date(year, monthIndex, 0).getDate() : 31;
  const rows = Array.from({ length: days }, (_, index) => ({ label: String(index + 1), value: 0, count: 0 }));

  for (const item of items) {
    const day = Number(item.transaction_date.slice(8, 10));
    if (Number.isInteger(day) && day >= 1 && day <= rows.length) {
      rows[day - 1].value += item.amount;
      rows[day - 1].count += 1;
    }
  }

  return rows;
}

function buildWeekdayRows(items: Transaction[]): GroupRow[] {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const rows = labels.map((label) => ({ label, value: 0, count: 0 }));
  for (const item of items) {
    const date = new Date(`${item.transaction_date}T12:00:00`);
    const weekday = (date.getDay() + 6) % 7;
    if (Number.isInteger(weekday)) {
      rows[weekday].value += item.amount;
      rows[weekday].count += 1;
    }
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

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}
