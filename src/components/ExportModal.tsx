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
        <h2 id="export-title">导出备份</h2>
        <p>CSV 给表格软件，JSON 给后续迁移和恢复。</p>
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
