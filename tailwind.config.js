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
          bg: '#F7F6F3',
          card: '#FFFFFF',
          border: '#E5E3DE',
          muted: '#F1EFEA',
          // deprecated dark aliases removed — light semantic only
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F1EFEA',
        },
        // Clinical teal — deliberately not the default indigo/SaaS blue.
        // Teal reads medical and calm; AA-contrast text tones included.
        primary: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
          light: '#F0FDFA',
          border: '#99F6E4',
          text: '#0F766E',
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
        // Deliberate pairing: Source Serif 4 for headings (clinical-chart, print feel)
        // and Public Sans for UI (designed for government accessibility — high
        // legibility for older patients). Not the default Inter/Geist SaaS stack.
        sans: ['Public Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      fontSize: {
        'heading-xl': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700', letterSpacing: '-0.015em' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'heading-md': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'body': ['0.875rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.05em' }],
        'label': ['0.75rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        xl: '10px',
        '2xl': '13px',
        '3xl': '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(28,25,23,0.06)',
        md: '0 2px 6px rgba(28,25,23,0.07)',
        lg: '0 6px 16px rgba(28,25,23,0.09)',
        xl: '0 14px 32px rgba(28,25,23,0.12)',
        soft: '0 2px 8px rgba(28,25,23,0.04)',
      },
      // Spacing uses native Tailwind 4/8 grid (4px base). No override needed —
      // use p-1 (4px), p-2 (8px), p-3 (12px), p-4 (16px), p-6 (24px), p-8 (32px) etc.
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out forwards',
        'slide-up': 'slideUp 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
