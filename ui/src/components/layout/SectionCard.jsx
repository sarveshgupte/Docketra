import { surfaceClasses } from '../../theme/tokens';


export const SectionCard = ({ title, subtitle, action, children, className = '' }) => {
  return (
    <section className={`${surfaceClasses.card} ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            {title ? <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500 font-normal">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
};
