import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Page header with breadcrumbs (an explicit SRS accessibility requirement).
 * `crumbs` = [{ label, to }]; the last item renders as plain text.
 */
export default function PageHeader({ title, description, crumbs = [], actions, icon: Icon, children }) {
  return (
    <header className="mb-5 sm:mb-6">
      <nav aria-label="Breadcrumb" className="mb-2.5">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <li>
            <Link to="/dashboard" className="inline-flex items-center gap-1 rounded transition-colors hover:text-brand-500">
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Dashboard</span>
            </Link>
          </li>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 text-ink-soft/60" />
                </li>
                <li>
                  {isLast || !crumb.to ? (
                    <span className="font-medium text-ink-muted" aria-current={isLast ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link to={crumb.to} className="rounded transition-colors hover:text-brand-500">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/12 text-brand-500 sm:grid">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
            {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}
