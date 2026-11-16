import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { workflow } from "workflow/vite";

// Production-only full-stack build. Local development keeps the established
// Vite proxy + scripts/app-api.mjs workflow in vite.config.ts.
export default defineConfig({
  plugins: [nitro({
    preset: "vercel",
    serverDir: "./server",
    vercel: {
      functions: { runtime: "nodejs22.x", maxDuration: 300, includeFiles: "build/job-runners/**" },
    },
  }), workflow(), react()],
  root: ".",
});
