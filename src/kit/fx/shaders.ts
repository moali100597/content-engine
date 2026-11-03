// GLSL effect library for Remotion (WebGL through three.js). Ported by hand from the WGSL compute shaders of
// ArtCraft EffectCraft and LightCraft (https://github.com/storytold, Apache License 2.0; see ./NOTICE.md):
// Lumetri-style grade (fx_color.wgsl fxc_lumetri, fxc_builtin_look, fxc_tone_curve), Add Grain (fx_generate.wgsl
// gen_grain_*), CC Light Rays (fx_light.wgsl flt_rays), glow (fx_stylize.wgsl fxs_glow_*), displacement
// (fx_distort.wgsl dst_turbulent, dst_wavewarp), wipes and block/glass transitions (fx_transition.wgsl, fx_generate.wgsl
// gen_linear_wipe / gen_radial_wipe / gen_gradient_wipe). Each GLSL function keeps the maths of its source; compute
// passes became single-pass fragment shaders (the glow uses a fixed 3-ring kernel instead of a separate blur pass).

export const COMMON = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;        // output size in px
uniform float uTime;       // seconds
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sstep(float a, float b, float x) { if (abs(b - a) < 1e-9) return x < a ? 0.0 : 1.0; float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.02; a *= 0.5; } return s; }
// fxc_tone_curve: shadows / midtones / highlights pull, -1..1 each
float toneCurve(float v, float s, float m, float h) {
  float t = clamp(v, 0.0, 1.0);
  return v + s * 0.25 * (1.0 - sstep(0.0, 0.5, t)) * t * 2.0 + m * 0.25 * (4.0 * t * (1.0 - t)) + h * 0.25 * sstep(0.5, 1.0, t) * (1.0 - t) * 2.0 + 0.0;
}
`;

/** The grade: Lumetri basic correction, creative look, colour wheels, curves, vignette; then grain. One pass. */
export const GRADE = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexSize;     // source size, for cover-fit
uniform vec2 uFocus;       // cover-fit focus 0..1
uniform float uZoom;
uniform float uTemp, uTint, uExpo, uContrast, uHi, uSh, uWh, uBl, uSat, uVib, uFaded;
uniform int uLook;         // 0 none, 2 warm, 3 cool, 4 soft contrast, 5 split warm/cool, 6 film fade, 7 mono
uniform float uLookAmt;
uniform vec3 uShTint, uMidTint, uHiTint;   // colour wheels, -1..1 per channel
uniform vec3 uCurve;       // master curve: shadows, mids, highlights
uniform float uVig, uVigStart, uVigFeather;
uniform float uGrain, uGrainSize;
uniform vec3 uDuoA, uDuoB; uniform float uDuo;   // duotone: map luminance from A (shadows) to B (lights)
vec2 coverUv(vec2 uv) {
  float ra = uSize.x / uSize.y, rt = uTexSize.x / uTexSize.y;
  vec2 s = ra > rt ? vec2(1.0, rt / ra) : vec2(ra / rt, 1.0);
  s /= max(uZoom, 1e-3);
  vec2 off = (vec2(1.0) - s) * uFocus;
  return off + uv * s;
}
vec3 look(int k, vec3 c) {
  float l = luma(c);
  if (k == 2) return vec3(c.r * 1.06 + 0.015, c.g * 1.01 + 0.01, c.b * 0.88);
  if (k == 3) return vec3(c.r * 0.82, c.g * 0.92, c.b * 1.08 + 0.02) * 0.92;
  if (k == 4) { vec3 d = l + (c - l) * 0.45; vec3 o = l < 0.5 ? 2.0 * d * l : 1.0 - 2.0 * (1.0 - d) * (1.0 - l); return d * 0.5 + o * 0.5; }
  if (k == 5) { float t = clamp(l - 0.5, -0.5, 0.5); return vec3(c.r + 0.18 * t, c.g + 0.03 * t, c.b - 0.16 * t); }
  if (k == 6) { vec3 v = 0.08 + c * 0.84; return l + (v - l) * 0.8; }
  if (k == 7) return vec3(l);
  return c;
}
void main() {
  vec2 uv = coverUv(vUv);
  vec3 c = texture2D(uTex, uv).rgb;
  // basic correction (fxc_lumetri)
  c = vec3(c.r * (1.0 + 0.25 * uTemp), c.g * (1.0 - 0.25 * uTint), c.b * (1.0 - 0.25 * uTemp));
  c *= uExpo;
  c = 0.5 + (c - 0.5) * (1.0 + uContrast);
  float lt = clamp(luma(c), 0.0, 1.0), il = 1.0 - lt;
  c += 0.25 * uHi * sstep(0.5, 1.0, lt) + 0.25 * uSh * (1.0 - sstep(0.0, 0.5, lt)) + 0.2 * uWh * lt * lt + 0.2 * uBl * il * il;
  float l0 = luma(c); c = l0 + (c - l0) * uSat;
  // creative
  vec3 d = look(uLook, c);
  if (uFaded != 0.0) d = d * (1.0 - 0.25 * uFaded) + 0.12 * uFaded;
  float l = luma(d);
  if (uVib != 0.0) { float mx = max(max(d.r, d.g), d.b), mn = min(min(d.r, d.g), d.b); float s = mx > 1e-6 ? (mx - mn) / mx : 0.0; d = l + (d - l) * (1.0 + uVib * (1.0 - clamp(s, 0.0, 1.0))); }
  c = mix(c, d, uLookAmt);
  // curves and wheels
  c = vec3(toneCurve(c.r, uCurve.x, uCurve.y, uCurve.z), toneCurve(c.g, uCurve.x, uCurve.y, uCurve.z), toneCurve(c.b, uCurve.x, uCurve.y, uCurve.z));
  lt = clamp(luma(c), 0.0, 1.0);
  float ka = 1.0 - sstep(0.0, 0.5, lt), kz = sstep(0.5, 1.0, lt);
  c += 0.5 * (uShTint * ka + uMidTint * (1.0 - ka - kz) + uHiTint * kz);
  // duotone (design worlds): luminance mapped from shadow colour to light colour
  if (uDuo > 0.0) c = mix(c, mix(uDuoA, uDuoB, sstep(0.0, 1.0, clamp(luma(c), 0.0, 1.0))), uDuo);
  // vignette
  if (uVig != 0.0) {
    vec2 n = (vUv - 0.5) * 2.0; n.x *= uSize.x / uSize.y * 0.75;
    float r = length(n) / 1.4142135;
    float f = sstep(uVigStart, uVigStart + 0.05 + uVigFeather * (1.05 - uVigStart), r);
    c = uVig > 0.0 ? c * (1.0 - uVig * f) : mix(c, vec3(1.0), -uVig * f);
  }
  // Add Grain (gen_grain_apply): tone-weighted, strongest in the mid-tones, moving every frame
  if (uGrain > 0.0) {
    vec2 px = vUv * uSize / max(uGrainSize, 0.5);
    float fr = floor(uTime * 24.0);
    vec3 g = vec3(vnoise(vec3(px, fr)) - 0.5, vnoise(vec3(px + 17.0, fr)) - 0.5, vnoise(vec3(px + 41.0, fr)) - 0.5);
    g = mix(vec3((g.r + g.g + g.b) / 3.0), g, 0.25);
    float ll = clamp(luma(c), 0.0, 1.0);
    float w = 0.6 * (1.0 - sstep(0.0, 0.5, ll)) + 1.0 * (1.0 - abs(ll - 0.5) * 2.0) + 0.4 * sstep(0.5, 1.0, ll);
    c = max(c + g * uGrain * w * (1.0 - 0.5 * c), 0.0);
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/** Light rays from a point (CC Light Rays): 32 samples toward the centre, masked by a radius, added on top. */
export const RAYS = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uCenter; uniform float uLength, uGain, uRadius; uniform vec3 uColor; uniform float uColorFromSource;
void main() {
  vec2 rel = vUv - uCenter;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float s = 1.0 - uLength * float(i) / 32.0;
    vec2 q = rel * s;
    float m = 1.0 - sstep(uRadius, uRadius * 2.5 + 1e-3, length(q * vec2(uSize.x / uSize.y, 1.0)));
    acc += texture2D(uTex, uCenter + q) * m;
  }
  vec3 ray = acc.rgb / 32.0 * uGain;
  if (uColorFromSource < 0.5) ray = uColor * luma(ray);
  vec3 px = texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(px + ray - px * ray, 1.0);   // screen
}
`;

/** Glow: bright parts above a threshold, spread by a 3-ring kernel, screened back on. */
export const GLOW = /* glsl */ `
uniform sampler2D uTex; uniform float uThreshold, uRadius, uIntensity; uniform vec3 uTint;
vec3 bright(vec2 uv) { vec3 c = texture2D(uTex, uv).rgb; return c * sstep(uThreshold, uThreshold + 0.15, luma(c)); }
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  vec2 px = uRadius / uSize;
  // golden-angle spiral of 48 taps with a gaussian falloff: smooth, no ring copies
  vec3 g = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 128; i++) {
    float r = sqrt((float(i) + 0.5) / 128.0), ang = float(i) * 2.39996323;
    float w = exp(-r * r * 3.0);
    g += bright(vUv + vec2(cos(ang), sin(ang)) * r * px * 1.6) * w; wsum += w;
  }
  g = g / wsum * 1.6;
  g *= uTint * uIntensity;
  gl_FragColor = vec4(c + g - c * g, 1.0);
}
`;

/** Displacement: turbulent (fbm) or wave warp, with an RGB split, for glitches and heat haze. */
export const DISPLACE = /* glsl */ `
uniform sampler2D uTex; uniform float uAmount, uScale, uSpeed, uSplit, uWave, uBands;
void main() {
  vec2 uv = vUv;
  vec2 d = vec2(fbm(vec3(uv * uScale, uTime * uSpeed)) - 0.5, fbm(vec3(uv * uScale + 9.1, uTime * uSpeed)) - 0.5) * uAmount;
  d.x += sin(uv.y * uWave * 6.2831853 + uTime * uSpeed * 6.0) * uAmount * 0.5 * step(0.001, uWave);
  if (uBands > 0.0) { float b = floor(uv.y * uBands + floor(uTime * 12.0)); d.x += (hash(vec3(b, floor(uTime * 12.0), 3.0)) - 0.5) * uAmount * 3.0 * step(0.7, hash(vec3(b, 1.0, floor(uTime * 12.0)))); }
  vec2 s = vec2(uSplit / uSize.x, 0.0);
  float r = texture2D(uTex, uv + d + s).r, g = texture2D(uTex, uv + d).g, b = texture2D(uTex, uv + d - s).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
`;

/** Transitions from A to B at uProgress 0..1 (wipes from gen_*_wipe, block and glass dissolves from fx_transition). */
export const TRANSITION = /* glsl */ `
uniform sampler2D uA, uB; uniform float uProgress, uFeather, uAngle; uniform int uKind; uniform vec2 uCenter; uniform float uBlocks;
void main() {
  float p = uProgress, f = max(uFeather, 1e-4), m;
  vec2 uv = vUv;
  if (uKind == 0) {            // linear wipe at an angle
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    float t = dot(uv - 0.5, dir) / (abs(dir.x) * 0.5 + abs(dir.y) * 0.5) * 0.5 + 0.5;
    m = sstep(p * (1.0 + f) - f, p * (1.0 + f), t);
    m = 1.0 - m;
  } else if (uKind == 1) {     // radial (clock) wipe around a centre
    float a = atan(uv.y - uCenter.y, uv.x - uCenter.x) / 6.2831853 + 0.5;
    m = 1.0 - sstep(p * (1.0 + f) - f, p * (1.0 + f), a);
  } else if (uKind == 2) {     // iris: a circle opening from the centre
    vec2 asp = vec2(uSize.x / uSize.y, 1.0);
    float far = max(max(length((vec2(0.0) - uCenter) * asp), length((vec2(1.0, 0.0) - uCenter) * asp)), max(length((vec2(0.0, 1.0) - uCenter) * asp), length((vec2(1.0) - uCenter) * asp)));
    float r = length((uv - uCenter) * asp) / far;
    m = 1.0 - sstep(p * (1.0 + f) - f, p * (1.0 + f), r);
  } else if (uKind == 3) {     // gradient (luma) wipe: B appears through the brightness of A
    float t = luma(texture2D(uA, uv).rgb);
    m = sstep(1.0 - p * (1.0 + f), 1.0 - p * (1.0 + f) + f, t);
  } else if (uKind == 4) {     // block dissolve
    vec2 cell = floor(uv * vec2(uBlocks * uSize.x / uSize.y, uBlocks));
    m = step(hash(vec3(cell, 7.0)), p);
  } else {                     // glass / noise dissolve
    // a refraction front: B grows from noise islands, the border bends both pictures like thick glass
    float n = fbm(vec3(uv * 3.0, 1.3)) * 0.8 + uv.y * 0.2;
    float e = p * 1.3 - 0.15;
    m = sstep(n - 0.02, n + 0.02, e);
    float edge = 1.0 - abs(n - e) / 0.08;
    vec2 bend = (vec2(fbm(vec3(uv * 7.0, 2.0)), fbm(vec3(uv * 7.0, 5.0))) - 0.5) * 0.06 * clamp(edge, 0.0, 1.0);
    uv += bend;
  }
  gl_FragColor = vec4(mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, clamp(m, 0.0, 1.0)), 1.0);
}
`;

export const VERTEX = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
