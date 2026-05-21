import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { validateXID } from '../utils/validators';
import { authApi } from '../api/auth.api';

const INVALID_XID_MESSAGE = 'Enter a valid xID, for example X000001.';
const NOT_FOUND_MESSAGE = 'We could not find a workspace for that xID. Check the xID or contact your firm admin.';
const LOOKUP_UNAVAILABLE_MESSAGE = 'Workspace lookup is temporarily unavailable. Please try again.';

export const FindWorkspacePage = () => {
  const [xid, setXid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) {
      setError(INVALID_XID_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.findWorkspacesByXid(normalizedXid);
      const matches = Array.isArray(response?.data?.workspaces) ? response.data.workspaces : [];
      const firmSlug = matches[0]?.firmSlug;

      if (firmSlug) {
        navigate(`/${firmSlug}/login`);
        return;
      }

      setError(NOT_FOUND_MESSAGE);
    } catch (lookupError) {
      const status = lookupError?.response?.status;
      setError(status === 404 ? NOT_FOUND_MESSAGE : LOOKUP_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="find-workspace-page">
      <div className="find-workspace-page__shell">
        <section className="find-workspace-page__context" aria-label="Workspace discovery context">
          <p className="find-workspace-page__eyebrow">Workspace discovery</p>
          <h1 className="find-workspace-page__heading">Find your Docketra workspace</h1>
          <p className="find-workspace-page__intro">
            Enter your xID and we&apos;ll route you to your firm&apos;s secure login page.
          </p>
          <ul className="find-workspace-page__benefits">
            <li>You do not need to remember your firm URL</li>
            <li>Your xID is used only to locate your workspace</li>
            <li>We never show private user details here</li>
          </ul>
        </section>

        <Card className="find-workspace-page__card">
          <div className="find-workspace-page__card-header">
            <h2>Enter your xID</h2>
            <p>Your xID usually looks like X000001.</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="find-workspace-page__form">
            <Input
              id="workspace-xid"
              label="xID"
              value={xid}
              onChange={(event) => setXid(event.target.value.toUpperCase())}
              placeholder="X000001"
              autoComplete="username"
              required
              error={error || undefined}
              aria-live="polite"
            />
            <Button type="submit" fullWidth loading={loading} disabled={loading} aria-live="polite">
              {loading ? 'Finding workspace…' : 'Continue to workspace'}
            </Button>
            <p className="find-workspace-page__security-note">Don&apos;t know your xID? Contact your firm admin.</p>
          </form>

          <p className="find-workspace-page__notice" aria-live="polite">
            We never show private user details on this screen.
          </p>
        </Card>
      </div>
    </div>
  );
};
