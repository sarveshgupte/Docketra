import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { crmApi } from '../../api/crm.api';
import { formatDate } from '../../utils/formatters';
import { ROUTES, safeRoute } from '../../constants/routes';
import { DataTable, InlineNotice, PageSection, StatGrid } from '../platform/PlatformShared';
import { resolveCrmErrorMessage } from './crmUiUtils';

const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount ?? 0);
const DEAL_STAGE_STATUS = { new: 'Pending', in_progress: 'Pending', completed: 'Approved' };
const DEAL_STAGE_LABEL = { new: 'New', in_progress: 'In Progress', completed: 'Completed' };
const INVOICE_STATUS_MAP = { unpaid: 'Rejected', paid: 'Approved' };
const INVOICE_STATUS_LABEL = { unpaid: 'Unpaid', paid: 'Paid' };
const CLOSED_DOCKET_STATUSES = new Set(['CLOSED', 'APPROVED', 'FILED', 'RESOLVED']);

export const CrmClientDetailPage = () => {
  const { firmSlug, crmClientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [dockets, setDockets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({});
  const [legacyCrmClientId, setLegacyCrmClientId] = useState(null);

  const [activeTab, setActiveTab] = useState('deals');
  const [showDealModal, setShowDealModal] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'new' });

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', dealId: '' });
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await crmApi.getClientById(crmClientId);
      const data = response?.data || {};
      setClient(data.client || data);
      setLegacyCrmClientId(data.legacyCrmClientId || data.client?.legacyCrmClientId || data.legacyCrmClient?._id || null);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setDockets(Array.isArray(data.dockets) ? data.dockets : []);
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setSummary(data.summary || {});
    } catch (loadError) {
      const message = resolveCrmErrorMessage(loadError, 'Unable to load CRM client detail right now.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [crmClientId, showError]);

  useEffect(() => { void loadData(); }, [loadData]);

  const clientName = client?.businessName || client?.name || crmClientId;
  const clientTags = Array.isArray(client?.tags) ? client.tags : [];

  const stats = useMemo(() => {
    const pendingDockets = dockets.filter((item) => !CLOSED_DOCKET_STATUSES.has(String(item.status || '').toUpperCase())).length;
    return [
      { label: 'Total deals', value: summary.totalDeals ?? deals.length },
      { label: 'Active deals', value: summary.activeDeals ?? deals.filter((item) => item.stage !== 'completed').length },
      { label: 'Total revenue', value: formatINR(summary.totalRevenue ?? 0) },
      { label: 'Unpaid revenue', value: formatINR(summary.unpaidRevenue ?? 0) },
      { label: 'Total dockets', value: summary.totalDockets ?? dockets.length },
      { label: 'Pending dockets', value: summary.pendingDockets ?? pendingDockets },
    ];
  }, [deals, dockets, summary]);

  const handleCreateDeal = async (event) => {
    event.preventDefault();
    if (savingDeal) return;
    if (!dealForm.title.trim()) {
      showError('Deal title is required.');
      return;
    }
    if (dealForm.value && (!Number.isFinite(Number(dealForm.value)) || Number(dealForm.value) < 0)) {
      showError('Deal value must be a valid non-negative number.');
      return;
    }
    setSavingDeal(true);
    try {
      await crmApi.createDeal({
        clientId: legacyCrmClientId || client?._id || crmClientId,
        title: dealForm.title.trim(),
        value: dealForm.value ? Number(dealForm.value) : undefined,
        stage: dealForm.stage,
      });
      showSuccess('Deal created successfully.');
      setShowDealModal(false);
      setDealForm({ title: '', value: '', stage: 'new' });
      await loadData();
    } catch (createError) {
      showError(resolveCrmErrorMessage(createError, 'Failed to create deal.'));
    } finally {
      setSavingDeal(false);
    }
  };

  const handleCreateInvoice = async (event) => {
    event.preventDefault();
    if (savingInvoice) return;
    if (!invoiceForm.amount || !Number.isFinite(Number(invoiceForm.amount)) || Number(invoiceForm.amount) < 0) {
      showError('Invoice amount must be a valid non-negative number.');
      return;
    }
    setSavingInvoice(true);
    try {
      await crmApi.createInvoice({
        clientId: legacyCrmClientId || client?._id || crmClientId,
        amount: Number(invoiceForm.amount),
        dealId: invoiceForm.dealId || undefined,
      });
      showSuccess('Invoice created successfully.');
      setShowInvoiceModal(false);
      setInvoiceForm({ amount: '', dealId: '' });
      await loadData();
    } catch (createError) {
      showError(resolveCrmErrorMessage(createError, 'Failed to create invoice.'));
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    if (!invoiceId || markingPaidId) return;
    setMarkingPaidId(invoiceId);
    try {
      await crmApi.markInvoicePaid(invoiceId);
      setInvoices((current) => current.map((item) => {
        const id = item._id || item.id;
        if (id !== invoiceId) return item;
        return { ...item, status: 'paid', paidAt: new Date().toISOString() };
      }));
      setSummary((current) => {
        const targetInvoice = invoices.find((item) => (item._id || item.id) === invoiceId);
        const amount = Number(targetInvoice?.amount || 0);
        return {
          ...current,
          totalRevenue: Number(current.totalRevenue || 0) + amount,
          unpaidRevenue: Math.max(0, Number(current.unpaidRevenue || 0) - amount),
        };
      });
      showSuccess('Invoice marked as paid.');
    } catch (markError) {
      showError(resolveCrmErrorMessage(markError, 'Failed to mark invoice as paid.'));
    } finally {
      setMarkingPaidId(null);
    }
  };

  const dealsRows = deals.map((deal) => (
    <tr key={deal._id || deal.id}>
      <td>{deal.title || '—'}</td>
      <td><Badge status={DEAL_STAGE_STATUS[deal.stage] || 'Draft'}>{DEAL_STAGE_LABEL[deal.stage] || deal.stage}</Badge></td>
      <td>{deal.value != null ? formatINR(deal.value) : '—'}</td>
      <td>{formatDate(deal.createdAt)}</td>
    </tr>
  ));

  const docketsRows = dockets.map((docket) => (
    <tr
      key={docket._id || docket.caseId}
      className="cursor-pointer"
      onClick={() => navigate(safeRoute(ROUTES.CASE_DETAIL(firmSlug, docket._id || docket.caseId)))}
    >
      <td>{docket.caseNumber || docket.caseId || '—'}</td>
      <td>{docket.title || docket.category || '—'}</td>
      <td><Badge status={docket.status}>{docket.status || '—'}</Badge></td>
      <td>{docket.assignedTo || '—'}</td>
      <td>{docket.dueDate ? formatDate(docket.dueDate) : '—'}</td>
    </tr>
  ));

  const invoicesRows = invoices.map((invoice) => (
    <tr key={invoice._id || invoice.id}>
      <td>{formatINR(invoice.amount)}</td>
      <td><Badge status={INVOICE_STATUS_MAP[invoice.status] || 'Draft'}>{INVOICE_STATUS_LABEL[invoice.status] || invoice.status}</Badge></td>
      <td>{invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}</td>
      <td>{invoice.paidAt ? formatDate(invoice.paidAt) : '—'}</td>
      <td>
        {isAdmin && invoice.status === 'unpaid' ? (
          <Button
            variant="outline"
            onClick={() => handleMarkPaid(invoice._id || invoice.id)}
            loading={markingPaidId === (invoice._id || invoice.id)}
            disabled={markingPaidId === (invoice._id || invoice.id)}
          >
            Mark Paid
          </Button>
        ) : '—'}
      </td>
    </tr>
  ));

  return (
    <PlatformShell moduleLabel="CRM" title={clientName} subtitle="Client profile, deals, invoices, and linked dockets in one CRM workspace.">
      <InlineNotice tone="error" message={error} />

      <PageSection title="Client header" description="Context and quick navigation.">
        <div className="action-row">
          <Button variant="outline" onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENTS(firmSlug)))}>Back to Client Management</Button>
          {client?.crmType ? <Badge status={client.crmType === 'company' ? 'Approved' : 'Pending'}>{client.crmType === 'company' ? 'Company' : 'Individual'}</Badge> : null}
          {clientTags.map((tag) => <Badge key={tag} status="Draft">{tag}</Badge>)}
        </div>
        {(client?.businessEmail || client?.email || client?.primaryContactNumber || client?.phone) ? (
          <p className="muted mt-2">{client.businessEmail || client.email || '—'} · {client.primaryContactNumber || client.phone || '—'}</p>
        ) : null}
      </PageSection>

      <StatGrid items={stats} />

      <PageSection
        title="Commercial context"
        description="Switch between deals, dockets, and invoices."
        actions={(
          <div className="action-row">
            <Button variant={activeTab === 'deals' ? 'primary' : 'outline'} onClick={() => setActiveTab('deals')}>Deals</Button>
            <Button variant={activeTab === 'dockets' ? 'primary' : 'outline'} onClick={() => setActiveTab('dockets')}>Dockets</Button>
            <Button variant={activeTab === 'invoices' ? 'primary' : 'outline'} onClick={() => setActiveTab('invoices')}>Invoices</Button>
          </div>
        )}
      >
        {activeTab === 'deals' ? (
          <>
            {isAdmin ? <div className="mb-3"><Button onClick={() => setShowDealModal(true)}>Add Deal</Button></div> : null}
            <DataTable columns={['Title', 'Stage', 'Value', 'Created']} rows={dealsRows} loading={loading} error={error} onRetry={() => void loadData()} emptyLabel="No deals yet." />
          </>
        ) : null}

        {activeTab === 'dockets' ? (
          <DataTable columns={['Docket', 'Title', 'Status', 'Assigned', 'Due']} rows={docketsRows} loading={loading} error={error} onRetry={() => void loadData()} emptyLabel="No linked dockets yet." />
        ) : null}

        {activeTab === 'invoices' ? (
          <>
            {isAdmin ? <div className="mb-3"><Button onClick={() => setShowInvoiceModal(true)}>Add Invoice</Button></div> : null}
            <DataTable columns={['Amount', 'Status', 'Issued', 'Paid At', 'Actions']} rows={invoicesRows} loading={loading} error={error} onRetry={() => void loadData()} emptyLabel="No invoices yet." />
          </>
        ) : null}
      </PageSection>

      <Modal isOpen={showDealModal} onClose={() => setShowDealModal(false)} title="Add Deal" maxWidth="lg">
        <form onSubmit={handleCreateDeal} className="grid gap-4">
          <Input label="Title" value={dealForm.title} onChange={(event) => setDealForm((prev) => ({ ...prev, title: event.target.value }))} required />
          <Input label="Value (₹)" type="number" value={dealForm.value} onChange={(event) => setDealForm((prev) => ({ ...prev, value: event.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="deal-stage">Stage</label>
            <select id="deal-stage" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={dealForm.stage} onChange={(event) => setDealForm((prev) => ({ ...prev, stage: event.target.value }))}>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDealModal(false)}>Cancel</Button>
            <Button type="submit" loading={savingDeal} disabled={savingDeal}>Create Deal</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Add Invoice" maxWidth="lg">
        <form onSubmit={handleCreateInvoice} className="grid gap-4">
          <Input label="Amount (₹)" type="number" value={invoiceForm.amount} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, amount: event.target.value }))} required />
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="invoice-deal">Link to Deal (optional)</label>
            <select id="invoice-deal" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={invoiceForm.dealId} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dealId: event.target.value }))}>
              <option value="">— None —</option>
              {deals.map((deal) => <option key={deal._id || deal.id} value={deal._id || deal.id}>{deal.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button type="submit" loading={savingInvoice} disabled={savingInvoice}>Create Invoice</Button>
          </div>
        </form>
      </Modal>
    </PlatformShell>
  );
};
