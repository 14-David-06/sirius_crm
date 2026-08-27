import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig, sin sumar un plugin.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Solo lógica pura: nada que toque Airtable ni el runtime de Next.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
