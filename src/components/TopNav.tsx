"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "/",             label: "Scout Room" },
  { href: "/architecture", label: "Architecture" },
  { href: "/pipeline",     label: "Pipeline" },
  { href: "/odi",          label: "ODI + Cortex" },
  { href: "/about",        label: "About" },
  { href: "https://github.com/fivetran-jasonchletsos/the-scout-room", label: "GitHub", external: true },
];

export default function TopNav() {
  const pathname = usePathname() ?? "/";
  const here = (h: string) =>
    h === "/" ? pathname === "/" : pathname.startsWith(h);

  return (
    <header className="sticky top-0 z-30 border-b border-wire bg-abyss/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-4 py-3 sm:px-8 md:px-10">
        <Link
          href="/"
          aria-label="The Scout Room — home"
          className="flex-none flex items-baseline gap-2 text-chalk hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
        >
          <span className="font-display font-black text-base sm:text-lg tracking-tight leading-none">
            The Scout Room
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-gold/80 hidden sm:inline">
            ODI · Cortex
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-x-3 sm:gap-x-5 overflow-x-auto no-scrollbar">
          {NAV.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm font-medium text-chalk/60 hover:text-chalk transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={here(item.href) ? "page" : undefined}
                className={
                  "text-xs sm:text-sm font-medium transition-colors whitespace-nowrap " +
                  (here(item.href)
                    ? "text-gold"
                    : "text-chalk/60 hover:text-chalk")
                }
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
