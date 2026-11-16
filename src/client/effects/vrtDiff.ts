import { defineEffect } from "gpucanvas";

export const vrtDiffEffect = defineEffect({
  name: "vrt-diff",
  animated: true,
  params: [0, 0, 1, 1],
  pad: 24,
  css: () => "drop-shadow(0 0 10px rgba(239,68,68,0.85))",
  wgsl: `
fn effect(input: EffectInput) -> vec4f {
  let base = source(input.uv);
  let px = input.uv * input.size;
  let edge = min(min(px.x, input.size.x - px.x), min(px.y, input.size.y - px.y));
  let pulse = 0.75 + 0.25 * sin(input.time * 4.0);
  let frame = exp(-max(edge, 0.0) / 6.0) * pulse;
  let b = input.params;
  let inside = step(b.x, input.uv.x) * step(input.uv.x, b.x + b.z)
             * step(b.y, input.uv.y) * step(input.uv.y, b.y + b.w);
  let alpha = clamp(frame * 0.9 + inside * 0.22, 0.0, 1.0);
  let red = vec3f(1.0, 0.15, 0.15);
  return vec4f(red * alpha + base.rgb * (1.0 - alpha), alpha + base.a * (1.0 - alpha));
}
`,
});
