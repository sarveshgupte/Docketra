import React from 'react';
import { Button } from '../common/Button';

export const DocketActions = ({ onFile, onPend, onResolve, onAssign }) => {
  return (
    <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap justify-end rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex gap-3">
        <Button variant="outline" onClick={onFile}>File</Button>
        <Button variant="outline" onClick={onPend}>Pend</Button>
      </div>
      <div className="ml-4 flex gap-3">
        <Button variant="outline" onClick={onAssign}>Assign</Button>
        <Button variant="primary" onClick={onResolve}>Resolve</Button>
      </div>
    </div>
  );
};
