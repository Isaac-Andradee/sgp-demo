"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" aria-hidden />
    );
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2];
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Tema"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Tema: ${current.label}`}
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 py-1.5 min-w-[10rem] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg z-50"
          role="listbox"
          aria-label="Selecionar tema"
        >
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setTheme(t.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-left transition-colors ${
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
