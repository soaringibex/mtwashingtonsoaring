import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The satellite panel renders live NOAA frames as plain <img> elements: every URL is
    // a fresh five-minute JPEG on a public CDN, so the image optimizer would only add
    // latency and spend its quota re-encoding them — and the panel needs explicit srcset
    // control to keep phone data use down.
    files: ["src/components/weather/SatellitePanel.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
