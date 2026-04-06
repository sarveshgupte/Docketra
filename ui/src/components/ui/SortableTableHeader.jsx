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
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors duration-150 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm"
      onClick={handleToggle}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="text-gray-400" aria-hidden="true">
        {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
      </span>
    </button>
  );
};
