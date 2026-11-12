/**
 * Sohle: the sole of a foot as a thick rounded plate lying flat, heel near,
 * five toe pads across the far end, and twelve round studs (the reflex zones) set
 * into it at uneven heights. The pointer picks the stud nearest to it; that
 * stud presses in and takes the bright stroke, and the studs around it dip,
 * less with distance and staggered outwards on the 700ms lift curve. At rest
 * the tall stud under the ball of the foot is the bright mark. The slider is
 * the stagger, in ms per stud spacing.
 *
 * The pattern: discrete items. Tweens, a stagger by distance, a clamped
 * falloff, and a hit test on each stud's RESTING top, so a stud sinking out
 * from under the pointer cannot flip the choice.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, open, poly, prism, proj, ringAt, run, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const T = 6, PRESS = 0.4, DIP = 0.85, REACH = 70, PITCH = 13, MARK = 4;
// The sole, x across and y along, toes far and heel near: outer ball, front, front, inner ball, the arch's waist, heel, heel.
const OUT = [[2, 24], [16, 6], [44, 2], [50, 26], [28, 62], [33, 100], [5, 100]], RAD = [12, 10, 8, 10, 16, 14, 14];
// The toe pads [x, y, r], little toe to big toe, back to front: they run across the view, so each one shows.
const TOES = [[8, 3.2, 4.5], [2, 11.6, 4.1], [17.5, -2.5, 4.9], [29, -5.2, 5.4], [43, -9.5, 7.5]];
// The studs [x, y, r, rest height], back to front (ascending x + y): paint order, and the zone's number.
const STUDS = [
  [15, 23, 3.6, 2], [27, 18, 3.7, 2.4], [17, 35, 3.6, 3.4], [39, 16, 3.6, 2.2], [29, 30, 4.2, 5.6], [11, 49, 3.6, 4],
  [40, 28, 3.7, 3.8], [25, 45, 3.9, 4.6], [16, 61, 3.7, 3.4], [11, 72, 3.6, 3], [22, 78, 4, 4.8], [17, 90, 3.8, 4.2],
];

/** A closed outline (clockwise on the ground as listed) as a ring of samples with outward normals, inset by b. */
function ringOf(pts, b) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const nu = (c[1] - a[1]) / l, nv = -(c[0] - a[0]) / l;
    return { u: p[0] - nu * b, v: p[1] - nv * b, nu, nv };
  });
}

/** How much of its height a stud gives up at distance d from the one pressed: full next to it, down to a floor. */
const falloff = (d) => DIP * clamp(1 - d / REACH, 0.12, 1);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const pts = fillet(OUT, RAD, 16), ring = ringOf(pts, 0), inner = ringOf(pts, 1.8);
  // Studs only ever sink, so the rest pose is the widest one: fit the camera to it.
  const C = Cam(45, 0.5, 2.75), box = [];
  for (const [x, y] of pts) box.push([x, y, 0], [x, y, T]);
  for (const [x, y, r] of TOES) box.push([x - r, y - r, T], [x + r, y - r, 0], [x + r, y + r, 0]);
  fit(C, box, 200, 166);
  const P = proj(C), front = facing(C), at = (x, y) => (u, v, z) => P(u + x, v + y, z);

  const g = mk("g", {}, svg);
  // The toes lie beyond the ball, farther from the eye than the sole: they go first.
  for (const [x, y, r] of TOES) put(solid(g), prism(at(x, y), front, circ(r, 20), circ(r - 1.5, 20), 0, T));
  // The sole waists in at the arch, so a hull would fill it: its silhouette is the far run of the top
  // outline joined to the near run of the base outline, and its crease the near run just inside the top.
  put(solid(g), {
    sil: poly(ringAt(P, run(ring, (q) => !front(q)), T).concat(ringAt(P, run(ring, front), 0))),
    crease: open(ringAt(P, run(inner, front), T)),
  });

  const studs = STUDS.map(([x, y, r, h0]) => ({
    x, y, h0, P: at(x, y), ring: circ(r, 20), inner: circ(r - 1.1, 20), el: solid(g), h: tween(h0), drawn: NaN,
  }));
  studs[MARK].el.sil.classList.add("hi");

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const s of studs) {
      const h = tval(s.h, now);
      if (h !== s.drawn) { s.drawn = h; put(s.el, prism(s.P, front, s.ring, s.inner, T, T + h)); }
      if (!tdone(s.h, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  /** The stud whose RESTING top puts the pointer nearest its middle. The tops never move, so neither does the choice. */
  function hit([sx, sy]) {
    let best = 0, bd = Infinity;
    studs.forEach((s, i) => {
      const [wx, wy] = unproj(C, sx, sy, T + s.h0), d = Math.hypot(wx - s.x, wy - s.y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  let act = -1;
  /** Presses stud a (-1 lets them all up). The dip spreads out from the stud pressed, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = studs[a >= 0 ? a : act];
    act = a;
    studs.forEach((s, i) => {
      const d = Math.hypot(s.x - from.x, s.y - from.y);
      tset(s.h, a < 0 ? s.h0 : i === a ? PRESS : s.h0 * (1 - falloff(d)), now, (d / PITCH) * stag);
      s.el.sil.classList.toggle("hi", i === (a < 0 ? MARK : a));
    });
    read.textContent = a < 0 ? "rest" : "zone " + String(a + 1).padStart(2, "0");
    B.wake();
  }

  const press = (p) => setActive(hit(p));
  bag.add(pointer(stage, { move: press, down: press, leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "sohle",
  means: "Eine Fusssohle mit Reflexzonen: Die Zone unter dem Zeiger gibt nach, die Zonen ringsum sinken mit, je weiter weg, desto weniger.",
  rules: [1, 2, 3, 9],
  range: [0, 40, 90],
  tour: [[78, 192], [133, 164], [243, 155], null],
  mount,
});
