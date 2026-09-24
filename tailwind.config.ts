/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#f7f7f5",
        smoke: "#687276",
      },
      fontFamily: {
        body: ["BIZ UDPGothic", "Noto Serif JP", "Noto Sans JP", "serif"],
        mono: ["IBM Plex Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
