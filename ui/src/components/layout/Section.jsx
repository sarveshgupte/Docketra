
import { PageContainer } from './PageContainer';

export const Section = ({ children, className = '', muted = false, ...props }) => (
  <section className={`w-full py-20 md:py-28 ${muted ? 'bg-surface' : ''} ${className}`} {...props}>
    <PageContainer>{children}</PageContainer>
  </section>
);
