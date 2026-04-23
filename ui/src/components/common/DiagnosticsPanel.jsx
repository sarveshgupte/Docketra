import { useEffect, useState } from 'react';
import { getRecentDiagnostics } from '../../utils/workflowDiagnostics';

const enabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('docketra:diagnostics:panel') === 'enabled';
};

export const DiagnosticsPanel = () => {
  const [events, setEvents] = useState(getRecentDiagnostics());
  const [isEnabled, setIsEnabled] = useState(enabled());

  useEffect(() => {
    if (!isEnabled) return undefined;
    const handler = () => setEvents(getRecentDiagnostics());
    window.addEventListener('docketra:diagnostic', handler);
    return () => window.removeEventListener('docketra:diagnostic', handler);
  }, [isEnabled]);

  useEffect(() => {
    const id = setInterval(() => setIsEnabled(enabled()), 1500);
    return () => clearInterval(id);
  }, []);

  if (!isEnabled) return null;

  return (
    <aside style={{ position: 'fixed', right: 8, bottom: 8, width: 380, maxHeight: 260, overflow: 'auto', zIndex: 9999, background: '#111827', color: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 11 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Diagnostics (internal)</div>
      {events.slice(-12).reverse().map((event, idx) => (
        <div key={`${event.ts}-${idx}`} style={{ borderTop: '1px solid #374151', paddingTop: 4, marginTop: 4 }}>
          <div>{event.level?.toUpperCase()} · {event.event}</div>
          <div style={{ opacity: 0.8 }}>{event.workflow || event.metricName || ''} {event.durationMs ? `(${event.durationMs}ms)` : ''}</div>
        </div>
      ))}
    </aside>
  );
};
