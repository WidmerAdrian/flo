/**
 * Rolle: a foam roller lying across a long rounded training mat. The pointer
 * is projected onto the mat's top (the ground plane, which never moves) and
 * says where along the mat the roller should be. It rolls there on one spring,
 * clamped to the stretch of mat the slider allows, and because it rolls, the
 * stripe that runs round it lengthwise, over the surface and across the end
 * face, turns with the distance travelled. A row of dots along the mat's near
 * edge marks the lanes; the read-out names the one under the roller. At rest
 * the roller sits a third along, stripe up.
 *
 * The pattern: one continuous number. A spring, a clamp, a hit test on the
 * ground plane, and a lying cylinder built by hand from two projected circles.
 */
const {
  Cam, clamp, lerp, fit, proj, unproj, facing, rings, prism, hull, poly, open, seg,
  spring, stepS, flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const L = 150, W = 64, T = 3;                       // the mat: long along x, its top at z 0
const R = 13, LR = 48, RC = 5.2, B = 1.5, DEEP = 4; // the roller: radius, length along y, core, crease inset, how far in the bore shows
const N = 7, LANE = L / N, DOTY = W / 2 - 4;        // the lanes and their dots
const XR = 2.5 * LANE, XMIN = R + 4, XMAX = L - R - 4; // rest, and the two ends of the mat
const RIBS = [-LR / 4, 0, LR / 4], TAU = Math.PI * 2;

/** World points of an arc round the roller's axis, in the vertical plane at y: the roller stands at x, a runs from +x up to +z. */
const arc = (x, y, r, a0, a1, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = lerp(a0, a1, i / n);
    return [x + r * Math.cos(a), y, R + r * Math.sin(a)];
  });

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2);
  // The frame holds the mat and the roller at its far end, where it stands highest on screen.
  fit(C, [[0, -W / 2, -T], [L, -W / 2, -T], [L, W / 2, -T], [0, W / 2, -T], ...arc(XMIN, -LR / 2, R, 0, TAU, 12)], 200, 166);
  const P = proj(C), front = facing(C);
  const pts = (w) => w.map((p) => P(p[0], p[1], p[2]));

  // P is linear, so the direction it flattens, the way to the camera, is the cross product of its axes.
  const o = P(0, 0, 0), ax = (p) => [p[0] - o[0], p[1] - o[1]], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const ex = ax(P(1, 0, 0)), ey = ax(P(0, 1, 0)), ez = ax(P(0, 0, 1));
  const vx = cross(ey, ez), vy = cross(ez, ex), vz = cross(ex, ey);
  // The middle of the half of the roller that faces the camera, as an angle round its axis,
  // and half the arc of the bore's wall, DEEP in, that the core's opening leaves in sight.
  const FACE = Math.atan2(vz, vx), BORE = Math.acos((DEEP * Math.hypot(vx, vz)) / vy / (2 * RC));

  let reach = value, over = null, lane = -1, drawn = NaN;
  const sp = spring(XR);

  // Back to front: the mat, its lane dots, then the roller that lies on it.
  const g = mk("g", {}, svg);
  const [mr, mi] = rings(0, -W / 2, L, W / 2, 9, 2);
  put(solid(g), prism(P, front, mr, mi, -T, 0));
  const dots = [];
  for (let i = 0; i < N; i++) {
    const d = flatDot(g, C, 1.5, "dot off");
    place(d, P((i + 0.5) * LANE, DOTY, 0));
    dots.push(d);
  }
  const roll = mk("g", {}, g);
  const sil = mk("path", { class: "sil" }, roll);       // the hull of the two round ends
  const core = mk("path", {}, roll);                    // the hollow core on the near end
  const dim = mk("path", { class: "lo nf" }, roll);     // the near end's crease, the bore's far wall, the ribs
  const mark = mk("path", { class: "hi nf" }, roll);    // the one bright stripe: two seams, joined across the end face

  const at = (x, y, r, a) => P(x + r * Math.cos(a), y, R + r * Math.sin(a));
  /** A seam: a straight line along the roller at angle a, drawn only while it is on the camera's side. */
  const seam = (x, a) => (Math.cos(a - FACE) > 0 ? seg(at(x, -LR / 2, R, a), at(x, LR / 2, R, a)) : "");
  /** Its tick on the near end face, from the core out to the crease. */
  const tick = (x, a) => seg(at(x, LR / 2, RC + 1.6, a), at(x, LR / 2, R - B, a));

  function draw(x) {
    if (x === drawn) return;
    drawn = x;
    const a = FACE + 0.35 - (x - XR) / R; // rolling without slipping: the angle is the distance over the radius
    sil.setAttribute("d", poly(hull(pts(arc(x, -LR / 2, R, 0, TAU, 28).concat(arc(x, LR / 2, R, 0, TAU, 28))))));
    core.setAttribute("d", poly(pts(arc(x, LR / 2, RC, 0, TAU, 16))));
    // The crease just inside the near end, and the far wall of the bore seen through the core.
    let d = poly(pts(arc(x, LR / 2, R - B, 0, TAU, 28))) + open(pts(arc(x, LR / 2 - DEEP, RC, FACE + Math.PI - BORE, FACE + Math.PI + BORE, 8)));
    for (const y of RIBS) d += open(pts(arc(x, y, R, FACE - Math.PI / 2, FACE + Math.PI / 2, 12)));
    dim.setAttribute("d", d);
    mark.setAttribute("d", seam(x, a) + seam(x, a + Math.PI) + tick(x, a) + tick(x, a + Math.PI));
    const now = clamp(Math.floor(x / LANE), 0, N - 1);
    if (now === lane) return;
    lane = now;
    dots.forEach((el, i) => { el.classList.toggle("off", i !== lane); el.classList.toggle("m", i === lane); });
  }

  const loop = register(stage, (dt) => {
    const m = stepS(sp, dt);
    draw(sp.x);
    return m;
  });
  bag.add(loop.unregister);

  function retarget() {
    if (over) {
      sp.t = clamp(over[0], lerp(XR, XMIN, reach), lerp(XR, XMAX, reach));
      read.textContent = `bahn ${clamp(Math.floor(sp.t / LANE), 0, N - 1) + 1}`;
    } else { sp.t = XR; read.textContent = "rest"; }
    loop.wake();
  }
  const go = (p) => { over = unproj(C, p[0], p[1], 0); retarget(); };

  bag.add(pointer(stage, { move: go, down: go, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());
  draw(sp.x);
  read.textContent = "rest";

  return {
    set: (v) => { reach = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "rolle",
  means: "Die Rolle rollt auf der Matte zur gezeigten Stelle und dreht sich mit dem zurückgelegten Weg.",
  rules: [1, 3, 5, 6, 9],
  range: [0.4, 0.75, 1],
  tour: [[261, 208], [133, 145], [200, 178], null],
  mount,
});
