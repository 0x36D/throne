import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { livePlugin } from "./server/live-plugin.ts";

export default defineConfig({
  plugins: [
    react(),
    livePlugin(fileURLToPath(new URL("../../", import.meta.url))),
  ],
  server: { port: 4173, host: "127.0.0.1" },
});
