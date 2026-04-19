import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Textarea } from '../components/common/Textarea';
import { clientApi } from '../api/client.api';
import { ROUTES } from '../constants/routes';
import { formatDate, formatDocketId } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';

const tabs = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'cfs', label: 'Notes', path: '/cfs' },
  { key: 'compliance', label: 'Compliance', path: '/compliance' },
  { key: 'documents', label: 'Documents', path: '/documents' },
  { key: 'dockets', label: 'Dockets', path: '/dockets' },
  { key: 'activity', label: 'Activity', path: '/activity' },
];

const isOpenLifecycle = (value) => {
  const normalized = String(value || '').toUpperCase();
  return ['OPEN', 'NEW', 'PENDING', 'IN_PROGRESS'].includes(normalized);
};

const isResolvedLifecycle = (value) => {
  const normalized = String(value || '').toUpperCase();
  return ['RESOLVED', 'CLOSED', 'FILED', 'DONE', 'COMPLETED'].includes(normalized);
};

export const ClientWorkspacePage = () => {
  const { firmSlug, clientId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [dockets, setDockets] = useState([]);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cfsForm, setCfsForm] = useState({ entity_type: '', cin_llpin: '', incorporation_date: '', registered_address: '', industry: '', contact_person: '', contact_email: '', contact_phone: '', compliance_notes: '' });

  const currentTab = useMemo(() => {
    const normalizePath = (value) => {
      const pathValue = String(value || '');
      return pathValue.length > 1 ? pathValue.replace(/\/+$/, '') : pathValue;
    };

    const normalizedPathname = normalizePath(pathname);
    const workspaceBasePath = normalizePath(ROUTES.CLIENT_WORKSPACE(firmSlug, clientId));

    if (normalizedPathname === workspaceBasePath) return 'overview';

    const matchedTab = tabs.find((tab) => (
      tab.path
      && normalizedPathname === `${workspaceBasePath}${tab.path}`
    ));
    return matchedTab?.key || 'overview';
  }, [pathname, firmSlug, clientId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [clientRes, docketRes, activityRes, commentsRes] = await Promise.all([
        clientApi.getClientById(clientId),
        clientApi.getClientDockets(clientId),
        clientApi.getClientActivity(clientId),
        clientApi.getClientCfsComments(clientId),
      ]);
      const c = clientRes?.data;
      setClient(c);
      setDockets(docketRes?.data || []);
      setActivity(activityRes?.data || []);
      setComments(commentsRes?.data || []);
      const basicInfo = c?.clientFactSheet?.basicInfo || {};
      setCfsForm({
        entity_type: basicInfo.entityType || '',
        cin_llpin: basicInfo.CIN || '',
        incorporation_date: c?.incorporationDate ? String(c.incorporationDate).slice(0, 10) : '',
        registered_address: basicInfo.address || c?.businessAddress || '',
        industry: c?.industry || '',
        contact_person: basicInfo.contactPerson || '',
        contact_email: basicInfo.email || c?.businessEmail || '',
        contact_phone: basicInfo.phone || c?.primaryContactNumber || '',
        compliance_notes: c?.clientFactSheet?.notes || '',
      });
    } catch (error) {
      setLoadError(error?.response?.data?.message || error?.message || 'Unable to load client workspace.');
      setClient(null);
      setDockets([]);
      setActivity([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const onSaveCfs = async () => {
    await clientApi.updateClientFactSheet(clientId, cfsForm.compliance_notes, cfsForm.compliance_notes, {
      clientName: client?.businessName,
      entityType: cfsForm.entity_type,
      CIN: cfsForm.cin_llpin,
      address: cfsForm.registered_address,
      contactPerson: cfsForm.contact_person,
      email: cfsForm.contact_email,
      phone: cfsForm.contact_phone,
    });
    await load();
  };

  const onAddComment = async () => {
    if (!commentText.trim()) return;
    await clientApi.addClientCfsComment(clientId, { commentText });
    setCommentText('');
    await load();
  };

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await clientApi.uploadFactSheetFile(clientId, file);
    await load();
  };

  const docketStats = useMemo(() => {
    const total = dockets.length;
    const open = dockets.filter((item) => isOpenLifecycle(item.lifecycle || item.status)).length;
    const resolved = dockets.filter((item) => isResolvedLifecycle(item.lifecycle || item.status)).length;
    return { total, open, resolved };
  }, [dockets]);
  const recentDockets = useMemo(
    () => [...dockets]
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))
      .slice(0, 5),
    [dockets]
  );
  const statusTone = client?.status === 'ACTIVE' ? 'Approved' : 'Rejected';
  const clientWorkspaceRoute = ROUTES.CLIENT_WORKSPACE(firmSlug, clientId);

  return (
    <PlatformShell
      moduleLabel="Client Management"
      title={client?.businessName || 'Client Workspace'}
      subtitle="Client profile, linked dockets, and execution context in one place."
      actions={(
        <Button onClick={() => navigate(`${ROUTES.CREATE_CASE(firmSlug)}?clientId=${encodeURIComponent(clientId)}`)}>
          + Create Docket for Client
        </Button>
      )}
    >
      {loading ? <Loading message="Loading client workspace..." /> : null}
      {loadError ? <Card><p className="text-red-700">{loadError}</p></Card> : null}
      {!loading && !loadError ? (
        <>
          <div className="admin__header">
            <h1 className="neo-page__title">Client: {client?.businessName || clientId}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map((tab) => <Link key={tab.key} to={`${clientWorkspaceRoute}${tab.path}`} className={`btn ${currentTab === tab.key ? 'btn-primary' : ''}`}>{tab.label}</Link>)}
          </div>

          {currentTab === 'overview' && (
            <>
              <Card>
                <div className="field-grid">
                  <div className="field-group"><span className="field-label">Client ID</span><span className="field-value">{client?.clientId || clientId}</span></div>
                  <div className="field-group"><span className="field-label">Business Email</span><span className="field-value">{client?.businessEmail || '—'}</span></div>
                  <div className="field-group"><span className="field-label">Primary Contact</span><span className="field-value">{client?.primaryContactNumber || '—'}</span></div>
                  <div className="field-group"><span className="field-label">Status</span><span className="field-value"><Badge status={statusTone}>{client?.status || 'UNKNOWN'}</Badge></span></div>
                  <div className="field-group"><span className="field-label">Total Dockets</span><span className="field-value">{docketStats.total}</span></div>
                  <div className="field-group"><span className="field-label">Open Dockets</span><span className="field-value">{docketStats.open}</span></div>
                  <div className="field-group"><span className="field-label">Filed/Resolved</span><span className="field-value">{docketStats.resolved}</span></div>
                  <div className="field-group"><span className="field-label">Last Activity</span><span className="field-value">{activity[0]?.timestamp ? formatDateTime(activity[0].timestamp) : '—'}</span></div>
                </div>
              </Card>
              <Card>
                <div className="case-card__heading">
                  <h2>Recent Dockets</h2>
                </div>
                {!recentDockets.length ? <p>No dockets linked to this client yet.</p> : (
                  <div className="case-detail-table-wrap">
                    <table className="case-detail-table">
                      <thead>
                        <tr>
                          <th>Docket</th>
                          <th>Title</th>
                          <th>Status</th>
                          <th>Updated</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDockets.map((docket) => {
                          const docketId = docket.caseId || docket.docketId || docket._id;
                          return (
                            <tr key={docketId}>
                              <td>{formatDocketId(docketId)}</td>
                              <td>{docket.title || docket.caseName || 'Untitled docket'}</td>
                              <td>{docket.lifecycle || docket.status || '—'}</td>
                              <td>{formatDate(docket.updatedAt || docket.createdAt)}</td>
                              <td>
                                <Button
                                  size="small"
                                  variant="outline"
                                  onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, docketId), { state: { returnTo: clientWorkspaceRoute, fromClientRoute: clientWorkspaceRoute } })}
                                >
                                  Open Docket
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {currentTab === 'cfs' && <Card>
            <div className="global-worklist__filters">
              {Object.entries(cfsForm).map(([k, v]) => (
                <div className="filter-group" key={k}><label>{k}</label><input className="neo-input" value={v} onChange={(e) => setCfsForm((prev) => ({ ...prev, [k]: e.target.value }))} /></div>
              ))}
            </div>
            <Button onClick={onSaveCfs}>Save changes</Button>
            <hr />
            <h3>Comments</h3>
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment" />
            <input type="file" onChange={onUpload} aria-label="Upload file for comment" />
            <Button onClick={onAddComment}>Post comment</Button>
            {[...comments].reverse().map((comment) => <div key={comment.comment_id} style={{ marginTop: 12 }}><strong>{comment.author_name || comment.user_id}</strong> — {formatDate(comment.created_at)}<div>{comment.comment_text}</div>{(comment.attachments || []).map((a) => <div key={a.attachment_id}>{a.file_name}</div>)}</div>)}
          </Card>}

          {currentTab === 'compliance' && (
            <Card>
              <p className="text-sm text-gray-600">Use linked dockets to manage compliance execution for this client. Create or open a docket from the Dockets tab.</p>
            </Card>
          )}

          {currentTab === 'documents' && <Card><p>Corporate Documents · Client Fact Sheet attachments.</p><p>Upload/download/version history from the client fact sheet and docket attachments.</p></Card>}

          {currentTab === 'dockets' && (
            <Card>
              <div className="case-detail-table-wrap">
                <table className="case-detail-table">
                  <thead>
                    <tr>
                      <th>Docket ID</th>
                      <th>Title</th>
                      <th>Category / Subcategory</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dockets.map((docket) => {
                      const docketId = docket.caseId || docket.docketId || docket._id;
                      return (
                        <tr key={docketId}>
                          <td>{formatDocketId(docketId)}</td>
                          <td>{docket.title || docket.caseName || 'Untitled docket'}</td>
                          <td>{docket.category || '—'} {docket.subcategory ? ` / ${docket.subcategory}` : ''}</td>
                          <td>{docket.lifecycle || docket.status || '—'}</td>
                          <td>{docket.assignedToName || docket.assignee || docket.assignedToXID || 'Unassigned'}</td>
                          <td>{formatDateTime(docket.updatedAt || docket.createdAt)}</td>
                          <td>
                            <Button
                              size="small"
                              variant="outline"
                              onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, docketId), { state: { returnTo: clientWorkspaceRoute, fromClientRoute: clientWorkspaceRoute } })}
                            >
                              Open Docket
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!dockets.length ? <tr><td colSpan={7}>No dockets found for this client.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {currentTab === 'activity' && <Card>{activity.length ? activity.map((entry) => <div key={entry.id}>{entry.description} — {formatDate(entry.timestamp)}</div>) : <p>No recent activity for this client.</p>}</Card>}
        </>
      ) : null}
    </PlatformShell>
  );
};

export default ClientWorkspacePage;
