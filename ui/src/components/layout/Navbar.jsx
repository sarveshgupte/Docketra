import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 h-16 flex items-center justify-between">
        {/* LEFT — Brand */}
        <Link to="/" className="text-lg font-semibold text-gray-900">
          Docketra
        </Link>

        {/* RIGHT — Nav + CTA */}
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#how-it-works" className="hover:text-gray-900">Features</a>
            <a href="#" className="hover:text-gray-900">Pricing</a>
            <a href="#" className="hover:text-gray-900">Security</a>
          </nav>

          <Link
            to="/signup"
            className="hidden md:inline-flex items-center justify-center h-9 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Create workspace
          </Link>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-gray-200"
          >
            ☰
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-4">
          <a href="#how-it-works" className="block text-sm text-gray-700">
            Features
          </a>

          <a href="#" className="block text-sm text-gray-700">
            Pricing
          </a>

          <a href="#" className="block text-sm text-gray-700">
            Security
          </a>

          <Link
            to="/signup"
            className="block w-full text-center h-10 leading-[40px] rounded-lg bg-black text-white text-sm font-medium"
          >
            Create workspace
          </Link>
        </div>
      )}
    </header>
  );
}
