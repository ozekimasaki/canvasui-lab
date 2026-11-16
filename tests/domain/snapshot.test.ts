import { describe, expect, it } from "vite-plus/test";
import { hasPngMagic, readPngDimensions, r2KeyFor, sha256Hex } from "../../src/domain/snapshot";

function fakePng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("PNG validation", () => {
  it("accepts a well-formed header", () => {
    expect(hasPngMagic(fakePng(100, 50))).toBe(true);
    expect(readPngDimensions(fakePng(100, 50))).toEqual({ width: 100, height: 50 });
  });
  it("rejects truncated or non-PNG bytes", () => {
    expect(hasPngMagic(new Uint8Array(4))).toBe(false);
    expect(readPngDimensions(new Uint8Array(33))).toBeNull();
    expect(readPngDimensions(fakePng(0, 10))).toBeNull();
  });
});

describe("r2 keys", () => {
  it("separates baselines, runs and design sources", () => {
    expect(r2KeyFor("baseline", "implementation", "button", "button:abc", "h1")).toBe(
      "baselines/button/button:abc/h1.png",
    );
    expect(r2KeyFor("run", "implementation", "button", "button:abc", "h1")).toBe(
      "runs/button/button:abc/h1.png",
    );
    expect(r2KeyFor("design", "figma", "button", "figma:1_2", "h1")).toBe(
      "design/figma/button/figma:1_2/h1.png",
    );
  });
  it("sanitizes unsafe cell key characters", () => {
    expect(r2KeyFor("baseline", "implementation", "c", "a/../b", "h")).toBe(
      "baselines/c/a____b/h.png",
    );
  });
});

describe("sha256Hex", () => {
  it("hashes deterministically", async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    const b = await sha256Hex(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(await sha256Hex(new Uint8Array([1, 2, 4]))).not.toBe(a);
  });
});
