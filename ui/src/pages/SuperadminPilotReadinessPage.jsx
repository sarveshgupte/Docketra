import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { superadminService } from '../services/superadminService';

export const SuperadminPilotReadinessPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [data, setData] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const res = await superadminService.getPilotReadiness(); setData(res?.data || null); } catch (e) { setError(e?.response?.data?.message || 'Failed to load pilot readiness.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const summary = useMemo(() => ({ pass: (data?.checklist || []).filter((i) => i.status === 'pass').length, watch: (data?.checklist || []).filter((i) => i.status === 'watch').length, fail: (data?.checklist || []).filter((i) => i.status === 'fail').length }), [data]);
  if (loading) return <SuperAdminLayout><Loading message="Loading pilot readiness..." /></SuperAdminLayout>;
  return <SuperAdminLayout><div className="mx-auto w-full max-w-7xl space-y-4"><h1 className="text-2xl font-semibold">Pilot Readiness Checklist</h1><p className="text-sm text-gray-500">Pilot Readiness uses platform metadata only and does not inspect client records, dockets, tasks, attachments, documents, or private client content.</p>{error ? <Card><p className="text-sm text-red-700">{error}</p><Button variant="secondary" onClick={load}>Retry</Button></Card> : null}{data ? <><Card><p>Status: <strong>{data.overallStatus}</strong> · Score: <strong>{data.score}</strong></p><p className="text-sm text-gray-600">Pass: {summary.pass} · Watch: {summary.watch} · Fail: {summary.fail}</p><p className="text-xs text-gray-500">Generated: {data.generatedAt}</p></Card><Card><h2 className="text-lg font-semibold">Checklist</h2><div className="space-y-2">{(data.checklist || []).map((item) => <div key={item.key} className="rounded border p-3"><p className="font-medium">{item.label} ({item.status})</p><p className="text-sm">{item.summary}</p><p className="text-xs text-gray-500">Evidence: {item.evidence}</p><p className="text-xs text-gray-600">Next: {item.nextAction}</p><Button variant="secondary" onClick={() => navigate(item.href)}>Open</Button></div>)}</div></Card><Card><h2 className="text-lg font-semibold">Blockers</h2><ul>{(data.blockers || []).map((b) => <li key={b}>{b}</li>)}</ul><h2 className="text-lg font-semibold mt-3">Warnings</h2><ul>{(data.warnings || []).map((w) => <li key={w}>{w}</li>)}</ul></Card><Card><h2 className="text-lg font-semibold">Related views</h2><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => navigate('/app/superadmin/firm-health')}>Firm Health</Button><Button variant="secondary" onClick={() => navigate('/app/superadmin/plans')}>Plans & Capacity</Button><Button variant="secondary" onClick={() => navigate('/app/superadmin/onboarding-insights')}>Onboarding Insights</Button><Button variant="secondary" onClick={() => navigate('/app/superadmin/diagnostics')}>Support Diagnostics</Button><Button variant="secondary" onClick={() => navigate('/app/superadmin/audit')}>Audit Logs</Button></div></Card></> : <Card><p className="text-sm text-gray-600">No readiness metadata available.</p><Button variant="secondary" onClick={load}>Retry</Button></Card>}</div></SuperAdminLayout>;
};

export default SuperadminPilotReadinessPage;
