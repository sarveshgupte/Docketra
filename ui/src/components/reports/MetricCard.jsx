import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

const trendToneClasses = {
  positive: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  neutral: 'text-gray-500',
};

export const MetricCard = ({
  title,
  value,
  subtitle,
  onClick,
  warning = false,
  trendTone,
  valueClassName = '',
  subtitleClassName = '',
  badge,
}) => {
  const resolvedTrendTone = trendTone || (warning ? 'warning' : 'neutral');
  const trendClassName = trendToneClasses[resolvedTrendTone] || trendToneClasses.neutral;
  const isInteractive = typeof onClick === 'function';

  const handleKeyDown = (event) => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={[
        'flex flex-col gap-2 p-6',
        isInteractive && 'cursor-pointer transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {badge ? <Badge className="shrink-0">{badge}</Badge> : null}
      </div>
      <p className={['text-3xl font-bold text-gray-900 tracking-tight', valueClassName].filter(Boolean).join(' ')}>{value}</p>
      {subtitle ? (
        <p className={['text-sm', trendClassName, subtitleClassName].filter(Boolean).join(' ')}>{subtitle}</p>
      ) : null}
    </Card>
  );
};
