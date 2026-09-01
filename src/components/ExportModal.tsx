import { useState } from 'react';
import { downloadExport } from '../services/api';

interface ExportModalProps {
  token: string;
}

export function ExportModal({ token }: ExportModalProps) {
  const [message, setMessage] = useState('');

  async function handleExport(format: 'csv' | 'json') {
    if (!token) {
      setMessage('先填写 APP_PASSKEY');
      return;
    }

    setMessage('');
    try {
      await downloadExport(token, format);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    }
  }

  return (
    <section className="export-panel" id="export" aria-labelledby="export-title">
      <div>
        <p className="section-kicker">Backup</p>
        <h2 id="export-title">导入 / 导出</h2>
        <p>当前可导出 CSV 和 JSON；导入功能沿用同一账本入口规划。</p>
      </div>
      <div className="action-row">
        <button className="tool-button" type="button" onClick={() => void handleExport('csv')}>
          CSV
        </button>
        <button className="tool-button" type="button" onClick={() => void handleExport('json')}>
          JSON
        </button>
      </div>
      {message ? <p className="notice error">{message}</p> : null}
    </section>
  );
}
