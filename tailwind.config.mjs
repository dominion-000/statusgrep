/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // <alpha-value> enables bg-card/90, text-muted/60, etc.
        bg: "oklch(0.15 0.013 235 / <alpha-value>)",
        fg: "oklch(0.93 0.012 235 / <alpha-value>)",
        card: "oklch(0.185 0.015 235 / <alpha-value>)",
        muted: "oklch(0.66 0.02 235 / <alpha-value>)",
        brand: "oklch(0.8 0.17 156 / <alpha-value>)",
        brand2: "oklch(0.69 0.14 252 / <alpha-value>)",
        ok: "oklch(0.8 0.17 156 / <alpha-value>)",
        warn: "oklch(0.83 0.14 88 / <alpha-value>)",
        bad: "oklch(0.63 0.2 27 / <alpha-value>)",
        unknown: "oklch(0.6 0.02 260 / <alpha-value>)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.45s ease both",
        fadeIn: "fadeIn 0.25s ease both",
      },
    },
  },
  plugins: [],
};
