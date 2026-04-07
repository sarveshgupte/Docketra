import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../utils/constants';

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  padding: '24px',
};

const cardStyle = {
  width: '100%',
  maxWidth: '480px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

export const UploadPage = () => {
  const { token } = useParams();
  const [requiresPin, setRequiresPin] = useState(false);
  const [pin, setPin] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const uploadEndpoint = useMemo(() => `${API_BASE_URL}/public/upload/${token}`, [token]);

  useEffect(() => {
    let isMounted = true;

    const loadMeta = async () => {
      setStatus('loading');
      setErrorMessage('');
      try {
        const response = await fetch(`${uploadEndpoint}/meta`);
        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error('This upload link is invalid.');
        }

        if (payload?.data?.expired) {
          if (!isMounted) return;
          setStatus('error');
          setErrorMessage('This upload link has expired.');
          return;
        }

        if (!isMounted) return;
        setRequiresPin(Boolean(payload?.data?.requiresPin));
        setStatus('ready');
      } catch (error) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(error?.message || 'Unable to load upload link metadata.');
      }
    };

    if (token) {
      loadMeta();
    } else {
      setStatus('error');
      setErrorMessage('Missing upload token.');
    }

    return () => {
      isMounted = false;
    };
  }, [token, uploadEndpoint]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setErrorMessage('Please choose a file first.');
      return;
    }

    if (requiresPin && !/^\d{4}$/.test(pin)) {
      setErrorMessage('Please enter a valid 4-digit code.');
      return;
    }

    setErrorMessage('');

    try {
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

      setStatus('success');
    } catch (error) {
      setErrorMessage(error?.message || 'Upload failed. Please try again.');
    }
  };

  return (
    <div style={pageStyle}>
      <main style={cardStyle}>
        {status === 'loading' ? <p>Loading upload link...</p> : null}

        {status === 'error' ? (
          <p style={{ color: '#b91c1c', margin: 0 }}>{errorMessage || 'This upload link has expired.'}</p>
        ) : null}

        {status === 'success' ? (
          <p style={{ color: '#15803d', margin: 0 }}>✔ Files uploaded successfully</p>
        ) : null}

        {status === 'ready' ? (
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
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>
            ) : null}

            <div style={{ marginBottom: '16px' }}>
              <h1 style={{ fontSize: '20px', marginBottom: '10px' }}>Upload documents</h1>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              <p style={{ marginTop: '8px', color: '#64748b', fontSize: '14px' }}>
                {file ? file.name : 'No file selected'}
              </p>
            </div>

            <button
              type="submit"
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upload
            </button>

            {errorMessage ? <p style={{ color: '#b91c1c', marginTop: '12px' }}>{errorMessage}</p> : null}
          </form>
        ) : null}
      </main>
    </div>
  );
};

export default UploadPage;
