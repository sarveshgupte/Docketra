import React from 'react';
import { Button } from '../common/Button';

export const DocketActions = React.memo(({ onFile, onPend, onResolve, onAssign }) => {
  return (
    <div className="docket-action-bar sticky bottom-4 z-20 mt-6" aria-label="Docket quick actions">
      <div className="docket-action-bar__group" role="group" aria-label="Lifecycle actions">
        <Button variant="outline" onClick={onFile} className="docket-action-bar__button">File</Button>
        <Button variant="outline" onClick={onPend} className="docket-action-bar__button">Pend</Button>
      </div>
      <div className="docket-action-bar__divider" aria-hidden="true" />
      <div className="docket-action-bar__group" role="group" aria-label="Assignment and completion actions">
        <Button variant="outline" onClick={onAssign} className="docket-action-bar__button">Assign</Button>
        <Button variant="primary" onClick={onResolve} className="docket-action-bar__button">Resolve</Button>
      </div>
    </div>
  );
});
