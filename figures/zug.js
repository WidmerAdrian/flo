/**
 * Zug: a block of tissue as a stack of four rounded plates sitting close
 * together. From the top: a thin sheet of skin, a thicker soft pad with rounder
 * corners, a thin sheet of fascia, and a thick block of muscle with grooves
 * running out at its end. On the skin stand two fingers of a hand, hooked: a
 * nail at the tip, a crease at either joint, and up to a short back of the hand
 * with a curled finger at each side. The pointer, put on the
 * skin's resting plane and clamped, pulls the fingers. The skin goes with them
 * all the way, the pad half as far, the fascia a little and the muscle not at
 * all, each layer dragged by the one above it on its own spring, so the deeper
 * ones lag: a shear. At rest the stack is already sheared a little and the
 * skin is bright; under the pointer the bright goes to the deepest layer that
 * has clearly moved. The slider is the largest shear.
 *
 * The pattern: a continuous field of four. The pull is read on a plane that
 * never moves, and the layer is named from where the pull is heading, never
 * from the pose on screen.
 */
const {
  Cam, facing, fit, hull, open, poly, prism, proj, rrect, seg, unproj, spring, stepS,
  disposer, mk, pointer, put, register, solid,
} = HL;

const SC = 1.8, X1 = 100, Y1 = 78, REACH = 42, CLEAR = 2.6;
/** Bottom to top: the read-out's name, thickness, corner radius, crease inset, the gap under it, and its share of the pull. */
const LAYERS = [
  { name: "muskel", h: 20, r: 8, b: 2, gap: 0, f: 0 },
  { name: "faszie", h: 2.5, r: 8, b: 1.2, gap: 1.4, f: 0.2 },
  { name: "unterhaut", h: 12, r: 22, b: 2, gap: 1, f: 0.5 },
  { name: "haut", h: 4.5, r: 10, b: 1.4, gap: 1.6, f: 1 },
];
const ZTOP = LAYERS.reduce((s, L) => s + L.gap + L.h, 0), TOP = LAYERS.length - 1;
/** The muscle's grooves: where they lie across the block, and how deep they show on its end. */
const GROOVES = [16, 31, 46, 62], DEPTH = 9;
/** Where the fingers stand on the skin, the shear the stack rests in, the hand's radius, and a finger's at its tip and at the hand. */
const FING = [46, 44], REST = [-3, -8], RH = 9, RT = 6, RB = 7.5;
/** A finger's line in [y, z] from where it stands: tip, two joints, and where it meets the hand. A curled neighbour shows one joint. */
const FINGER = [[0, 5.5], [-1, 17], [-3, 33], [-30, 44]], CURLED = [[-17, 32], [-30, 44]];
/** The hand, far to near (ascending x): a curled finger, the two that pull, a curled one. Then its back's four corners in [x, y, z]. */
const HAND = [[-28.5, CURLED], [-9.5, FINGER], [9.5, FINGER], [28.5, CURLED]];
const PALM = [[-28.5, -28, 44.5], [28.5, -28, 44.5], [-26, -52, 49], [26, -52, 49]];
/** The marks on a finger's back, as runs of [along, round]: its nail on the last bone, and the angles a joint's crease runs through. */
const NAIL = [[0.66, -0.7], [0.2, -0.7], [0.03, -0.42], [-0.03, 0], [0.03, 0.42], [0.2, 0.7], [0.66, 0.7], [0.78, 0.4], [0.82, 0], [0.78, -0.4], [0.66, -0.7]];
const CREASE = [-0.75, -0.3, 0.15, 0.6, 1.05];
/** The camera's box: the block, and the hand's far end with its radius, with nothing pulled. */
const BOX = [0, ZTOP].flatMap((z) => [[0, 0, z], [X1, 0, z], [0, Y1, z], [X1, Y1, z]])
  .concat(PALM.slice(2).map(([x, y, z]) => [FING[0] + x, FING[1] + y, ZTOP + z + RH / 0.866]));

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** A circle of screen points round p. */
const disc = (p, r, n = 24) => Array.from({ length: n }, (_, i) => [p[0] + r * Math.cos((i / n) * 6.2832), p[1] + r * Math.sin((i / n) * 6.2832)]);
/** Where joint k of a finger sits once its bend is cut round, and the way its back faces there, both in [y, z]. */
function back(k) {
  const [a, b, c] = [FINGER[k - 1], FINGER[k], FINGER[k + 1] || FINGER[k]], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
  return [mix(mix(a, b, 0.75), mix(b, c, 0.25), 0.5), [(c[1] - a[1]) / l, (a[0] - c[0]) / l]];
}
const JOINTS = [back(1), back(2)];

/** A finger on screen: a tube round the line through its joints, the bends cut round, r0 wide at the tip and r1 at the hand. */
function tube(joints, r0, r1) {
  let c = joints;
  for (let k = 0; k < 3; k++) c = [c[0], ...c.slice(1).flatMap((b, i) => [mix(c[i], b, 0.25), mix(c[i], b, 0.75)]), c[c.length - 1]];
  const n = c.length - 1, th = c.map((_, i) => { const a = c[Math.max(i - 1, 0)], b = c[Math.min(i + 1, n)]; return Math.atan2(b[0] - a[0], a[1] - b[1]); });
  const side = (s) => c.map((p, i) => { const r = s * (r0 + ((r1 - r0) * i) / n); return [p[0] + r * Math.cos(th[i]), p[1] + r * Math.sin(th[i])]; });
  const cap = (p, r, a) => Array.from({ length: 11 }, (_, j) => [p[0] + r * Math.cos(a - (Math.PI * (j + 1)) / 12), p[1] + r * Math.sin(a - (Math.PI * (j + 1)) / 12)]);
  return poly([...side(1), ...cap(c[n], r1, th[n]), ...side(-1).reverse(), ...cap(c[0], r0, th[0] + Math.PI)]);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, SC);
  fit(C, BOX, 200, 166);
  const P = proj(C), front = facing(C);
  let R = value, over = null;

  // Bottom to top, so a higher plate covers a lower one. The grooves go on just after the muscle.
  const root = mk("g", {}, svg);
  let z = 0;
  const parts = LAYERS.map((L, i) => {
    const z0 = z + L.gap;
    z = z0 + L.h;
    return {
      name: L.name, f: L.f, z0, z1: z, el: solid(root), drawn: "",
      fib: i === 0 ? mk("path", { class: "nf lo" }, root) : null,
      ring: rrect(0, 0, X1, Y1, L.r, 10),
      inner: rrect(L.b, L.b, X1 - L.b, Y1 - L.b, L.r - L.b, 10),
      x: spring(REST[0] * L.f), y: spring(REST[1] * L.f),
    };
  });
  parts[0].fib.setAttribute("d", GROOVES.map((y) => seg(P(0, y, 20), P(X1, y, 20)) + seg(P(X1, y, 20), P(X1, y, 20 - DEPTH))).join(""));
  // The hand stands above the skin, so it goes on last: its back, then the far finger, then the near one.
  const palm = solid(root), hand = HAND.map(([dx, line]) => ({ dx, line, el: solid(root), marks: mk("path", { class: "nf" }, root) }));

  /** Draws a layer where its springs are, and with the skin the hand that stands on it. Nothing is rewritten while it holds still. */
  function draw(p, i) {
    const ox = p.x.x, oy = p.y.x, key = ox + "," + oy;
    if (key === p.drawn) return;
    p.drawn = key;
    put(p.el, prism((u, v, w) => P(u + ox, v + oy, w), front, p.ring, p.inner, p.z0, p.z1));
    if (i < TOP) return;
    const at = (x, y, w) => P(FING[0] + ox + x, FING[1] + oy + y, ZTOP + w);
    put(palm, { sil: poly(hull(PALM.flatMap(([x, y, w]) => disc(at(x, y, w), RH * SC)))), crease: "" });
    for (const f of hand) {
      put(f.el, { sil: tube(f.line.map(([y, w]) => at(f.dx, y, w)), RT * SC, RB * SC), crease: "" });
      if (f.line !== FINGER) continue;
      // A point on the finger's back: r out from c, t round from the way n faces.
      const on = (c, n, r, t) => at(f.dx + r * Math.sin(t), c[0] + r * n[0] * Math.cos(t), c[1] + r * n[1] * Math.cos(t));
      f.marks.setAttribute("d", JOINTS.map(([c, n], k) => open(CREASE.map((t) => on(c, n, RT + 0.4 * k, t)))).join("")
        + open(NAIL.map(([s, t]) => on(mix(FINGER[0], FINGER[1], s), JOINTS[0][1], RT - 0.2, t))));
    }
  }

  // From the skin down: each layer heads for its share of where the one above it is now, so the pull sinks in late.
  const B = register(stage, (dt) => {
    let moving = false;
    for (let i = TOP; i > 0; i--) {
      const p = parts[i], up = parts[i + 1];
      if (up) { p.x.t = (up.x.x * p.f) / up.f; p.y.t = (up.y.x * p.f) / up.f; }
      if (stepS(p.x, dt)) moving = true;
      if (stepS(p.y, dt)) moving = true;
      draw(p, i);
    }
    return moving;
  });
  bag.add(B.unregister);

  /** Reads the pointer on the skin's resting plane (rule 01): which way and how hard the fingers pull, up to R, and how deep that goes. */
  function aim() {
    let d = REST, pick = -1;
    if (over) {
      const [wx, wy] = unproj(C, over[0], over[1], ZTOP);
      const vx = (wx - FING[0]) / REACH, vy = (wy - FING[1]) / REACH, l = Math.max(1, Math.hypot(vx, vy));
      d = [(R * vx) / l, (R * vy) / l];
      pick = parts.findIndex((p) => p.f * Math.hypot(d[0], d[1]) >= CLEAR);
      if (pick < 0) pick = TOP;
    }
    parts[TOP].x.t = d[0];
    parts[TOP].y.t = d[1];
    parts.forEach((p, i) => p.el.sil.classList.toggle("hi", i === (pick < 0 ? TOP : pick)));
    read.textContent = pick < 0 ? "rest" : parts[pick].name;
    B.wake();
  }

  const to = (p) => { over = p; aim(); };
  bag.add(pointer(stage, { move: to, down: to, leave: () => to(null) }));
  bag.add(() => svg.replaceChildren());
  draw(parts[0], 0);
  aim();

  return {
    set: (v) => { R = v; if (over) aim(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "zug",
  means: "Zwei Finger ziehen an der Haut: Sie geht ganz mit, die Unterhaut halb, die Faszie kaum, der Muskel bleibt liegen.",
  rules: [1, 3, 5, 9],
  range: [10, 16, 22],
  tour: [[224, 158], [242, 149], [135, 149], null],
  mount,
});
