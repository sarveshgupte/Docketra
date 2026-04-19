import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { clientApi } from '../api/client.api';
import { formatDate } from '../utils/formatters';

const tabs = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'cfs', label: 'CFS', path: '/cfs' },
  { key: 'compliance', label: 'Compliance', path: '/compliance' },
  { key: 'documents', label: 'Documents', path: '/documents' },
  { key: 'dockets', label: 'Dockets', path: '/dockets' },
  { key: 'activity', label: 'Activity', path: '/activity' },
];

export const ClientWorkspacePage = () => {
  const { firmSlug, clientId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [dockets, setDockets] = useState([]);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [cfsForm, setCfsForm] = useState({ entity_type: '', cin_llpin: '', incorporation_date: '', registered_address: '', industry: '', contact_person: '', contact_email: '', contact_phone: '', compliance_notes: '' });

  const currentTab = useMemo(() => tabs.find((tab) => pathname.endsWith(tab.path) || (tab.path === '' && pathname.endsWith(`/${clientId}`)))?.key || 'overview', [pathname, clientId]);

  const load = async () => {
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
  };

  useEffect(() => { load(); }, [clientId]);

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

  return (
    <PlatformShell moduleLabel="Operations" title={client?.businessName || "Client workspace"} subtitle="Client-level compliance context, documents, dockets, and activity.">
      <div className="admin__header">
        <h1 className="neo-page__title">Client: {client?.businessName || clientId}</h1>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => <Link key={tab.key} to={`/app/firm/${firmSlug}/clients/${clientId}${tab.path}`} className={`btn ${currentTab === tab.key ? 'btn-primary' : ''}`}>{tab.label}</Link>)}
      </div>

      {currentTab === 'overview' && <Card><p>Compliance Score: 82</p><p>Upcoming filings: DIR-3 KYC, AOC-4</p><p>Open dockets: {dockets.filter((d) => d.status !== 'Filed').length}</p></Card>}

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

      {currentTab === 'compliance' && <Card><table className="neo-table"><thead><tr><th>Compliance</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td>AOC-4</td><td>30 Oct</td><td>Pending</td><td>Create Docket · Mark Filed · Upload Filing</td></tr><tr><td>MGT-7A</td><td>30 Nov</td><td>Pending</td><td>Create Docket · Mark Filed · Upload Filing</td></tr></tbody></table></Card>}

      {currentTab === 'documents' && <Card><p>Corporate Documents · MCA Filings · Board Resolutions · Agreements</p><p>Upload / download / version history</p></Card>}

      {currentTab === 'dockets' && <Card><table className="neo-table"><thead><tr><th>Docket ID</th><th>Category</th><th>Status</th><th>Created</th></tr></thead><tbody>{dockets.map((d) => <tr key={d.caseId} onClick={() => navigate(`/app/firm/${firmSlug}/dockets/${d.caseId}`)}><td>{d.caseId}</td><td>{d.category}</td><td>{d.status}</td><td>{formatDate(d.createdAt)}</td></tr>)}</tbody></table></Card>}

      {currentTab === 'activity' && <Card>{activity.map((entry) => <div key={entry.id}>{entry.description} — {formatDate(entry.timestamp)}</div>)}</Card>}
    </PlatformShell>
  );
};
