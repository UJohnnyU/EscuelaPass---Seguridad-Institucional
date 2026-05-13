/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif']
      },
      colors: {
        landing: {
          wine: '#5c1f2a',
          burgundy: '#6b2433',
          deep: '#1a0f12',
          dark: '#0d0a0b',
          muted: '#c9b8bc',
          accent: '#9e2a3c'
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        }
      },
      animation: {
        'progress-bar': 'progressBar 1.6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.45s ease-out forwards',
        /** Entrada auth (login / recuperar contraseña): suave y con “pop” leve. */
        'auth-in': 'authContentIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'auth-in-delay-sm': 'authContentIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both',
        'auth-in-delay-md': 'authContentIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both',
        /** Resplandor muy lento en fondos de autenticación. */
        'auth-ambient': 'authAmbient 14s ease-in-out infinite',
        'bubble-drift': 'bubbleDrift 22s ease-in-out infinite',
        /** Paso activo en protocolo de circuito UI (plantel). */
        'circuit-step-live': 'circuitStepLive 2.2s ease-in-out infinite',
        'circuit-step-title': 'circuitStepTitle 3.2s ease-in-out infinite'
      },
      keyframes: {
        progressBar: {
          '0%': { transform: 'translateX(-100%)' },
          '60%': { transform: 'translateX(40%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        authContentIn: {
          '0%': { opacity: '0', transform: 'translateY(0.875rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        authAmbient: {
          '0%, 100%': { opacity: '0.18', transform: 'scale(1)' },
          '50%': { opacity: '0.38', transform: 'scale(1.07)' }
        },
        bubbleDrift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(12px, -20px) scale(1.03)' },
          '50%': { transform: 'translate(-10px, 8px) scale(0.98)' },
          '75%': { transform: 'translate(6px, 14px) scale(1.02)' }
        },
        circuitStepLive: {
          '0%, 100%': { transform: 'scale(0.92)', opacity: '0.45' },
          '50%': { transform: 'scale(1.65)', opacity: '0' }
        },
        circuitStepTitle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.86' }
        }
      }
    }
  },
  plugins: []
};
