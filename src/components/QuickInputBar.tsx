interface QuickInputBarProps {
  token: string;
  text: string;
  loading: boolean;
  recording: boolean;
  notice: string;
  error: string;
  onTokenChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  onRefresh: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function QuickInputBar(props: QuickInputBarProps) {
  const busy = props.loading || props.recording;

  return (
    <section className="entry-panel">
      <div className="panel-heading">
        <div>
          <h2>快速记账</h2>
          <p>一句话、一次录音，解析后直接写入 D1。</p>
        </div>
        <button className="tool-button" type="button" onClick={props.onRefresh} disabled={props.loading || !props.token.trim()}>
          刷新
        </button>
      </div>

      <div className="field-stack">
        <label className="field-label" htmlFor="passkey">
          APP_PASSKEY
        </label>
        <input
          id="passkey"
          className="text-field"
          type="password"
          value={props.token}
          placeholder="Worker 环境变量中的 APP_PASSKEY"
          onChange={(event) => props.onTokenChange(event.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="entry-compose">
        <div className="field-stack grow">
          <label className="field-label" htmlFor="entry-text">
            文本输入
          </label>
          <textarea
            id="entry-text"
            rows={4}
            value={props.text}
            placeholder="中午吃牛肉面 28 块，微信支付"
            onChange={(event) => props.onTextChange(event.target.value)}
          />
        </div>
        <div className="button-stack" aria-label="记账操作">
          <button className="primary-button" type="button" onClick={props.onSubmit} disabled={props.loading || props.recording}>
            {props.loading ? '提交中' : '提交'}
          </button>
          <button
            className={props.recording ? 'tool-button record-button active' : 'tool-button record-button'}
            type="button"
            onClick={props.recording ? props.onStopRecording : props.onStartRecording}
            disabled={props.loading}
          >
            {props.recording ? '停止' : '录音'}
          </button>
        </div>
      </div>

      <div className="message-slot" aria-live="polite">
        {props.recording ? <p className="notice recording">录音中，停止后上传解析。</p> : null}
        {!props.recording && props.notice ? <p className="notice success">{props.notice}</p> : null}
        {props.error ? <p className="notice error">{props.error}</p> : null}
        {!props.error && !props.notice && !busy ? <p className="notice muted">准备接收文本或语音。</p> : null}
      </div>
    </section>
  );
}
