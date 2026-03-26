export const PageHeader = ({ title, description, meta, actions }) => (
  <div className="mb-section">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-page-title tracking-tight text-text-primary">{title}</h1>

        {description && (
          <p className="mt-3 max-w-content text-body leading-relaxed text-text-secondary">{description}</p>
        )}

        {meta && <p className="mt-3 text-meta text-text-muted">{meta}</p>}
      </div>

      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  </div>
);
