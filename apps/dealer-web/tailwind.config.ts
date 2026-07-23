import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "../../packages/shared-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F172A",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#0369A1",
          foreground: "#FFFFFF",
        },
        brand: {
          50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc",
          400: "#38bdf8", 500: "#0ea5e9", 600: "#0369A1", 700: "#075985",
          800: "#0c4a6e", 900: "#0F172A",
        },
        border: "#E2E8F0",
        muted: "#E8ECF1",
        background: "#F8FAFC",
        foreground: "#020617",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      transitionDuration: { DEFAULT: "150ms" },
    },
  },
  plugins: [],
};
export default config;
