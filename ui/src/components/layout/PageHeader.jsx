export const PageHeader = ({ title, subtitle, description, meta, actions }) => (
  <div className="mb-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>

        {(subtitle || description) && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-gray-600">{subtitle || description}</p>
        )}

        {meta && <p className="mt-2 text-xs text-gray-400">{meta}</p>}
      </div>

      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  </div>
);
