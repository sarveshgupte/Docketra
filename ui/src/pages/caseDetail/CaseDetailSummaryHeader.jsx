import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';

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
}) => (
  (() => {
    const employeeLabel = caseInfo?.employeeSnapshot?.xID
      ? `${caseInfo.employeeSnapshot.xID} - ${caseInfo.employeeSnapshot.name || 'Employee'}`
      : (caseInfo?.employeeXID || null);
    const relatedEmployeeUser = caseInfo?.relatedEmployeeUser || null;
    const relatedEmployeeUserLabel = relatedEmployeeUser
      ? (relatedEmployeeUser.name || relatedEmployeeUser.email || relatedEmployeeUser.xID || 'User')
      : null;
    return (
  <section className="case-card" aria-label="Docket summary header">
    <div className="case-card__heading">
      <h2>{formatDocketId(caseInfo?.caseId || caseId)}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{docketStatusLabel}</Badge>
        {locationBadges.map((badge) => <Badge key={badge} variant="secondary">{badge}</Badge>)}
        {caseInfo?.qc?.status || caseInfo?.qcStatus ? (
          <Badge variant={String(caseInfo?.qc?.status || caseInfo?.qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'warning'}>
            QC {caseInfo?.qc?.status || caseInfo?.qcStatus}
          </Badge>
        ) : null}
      </div>
    </div>
    <p className="mt-2 text-sm text-gray-700">{caseInfo?.title || caseInfo?.caseName || 'Untitled docket'}</p>
    <div className="field-grid mt-4">
      <div className="field-group min-w-0"><span className="field-label">Category</span><span className="field-value text-sm">{categoryLabel}</span></div>
      <div className="field-group min-w-0"><span className="field-label">Subcategory</span><span className="field-value text-sm">{subcategoryLabel}</span></div>
      <div className="field-group min-w-0">
        <span className="field-label">Linked Client</span>
        <span className="field-value text-sm break-words">
          {isInternalWork ? 'Internal work (default client context)' : (
            linkedClientRoute ? <Link to={linkedClientRoute} className="case-detail-table__link">{clientName}</Link> : clientName
          )}
        </span>
      </div>
      <div className="field-group min-w-0"><span className="field-label">Assignee / Owner</span><span className="field-value text-sm break-words">{assigneeLabel}</span></div>
      {relatedEmployeeUserLabel ? <div className="field-group min-w-0"><span className="field-label">Related employee/user</span><span className="field-value text-sm break-words">{relatedEmployeeUserLabel}{relatedEmployeeUser?.xID || relatedEmployeeUser?.status ? ` · ${relatedEmployeeUser?.xID || '—'} · ${relatedEmployeeUser?.status || 'Unknown'}` : ''}</span></div> : null}
      {employeeLabel ? <div className="field-group min-w-0"><span className="field-label">Employee</span><span className="field-value text-sm break-words">{employeeLabel}</span></div> : null}
      <div className="field-group min-w-0"><span className="field-label">Queue / Workbasket</span><span className="field-value text-sm break-words">{queueLabel}</span></div>
      <div className="field-group min-w-0"><span className="field-label">SLA / TAT</span><span className="field-value text-sm">{slaDaysLabel && slaDaysLabel !== '-' ? `${slaDaysLabel} day(s)` : 'Not configured'}</span></div>
      <div className="field-group min-w-0"><span className="field-label">Created / Updated</span><span className="field-value text-sm">{formatDateTime(caseInfo?.createdAt)} • {formatDateTime(caseInfo?.updatedAt)}</span></div>
    </div>
  </section>
    );
  })()
);
