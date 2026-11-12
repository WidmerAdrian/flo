/**
 * Lymph: a rounded rack, two plates between two end walls, holding seven
 * standing tubes with open rims. A tube's height is its level: a column of
 * fluid. At rest the columns swell high in the middle and the highest rim is
 * the one bright mark. The pointer picks a tube: it drains to low and takes
 * the bright stroke, and its neighbours fall less and less, staggered outwards
 * from it on the 700ms tween. The slider is the stagger, in ms.
 *
 * The pattern: discrete items. The hit test is a static band per tube, from
 * above the tallest rest height down to the rack's foot, so a rim sinking out
 * from under the pointer cannot flip the choice.
 */
const {
  Cam, circ, facing, fit, hull, lerp, poly, prism, proj, r2, ringAt, rings,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const N = 7, G = 23, R = 8, RB = 2.4;
// the rack: two plates PT thick, the shelf's underside at ZS, an end wall WT thick set in from each end
const X0 = -16, X1 = (N - 1) * G + 16, Y0 = -13, Y1 = 13, PR = 6, PT = 3, ZS = 17, WT = 3;
// the levels, as the tubes' heights: swollen in the middle at rest; LOW is drained. FALL is how much of its swelling a tube keeps, by distance.
const REST = [38, 50, 62, 72, 66, 52, 41], LOW = 28, FALL = [0, 0.5, 0.78, 0.92];
const H = Math.max(...REST), TOP = REST.indexOf(H);

/** A ring moved to stand on tube i's axis. */
const at = (ring, i) => ring.map((q) => ({ u: q.u + i * G, v: q.v, nu: q.nu, nv: q.nv }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // The tubes only ever sink: the camera is fitted to the rack and the tallest rest height.
  const C = Cam(45, 0.5, 2);
  fit(C, [[X0, Y0, 0], [X1, Y0, 0], [X0, Y1, 0], [X1, Y1, 0], [-R, -R, H], [(N - 1) * G + R, R, H]], 200, 166);
  const P = proj(C), front = facing(C);
  const wall = circ(R, 24), bore = circ(R - RB, 24);

  const g = mk("g", {}, svg);
  const box = (x0, x1, y0, y1, r, b, z0, z1) => put(solid(g), prism(P, front, ...rings(x0, y0, x1, y1, r, b), z0, z1));
  const span = (ring, z0, z1) => poly(hull(ringAt(P, ring, z0).concat(ringAt(P, ring, z1))));

  // back to front: the foot, the far wall, the tubes' feet, the near wall, the shelf over them, then the tubes above it
  box(X0, X1, Y0, Y1, PR, 1.2, 0, PT);
  box(X0 + 3, X0 + 3 + WT, Y0 + 3, Y1 - 3, 1.4, 0.6, PT, ZS);
  for (let i = 0; i < N; i++) mk("path", { d: span(at(wall, i), PT, ZS), class: "sil" }, g);
  box(X1 - 3 - WT, X1 - 3, Y0 + 3, Y1 - 3, 1.4, 0.6, PT, ZS);
  box(X0, X1, Y0, Y1, PR, 1.2, ZS, ZS + PT);

  const tubes = [];
  for (let i = 0; i < N; i++) {
    // a tube above the shelf: its silhouette, its rim, which is its level, and the bore that makes the rim open
    const sil = mk("path", { class: "sil" }, g), rim = mk("path", { class: i === TOP ? "nf hi" : "nf" }, g), hole = mk("path", { class: "nf" }, g);
    tubes.push({ sil, rim, hole, ring: at(wall, i), bore: at(bore, i), lv: tween(REST[i]), drawn: -1 });
  }

  // hit bands: one upright strip per tube, from above its rim to under the rack. The tubes never move, and nothing draws the bands.
  const c0 = P(0, 0, 0), step = P(G, 0, 0)[0] - c0[0];
  /** The tube whose strip holds the point; -1 outside. */
  function hit([x, y]) {
    const s = (x - c0[0]) / step, i = Math.round(s);
    if (s < -0.6 || s > N - 0.4) return -1;
    const k = Math.min(Math.max(i, 0), N - 1);
    return y < P(k * G, 0, H)[1] - 10 || y > P(k * G, 0, 0)[1] + 14 ? -1 : k;
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    tubes.forEach((t) => {
      const z = r2(tval(t.lv, now));
      // a level that did not change is not drawn again
      if (z !== t.drawn) {
        t.drawn = z;
        t.sil.setAttribute("d", span(t.ring, ZS + PT, z));
        t.rim.setAttribute("d", poly(ringAt(P, t.ring, z)));
        t.hole.setAttribute("d", poly(ringAt(P, t.bore, z)));
      }
      if (!tdone(t.lv, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  /** Drains tube a (-1 lets them all fill again). The stagger spreads out from the tube picked, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    tubes.forEach((t, i) => {
      const keep = a < 0 ? 1 : FALL[Math.min(Math.abs(i - a), FALL.length - 1)];
      tset(t.lv, lerp(LOW, REST[i], keep), now, Math.abs(i - from) * stag);
      t.rim.classList.toggle("hi", i === (a < 0 ? TOP : a));
    });
    read.textContent = a < 0 ? "rest" : "röhre " + (a + 1);
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), down: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "lymph",
  means: "Gestaute Flüssigkeit fliesst ab: Die gewählte Röhre leert sich, und die Pegel daneben sinken mit, je näher, desto mehr.",
  rules: [1, 2, 5, 8],
  range: [0, 45, 90],
  tour: [[135, 122], [200, 154], [265, 187], null],
  mount,
});
