import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home, LayoutDashboard, ListTree } from 'lucide-react';

import { Logo } from '../../components/ui/Brand.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const SUGGESTIONS = [
  { label: 'Go to my dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'See the full sitemap', to: '/sitemap', icon: ListTree },
  { label: 'Back to the home page', to: '/', icon: Home },
];

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mb-6 flex justify-center"><Logo size={40} /></div>

        <p className="bg-brand-gradient bg-clip-text font-display text-[92px] font-bold leading-none tracking-tight text-transparent">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">That page has moved out of the budget</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          We could not find <code className="rounded bg-ink-soft/12 px-1.5 py-0.5 font-mono text-xs text-ink">{location.pathname}</code>.
          Check the address, or jump to one of these instead.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>Go back</Button>
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="cc-btn-primary">
            <Compass className="h-4 w-4" />
            {isAuthenticated ? 'Open dashboard' : 'Return home'}
          </Link>
        </div>

        <ul className="mt-8 grid gap-2 text-left sm:grid-cols-3">
          {SUGGESTIONS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex h-full items-center gap-2.5 rounded-2xl border border-surface-border bg-surface p-3.5 text-xs text-ink-muted transition hover:border-brand-500/40 hover:text-ink"
              >
                <item.icon className="h-4 w-4 shrink-0 text-brand-500" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
