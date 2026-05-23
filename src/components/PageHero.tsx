export default function PageHero({
  eyebrow, title, lede, accent = "#d4a93f",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  accent?: string;
}) {
  return (
    <header className="hero-deep relative">
      <div aria-hidden className="pointer-events-none">
        <div className="orb animate-orbit"
             style={{ top: "-140px", left: "-100px", width: "440px", height: "440px",
                      background: `radial-gradient(circle at 30% 30%, ${accent}66, transparent 70%)` }} />
      </div>
      <div className="relative z-[2] mx-auto max-w-6xl px-4 sm:px-8 md:px-10 pt-9 pb-7">
        <p className="eyebrow" style={{ color: accent }}>{eyebrow}</p>
        <h1 className="mt-3 h-display text-chalk text-3xl sm:text-4xl md:text-5xl max-w-4xl">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3 max-w-3xl text-[15px] text-chalk/70 leading-relaxed">{lede}</p>
        ) : null}
      </div>
      <div className="hairline-deep" />
    </header>
  );
}
