import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const legacyPages = [
  "network_practice.html",
  "network_info_security_practice.html",
  "network_data_collection_practice.html",
  "data_visualization_practice.html",
  "data_structure_practice.html",
  "linux_practice.html",
  "modern_history_practice.html",
  "community_practice.html",
  "higher_math_down_practice.html"
];

function legacyPageDevFallback(): Plugin {
  return {
    name: "legacy-page-dev-fallback",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const page = decodeURIComponent((req.url || "").split("?")[0].replace(/^\//, ""));
        if (!legacyPages.includes(page)) {
          next();
          return;
        }
        try {
          const source = await fs.readFile(resolve(__dirname, "index.html"), "utf8");
          const html = await server.transformIndexHtml(`/${page}`, source);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [legacyPageDevFallback(), react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html")
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 8787
  }
});
