/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#F3F4F6',
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#F8FAFC',
          // deprecated dark aliases removed — light semantic only
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F8FAFC',
        },
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#EEF2FF',
          border: '#C7D2FE',
          text: '#3B5BDB',
        },
        accent: {
          DEFAULT: '#0EA5E9',
          light: '#38BDF8',
          hover: '#0284C7',
        },
        muted: {
          DEFAULT: '#64748B',
          light: '#94A3B8',
          subtle: '#F1F5F9',
        },
        clinical: {
          teal: '#14B8A6',
          blue: '#3B82F6',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#A855F7',
          emerald: '#10B981',
          rose: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'heading-xl': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '800', letterSpacing: '-0.02em' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700', letterSpacing: '-0.015em' }],
        'heading-md': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'body': ['0.875rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.05em' }],
        'label': ['0.75rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 12px rgba(0,0,0,0.06)',
        lg: '0 10px 24px rgba(0,0,0,0.08)',
        xl: '0 20px 40px rgba(0,0,0,0.12)',
        soft: '0 4px 12px rgba(0,0,0,0.04)',
        glow: '0 0 20px rgba(79,70,229,0.15)',
      },
      // Spacing uses native Tailwind 4/8 grid (4px base). No override needed —
      // use p-1 (4px), p-2 (8px), p-3 (12px), p-4 (16px), p-6 (24px), p-8 (32px) etc.
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'glow-pulse': 'glowPulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(79, 70, 229, 0.25)' },
          '50%': { boxShadow: '0 0 25px rgba(79, 70, 229, 0.45)' },
        }
      }
    },
  },
  plugins: [],
}
