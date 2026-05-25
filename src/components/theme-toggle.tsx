'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="border-line h-9 w-[180px] rounded-[10px] border"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="border-line bg-bg-elevated inline-flex rounded-[10px] border p-0.5"
      role="radiogroup"
      aria-label="테마 전환"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-primary text-white'
                : 'text-label-neutral hover:text-label-normal'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
