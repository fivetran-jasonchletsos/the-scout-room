import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#ffffff",
        paper: "#0F1419",
        cream: "#F5F7FA",
        accent: "#0073EA",
        ember: "#0058B0",
        muted: "#5F6B7A",
        slate: "#1F2D3F",
        umber: "#2D3F58",
        line:  "#E5E8EC",
        abyss: "#070912",
        deep:  "#0a0f1a",
        coal:  "#111726",
        wire:  "#1f2737",
        chalk: "#e9edf2",
        spark: "#3b9eff",
        flare: "#dc2626",
        mint:  "#10b981",
        // Scout Room palette additions — chalkboard greens and infield clay
        clay:  "#b45c3a",
        fairway: "#3f6b3a",
        chalkboard: "#1b2820",
        gold: "#d4a93f",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Helvetica", "Arial", "sans-serif"],
        display: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        orbit: {
          "0%":   { transform: "translate3d(0,0,0) scale(1)" },
          "50%":  { transform: "translate3d(2%, -3%, 0) scale(1.08)" },
          "100%": { transform: "translate3d(0,0,0) scale(1)" },
        },
        drift: {
          "0%":   { transform: "translate3d(0,0,0) scale(1)" },
          "50%":  { transform: "translate3d(-3%, 2%, 0) scale(1.1)" },
          "100%": { transform: "translate3d(0,0,0) scale(1)" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%":   { boxShadow: "0 0 0 0 rgba(212, 169, 63, 0.6)" },
          "70%":  { boxShadow: "0 0 0 10px rgba(212, 169, 63, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(212, 169, 63, 0)" },
        },
      },
      animation: {
        orbit:  "orbit 14s ease-in-out infinite",
        drift:  "drift 18s ease-in-out infinite",
        fadeUp: "fadeUp .55s ease-out both",
        pulseDot: "pulseDot 2.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
