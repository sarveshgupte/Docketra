/**
 * MetricCard Component
 * Displays a single metric card for dashboard
 */

import React from 'react';
import { Card } from '../common/Card';
import './MetricCard.css';

export const MetricCard = ({ title, value, subtitle, onClick, warning = false }) => {
  return (
    <Card className="metric-card" onClick={onClick}>
      <div className="metric-card__content">
        <h3 className="metric-card__title">{title}</h3>
        <div className={`metric-card__value ${warning ? 'metric-card__value--warning' : ''}`}>
          {value}
        </div>
        {subtitle && (
          <p className="metric-card__subtitle">{subtitle}</p>
        )}
      </div>
    </Card>
  );
};
