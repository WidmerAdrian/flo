// The body section's WebGL layer: slow water behind (water.js; an optional photograph refracts in it) and the
// 3D body in front (one static mesh, public/assets/body.txt, prepared by scripts/make-body.mjs).
// Loaded lazily; draws only while the hero is on screen.
import {
  BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, FrontSide, Group, SRGBColorSpace, HemisphereLight, Mesh, MeshStandardMaterial,
  OrthographicCamera, PerspectiveCamera, Vector4, PlaneGeometry, Raycaster, Scene, ShaderMaterial, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from "three";
import spotsData from "../data/body-spots.json";
import { WATER } from "./water.js";

const REG = spotsData.regions;
const css = (el, name) => new Color(getComputedStyle(el).getPropertyValue(name).trim());


export async function mountBody(hero, stage, { labels, photo, onPick }) {
  const canvas = hero.querySelector("canvas.gl"), spotsEl = stage.querySelector(".spots");
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.autoClear = false;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, visible = true, asleep = true, last = 0, ready = false; // declared first: the photo can finish loading while the mesh is still on its way

  /* water */
  const water = new ShaderMaterial({
    uniforms: { t: { value: 0 }, res: { value: new Vector2(1, 1) }, off: { value: new Vector2(0, 0) }, rp: { value: [0, 1, 2, 3].map(() => new Vector4(0, 0, -1, 0)) }, img: { value: null }, ia: { value: 1 }, has: { value: 0 }, pm: { value: 0.62 }, fade: { value: new Vector4(0, .32, .66, 0) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    // the water fades itself out at the top and bottom (alpha), so the figure in front of it never fades with it
    fragmentShader: WATER, defines: { FADE: "" }, depthTest: false, depthWrite: false,
  });
  const back = new Scene(), flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  back.add(new Mesh(new PlaneGeometry(2, 2), water));
  if (photo) new TextureLoader().load(photo, (tex) => { water.uniforms.img.value = tex; water.uniforms.ia.value = tex.image.width / tex.image.height; water.uniforms.has.value = 1; wake(); });

  /* body */
  const b64 = await (await fetch(new URL("assets/body.txt", document.baseURI))).text();
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const [nv, head] = new Uint32Array(buf, 0, 2), ni = head & 0x7fffffff, hasUV = head >>> 31 === 1; // top bit: texture coordinates follow
  const q = new Int16Array(buf, 8, nv * 3), tag = new Uint8Array(buf, 8 + nv * 6, nv);
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) pos[i] = q[i] / 1000;
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute("normal", new BufferAttribute(new Int8Array(buf, 8 + nv * 7, nv * 3), 3, true)); // the model's own smooth normals
  geo.setIndex(new BufferAttribute(new Uint16Array(buf, 8 + nv * 10, ni), 1));
  if (hasUV) geo.setAttribute("uv", new BufferAttribute(new Uint16Array(buf, 8 + nv * 10 + ni * 2, nv * 2), 2, true));
  geo.computeBoundingSphere();
  const scene = new Scene(), body = new Group();
  // with a skin texture the vertex colours multiply it: white leaves the skin as it is, the pick colour reddens it
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: hasUV ? 0.58 : 0.62, metalness: 0, alphaTest: hasUV ? 0.5 : 0, side: hasUV ? DoubleSide : FrontSide });
  if (hasUV) await new Promise((done) => new TextureLoader().load(new URL("assets/body-skin.webp", document.baseURI).href, (tex) => { tex.colorSpace = SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4; mat.map = tex; mat.needsUpdate = true; done(); }, undefined, done));
  const mesh = new Mesh(geo, mat);
  mesh.position.y = -0.9;
  body.add(mesh);
  scene.add(body);
  const hemi = new HemisphereLight(0xfffaf0, 0x1d4a3a, hasUV ? 1.1 : 0.9), key = new DirectionalLight(0xfff3e4, hasUV ? 2.4 : 2.0), rim = new DirectionalLight(0x90c0b0, hasUV ? 2.4 : 3.2), fill = new DirectionalLight(0xbfe3d6, 0.5); // sage rim, green bounce: the body stands in the page's light
  key.position.set(1.4, 2.4, 3); rim.position.set(2.4, 1.0, -2.6); fill.position.set(-3, 0.6, 0.6);
  scene.add(hemi, key, rim, fill);
  const camera = new PerspectiveCamera(24, 1, 0.1, 20);

  /* colour: each region glows towards the pick colour, and eases there */
  const col = geo.attributes.color, glow = new Float32Array(REG.length), want = new Float32Array(REG.length);
  const clay = hasUV ? new Color(1, 1, 1) : css(hero, "--body"), tint = hasUV ? new Color(1, .42, .26) : css(hero, "--body-pick"), c = new Color();
  let active = 0, hover = 0, painted = false;
  // the mesh's neighbours, so a region's colour can fade out over a few vertices instead of stopping in steps
  const idx = geo.index.array, nbStart = new Uint32Array(nv + 1), deg = new Uint32Array(nv);
  for (let i = 0; i < idx.length; i++) deg[idx[i]] += 2;
  for (let i = 0; i < nv; i++) nbStart[i + 1] = nbStart[i] + deg[i];
  const nb = new Uint32Array(nbStart[nv]), cur = nbStart.slice(0, nv);
  for (let f = 0; f < idx.length; f += 3) for (let k = 0; k < 3; k++) { const a = idx[f + k]; nb[cur[a]++] = idx[f + (k + 1) % 3]; nb[cur[a]++] = idx[f + (k + 2) % 3]; }
  let wA = new Float32Array(nv), wB = new Float32Array(nv);
  function paint(dt) {
    let busy = false;
    for (let r = 1; r < REG.length; r++) {
      want[r] = r === active ? 0.95 : r === hover ? 0.4 : 0;
      const d = want[r] - glow[r];
      if (Math.abs(d) > 0.004) { glow[r] += d * Math.min(1, dt * 7); busy = true; } else glow[r] = want[r];
    }
    if (!busy && painted) return false;
    for (let i = 0; i < nv; i++) wA[i] = glow[tag[i]];
    for (let pass = 0; pass < 4; pass++) { // a few rounds of averaging with the neighbours: a soft edge, a few centimetres wide
      for (let i = 0; i < nv; i++) { let sum = wA[i], n = 1; for (let j = nbStart[i]; j < nbStart[i + 1]; j++) { sum += wA[nb[j]]; n++; } wB[i] = sum / n; }
      [wA, wB] = [wB, wA];
    }
    for (let i = 0; i < nv; i++) { c.copy(clay).lerp(tint, wA[i]); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true; painted = true;
    return busy;
  }

  /* hotspots: small buttons that ride on the surface and hide when they face away.
     Limbs get one each, alternating sides down the body, so the figure is not peppered with them. */
  const SIDE = { arm: 1, hand: -1, oberschenkel: 1, knie: -1, wade: 1, fuss: -1 };
  const spots = spotsData.spots.filter(([r, x]) => !SIDE[REG[r]] || Math.sign(x) === SIDE[REG[r]]).map(([r, x, y, z, dir]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "spot"; b.dataset.region = REG[r];
    b.setAttribute("aria-label", labels[REG[r]] || REG[r]);
    spotsEl.append(b);
    return { b, p: new Vector3(x, y - 0.9, z), n: new Vector3(0, 0, dir), shown: null };
  });
  const v = new Vector3(), nrm = new Vector3();
  function placeSpots() {
    for (const s of spots) {
      nrm.copy(s.n).applyEuler(body.rotation);
      const show = nrm.z > 0.35;
      if (show !== s.shown) { s.shown = show; s.b.classList.toggle("off", !show); s.b.tabIndex = show ? 0 : -1; }
      if (!show) continue;
      v.copy(s.p).applyEuler(body.rotation).project(camera);
      s.b.style.transform = `translate3d(${((v.x + 1) / 2 * box.w).toFixed(1)}px,${((1 - v.y) / 2 * box.h).toFixed(1)}px,0)`;
    }
  }

  /* size: the canvas fills the hero; the body is drawn into the stage's rectangle inside it */
  const box = { x: 0, y: 0, w: 1, h: 1 };
  let W = 1, H = 1;
  function resize() {
    const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    W = hr.width; H = hr.height;
    Object.assign(box, { x: sr.left - hr.left, y: sr.top - hr.top, w: sr.width, h: sr.height });
    renderer.setSize(W, H, false);
    water.uniforms.res.value.set(W, H);
    camera.aspect = box.w / box.h;
    const k = Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(0, 0.02, Math.max(1.05 / k, 0.56 / k / camera.aspect)); // fit the height, and the width on narrow stages
    camera.updateProjectionMatrix();
    wake();
  }
  new ResizeObserver(resize).observe(hero);

  /* motion: yaw follows a target on a spring; idle adds a slow sway */
  let yaw = 0.7, vel = 0, base = 0, drag = null, t = 0, idle = true;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; // a frame's timestamp can predate the wake() that asked for it
    if (!still.matches) t += dt;
    if (!drag) {
      const target = base + (idle && !still.matches ? Math.sin(t * 0.5) * 0.4 : 0);
      vel += ((target - yaw) * 22 - vel * 8.5) * dt; yaw += vel * dt;
    }
    body.rotation.y = yaw;
    const u = water.uniforms;
    u.t.value = t; for (const r of u.rp.value) if (r.z >= 0) r.z = r.z > 6 ? -1 : r.z + dt;
    paint(dt);
    renderer.setViewport(0, 0, W, H); renderer.clear();
    renderer.render(back, flat);
    renderer.setViewport(box.x, H - box.y - box.h, box.w, box.h); renderer.clearDepth();
    renderer.render(scene, camera);
    placeSpots();
    if (visible && !still.matches) raf = requestAnimationFrame(frame); else asleep = true; // the water never stops, so neither does the loop while visible
  }
  function wake() { if (ready && !raf && visible) { if (asleep) last = performance.now(); asleep = false; raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) wake(); }).observe(hero);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) wake(); });

  /* picking */
  const ray = new Raycaster(), ptr = new Vector2();
  function regionAt(e) {
    const r = stage.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(mesh, false)[0];
    return hit ? tag[hit.face.a] : 0;
  }
  function ripple(e) {
    const r = hero.getBoundingClientRect();
    const k = water.uniforms.rp.value; k.unshift(k.pop().set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, 0, 1));
    wake();
  }
  const nearest = (a) => Math.round((yaw - a) / (2 * Math.PI)) * 2 * Math.PI + a;

  stage.addEventListener("pointerdown", (e) => { if (!e.target.closest(".spot")) drag = { x: e.clientX, yaw, on: false, lx: e.clientX, lt: e.timeStamp, v: 0 }; });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) {
      if (e.pointerType === "mouse") { const r = regionAt(e); if (r !== hover) { hover = r; stage.style.cursor = r ? "pointer" : ""; wake(); } }
      return;
    }
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) < 8) return;
    if (!drag.on) { drag.on = true; stage.setPointerCapture(e.pointerId); stage.classList.add("dragging"); }
    yaw = drag.yaw + dx * 0.011;
    drag.v = ((e.clientX - drag.lx) * 0.011) / Math.max(1, e.timeStamp - drag.lt) * 1000; drag.lx = e.clientX; drag.lt = e.timeStamp;
  });
  const up = (e) => {
    if (!drag) return;
    if (drag.on) {
      stage.classList.remove("dragging");
      vel = drag.v; base = Math.round((yaw + vel * 0.18) / Math.PI) * Math.PI; // carry the flick, then settle on the nearer of front and back
      stage.dispatchEvent(new CustomEvent("view", { detail: Math.abs(Math.round(base / Math.PI)) % 2 }));
    } else if (e.type === "pointerup") { ripple(e); const r = regionAt(e); if (r) onPick(REG[r]); }
    drag = null;
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("pointerleave", () => { hover = 0; });
  spotsEl.addEventListener("click", (e) => { const b = e.target.closest(".spot"); if (b) { ripple(e); onPick(b.dataset.region); } });

  ready = true; resize(); paint(1);
  return {
    /** Highlights a region (or none). back: true or false turns it to face the viewer; null leaves the turn alone. */
    select(name, back) {
      active = name ? REG.indexOf(name) : 0; idle = !name;
      if (name && back != null) { base = nearest(back ? Math.PI : 0); stage.dispatchEvent(new CustomEvent("view", { detail: back ? 1 : 0 })); }
      stage.classList.toggle("has-pick", !!name);
      wake();
    },
    view(back) { base = nearest(back ? Math.PI : 0); wake(); },
  };
}
