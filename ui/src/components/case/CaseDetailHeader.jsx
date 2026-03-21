import React, { useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export const CaseDetailHeader = ({ caseId, title, status, lastUpdated, onOpenAudit, onCloseCase, onAddComment }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="case-header">
      <div className="case-header__left">
        <h1 className="case-header__id">{caseId}</h1>
        <p className="case-header__subtitle">{title}</p>
      </div>

      <div className="case-header__middle">
        <Badge status={status}>{status}</Badge>
        <span className="case-header__metadata">{lastUpdated}</span>
      </div>

      <div className="case-header__right">
        <Button variant="outline" onClick={onOpenAudit}>Audit ↗</Button>
        <div className="dropdown">
          <Button variant="outline" onClick={() => setShowMenu((value) => !value)}>⋮</Button>
          {showMenu && (
            <div className="dropdown-menu dropdown-menu-right" role="menu">
              <button type="button" className="dropdown-item" onClick={onAddComment}>Add comment</button>
              <button type="button" className="dropdown-item" onClick={onCloseCase}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
