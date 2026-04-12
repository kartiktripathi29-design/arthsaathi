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
        brand: { DEFAULT: '#1A3C5E', dark: '#0F2640', light: '#E8F1FA' },
        accent: { DEFAULT: '#E67E22', light: '#FEF3E2' },
        success: { DEFAULT: '#1E8449', light: '#E9F7EF' },
        danger: { DEFAULT: '#C0392B', light: '#FDEDEC' },
      },
    },
  },
  plugins: [],
};
export default config;
