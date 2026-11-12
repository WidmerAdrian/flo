#!/usr/bin/env node
// Builds dist/index.html: one static file, no framework, no runtime dependencies.
// `node build.mjs`  — inlines the Hairline kernel, the six figures and the body SVG into src/page.html.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const FIGURES = ["kneten", "lymph", "schichten", "rolle", "sohle", "tape"];

/* ── body figure: traced outlines (src/body.json) + tap zones, as static SVG ── */
const B = JSON.parse(read("./src/body.json"));
const CX = 180;
const sym = (half) => [...half.map((p) => p.join(",")), ...half.slice(1, -1).reverse().map(([x, y]) => `${2 * CX - x},${y}`)].join(" ");
const ARM = "250,224 300,196 360,170 360,372 280,372 276,356 273,340 260,300 253,260";
const HAND = "280,372 360,372 360,470 295,470 290,440 284,422 283,404";
const NECK = sym([[180, 104], [360, 104], [360, 170], [300, 196], [250, 224], [214, 180], [180, 174]]);
const LEGS = (top) => [
  ["oberschenkel", "Oberschenkel", `180,${top} ${top === 422 ? "284,422 290,440" : "292,446"} 295,470 300,560 180,560`, 1],
  ["knie", "Knie", "180,560 300,560 300,622 180,622", 1],
  ["wade", "Waden und Unterschenkel", "180,622 300,622 300,726 180,726", 1],
  ["fuss", "Füsse und Sprunggelenk", "180,726 300,726 300,840 180,840", 1],
];
// [id, label, polygon, mirrored?]
const ZONES = {
  front: [
    ["nacken", "Nacken und Schultern", NECK],
    ["brust", "Brust und Rumpf", sym([[180, 174], [214, 180], [250, 224], [253, 260], [260, 300], [180, 300]])],
    ["bauch", "Bauch und Lymphe", sym([[180, 300], [260, 300], [273, 340], [276, 356], [180, 356]])],
    ["huefte", "Hüfte und Becken", sym([[180, 356], [276, 356], [280, 372], [283, 404], [284, 422], [180, 422]])],
    ["arm", "Arme und Ellbogen", ARM, 1],
    ["hand", "Hände und Handgelenke", HAND, 1],
    ...LEGS(422),
  ],
  back: [
    ["nacken", "Nacken und Schultern", NECK],
    ["ruecken", "Rücken und Wirbelsäule", sym([[180, 174], [214, 180], [250, 224], [253, 260], [260, 300], [273, 340], [276, 356], [180, 356]])],
    ["arm", "Arme und Ellbogen", ARM, 1],
    ["hand", "Hände und Handgelenke", HAND, 1],
    ["gesaess", "Gesäss und Becken", sym([[180, 356], [276, 356], [280, 372], [283, 404], [284, 422], [290, 440], [292, 446], [180, 446]])],
    ...LEGS(446),
  ],
};
function face(view) {
  const f = view === "front", k = f ? "f" : "b", tf = f ? B.tfFront : B.tfBack;
  const zones = ZONES[view].map(([id, label, pts, mirror]) =>
    `<g class="zone" data-id="${id}" tabindex="0" role="button" aria-label="${label}"><polygon points="${pts}"/>${mirror ? `<polygon points="${pts}" transform="matrix(-1 0 0 1 360 0)"/>` : ""}</g>`).join("");
  return `<svg class="face ${view}" viewBox="0 0 360 840" role="group" aria-label="${f ? "Körper von vorne" : "Körper von hinten"}"${f ? "" : " inert"}>
<defs><path id="${k}1" d="${f ? B.frontBody : B.back}" transform="${tf}"/>${f ? `<path id="f2" d="${B.frontHead}" transform="${tf}"/>` : ""}<clipPath id="${k}c"><use href="#${k}1"/>${f ? `<use href="#f2"/>` : ""}</clipPath></defs>
<use class="skin" href="#${k}1"/><g class="zones" clip-path="url(#${k}c)">${zones}</g><use class="line" href="#${k}1"/>${f ? `<use class="skin line" href="#f2"/><circle class="hint" cx="180" cy="150" r="9"/>` : ""}
</svg>`;
}

/* ── figures: each file in its own block, so their top-level names cannot collide ── */
const figures = FIGURES.filter((n) => existsSync(new URL(`./figures/${n}.js`, import.meta.url)))
  .map((n) => `{\n${read(`./figures/${n}.js`).trim()}\n}`).join("\n");

const out = read("./src/page.html")
  .replace("<!--BODY-->", () => face("front") + face("back"))
  .replace("/*KERNEL*/", () => read("./vendor/hairline-kernel.js").trim())
  .replace("/*FIGURES*/", () => figures);
writeFileSync(new URL("./dist/index.html", import.meta.url), out);
console.log(`dist/index.html ${(out.length / 1024).toFixed(1)} KB, figures: ${figures ? FIGURES.filter((n) => out.includes(`name: "${n}"`)).join(" ") : "none"}`);
