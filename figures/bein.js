/**
 * Bein: a lower leg with its foot, lying raised on a wedge cushion, knee end
 * high. The calf is a thick lying limb that tapers to the ankle; the foot
 * stands up at the end, heel on the cushion and five toes on top. Six rings
 * sit round the limb, and at rest the ones near the ankle stand proud of it:
 * swollen. The pointer picks the ring whose RESTING arc is nearest; that ring
 * tightens down to the limb and takes the bright stroke, and the rings between
 * it and the knee tighten after it one by one, staggered by distance, as if
 * the fluid were pushed towards the knee. Rings on the ankle side stay as they
 * are, loose or tight, until the pointer leaves and the swelling returns. At
 * rest the lymph node, a dot in the hollow of the knee, is the bright mark.
 * The slider is the stagger, in ms per ring.
 *
 * The pattern: discrete items. Tweens, a stagger by distance, a hit test on
 * the rest pose, and a lying limb built by hand from projected circles.
 */
const {
  Cam, facing, fillet, fit, hull, lerp, open, poly, proj, rad, rrect, run,
  tdone, tset, tval, tween, disposer, mk, place, pointer, put, register, solid,
} = HL;

const TILT = rad(11), CS = Math.cos(TILT), SN = Math.sin(TILT), TAU = Math.PI * 2, HALF = Math.PI / 2;
// The limb's radius along it, [s, radius]: knee, the calf's belly, where the calf ends, ankle. And the rounded knee end.
const GIRTH = [[0, 12], [18, 14], [44, 9.5], [70, 7.5]], RK = 12, DOME = 9.5;
const CAP = Array.from({ length: 6 }, (_, k) => [-DOME * Math.sin((k + 1) * 0.24), RK * Math.cos((k + 1) * 0.24)]);
// The rings, ankle first: where each sits, how far it stands off the limb at rest. Tight, it lies on it.
const RINGS = [62, 52, 42, 32, 22, 12], SLACK = [6.5, 5.4, 3.8, 2.4, 1.5, 1];
// The cushion: its ends along the limb, its half width, its height at the low end and under the knee.
const X0 = -16, X1 = 91, WY = 19, LOW = 4, HK = LOW + X1 * SN;
// The foot: where the sole's face is, how thick the forefoot and the toe pads are, the sole across and up from
// the heel (big toe on the near side), and the toes [across, up, radius], far to near.
const SOLE = 83, PLATE = 6, PAD = 4;
const FOOT = [[-8.5, 0], [8.5, 0], [14, 32], [12.5, 45.5], [-11.5, 39.5], [-13.5, 27]], FRAD = [8, 8, 12, 5, 5, 12];
const TOES = [[-11.5, 40.2, 2.4], [-7.5, 41.3, 2.7], [-2.9, 42.5, 3], [2.2, 43.9, 3.2], [8.8, 46, 4.6]];

/** A closed outline (counter-clockwise, up being positive) as a ring of samples with outward normals, inset by b. */
function ringOf(pts, b) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const nu = (c[1] - a[1]) / l, nv = -(c[0] - a[0]) / l;
    return { u: p[0] - nu * b, v: p[1] - nv * b, nu, nv };
  });
}

/** The limb's radius at s. */
const girth = (s) => {
  const i = GIRTH.findIndex((g) => g[0] >= s) || 1, [s0, r0] = GIRTH[i - 1], [s1, r1] = GIRTH[i];
  return lerp(r0, r1, (s - s0) / (s1 - s0));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // Leg coordinates: s along the limb from the knee, u across it, h off the cushion. The cushion's slope tilts them.
  const world = (s, u, h) => [s * CS + h * SN, u, HK - s * SN + h * CS];
  // Rings only ever tighten, so the rest pose is the widest one: fit the camera to it.
  const C = Cam(45, 0.5, 3.1);
  fit(C, [[X0 * CS, WY, 0], [X1 * CS, -WY, 0], [X1 * CS, WY, 0], world(X0, -WY, 0), world(22, 0, 30), world(SOLE, 9, 51)], 200, 166);
  const P = proj(C), front = facing(C), Q = (s, u, h) => P(...world(s, u, h));

  // Q is linear, so the way to the camera is the cross product of its axes: FACE is the middle of the
  // half of the limb that faces the camera, as an angle round its axis (0 is +u, a quarter turn is +h).
  const o = Q(0, 0, 0), ax = (p) => [p[0] - o[0], p[1] - o[1]], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const es = ax(Q(1, 0, 0)), eu = ax(Q(0, 1, 0)), eh = ax(Q(0, 0, 1));
  const vu = cross(eh, es), vh = cross(es, eu), FACE = Math.atan2(vh, vu);

  /** Screen points of an arc round the limb's axis at s: radius r, centre (u0, h0), from angle a0 to a1. */
  const loop = (s, r, u0, h0, a0 = 0, a1 = TAU, n = 28) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = lerp(a0, a1, i / n);
      return Q(s, u0 + r * Math.cos(a), h0 + r * Math.sin(a));
    });
  const on = (ring, s) => ring.map((q) => Q(s, q.u, q.v));

  // Back to front: the cushion, the rings' far halves, the limb, their near halves, the node, the foot, its toes.
  const g = mk("g", {}, svg);
  const wr = rrect(X0, -WY, X1, WY, 8, 8), wi = rrect(X0 + 2, -WY + 2, X1 - 2, WY - 2, 6, 8);
  // The cushion's top slopes, so its silhouette is the hull of its base and its tilted top.
  put(solid(g), {
    sil: poly(hull(wr.map((q) => P(q.u * CS, q.v, 0)).concat(wr.map((q) => Q(q.u, q.v, 0))))),
    crease: open(run(wi, front).map((q) => Q(q.u, q.v, 0))),
  });

  const bands = RINGS.map((s, i) => ({ s, r: girth(s), back: mk("path", { class: "nf" }, g), sl: tween(SLACK[i]), drawn: NaN }));
  // The limb is three convex pieces: calf, shank and foot, so it can waist in where they meet. A later piece is
  // filled whole but stroked only from the limb's low silhouette point at its station, the low way round, to
  // where its last edge meets the top outline of the piece before: no seam across the limb, one body.
  const round = ([s, r]) => loop(s, r, 0, s < 0 ? RK : r), tips = ([s, r]) => loop(s, r, 0, r, FACE + HALF, FACE - HALF, 1);
  /** Where the line p–q crosses the line c–d. */
  const meet = (p, q, c, d) => {
    const e = [d[0] - c[0], d[1] - c[1]], t = cross([c[0] - p[0], c[1] - p[1]], e) / cross([q[0] - p[0], q[1] - p[1]], e);
    return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  };
  function piece(k, pts) {
    const [c] = tips(GIRTH[k - 1]), [d, a] = tips(GIRTH[k]);
    const h = hull([a, d, ...pts]), n = h.length, i = h.indexOf(a);
    const dir = h[(i + 1) % n][1] > h[(i + n - 1) % n][1] ? 1 : n - 1, walk = h.map((_, j) => h[(i + dir * j) % n]);
    mk("path", { class: "fo", d: poly(h) }, g);
    mk("path", { class: "nf sil", d: open([...walk, meet(walk[n - 1], a, c, d)]) }, g);
  }
  mk("path", { class: "sil", d: poly(hull([...CAP, ...GIRTH.slice(0, 3)].flatMap(round))) }, g);
  piece(2, round(GIRTH[3]));
  for (const b of bands) b.front = mk("path", { class: "nf" }, g);
  // The lymph node, in the hollow of the knee: low on the near side, where the limb meets the cushion.
  const node = mk("circle", { r: 2.6, class: "dot" }, g);
  place(node, Q(6, RK * Math.cos(-0.3), RK + RK * Math.sin(-0.3)));

  // The foot: the hull of the ankle and a thick sole, so it is deep at the heel and thin at the toes. Its crease is
  // the sole's edge where the foot's side faces the camera.
  const out = fillet(FOOT, FRAD, 8), sole = ringOf(out, 0), rim = ringOf(out, 1.8);
  piece(3, [...on(sole, SOLE - PLATE), ...on(sole, SOLE)]);
  mk("path", { class: "nf lo", d: open(on(run(rim, (q) => q.nu * vu + q.nv * vh > 0), SOLE)) }, g);
  // The toes: five round pads on the forefoot's top edge, little toe first, as it is the farthest.
  for (const [u, h, r] of TOES) mk("path", { class: "sil", d: poly(hull(loop(SOLE - PAD, r, u, h).concat(loop(SOLE, r, u, h)))) }, g);

  /** A ring standing sl off the limb: it lies on the cushion with the limb, so its slack shows on top. */
  const arc = (b, sl, a0, a1) => loop(b.s, b.r + sl, 0, b.r + sl, a0, a1, 20);

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bands) {
      const sl = tval(b.sl, now);
      if (sl !== b.drawn) {
        b.drawn = sl;
        b.back.setAttribute("d", open(arc(b, sl, FACE + HALF, FACE + 3 * HALF)));
        b.front.setAttribute("d", open(arc(b, sl, FACE - HALF, FACE + HALF)));
      }
      if (!tdone(b.sl, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // The rings' near halves in the REST pose. They never move, and nothing draws them: the pointer picks from these.
  const rest = bands.map((b, i) => arc(b, SLACK[i], FACE - HALF, FACE + HALF));
  function hit([x, y]) {
    let best = 0, bd = Infinity;
    rest.forEach((pts, i) => {
      for (const p of pts) { const d = Math.hypot(x - p[0], y - p[1]); if (d < bd) { bd = d; best = i; } }
    });
    return best;
  }

  let act = -1, low = bands.length;
  /** Picks ring a (-1 lets them all go). From the lowest ring picked up to the knee they are tight; the stagger spreads from the ring picked, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    low = a < 0 ? bands.length : Math.min(low, a);
    bands.forEach((b, i) => {
      tset(b.sl, i >= low ? 0 : SLACK[i], now, Math.abs(i - from) * stag);
      b.back.classList.toggle("hi", i === a); b.front.classList.toggle("hi", i === a);
    });
    node.setAttribute("class", a < 0 ? "dot" : "dot m");
    read.textContent = a < 0 ? "rest" : "ring " + (a + 1);
    B.wake();
  }

  const pick = (p) => setActive(hit(p));
  bag.add(pointer(stage, { move: pick, down: pick, leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bein",
  means: "Ein geschwollenes Bein auf dem Keil: Vom gewählten Ring bis zum Knie legen sich die Ringe der Reihe nach an, die Schwellung weicht.",
  rules: [1, 2, 5, 9],
  range: [0, 60, 120],
  tour: [[133, 72], [154, 87], [198, 122], [240, 151], null],
  mount,
});
