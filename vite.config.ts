import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const pages = [
  "index.html",
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

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((page) => [page.replace(/\.html$/, ""), resolve(__dirname, page)]))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 8787
  }
});
