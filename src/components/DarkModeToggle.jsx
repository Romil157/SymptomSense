import { MoonStar, SunMedium } from 'lucide-react';

export default function DarkModeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brandBlue hover:text-brandBlue dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
