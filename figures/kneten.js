/**
 * Kneten: a massage couch in the 2:1 view. A long padded top on a recessed
 * base, a head part with a face hole at the near end, and on the top a field
 * of 8 × 3 low pads. At rest two groups of pads stand high: the knots, at the
 * shoulders and the lower back. The pointer kneads: each pad sinks by its
 * distance to it, on its own spring, and rises again when the pointer leaves.
 * The bright pad is the highest knot at rest and the pad under the pointer
 * otherwise. The slider is the kneading radius, in pads.
 *
 * The pattern: Terrain, inverted. A continuous field that gives way.
 */
const {
  Cam, clamp, facing, fit, lerp, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  spring, stepS, flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const NX = 8, NY = 3, CX = 15, CY = 13, GAP = 1.2, LX = NX * CX, LY = NY * CY;
const ZB = 28, ZT = 36, HMIN = 0.6;

/** How much of its height a pad gives up at u radii from the pointer: all of it under the pointer, none at the radius and beyond. */
const press = (u) => (u >= 1 ? 0 : (1 - u) ** 2 * (1 + 2 * u));

/** The rest height of pad i (along the couch, 7 at the head), j (across): two knots on a low, uneven field. */
const rest = (i, j) =>
  0.9 + 0.35 * ((i * 5 + j * 3) % 3)
  + 12 * Math.exp(-(((i - 5.7) / 1.3) ** 2 + ((j - 0.7) / 1.1) ** 2))
  + 8 * Math.exp(-(((i - 2.1) / 1.2) ** 2 + ((j - 1.6) / 1) ** 2));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.1);
  fit(C, [[-3, -3, ZT + 3], [-3, LY + 3, ZB], [LX + 38, 4, ZT], [LX + 38, LY - 4, ZB + 2], [LX - 16, LY - 7, 0], [6.5 * CX, 1.5 * CY, ZT + rest(6, 1)]], 200, 166);
  const P = proj(C), front = facing(C);
  let R = value * CX, over = null;

  const g = mk("g", {}, svg), pads = [];
  const box = (x0, y0, x1, y1, r, b, z0, z1) => {
    const [ring, inner] = rings(x0, y0, x1, y1, r, b);
    put(solid(g), prism(P, front, ring, inner, z0, z1));
  };
  // Back to front, bottom to top: the base, the top that overhangs it, the head part in front of both.
  box(16, 7, LX - 16, LY - 7, 6, 1.6, 0, ZB);
  box(-3, -3, LX + 3, LY + 3, 8, 1, ZB, ZT);
  box(LX + 6, 3, LX + 38, LY - 3, 10, 1, ZB + 2, ZT);
  // The face hole: its rim, and the far wall seen through it.
  const hole = rrect(LX + 14.5, 12.5, LX + 29.5, LY - 12.5, 7, 6);
  mk("path", { d: poly(ringAt(P, hole, ZT)), class: "sil" }, g);
  mk("path", { d: open(ringAt(P, run(hole, (s) => s.nu + s.nv < -0.9), ZT - 3)), class: "lo nf" }, g);

  // Diagonal by diagonal from the far corner, so appending is painting back to front.
  for (let s = 0; s <= NX + NY - 2; s++) for (let i = 0; i < NX; i++) {
    const j = s - i;
    if (j < 0 || j >= NY) continue;
    const h0 = rest(i, j);
    const [ring, inner] = rings(i * CX + GAP / 2, j * CY + GAP / 2, (i + 1) * CX - GAP / 2, (j + 1) * CY - GAP / 2, 3.6, 1);
    pads.push({ i, j, h0, cx: (i + 0.5) * CX, cy: (j + 0.5) * CY, ring, inner, sp: spring(h0, { eps: 0.04 }), el: solid(g), drawn: NaN });
  }

  // The mark: one bright pad with a dot on its lid, the dot moved in the paint
  // order to just after its pad, so the pads in front still cover it.
  const dot = flatDot(g, C, 1.1, "dot");
  const peak = pads.reduce((a, b) => (b.h0 > a.h0 ? b : a));
  let mc = null, want = peak;

  function drawMark() {
    if (want !== mc) {
      if (mc) mc.el.sil.classList.remove("hi");
      mc = want;
      mc.el.sil.classList.add("hi");
      mc.el.g.after(dot);
    }
    place(dot, P(mc.cx, mc.cy, ZT + Math.max(HMIN, mc.sp.x)));
  }
  // A pad whose spring hasn't moved keeps its paths.
  function drawPad(c) {
    const h = Math.max(HMIN, c.sp.x);
    if (h === c.drawn) return;
    c.drawn = h;
    put(c.el, prism(P, front, c.ring, c.inner, ZT, ZT + h));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const c of pads) { if (stepS(c.sp, dt)) m = true; drawPad(c); }
    drawMark();
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    for (const c of pads) {
      c.sp.t = over ? lerp(c.h0, HMIN, press(Math.hypot(c.cx - over[0], c.cy - over[1]) / R)) : c.h0;
    }
    want = over ? want : peak;
    read.textContent = over ? `feld ${want.i + 1} ${want.j + 1}` : "rest";
    B.wake();
  }

  // The pads rest at different heights, so the pointer is put on each pad's own
  // rest lid and the pad that finds it nearest its middle is the one it is on.
  // Rest heights never move, so neither does the hit test.
  function pick(p) {
    let bd = Infinity;
    for (const c of pads) {
      const q = unproj(C, p[0], p[1], ZT + c.h0), d = Math.hypot(q[0] - c.cx, q[1] - c.cy);
      if (d < bd) { bd = d; want = c; over = [clamp(q[0], 0, LX), clamp(q[1], 0, LY)]; }
    }
    retarget();
  }

  bag.add(pointer(stage, {
    move: pick,
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v * CX; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "kneten",
  means: "Verspannte Stellen ragen als Knoten aus der Liege und sinken weich ein, wo geknetet wird: je näher, desto tiefer.",
  rules: [1, 3, 5, 9],
  range: [1.5, 3.5, 5],
  tour: [[235, 154], [126, 125], [101, 106], null],
  mount,
});
