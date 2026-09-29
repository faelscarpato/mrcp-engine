import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@mrcp/core/web/scraper-tools": path.resolve(
        import.meta.dirname,
        "packages/core/lib/web/scraper-tools.ts",
      ),
      "@mrcp/core/analysis/pipeline": path.resolve(
        import.meta.dirname,
        "packages/core/lib/analysis/pipeline.ts",
      ),
      "@mrcp/core/analysis/code-health": path.resolve(
        import.meta.dirname,
        "packages/core/lib/analysis/code-health.ts",
      ),
      "@mrcp/core/analysis/architecture-drift": path.resolve(
        import.meta.dirname,
        "packages/core/lib/analysis/architecture-drift.ts",
      ),
      "@mrcp/core": path.resolve(
        import.meta.dirname,
        "packages/core/lib/analysis/pipeline.ts",
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
  },
});
