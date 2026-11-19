import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';

const isHexObjectId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());

export const CaseDetailSummaryHeader = ({
  caseInfo,
  caseId,
  docketStatusLabel,
  categoryLabel,
  subcategoryLabel,
  linkedClientRoute,
  clientName,
  isInternalWork,
  assigneeLabel,
  queueLabel,
  locationBadges = [],
  slaDaysLabel,
}) => {
  const employeeLabel = caseInfo?.employeeSnapshot?.xID
    ? `${caseInfo.employeeSnapshot.xID} - ${caseInfo.employeeSnapshot.name || 'Employee'}`
    : (caseInfo?.employeeXID || null);

  const relatedEmployeeUser = caseInfo?.relatedEmployeeUser || null;
  const relatedEmployeeUserLabel = (() => {
    if (!relatedEmployeeUser || typeof relatedEmployeeUser !== 'object') return null;
    if (relatedEmployeeUser.status === 'not_applicable' || relatedEmployeeUser.status === 'none') return null;
    const name = relatedEmployeeUser.name || (relatedEmployeeUser.email ? relatedEmployeeUser.email.split('@')[0] : null) || relatedEmployeeUser.xID;
    if (!name || String(name).trim().toLowerCase() === 'user') return null;
    const details = [relatedEmployeeUser.xID].filter(Boolean).join(' · ');
    return details ? `${name} (${details})` : name;
  })();

  const cleanQueueLabel = (() => {
    if (!queueLabel || queueLabel === '—') return 'General Workbasket';
    if (isHexObjectId(queueLabel)) return 'General Workbasket';
    return queueLabel;
  })();

  return (
    <section className="case-card rounded-md border border-slate-200/90 bg-white p-4 shadow-xs" aria-label="Docket summary header">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Docket Properties</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="info">{docketStatusLabel}</Badge>
          {locationBadges.map((badge) => <Badge key={badge} variant="secondary">{badge}</Badge>)}
          {caseInfo?.qc?.status || caseInfo?.qcStatus ? (
            <Badge variant={String(caseInfo?.qc?.status || caseInfo?.qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'warning'}>
              QC {caseInfo?.qc?.status || caseInfo?.qcStatus}
            </Badge>
          ) : null}
        </div>
      </div>

      <dl className="flex flex-col divide-y divide-slate-100 text-xs mt-1">
        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Category</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs break-words">{categoryLabel || '—'}</dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Subcategory</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs break-words">{subcategoryLabel || '—'}</dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Client</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs break-words">
            {isInternalWork ? (
              <span className="text-slate-500 font-normal">Internal work</span>
            ) : linkedClientRoute && clientName && clientName !== '—' ? (
              <Link to={linkedClientRoute} className="text-blue-700 hover:text-blue-900 hover:underline">
                {clientName}
              </Link>
            ) : (
              clientName || '—'
            )}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Assignee</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs break-words">{assigneeLabel || 'Unassigned'}</dd>
        </div>

        {relatedEmployeeUserLabel && (
          <div className="flex items-start justify-between py-2 gap-3 bg-blue-50/40 -mx-4 px-4">
            <dt className="text-blue-700 font-medium text-[11px] shrink-0" title="Related employee/user">Related Employee</dt>
            <dd className="text-blue-900 font-semibold text-right text-xs break-words">
              👤 {relatedEmployeeUserLabel}
            </dd>
          </div>
        )}

        {employeeLabel && (
          <div className="flex items-start justify-between py-2 gap-3">
            <dt className="text-slate-500 font-medium text-[11px] shrink-0">Employee</dt>
            <dd className="text-slate-900 font-semibold text-right text-xs break-words">{employeeLabel}</dd>
          </div>
        )}

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Workbasket</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs break-words" title={cleanQueueLabel}>
            {cleanQueueLabel}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">SLA / TAT</dt>
          <dd className="text-slate-900 font-semibold text-right text-xs">
            {slaDaysLabel && slaDaysLabel !== '-' ? `${slaDaysLabel} day(s)` : 'Not configured'}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Created</dt>
          <dd className="text-slate-600 font-normal text-right text-xs whitespace-nowrap">
            {formatDateTime(caseInfo?.createdAt)}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2 gap-3">
          <dt className="text-slate-500 font-medium text-[11px] shrink-0">Updated</dt>
          <dd className="text-slate-600 font-normal text-right text-xs whitespace-nowrap">
            {formatDateTime(caseInfo?.updatedAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
};
