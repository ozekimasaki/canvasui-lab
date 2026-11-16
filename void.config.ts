import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: {
    routes: [],
    workers_dev: true,
    preview_urls: true,
  },
});
