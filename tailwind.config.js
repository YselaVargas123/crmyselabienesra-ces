/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["'Hanken Grotesk'", "system-ui", "sans-serif"] },
      colors: {
        brand: "#003DA5",
        accent: "#D71D2D",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        app: "var(--app)",
        card: "var(--card)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        head: "var(--head)",
      },
    },
  },
  plugins: [],
};
