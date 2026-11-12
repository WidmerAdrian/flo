/**
 * Schichten: a block of tissue as a stack of four rounded plates. From the top:
 * a thin sheet of skin, a thicker soft pad with rounder corners, a thin sheet
 * of fascia, and a thick block of muscle with grooves along its top that run
 * out at its end, the fibres. At rest the stack stands slightly apart, the
 * gaps uneven, and the skin is bright. The pointer's x scrubs the gap on one
 * spring, left closed and right wide open; its height picks the layer, which
 * takes the bright stroke. The slider is the largest gap.
 *
 * The pattern: scrub and pick. The stack opens about its middle, so it stays
 * centred in every pose, and the layer is picked in the pose the stack is
 * heading for, never the one on screen.
 */
const {
  Cam, clamp, facing, fit, hull, prism, proj, ringAt, rrect, seg, spring, stepS,
  disposer, mk, pointer, put, register, solid,
} = HL;

const X1 = 100, Y1 = 80, REST = 11, GMAX = 24;
/** Bottom to top: the read-out's name, thickness, corner radius, crease inset, and the gap above as a share of the largest. */
const LAYERS = [
  { name: "muskel", h: 22, r: 8, b: 2, gap: 1 },
  { name: "faszie", h: 2.5, r: 8, b: 1.2, gap: 0.45 },
  { name: "unterhaut", h: 12, r: 24, b: 2, gap: 0.7 },
  { name: "haut", h: 5, r: 10, b: 1.4, gap: 0 },
];
const THICK = LAYERS.reduce((s, L) => s + L.h, 0), GAPS = LAYERS.reduce((s, L) => s + L.gap, 0);
/** The muscle's grooves: where they lie across the block, and how deep they show on its end. */
const GROOVES = [16, 32, 48, 64], DEPTH = 10;

/** Each layer's [z0, z1] when the largest gap is g. The stack opens about its middle. */
function lay(g) {
  let z = -(THICK + g * GAPS) / 2;
  return LAYERS.map((L) => { const z0 = z; z += L.h + g * L.gap; return [z0, z0 + L.h]; });
}

/** Whether a screen point lies in a convex polygon, whichever way it winds. */
function inside(pts, [x, y]) {
  let s = 0;
  return pts.every((a, k) => {
    const b = pts[(k + 1) % pts.length], c = Math.sign((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
    if (c === 0 || s === 0) { s = s || c; return true; }
    return c === s;
  });
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  // The camera is fitted to the stack at the slider's far end, wide open.
  const C = Cam(45, 0.5, 1.85), T = (THICK + GMAX * GAPS) / 2;
  fit(C, [-T, T].flatMap((z) => [[0, 0, z], [X1, 0, z], [0, Y1, z], [X1, Y1, z]]), 200, 166);
  const P = proj(C), front = facing(C);
  let G = value, over = null, drawn = NaN;
  const gap = spring(REST);

  // Bottom to top, so a higher plate covers a lower one. The grooves go on just after the muscle.
  const root = mk("g", {}, svg);
  const parts = LAYERS.map((L, i) => ({
    name: L.name,
    el: solid(root),
    fib: i === 0 ? mk("path", { class: "nf lo" }, root) : null,
    ring: rrect(0, 0, X1, Y1, L.r, 10),
    inner: rrect(L.b, L.b, X1 - L.b, Y1 - L.b, L.r - L.b, 10),
  }));

  function draw() {
    const g = clamp(gap.x, 0, GMAX);
    if (g === drawn) return;
    drawn = g;
    const zs = lay(g);
    parts.forEach((p, i) => {
      const [z0, z1] = zs[i];
      put(p.el, prism(P, front, p.ring, p.inner, z0, z1));
      if (p.fib) p.fib.setAttribute("d", GROOVES.map((y) => seg(P(0, y, z1), P(X1, y, z1)) + seg(P(X1, y, z1), P(X1, y, z1 - DEPTH))).join(""));
    });
  }

  /** The layer under the point with the gap at g: the topmost silhouette that holds it, else the nearest by height. */
  function hit(pt, g) {
    const zs = lay(g);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (inside(hull(ringAt(P, parts[i].ring, zs[i][0]).concat(ringAt(P, parts[i].ring, zs[i][1]))), pt)) return i;
    }
    const far = zs.map(([z0, z1]) => Math.abs(P(X1 / 2, Y1 / 2, (z0 + z1) / 2)[1] - pt[1]));
    return far.indexOf(Math.min(...far));
  }

  const B = register(stage, (dt) => {
    const moving = stepS(gap, dt);
    draw();
    return moving;
  });
  bag.add(B.unregister);

  /** Reads the pointer: x sets where the gap is heading, and the layer is picked in that pose (rule 01). */
  function aim() {
    gap.t = over ? G * clamp((over[0] - 100) / 200, 0, 1) : REST;
    const pick = over ? hit(over, gap.t) : -1;
    parts.forEach((p, i) => p.el.sil.classList.toggle("hi", i === (pick < 0 ? parts.length - 1 : pick)));
    read.textContent = pick < 0 ? "rest" : parts[pick].name;
    B.wake();
  }

  const to = (p) => { over = p; aim(); };
  bag.add(pointer(stage, { move: to, down: to, leave: () => to(null) }));
  bag.add(() => svg.replaceChildren());
  aim();

  return {
    set: (v) => { G = v; if (over) aim(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "schichten",
  means: "Haut, Unterhaut, Faszie und Muskel als Stapel: nach rechts öffnet er sich, die Höhe des Zeigers wählt die Schicht.",
  rules: [1, 3, 5, 9],
  range: [14, 19, 24],
  tour: [[130, 120], [200, 185], [295, 175], null],
  mount,
});
