import { defineConfig } from "astro/config";

// Static output, relative asset URLs so the built folder works from any path.
export default defineConfig({
  build: { format: "file", assets: "static", assetsPrefix: ".", inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
