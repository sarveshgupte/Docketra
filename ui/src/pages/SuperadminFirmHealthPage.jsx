import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';

const badgeClass = { healthy: 'bg-emerald-100 text-emerald-800', watch: 'bg-amber-100 text-amber-800', at_risk: 'bg-orange-100 text-orange-800', critical: 'bg-rose-100 text-rose-800' };

export const SuperadminFirmHealthPage = () => {
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [status, setStatus] = useState(''); const [search, setSearch] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await superadminService.getFirmHealth({ limit: 100, status: status || undefined, search: search || undefined }); setData(res?.data || null); }
    catch (e) { setError(e?.response?.data?.message || 'Firm health is temporarily unavailable.'); }
    finally { setLoading(false); }
  }, [status, search]);
  useEffect(() => { void load(); }, [load]);

  const totals = data?.totals || { healthy: 0, watch: 0, atRisk: 0, critical: 0 };
  const firms = useMemo(() => data?.firms || [], [data]);

  return <SuperAdminLayout><div className="mx-auto w-full max-w-7xl space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Firm Health & Risk Queue</h1><p className="text-sm text-gray-500">Safe platform metadata only. No client records, dockets, tasks, attachments, or private content.</p></div><Button variant="secondary" onClick={load}>Refresh</Button></div>
    <Card><p className="text-sm text-amber-700">Privacy boundary: this view only uses platform lifecycle/support metadata and does not expose raw admin emails, tokens, OTPs, credentials, secrets, auth headers, or client content.</p></Card>
    <Card><div className="grid grid-cols-1 gap-3 md:grid-cols-4">{[['Healthy', totals.healthy], ['Watch', totals.watch], ['At risk', totals.atRisk], ['Critical', totals.critical]].map(([l,v]) => <div key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-2xl font-semibold">{v || 0}</p></div>)}</div></Card>
    <Card><div className="flex flex-wrap gap-2"><select className="rounded border px-3 py-2 text-sm" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">All risk levels</option><option value="healthy">Healthy</option><option value="watch">Watch</option><option value="at_risk">At risk</option><option value="critical">Critical</option></select><input className="rounded border px-3 py-2 text-sm" placeholder="Search firm name/ID/slug" value={search} onChange={(e)=>setSearch(e.target.value.slice(0,100))}/><Button variant="secondary" onClick={load}>Apply filters</Button></div></Card>
    {loading ? <Loading message="Loading firm health..."/> : null}
    {!loading && error ? <Card><p className="text-sm text-rose-700">{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : null}
    {!loading && !error && firms.length===0 ? <Card><EmptyState title="No firms in risk queue" description="No firms matched the selected filters." actionLabel="Retry" onAction={load}/></Card> : null}
    {!loading && !error && firms.length>0 ? <Card><h2 className="mb-3 text-lg font-semibold">Risk queue</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th>Firm</th><th>Score</th><th>Risk level</th><th>Top reasons</th><th>Next action</th></tr></thead><tbody>{firms.map((firm)=><tr key={firm.firmObjectId} className="border-t"><td className="py-2"><Link className="text-blue-600 underline" to={firm.href}>{firm.name}</Link></td><td>{firm.score}</td><td><span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass[firm.riskLevel] || 'bg-gray-100 text-gray-700'}`}>{firm.riskLevel}</span></td><td>{(firm.reasons||[]).slice(0,2).join(' ') || 'None'}</td><td>{firm.nextAction || 'Continue monitoring'}</td></tr>)}</tbody></table></div></Card> : null}
  </div></SuperAdminLayout>;
};

export default SuperadminFirmHealthPage;
