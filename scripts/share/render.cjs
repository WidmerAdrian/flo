// Renders the link preview and the icons from the two HTML files next to this script.
// Needs playwright-core and a Chrome: node scripts/share/render.cjs [path to playwright-core]
const path = require("node:path"), { execFileSync } = require("node:child_process");
const { chromium } = require(process.argv[2] || "playwright-core");
const here = (f) => "file://" + path.join(__dirname, f), out = (f) => path.join(__dirname, "../../public", f);
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await og.goto(here("og.html")); await og.waitForTimeout(400);
  await og.screenshot({ path: out("og.png") });
  // [size, file, extra CSS]: transparent by default; apple-touch-icon stays opaque white (iOS fills transparency black)
  for (const [size, name, css] of [
    [180, "apple-touch-icon.png", "html, body { background: #fff } img { width: 74% }"],
    [192, "icon-192.png", ""],
    [512, "icon-512.png", ""],
    [48, "favicon-48.png", "img { width: 98% }"],
  ]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.goto(here("icon.html")); if (css) await p.addStyleTag({ content: css }); await p.waitForTimeout(200);
    await p.screenshot({ path: out(name), omitBackground: !name.startsWith("apple") });
  }
  await b.close();
  execFileSync("cwebp", ["-quiet", "-q", "82", out("og.png"), "-o", out("og.webp")]);
  // JPEG for the link preview: every messenger reads it (sips ships with macOS)
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", out("og.png"), "--out", out("og.jpg")], { stdio: "ignore" });
  require("node:fs").rmSync(out("og.png")); require("node:fs").rmSync(out("og.webp"));
  console.log("og.jpg and icons written to public/");
})();
