import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem('ep-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initial = getStoredTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem('ep-theme', next);
    } catch {
      // ignore storage errors
    }
  };

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-200 ${
        isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-100'
      } ${compact ? '' : 'shadow-inner'}`}
    >
      <span
        className={`flex h-5 w-5 transform items-center justify-center rounded-full shadow transition-all duration-200 ease-out ${
          isDark ? 'translate-x-6 bg-slate-900 text-yellow-300' : 'translate-x-1 bg-white text-amber-500'
        }`}
        aria-hidden
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.657-5.657 1.414-1.414M4.929 19.071l1.414-1.414m0-11.314L4.929 4.929m14.142 14.142-1.414-1.414M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          </svg>
        )}
      </span>
    </button>
  );
}
