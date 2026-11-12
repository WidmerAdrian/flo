// Turns the body model into the site's mesh: positions, normals, texture coordinates, a body region per vertex
// and a hotspot per region. Run: npm run model.
// Source: model/real/body.glb (textured MakeHuman figure, CC0, built by model/real/make_body.py), or, without it,
// model/body.glb (the untextured figure from scripts/body.blender.py).
// Writes public/assets/body.txt (the mesh, base64), public/assets/body-skin.webp (the texture, if any) and
// src/data/body-spots.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { MeshoptSimplifier } from "meshoptimizer";

const TARGET_TRIS = 36000; // the textured figure stays as built: simplifying across texture seams can tear them
export const REGIONS = ["", "nacken", "brust", "bauch", "ruecken", "arm", "hand", "huefte", "gesaess", "oberschenkel", "knie", "wade", "fuss"];
const R = Object.fromEntries(REGIONS.map((n, i) => [n, i]));

/* ── load: a GLB read by hand (one mesh, one primitive, no node transform), so no DOM or image decoder is needed ── */
const REAL = new URL("../model/real/body.glb", import.meta.url), PLAIN = new URL("../model/body.glb", import.meta.url);
const src = existsSync(REAL) ? REAL : PLAIN;
const glb = readFileSync(src), jlen = glb.readUInt32LE(12), G = JSON.parse(glb.subarray(20, 20 + jlen).toString());
const bin = glb.subarray(20 + jlen + 8);
const view = (i) => { const v = G.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
const accessor = (i) => {
  const a = G.accessors[i], b = view(a.bufferView), n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count;
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  return new T(b.buffer.slice(b.byteOffset + (a.byteOffset || 0), b.byteOffset + (a.byteOffset || 0) + n * T.BYTES_PER_ELEMENT));
};
const prim = G.meshes[0].primitives[0];
const P = accessor(prim.attributes.POSITION), N = accessor(prim.attributes.NORMAL), I = accessor(prim.indices), nvIn = P.length / 3;
const UV = prim.attributes.TEXCOORD_0 != null ? accessor(prim.attributes.TEXCOORD_0) : null;
if (G.images?.length) { // the skin: out of the GLB, into a webp next to the mesh
  const img = G.images[0], tmp = new URL(`../model/real/skin.${img.mimeType === "image/png" ? "png" : "jpg"}`, import.meta.url);
  writeFileSync(tmp, view(img.bufferView));
  execFileSync("cwebp", ["-quiet", "-q", "82", tmp.pathname, "-o", new URL("../public/assets/body-skin.webp", import.meta.url).pathname]);
}

/* ── regions: nearest limb of a stick figure laid into the body (x to the figure's left, y up, metres, 1.8 tall).
      Read the joints off model/preview-front.png if the model changes. ── */
const KNEE = 0.456, J = (s) => ({
  shoulder: [s * 0.2, 1.44], elbow: [s * 0.333, 1.133], wrist: [s * 0.418, 0.889], tip: [s * 0.458, 0.765],
  hip: [s * 0.1, 0.9], knee: [s * 0.155, KNEE], ankle: [s * 0.19, 0.078],
});
const STICKS = [["torso", [0, 0.86], [0, 1.5], 0.15], ["head", [0, 1.53], [0, 1.8], 0.085]];
for (const s of [1, -1]) { const j = J(s); STICKS.push(["arm", j.shoulder, j.elbow, 0.045], ["arm", j.elbow, j.wrist, 0.036], ["hand", j.wrist, j.tip, 0.032], ["leg", j.hip, j.knee, 0.08], ["leg", j.knee, j.ankle, 0.05]); }
function partAt(x, y) {
  let best = "", bd = 1e9;
  for (const [name, a, b, r] of STICKS) {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) - r;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}
// front or back by which side of the body's middle plane a point lies on: a clean split down the flanks
let zmid = 0, zn = 0; for (let i = 0; i < nvIn; i++) if (P[i * 3 + 1] > 0.9 && P[i * 3 + 1] < 1.4 && Math.abs(P[i * 3]) < 0.15) { zmid += P[i * 3 + 2]; zn++; } zmid /= zn;
function tag(i) {
  const x = P[i * 3], y = P[i * 3 + 1], front = P[i * 3 + 2] > zmid, part = partAt(x, y);
  if (part === "head") return y > 1.53 ? 0 : R.nacken;
  if (part === "hand") return R.hand;
  if (part === "arm") return y > 1.37 ? R.nacken : R.arm;   // the shoulder cap belongs to neck and shoulders
  if (part === "leg") return y < 0.1 ? R.fuss : Math.abs(y - KNEE) < 0.07 ? R.knie : y < KNEE ? R.wade : y > 0.83 ? (front ? R.huefte : R.gesaess) : R.oberschenkel;
  return y > 1.41 ? R.nacken : y >= 1.2 ? (front ? R.brust : R.ruecken) : y >= 1.03 ? (front ? R.bauch : R.ruecken) : front ? R.huefte : R.gesaess;
}
const reg = Array.from({ length: nvIn }, (_, i) => tag(i));

/* ── simplify (regions ride along as an attribute, so their borders survive) ── */
await MeshoptSimplifier.ready;
const si = I.length / 3 <= TARGET_TRIS * 1.25 ? I
  : MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(I), new Float32Array(P), 3, new Float32Array(reg), 1, [0.3], null, TARGET_TRIS * 3, 0.004)[0];
const remap = new Map(), outP = [], outN = [], outR = [], outI = [], outUV = [];
for (const i of si) {
  if (!remap.has(i)) { remap.set(i, outR.length); outP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); outN.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); outR.push(reg[i]); if (UV) outUV.push(UV[i * 2], UV[i * 2 + 1]); }
  outI.push(remap.get(i));
}

/* ── hotspots: per region and side, the surface point nearest the region's middle that faces the right way ── */
const spots = [], BACK = new Set([R.ruecken, R.gesaess]), SIDED = new Set([R.arm, R.hand, R.oberschenkel, R.knie, R.wade, R.fuss]);
for (let r = 1; r < REGIONS.length; r++) for (const s of SIDED.has(r) ? [-1, 1] : [0]) for (const dir of r === R.nacken || SIDED.has(r) ? [1, -1] : [BACK.has(r) ? -1 : 1]) {
  const ids = []; let cx = 0, cy = 0;
  for (let i = 0; i < outR.length; i++) if (outR[i] === r && (!s || Math.sign(outP[i * 3]) === s)) { ids.push(i); cx += outP[i * 3]; cy += outP[i * 3 + 1]; }
  if (!ids.length) continue;
  cx /= ids.length; cy /= ids.length;
  let best = -1, bd = 1e9;
  for (const i of ids) { if (outN[i * 3 + 2] * dir < 0.6) continue; const d = (outP[i * 3] - cx) ** 2 + (outP[i * 3 + 1] - cy) ** 2; if (d < bd) { bd = d; best = i; } }
  if (best >= 0) spots.push([r, +outP[best * 3].toFixed(3), +outP[best * 3 + 1].toFixed(3), +outP[best * 3 + 2].toFixed(3), dir]);
}

/* ── write: [u32 verts][u32 indices | 1<<31 if uv][i16 xyz * verts, in mm][u8 region * verts][i8 normal xyz * verts]
      [u16 indices][u16 uv * verts, 0..65535 = 0..1, only with a texture], as base64 ── */
const nv = outR.length, ni = outI.length, off = 8 + nv * 10, hasUV = outUV.length > 0;
if (nv > 65535) throw new Error("too many vertices for 16-bit indices: " + nv);
const out = Buffer.alloc(off + ni * 2 + (hasUV ? nv * 4 : 0));
out.writeUInt32LE(nv, 0); out.writeUInt32LE((ni | (hasUV ? 0x80000000 : 0)) >>> 0, 4);
for (let i = 0; i < nv * 3; i++) out.writeInt16LE(Math.round(outP[i] * 1000), 8 + i * 2);
for (let i = 0; i < nv; i++) out.writeUInt8(outR[i], 8 + nv * 6 + i);
for (let i = 0; i < nv * 3; i++) out.writeInt8(Math.max(-127, Math.min(127, Math.round(outN[i] * 127))), 8 + nv * 7 + i);
for (let i = 0; i < ni; i++) out.writeUInt16LE(outI[i], off + i * 2);
for (let i = 0; i < outUV.length; i++) out.writeUInt16LE(Math.round(Math.min(1, Math.max(0, outUV[i])) * 65535), off + ni * 2 + i * 2);
// ponytail: base64 text, because some static hosts and previews refuse application/octet-stream; write `out` raw as .bin if yours serves it
writeFileSync(new URL("../public/assets/body.txt", import.meta.url), out.toString("base64"));
writeFileSync(new URL("../src/data/body-spots.json", import.meta.url), JSON.stringify({ regions: REGIONS, spots }));
const count = REGIONS.map((n, r) => n && `${n} ${outR.filter((x) => x === r).length}`).filter(Boolean).join(", ");
console.log(`body.txt: ${nvIn} → ${nv} verts, ${ni / 3} tris, ${(out.length / 1024).toFixed(0)} KB raw; ${spots.length} hotspots\n${count}`);
