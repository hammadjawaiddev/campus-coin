/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * The design system uses a handful of in-between tints (e.g. /8, /12,
       * /14) that Tailwind's default opacity scale does not include. Declaring
       * them here keeps every tint valid in both class names and @apply.
       */
      opacity: {
        6: '0.06', 8: '0.08', 12: '0.12', 14: '0.14', 15: '0.15', 18: '0.18', 22: '0.22',
        28: '0.28', 35: '0.35', 45: '0.45', 55: '0.55', 65: '0.65', 85: '0.85',
      },
      colors: {
        /**
         * Campus Coin palette — a violet "coin" primary with cyan + mint accents,
         * deliberately different from the usual green banking app.
         * Values are CSS variables so theme switching needs no class churn.
         */
        brand: {
          50: '#F1EFFF', 100: '#E4E0FF', 200: '#C9C2FF', 300: '#AEA2FF',
          400: '#8C7DFF', 500: '#6D5DFB', 600: '#5646E5', 700: '#4335BC',
          800: '#322793', 900: '#241C6B',
        },
        accent: {
          50: '#E9FBFF', 100: '#CCF5FE', 200: '#A0EBFC', 300: '#63DDF7',
          400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
        },
        mint: {
          400: '#34D399', 500: '#22C55E', 600: '#16A34A',
        },
        surface: {
          DEFAULT: 'rgb(var(--cc-surface) / <alpha-value>)',
          muted: 'rgb(var(--cc-surface-muted) / <alpha-value>)',
          raised: 'rgb(var(--cc-surface-raised) / <alpha-value>)',
          border: 'rgb(var(--cc-border) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--cc-text) / <alpha-value>)',
          muted: 'rgb(var(--cc-text-muted) / <alpha-value>)',
          soft: 'rgb(var(--cc-text-soft) / <alpha-value>)',
        },
        canvas: 'rgb(var(--cc-canvas) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.15rem',
        '3xl': '1.6rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)',
        lift: '0 18px 40px -22px rgba(15,23,42,.35)',
        glow: '0 0 0 1px rgba(109,93,251,.35), 0 18px 45px -20px rgba(109,93,251,.55)',
        'inner-line': 'inset 0 1px 0 rgba(255,255,255,.06)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6D5DFB 0%, #8C7DFF 45%, #22D3EE 100%)',
        'coin-gradient': 'radial-gradient(circle at 30% 20%, rgba(109,93,251,.28), transparent 55%), radial-gradient(circle at 75% 60%, rgba(34,211,238,.22), transparent 60%)',
        'mint-gradient': 'linear-gradient(135deg, #22C55E 0%, #34D399 100%)',
        'warn-gradient': 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
        'danger-gradient': 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(109,93,251,.45)' }, '70%': { boxShadow: '0 0 0 12px rgba(109,93,251,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(109,93,251,0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,.9,.32,1) both',
        'fade-in': 'fade-in .35s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,.9,.32,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(.66,0,0,1) infinite',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.22,.9,.32,1)',
      },
    },
  },
  plugins: [],
};
