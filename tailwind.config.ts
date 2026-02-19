import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // ----------------------------------------------------------------
        // STATUS COLOR TOKENS — maps to hsl(var(--status-*)) in globals.css
        // Use as: bg-status-planned, text-status-completed, etc.
        // These are the DOT colors in status badges. Badge backgrounds and
        // text use standard Tailwind color classes (see constants.ts).
        // ----------------------------------------------------------------
        status: {
          unplanned: "hsl(var(--status-unplanned))",
          planned: "hsl(var(--status-planned))",
          confirmed: "hsl(var(--status-confirmed))",
          "in-progress": "hsl(var(--status-in-progress))",
          "picked-up": "hsl(var(--status-picked-up))",
          arrived: "hsl(var(--status-arrived))",
          completed: "hsl(var(--status-completed))",
          cancelled: "hsl(var(--status-cancelled))",
          rejected: "hsl(var(--status-rejected))",
          "no-show": "hsl(var(--status-no-show))",
          urgent: "hsl(var(--status-urgent))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // Layout dimension tokens exposed as Tailwind width values
      // Usage: w-panel-ride-list (operator left panel)
      width: {
        "panel-ride-list": "var(--panel-ride-list)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
