import ScoutRoom from "@/components/ScoutRoom";
import { META, TEAMS } from "@/lib/data";

export default function Home() {
  return (
    <main>
      <header className="hero-deep relative">
        <div aria-hidden className="pointer-events-none">
          <div className="orb animate-orbit"
               style={{ top: "-160px", left: "-120px", width: "520px", height: "520px",
                        background: "radial-gradient(circle at 30% 30%, rgba(212,169,63,0.55), rgba(212,169,63,0) 70%)" }} />
          <div className="orb animate-drift"
               style={{ top: "20%", right: "-180px", width: "540px", height: "540px",
                        background: "radial-gradient(circle at 60% 50%, rgba(63,107,58,0.5), rgba(63,107,58,0) 70%)" }} />
        </div>

        <div className="relative z-[2] mx-auto max-w-6xl px-4 sm:px-8 md:px-10 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold animate-fadeUp">
            Snowflake Cortex · Iceberg · Fivetran ODI
          </p>
          <h1 className="mt-3 h-display text-chalk text-[clamp(2.4rem,6.5vw,5rem)] max-w-4xl animate-fadeUp"
              style={{ animationDelay: "60ms" }}>
            Tell us your team and where you're from<span className="text-gold">.</span>
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] sm:text-base text-chalk/70 leading-relaxed animate-fadeUp"
             style={{ animationDelay: "120ms" }}>
            150 years of MLB history, blended with the city you grew up in and the laundry you root for.
            One <strong className="text-chalk">Scout Report</strong> — five sections — built fresh on every click.
            Hometown heroes, franchise prospect persona, a Hall-of-Fame comp you've probably never heard of,
            and a closing narrative the data wrote itself.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 animate-fadeUp" style={{ animationDelay: "180ms" }}>
            <Stat value={META.playerCount} label="Players in the lake" />
            <Stat value={META.teamCount}   label="Active franchises" />
            <Stat value={META.hofCount}    label="Hall of Famers" />
            <Stat value={META.lastSeason - META.firstSeason} label="Years of history" />
          </div>
        </div>
        <div className="hairline-deep" />
      </header>

      <section className="bg-abyss">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 md:px-10 py-8 sm:py-10">
          <ScoutRoom teams={TEAMS} />
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display font-black text-chalk text-2xl sm:text-3xl leading-none tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-chalk/55">{label}</span>
    </div>
  );
}
