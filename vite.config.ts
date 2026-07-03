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
  "higher_math_down_practice.html",
  "linear_algebra_practice.html"
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
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("\\react\\") || id.includes("\\react-dom\\")) {
            return "react-vendor";
          }
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("katex") ||
            id.includes("micromark") ||
            id.includes("unified") ||
            id.includes("mdast-") ||
            id.includes("hast-") ||
            id.includes("unist-")
          ) {
            return "markdown-vendor";
          }
          return "vendor";
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 8787,
    proxy: {
      "/dev.html": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
