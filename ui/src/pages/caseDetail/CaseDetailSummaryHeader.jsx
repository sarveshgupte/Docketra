import React from 'react';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';

const resolveRelatedEmployeeLabel = (caseInfo) => {
  const related = caseInfo?.relatedEmployeeUser;
  if (!related || typeof related !== 'object') return null;
  if (related.status === 'not_applicable' || related.status === 'none') return null;
  const name = related.name || (related.email ? related.email.split('@')[0] : null) || related.xID;
  if (!name || String(name).trim().toLowerCase() === 'user') return null;
  return related.xID ? `${name} (${related.xID})` : name;
};

export const CaseDetailSummaryHeader = ({
  caseInfo,
  docketStatusLabel,
  locationBadges = [],
  slaDaysLabel,
}) => {
  const employeeLabel = caseInfo?.employeeSnapshot?.xID
    ? `${caseInfo.employeeSnapshot.xID} - ${caseInfo.employeeSnapshot.name || 'Employee'}`
    : (caseInfo?.employeeXID || null);

  const relatedEmployeeUserLabel = resolveRelatedEmployeeLabel(caseInfo);
  const qcStatus = caseInfo?.qc?.status || caseInfo?.qcStatus;

  return (
    <section
      className="case-card rounded-[var(--dt-radius-card,6px)] border border-slate-200 bg-white p-4"
      aria-label="Docket summary header"
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Properties
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant="info">{docketStatusLabel}</Badge>
          {locationBadges.map((badge) => (
            <Badge key={badge} variant="neutral">{badge}</Badge>
          ))}
          {qcStatus ? (
            <Badge variant={String(qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'warning'}>
              QC {qcStatus}
            </Badge>
          ) : null}
        </div>
      </div>

      <dl className="mt-1 flex flex-col divide-y divide-slate-100 text-xs">
        <div className="flex items-start justify-between gap-3 py-2">
          <dt className="shrink-0 text-[11px] font-medium text-slate-500">Target TAT</dt>
          <dd className="text-right font-semibold text-slate-900 tabular-nums">
            {slaDaysLabel && slaDaysLabel !== '-' ? `${slaDaysLabel} day(s)` : 'Not configured'}
          </dd>
        </div>

        {relatedEmployeeUserLabel ? (
          <div className="flex items-start justify-between gap-3 py-2">
            <dt className="shrink-0 text-[11px] font-medium text-slate-600" title="Related employee/user">
              Related Employee
            </dt>
            <dd className="break-words text-right font-semibold text-slate-900">
              {relatedEmployeeUserLabel}
            </dd>
          </div>
        ) : null}

        {employeeLabel ? (
          <div className="flex items-start justify-between gap-3 py-2">
            <dt className="shrink-0 text-[11px] font-medium text-slate-500">Employee</dt>
            <dd className="break-words text-right font-semibold text-slate-900">{employeeLabel}</dd>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3 py-2">
          <dt className="shrink-0 text-[11px] font-medium text-slate-500">Created</dt>
          <dd className="whitespace-nowrap text-right font-normal text-slate-600 tabular-nums">
            {formatDateTime(caseInfo?.createdAt)}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-3 py-2">
          <dt className="shrink-0 text-[11px] font-medium text-slate-500">Updated</dt>
          <dd className="whitespace-nowrap text-right font-normal text-slate-600 tabular-nums">
            {formatDateTime(caseInfo?.updatedAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
};
