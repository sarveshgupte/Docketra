
import { PageContainer } from './PageContainer';

export const Section = ({ children, className = '', muted = false, ...props }) => (
  <section className={`w-full py-16 md:py-20 ${muted ? 'bg-surface' : ''} ${className}`} {...props}>
    <PageContainer>{children}</PageContainer>
  </section>
);
