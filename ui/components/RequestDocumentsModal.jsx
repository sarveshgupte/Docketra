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
  const [copied, setCopied] = useState(false);
  const [copyStatusMessage, setCopyStatusMessage] = useState('');
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
  }, []);

  const expiresInLabel = useMemo(() => (expiry === '7d' ? '7 days' : '24 hours'), [expiry]);

  const handleCopyLink = async () => {
    if (!generatedLink?.link) return;

    if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);

    try {
      await navigator.clipboard.writeText(generatedLink.link);
      setCopied(true);
      setCopyStatusMessage('Link copied to clipboard.');
    } catch (_error) {
      setCopied(false);
      setCopyStatusMessage('Unable to copy link. Please copy manually.');
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      setCopyStatusMessage('');
      copyFeedbackTimeoutRef.current = null;
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} role="presentation">
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="request-documents-modal-title">
        <div style={styles.header}>
          <h2 id="request-documents-modal-title" style={{ margin: 0 }}>Request Documents</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
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
          <div style={styles.resultBox}>
            <p style={styles.resultTitle}>Upload link ready</p>
            <p style={styles.mono}>{generatedLink.link}</p>
            <button
              type="button"
              style={{
                ...styles.copyBtn,
                ...(copied ? styles.copiedBtn : {}),
              }}
              onClick={handleCopyLink}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
            <p style={styles.srOnlyStatus} role="status" aria-live="polite">{copyStatusMessage}</p>
            {generatedLink.pin ? (
              <div style={{ marginTop: 8 }}>
                <button type="button" style={styles.copyBtn} onClick={() => setShowPin((prev) => !prev)}>
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
    borderRadius: 12,
    padding: 16,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeBtn: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 },
  section: { marginBottom: 12 },
  label: { margin: '0 0 6px', fontSize: 13, color: '#374151', fontWeight: 600 },
  radioRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
  checkboxRow: { display: 'flex', gap: 8, alignItems: 'center' },
  hint: { margin: '6px 0 0', fontSize: 12, color: '#6b7280' },
  resultBox: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 },
  resultTitle: { margin: 0, fontWeight: 600, fontSize: 14 },
  mono: { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  secondaryBtn: { padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, cursor: 'pointer' },
  primaryBtn: { padding: '8px 12px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: 8, cursor: 'pointer' },
  copyBtn: { padding: '6px 10px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s ease' },
  copiedBtn: { background: '#ecfdf5', borderColor: '#10b981', color: '#047857' },
  srOnlyStatus: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    border: 0,
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
};
