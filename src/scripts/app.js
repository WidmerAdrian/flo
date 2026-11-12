// Page behaviour: the sheet, region picking, the view switch, the dock and the opening-hours line.
// The 3D body is a separate chunk, loaded after first paint.
import { HOURS, REGIONS as R, TREATMENTS as T } from "../data/content.js";
import { mountWater } from "./water.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const chev = '<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg>';
const blk = (title, html) => `<section class="blk"><h4>${title}</h4>${html}</section>`;
const chips = (a, cls = "") => `<ul class="chips ${cls}">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;
/** "a, b, c und d": a short list read as a sentence, not as a heap of tags. */
const flow = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} und ${a.at(-1)}` : a[0] || "");

/* ── sheet ── */
const sheet = $("#sheet"), bodyEl = $("#sh-body"), title = $("#sh-title"), kick = $("#sh-kick"), back = $("#sh-back"), stage = $("#stage");
const head = $("#sh-head"), photo = $("#sh-photo"), scroller = $("#sh-scroll");
let region = null, body3d = null, timer = 0, keep = false;
const IMGS = JSON.parse(document.body.dataset.imgs || "{}"), hero = $("#koerper");

function show(kicker, name, html, { from = false, pic = "", kind = "" } = {}) {
  kick.textContent = kicker; title.textContent = name; bodyEl.innerHTML = html; scroller.scrollTop = 0; back.hidden = !from;
  head.className = `sh-head ${kind}${pic ? " has-photo" : ""}`;
  photo.hidden = !pic; if (pic) photo.src = pic;
  head.style.animation = "none"; head.offsetWidth; head.style.animation = ""; // replay the entrance when the content changes
  if (!sheet.open) sheet.showModal();
  scroller.scrollTop = 0; // after showModal: a closed dialog ignores scrollTop and would reopen where it was left
}
function mark(id) {
  region = id;
  $$("#regions button").forEach((b) => b.setAttribute("aria-current", b.dataset.region === id));
  body3d?.select(id, id ? (R[id].back ? true : ["brust", "bauch", "huefte"].includes(id) ? false : null) : null);
}
function regionSheet(id) {
  const r = R[id];
  show("Ihre Körperregion", r.label,
    `<p class="lead-s">${r.short}</p>` +
    blk("Typische Beschwerden", chips(r.sym.slice(0, 4), "hurt")) +
    blk("Passende Massagen", `<ul class="picks">${r.treats.map((t) => `<li><button class="pick" type="button" data-t="${t}">${IMGS[t] ? `<img src="${IMGS[t]}" alt="" loading="lazy">` : ""}<span>${T[t].name}</span>${chev}</button></li>`).join("")}</ul>`) +
    `<p class="aside"><b>Häufige Ursachen:</b> ${flow(r.causes)}.</p>` +
    `<p class="aside tip">${r.tip}</p>`, { kind: "region" });
}
/** A region was chosen: light it up on the body first, then bring the sheet. */
function pick(id, wait = 0) {
  clearTimeout(timer); mark(id);
  timer = setTimeout(() => regionSheet(id), wait);
}
function treatSheet(id, from) {
  const t = T[id];
  show("Massage", t.name,
    `<p class="lead-s">${t.what}</p>` +
    blk("So wirkt sie", `<ol class="steps">${t.how.map((h, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${h}</li>`).join("")}</ol>`) +
    `<p class="aside"><b>Hilft bei</b> ${flow(t.helps.slice(0, 4))}.</p>` +
    `<p class="aside tip">Von allen Krankenkassen anerkannt. Abgerechnet wird über die Zusatzversicherung.</p>`, { from, pic: IMGS[id] });
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-t]"), r = e.target.closest("[data-region]");
  if (t) treatSheet(t.dataset.t, sheet.open && region);
  else if (r && !r.classList.contains("spot")) {
    const inSheet = sheet.contains(r);
    if (inSheet) { keep = true; sheet.close(); $("#koerper").scrollIntoView({ block: "start" }); }
    pick(r.dataset.region, inSheet ? 700 : 420);
  } else if (e.target === sheet || e.target.closest("#sh-x")) sheet.close();
  else if (e.target.closest("#sh-back")) regionSheet(region);
});
sheet.addEventListener("close", () => { if (!keep) mark(null); keep = false; sheet.style.translate = ""; }); // a pick made from inside the sheet keeps its mark
/* pull the sheet down by its top to dismiss it */
const top = $("#sh-top"); let pull = null;
top.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) { pull = e.clientY; top.setPointerCapture(e.pointerId); sheet.classList.add("dragging"); } });
top.addEventListener("pointermove", (e) => { if (pull !== null) sheet.style.translate = `0 ${Math.max(0, e.clientY - pull)}px`; });
const drop = (e) => {
  if (pull === null) return;
  const far = e.clientY - pull > 90; pull = null; sheet.classList.remove("dragging");
  if (far) sheet.close(); else sheet.style.translate = "";
};
top.addEventListener("pointerup", drop); top.addEventListener("pointercancel", drop);

/* ── front / back ── */
const seg = $("#seg");
const setView = (v) => { seg.dataset.view = v; $$("button", seg).forEach((b, i) => b.setAttribute("aria-pressed", i === v)); };
seg.addEventListener("click", (e) => {
  const i = $$("button", seg).indexOf(e.target.closest("button"));
  if (i >= 0) { setView(i); body3d?.view(i === 1); }
});
stage.addEventListener("view", (e) => setView(e.detail));

/* ── the 3D body, after first paint ── */
const load = () => import("./body3d.js")
  .then((m) => m.mountBody(hero, stage, { labels: Object.fromEntries(Object.entries(R).map(([k, r]) => [k, r.label])), photo: stage.dataset.photo, onPick: (id) => pick(id, 620) }))
  .then((api) => { body3d = api; hero.classList.add("ready"); if (region) mark(region); })
  .catch(() => stage.classList.add("no3d")); // the outline and the region list still work
("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(load, { timeout: 1200 });

/* ── living water: leaves bent by water behind a section; the mouse stirs it into soft streaks, on phones an unseen hand
      glides by itself; the layers drift with it by their own depth (only their `translate`, so nothing else restyles) ── */
const still = matchMedia("(prefers-reduced-motion: reduce)"), touch = matchMedia("(hover: none)").matches;
function liveWater(section, canvas, photo, { fade, front = null, depth = [0, 0] } = {}) {
  const water = photo ? mountWater(canvas, photo, { auto: touch, fade, front }) : null;
  // the cut-out is drawn by the shader once ready (sub-pixel smooth); the page keeps its <img> only for layout
  if (water && front) canvas.addEventListener("front", () => section.classList.add("gl-front"), { once: true });
  if (water && front) {
    let q = false;
    const onScroll = () => { q = false; water.setScroll(Math.min(1, Math.max(0, scrollY / (section.offsetHeight || 1)))); };
    addEventListener("scroll", () => { if (!q) { q = true; requestAnimationFrame(onScroll); } }, { passive: true }); onScroll();
  }
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, raf = 0, last = 0, t = Math.random() * 20, onScreen = false, hand = false;
  const frame = (now) => {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
    if (touch || !hand) { tx = Math.sin(t * .23) * .55; ty = Math.cos(t * .17) * .4; } // no pointer: a slow breath
    vx += ((tx - x) * 60 - vx * 14) * dt; vy += ((ty - y) * 60 - vy * 14) * dt; x += vx * dt; y += vy * dt; // a soft spring
    water?.setFront(x * depth[0], y * depth[1]);
    water?.setOffset(-x * .014, y * .01);
    raf = onScreen && !still.matches ? requestAnimationFrame(frame) : 0;
  };
  const wake = () => { if (!raf && onScreen && !still.matches) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  section.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; hand = true;
    tx = u * 2 - 1; ty = v * 2 - 1; water?.stir(u, v); // hover: a hand through water, no rings
    wake();
  });
  section.addEventListener("pointerleave", () => { hand = false; });
  section.addEventListener("pointerdown", (e) => { const r = canvas.getBoundingClientRect(); water?.ripple((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1); });
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; wake(); }).observe(section);
}
const heroMedia = $(".hero-media"), thMedia = $(".th-media");
// everything that drifts is drawn in the shader: no element is moved by sub-pixel steps the browser would round
liveWater($(".hero"), $(".hero-gl"), heroMedia?.dataset.photo, { fade: [0, .45], front: $(".hero-person"), depth: [-26, -16] });
if (thMedia) liveWater($("#therapeut"), $(".th-gl"), thMedia.dataset.photo, { fade: [.3, .68] });

/* ── cards: the one underneath sinks back as the next slides over it ── */
{
  const cards = $$(".card");
  let queued = false;
  const update = () => {
    queued = false;
    for (let i = 0; i < cards.length - 1; i++) {
      const a = cards[i].getBoundingClientRect(), b = cards[i + 1].getBoundingClientRect();
      const cover = Math.min(1, Math.max(0, 1 - (b.top - a.top) / a.height));
      cards[i].style.setProperty("--cover", cover.toFixed(3));
    }
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ── splash: the logo flies onto the header's logo while the curtain lifts; the header's own logo stays hidden
      (CSS: body:has(.splash)) until the flying one covers it exactly, and both swap in one frame ── */
const splash = $(".splash");
if (splash && !still.matches) {
  setTimeout(() => {
    const logo = $(".splash-logo"), a = logo.getBoundingClientRect(), b = $("#brand img").getBoundingClientRect();
    const flow = getComputedStyle(document.documentElement).getPropertyValue("--flow").trim() || "ease-out";
    splash.classList.add("lift");
    logo.animate([{ transform: "none" }, { transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(${b.width / a.width})` }],
      { duration: 1000, easing: flow, fill: "forwards", composite: "add" }).finished.then(() => requestAnimationFrame(() => splash.remove()));
  }, Math.max(0, 1450 - performance.now()));
} else splash?.remove();

/* ── dock: shown once the stage has scrolled away ── */
const dock = $("#dock");
// hidden while the photo hero or the body is mostly on screen: both have their own calls to action
const seen = new Map();
const io = new IntersectionObserver((es) => { es.forEach((e) => seen.set(e.target, e.intersectionRatio)); dock.classList.toggle("on", [...seen.values()].every((r) => r < 0.3)); }, { threshold: [0, 0.3, 1] });
[".hero", "#koerper"].forEach((s) => io.observe($(s)));

/* ── opening hours, on the practice's clock (Europe/Zurich) ── */
const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
function status(d, t) {
  const h = HOURS[d];
  if (h && t >= h[0] && t < h[1]) return [true, `Jetzt geöffnet, bis ${h[1]} Uhr`];
  for (let k = 0; k < 8; k++) {
    const x = HOURS[(d + k) % 7];
    if (x && (k > 0 || t < x[0])) return [false, `Geschlossen, öffnet ${k === 0 ? "heute" : k === 1 ? "morgen" : "am " + DAYS[(d + k) % 7]} um ${x[0]} Uhr`];
  }
}
try {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), [open, text] = status(d, +p.hour + p.minute / 60);
    $("#status span").textContent = text;
  $$("#hours li").forEach((li) => li.classList.toggle("now", li.dataset.d.includes(d)));
} catch { /* the static line stays */ }
