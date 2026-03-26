
export const SectionCard = ({ title, subtitle, children, className = '' }) => {
  return (
    <section className={`case-card ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="case-card__heading">
          {title ? <h2>{title}</h2> : null}
          {subtitle ? <p className="case-card__subtitle">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
};
