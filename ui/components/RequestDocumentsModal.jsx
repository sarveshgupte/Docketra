import React, { useEffect, useMemo, useRef, useState } from 'react';

export function RequestDocumentsModal({
  isOpen,
  onClose,
  clientEmail = '',
  onGenerate,
  generating = false,
  generatedLink = null,
}) {
  const [expiry, setExpiry] = useState('24h');
  const [requirePin, setRequirePin] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const copyFeedbackTimeoutRef = useRef(null);

  const expiresInLabel = useMemo(() => (expiry === '7d' ? '7 days' : '24 hours'), [expiry]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }

    if (!generatedLink?.link) {
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      setCopyStatus('error');
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink.link);
      setCopyStatus('success');
    } catch (error) {
      setCopyStatus('error');
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} role="presentation">
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="request-documents-modal-title">
        <div style={styles.header}>
          <h2 id="request-documents-modal-title" style={{ margin: 0 }}>Request Documents</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close" title="Close">✕</button>
        </div>

        <div style={styles.section}>
          <p style={styles.label}>Expiry</p>
          <label style={styles.radioRow}>
            <input type="radio" checked={expiry === '24h'} onChange={() => setExpiry('24h')} />
            <span>24 hours</span>
          </label>
          <label style={styles.radioRow}>
            <input type="radio" checked={expiry === '7d'} onChange={() => setExpiry('7d')} />
            <span>7 days</span>
          </label>
        </div>

        <div style={styles.section}>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={requirePin} onChange={(e) => setRequirePin(e.target.checked)} />
            <span>Require PIN</span>
          </label>
        </div>

        <div style={styles.section}>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            <span>Send email to client</span>
          </label>
          <p style={styles.hint}>To: {clientEmail || 'No client email available'}</p>
        </div>

        {generatedLink ? (
          <div style={styles.resultBox} aria-live="polite">
            <p style={styles.resultTitle}>Upload link ready</p>
            <p style={styles.mono}>{generatedLink.link}</p>
            <button type="button" style={styles.copyBtn} onClick={handleCopy}>
              {copyStatus === 'success' ? (
                <>
                  <span aria-hidden="true">✓ </span>
                  Copied!
                </>
              ) : copyStatus === 'error' ? (
                'Copy failed'
              ) : (
                'Copy link'
              )}
            </button>
            {generatedLink.pin ? (
              <div style={{ marginTop: 8 }}>
                <button type="button" style={styles.copyBtn} onClick={() => setShowPin((prev) => !prev)} aria-pressed={showPin}>
                  {showPin ? 'Hide PIN' : 'Show PIN'}
                </button>
                <p style={styles.hint}>PIN: {showPin ? generatedLink.pin : '••••'}</p>
              </div>
            ) : null}
            <p style={styles.hint}>Expires at: {new Date(generatedLink.expiresAt).toLocaleString()}</p>
          </div>
        ) : null}

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
          <button
            type="button"
            onClick={() => onGenerate({ requirePin, expiry, sendEmail })}
            disabled={generating}
            style={styles.primaryBtn}
          >
            {generating ? 'Generating…' : 'Generate Link'}
          </button>
        </div>
        <p style={styles.hint}>Expires in {expiresInLabel}</p>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: 'min(560px, 92vw)',
    background: '#fff',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.1)',
    padding: 20,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 },
  closeBtn: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#64748b' },
  section: { marginBottom: 12 },
  label: { margin: '0 0 6px', fontSize: 12, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  radioRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 13 },
  checkboxRow: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 },
  hint: { margin: '6px 0 0', fontSize: 12, color: '#64748b' },
  resultBox: { border: '1px solid #e2e8f0', borderRadius: 2, padding: 12, marginBottom: 12 },
  resultTitle: { margin: 0, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: 12, wordBreak: 'break-all', margin: '6px 0' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 12 },
  secondaryBtn: { padding: '6px 12px', border: 'none', background: 'transparent', color: '#475569', borderRadius: 2, cursor: 'pointer', fontSize: 13 },
  primaryBtn: { padding: '6px 14px', border: 'none', background: '#0f172a', color: '#fff', borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  copyBtn: { padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 2, cursor: 'pointer', fontSize: 12 },
};
