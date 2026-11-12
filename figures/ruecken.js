/**
 * Rücken: a person lying face down on a massage couch in the 2:1 view. The
 * head is a ball on the head part at the near end; the back is one thick slab
 * with sloping shoulders, narrowing to the waist; an arm lies against each
 * side; a towel covers the hips and the two legs run out from under it. Two
 * hands, each a palm with finger lines and a thumb nub, lie on the back, one
 * either side of the spine. The pointer is put on the back's top plane and
 * clamped to it: the hand on its side leads, on a spring, takes the bright
 * stroke and presses in, and the skin creases ahead of its fingers; the other
 * hand lets up and trails a little behind, beside the spine. At rest the
 * hands sit on the shoulders, the near one bright and pressing lightly. The
 * slider is how deep the leading hand presses.
 *
 * The pattern: a continuous position on a plane that never moves (springs),
 * and one discrete choice, which hand leads (a tween on each hand's pressure).
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, lerp, open, poly, prism, proj, ringAt, rings, run, seg, unproj,
  spring, stepS, tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const CY = 34, ZB = 18, ZT = 25, HB = 8, ZS = ZT + HB, HH = 4, HEAD = 10.5;
// The hands' field on the back: along it from the loin to the neck, and how near the spine a hand's middle may come.
const X0 = 57, X1 = 85, GAP = 9, LAG = 5, REST = 0.5;
/** Half the back's width at x: narrow at the waist, broad at the shoulders. */
const wide = (x) => lerp(12.5, 19.5, clamp((x - 37.5) / 42.5, 0, 1));
/** The body area at a point of the back. */
const area = (x, y) => (x >= 77 ? (Math.abs(y - CY) < GAP ? "nacken" : "schulter") : x >= 65 ? "rücken" : "lende");

/** A closed outline (clockwise on the ground as listed) as a ring of samples with outward normals, inset by b. */
function ringOf(pts, b) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const nu = (c[1] - a[1]) / l, nv = -(c[0] - a[0]) / l;
    return { u: p[0] - nu * b, v: p[1] - nv * b, nu, nv };
  });
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.4);
  fit(C, [[-12, CY - 34, ZT], [-12, CY + 34, ZB], [127, CY - 16, ZT], [127, CY + 16, ZB], [86, CY + 22, 0], [14, CY + 22, 0], [113, CY, ZT + 7 + HEAD * 1.15]], 200, 166);
  const P = proj(C), front = facing(C), at = (x, y) => (u, v, z) => P(u + x, v + y, z);
  let depth = value, over = null, lead = 1;

  const g = mk("g", {}, svg);
  const box = (x0, y0, x1, y1, r, b, z0, z1) => {
    const [ring, inner] = rings(x0, y0, x1, y1, r, b);
    put(solid(g), prism(P, front, ring, inner, z0, z1));
  };
  /** A solid on the couch with a straight-sided outline: the back, an arm. */
  const slab = (pts, radii) => {
    const f = fillet(pts, radii, 6);
    put(solid(g), prism(P, front, ringOf(f, 0), ringOf(f, 1.5), ZT, ZS));
  };
  // Back to front, bottom to top. The couch: a recessed base, the top that overhangs it, the head part.
  box(14, CY - 22, 86, CY + 22, 6, 1.6, 0, ZB);
  box(-12, CY - 34, 99, CY + 34, 9, 1, ZB, ZT);
  box(102, CY - 16, 127, CY + 16, 6, 1, ZB + 2, ZT);
  // The person: two legs, the towel over the hips, the far arm, the back with its sloping shoulders, the near arm,
  // the neck. The arms lie against the back at its own height, so each meets it in one seam.
  box(-9, CY - 12, 20, CY - 4.5, 3.7, 1.2, ZT, ZT + 6);
  box(-9, CY + 4.5, 20, CY + 12, 3.7, 1.2, ZT, ZT + 6);
  box(17, CY - 16, 37, CY + 16, 7, 1.5, ZT, ZS + 0.8);
  slab([[48, CY - 31.5], [93, CY - 27], [93, CY - 17], [48, CY - 25]], [3.2, 5, 5, 3.2]);
  slab([[37.5, CY - 12.5], [80, CY - 19.5], [94, CY - 17.5], [99, CY - 6], [99, CY + 6], [94, CY + 17.5], [80, CY + 19.5], [37.5, CY + 12.5]], [5, 7, 6, 5, 5, 6, 7, 5]);
  slab([[48, CY + 25], [93, CY + 17], [93, CY + 27], [48, CY + 31.5]], [3.2, 5, 5, 3.2]);
  box(98.5, CY - 5.5, 106, CY + 5.5, 4, 1.2, ZT, ZT + 6.5);
  // The head is a ball sunk a little into the head part: the hull of its circles of latitude, and one of them as its crease.
  const hp = at(113, CY), lat = (f) => [circ(HEAD * Math.cos(f), 40), ZT + 7 + HEAD * Math.sin(f)];
  put(solid(g), {
    sil: poly(hull(Array.from({ length: 19 }, (_, i) => ringAt(hp, ...lat(-0.72 + i * 0.125))).flat())),
    crease: open(ringAt(hp, run(lat(0.95)[0], front), lat(0.95)[1])),
  });
  // The spine, a groove down the back: the hands keep to either side of it.
  mk("path", { d: seg(P(42, CY, ZS), P(92, CY, ZS)), class: "lo nf" }, g);

  // The creases lie on the back, under both hands: one path per hand, painted before either.
  const rip = [0, 1].map(() => mk("path", { class: "lo nf" }, g));
  // A palm is broad at the fingers and narrow at the wrist.
  const mitt = fillet([[-10.5, -5.5], [9.5, -3.6], [9.5, 3.6], [-10.5, 5.5]], [3.2, 3.2, 3.2, 3.2], 5), PALM = [ringOf(mitt, 0), ringOf(mitt, 1.1)];
  // s is the hand's side of the spine: -1 far, 1 near. The thumb points at the spine, so it is in front of the
  // far hand's palm and behind the near one's: it is painted on that side of it.
  const hands = [[-1, 85, CY - 12.5, 0], [1, 77, CY + 12, REST]].map(([s, x0, y0, p0], i) => {
    const hg = mk("g", {}, g), a = solid(hg), b = solid(hg);
    return {
      s, x0, y0, p0, rip: rip[i], palm: s < 0 ? a : b, thumb: s < 0 ? b : a, key: "",
      nub: rings(0, s < 0 ? 3.6 : -8.6, 6.5, s < 0 ? 8.6 : -3.6, 2.4, 0.8),
      x: spring(x0), y: spring(y0), p: tween(p0),
    };
  });

  /** One hand where its springs are: the palm and thumb, sunk by its pressure, and the creases ahead of the fingers. */
  function draw(h, now) {
    const x = h.x.x, y = h.y.x, p = tval(h.p, now), key = x + " " + y + " " + p + " " + depth;
    if (key === h.key) return;
    h.key = key;
    const Q = at(x, y), top = ZS + HH - depth * p;
    const palm = prism(Q, front, PALM[0], PALM[1], ZS, top);
    // Three short lines part the four fingers.
    for (const v of [-2.75, 0, 2.75]) palm.crease += seg(Q(-10.5, v, top), Q(-2, v, top));
    put(h.palm, palm);
    put(h.thumb, { sil: prism(Q, front, h.nub[0], h.nub[1], ZS, lerp(ZS, top, 0.6)).sil, crease: "" });
    let d = "";
    for (let i = 0; i < 3 && p > 0.02; i++) {
      // A crease is an arc bowed away from the fingers, cut where the back ends.
      const ahead = 12.5 + i * (1.4 + depth * 0.9), w = p * (7 - i * 1.2), lim = wide(x - ahead) - 2.5, arc = [];
      if (x - ahead < 41) break;
      for (let t = -1; t <= 1.001; t += 0.25) arc.push(P(x - ahead + 1.6 * t * t, clamp(y + t * w, CY - lim, CY + lim), ZS));
      d += open(arc);
    }
    h.rip.setAttribute("d", d);
  }

  const B = register(stage, (dt, now) => {
    let m = false;
    for (const h of hands) {
      const mx = stepS(h.x, dt), my = stepS(h.y, dt);
      if (mx || my || !tdone(h.p, now)) m = true;
      draw(h, now);
    }
    return m;
  });
  bag.add(B.unregister);

  /** Sends the hands to the point `over` of the back, or home. The hand on the pointer's side of the spine leads. */
  function aim() {
    const now = performance.now();
    lead = over ? (over[1] < CY ? 0 : 1) : 1;
    hands.forEach((h, i) => {
      let x = h.x0, y = h.y0;
      if (over) {
        // The hand across the spine from the pointer trails behind it, the more the farther the pointer is from the spine.
        x = Math.min(X1, over[0] + LAG * clamp((-h.s * (over[1] - CY)) / GAP, 0, 1));
        y = CY + h.s * clamp(h.s * (over[1] - CY), GAP, wide(x) - 7);
      }
      h.x.t = x;
      h.y.t = y;
      tset(h.p, over ? +(i === lead) : h.p0, now, 0);
      h.palm.sil.classList.toggle("hi", i === lead);
      h.thumb.sil.classList.toggle("hi", i === lead);
    });
    read.textContent = over ? area(over[0], over[1]) : "rest";
    B.wake();
  }
  aim();

  bag.add(pointer(stage, {
    // The back's top plane never moves, so neither does the hit test.
    move: (p) => {
      const q = unproj(C, p[0], p[1], ZS);
      over = [clamp(q[0], X0, X1), q[1]];
      aim();
    },
    leave: () => { over = null; aim(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { depth = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "ruecken",
  means: "Zwei Hände gleiten über den Rücken: Die führende folgt dem Zeiger und drückt ein, das Gewebe vor ihr gibt nach.",
  rules: [1, 3, 5, 8, 9],
  range: [0.5, 1.3, 2.1],
  tour: [[265, 168], [258, 147], [231, 137], [216, 167], [229, 180], null],
  mount,
});
