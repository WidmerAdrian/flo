// Slow water in the logo's greens, with a photograph bent by it. One fragment shader, shared by the hero (plain
// WebGL below, so the first screen needs no 3D library) and the body section (three.js, in body3d.js).
// The plain-WebGL version adds a flow map: a small texture that remembers where the pointer pushed the water,
// carries that push along with itself and lets it fade, so a moving hand leaves long, soft streaks (FLOW below).
export const WATER = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float t, ia, has, pm; uniform vec2 res, off; uniform vec4 rp[4]; uniform sampler2D img;
#ifdef FADE
  uniform vec4 fade; // the water fades out towards the edges: opaque from (y) to (z), measured from the top; x/w unused
#endif
#ifdef FLOW
  uniform sampler2D flow;
  // a cut-out in front (premultiplied): where it sits (x, y, w, h from the top-left, 0..1), its drift, its opacity,
  // and how far the section has scrolled away (0..1)
  uniform sampler2D fg; uniform vec4 fgRect; uniform vec2 fgOff; uniform float fgA, scr;
#endif
  void main() {
    float ra = res.x / res.y;
    vec2 p = vec2(vUv.x * ra, vUv.y) * 2.1;
    // three slow folds: the surface
    vec2 q = p;
    for (int i = 1; i < 4; i++) { float f = float(i); q += vec2(sin(q.y * 1.25 + t * .11 * f), cos(q.x * 1.1 - t * .09 * f)) * .36 / f; }
    // rings from a tap or click, like a stone: rp = (x, y, age in s, strength)
    float wave = 0.; vec2 push = vec2(0.);
    for (int i = 0; i < 4; i++) {
      vec4 k = rp[i]; if (k.z < 0.) continue;
      vec2 d = vec2((vUv.x - k.x) * ra, vUv.y - k.y); float r = length(d);
      float w = sin(r * 30. - k.z * 6.) * exp(-r * 4.5) * exp(-k.z * 1.1) * smoothstep(0., .3, k.z) * k.w;
      wave += w; push += normalize(d + 1e-4) * w;
    }
    vec2 drift = vec2(0.); float streak = 0.;
#ifdef FLOW
    // the hand's streaks: velocity (xy, stored around .5) times strength (z)
    vec4 fl = texture2D(flow, vUv);
    drift = (fl.xy * 2. - 1.) * fl.z;
    streak = length(drift);
#endif
    float f = .5 + .5 * sin(q.x + q.y * .7) + wave * .22 + streak * .2;
    vec3 deep = vec3(.027, .078, .059), green = vec3(.047, .17, .125), sage = vec3(.565, .753, .69), brand = vec3(.063, .44, .314); // from the logo
    vec3 c = mix(deep, green, smoothstep(0., 1., f));
    c = mix(c, sage, smoothstep(.35, 1., f) * smoothstep(.95, -.1, vUv.x) * smoothstep(.2, .9, vUv.y) * .34);
    c = mix(c, brand, smoothstep(.25, 1., 1. - f) * smoothstep(.25, 1.05, vUv.x) * .55);
    if (has > .5) { // the photograph, bent by the same water, a little larger than the frame so parallax never shows its edge
      vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
      vec2 uv = (vUv - .5) * s * .9 + .5 + off + (q - p) * .018 + push * .03 - drift * .08;
      vec3 ph = texture2D(img, uv).rgb;
      c = mix(c, ph * (.35 + c * 2.2), pm * smoothstep(.02, .3, vUv.y));
    }
    c *= .82 + .22 * smoothstep(0., .9, vUv.y);
    c += streak * vec3(.035, .05, .045); // a faint sheen where the water moves
#ifdef FLOW
    c *= 1. - .55 * scr; // the water dims as the section scrolls away
    if (fgA > 0.) {
      vec2 fuv = (vec2(vUv.x, 1. - vUv.y) - fgRect.xy - fgOff) / fgRect.zw;
      if (fuv.x > 0. && fuv.x < 1. && fuv.y > 0. && fuv.y < 1.) { vec4 fc = texture2D(fg, fuv) * fgA; c = c * (1. - fc.a) + fc.rgb; }
    }
#endif
    // dither: about one level of noise per pixel, so the 8-bit output shows no steps in the dark gradients
    c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) * (2.5 / 255.);
#ifdef FADE
    float yt = 1. - vUv.y, a = smoothstep(0., fade.y, yt) * (1. - smoothstep(fade.z, 1., yt));
    if (fade.y <= 0.) a = 1. - smoothstep(fade.z, 1., yt);
    gl_FragColor = vec4(c * a, a);
#else
    gl_FragColor = vec4(c, 1.);
#endif
  }`;

// The flow map, one step per frame: carry the field along itself, let it fade, and stamp the pointer's velocity
// where it is. Stored in 8 bits (velocity around .5), so tiny leftovers are cut off instead of lingering forever.
const FLOW_STEP = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D prev; uniform vec2 mouse, vel; uniform float aspect, radius, alpha, keep;
  void main() {
    vec4 here = texture2D(prev, vUv);
    vec2 v0 = here.xy * 2. - 1.;
    vec2 curl = vec2(-v0.y, v0.x) * .35; // a slight turn: streaks curl as they travel
    vec4 a = texture2D(prev, vUv - (v0 + curl) * here.z * .01); // advect: the water carries its own motion along
    vec2 v = (a.xy * 2. - 1.) * keep; float s = a.z * keep;
    v = sign(v) * max(abs(v) - 1.5 / 255., 0.); s = max(s - 1.5 / 255., 0.);
    vec2 c = vUv - mouse; c.x *= aspect;
    float f = smoothstep(radius, 0., length(c)) * alpha;
    v = mix(v, clamp(vel, -1., 1.), f);
    s = mix(s, 1. - pow(1. - min(1., length(vel)), 3.), f);
    gl_FragColor = vec4(v * .5 + .5, s, 1.);
  }`;

const VERT = "attribute vec2 a; varying vec2 vUv; void main(){ vUv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }";

/** A section's background: water over a photograph, drifting with `setOffset`, stirred by `stir`. Null without WebGL. */
// A cut-out on its own canvas (padded around the image), moved by whole-GPU sampling instead of by the browser's
// pixel grid: that is what keeps a slow drift smooth in Safari. Returns { set(x, y) } in CSS pixels, or null.
export function mountLayer(canvas, img, pad) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, "precision mediump float; varying vec2 vUv; uniform sampler2D img; uniform vec4 r; void main(){ vec2 uv = (vec2(vUv.x, 1. - vUv.y) - r.xy) / r.zw; gl_FragColor = uv == clamp(uv, 0., 1.) ? texture2D(img, uv) : vec4(0.); }"));
  gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const r = gl.getUniformLocation(p, "r");
  let x = 0, y = 0;
  const draw = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (canvas.width !== Math.round(w * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); gl.viewport(0, 0, canvas.width, canvas.height); }
    gl.uniform4f(r, (pad + x) / w, (pad + y) / h, 1 - 2 * pad / w, 1 - 2 * pad / h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  addEventListener("resize", draw); draw();
  return { set(nx, ny) { x = nx; y = ny; draw(); } };
}

export function mountWater(canvas, photo, { mix = 0.85, auto = false, fade = [0, .45], front = null } = {}) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const program = (frag) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); return p; };
  const prog = program("#define FLOW\n#define FADE\n" + WATER), step = program(FLOW_STEP);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the screen
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const u = { fg: U(prog, "fg"), fgRect: U(prog, "fgRect"), fgOff: U(prog, "fgOff"), fgA: U(prog, "fgA"), scr: U(prog, "scr"), fade: U(prog, "fade"), t: U(prog, "t"), res: U(prog, "res"), off: U(prog, "off"), rp: U(prog, "rp"), ia: U(prog, "ia"), has: U(prog, "has"), pm: U(prog, "pm"), img: U(prog, "img"), flow: U(prog, "flow") };
  const us = { prev: U(step, "prev"), mouse: U(step, "mouse"), vel: U(step, "vel"), aspect: U(step, "aspect"), radius: U(step, "radius"), alpha: U(step, "alpha"), keep: U(step, "keep") };
  gl.useProgram(prog); gl.uniform1i(u.fg, 2); gl.uniform1f(u.fgA, 0); gl.uniform4f(u.fade, 0, fade[0], fade[1], 0); gl.uniform1f(u.pm, mix); gl.uniform1f(u.has, 0); gl.uniform1i(u.img, 0); gl.uniform1i(u.flow, 1);
  gl.useProgram(step); gl.uniform1i(us.prev, 1); gl.uniform1f(us.radius, .09); // the brush: tight around the pointer
  const rp = new Float32Array([0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0]); let slot = 0;

  // two small textures the flow map ping-pongs between, starting at rest (velocity .5 = zero, strength 0)
  const N = 128, rest = new Uint8Array(N * N * 4);
  for (let i = 0; i < rest.length; i += 4) { rest[i] = 128; rest[i + 1] = 128; rest[i + 3] = 255; }
  const targets = [0, 1].map(() => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, rest);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let read = 0;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, visible = true, last = 0, t = 0, ox = 0, oy = 0, W = 1, H = 1;
  // the cut-out: the page lays out an (invisible) <img>, the shader draws it where the page put it
  let fgReady = false, fx = 0, fy = 0, sc = 0;
  const fgRect = [0, 0, 1, 1];
  function measureFront() {
    if (!front) return;
    const c = canvas.getBoundingClientRect(), r = front.getBoundingClientRect();
    if (!c.width || !r.width) return;
    fgRect[0] = (r.left - c.left) / c.width; fgRect[1] = (r.top - c.top) / c.height; fgRect[2] = r.width / c.width; fgRect[3] = r.height / c.height;
  }
  function loadFront() {
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, front);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    front.style.animation = "none"; // measure where the page lays it out, not a frame of its entrance (a transform shifts the box)
    fgReady = true; measureFront(); canvas.dispatchEvent(new Event("front")); wake();
  }
  if (front) (front.complete && front.naturalWidth ? Promise.resolve() : new Promise((ok) => front.addEventListener("load", ok, { once: true }))).then(() => front.decode?.().catch(() => {})).then(loadFront);
  // the pointer: where it is now (mx, my), where it was last frame, and how strongly this input counts
  let mx = .5, my = .5, px = -1, py = -1, gain = 1, vx = 0, vy = 0, stirred = 0, hand = 0;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.useProgram(prog); gl.uniform1f(u.ia, img.width / img.height); gl.uniform1f(u.has, 1);
    canvas.classList.add("on"); wake();
  };
  img.src = photo;

  function resize() {
    const scale = .85; // the water is soft: rendering below full resolution looks the same and costs far less per frame
    W = Math.round(canvas.clientWidth * scale); H = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.useProgram(prog); gl.uniform2f(u.res, W, H); }
    measureFront(); wake();
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!still.matches) t += dt;
    for (let i = 2; i < 16; i += 4) if (rp[i] >= 0) rp[i] = rp[i] > 6 ? -1 : rp[i] + dt;

    // no hand for a while (phones): an unseen one glides along a slow figure eight, on this same clock
    hand = Math.max(0, hand - dt);
    if (auto && hand <= 0 && !still.matches) { mx = .5 + Math.sin(t * .21) * .32; my = 1 - (.42 + Math.sin(t * .37) * .22); gain = 4; stirred = .15; if (px < 0) { px = mx; py = my; } }
    // pointer velocity, smoothed, in "screens per second"; it eases out once the hand stops
    if (px >= 0 && dt > 0) {
      const k = Math.min(1, dt * 12);
      vx += (((mx - px) / dt) * gain - vx) * k; vy += (((my - py) / dt) * gain - vy) * k;
      const m = Math.hypot(vx, vy), cap = 2.5; if (m > cap) { vx *= cap / m; vy *= cap / m; } // a flick never becomes a flood
    }
    px = mx; py = my;
    stirred = Math.max(0, stirred - dt);
    const sp = Math.hypot(vx, vy) * .6;
    // one step of the flow map, into the other texture
    gl.useProgram(step);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1 - read].fb); gl.viewport(0, 0, N, N);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, targets[read].tex);
    gl.uniform2f(us.mouse, mx, my); gl.uniform2f(us.vel, vx * .6, vy * .6); gl.uniform1f(us.aspect, W / H);
    gl.uniform1f(us.alpha, stirred > 0 ? Math.min(1, sp * 4) : 0); gl.uniform1f(us.keep, Math.pow(.955, dt * 60));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    read = 1 - read;
    // the picture, bent by it
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, targets[read].tex);
    gl.uniform1f(u.t, t); gl.uniform2f(u.off, ox, oy); gl.uniform4fv(u.rp, rp); gl.uniform1f(u.scr, sc);
    if (fgReady) {
      // entrance: rises and fades in 1.5 s after the page starts; leaving: rises and fades with the scroll
      const k = Math.min(1, Math.max(0, (now - 1500) / 1600)), ein = 1 - Math.pow(1 - k, 3);
      const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
      gl.activeTexture(gl.TEXTURE2);
      gl.uniform4fv(u.fgRect, fgRect);
      gl.uniform2f(u.fgOff, fx / cw, (fy + (1 - ein) * 40) / ch - sc * .18 * fgRect[3]);
      gl.uniform1f(u.fgA, ein * (1 - .8 * sc));
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible && !still.matches) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) wake(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) wake(); });
  return {
    /** Shifts the photograph by a fraction of the frame (parallax). */
    setOffset(x, y) { ox = x; oy = y; if (still.matches) wake(); },
    /** Moves the cut-out by (x, y) CSS pixels (its own parallax). */
    setFront(x, y) { fx = x; fy = y; },
    /** How far the section has scrolled out of view, 0..1. */
    setScroll(v) { if (v !== sc) { sc = v; wake(); } },
    /** True once the cut-out is drawn by the shader (the page can hide its own copy). */
    get front() { return fgReady; },
    /** Rings from a point, like a stone (0..1 of the canvas, y from the top; strength 0..1). */
    ripple(x, y, strength = 1) { rp.set([x, 1 - y, 0, strength], slot * 4); slot = (slot + 1) % 4; wake(); },
    /** A hand moving through the water (0..1, y from the top). `strength` scales the push: 1 for a real pointer, more for a slow drift. */
    stir(x, y, strength = 1) {
      // first contact (or back after a pause): start the stroke here, so the jump from wherever it was is no motion
      if (px < 0 || hand <= 0) { px = x; py = 1 - y; vx = 0; vy = 0; }
      mx = x; my = 1 - y; gain = strength; stirred = .15; hand = .6; wake();
    },
  };
}
