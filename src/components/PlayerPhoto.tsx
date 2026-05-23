"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";

// Build a 2-char initials fallback when no Wikipedia image is available.
function initialsOf(p: Player): string {
  const first = (p.firstName || "").trim();
  const last  = (p.lastName  || "").trim();
  if (!first && !last) return "??";
  if (!first) return last.slice(0, 2).toUpperCase();
  if (!last)  return first.slice(0, 2).toUpperCase();
  return (first[0] + last[0]).toUpperCase();
}

function paletteFor(p: Player): string {
  // Deterministic color from playerID so the same player always has the same backdrop.
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  const hues = [22, 38, 78, 142, 168, 206, 244, 284, 318];
  return `hsl(${hues[h % hues.length]} 32% 22%)`;
}

export default function PlayerPhoto({
  player, size = 64,
}: { player: Player & { wiki_image?: string }; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = (player as any).wiki_image as string | undefined;
  const showImg = src && !failed;
  const dim = `${size}px`;
  const bg  = paletteFor(player);

  return (
    <div
      className="relative shrink-0 rounded-md overflow-hidden ring-1 ring-white/[0.08]"
      style={{ width: dim, height: dim, background: bg }}
      aria-label={player.fullName}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={player.fullName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-black text-chalk/85 select-none"
                style={{ fontSize: `${Math.round(size * 0.42)}px`, letterSpacing: "-0.02em" }}>
            {initialsOf(player)}
          </span>
        </div>
      )}
    </div>
  );
}
