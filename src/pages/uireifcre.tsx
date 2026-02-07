// Mobile-first landing/index page
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6 py-12">
      <header className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">TQ</div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Transparent Queue</h1>
              <p className="text-[11px] text-neutral-500">Smart Queue Management</p>
            </div>
          </div>
          <nav className="hidden sm:flex gap-3">
            <Link to="/" className="text-sm text-neutral-600">Services</Link>
            <Link to="/profile" className="text-sm text-neutral-600">Profile</Link>
          </nav>
        </div>
      </header>

      <main className="w-full max-w-xl text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3">Skip the lines. Save time.</h2>
        <p className="text-sm text-neutral-600 mb-6">Get real-time queue updates, an easy ticket flow, and estimated waits — all from your phone.</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium shadow">Explore Services</Link>
          <Link to="/staff/login" className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 border border-neutral-200 rounded-lg text-sm">Staff Login</Link>
        </div>

        <div className="mt-8 text-sm text-neutral-500">
          <p>Designed mobile-first — works great on phones.</p>
        </div>
      </main>

      <footer className="w-full max-w-xl mt-12 text-center text-xs text-neutral-400">
        © 2026 Transparent Queue
      </footer>
    </div>
  );
};

export default Index;
