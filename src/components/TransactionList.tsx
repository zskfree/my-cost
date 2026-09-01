import { useEffect, useState } from 'react';
import type { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onDelete: (transaction: Transaction) => void;
  onBulkDelete: (ids: string[]) => void;
}

export function TransactionList({ transactions, loading, onDelete, onBulkDelete }: TransactionListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visibleIds = transactions.map((transaction) => transaction.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => visibleIds.includes(id))));
  }, [transactions]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  }

  function deleteSelected() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    onBulkDelete(ids);
  }

  return (
    <section className="ledger-panel" id="transactions" aria-labelledby="transactions-title">
      <div className="section-heading ledger-heading">
        <div>
          <h2 id="transactions-title">最近账单</h2>
        </div>
        <div className="ledger-tools">
          <p>{transactions.length > 0 ? `${transactions.length} 笔记录` : '暂无账单'}</p>
          {transactions.length > 0 ? <label className="select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={loading} />
            <span>全选</span>
          </label> : null}
          {selectedIds.size > 0 ? <button type="button" className="danger-button" onClick={deleteSelected} disabled={loading}>
            删除 {selectedIds.size} 笔
          </button> : null}
        </div>
      </div>

      <div className="transaction-list">
        {transactions.length === 0 ? <div className="empty-state">填写 Token 后刷新，或先录入一笔账。</div> : null}
        {transactions.map((transaction) => (
          <article className={selectedIds.has(transaction.id) ? 'transaction-item selected' : 'transaction-item'} key={transaction.id}>
            <label className="transaction-check" aria-label={`选择 ${transaction.description || transaction.category}`}>
              <input type="checkbox" checked={selectedIds.has(transaction.id)} onChange={() => toggleSelected(transaction.id)} disabled={loading} />
            </label>
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
