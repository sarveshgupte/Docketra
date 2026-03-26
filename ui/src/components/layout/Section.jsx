
import { PageContainer } from './PageContainer';

export const Section = ({ children, className = '', muted = false }) => (
  <section className={`w-full ${muted ? 'bg-surface' : ''} py-section ${className}`}>
    <PageContainer className="py-0">{children}</PageContainer>
  </section>
);
