// NEW
import React from 'react';

export const SortableTableHeader = ({
  column,
  label,
  sortState,
  onSortChange,
}) => {
  const isActive = sortState?.key === column;
  const direction = isActive ? sortState?.direction : null;

  const handleToggle = () => {
    if (!onSortChange) return;

    if (!isActive) {
      onSortChange({ key: column, direction: 'asc' });
      return;
    }

    if (direction === 'asc') {
      onSortChange({ key: column, direction: 'desc' });
      return;
    }

    onSortChange({ key: null, direction: null });
  };

  return (
    <button type="button" className="data-table__sort" onClick={handleToggle}>
      <span>{label}</span>
      <span className="data-table__sort-indicator" aria-hidden="true">
        {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
      </span>
    </button>
  );
};
