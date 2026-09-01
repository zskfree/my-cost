import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardStats } from './components/DashboardStats';
import { ExportModal } from './components/ExportModal';
import { QuickInputBar } from './components/QuickInputBar';
import { SpendingAnalysis } from './components/SpendingAnalysis';
import { TransactionList } from './components/TransactionList';
import { bulkDeleteTransactions, createAudioEntry, createEntry, deleteTransaction, listTransactions, listTransactionsByRange } from './services/api';
import { startAudioRecording, type AudioRecordingSession } from './services/audioRecorder';
import { makeAnalysisRange, previousAnalysisRange } from './utils/analysisRange';
import type { AnalysisRange, EntryResponse, Transaction, TransactionsResponse } from './types';

const TOKEN_STORAGE_KEY = 'mycost.appPasskey';
type ViewKey = 'analysis' | 'input' | 'transactions' | 'export';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [month, setMonth] = useState(() => currentMonth());
  const [analysisRange, setAnalysisRange] = useState<AnalysisRange>(() => makeAnalysisRange('month'));
  const [view, setView] = useState<ViewKey>(() => viewFromHash());
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef<AudioRecordingSession | null>(null);
  const [data, setData] = useState<TransactionsResponse>(emptyTransactionsResponse());
  const [analysisData, setAnalysisData] = useState<TransactionsResponse>(emptyTransactionsResponse());
  const [previousAnalysisData, setPreviousAnalysisData] = useState<TransactionsResponse>(emptyTransactionsResponse());

  const refresh = useCallback(
    async (targetMonth = month) => {
      if (!token.trim()) return;
      setError('');
      try {
        setData(await listTransactions(token.trim(), targetMonth));
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : '读取账单失败');
      }
    },
    [month, token],
  );

  const refreshAnalysis = useCallback(
    async (targetRange = analysisRange) => {
      if (!token.trim()) return;
      setError('');
      try {
        const previousRange = previousAnalysisRange(targetRange);
        const [current, previous] = await Promise.all([
          listTransactionsByRange(token.trim(), targetRange.from, targetRange.to),
          listTransactionsByRange(token.trim(), previousRange.from, previousRange.to),
        ]);
        setAnalysisData(current);
        setPreviousAnalysisData(previous);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : '读取复盘数据失败');
      }
    },
    [analysisRange, token],
  );

  useEffect(() => {
    function syncView() {
      setView(viewFromHash());
    }
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  useEffect(() => {
    if (token.trim()) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      void refresh(month);
      void refreshAnalysis(analysisRange);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [analysisRange, month, refresh, refreshAnalysis, token]);

  async function handleSubmit() {
    const content = text.trim();
    if (!token.trim()) {
      setError('先填写 APP_PASSKEY');
      return;
    }
    if (!content) {
      setError('请输入记账内容');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await createEntry(token.trim(), content);
      setText('');
      await showEntryResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '记账失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRecording() {
    if (!token.trim()) {
      setError('先填写 APP_PASSKEY');
      return;
    }

    setError('');
    setNotice('');
    try {
      recordingRef.current = await startAudioRecording();
      setRecording(true);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '录音启动失败');
    }
  }

  async function handleStopRecording() {
    const session = recordingRef.current;
    if (!session) return;

    setLoading(true);
    setRecording(false);
    setError('');
    try {
      const audio = await session.stop();
      recordingRef.current = null;
      const response = await createAudioEntry(token.trim(), audio, text);
      setText('');
      await showEntryResult(response);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '语音记账失败');
    } finally {
      setLoading(false);
    }
  }

  async function showEntryResult(response: EntryResponse) {
    const targetMonth = response.transactions?.[0]?.transaction_date.slice(0, 7) || month;
    const suffix = targetMonth !== month ? `，已切换到 ${targetMonth}` : '';
    setNotice(`${response.duplicated ? `${response.message}（未新增）` : response.message}${suffix}`);
    if (targetMonth !== month) {
      setMonth(targetMonth);
    }
    await refresh(targetMonth);
    await refreshAnalysis(analysisRange);
    window.location.hash = 'transactions';
  }

  async function handleDelete(transaction: Transaction) {
    if (!confirm(`删除 ${transaction.category} ¥${transaction.amount.toFixed(2)}？`)) return;
    setLoading(true);
    setError('');
    try {
      await deleteTransaction(token.trim(), transaction.id);
      await refresh(month);
      await refreshAnalysis(analysisRange);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`确定删除已选的 ${ids.length} 笔账单？删除后可通过备份恢复。`)) return;

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await bulkDeleteTransactions(token.trim(), ids);
      setNotice(result.message);
      await refresh(month);
      await refreshAnalysis(analysisRange);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '批量删除失败');
    } finally {
      setLoading(false);
    }
  }

  const page = pageMeta(view);

  return (
    <div className="app-workbench">
      <aside className="side-rail" aria-label="MyCost 导航">
        <div className="brand-block">
          <p className="eyebrow">MyCost</p>
          <h1>账本工作台</h1>
        </div>
        <nav className="rail-nav" aria-label="主导航">
          <NavItem view="analysis" activeView={view} label="复盘" />
          <NavItem view="input" activeView={view} label="记账" />
          <NavItem view="transactions" activeView={view} label="账单" />
          <NavItem view="export" activeView={view} label="导入/导出" />
        </nav>
        <div className="rail-footnote">
          <span>{token ? 'Token 已设置' : '待设置 Token'}</span>
          <strong>{month}</strong>
        </div>
      </aside>

      <main className="workbench-main">
        <header className="workbench-header">
          <h2>{page.title}</h2>
          <div className={recording ? 'status-pill live' : 'status-pill'}>{recording ? '录音中' : loading ? '处理中' : '就绪'}</div>
        </header>

        {view === 'analysis' ? (
          <>
            <div className="view-content analysis-view">
              <DashboardStats response={analysisData} month={month} title={analysisRange.label} hideMonthPicker onMonthChange={setMonth} />
            </div>
            <SpendingAnalysis
              response={analysisData}
              previousResponse={previousAnalysisData}
              range={analysisRange}
              onRangeChange={setAnalysisRange}
            />
          </>
        ) : null}

        {view === 'input' ? (
          <div className="view-content input-view">
            <QuickInputBar
              token={token}
              text={text}
              loading={loading}
              notice={notice}
              error={error}
              onTokenChange={setToken}
              onTextChange={setText}
              recording={recording}
              onSubmit={handleSubmit}
              onRefresh={() => void refresh(month)}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          </div>
        ) : null}

        {view === 'transactions' ? (
          <>
            <div className="view-content transactions-view">
              <DashboardStats response={data} month={month} onMonthChange={setMonth} />
            </div>
            <TransactionList
              transactions={data.transactions}
              loading={loading}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
            />
          </>
        ) : null}

        {view === 'export' ? (
          <div className="view-content export-view">
            <ExportModal
              token={token.trim()}
              onImportComplete={async () => {
                await refresh(month);
                window.location.hash = 'transactions';
              }}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function NavItem({ view, activeView, label }: { view: ViewKey; activeView: ViewKey; label: string }) {
  return (
    <a className={view === activeView ? 'nav-link active' : 'nav-link'} href={`#${view}`} aria-current={view === activeView ? 'page' : undefined}>
      {label}
    </a>
  );
}

function pageMeta(view: ViewKey): { title: string } {
  const pages: Record<ViewKey, { title: string }> = {
    analysis: { title: '月度复盘' },
    input: { title: '记账' },
    transactions: { title: '账单' },
    export: { title: '导入/导出' },
  };
  return pages[view];
}

function viewFromHash(): ViewKey {
  const value = window.location.hash.replace('#', '');
  return value === 'input' || value === 'transactions' || value === 'export' ? value : 'analysis';
}

function currentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function emptyTransactionsResponse(): TransactionsResponse {
  return {
    transactions: [],
    total_expense: 0,
    total_income: 0,
    total_expense_cents: 0,
    total_income_cents: 0,
  };
}
