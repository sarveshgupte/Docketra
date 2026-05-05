import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ErrorState } from '../components/feedback/ErrorState';
import { spacingClasses } from '../theme/tokens';
import { validateXID } from '../utils/validators';
import { authApi } from '../api/auth.api';

const GENERIC_MESSAGE = 'If your workspace is active, ask your administrator for the exact workspace login URL.';

export const FindWorkspacePage = () => {
  const [xid, setXid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState([]);
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setChoices([]);

    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) {
      setError('Enter a valid xID (example: X123456).');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.findWorkspacesByXid(normalizedXid);
      const matches = Array.isArray(response?.data?.workspaces) ? response.data.workspaces : [];

      if (matches.length === 1) {
        navigate(`/${matches[0].firmSlug}/login`);
        return;
      }

      if (matches.length > 1) {
        setChoices(matches);
        return;
      }

      setError(GENERIC_MESSAGE);
    } catch (_error) {
      setError(GENERIC_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Find my workspace</h1>
          <p className="mt-3 text-sm text-gray-500">Enter your xID to continue to workspace login.</p>
        </div>

        {error ? <ErrorState title="Workspace lookup" description={error} /> : null}

        <form onSubmit={onSubmit} noValidate className={`mt-4 ${spacingClasses.formFieldSpacing}`}>
          <Input
            label="xID"
            value={xid}
            onChange={(event) => setXid(event.target.value.toUpperCase())}
            placeholder="X123456"
            autoComplete="username"
            required
          />
          <Button type="submit" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Finding workspace' : 'Find workspace'}
          </Button>
        </form>

        {choices.length > 1 ? (
          <div className="mt-4" role="status" aria-live="polite">
            <p className="mb-2 text-sm text-gray-600">Select your workspace:</p>
            {choices.map((item) => (
              <button
                key={item.firmSlug}
                type="button"
                onClick={() => navigate(`/${item.firmSlug}/login`)}
                className="mb-2 block w-full rounded border p-2 text-left hover:bg-gray-50"
              >
                <span className="font-medium">{item.firmName}</span>
                <span className="ml-2 text-xs text-gray-500">/{item.firmSlug}</span>
              </button>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
};
