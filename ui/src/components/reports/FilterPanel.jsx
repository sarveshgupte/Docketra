/**
 * FilterPanel Component
 * Provides filters for detailed reports
 */

import React from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import './FilterPanel.css';

export const FilterPanel = ({
  filters,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  categories = [],
  clients = [],
  employees = [],
}) => {
  return (
    <div className="filter-panel">
      <div className="filter-panel__header">
        <h3>Filters</h3>
      </div>
      
      <div className="filter-panel__content">
        <div className="filter-panel__row">
          <div className="filter-panel__field">
            <label>From Date</label>
            <Input
              type="date"
              value={filters.fromDate || ''}
              onChange={(e) => onFilterChange('fromDate', e.target.value)}
            />
          </div>
          
          <div className="filter-panel__field">
            <label>To Date</label>
            <Input
              type="date"
              value={filters.toDate || ''}
              onChange={(e) => onFilterChange('toDate', e.target.value)}
            />
          </div>
        </div>
        
        <div className="filter-panel__row">
          <div className="filter-panel__field">
            <label>Status</label>
            <Select
              value={filters.status || ''}
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Closed">Closed</option>
              <option value="Filed">Filed</option>
            </Select>
          </div>
          
          <div className="filter-panel__field">
            <label>Category</label>
            <Select
              value={filters.category || ''}
              onChange={(e) => onFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>
        </div>
        
        <div className="filter-panel__actions">
          <Button variant="primary" onClick={onApplyFilters}>
            Apply Filters
          </Button>
          <Button onClick={onClearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
};
