"use client";

import { useMemo, useState } from "react";
import type { Franchise, Player } from "@/lib/types";
import { STATES, CITIES, TEAM_LOCATIONS } from "@/lib/data";
import { buildScoutReport, DEFAULT_RADIUS_MI, type ScoutReport } from "@/lib/scoutEngine";
import PlayerPhoto from "./PlayerPhoto";
import { CareerTimeline, Donut, POS_COLOR, Radar, StackedBars, StateTileMap, type StackedRow } from "./charts";

export default function ScoutRoom({ teams }: { teams: Franchise[] }) {
  const [city, setCity]           = useState<string>("");
  const [stateCode, setStateCode] = useState<string>("");
  const [radiusMi, setRadiusMi]   = useState<number>(DEFAULT_RADIUS_MI);
  const [franchOverride, setFranchOverride] = useState<string>("");
  const [showOverride, setShowOverride]     = useState<boolean>(false);
  const [report, setReport]                 = useState<ScoutReport | null>(null);
  const [generating, setGenerating]         = useState(false);

  // Distinct city names for the autocomplete — limited to the curated set
  // we have coords for. Users can still type free-form; unmatched cities
  // fall back to state-level search inside the engine.
  const cityOptions = useMemo(() => {
    const filtered = stateCode ? CITIES.filter((c) => c.state === stateCode) : CITIES;
    return filtered.map((c) => c.city).sort((a, b) => a.localeCompare(b));
  }, [stateCode]);

  const canGenerate = city.trim().length > 0 && stateCode;

  const onGenerate = () => {
    if (!canGenerate) return;
    setGenerating(true);
    setTimeout(() => {
      const r = buildScoutReport({
        city: city.trim(),
        state: stateCode,
        radiusMi,
        franchIDOverride: franchOverride || undefined,
      });
      setReport(r);
      setGenerating(false);
      setTimeout(() => {
        document.getElementById("report-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, 750);
  };

  // When user changes the override, regenerate immediately (no spinner)
  const onOverrideChange = (id: string) => {
    setFranchOverride(id);
    if (!canGenerate) return;
    const r = buildScoutReport({
      city: city.trim(),
      state: stateCode,
      radiusMi,
      franchIDOverride: id || undefined,
    });
    setReport(r);
  };

  return (
    <div>
      {/* Input row */}
      <div className="chalk-panel p-5 sm:p-6">
        <div className="relative z-[1]">
          <p className="eyebrow">Step 1 · Tell the scout your hometown</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr,200px,160px] gap-4">
            <Field label="City">
              <input type="text"
                     list="scout-cities"
                     value={city}
                     onChange={(e) => setCity(e.target.value)}
                     placeholder="e.g. Tampa, San Antonio, Long Beach"
                     className="select-deep" />
              <datalist id="scout-cities">
                {cityOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="State">
              <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="select-deep">
                <option value="">— pick a state —</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={`Radius (${radiusMi} mi)`}>
              <input type="range" min={25} max={150} step={5}
                     value={radiusMi}
                     onChange={(e) => setRadiusMi(Number(e.target.value))}
                     className="w-full accent-gold" />
            </Field>
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <button type="button" onClick={onGenerate} disabled={!canGenerate || generating} className="btn-gold">
              {generating ? (
                <><span className="scout-dot" /><span>Scouts working...</span></>
              ) : (
                <><SvgIcon /><span>Generate Scout Report</span></>
              )}
            </button>
            {report ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
                Latest: {report.team?.name} × {report.hometownInput.city}, {report.stateCode}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                We'll infer your team from the nearest MLB city.
              </span>
            )}
          </div>

          {/* Inferred-team chip + override */}
          {report ? (
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
                  Inferred team
                </span>
                <span className="rounded-md border border-gold/40 bg-gold/[0.08] px-3 py-1.5 font-display font-bold text-chalk text-sm">
                  {report.teamInference.inferredTeam.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
                  {report.teamInference.basis === "hometown"
                    ? `${Math.round(report.teamInference.distanceMi)} mi from ${report.hometownInput.city}`
                    : report.teamInference.basis === "override"
                      ? "manually overridden"
                      : "state fallback"}
                </span>
                <button type="button" onClick={() => setShowOverride((v) => !v)}
                        className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85 underline underline-offset-2 hover:text-gold">
                  {showOverride ? "hide" : "wrong team?"}
                </button>
              </div>
              {showOverride ? (
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <select value={franchOverride}
                          onChange={(e) => onOverrideChange(e.target.value)}
                          className="select-deep">
                    <option value="">— use inferred —</option>
                    {teams.map((t) => (
                      <option key={t.franchID} value={t.franchID}>
                        {t.name} · {t.wsTitles} WS · since {t.yearFirst}
                      </option>
                    ))}
                  </select>
                  {report.teamInference.runnersUp.length > 0 && report.teamInference.basis !== "state-fallback" ? (
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/45">
                      Next closest: {report.teamInference.runnersUp.slice(0, 2).map((r) =>
                        `${r.team.name} (${Math.round(r.distanceMi)} mi)`
                      ).join(" · ")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
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
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-chalk/65 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SvgIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Report rendering
// ─────────────────────────────────────────────────────────────────────

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
  const where = report.hometownInput.matched
    ? `${report.hometownInput.city}, ${report.stateCode}`
    : report.stateName;
  return (
    <div className="rounded-xl border border-gold/40 bg-gradient-to-r from-gold/[0.12] to-transparent p-5 sm:p-6">
      <p className="eyebrow">
        Scout Report · {report.team?.name ?? "—"} × {where}
        {report.hometownInput.matched ? (
          <span className="ml-2 text-chalk/45">· {report.radiusMi} mi radius</span>
        ) : (
          <span className="ml-2 text-chalk/45">· state-level (no coords for &quot;{report.hometownInput.city}&quot;)</span>
        )}
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
          <span className="font-mono text-[10.5px] tabular-nums text-gold/85 tracking-[0.18em]">{num}</span>
          <h3 className="font-display font-black text-chalk text-xl sm:text-2xl tracking-tight">{title}</h3>
          {badge ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-chalk/50">{badge}</span>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 01 Hometown Heroes — photos + career timelines
// ─────────────────────────────────────────────────────────────────────

function SectionHometown({ report }: { report: ScoutReport }) {
  const where = report.hometownInput.matched
    ? `${report.hometownInput.city}, ${report.stateCode}`
    : report.stateName;
  if (report.hometown.length === 0) {
    return (
      <Section num="01" title="Hometown Heroes" badge={`No top-tier MLB careers near ${where} in the Lahman set`}>
        <p className="text-chalk/65 text-sm">
          No qualifying players within {report.radiusMi} mi of {where}.
          {!report.hometownInput.matched ? " (Falling back to state-level was also empty.)" : ""}
        </p>
      </Section>
    );
  }
  const badge = report.hometownInput.matched
    ? `Top ${report.hometown.length} within ${report.radiusMi} mi of ${where}`
    : `Top ${report.hometown.length} from ${report.stateName}`;
  return (
    <Section num="01" title="Hometown Heroes" badge={badge}>
      <ol className="space-y-3">
        {report.hometown.map((h) => (
          <li key={h.player.id} className="card-deep p-4 sm:p-5">
            <div className="flex gap-4">
              <PlayerPhoto player={h.player} size={72} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-mono text-[11px] tabular-nums text-gold/85">#{h.rank}</span>
                    <span className="font-display font-bold text-chalk text-lg sm:text-xl">
                      {h.player.fullName}
                    </span>
                    {h.player.primaryPos ? (
                      <span className="chip-pos">{h.player.primaryPos}</span>
                    ) : null}
                    {h.player.hof ? <span className="chip-pos chip-hof">HOF</span> : null}
                    {h.player.allStarSelections >= 3 ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">
                        {h.player.allStarSelections}× All-Star
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/50">
                    {fmtCareer(h.player)} · CV {h.player.careerValue.toLocaleString()}
                    {h.distanceMi !== null ? (
                      <span className="ml-2 text-gold/80">· {Math.round(h.distanceMi)} mi</span>
                    ) : null}
                  </span>
                </div>
                <p className="mt-2 text-sm text-chalk/75 leading-relaxed">{h.insight}</p>
              </div>
            </div>
            <CareerTimeline debutYear={h.player.debutYear} finalYear={h.player.finalYear} />
            <PlayerStrip player={h.player} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 02 Prospect Persona — donut + position cards
// ─────────────────────────────────────────────────────────────────────

function SectionPersona({ report }: { report: ScoutReport }) {
  if (report.persona.length === 0) {
    return (
      <Section num="02" title="Prospect Persona" badge="No archetype data for this franchise">
        <p className="text-chalk/65 text-sm">No qualifying archetype data.</p>
      </Section>
    );
  }
  const slices = report.persona.map((p) => ({
    label: p.position,
    value: p.count,
    color: POS_COLOR[p.position] ?? "#6b7280",
  }));
  // Build stacked-bar rows for the franchise timeline. We keep the position
  // order stable so colors don't reshuffle decade-to-decade.
  const posOrder = report.persona.map((p) => p.position);
  const seenPos = new Set(posOrder);
  for (const row of report.timeline.rows) {
    for (const pos of Object.keys(row.byPosition)) {
      if (!seenPos.has(pos)) { posOrder.push(pos); seenPos.add(pos); }
    }
  }
  const stackedRows: StackedRow[] = report.timeline.rows.map((r) => ({
    label: `${(r.decadeStart % 100).toString().padStart(2, "0")}s`,
    segments: posOrder
      .map((pos) => ({ key: pos, value: r.byPosition[pos] ?? 0, color: POS_COLOR[pos] ?? "#6b7280" }))
      .filter((s) => s.value > 0),
  }));
  const peakLabel = report.timeline.peakDecade !== null
    ? `${(report.timeline.peakDecade % 100).toString().padStart(2, "0")}s`
    : undefined;

  return (
    <Section num="02" title="Prospect Persona" badge="What kind of player has historically worked for this franchise">
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-5">
        <div className="card-deep p-4 flex items-center justify-center">
          <Donut slices={slices} />
        </div>
        <div className="space-y-2.5">
          {report.persona.map((p) => (
            <div key={p.position} className="card-deep p-3.5 flex gap-3">
              {p.topExample ? <PlayerPhoto player={p.topExample} size={52} /> : (
                <div className="w-[52px] h-[52px] rounded-md shrink-0 flex items-center justify-center"
                     style={{ background: `${POS_COLOR[p.position]}22`, border: `1px solid ${POS_COLOR[p.position]}55` }}>
                  <span className="font-mono font-bold text-chalk text-sm">{p.position}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <span className="chip-pos">{p.position}</span>
                    <span className="font-display font-bold text-chalk text-sm">
                      {p.count} of the inner 30
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-chalk/50 tabular-nums">
                    {Math.round((p.count / 30) * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-chalk/70 leading-snug">{p.insight}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decade timeline — when the inner-30 was actually active */}
      {stackedRows.length > 0 ? (
        <div className="mt-5 card-deep p-4 sm:p-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
              Inner-30 careers active by decade · stacked by primary position
            </p>
            <p className="font-mono text-[10px] tabular-nums text-chalk/55">
              {report.timeline.rows.length} decades · peak {peakLabel ?? "—"}
            </p>
          </div>
          <p className="text-[13px] text-chalk/70 leading-snug mb-3">{report.timeline.insight}</p>
          <StackedBars rows={stackedRows} peakLabel={peakLabel} />
        </div>
      ) : null}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 03 Hidden Comp — photos + side-by-side stat bars
// ─────────────────────────────────────────────────────────────────────

function SectionComp({ report }: { report: ScoutReport }) {
  if (!report.comp) {
    return (
      <Section num="03" title="Hidden Comp" badge="No qualifying comp at the threshold">
        <p className="text-chalk/65 text-sm">
          We couldn't find a candidate similar enough to your franchise legend within your state in the bundled set.
        </p>
      </Section>
    );
  }
  const { anchor, candidate, similarity, anchorProfile, candidateProfile } = report.comp;

  const radarAxes = anchorProfile.axes.map((a) => a.label);
  const radarSeries = [
    { label: anchor.fullName,    color: "#d4a93f", values: anchorProfile.axes.map((a) => a.pct) },
    { label: candidate.fullName, color: "#3b9eff", values: candidateProfile.axes.map((a) => a.pct) },
  ];

  return (
    <Section num="03" title="Hidden Comp" badge={`${Math.round(similarity * 100)}% similar · era-adjusted`}>
      <p className="text-sm text-chalk/75 leading-relaxed mb-4">{report.comp.insight}</p>

      {/* Player headshot pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CompCard label="Cooperstown anchor"   player={anchor}    accent="gold" />
        <CompCard label="Same shape, no plaque" player={candidate} accent="spark" />
      </div>

      {/* Radar + axis breakdown */}
      <div className="mt-5 card-deep p-4 sm:p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chalk/55">
            Era-adjusted profile · {anchorProfile.era} cohort · percentile rings
          </p>
          <p className="font-mono text-[10px] tabular-nums text-chalk/55">
            cosine(z) = {similarity.toFixed(3)}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-4 items-center">
          <Radar axes={radarAxes} series={radarSeries} />
          <CompAxisTable report={report} />
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">
          <span><span style={{ color: "#d4a93f" }}>●</span> {anchor.lastName} (anchor)</span>
          <span><span style={{ color: "#3b9eff" }}>●</span> {candidate.lastName} (candidate)</span>
          <span className="text-chalk/40">values are within-era percentiles (0–100)</span>
        </div>
      </div>
    </Section>
  );
}

function CompAxisTable({ report }: { report: ScoutReport }) {
  const comp = report.comp!;
  const rows = comp.anchorProfile.axes.map((a, i) => {
    const c = comp.candidateProfile.axes[i];
    const delta = a.pct - c.pct;
    const tight = Math.abs(delta) <= 5;
    const wide  = Math.abs(delta) >= 25;
    return { axis: a, cand: c, delta, tight, wide };
  });
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr,auto,auto,auto] gap-x-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-chalk/45 pb-1.5 border-b border-white/[0.05]">
        <span>Axis</span>
        <span className="text-right" style={{ color: "#d4a93f" }}>Anch</span>
        <span className="text-right" style={{ color: "#3b9eff" }}>Cand</span>
        <span className="text-right">Δ</span>
      </div>
      {rows.map(({ axis, cand, delta, tight, wide }) => (
        <div key={axis.key}
             className="grid grid-cols-[1fr,auto,auto,auto] gap-x-3 items-baseline">
          <span className="font-mono text-[11px] text-chalk/75">{axis.label}</span>
          <span className="font-display font-bold text-chalk text-sm tabular-nums text-right">{axis.pct}</span>
          <span className="font-display font-bold text-chalk text-sm tabular-nums text-right">{cand.pct}</span>
          <span className={`font-mono text-[11px] tabular-nums text-right ${
            tight ? "text-emerald-300/80" : wide ? "text-rose-300/80" : "text-chalk/55"
          }`}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        </div>
      ))}
      <div className="pt-2 mt-1.5 border-t border-white/[0.05] font-mono text-[9.5px] tracking-[0.15em] text-chalk/45 leading-relaxed">
        green = within 5 percentile points · rose = 25+ apart
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 04 Did You Know — + state ranking bar
// ─────────────────────────────────────────────────────────────────────

function SectionDidYouKnow({ report }: { report: ScoutReport }) {
  if (report.didYouKnow.length === 0) return null;

  const sd = report.stateDensity;
  const tileCells = sd.rows.map((r) => ({ code: r.code, count: r.count, quintile: r.quintile }));

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
            {d.detail ? <p className="mt-2 text-sm text-chalk/65 leading-relaxed">{d.detail}</p> : null}
          </li>
        ))}
        <li className="card-deep p-4 sm:p-5">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-gold/80">
            Geography · your state vs every other
          </p>
          <p className="mt-1.5 font-display font-bold text-chalk text-base sm:text-lg leading-snug">
            {report.stateName} ranks #{sd.userRank} of {sd.rows.length} in top-100 player production
          </p>
          <p className="mt-2 text-sm text-chalk/65 leading-relaxed">{sd.insight}</p>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-4 items-start">
            <StateTileMap cells={tileCells} userCode={report.stateCode} />
            <div className="space-y-2 min-w-[200px]">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-chalk/55">
                Density legend
              </p>
              <div className="space-y-1">
                {[4, 3, 2, 1, 0].map((q) => (
                  <div key={q} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm border border-white/10"
                          style={{ background: ["rgba(255,255,255,0.04)", "rgba(212,169,63,0.16)", "rgba(212,169,63,0.32)", "rgba(212,169,63,0.55)", "rgba(240,210,127,0.85)"][q] }} />
                    <span className="font-mono text-[10px] text-chalk/65">
                      {q === 4 ? "Top 20%" : q === 0 ? "None / bottom" : `${["", "20-40%", "40-60%", "60-80%", ""][q]}`}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 mt-1 border-t border-white/[0.06] space-y-1">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-chalk/45">Top state</p>
                <p className="font-display font-bold text-chalk text-sm">
                  {sd.topState?.name ?? "—"} · {sd.topState?.count ?? 0}
                </p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-chalk/45 pt-1">Your state</p>
                <p className="font-display font-bold text-gold text-sm">
                  {report.stateName} · {sd.rows.find((r) => r.code === report.stateCode)?.count ?? 0}
                </p>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 05 Narrative
// ─────────────────────────────────────────────────────────────────────

function SectionNarrative({ report }: { report: ScoutReport }) {
  return (
    <Section num="05" title="The Closing" badge="CORTEX.COMPLETE in production — template here">
      <p className="text-base text-chalk/85 leading-relaxed">{report.narrative}</p>
      <div className="mt-5 rounded-lg border border-gold/30 bg-gold/[0.04] p-3 sm:p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/85">In Snowflake</p>
        <pre className="mt-1.5 font-mono text-[12px] text-chalk/80 leading-relaxed overflow-x-auto">
{`SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'claude-3-5-sonnet',
  CONCAT(
    'Write a 4-sentence scout report combining these findings:',
    OBJECT_CONSTRUCT(
      'team',     :team_name,
      'state',    :state_name,
      'hometown', :hometown_top_five,
      'persona',  :archetype_breakdown,
      'comp',     :hidden_comp_pair
    )::STRING
  )
) AS narrative;`}
        </pre>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────

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
  const colorMain = accent === "gold" ? "#d4a93f" : "#3b9eff";
  return (
    <div className="card-deep p-4 sm:p-5" style={{ borderColor: color }}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.22em]" style={{ color: colorMain }}>
        {label}
      </p>
      <div className="mt-2 flex gap-3">
        <PlayerPhoto player={player} size={80} />
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-bold text-chalk text-lg leading-tight">
            {player.fullName}
            {player.hof ? <span className="chip-pos chip-hof ml-2">HOF</span> : null}
          </h4>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/55">
            {fmtCareer(player)} · {player.primaryPos ?? "—"}
          </p>
          {player.birthCity ? (
            <p className="mt-0.5 font-mono text-[10px] text-chalk/50">
              {player.birthCity}, {player.birthState}
            </p>
          ) : null}
        </div>
      </div>
      <CareerTimeline debutYear={player.debutYear} finalYear={player.finalYear} />
    </div>
  );
}

function fmtCareer(p: Player): string {
  if (!p.debutYear) return "";
  if (!p.finalYear || p.finalYear === p.debutYear) return `${p.debutYear}`;
  return `${p.debutYear}–${p.finalYear}`;
}
