export const PageHeader = ({ title, subtitle, description, meta, actions }) => (
  <div className="mb-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[var(--dt-font-size-page-title)] font-semibold tracking-[-0.012em] text-[var(--dt-text)]">{title}</h1>

        {(subtitle || description) && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[var(--dt-text-secondary)]">{subtitle || description}</p>
        )}

        {meta && <p className="mt-2 text-xs text-[var(--dt-text-muted)]">{meta}</p>}
      </div>

      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  </div>
);
