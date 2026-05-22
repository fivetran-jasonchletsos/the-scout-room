"use client";

import Link from "next/link";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-wire bg-abyss/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-4 py-3 sm:px-8 md:px-10">
        <Link
          href="/"
          aria-label="The Scout Room — home"
          className="flex-none flex items-baseline gap-2 text-chalk hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
        >
          <span className="font-display font-black text-lg sm:text-xl tracking-tight leading-none">
            The Scout Room
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-gold/80">
            ODI · Cortex
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-x-5 sm:gap-x-6">
          <a
            href="https://fivetran-jasonchletsos.github.io/Fivetran-Demo-Repository/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-chalk/65 hover:text-chalk transition-colors whitespace-nowrap"
          >
            Catalog
          </a>
          <a
            href="https://github.com/fivetran-jasonchletsos/the-scout-room"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-chalk/65 hover:text-chalk transition-colors whitespace-nowrap"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
