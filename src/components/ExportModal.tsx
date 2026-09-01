import { useState } from 'react';
import { downloadExport, importCsv } from '../services/api';

interface ExportModalProps {
  token: string;
  onImportComplete: () => Promise<void>;
}

export function ExportModal({ token, onImportComplete }: ExportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!token) {
      setError('先填写 APP_PASSKEY');
      return;
    }
    if (!file) {
      setError('先选择 CSV 文件');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await importCsv(token, file);
      setMessage(response.message);
      setFile(null);
      await onImportComplete();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '导入失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    if (!token) {
      setError('先填写 APP_PASSKEY');
      return;
    }

    setError('');
    try {
      await downloadExport(token, format);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出失败');
    }
  }

  return (
    <section className="export-panel" aria-labelledby="export-title">
      <div className="transfer-intro">
        <h2 id="export-title">导入 / 导出</h2>
        <p>导入当前账单 CSV，或把 D1 中已有记录导出为 CSV / JSON。</p>
      </div>

      <div className="transfer-grid">
        <div className="transfer-block">
          <div className="transfer-block-heading">
            <h3>导入 CSV</h3>
            <span>最多 500 行</span>
          </div>
          <label className="file-picker" htmlFor="csv-file">
            <span>{file ? file.name : '选择账单 CSV'}</span>
            <small>支持 MyCost 导出的格式</small>
          </label>
          <input
            id="csv-file"
            className="file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button className="primary-button" type="button" onClick={() => void handleImport()} disabled={loading}>
            {loading ? '导入中' : '导入到账本'}
          </button>
        </div>

        <div className="transfer-block">
          <div className="transfer-block-heading">
            <h3>导出备份</h3>
            <span>当前账单</span>
          </div>
          <p className="transfer-copy">CSV 适合表格软件，JSON 保留完整字段，适合迁移和恢复。</p>
          <div className="action-row">
            <button className="tool-button" type="button" onClick={() => void handleExport('csv')} disabled={loading}>
              下载 CSV
            </button>
            <button className="tool-button" type="button" onClick={() => void handleExport('json')} disabled={loading}>
              下载 JSON
            </button>
          </div>
        </div>
      </div>

      <div className="message-slot" aria-live="polite">
        {message ? <p className="notice success">{message}，已刷新账单。</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </div>
    </section>
  );
}
