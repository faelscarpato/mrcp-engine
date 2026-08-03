import { defineConfig } from "vite";
// Removed UI plugin imports

export default defineConfig({
  plugins: [],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "EVAL" &&
          warning.message.includes("web-tree-sitter")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
