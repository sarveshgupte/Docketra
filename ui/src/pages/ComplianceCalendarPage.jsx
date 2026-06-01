import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/common/Button';
import { dashboardApi } from '../api/dashboard.api';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/formatters';
import { ROUTES } from '../constants/routes';
import { hasFirmRoleAtLeast } from '../utils/roleHierarchy';
import './ComplianceCalendarPage.css';

const COMPLIANCE_STATES = [
  'not_started',
  'in_progress',
  'awaiting_client',
  'awaiting_partner',
  'ready_to_file',
  'filed',
  'blocked',
  'closed',
];

const riskOptions = ['low', 'medium', 'high', 'critical'];
const APPROVAL_VIEWS = [
  { key: 'my_approvals', label: 'My approvals' },
  { key: 'awaiting_partner', label: 'Awaiting partner' },
  { key: 'awaiting_client_signatory', label: 'Awaiting client/signatory' },
  { key: 'overdue', label: 'Overdue approvals' },
];
const EXCEPTION_TYPE_OPTIONS = [
  { key: 'portal_issue', label: 'Portal issue' },
  { key: 'DSC_authorisation_pending', label: 'DSC/signatory pending' },
  { key: 'client_delay', label: 'Client delay' },
  { key: 'query_raised', label: 'Query raised' },
  { key: 'other', label: 'Other' },
];

const toLabel = (value) => String(value || '')
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const normalizeDueRisk = (dueRisk) => {
  if (dueRisk === 'overdue') return 'overdue';
  if (dueRisk === 'due_soon') return 'due-soon';
  return 'on-track';
};

const riskChipClass = (riskLevel) => `compliance-chip compliance-chip--risk-${String(riskLevel || 'medium').toLowerCase()}`;
const statusChipClass = (state) => `compliance-chip compliance-chip--state-${String(state || '').toLowerCase().replaceAll('_', '-')}`;
const dueChipClass = (dueRisk) => `compliance-chip compliance-chip--due-${normalizeDueRisk(dueRisk)}`;

const defaultFilters = {
  assigneeXID: '',
  clientId: '',
  obligationType: '',
  state: '',
  dueFrom: '',
  dueTo: '',
  riskLevel: '',
  approverXID: '',
  exceptionType: '',
  useDemo: 'false',
};

export const ComplianceCalendarPage = () => {
  const { user } = useAuth();
  const { firmSlug } = useParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [summary, setSummary] = useState({
    dueThisWeek: 0,
    overdue: 0,
    awaitingClient: 0,
    awaitingPartner: 0,
    readyToFile: 0,
    blocked: 0,
    filedRecently: 0,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCaseId, setSavingCaseId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [generationRangeStart, setGenerationRangeStart] = useState('');
  const [generationRangeEnd, setGenerationRangeEnd] = useState('');
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationSummary, setGenerationSummary] = useState({ generated: 0, skippedDuplicate: 0, failed: 0, totalCandidates: 0 });
  const [generationRows, setGenerationRows] = useState([]);
  const [approvalView, setApprovalView] = useState('my_approvals');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalSummary, setApprovalSummary] = useState({
    myApprovals: 0,
    awaitingPartner: 0,
    awaitingClientSignatory: 0,
    overdueApprovals: 0,
  });
  const [approvalRows, setApprovalRows] = useState([]);
  const [morningLoading, setMorningLoading] = useState(false);
  const [morningSummary, setMorningSummary] = useState({
    atRiskEntities: 0,
    clientsBlocking: 0,
    filingsAwaitingApproval: 0,
    overloadedTeamMembers: 0,
    exceptionBlockedFilings: 0,
  });
  const [morningSections, setMorningSections] = useState({
    atRiskEntities: [],
    clientBlockers: [],
    approvalBlockers: [],
    teamLoad: [],
    exceptions: [],
  });
  const canManageState = hasFirmRoleAtLeast(user, 'MANAGER');

  const loadControlRoom = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardApi.getComplianceControlRoom(filters);
      const payload = response?.data || {};
      setSummary(payload.summary || {});
      setRows(Array.isArray(payload.items) ? payload.items : []);
    } catch (apiError) {
      setError(apiError?.message || 'Failed to load compliance control room');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadControlRoom();
  }, [loadControlRoom]);

  const loadTemplates = useCallback(async () => {
    if (!canManageState) return;
    setLoadingTemplates(true);
    try {
      const response = await dashboardApi.listComplianceTemplates();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setTemplates(rows);
      if (!selectedTemplateIds.length) {
        setSelectedTemplateIds(rows.filter((item) => item?.isActive !== false).map((item) => item._id));
      }
    } catch (apiError) {
      setError(apiError?.message || 'Failed to load compliance templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [canManageState, selectedTemplateIds.length]);

  useEffect(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
    setGenerationRangeStart(start.toISOString().slice(0, 10));
    setGenerationRangeEnd(end.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const loadPartnerMorning = useCallback(async () => {
    if (!canManageState) return;
    setMorningLoading(true);
    try {
      const response = await dashboardApi.getPartnerMorningDashboard({
        assigneeXID: filters.assigneeXID,
        clientId: filters.clientId,
        obligationType: filters.obligationType,
        state: filters.state,
        dueFrom: filters.dueFrom,
        dueTo: filters.dueTo,
        riskLevel: filters.riskLevel,
        approverXID: filters.approverXID,
        exceptionType: filters.exceptionType,
      });
      const payload = response?.data || {};
      setMorningSummary(payload.summary || {
        atRiskEntities: 0,
        clientsBlocking: 0,
        filingsAwaitingApproval: 0,
        overloadedTeamMembers: 0,
        exceptionBlockedFilings: 0,
      });
      setMorningSections(payload.sections || {
        atRiskEntities: [],
        clientBlockers: [],
        approvalBlockers: [],
        teamLoad: [],
        exceptions: [],
      });
    } catch (apiError) {
      setError(apiError?.message || 'Failed to load partner morning dashboard');
      setMorningSections({
        atRiskEntities: [],
        clientBlockers: [],
        approvalBlockers: [],
        teamLoad: [],
        exceptions: [],
      });
    } finally {
      setMorningLoading(false);
    }
  }, [canManageState, filters]);

  useEffect(() => {
    loadPartnerMorning();
  }, [loadPartnerMorning]);

  const loadApprovalQueues = useCallback(async (selectedView = approvalView) => {
    if (!canManageState) return;
    setApprovalLoading(true);
    try {
      const response = await dashboardApi.getApprovalQueues({ view: selectedView });
      const payload = response?.data || {};
      setApprovalSummary(payload.summary || {});
      setApprovalRows(Array.isArray(payload.items) ? payload.items : []);
    } catch (apiError) {
      setError(apiError?.message || 'Failed to load approval queues');
      setApprovalRows([]);
    } finally {
      setApprovalLoading(false);
    }
  }, [approvalView, canManageState]);

  useEffect(() => {
    loadApprovalQueues(approvalView);
  }, [approvalView, loadApprovalQueues]);

  const statCards = useMemo(() => ([
    { label: 'Due This Week', value: Number(summary.dueThisWeek || 0) },
    { label: 'Overdue', value: Number(summary.overdue || 0) },
    { label: 'Awaiting Client', value: Number(summary.awaitingClient || 0) },
    { label: 'Awaiting Partner', value: Number(summary.awaitingPartner || 0) },
    { label: 'Ready To File', value: Number(summary.readyToFile || 0) },
    { label: 'Blocked', value: Number(summary.blocked || 0) },
    { label: 'Filed Recently', value: Number(summary.filedRecently || 0) },
  ]), [summary]);

  const handleStateChange = async (caseId, nextState) => {
    if (!canManageState || !nextState) return;
    setSavingCaseId(caseId);
    setError('');
    try {
      await dashboardApi.updateComplianceState(caseId, { nextState });
      await loadControlRoom();
    } catch (apiError) {
      setError(apiError?.message || 'Failed to update compliance state');
    } finally {
      setSavingCaseId('');
    }
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const runGeneration = async (mode) => {
    if (!canManageState) return;
    setGenerationLoading(true);
    setError('');
    try {
      const payload = {
        rangeStart: generationRangeStart,
        rangeEnd: generationRangeEnd,
        templateIds: selectedTemplateIds,
      };
      const response = mode === 'preview'
        ? await dashboardApi.previewComplianceGeneration(payload)
        : await dashboardApi.runComplianceGeneration(payload);
      const data = response?.data || {};
      setGenerationSummary(data.summary || { generated: 0, skippedDuplicate: 0, failed: 0, totalCandidates: 0 });
      setGenerationRows(Array.isArray(data.items) ? data.items : []);
      if (mode === 'run') {
        await loadControlRoom();
      }
    } catch (apiError) {
      setError(apiError?.message || `Failed to ${mode} compliance generation`);
    } finally {
      setGenerationLoading(false);
    }
  };

  const handleSeedSamples = async () => {
    if (!canManageState) return;
    setGenerationLoading(true);
    setError('');
    try {
      await dashboardApi.seedSampleComplianceTemplates();
      await loadTemplates();
    } catch (apiError) {
      setError(apiError?.message || 'Failed to seed sample templates');
    } finally {
      setGenerationLoading(false);
    }
  };

  const handleReminder = async (caseId, escalate = false) => {
    try {
      await dashboardApi.remindApproval(caseId, { escalate });
      loadApprovalQueues(approvalView);
      loadPartnerMorning();
    } catch (apiError) {
      setError(apiError?.message || 'Failed to queue reminder');
    }
  };

  const applyAllFilters = async () => {
    await Promise.all([loadControlRoom(), loadPartnerMorning(), loadApprovalQueues(approvalView)]);
  };

  const renderDocketLink = (caseId, label = null) => {
    if (!caseId || !firmSlug) return label || caseId || '—';
    return <Link to={ROUTES.CASE_DETAIL(firmSlug, caseId)} className="compliance-inline-link">{label || caseId}</Link>;
  };

  const renderClientLink = (clientId, label = null) => {
    if (!clientId || !firmSlug) return label || clientId || '—';
    return <Link to={ROUTES.CLIENT_WORKSPACE(firmSlug, clientId)} className="compliance-inline-link">{label || clientId}</Link>;
  };

  return (
    <PlatformShell
      moduleLabel="Daily Operations"
      title="Compliance Control Room"
      subtitle="Operational control center for filing status, due dates, blockers, and partner approvals."
    >
      <div className="compliance-calendar-page">
        <PageHeader
          title="Compliance Control Room"
          description="One screen to monitor due, overdue, blocked, awaiting client/partner, ready-to-file, filed, and closed entities."
        />

        {error ? <p className="compliance-calendar-page__error">{error}</p> : null}

        {canManageState ? (
          <section className="compliance-generation-panel">
            <div className="compliance-generation-panel__header">
              <h2>Partner Morning Dashboard</h2>
              <p>Daily command table for risk entities, client blockers, approval blockers, team overload, and exceptions.</p>
            </div>
            <div className="compliance-generation-badges">
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">At-risk entities</p>
                <p className="compliance-control-summary-card__value">{morningLoading ? '…' : Number(morningSummary.atRiskEntities || 0)}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Client blockers</p>
                <p className="compliance-control-summary-card__value">{morningLoading ? '…' : Number(morningSummary.clientsBlocking || 0)}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Awaiting approval</p>
                <p className="compliance-control-summary-card__value">{morningLoading ? '…' : Number(morningSummary.filingsAwaitingApproval || 0)}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Overloaded team</p>
                <p className="compliance-control-summary-card__value">{morningLoading ? '…' : Number(morningSummary.overloadedTeamMembers || 0)}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Exceptions</p>
                <p className="compliance-control-summary-card__value">{morningLoading ? '…' : Number(morningSummary.exceptionBlockedFilings || 0)}</p>
              </article>
            </div>

            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table compliance-control-table--morning">
                <thead>
                  <tr>
                    <th colSpan={9}>At-risk entities (overdue/due soon + high risk/priority)</th>
                  </tr>
                  <tr>
                    <th>Docket</th>
                    <th>Client/Entity</th>
                    <th>Obligation</th>
                    <th>Owner</th>
                    <th>State</th>
                    <th>Due</th>
                    <th>Due Risk</th>
                    <th>Risk</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {!morningSections.atRiskEntities?.length ? (
                    <tr><td colSpan={9}>No at-risk entities for current filters.</td></tr>
                  ) : morningSections.atRiskEntities.map((row) => (
                    <tr key={`risk-${row.caseId}`}>
                      <td>{renderDocketLink(row.caseId)}</td>
                      <td>{renderClientLink(row.clientId, row.clientName || row.entityName || row.clientId)}</td>
                      <td>{row.obligationType || '—'} {row.obligationPeriod ? `(${row.obligationPeriod})` : ''}</td>
                      <td>{row.assignedToXID || 'UNASSIGNED'}</td>
                      <td><span className={statusChipClass(row.complianceState)}>{toLabel(row.complianceState)}</span></td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td><span className={dueChipClass(row.dueRisk)}>{toLabel(row.dueRisk)}</span></td>
                      <td><span className={riskChipClass(row.riskLevel)}>{toLabel(row.riskLevel)}</span></td>
                      <td>{toLabel(row.priority)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table compliance-control-table--morning">
                <thead>
                  <tr>
                    <th colSpan={6}>Client blockers (awaiting client, grouped by client/entity and ageing)</th>
                  </tr>
                  <tr>
                    <th>Client/Entity</th>
                    <th>Awaiting</th>
                    <th>Overdue</th>
                    <th>Max Age (days)</th>
                    <th>Sample Dockets</th>
                    <th>Drill-down</th>
                  </tr>
                </thead>
                <tbody>
                  {!morningSections.clientBlockers?.length ? (
                    <tr><td colSpan={6}>No client blockers for current filters.</td></tr>
                  ) : morningSections.clientBlockers.map((group) => (
                    <tr key={`client-blocker-${group.clientId || group.entityName}`}>
                      <td>{renderClientLink(group.clientId, group.clientName || group.entityName || group.clientId || 'Unknown')}</td>
                      <td>{group.docketCount || 0}</td>
                      <td>{group.overdueCount || 0}</td>
                      <td>{group.maxAgeDays || 0}</td>
                      <td>
                        <div className="compliance-mini-list">
                          {(group.dockets || []).map((item) => (
                            <div key={`${group.clientId}-${item.caseId}`}>{renderDocketLink(item.caseId, item.caseId)} · {item.obligationType || 'Obligation'} · <span className={dueChipClass(item.dueRisk)}>{toLabel(item.dueRisk)}</span></div>
                          ))}
                        </div>
                      </td>
                      <td>{group.clientId ? renderClientLink(group.clientId, 'Open client workspace') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table compliance-control-table--morning">
                <thead>
                  <tr>
                    <th colSpan={7}>Approval blockers (awaiting partner/client/signatory grouped by approver and ageing)</th>
                  </tr>
                  <tr>
                    <th>Approver</th>
                    <th>Pending</th>
                    <th>Overdue</th>
                    <th>Max Age (days)</th>
                    <th>Awaiting Partner</th>
                    <th>Awaiting Client/Signatory</th>
                    <th>Sample Dockets</th>
                  </tr>
                </thead>
                <tbody>
                  {!morningSections.approvalBlockers?.length ? (
                    <tr><td colSpan={7}>No approval blockers for current filters.</td></tr>
                  ) : morningSections.approvalBlockers.map((group) => (
                    <tr key={`approval-blocker-${group.approver}`}>
                      <td>{group.approver || 'UNASSIGNED_APPROVER'}</td>
                      <td>{group.docketCount || 0}</td>
                      <td>{group.overdueCount || 0}</td>
                      <td>{group.maxAgeDays || 0}</td>
                      <td>{group.awaitingPartnerCount || 0}</td>
                      <td>{group.awaitingClientSignatoryCount || 0}</td>
                      <td>
                        <div className="compliance-mini-list">
                          {(group.dockets || []).map((item) => (
                            <div key={`${group.approver}-${item.caseId}`}>{renderDocketLink(item.caseId, item.caseId)} · {toLabel(item.approvalType)} · {item.ageDays || 0}d</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table compliance-control-table--morning">
                <thead>
                  <tr>
                    <th colSpan={8}>Team load (open, due this week, overdue, blocked, awaiting external input)</th>
                  </tr>
                  <tr>
                    <th>Assignee</th>
                    <th>Open</th>
                    <th>Due This Week</th>
                    <th>Overdue</th>
                    <th>Blocked</th>
                    <th>Awaiting External Input</th>
                    <th>High Risk Open</th>
                    <th>Load</th>
                  </tr>
                </thead>
                <tbody>
                  {!morningSections.teamLoad?.length ? (
                    <tr><td colSpan={8}>No team load rows for current filters.</td></tr>
                  ) : morningSections.teamLoad.map((row) => (
                    <tr key={`team-load-${row.assigneeXID}`}>
                      <td>{row.assigneeXID || 'UNASSIGNED'}</td>
                      <td>{row.openDockets || 0}</td>
                      <td>{row.dueThisWeek || 0}</td>
                      <td>{row.overdue || 0}</td>
                      <td>{row.blocked || 0}</td>
                      <td>{row.awaitingExternalInput || 0}</td>
                      <td>{row.highRiskOpen || 0}</td>
                      <td><span className={`compliance-chip ${row.overloaded ? 'compliance-chip--load-overloaded' : 'compliance-chip--load-balanced'}`}>{row.overloaded ? 'Overloaded' : 'Balanced'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table compliance-control-table--morning">
                <thead>
                  <tr>
                    <th colSpan={6}>Exceptions (portal/client/DSC/signatory/query taxonomy)</th>
                  </tr>
                  <tr>
                    <th>Reason</th>
                    <th>Blocked Filings</th>
                    <th>Overdue</th>
                    <th>Max Age (days)</th>
                    <th>Sample Dockets</th>
                    <th>Drill-down</th>
                  </tr>
                </thead>
                <tbody>
                  {!morningSections.exceptions?.length ? (
                    <tr><td colSpan={6}>No exceptions for current filters.</td></tr>
                  ) : morningSections.exceptions.map((group) => (
                    <tr key={`exception-${group.reason}`}>
                      <td><span className="compliance-chip compliance-chip--exception">{toLabel(group.reason)}</span></td>
                      <td>{group.docketCount || 0}</td>
                      <td>{group.overdueCount || 0}</td>
                      <td>{group.maxAgeDays || 0}</td>
                      <td>
                        <div className="compliance-mini-list">
                          {(group.dockets || []).map((item) => (
                            <div key={`${group.reason}-${item.caseId}`}>{renderDocketLink(item.caseId, item.caseId)} · {item.blockedReason || toLabel(item.blockerType || 'other')}</div>
                          ))}
                        </div>
                      </td>
                      <td>
                        {(group.dockets || []).length ? renderDocketLink(group.dockets[0].caseId, 'Open first docket') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="compliance-control-summary-grid">
          {statCards.map((card) => (
            <article className="compliance-control-summary-card" key={card.label}>
              <p className="compliance-control-summary-card__label">{card.label}</p>
              <p className="compliance-control-summary-card__value">{loading ? '…' : card.value}</p>
            </article>
          ))}
        </section>

        <section className="compliance-control-filters">
          <div className="compliance-control-filter-row">
            <input
              value={filters.assigneeXID}
              onChange={(event) => updateFilter('assigneeXID', event.target.value)}
              placeholder="Assignee XID (e.g. X000123)"
            />
            <input
              value={filters.clientId}
              onChange={(event) => updateFilter('clientId', event.target.value)}
              placeholder="Client / Entity ID"
            />
            <input
              value={filters.obligationType}
              onChange={(event) => updateFilter('obligationType', event.target.value)}
              placeholder="Obligation type (GST / ROC / TDS)"
            />
            <select value={filters.state} onChange={(event) => updateFilter('state', event.target.value)}>
              <option value="">All states</option>
              {COMPLIANCE_STATES.map((state) => <option key={state} value={state}>{toLabel(state)}</option>)}
            </select>
          </div>
          <div className="compliance-control-filter-row">
            <input type="date" value={filters.dueFrom} onChange={(event) => updateFilter('dueFrom', event.target.value)} />
            <input type="date" value={filters.dueTo} onChange={(event) => updateFilter('dueTo', event.target.value)} />
            <select value={filters.riskLevel} onChange={(event) => updateFilter('riskLevel', event.target.value)}>
              <option value="">All risk levels</option>
              {riskOptions.map((risk) => <option key={risk} value={risk}>{toLabel(risk)}</option>)}
            </select>
            <input
              value={filters.approverXID}
              onChange={(event) => updateFilter('approverXID', event.target.value)}
              placeholder="Approver XID"
            />
            <select value={filters.exceptionType} onChange={(event) => updateFilter('exceptionType', event.target.value)}>
              <option value="">All exception reasons</option>
              {EXCEPTION_TYPE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <select value={filters.useDemo} onChange={(event) => updateFilter('useDemo', event.target.value)}>
              <option value="false">Live data</option>
              <option value="true">Demo data (if empty)</option>
            </select>
            <Button variant="outline" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
            <Button onClick={applyAllFilters}>Apply filters</Button>
          </div>
        </section>

        {canManageState ? (
          <section className="compliance-generation-panel">
            <div className="compliance-generation-panel__header">
              <h2>Recurring Generation</h2>
              <p>Generate compliance dockets from obligation templates. Sample templates are configurable examples.</p>
            </div>
            <div className="compliance-control-filter-row">
              <select
                multiple
                value={selectedTemplateIds}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setSelectedTemplateIds(values);
                }}
                disabled={loadingTemplates}
              >
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.obligationType})
                  </option>
                ))}
              </select>
              <input type="date" value={generationRangeStart} onChange={(event) => setGenerationRangeStart(event.target.value)} />
              <input type="date" value={generationRangeEnd} onChange={(event) => setGenerationRangeEnd(event.target.value)} />
              <Button variant="outline" onClick={handleSeedSamples} disabled={generationLoading}>Seed sample templates</Button>
              <Button variant="outline" onClick={() => runGeneration('preview')} disabled={generationLoading || !selectedTemplateIds.length}>Preview</Button>
              <Button onClick={() => runGeneration('run')} disabled={generationLoading || !selectedTemplateIds.length}>Generate</Button>
            </div>
            <div className="compliance-generation-badges">
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Generated</p>
                <p className="compliance-control-summary-card__value">{generationSummary.generated || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Skipped Duplicate</p>
                <p className="compliance-control-summary-card__value">{generationSummary.skippedDuplicate || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Failed</p>
                <p className="compliance-control-summary-card__value">{generationSummary.failed || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Total Candidates</p>
                <p className="compliance-control-summary-card__value">{generationSummary.totalCandidates || 0}</p>
              </article>
            </div>
            {generationRows.length ? (
              <div className="compliance-generation-preview-list">
                {generationRows.slice(0, 20).map((row, idx) => (
                  <div key={`${row.templateId || 'template'}-${row.clientId || 'client'}-${row.period || idx}`} className="compliance-generation-preview-item">
                    <strong>{row.templateName}</strong> · {row.clientName || row.clientId} · {row.period} · <span>{row.status}</span>
                    {row.reason ? <span> · {row.reason}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {canManageState ? (
          <section className="compliance-generation-panel">
            <div className="compliance-generation-panel__header">
              <h2>Approval Queues</h2>
              <p>Track partner/client/signatory bottlenecks with ageing and reminder placeholders.</p>
            </div>
            <div className="compliance-control-filter-row">
              {APPROVAL_VIEWS.map((option) => (
                <Button
                  key={option.key}
                  variant={approvalView === option.key ? 'primary' : 'outline'}
                  onClick={() => setApprovalView(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="compliance-generation-badges">
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">My approvals</p>
                <p className="compliance-control-summary-card__value">{approvalSummary.myApprovals || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Awaiting partner</p>
                <p className="compliance-control-summary-card__value">{approvalSummary.awaitingPartner || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Awaiting client/signatory</p>
                <p className="compliance-control-summary-card__value">{approvalSummary.awaitingClientSignatory || 0}</p>
              </article>
              <article className="compliance-control-summary-card">
                <p className="compliance-control-summary-card__label">Overdue approvals</p>
                <p className="compliance-control-summary-card__value">{approvalSummary.overdueApprovals || 0}</p>
              </article>
            </div>
            <div className="compliance-control-table-wrap">
              <table className="compliance-control-table">
                <thead>
                  <tr>
                    <th>Docket</th>
                    <th>Client</th>
                    <th>Approval Type</th>
                    <th>Approver</th>
                    <th>Requested At</th>
                    <th>Due At</th>
                    <th>Age (days)</th>
                    <th>Status</th>
                    <th>Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalLoading ? (
                    <tr><td colSpan={9}>Loading approvals…</td></tr>
                  ) : approvalRows.length === 0 ? (
                    <tr><td colSpan={9}>No approvals found for this view.</td></tr>
                  ) : approvalRows.map((row) => (
                    <tr key={`approval-${row.caseId}`}>
                      <td>{renderDocketLink(row.caseId)}</td>
                      <td>{renderClientLink(row.clientId, row.clientName || row.clientId || '—')}</td>
                      <td>{toLabel(row.approvalType)}</td>
                      <td>{row.approver || '—'}</td>
                      <td>{formatDate(row.requestedAt)}</td>
                      <td>{formatDate(row.dueAt)}</td>
                      <td>{row.ageDays ?? '—'}</td>
                      <td>{row.overdue ? 'Overdue' : 'Pending'}</td>
                      <td>
                        <div className="compliance-approval-actions">
                          <Button variant="outline" onClick={() => handleReminder(row.caseId, false)}>Remind</Button>
                          <Button variant="outline" onClick={() => handleReminder(row.caseId, true)}>Escalate</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No compliance dockets found for current filters."
            body="Create or update dockets with compliance metadata to start tracking this control room."
          />
        ) : null}

        {rows.length ? (
          <div className="compliance-control-table-wrap">
            <table className="compliance-control-table">
              <thead>
                <tr>
                  <th>Docket</th>
                  <th>Client/Entity</th>
                  <th>Obligation</th>
                  <th>Period</th>
                  <th>Owner</th>
                  <th>Reviewer</th>
                  <th>Approver</th>
                  <th>State</th>
                  <th>Statutory Due</th>
                  <th>Internal Due</th>
                  <th>Pend Until</th>
                  <th>Filed At</th>
                  <th>Risk</th>
                  <th>Blocked Reason</th>
                  {canManageState ? <th>Transition</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.caseId}>
                    <td>{renderDocketLink(row.caseId)}</td>
                    <td>{renderClientLink(row.clientId, row.clientName || row.clientId || '—')}</td>
                    <td>{row.obligationType || '—'}</td>
                    <td>{row.obligationPeriod || '—'}</td>
                    <td>{row.assignedToXID || '—'}</td>
                    <td>{row.reviewerXID || '—'}</td>
                    <td>{row.approverXID || '—'}</td>
                    <td><span className={statusChipClass(row.complianceState)}>{toLabel(row.complianceState)}</span></td>
                    <td>{formatDate(row.statutoryDueDate)}</td>
                    <td>{formatDate(row.internalDueDate)}</td>
                    <td>{formatDate(row.pendUntil)}</td>
                    <td>{formatDate(row.filedAt)}</td>
                    <td><span className={riskChipClass(row.riskLevel)}>{toLabel(row.riskLevel)}</span></td>
                    <td>{row.blockedReason || '—'}</td>
                    {canManageState ? (
                      <td>
                        <select
                          value={row.complianceState}
                          disabled={savingCaseId === row.caseId}
                          onChange={(event) => handleStateChange(row.caseId, event.target.value)}
                        >
                          {COMPLIANCE_STATES.map((state) => (
                            <option key={state} value={state}>{toLabel(state)}</option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PlatformShell>
  );
};

export default ComplianceCalendarPage;
