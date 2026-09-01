import type { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, loading, onDelete }: TransactionListProps) {
  return (
    <section className="ledger-panel" id="transactions" aria-labelledby="transactions-title">
      <div className="section-heading ledger-heading">
        <div>
          <h2 id="transactions-title">最近账单</h2>
        </div>
        <p>{transactions.length > 0 ? `${transactions.length} 笔记录` : '暂无账单'}</p>
      </div>

      <div className="transaction-list">
        {transactions.length === 0 ? <div className="empty-state">填写 Token 后刷新，或先录入一笔账。</div> : null}
        {transactions.map((transaction) => (
          <article className="transaction-item" key={transaction.id}>
            <div className="transaction-main">
              <div className="transaction-title">
                <strong>{transaction.description || transaction.merchant || transaction.category}</strong>
                <p>
                  {transaction.transaction_date} · {transaction.category}
                  {transaction.subcategory ? `/${transaction.subcategory}` : ''}
                  {transaction.payment_method ? ` · ${transaction.payment_method}` : ''}
                </p>
              </div>
              <span className={transaction.type === 'income' ? 'amount income' : 'amount expense'}>
                {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toFixed(2)}
              </span>
            </div>
            <div className="transaction-meta">
              <span>{transaction.raw_text}</span>
              <div className="transaction-actions">
                <small>{sourceLabel(transaction.source)} · {confidenceLabel(transaction.confidence)}</small>
                <button type="button" onClick={() => onDelete(transaction)} disabled={loading}>
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function sourceLabel(source: Transaction['source']): string {
  const labels: Record<Transaction['source'], string> = {
    shortcuts: '快捷指令',
    pwa_voice: '网页录音',
    pwa_text: '网页文本',
    manual: '手动',
  };
  return labels[source];
}

function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return '置信度未返回';
  return `置信度 ${(confidence * 100).toFixed(0)}%`;
}
