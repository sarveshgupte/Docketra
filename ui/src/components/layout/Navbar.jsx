import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="w-full border-b border-gray-100 bg-white">
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
            to="/login"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Login
          </Link>

          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Start workspace
          </Link>
        </div>
      </div>
    </header>
  );
}
