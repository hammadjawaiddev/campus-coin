import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'cc-btn-primary',
  secondary: 'cc-btn-secondary',
  ghost: 'cc-btn-ghost',
  danger: 'cc-btn-danger',
  success: 'cc-btn-success',
};

const SIZES = {
  sm: 'cc-btn-sm',
  md: '',
  lg: 'cc-btn-lg',
  icon: 'cc-btn-icon',
  'icon-sm': 'cc-btn-icon-sm',
};

/**
 * Button primitive.
 * While `loading` it becomes non-interactive and announces `busy`, so every
 * async action in the app has visible feedback.
 */
const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', loading = false, disabled = false, icon: Icon, iconRight: IconRight, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />}
    </button>
  );
});

export default Button;
