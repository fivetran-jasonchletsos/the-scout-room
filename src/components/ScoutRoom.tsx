"use client";

import { useState, useMemo } from "react";
import type { Franchise, Player } from "@/lib/types";
import { STATES } from "@/lib/data";
import { buildScoutReport, type ScoutReport } from "@/lib/scoutEngine";

export default function ScoutRoom({ teams }: { teams: Franchise[] }) {
  const [franchID, setFranchID]   = useState<string>("");
  const [stateCode, setStateCode] = useState<string>("");
  const [report, setReport]       = useState<ScoutReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const canGenerate = franchID && stateCode;

  const onGenerate = () => {
    if (!canGenerate) return;
    setGenerating(true);
    // Tiny delay so the user sees the agents "thinking" — feels less instant.
    setTimeout(() => {
      const r = buildScoutReport(franchID, stateCode);
      setReport(r);
      setGenerating(false);
      // Scroll the report into view
      setTimeout(() => {
        document.getElementById("report-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, 750);
  };

  return (
    <div>
      {/* Input row */}
      <div className="chalk-panel p-5 sm:p-6">
        <div className="relative z-[1]">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
            Step 1 · Tell the scout where you stand
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Your team">
              <select
                value={franchID}
                onChange={(e) => setFranchID(e.target.value)}
                className="select-deep"
              >
                <option value="">— pick a franchise —</option>
                {teams.map((t) => (
                  <option key={t.franchID} value={t.franchID}>
                    {t.name} · {t.wsTitles} WS · since {t.yearFirst}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Where you grew up">
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="select-deep"
              >
                <option value="">— pick a state —</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className="btn-gold"
            >
              {generating ? (
                <>
                  <span className="scout-dot" />
                  <span>Scouts working...</span>
                </>
              ) : (
                <>
                  <SvgIcon />
                  <span>Generate Scout Report</span>
                </>
              )}
            </button>
            {report ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
                Latest: {report.team?.name} × {report.stateName}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                No two reports are the same.
              </span>
            )}
          </div>
        </div>
      </div>

      <div id="report-anchor" />

      {report ? <ReportView report={report} /> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-chalk/65 block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function SvgIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Report rendering
// ─────────────────────────────────────────────────────────────────────────

function ReportView({ report }: { report: ScoutReport }) {
  return (
    <div className="mt-8 space-y-6">
      <ReportHeader report={report} />
      <SectionHometown report={report} />
      <SectionPersona  report={report} />
      <SectionComp     report={report} />
      <SectionDidYouKnow report={report} />
      <SectionNarrative report={report} />
    </div>
  );
}

function ReportHeader({ report }: { report: ScoutReport }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gradient-to-r from-gold/[0.12] to-transparent p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
        Scout Report · {report.team?.name ?? "—"} × {report.stateName}
      </p>
      <h2 className="mt-2 h-display text-chalk text-3xl sm:text-4xl">
        Five findings the data wrote itself<span className="text-gold">.</span>
      </h2>
      {report.signature ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-chalk/55">
          {report.signature}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  num, title, badge, children,
}: { num: string; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="chalk-panel p-5 sm:p-6">
      <div className="relative z-[1]">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-[10.5px] tabular-nums text-gold/85 tracking-[0.18em]">
            {num}
          </span>
          <h3 className="font-display font-black text-chalk text-xl sm:text-2xl tracking-tight">
            {title}
          </h3>
          {badge ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-chalk/50">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function SectionHometown({ report }: { report: ScoutReport }) {
  if (report.hometown.length === 0) {
    return (
      <Section num="01" title="Hometown Heroes" badge="No top-tier MLB careers from this state in the Lahman set">
        <p className="text-chalk/65 text-sm">No qualifying players for {report.stateName} in the bundled dataset.</p>
      </Section>
    );
  }
  return (
    <Section num="01" title="Hometown Heroes" badge={`Top ${report.hometown.length} from ${report.stateName}`}>
      <ol className="space-y-3">
        {report.hometown.map((h) => (
          <li key={h.player.id} className="card-deep p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-[11px] tabular-nums text-gold/85">#{h.rank}</span>
                <span className="font-display font-bold text-chalk text-lg sm:text-xl">
                  {h.player.fullName}
                </span>
                {h.player.primaryPos ? <span className="chip-pos">{h.player.primaryPos}</span> : null}
                {h.player.hof ? <span className="chip-pos chip-hof">HOF</span> : null}
                {h.player.allStarSelections >= 3 ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">
                    {h.player.allStarSelections}× All-Star
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/50">
                {fmtCareer(h.player)} · CV {h.player.careerValue.toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-sm text-chalk/75 leading-relaxed">{h.insight}</p>
            <PlayerStrip player={h.player} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

function SectionPersona({ report }: { report: ScoutReport }) {
  if (report.persona.length === 0) {
    return (
      <Section num="02" title="Prospect Persona" badge="No archetype data for this franchise">
        <p className="text-chalk/65 text-sm">No qualifying archetype data.</p>
      </Section>
    );
  }
  const total = report.persona.reduce((n, p) => n + p.count, 0) || 1;
  return (
    <Section num="02" title="Prospect Persona" badge="What kind of player has historically worked for this franchise">
      <div className="space-y-3">
        {report.persona.map((p) => {
          const pct = Math.round((p.count / 30) * 100);
          return (
            <div key={p.position} className="card-deep p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3">
                  <span className="chip-pos text-base">{p.position}</span>
                  <span className="font-display font-bold text-chalk text-base">
                    {p.count} of the inner-circle 30
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/50 tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-gold/80 rounded-full"
                     style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2.5 text-sm text-chalk/75 leading-relaxed">{p.insight}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SectionComp({ report }: { report: ScoutReport }) {
  if (!report.comp) {
    return (
      <Section num="03" title="Hidden Comp" badge="No qualifying comp at the threshold">
        <p className="text-chalk/65 text-sm">
          We couldn't find a candidate similar enough to your franchise legend within your state in the bundled set.
          Cortex's semantic embeddings would expand this search across all 19,000+ players in a real account.
        </p>
      </Section>
    );
  }
  const { anchor, candidate, similarity } = report.comp;
  return (
    <Section num="03" title="Hidden Comp" badge={`${Math.round(similarity * 100)}% similar`}>
      <p className="text-sm text-chalk/75 leading-relaxed mb-4">{report.comp.insight}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CompCard label="Cooperstown anchor" player={anchor} accent="gold" />
        <CompCard label="Same shape, no plaque" player={candidate} accent="spark" />
      </div>
    </Section>
  );
}

function SectionDidYouKnow({ report }: { report: ScoutReport }) {
  if (report.didYouKnow.length === 0) return null;
  return (
    <Section num="04" title="Did You Know" badge="Three things you can't unsee">
      <ul className="space-y-3">
        {report.didYouKnow.map((d, i) => (
          <li key={i} className="card-deep p-4 sm:p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-gold/80">
              {d.kind === "history" ? "Franchise history" : d.kind === "geo" ? "Geography" : "Leaderboard"}
            </p>
            <p className="mt-1.5 font-display font-bold text-chalk text-base sm:text-lg leading-snug">
              {d.headline}
            </p>
            {d.detail ? (
              <p className="mt-2 text-sm text-chalk/65 leading-relaxed">{d.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SectionNarrative({ report }: { report: ScoutReport }) {
  return (
    <Section num="05" title="The Closing" badge="CORTEX.COMPLETE in production — template here">
      <p className="text-base text-chalk/85 leading-relaxed">
        {report.narrative}
      </p>
      <div className="mt-5 rounded-lg border border-gold/30 bg-gold/[0.04] p-3 sm:p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85">
          In Snowflake
        </p>
        <pre className="mt-1.5 font-mono text-[12px] text-chalk/80 leading-relaxed overflow-x-auto">
{`SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'claude-3-5-sonnet',
  CONCAT(
    'Write a 4-sentence scout report combining these findings:',
    OBJECT_CONSTRUCT(
      'team',       :team_name,
      'state',      :state_name,
      'hometown',   :hometown_top5,
      'persona',    :archetype_breakdown,
      'comp',       :hidden_comp_pair
    )::STRING
  )
) AS narrative;`}
        </pre>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────

function PlayerStrip({ player }: { player: Player }) {
  const bt = player.battingTotals;
  const pt = player.pitchingTotals;
  const stats: { label: string; val: number | string }[] = [];
  if (player.primaryPos === "P" && pt) {
    stats.push(
      { label: "W",  val: pt.W ?? 0 },
      { label: "SO", val: (pt.SO ?? 0).toLocaleString() },
      { label: "G",  val: (pt.G ?? 0).toLocaleString() },
    );
  } else {
    stats.push(
      { label: "H",   val: (bt.H ?? 0).toLocaleString() },
      { label: "HR",  val: bt.HR ?? 0 },
      { label: "RBI", val: (bt.RBI ?? 0).toLocaleString() },
    );
  }
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-1.5">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-1.5">
          <span className="font-display font-bold text-chalk text-base tabular-nums">{s.val}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-chalk/45">{s.label}</span>
        </div>
      ))}
      {player.birthCity ? (
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] text-chalk/60 truncate">
            {player.birthCity}, {player.birthState}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function CompCard({ label, player, accent }: { label: string; player: Player; accent: "gold" | "spark" }) {
  const color = accent === "gold" ? "rgba(212,169,63,0.5)" : "rgba(59,158,255,0.5)";
  return (
    <div className="card-deep p-4 sm:p-5" style={{ borderColor: color }}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.22em]"
         style={{ color: accent === "gold" ? "#d4a93f" : "#3b9eff" }}>
        {label}
      </p>
      <h4 className="mt-1 font-display font-bold text-chalk text-lg sm:text-xl">
        {player.fullName} {player.hof ? <span className="chip-pos chip-hof ml-2">HOF</span> : null}
      </h4>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">
        {fmtCareer(player)} · {player.primaryPos ?? "—"} · {player.birthCity}, {player.birthState}
      </p>
      <PlayerStrip player={player} />
    </div>
  );
}

function fmtCareer(p: Player): string {
  if (!p.debutYear) return "";
  if (!p.finalYear || p.finalYear === p.debutYear) return `${p.debutYear}`;
  return `${p.debutYear}–${p.finalYear}`;
}
