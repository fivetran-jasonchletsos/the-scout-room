import { META } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="border-t border-wire bg-abyss">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 md:px-10 py-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/40">
          Data: {META.source}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/40">
          {META.playerCount.toLocaleString()} players · {META.teamCount} franchises · {META.firstSeason}–{META.lastSeason}
        </p>
      </div>
    </footer>
  );
}
