import React from 'react';
import './layoutPrimitives.css';

export const SectionCard = ({ title, subtitle, children, className = '' }) => {
  return (
    <section className={`section-card ${className}`}>
      {(title || subtitle) && (
        <div className="section-card__header">
          {title ? <h2 className="section-card__title">{title}</h2> : null}
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
};
