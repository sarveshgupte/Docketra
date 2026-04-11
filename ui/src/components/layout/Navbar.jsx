import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionNavigation = (sectionId) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      setIsOpen(false);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-gray-900">
          Docketra
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <button type="button" onClick={() => handleSectionNavigation('features')} className="hover:text-gray-900">
              Features
            </button>
            <button type="button" onClick={() => handleSectionNavigation('pricing')} className="hover:text-gray-900">
              Pricing
            </button>
            <Link to="/security" className="hover:text-gray-900">Security</Link>
            <Link to="/about" className="hover:text-gray-900">About</Link>
          </nav>

          <Link
            to="/signup"
            className="hidden md:inline-flex items-center justify-center h-9 px-4 rounded-lg bg-black text-white text-sm font-medium shadow-sm transition-all hover:bg-gray-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate900/30 focus-visible:ring-offset-2"
          >
            Create your workspace
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate900/30 transition-colors"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? "Close main menu" : "Open main menu"}
          >
            {isOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-4">
          <button
            type="button"
            className="block text-sm text-gray-700"
            onClick={() => handleSectionNavigation('features')}
          >
            Features
          </button>

          <button
            type="button"
            className="block text-sm text-gray-700"
            onClick={() => handleSectionNavigation('pricing')}
          >
            Pricing
          </button>

          <Link to="/security" className="block text-sm text-gray-700" onClick={() => setIsOpen(false)}>
            Security
          </Link>

          <Link to="/about" className="block text-sm text-gray-700" onClick={() => setIsOpen(false)}>
            About
          </Link>

          <Link
            to="/signup"
            onClick={() => setIsOpen(false)}
            className="block w-full text-center h-10 leading-[40px] rounded-lg bg-black text-white text-sm font-medium transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate900/30 focus-visible:ring-offset-2"
          >
            Create your workspace
          </Link>
        </div>
      )}
    </header>
  );
}
