import { useEffect, useState } from 'react';
import { secureStorage } from '../services/secureStorage';

const THEME_STORAGE_KEY = 'theme';

export function useTheme() {
  const [theme, setTheme] = useState('light');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateTheme() {
      try {
        const storedTheme = await secureStorage.getItem(THEME_STORAGE_KEY);
        const preferredTheme =
          storedTheme ||
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

        if (isMounted) {
          setTheme(preferredTheme);
          document.documentElement.classList.toggle('dark', preferredTheme === 'dark');
        }
      } finally {
        if (isMounted) {
          setIsThemeReady(true);
        }
      }
    }

    hydrateTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isThemeReady) {
      return;
    }

    document.documentElement.classList.toggle('dark', theme === 'dark');
    secureStorage.setItem(THEME_STORAGE_KEY, theme).catch(() => {});
  }, [theme, isThemeReady]);

  return {
    theme,
    isThemeReady,
    toggleTheme() {
      setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
    },
  };
}
