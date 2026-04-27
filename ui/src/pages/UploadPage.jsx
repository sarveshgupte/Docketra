import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../utils/constants';

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--dt-bg-warm)',
  padding: '24px',
};

const cardStyle = {
  width: '100%',
  maxWidth: '480px',
  background: 'var(--dt-surface)',
  border: '1px solid var(--dt-border-whisper)',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

export const UploadPage = () => {
  const { token } = useParams();
  const [requiresPin, setRequiresPin] = useState(false);
  const [pin, setPin] = useState('');
  const [files, setFiles] = useState([]);
  const [pageStatus, setPageStatus] = useState('loading');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [requestingPin, setRequestingPin] = useState(false);
  const [pinHelpMessage, setPinHelpMessage] = useState('');

  const uploadEndpoint = useMemo(() => `${API_BASE_URL}/public/upload/${token}`, [token]);

  useEffect(() => {
    let isMounted = true;

    const loadMeta = async () => {
      setPageStatus('loading');
      setStatus('idle');
      setErrorMessage('');
      setPinHelpMessage('');
      try {
        const response = await fetch(`${uploadEndpoint}/meta`);
        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error('This upload link is invalid.');
        }

        if (payload?.data?.expired) {
          if (!isMounted) return;
          setPageStatus('error');
          setErrorMessage('This upload link has expired.');
          return;
        }

        if (!isMounted) return;
        setRequiresPin(Boolean(payload?.data?.requiresPin));
        setPageStatus('ready');
      } catch (error) {
        if (!isMounted) return;
        setPageStatus('error');
        setErrorMessage(error?.message || 'Unable to load upload link metadata.');
      }
    };

    if (token) {
      loadMeta();
    } else {
      setPageStatus('error');
      setErrorMessage('Missing upload token.');
    }

    return () => {
      isMounted = false;
    };
  }, [token, uploadEndpoint]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!files.length) {
      setStatus('error');
      setErrorMessage('Please choose at least one file first.');
      return;
    }

    if (requiresPin && !/^\d{4}$/.test(pin)) {
      setStatus('error');
      setErrorMessage('Please enter a valid 4-digit code.');
      return;
    }

    setStatus('idle');
    setErrorMessage('');
    setUploading(true);
    setProgress(0);

    try {
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append('file', file);
        if (requiresPin) formData.append('pin', pin);

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Upload failed. Please try again.');
        }

        setProgress(Math.round(((index + 1) / files.length) * 100));
      }

      setUploading(false);
      setStatus('success');
    } catch (error) {
      setUploading(false);
      setStatus('error');
      setErrorMessage(error?.message || 'Upload failed. Please try again.');
    }
  };

  const handleRequestPin = async () => {
    setRequestingPin(true);
    setPinHelpMessage('');
    setErrorMessage('');
    try {
      const response = await fetch(`${uploadEndpoint}/request-pin`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to send PIN. Please contact your advisor.');
      }
      setPinHelpMessage('PIN has been sent to your registered email address.');
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to send PIN. Please contact your advisor.');
    } finally {
      setRequestingPin(false);
    }
  };

  return (
    <div style={pageStyle}>
      <main style={cardStyle}>
        {pageStatus === 'loading' ? <p>Loading upload link...</p> : null}

        {pageStatus === 'error' ? (
          <p style={{ color: 'var(--dt-error)', margin: 0 }}>{errorMessage || 'This upload link has expired.'}</p>
        ) : null}

        {status === 'success' ? (
          <div style={{ color: 'var(--dt-success)', margin: 0 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>✅ Documents received</p>
            <p style={{ marginTop: '8px' }}>Our team will review your documents and get back to you.</p>
          </div>
        ) : null}

        {pageStatus === 'ready' ? (
          <form onSubmit={handleSubmit}>
            {requiresPin ? (
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="pin" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Enter 4-digit code
                </label>
                <input
                  id="pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="____"
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--dt-border)', borderRadius: '8px' }}
                />
                <button
                  type="button"
                  onClick={handleRequestPin}
                  disabled={requestingPin}
                  style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    color: 'var(--dt-accent)',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: requestingPin ? 'not-allowed' : 'pointer',
                  }}
                >
                  {requestingPin ? 'Sending PIN…' : 'Request PIN on email'}
                </button>
                {pinHelpMessage ? <p style={{ color: 'var(--dt-success)', marginTop: '8px', marginBottom: 0 }}>{pinHelpMessage}</p> : null}
              </div>
            ) : null}

            <div style={{ marginBottom: '16px' }}>
              <h1 style={{ fontSize: '20px', marginBottom: '10px' }}>Upload documents</h1>
              <p style={{ marginBottom: '10px', color: 'var(--dt-text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                Secure upload • No login required
              </p>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setFiles([...event.dataTransfer.files]);
                  setStatus('idle');
                  setErrorMessage('');
                }}
                style={{
                  border: '1px dashed var(--dt-border-strong)',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '10px',
                }}
              >
                Drag & Drop files here or click to upload
              </div>
              <input
                type="file"
                multiple
                onChange={(event) => {
                  setFiles([...(event.target.files || [])]);
                  setStatus('idle');
                  setErrorMessage('');
                }}
              />
              <div style={{ marginTop: '8px', color: 'var(--dt-text-muted)', fontSize: '14px' }}>
                {files.length
                  ? files.map((file, index) => <div key={`${file.name}-${index}`}>{file.name}</div>)
                  : 'No files selected'}
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              style={{
                background: 'var(--dt-accent)',
                color: 'var(--dt-text-inverse)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.8 : 1,
              }}
            >
              Upload
            </button>

            {uploading ? (
              <p style={{ color: 'var(--dt-text)', marginTop: '12px' }}>
                Uploading... please wait ({progress}%)
              </p>
            ) : null}

            {status === 'error' ? (
              <p style={{ color: 'var(--dt-error)', marginTop: '12px' }}>
                {errorMessage || 'Upload failed. Please try again.'}
              </p>
            ) : null}
          </form>
        ) : null}
      </main>
    </div>
  );
};

export default UploadPage;
