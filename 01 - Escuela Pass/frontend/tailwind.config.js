/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
