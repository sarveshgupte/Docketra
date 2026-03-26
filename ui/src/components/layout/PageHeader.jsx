export const PageHeader = ({ title, description, meta, actions }) => (
  <div className="mb-12">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>

        {description && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
        )}

        {meta && <p className="mt-3 text-xs text-slate-400">{meta}</p>}
      </div>

      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  </div>
);
