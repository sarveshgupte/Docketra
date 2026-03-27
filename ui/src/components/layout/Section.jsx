
import { PageContainer } from './PageContainer';

export const Section = ({ children, className = '', muted = false }) => (
  <section className={`w-full py-20 md:py-28 ${muted ? 'bg-surface' : ''} ${className}`}>
    <PageContainer>{children}</PageContainer>
  </section>
);
