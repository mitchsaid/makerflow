import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Only for `pnpm reader:experiment`: the experiment is not among the normal tests (vitest.config.mts).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.experiment.ts"], environment: "node" },
});
