
import { PageContainer } from './PageContainer';

export const Section = ({ children, className = '', muted = false }) => (
  <section className={`w-full ${muted ? 'bg-gray-50' : ''} py-16 ${className}`}>
    <PageContainer className="py-0">{children}</PageContainer>
  </section>
);
