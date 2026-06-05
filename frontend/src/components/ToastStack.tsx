import { useToast } from '../store/toast';

export default function ToastStack() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);

  if (!items.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant}`}>
          <div className="toast-icon" aria-hidden>
            {t.variant === 'success' ? '✓' : t.variant === 'error' ? '!' : 'i'}
          </div>
          <div style={{ flex: 1 }}>
            <strong>{t.title}</strong>
            {t.body && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.body}</div>}
          </div>
          <button className="ghost" onClick={() => dismiss(t.id)} style={{ padding: '2px 8px' }}>×</button>
        </div>
      ))}
    </div>
  );
}
