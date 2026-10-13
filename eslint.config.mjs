import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The satellite panels render live NOAA/NASA frames as plain <img> elements: every
    // URL is a fresh image on a public CDN, so the image optimizer would only add
    // latency and spend its quota re-encoding them — and the panels need explicit
    // srcset control to keep phone data use down.
    files: [
      "src/components/weather/SatellitePanel.tsx",
      "src/components/weather/SatellitePasses.tsx",
    ],
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
