/**
 * Tape: a roll of tape lying flat, its strip pulled out along the ground. The
 * pointer is projected onto the ground, and the strip's rounded end follows it
 * along the strip's own line, on one spring, between a short tab and the far
 * reach. The strip slides out of the roll, so its cut marks, one dot every
 * STEP, come out from under the roll with it and count its length, and the
 * roll turns by the length pulled: a dot on its top rides round. At rest the
 * strip is out about a third and its end edge is the one bright mark. The
 * slider is the far reach.
 *
 * The pattern: one continuous number. A hit test on the ground plane (which
 * never moves), a clamp at both ends, one spring.
 */
const {
  Cam, circ, clamp, facing, fit, open, poly, prism, proj, ringAt, rrect, run, unproj, spring, stepS,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

// The roll stands on the origin. The strip runs along +x, its near edge a touch inside the roll's tangent at y = R.
const R = 28, H = 20, CORE = 12, MARK = 20, A0 = 3.1;
const Y1 = R - 0.6, Y0 = Y1 - H, YC = (Y0 + Y1) / 2, T = 1, RC = 6, B = 1.6;
// Lengths are the end's x. A dot is clear of the roll from SEEN on. Rest and the slider's three reaches sit two units
// past a multiple of STEP, so at each of them every dot is well clear of the roll or wholly under it, as at the tab.
const TAB = 33, REST = 58, STEP = 14, SEEN = 26, DOTS = 7, FIT = 86;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 3);
  // Centred on a pull of FIT, not the farthest: rest sits near the middle and the far reach still ends inside the frame.
  const q = R * Math.SQRT1_2;
  fit(C, [[-q, q, 0], [q, q, 0], [-q, -q, H], [FIT, Y0, 0], [FIT, Y1, 0]], 200, 166);
  const P = proj(C), front = facing(C);
  let far = value, over = null, drawn = NaN;
  const len = spring(REST);

  // Back to front: the strip lies on the ground and runs under the roll, so the roll is painted over it.
  const g = mk("g", {}, svg);
  const strip = solid(g);
  const edge = mk("path", { class: "sil nf hi" }, g);
  const dots = [];
  for (let k = 0; k < DOTS; k++) dots.push(flatDot(g, C, 1.6, "dot m"));
  put(solid(g), prism(P, front, circ(R, 72), circ(R - 2, 72), 0, H));
  mk("path", { d: poly(ringAt(P, circ(CORE, 48), H)) }, g);
  const mark = flatDot(g, C, 1.6, "dot m");

  function draw() {
    const L = len.x;
    if (L === drawn) return;
    drawn = L;
    const ring = rrect(0, Y0, L, Y1, RC, 8);
    put(strip, prism(P, front, ring, rrect(B, Y0 + B, L - B, Y1 - B, RC - B, 8), 0, T));
    // The bright end: the silhouette round the far end, on the ground where it faces the camera, on the top where it does not.
    const end = run(ring, (s) => s.u > L - RC - 0.01);
    edge.setAttribute("d", open(end.map((s) => P(s.u, s.v, front(s) ? 0 : T))));
    // The marks ride the tape: each a fixed way behind the end, the hindmost still under the roll.
    dots.forEach((d, k) => place(d, P(Math.max(0, L - (k + 1) * STEP), YC, T)));
    // The roll gives the length it turns: L / R radians, the way the tape leaves it.
    const a = A0 - L / R;
    place(mark, P(MARK * Math.cos(a), MARK * Math.sin(a), H));
  }

  const loop = register(stage, (dt) => {
    const moving = stepS(len, dt);
    draw();
    return moving;
  });
  bag.add(loop.unregister);

  function retarget() {
    const t = over ? clamp(over[0], TAB, far) : REST;
    len.t = t;
    read.textContent = over ? `band ${Math.floor((t - SEEN) / STEP)}` : "rest";
    loop.wake();
  }
  const pull = (p) => { over = unproj(C, p[0], p[1], 0); retarget(); };

  bag.add(pointer(stage, { move: pull, down: pull, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";
  draw();

  return {
    set: (v) => { far = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "tape",
  means: "Das Band folgt dem Zeiger von der Rolle, und Punkte auf dem Streifen zählen seine Länge.",
  rules: [1, 3, 5, 6, 9],
  range: [86, 100, 114],
  tour: [[274, 248], [376, 299], [185, 204], null],
  mount,
});
