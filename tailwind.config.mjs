/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        ink: "#081c15",
        pine: "#1b4332",
        moss: "#2d6a4f",
        sage: "#95d5b2",
        mist: "#d8f3dc",
        ember: "#e76f51",
        gold: "#f4a261",
        cream: "#f7f3e9"
      },
      boxShadow: {
        soft: "0 18px 40px rgba(8, 28, 21, 0.08)",
        panel: "0 12px 30px rgba(8, 28, 21, 0.12)"
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "sans-serif"],
        display: ["Iowan Old Style", "Palatino Linotype", "Book Antiqua", "serif"]
      }
    }
  },
  plugins: []
};
