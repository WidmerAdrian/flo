/**
 * Knie: a leg lying stretched out, the knee a touch bent, cut off mid-thigh
 * (far) and mid-shin (near): one round limb, thick at the thigh, swelling at the
 * knee and the calf, with the kneecap standing proud as a round pad. Three tape strips lie on its upper
 * surface: two long ones that part round the kneecap, and a short one across
 * just below it. The pointer's place along the leg says how far from the knee
 * the tape is stuck down; the strips grow out from the knee on one clamped
 * spring, and the cross strip comes last. Dots along the near strip count its
 * length. At rest the strips are a third on and the kneecap's rim is bright;
 * with the pointer on the stage the bright goes to the strips' leading ends.
 * The slider is the far reach of the strips, in world units from the knee.
 *
 * The pattern: one continuous number. A spring, a clamp, a hit test on the
 * kneecap's line along the skin (which never moves), and a limb drawn by hand
 * as a round solid: its outline is where its surface turns away from the camera.
 */
const {
  Cam, clamp, lerp, rad, fit, proj, hull, poly, open,
  spring, stepS, mk, place, pointer, register, disposer,
} = HL;

const L = 165, XK = 86, A0 = rad(45), TAU = Math.PI * 2; // the leg along x; the knee; the angle round the axis the kneecap faces
const RK = 8, PROUD = 2.4, B = 1.5;                      // the kneecap: radius, how far it stands out, the crease inset
const W = 6, D0 = 5, D1 = 13.5, SG = 12;                 // the tape: width, a long strip's distance from the top line, and round the kneecap
const XC = XK + 13, HC = 11.5, CROSS = 0.88;             // the cross strip: where, its half length, and the share of the way at which it starts
const SHIN = 0.8, L0 = 4, REST = 0.33, STEP = 9, DOTS = 8; // the shin side's share, the shortest strip, rest, and the dots' spacing
const KB = 0.2, CB = 14;                                 // the bend at the knee: each run's slope, and how round the corner is

/** The limb's radius at x: a thigh that thins towards the knee, the knee, the calf. */
const girth = (x) => 12.5 + 11.5 * Math.max(0, 1 - x / L) ** 1.7 + 3.4 * Math.exp(-(((x - XK) / 11) ** 2)) + 3 * Math.exp(-(((x - XK - 38) / 17) ** 2));
const slope = (x) => girth(x + 0.5) - girth(x - 0.5);
/** How far the limb's axis stands towards the kneecap's side at x: two straight runs and a round corner, the knee a little bent. */
const bend = (x) => -KB * (Math.hypot(x - XK, CB) - CB), lean = (x) => bend(x + 0.5) - bend(x - 0.5);
/** A world point on the limb at x, at angle a round its axis, lifted off the skin by `lift`. */
const skin = (x, a, lift = 0) => {
  const r = girth(x) + lift, b = bend(x);
  return [x, b * Math.cos(A0) + r * Math.cos(a), b * Math.sin(A0) + r * Math.sin(a)];
};
/** A point of the skin's own map: x along the leg, s the way round it from the top line, in world units. */
const on = ([x, s]) => skin(x, A0 + s / girth(x), 0.4);
/** A long strip's distance from the top line at x: it swings out round the kneecap. */
const mid = (x) => D0 + (D1 - D0) * Math.exp(-(((x - XK) / SG) ** 2));
const steps = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

/** A band of half width h round a centre line of [x, s] points: its outline, round at both ends, and the two end arcs. */
function band(line, h = W / 2) {
  const n = line.length - 1, left = [], right = [];
  const dir = (i) => {
    const a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, n)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  line.forEach((p, i) => {
    const [dx, dy] = dir(i);
    left.push([p[0] - dy * h, p[1] + dx * h]); right.push([p[0] + dy * h, p[1] - dx * h]);
  });
  const cap = (i, sg) => {
    const [dx, dy] = dir(i), p = line[i];
    return steps(8, (t) => {
      const c = sg * h * Math.cos(t * Math.PI), s = sg * h * Math.sin(t * Math.PI);
      return [p[0] - c * dy + s * dx, p[1] + c * dx + s * dy];
    });
  };
  const end = cap(n, 1), start = cap(0, -1);
  return { outline: [...left, ...end, ...right.reverse(), ...start], ends: [end, start] };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.15), box = [];
  for (let x = 0; x <= L; x += 15) for (let k = 0; k < 24; k++) box.push(skin(x, (k * TAU) / 24));
  box.push(skin(XK, A0, PROUD + 2));
  fit(C, box, 200, 166);
  const P = proj(C), pts = (w) => w.map((p) => P(p[0], p[1], p[2]));

  // P is linear, so the direction it flattens, the way to the camera, is the cross product of its axes.
  const o = P(0, 0, 0), ax = (p) => [p[0] - o[0], p[1] - o[1]], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const ex = ax(P(1, 0, 0)), ey = ax(P(0, 1, 0)), ez = ax(P(0, 0, 1));
  const vx = cross(ey, ez), vy = cross(ez, ex), vz = cross(ex, ey);
  // The limb's outline is where the skin's normal is square to the view: two angles round the axis at each x.
  const rim = (x, sg) => {
    const a = vy - lean(x) * Math.cos(A0) * vx, b = vz - lean(x) * Math.sin(A0) * vx;
    return Math.atan2(b, a) + sg * Math.acos(clamp((slope(x) * vx) / Math.hypot(a, b), -1, 1));
  };
  const ring = (x, a0, a1, lift) => steps(24, (t) => skin(x, lerp(a0, a1, t), lift));

  let reach = value, over = null, drawn = NaN, lit = -1;
  const sp = spring(REST);

  // Back to front: the limb, the long strips on it, their dots, the cross strip over them, then the kneecap, nearest the eye.
  const g = mk("g", {}, svg);
  mk("path", { class: "sil", d: poly(pts([
    ...steps(120, (t) => skin(t * L, rim(t * L, 1))),           // the upper outline, thigh to shin
    ...ring(L, rim(L, 1), rim(L, -1) + TAU, 0),                 // round the cut face of the shin, which looks at the camera
    ...steps(120, (t) => skin(L - t * L, rim(L - t * L, -1))),  // the lower outline, back to the thigh
    ...ring(0, rim(0, -1), rim(0, 1), 0),                       // the thigh's cut, seen from behind: only its near edge
  ])) }, g);
  mk("path", { class: "lo nf", d: open(pts(ring(L, rim(L, -1), rim(L, 1), -B))) }, g);
  const far = mk("path", {}, g), near = mk("path", {}, g);
  const dots = [];
  for (let j = 1; j <= DOTS; j++) for (const x of [XK - j * STEP, XK + j * STEP * SHIN]) {
    const el = mk("circle", { r: 1.3, class: "dot off" }, g);
    place(el, P(...on([x, -mid(x)])));
    dots.push({ el, j });
  }
  const across = mk("path", {}, g);
  const lead = mk("path", { class: "nf" }, g); // the strips' leading ends, drawn again so they alone can take the bright stroke

  // The kneecap: a round pad on the skin at the knee, standing out along the limb's radius there.
  const kc = skin(XK, A0), tn = [0, -Math.sin(A0), Math.cos(A0)], up = [0, Math.cos(A0), Math.sin(A0)];
  const pad = (r, h, t0, t1) => steps(40, (t) => {
    const a = lerp(t0, t1, t), c = r * Math.cos(a), s = r * Math.sin(a);
    return [kc[0] + c, kc[1] + s * tn[1] + h * up[1], kc[2] + s * tn[2] + h * up[2]];
  });
  const T0 = Math.atan2(tn[1] * vy + tn[2] * vz, vx); // the side of the pad's edge that faces the camera
  const knee = mk("path", { class: "sil hi", d: poly(hull(pts(pad(RK, -1.2, 0, TAU).concat(pad(RK, PROUD, 0, TAU))))) }, g);
  mk("path", { class: "lo nf", d: open(pts(pad(RK - B, PROUD, T0 - Math.PI / 2, T0 + Math.PI / 2))) }, g);

  const len = (u) => lerp(L0, reach, u);
  const path = (b) => poly(pts(b.outline.map(on)));

  function draw(u) {
    if (u === drawn) return;
    drawn = u;
    const l = len(u), xa = XK - l, xb = XK + l * SHIN, n = Math.ceil((xb - xa) / 3) + 1;
    const bands = [1, -1].map((sg) => band(steps(n, (t) => [lerp(xa, xb, t), sg * mid(lerp(xa, xb, t))])));
    far.setAttribute("d", path(bands[0]));
    near.setAttribute("d", path(bands[1]));
    const hc = HC * clamp((u - CROSS) / (1 - CROSS), 0, 1);
    if (hc > 0) bands.push(band(steps(8, (t) => [XC, lerp(-hc, hc, t)]), Math.min(W / 2, hc))); // it starts as a point, so it never pops in
    across.setAttribute("d", hc > 0 ? path(bands[2]) : "");
    lead.setAttribute("d", bands.map((b) => b.ends.map((e) => open(pts(e.map(on)))).join("")).join(""));
    const now = Math.floor((l + 0.01) / STEP);
    if (now === lit) return;
    lit = now;
    for (const d of dots) { d.el.classList.toggle("off", d.j > lit); d.el.classList.toggle("m", d.j <= lit); }
  }

  const loop = register(stage, (dt) => {
    const m = stepS(sp, dt);
    draw(clamp(sp.x, 0, 1));
    return m;
  });
  bag.add(loop.unregister);

  // The pointer is dropped onto the kneecap's line along the skin, which never moves: its distance from the knee is the strip's length.
  const e2 = ex[0] ** 2 + ex[1] ** 2;
  const q = ((Math.cos(A0) * ey[0] + Math.sin(A0) * ez[0]) * ex[0] + (Math.cos(A0) * ey[1] + Math.sin(A0) * ez[1]) * ex[1]) / e2;
  function retarget() {
    if (over) {
      const xp = ((over[0] - o[0]) * ex[0] + (over[1] - o[1]) * ex[1]) / e2;
      let x = xp;
      for (let i = 0; i < 6; i++) x = xp - (bend(x) + girth(x)) * q; // that line is not straight, so its point is found in a few steps
      sp.t = clamp(((x < XK ? XK - x : (x - XK) / SHIN) - L0) / (reach - L0), 0, 1);
      read.textContent = `band ${Math.floor((len(sp.t) + 0.01) / STEP)}`;
    } else { sp.t = REST; read.textContent = "rest"; }
    knee.classList.toggle("hi", !over);
    lead.classList.toggle("hi", !!over);
    loop.wake();
  }
  const go = (p) => { over = p; retarget(); };

  bag.add(pointer(stage, { move: go, down: go, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());
  draw(sp.x);
  read.textContent = "rest";

  return {
    set: (v) => { reach = v; drawn = NaN; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "knie",
  means: "Tape am Knie: Zwei Streifen wachsen vom Knie aus um die Kniescheibe bis zum Zeiger, zuletzt kommt der kurze Streifen quer darunter.",
  rules: [1, 3, 5, 6, 9],
  range: [38, 57, 74],
  tour: [[136, 134], [123, 128], [110, 122], [87, 110], null],
  mount,
});
