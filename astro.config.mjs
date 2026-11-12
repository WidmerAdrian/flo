import { defineConfig } from "astro/config";

// Static output, relative asset URLs so the built folder works from any path.
export default defineConfig({
  // The public address: link previews, canonical links and the sitemap need it absolute. Change it to the final domain.
  site: "https://flo-hazel.vercel.app",
  build: { format: "file", assets: "static", assetsPrefix: ".", inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
