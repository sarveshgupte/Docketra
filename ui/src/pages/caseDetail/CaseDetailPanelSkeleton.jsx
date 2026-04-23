import { Card } from '../../components/common/Card';

export const CaseDetailPanelSkeleton = ({ title = 'Loading section…', rows = 4 }) => (
  <Card className="case-card" aria-busy="true">
    <div className="case-card__heading">
      <h2>{title}</h2>
    </div>
    <div className="case-detail__section-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, idx) => <div key={`panel-skeleton-${idx}`} className="case-detail__skeleton-row" />)}
    </div>
  </Card>
);
