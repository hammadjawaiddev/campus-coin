import { motion } from 'framer-motion';

/** Base surface used by every dashboard widget. */
export function Card({ as: Component = 'div', className = '', hover = false, children, ...rest }) {
  return (
    <Component className={`cc-card ${hover ? 'cc-card-hover' : ''} ${className}`} {...rest}>
      {children}
    </Component>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, className = '', dense = false }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${dense ? 'mb-3' : 'mb-4'} ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 dark:text-brand-300">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={className}>{children}</div>;
}

/** Animated widget wrapper used for staggered dashboard entrances. */
export function MotionCard({ children, delay = 0, className = '', ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 0.9, 0.32, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default Card;
