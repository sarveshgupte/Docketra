import Container from './Container';

export const Section = ({ children, className = '', muted = false, ...props }) => (
  <section className={`w-full py-20 ${muted ? 'bg-gray-50' : 'bg-white'} ${className}`.trim()} {...props}>
    <Container>{children}</Container>
  </section>
);
