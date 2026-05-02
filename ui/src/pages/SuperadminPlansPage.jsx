import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { superadminService } from '../services/superadminService';
import { useToast } from '../hooks/useToast';

const PLANS = ['pilot', 'starter', 'professional', 'enterprise'];

export const SuperadminPlansPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await superadminService.getPlansCapacity();
      if (!res?.success) throw new Error(res?.message || 'Failed');
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load plans and capacity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (data?.firms || []).filter((f) => (
    (planFilter === 'all' || f.plan === planFilter)
    && (capacityFilter === 'all' || f.capacityStatus === capacityFilter)
    && (!search.trim() || `${f.name} ${f.firmId}`.toLowerCase().includes(search.toLowerCase()))
  )), [data, planFilter, capacityFilter, search]);

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    setSaveError('');
    const payload = {
      plan: editing.plan,
      maxUsers: Number(editing.maxUsers),
      subscriptionStatus: editing.subscriptionStatus || null,
      billingStatus: editing.billingStatus || null,
    };

    try {
      const response = await superadminService.updateFirmPlanCapacity(editing.firmObjectId, payload);
      if (!response?.success) throw new Error(response?.message || 'Failed to save plan/capacity changes.');
      toast.success('Plan & capacity updated.');
      setEditing(null);
      await load();
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'Failed to save plan/capacity changes.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SuperAdminLayout><Loading message="Loading plans & capacity..." /></SuperAdminLayout>;

  return <SuperAdminLayout><div className="mx-auto w-full max-w-7xl space-y-4"><h1 className="text-2xl font-semibold">Plans & Capacity</h1><Card><p className="text-sm text-amber-700">Plans & Capacity shows platform billing-readiness metadata only. It does not expose payment data, client records, dockets, tasks, documents, or private client content.</p></Card>{error ? <Card><p className="text-sm text-rose-700">{error}</p><Button onClick={load}>Retry</Button></Card> : null}<div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[{ k: 'firms', l: 'Total firms' }, { k: 'pilot', l: 'Pilot firms' }, { k: 'overCapacity', l: 'Over capacity' }, { k: 'nearCapacity', l: 'Near capacity' }].map(({ k, l }) => <Card key={k}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold">{data?.totals?.[k] ?? 0}</p></Card>)}</div><Card><div className="flex gap-2 flex-wrap"><input className="border rounded px-2 py-1" placeholder="Search firm" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="border rounded px-2 py-1" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}><option value="all">All plans</option>{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select><select className="border rounded px-2 py-1" value={capacityFilter} onChange={(e) => setCapacityFilter(e.target.value)}><option value="all">All capacity</option><option value="within_capacity">Within capacity</option><option value="near_capacity">Near capacity</option><option value="over_capacity">Over capacity</option></select></div><div className="overflow-x-auto mt-3"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th>Firm</th><th>firmId</th><th>Status</th><th>Plan</th><th>maxUsers</th><th>userCount</th><th>Capacity %</th><th>Subscription</th><th>Billing</th><th>Actions</th></tr></thead><tbody>{rows.map((r) => <tr key={r.firmObjectId} className="border-t"><td><Link className="text-blue-600 underline" to={r.href}>{r.name}</Link></td><td>{r.firmId}</td><td>{r.status}</td><td>{r.plan}</td><td>{r.maxUsers}</td><td>{r.userCount}</td><td>{r.capacityUsedPercent}% ({r.capacityStatus})</td><td>{r.subscriptionStatus || 'N/A'}</td><td>{r.billingStatus || 'N/A'}</td><td><Button size="small" onClick={() => { setSaveError(''); setEditing({ ...r }); }}>Edit</Button></td></tr>)}</tbody></table></div>{!rows.length ? <p className="text-sm text-gray-500 mt-2">No firms match current filters.</p> : null}</Card>{editing ? <Card><h2 className="font-semibold">Edit plan/capacity: {editing.name}</h2>{saveError ? <p className="mt-2 text-sm text-rose-700">{saveError}</p> : null}<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2"><select className="border rounded px-2 py-1" value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}><option value="pilot">pilot</option><option value="starter">starter</option><option value="professional">professional</option><option value="enterprise">enterprise</option></select><input className="border rounded px-2 py-1" type="number" min="1" max="500" value={editing.maxUsers} onChange={(e) => setEditing({ ...editing, maxUsers: e.target.value })} /><input className="border rounded px-2 py-1" placeholder="subscriptionStatus" value={editing.subscriptionStatus || ''} onChange={(e) => setEditing({ ...editing, subscriptionStatus: e.target.value })} /><input className="border rounded px-2 py-1" placeholder="billingStatus" value={editing.billingStatus || ''} onChange={(e) => setEditing({ ...editing, billingStatus: e.target.value })} /></div><div className="mt-2 flex gap-2"><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button></div></Card> : null}</div></SuperAdminLayout>;
};

export default SuperadminPlansPage;
