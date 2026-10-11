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

const WORKSPACE_PROMISES = [
  'Finds the right firm URL for you',
  'Keeps private workspace data hidden',
  'Gets teams back to docket work faster',
];

export const FindWorkspacePage = () => {
  const [xid, setXid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchedWorkspaces, setMatchedWorkspaces] = useState([]);
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMatchedWorkspaces([]);

    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) {
      setError(INVALID_XID_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      try {
        sessionStorage.setItem('docketra_last_xid', normalizedXid);
      } catch (_) {}

      const response = await authApi.findWorkspacesByXid(normalizedXid);
      const matches = Array.isArray(response?.data?.workspaces) ? response.data.workspaces : [];

      if (matches.length === 1) {
        const firmSlug = matches[0]?.firmSlug;
        if (firmSlug) {
          navigate(`/${firmSlug}/login`);
          return;
        }
      }

      if (matches.length > 1) {
        setMatchedWorkspaces(matches);
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
    <div className="auth-wrapper find-workspace-page">
      <div className="find-workspace-page__shell">
        <section className="find-workspace-page__context" aria-label="Workspace discovery context">
          <p className="find-workspace-page__eyebrow">Workspace discovery</p>
          <h1 className="find-workspace-page__heading">Find your Docketra workspace</h1>
          <p className="find-workspace-page__intro">
            Enter your xID and we&apos;ll route you to your firm&apos;s secure login page without exposing private user details.
          </p>
          <ul className="find-workspace-page__benefits">
            {WORKSPACE_PROMISES.map((promise) => (
              <li key={promise}>{promise}</li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['xID only', 'Secure handoff', 'No guessing'].map((label) => (
              <div key={label} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {label}
              </div>
            ))}
          </div>
        </section>

        <Card className="auth-card find-workspace-page__card">
          <div className="auth-header find-workspace-page__card-header">
            <p className="auth-kicker">Workspace lookup</p>
            <h2>Enter your xID</h2>
            <p>Your xID usually looks like X000001.</p>
          </div>

          {matchedWorkspaces.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  Multiple workspaces found for <span className="font-mono">{xid}</span>
                </p>
                <p className="text-slate-600 mt-1">
                  Select your firm workspace to continue:
                </p>
              </div>

              <div className="space-y-2">
                {matchedWorkspaces.map((ws) => (
                  <button
                    key={ws.firmSlug}
                    type="button"
                    onClick={() => navigate(`/${ws.firmSlug}/login`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 transition text-left text-sm group"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block group-hover:text-blue-600">
                        {ws.firmName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        docketra.in/{ws.firmSlug}/login
                      </span>
                    </div>
                    <span className="text-slate-400 group-hover:text-blue-600 font-semibold text-xs ml-2">
                      →
                    </span>
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setMatchedWorkspaces([])}
              >
                Search with another xID
              </Button>
            </div>
          ) : (
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
          )}

          <p className="find-workspace-page__notice" aria-live="polite">
            🛡️ We never show private user details here.
          </p>
        </Card>
      </div>
    </div>
  );
};
