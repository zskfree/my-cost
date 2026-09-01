import type { TransactionsResponse } from '../types';

interface DashboardStatsProps {
  response: TransactionsResponse;
  month: string;
  onMonthChange: (month: string) => void;
}

export function DashboardStats({ response, month, onMonthChange }: DashboardStatsProps) {
  const balance = response.total_income - response.total_expense;
  const expenseCount = response.transactions.filter((item) => item.type === 'expense').length;
  const avgExpense = expenseCount > 0 ? response.total_expense / expenseCount : 0;

  return (
    <section className="kpi-panel" aria-label="月度汇总">
      <div className="panel-heading compact-heading">
        <div>
          <h2>{month} 汇总</h2>
          <p>当前筛选月份的入库结果。</p>
        </div>
        <input
          className="month-field"
          type="month"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
          aria-label="选择账单月份"
        />
      </div>
      <div className="kpi-grid">
        <KpiItem label="支出" value={`¥${response.total_expense.toFixed(2)}`} tone="expense" />
        <KpiItem label="收入" value={`¥${response.total_income.toFixed(2)}`} tone="income" />
        <KpiItem label="结余" value={`¥${balance.toFixed(2)}`} tone={balance >= 0 ? 'income' : 'expense'} />
        <KpiItem label="单笔均支出" value={`¥${avgExpense.toFixed(2)}`} tone="quiet" />
      </div>
    </section>
  );
}

function KpiItem({ label, value, tone }: { label: string; value: string; tone: 'expense' | 'income' | 'quiet' }) {
  return (
    <div className={`kpi-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
