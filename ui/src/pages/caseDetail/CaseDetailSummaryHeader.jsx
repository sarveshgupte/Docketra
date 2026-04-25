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
}) => (
  <section className="case-card" aria-label="Docket summary header">
    <div className="case-card__heading">
      <h2>{formatDocketId(caseInfo?.caseId || caseId)}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{docketStatusLabel}</Badge>
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
      <div className="field-group min-w-0"><span className="field-label">Queue / Workbasket</span><span className="field-value text-sm break-words">{queueLabel}</span></div>
      <div className="field-group min-w-0"><span className="field-label">Created / Updated</span><span className="field-value text-sm">{formatDateTime(caseInfo?.createdAt)} • {formatDateTime(caseInfo?.updatedAt)}</span></div>
    </div>
  </section>
);

