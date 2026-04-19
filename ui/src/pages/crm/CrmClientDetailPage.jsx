import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { crmApi } from '../../api/crm.api';
import { formatDate } from '../../utils/formatters';
import { ROUTES, safeRoute } from '../../constants/routes';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount ?? 0);

const DEAL_STAGE_STATUS = { new: 'Pending', in_progress: 'Pending', completed: 'Approved' };
const DEAL_STAGE_LABEL = { new: 'New', in_progress: 'In Progress', completed: 'Completed' };

const INVOICE_STATUS_MAP = { unpaid: 'Rejected', paid: 'Approved' };
const INVOICE_STATUS_LABEL = { unpaid: 'Unpaid', paid: 'Paid' };

const CLOSED_DOCKET_STATUSES = new Set(['CLOSED', 'APPROVED', 'FILED', 'RESOLVED']);
const getPendingDocketsCount = (dockets) =>
  dockets.filter((d) => !CLOSED_DOCKET_STATUSES.has(String(d.status || '').toUpperCase())).length;

export const CrmClientDetailPage = () => {
  const { firmSlug, crmClientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [dockets, setDockets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({});
  const [legacyCrmClientId, setLegacyCrmClientId] = useState(null);
  const [activeTab, setActiveTab] = useState('deals');

  // Deal modal state
  const [showDealModal, setShowDealModal] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'new' });

  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', dealId: '' });
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.getClientById(crmClientId);
      const data = response?.data || {};
      setClient(data.client || data);
      setLegacyCrmClientId(data.legacyCrmClientId || data.client?.legacyCrmClientId || data.legacyCrmClient?._id || null);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setDockets(Array.isArray(data.dockets) ? data.dockets : []);
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setSummary(data.summary || {});
    } catch (error) {
      showError(error?.message || 'Failed to load CRM client details');
    } finally {
      setLoading(false);
    }
  }, [crmClientId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDeal = async (event) => {
    event.preventDefault();
    setSavingDeal(true);
    try {
      await crmApi.createDeal({
        clientId: legacyCrmClientId || client?._id || crmClientId,
        title: dealForm.title.trim(),
        value: dealForm.value ? Number(dealForm.value) : undefined,
        stage: dealForm.stage,
      });
      showSuccess('Deal created successfully');
      setShowDealModal(false);
      setDealForm({ title: '', value: '', stage: 'new' });
      loadData();
    } catch (error) {
      showError(error?.message || 'Failed to create deal');
    } finally {
      setSavingDeal(false);
    }
  };

  const handleCreateInvoice = async (event) => {
    event.preventDefault();
    setSavingInvoice(true);
    try {
      await crmApi.createInvoice({
        clientId: legacyCrmClientId || client?._id || crmClientId,
        amount: Number(invoiceForm.amount),
        dealId: invoiceForm.dealId || undefined,
      });
      showSuccess('Invoice created successfully');
      setShowInvoiceModal(false);
      setInvoiceForm({ amount: '', dealId: '' });
      loadData();
    } catch (error) {
      showError(error?.message || 'Failed to create invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    setMarkingPaidId(invoiceId);
    try {
      await crmApi.markInvoicePaid(invoiceId);
      showSuccess('Invoice marked as paid');
      loadData();
    } catch (error) {
      showError(error?.message || 'Failed to mark invoice as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  if (loading) {
    return (
      <PlatformShell moduleLabel="Operations" title="CRM client detail" subtitle="Loading client account, deals, invoices, and docket context.">
        <Loading message="Loading client profile..." />
      </PlatformShell>
    );
  }

  const clientName = client?.businessName || client?.name || crmClientId;
  const clientTags = Array.isArray(client?.tags) ? client.tags : [];

  return (
    <PlatformShell moduleLabel="Operations" title={clientName} subtitle="Unified CRM client detail with linked commercial and docket context.">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Button
          variant="outline"
          onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENTS(firmSlug)))}
          style={{ marginBottom: '0.75rem' }}
        >
          ← Back to CRM Clients
        </Button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 className="neo-page__title" style={{ margin: 0 }}>{clientName}</h1>
          {client?.crmType && (
            <Badge status={client.crmType === 'company' ? 'Approved' : 'Pending'}>
              {client.crmType === 'company' ? 'Company' : 'Individual'}
            </Badge>
          )}
          {clientTags.map((tag) => (
            <Badge key={tag} status="Draft">{tag}</Badge>
          ))}
        </div>
        {(client?.businessEmail || client?.email || client?.primaryContactNumber || client?.phone) && (
          <div style={{ color: '#6b7280', marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
            {(client.businessEmail || client.email) && <span>✉ {client.businessEmail || client.email}</span>}
            {(client.primaryContactNumber || client.phone) && <span>📞 {client.primaryContactNumber || client.phone}</span>}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Deals', value: summary.totalDeals ?? deals.length },
          { label: 'Active Deals', value: summary.activeDeals ?? deals.filter((d) => d.stage !== 'completed').length },
          { label: 'Total Revenue', value: formatINR(summary.totalRevenue ?? 0) },
          { label: 'Unpaid Revenue', value: formatINR(summary.unpaidRevenue ?? 0) },
          { label: 'Total Dockets', value: summary.totalDockets ?? dockets.length },
          { label: 'Pending Dockets', value: summary.pendingDockets ?? getPendingDocketsCount(dockets) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { key: 'deals', label: 'Deals' },
          { key: 'dockets', label: 'Dockets' },
          { key: 'invoices', label: 'Invoices' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn ${activeTab === tab.key ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deals Tab */}
      {activeTab === 'deals' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Deals</h2>
            {isAdmin && (
              <Button onClick={() => setShowDealModal(true)}>+ Add Deal</Button>
            )}
          </div>
          {deals.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No deals yet.</p>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal._id || deal.id}>
                    <td>{deal.title}</td>
                    <td>
                      <Badge status={DEAL_STAGE_STATUS[deal.stage] || 'Draft'}>
                        {DEAL_STAGE_LABEL[deal.stage] || deal.stage}
                      </Badge>
                    </td>
                    <td>{deal.value != null ? formatINR(deal.value) : '—'}</td>
                    <td>{formatDate(deal.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Dockets Tab */}
      {activeTab === 'dockets' && (
        <Card>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Linked Dockets</h2>
          {dockets.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No linked dockets.</p>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case Number</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {dockets.map((docket) => (
                  <tr
                    key={docket._id || docket.caseId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(safeRoute(ROUTES.CASE_DETAIL(firmSlug, docket._id || docket.caseId)))}
                  >
                    <td>{docket.caseNumber || docket.caseId || '—'}</td>
                    <td>{docket.title || docket.category || '—'}</td>
                    <td>
                      <Badge status={docket.status}>{docket.status || '—'}</Badge>
                    </td>
                    <td>{docket.assignedTo || '—'}</td>
                    <td>{docket.dueDate ? formatDate(docket.dueDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Invoices</h2>
            {isAdmin && (
              <Button onClick={() => setShowInvoiceModal(true)}>+ Add Invoice</Button>
            )}
          </div>
          {invoices.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No invoices yet.</p>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Paid At</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id || invoice.id}>
                    <td>{formatINR(invoice.amount)}</td>
                    <td>
                      <Badge status={INVOICE_STATUS_MAP[invoice.status] || 'Draft'}>
                        {INVOICE_STATUS_LABEL[invoice.status] || invoice.status}
                      </Badge>
                    </td>
                    <td>{invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}</td>
                    <td>{invoice.paidAt ? formatDate(invoice.paidAt) : '—'}</td>
                    {isAdmin && (
                      <td>
                        {invoice.status === 'unpaid' && (
                          <Button
                            variant="outline"
                            onClick={() => handleMarkPaid(invoice._id || invoice.id)}
                            disabled={markingPaidId === (invoice._id || invoice.id)}
                          >
                            {markingPaidId === (invoice._id || invoice.id) ? 'Marking…' : 'Mark Paid'}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Deal Modal */}
      <Modal
        isOpen={showDealModal}
        onClose={() => { setShowDealModal(false); setDealForm({ title: '', value: '', stage: 'new' }); }}
        title="Add New Deal"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateDeal} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Title"
            value={dealForm.title}
            onChange={(e) => setDealForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
          <Input
            label="Value (₹)"
            type="number"
            value={dealForm.value}
            onChange={(e) => setDealForm((prev) => ({ ...prev, value: e.target.value }))}
            placeholder="e.g. 15000"
          />
          <div>
            <label className="neo-label" htmlFor="deal-stage">Stage</label>
            <select
              id="deal-stage"
              className="neo-input"
              value={dealForm.stage}
              onChange={(e) => setDealForm((prev) => ({ ...prev, stage: e.target.value }))}
            >
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={() => { setShowDealModal(false); setDealForm({ title: '', value: '', stage: 'new' }); }}>Cancel</Button>
            <Button type="submit" disabled={savingDeal}>{savingDeal ? 'Saving…' : 'Create Deal'}</Button>
          </div>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => { setShowInvoiceModal(false); setInvoiceForm({ amount: '', dealId: '' }); }}
        title="Add New Invoice"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateInvoice} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Amount (₹)"
            type="number"
            value={invoiceForm.amount}
            onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
            placeholder="e.g. 15000"
          />
          <div>
            <label className="neo-label" htmlFor="invoice-deal">Link to Deal (optional)</label>
            <select
              id="invoice-deal"
              className="neo-input"
              value={invoiceForm.dealId}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dealId: e.target.value }))}
            >
              <option value="">— None —</option>
              {deals.map((deal) => (
                <option key={deal._id || deal.id} value={deal._id || deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={() => { setShowInvoiceModal(false); setInvoiceForm({ amount: '', dealId: '' }); }}>Cancel</Button>
            <Button type="submit" disabled={savingInvoice}>{savingInvoice ? 'Saving…' : 'Create Invoice'}</Button>
          </div>
        </form>
      </Modal>
    </PlatformShell>
  );
};
