import { defineConfig } from "vite";

const inputs = {
  "run-discovery": "dist/scripts/run-discovery.js",
  "validate-discovery": "dist/scripts/validate-discovery.js",
  "run-comparison": "dist/scripts/run-comparison.js",
  "validate-comparison": "dist/scripts/validate-comparison.js",
};

// Self-contained Node job runners are executed in isolated /tmp workspaces by
// Vercel Workflow steps. This keeps their scientific source tree out of the
// function bundle while preserving the existing calculation implementations.
export default defineConfig({
  build: {
    outDir: "build/job-runners",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    lib: { entry: inputs, formats: ["es"], fileName: (_format, name) => `${name}.mjs` },
    rollupOptions: { external: [/^node:/] },
  },
});
