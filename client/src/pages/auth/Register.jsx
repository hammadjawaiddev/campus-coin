import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Mail, Sparkles, User, UserPlus, Wallet } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { CURRENCY_SYMBOLS } from '../../utils/format.js';

const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate', 'Other'];

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    academicYear: '1st Year',
    currency: 'USD',
    monthlyAllowance: '',
    savingsGoal: '',
    acceptedTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  const passwordChecks = {
    length: form.password.length >= 8,
    letter: /[a-zA-Z]/.test(form.password),
    number: /\d/.test(form.password),
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!passwordChecks.length) next.password = 'Use at least 8 characters';
    else if (!passwordChecks.letter || !passwordChecks.number) next.password = 'Include at least one letter and one number';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (!form.acceptedTerms) next.acceptedTerms = 'Please accept the terms to continue';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setFormError('');
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        academicYear: form.academicYear,
        currency: form.currency,
        monthlyAllowance: Number(form.monthlyAllowance) || 0,
        savingsGoal: Number(form.savingsGoal) || 0,
      });
      toast.success('Account created 🎉', { description: 'Let’s set up your first budget.' });
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(error.message);
      if (error.details) {
        setErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </div>
      )}

      <label className="block">
        <span className="cc-label">Full name</span>
        <span className="relative block">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <input
            value={form.name}
            onChange={update('name')}
            autoComplete="name"
            placeholder="Ayesha Khan"
            className={`cc-input pl-10 ${errors.name ? 'cc-input-error' : ''}`}
            required
          />
        </span>
        {errors.name && <span className="cc-error-text">{errors.name}</span>}
      </label>

      <label className="block">
        <span className="cc-label">Email address</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            placeholder="you@university.edu"
            className={`cc-input pl-10 ${errors.email ? 'cc-input-error' : ''}`}
            required
          />
        </span>
        {errors.email && <span className="cc-error-text">{errors.email}</span>}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="cc-label">Password</span>
          <span className="relative block">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              className={`cc-input pr-10 ${errors.password ? 'cc-input-error' : ''}`}
              placeholder="At least 8 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
          {errors.password && <span className="cc-error-text">{errors.password}</span>}
        </label>

        <label className="block">
          <span className="cc-label">Confirm password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            autoComplete="new-password"
            className={`cc-input ${errors.confirmPassword ? 'cc-input-error' : ''}`}
            placeholder="Repeat it"
            required
          />
          {errors.confirmPassword && <span className="cc-error-text">{errors.confirmPassword}</span>}
        </label>
      </div>

      {form.password && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
          {[
            { ok: passwordChecks.length, label: '8+ characters' },
            { ok: passwordChecks.letter, label: 'a letter' },
            { ok: passwordChecks.number, label: 'a number' },
          ].map(({ ok, label }) => (
            <li key={label} className={`inline-flex items-center gap-1 ${ok ? 'text-mint-600 dark:text-mint-400' : 'text-ink-soft'}`}>
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="cc-label">Academic year</span>
          <select value={form.academicYear} onChange={update('academicYear')} className="cc-select">
            {ACADEMIC_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="cc-label">Currency</span>
          <select value={form.currency} onChange={update('currency')} className="cc-select">
            {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
              <option key={code} value={code}>
                {code} ({symbol})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="cc-label">Monthly allowance / income baseline</span>
          <span className="relative block">
            <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input
              type="number"
              min="0"
              step="1"
              value={form.monthlyAllowance}
              onChange={update('monthlyAllowance')}
              placeholder="350"
              className="cc-input pl-10"
            />
          </span>
          <span className="mt-1 block text-2xs text-ink-soft">Optional — you can add this later in onboarding.</span>
        </label>

        <label className="block">
          <span className="cc-label">Savings goal</span>
          <span className="relative block">
            <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <input
              type="number"
              min="0"
              step="1"
              value={form.savingsGoal}
              onChange={update('savingsGoal')}
              placeholder="1200"
              className="cc-input pl-10"
            />
          </span>
          <span className="mt-1 block text-2xs text-ink-soft">A target to work towards this semester.</span>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-muted p-3.5">
        <input
          type="checkbox"
          checked={form.acceptedTerms}
          onChange={update('acceptedTerms')}
          className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-500 focus:ring-brand-500/30"
        />
        <span className="text-xs leading-relaxed text-ink-muted">
          I understand Campus Coin is an educational budgeting tool that stores the data I enter, and that its tips and AI
          suggestions are guidance rather than professional financial advice.
        </span>
      </label>
      {errors.acceptedTerms && <span className="cc-error-text">{errors.acceptedTerms}</span>}

      <Button type="submit" className="w-full" loading={loading} icon={UserPlus}>
        Create my account
      </Button>

      <p className="pt-1 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="cc-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
