import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && (
      <div className="card-head">
        <h3>{title}</h3>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Alert = ({ kind = 'error', children }) =>
  children ? <p className={`alert ${kind}`} role="alert">{children}</p> : null;

export const Bar = ({ label, value, note }) => (
  <div className="bar-row">
    <span className="bar-label">{label}</span>
    <div className="bar"><div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    <span className="bar-val">{note ?? `${Math.round(value)}%`}</span>
  </div>
);

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="spinner-wrap" role="status"><span className="spinner" aria-hidden="true" /><span className="muted">{label}</span></div>
);

export const Empty = ({ title, children, action }) => (
  <div className="empty">
    <strong>{title}</strong>
    {children && <p className="muted">{children}</p>}
    {action}
  </div>
);

export const Stat = ({ label, value, hint }) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {hint && <span className="stat-hint">{hint}</span>}
  </div>
);

export function Tabs({ tabs, children }) {
  const [active, setActive] = useState(tabs[0]);
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={t === active} className={t === active ? 'tab on' : 'tab'} onClick={() => setActive(t)}>{t}</button>
        ))}
      </div>
      {children(active)}
    </>
  );
}

// Run an async action and track busy/error state
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

// Load data once (and on demand) with loading + error state
export function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await loader()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString() : '—');

// ---- Toasts + confirm dialog ------------------------------------------------
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, kind = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v) => { dialog?.resolve(v); setDialog(null); };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}
      </div>
      {dialog && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
            <h3 id="dlg-title">{dialog.title}</h3>
            {dialog.message && <div className="dlg-msg">{dialog.message}</div>}
            <div className="row dlg-actions">
              <button className="btn ghost" onClick={() => close(false)}>{dialog.cancelText || 'Cancel'}</button>
              <button className={`btn ${dialog.danger ? 'danger-solid' : ''}`} autoFocus onClick={() => close(true)}>{dialog.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}
