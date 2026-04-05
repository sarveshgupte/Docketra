// NEW
import React, { useEffect, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatCaseName, formatDocketId } from '../../utils/formatters';

export const CaseHeader = ({
  caseId,
  caseName,
  status,
  showSave,
  onSave,
  onAddComment,
  onOpenAudit,
  saveLabel = 'Save',
  disableSave = false,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`case-header ${isScrolled ? 'case-header--scrolled' : ''}`}>
      <div className="case-header__identity">
        <h1 className="case-header__title">{formatDocketId(caseId)}</h1>
        {caseName ? <p className="case-header__name">{formatCaseName(caseName)}</p> : null}
      </div>
      <div className="case-header__actions">
        <Badge status={status}>{status}</Badge>
        {showSave ? (
          <Button variant="primary" onClick={onSave} disabled={disableSave}>
            {saveLabel}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onAddComment}>Add Comment</Button>
        <Button variant="outline" onClick={onOpenAudit}>Open Audit Timeline</Button>
      </div>
    </div>
  );
};
