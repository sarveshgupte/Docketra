
export const Section = ({ children, className = '', muted = false }) => (
  <section
    className={`w-full ${muted ? 'bg-gray-50' : ''} ${className}`}
    style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}
  >
    <div className="marketing-container w-full">{children}</div>
  </section>
);
