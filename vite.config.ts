import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the same build works on GitHub Pages project sites,
// custom domains, and local file preview servers.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
