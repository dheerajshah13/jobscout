import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#152018",
        pine: "#1f5f47",
        moss: "#5f7f45",
        paper: "#f7f5ef",
        line: "#d9d7cc",
        coral: "#d95f4c"
      },
      boxShadow: {
        soft: "0 12px 34px rgba(21, 32, 24, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
