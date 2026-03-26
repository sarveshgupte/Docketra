
export const SectionCard = ({ title, subtitle, children, className = '' }) => {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="mb-1 flex items-center justify-between gap-3">
          {title ? <h2 className="m-0 text-lg font-semibold tracking-tight text-gray-900">{title}</h2> : null}
          {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
};
