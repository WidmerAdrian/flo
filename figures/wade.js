/**
 * Wade: a runner's lower leg lying across a foam roller on a training mat. The
 * calf is one thick limb, a sweep of spheres from the knee end over the belly
 * of the muscle down to the ankle, and it ends in a foot standing up: the sole
 * with its round heel faces the eye, five toes point up. The roller lies
 * crosswise under the calf. The pointer, projected onto a level plane through
 * the resting calf (it never moves) and clamped to the calf's length, says
 * where the roller should be: it rolls there on one spring, its stripe turning
 * with the distance, and the leg, hinged at the knee end, rides over it, so
 * the foot lifts as the roller comes up the calf. At rest the roller sits
 * under the lower third and carries the one bright mark. The slider is how far
 * the knee end hangs below the roller's top: how steeply the leg is lifted.
 *
 * The pattern: one continuous number. A spring, a clamp, a hit test on a fixed
 * plane, a lying cylinder and a limb built by hand from projected circles.
 */
const {
  Cam, clamp, lerp, fit, proj, unproj, facing, rings, prism, hull, fillet, poly, open, seg,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const S = 2.3, TAU = Math.PI * 2;
const L = 124, W = 62, T = 3;                       // the mat: long along x, its top at z 0
const R = 12, LR = 50, RC = 4.8, B = 1.5, DEEP = 4; // the roller: radius, length along y, core, crease inset, how far in the bore shows
const XK = 16, YL = -7, LEN = 88, N = 16, LMAX = 8; // the leg: its knee end, its place across the mat, its length to the ankle, its sections, the slider's far end
const XMIN = XK + 30, XMAX = XK + LEN - 20, XR = XK + LEN * 0.7, ZONES = 5; // the calf's two ends for the roller, and its rest
const ZP = 2 * R + 9;                               // the level plane the pointer is read on: the resting calf's axis
const RIBS = [-LR / 2 + 7, LR / 2 - 7];
// The sole (y across, b up the foot from the ankle's axis), heel down; and the toes [y, radius, length], far to near.
const SOLE = fillet([[-7, -10], [7, -10], [11, 19], [9.5, 27], [-9.5, 27], [-11, 19]], [7, 7, 7, 4, 4, 7], 8);
const TOES = [[-9.6, 1.9, 4], [-6.1, 2, 4.6], [-2.4, 2.1, 5.3], [1.6, 2.3, 6], [7.2, 3.7, 5.8]];

/** The calf's radius at s, 0 at the knee end and 1 at the ankle: the belly of the muscle, then the taper. */
const girth = (s) => 6 + 3 * (1 - s) + 4.2 * Math.exp(-(((s - 0.32) / 0.25) ** 2));

/** The leg, stiff, hinged at its knee end and resting on the roller at x: maps (a along it, y across, b up from its axis) to the world. */
function limb(x, lift) {
  const g0 = girth(0), m = (lift + girth((x - XK) / LEN) - g0) / (x - XK), c = 1 / Math.hypot(1, m), s = m * c;
  return (a, y, b) => [XK + a * c - b * s, YL + y, 2 * R - lift + g0 + a * s + b * c];
}

/** A sweep of spheres on screen: a sphere projects to a circle, so the outline is the envelope of circles c[i], radius r[i]. Gives [outline, its upper run]. */
function sweep(c, r) {
  const n = c.length - 1, up = [], dn = [], cap0 = [], capN = [];
  for (let i = 0; i <= n; i++) {
    const j = Math.max(i - 1, 0), k = Math.min(i + 1, n);
    const tx = c[k][0] - c[j][0], ty = c[k][1] - c[j][1], d = Math.hypot(tx, ty);
    const q = clamp((r[k] - r[j]) / d, -1, 1), f = Math.atan2(Math.sqrt(1 - q * q), -q);
    // The point of circle i at angle a from the way the limb runs; the tangent points sit at -f and f.
    const pt = (a) => [c[i][0] + (r[i] * (Math.cos(a) * tx - Math.sin(a) * ty)) / d, c[i][1] + (r[i] * (Math.sin(a) * tx + Math.cos(a) * ty)) / d];
    up.push(pt(-f)); dn.push(pt(f));
    for (let e = 1; e < 14; e++) {
      if (i === 0) cap0.push(pt(lerp(f, TAU - f, e / 14)));
      if (i === n) capN.push(pt(lerp(-f, f, e / 14)));
    }
  }
  return [up.concat(capN, dn.reverse(), cap0), up];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, S), top = limb(XMIN, LMAX);
  // The frame holds the mat, the roller at the knee end, and the toes where the steepest leg lifts them.
  fit(C, [[0, -W / 2, -T], [L, -W / 2, -T], [L, W / 2, -T], [0, W / 2, -T], [XMIN, -LR / 2, 2 * R], top(LEN + 7, -10, 34), top(LEN + 7, 10, 34)], 200, 166);
  const P = proj(C), front = facing(C);
  const pts = (w) => w.map((p) => P(p[0], p[1], p[2]));

  // P is linear, so the direction it flattens, the way to the camera, is the cross product of its axes.
  const o = P(0, 0, 0), ax = (p) => [p[0] - o[0], p[1] - o[1]], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const ex = ax(P(1, 0, 0)), ey = ax(P(0, 1, 0)), ez = ax(P(0, 0, 1));
  const vx = cross(ey, ez), vy = cross(ez, ex), vz = cross(ex, ey);
  // The middle of the half of the roller that faces the camera, as an angle round its axis,
  // and half the arc of the bore's wall, DEEP in, that the core's opening leaves in sight.
  const FACE = Math.atan2(vz, vx), BORE = Math.acos((DEEP * Math.hypot(vx, vz)) / vy / (2 * RC));

  let over = null, dx = NaN, dl = NaN;
  const sp = spring(XR), lf = spring(value);

  // Back to front: the mat, the roller that lies on it, then the leg that lies on the roller:
  // the calf, the toes behind the sole, the foot.
  const g = mk("g", {}, svg);
  const [mr, mi] = rings(0, -W / 2, L, W / 2, 9, 2);
  put(solid(g), prism(P, front, mr, mi, -T, 0));
  const roll = mk("g", {}, g);
  const sil = mk("path", { class: "sil" }, roll);       // the hull of the two round ends
  const core = mk("path", {}, roll);                    // the hollow core on the near end
  const dim = mk("path", { class: "lo nf" }, roll);     // the near end's crease, the bore's far wall, the ribs
  const mark = mk("path", { class: "hi nf" }, roll);    // the one bright stripe: two seams, joined across the end face
  const calf = solid(g), toes = TOES.map(() => mk("path", { class: "sil" }, g)), foot = solid(g);

  /** World points of an arc round the roller's axis, in the vertical plane at y: a runs from +x up to +z. */
  const arc = (x, y, r, a0, a1, n) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = lerp(a0, a1, i / n);
      return [x + r * Math.cos(a), y, R + r * Math.sin(a)];
    });
  const on = (x, y, r, a) => P(x + r * Math.cos(a), y, R + r * Math.sin(a));
  /** A seam: a straight line along the roller at angle a, drawn only while it is on the camera's side. */
  const seam = (x, a) => (Math.cos(a - FACE) > 0 ? seg(on(x, -LR / 2, R, a), on(x, LR / 2, R, a)) : "");
  /** Its tick on the near end face, from the core out to the crease. */
  const tick = (x, a) => seg(on(x, LR / 2, RC + 1.6, a), on(x, LR / 2, R - B, a));

  function drawRoller(x) {
    const a = FACE + 0.35 - (x - XR) / R; // rolling without slipping: the angle is the distance over the radius
    sil.setAttribute("d", poly(hull(pts(arc(x, -LR / 2, R, 0, TAU, 28).concat(arc(x, LR / 2, R, 0, TAU, 28))))));
    core.setAttribute("d", poly(pts(arc(x, LR / 2, RC, 0, TAU, 16))));
    let d = poly(pts(arc(x, LR / 2, R - B, 0, TAU, 28))) + open(pts(arc(x, LR / 2 - DEEP, RC, FACE + Math.PI - BORE, FACE + Math.PI + BORE, 8)));
    for (const y of RIBS) d += open(pts(arc(x, y, R, FACE - Math.PI / 2, FACE + Math.PI / 2, 12)));
    dim.setAttribute("d", d);
    mark.setAttribute("d", seam(x, a) + seam(x, a + Math.PI) + tick(x, a) + tick(x, a + Math.PI));
  }

  function drawLeg(x, lift) {
    const w = limb(x, lift), at = (a, y, b) => P(...w(a, y, b));
    const c = [], r = [];
    for (let i = 0; i <= N; i++) { c.push(at((i / N) * LEN, 0, 0)); r.push(girth(i / N) * S); }
    // The calf: its outline, and one crease along its top, a little inside.
    put(calf, { sil: poly(sweep(c, r)[0]), crease: open(sweep(c, r.map((v) => v - 2 * S))[1].slice(2, -2)) });
    TOES.forEach(([y, tr, len], i) =>
      toes[i].setAttribute("d", poly(sweep([at(LEN + 10 - tr, y, 24), at(LEN + 10 - tr, y, 26 + len)], [tr * S, tr * S])[0])));
    // The foot: the sole, facing the eye, hulled with its back, which is deep at the heel and thin at the toes.
    const back = SOLE.map(([y, b]) => at(LEN + lerp(-3, 5.5, (b + 10) / 37), y * 0.9, b));
    put(foot, {
      sil: poly(hull(SOLE.map(([y, b]) => at(LEN + 10, y, b)).concat(back))),
      crease: poly(SOLE.map(([y, b]) => at(LEN + 10, y * 0.82, 8.5 + (b - 8.5) * 0.9))),
    });
  }

  function draw(x, lift) {
    if (x === dx && lift === dl) return;
    if (x !== dx) drawRoller(x);
    dx = x; dl = lift;
    drawLeg(x, lift);
  }

  const loop = register(stage, (dt) => {
    const a = stepS(sp, dt), b = stepS(lf, dt);
    draw(sp.x, lf.x);
    return a || b;
  });
  bag.add(loop.unregister);

  function retarget() {
    if (over === null) { sp.t = XR; read.textContent = "rest"; }
    else {
      sp.t = clamp(over, XMIN, XMAX);
      read.textContent = `wade ${Math.min(ZONES, 1 + Math.floor(((sp.t - XMIN) / (XMAX - XMIN)) * ZONES))}`;
    }
    loop.wake();
  }
  const go = (p) => { over = unproj(C, p[0], p[1], ZP)[0]; retarget(); };

  bag.add(pointer(stage, { move: go, down: go, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());
  draw(sp.x, lf.x);
  read.textContent = "rest";

  return {
    set: (v) => { lf.t = v; loop.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "wade",
  means: "Die Wade liegt auf der Faszienrolle: Sie rollt zur gezeigten Stelle, und das Bein hebt sich über ihr.",
  rules: [1, 3, 5, 6, 9],
  range: [2, 5, 8],
  tour: [[185, 123], [247, 154], [208, 134], [227, 144], null],
  mount,
});
