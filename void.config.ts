import { defineConfig } from "void/config";

export default defineConfig({
  head: {
    link: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  },
  cloudflare: {
    routes: [],
    workers_dev: true,
    preview_urls: true,
  },
});
