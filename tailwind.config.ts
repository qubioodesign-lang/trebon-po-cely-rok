import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Teplé krémové odstíny podle zadání
        krem: {
          DEFAULT: "#FAF8F5",
          svetly: "#F7F6F3",
          tmavsi: "#F5F3EF",
        },
        text: {
          DEFAULT: "#2F2F2F",
          jemny: "#6B6B6B",
          velmiJemny: "#9A9A9A",
        },
        trebon: {
          modra: "#1B3A4B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Manrope", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        rukopis: ["var(--font-caveat)", "Caveat", "cursive"],
      },
      transitionTimingFunction: {
        klidny: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
