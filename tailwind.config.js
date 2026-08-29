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
          bg: '#0F172A',
          card: '#1E293B',
          cardHover: '#334155',
          border: '#334155',
          accent: '#38BDF8',
          accentHover: '#0EA5E9',
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
          '0%, 100%': { boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(56, 189, 248, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
