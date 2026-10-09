import { describe, expect, it } from "vitest";
import { centeredOffset, clampOffset, coverScale, cropRect, zoomOffset } from "./avatarCrop";

const V = 200;

describe("avatar crop maths", () => {
  it("covers the viewport using the shorter side", () => {
    expect(coverScale(400, 800, V)).toBe(0.5);
    expect(coverScale(1000, 500, V)).toBe(0.4);
  });

  it("centres a wide picture and crops the middle square", () => {
    const scale = coverScale(400, 200, V); // 1
    const offset = centeredOffset(400, 200, scale, V);
    expect(offset).toEqual({ x: -100, y: 0 });
    expect(cropRect(offset, scale, V)).toMatchObject({ sx: 100, size: 200 });
  });

  it("never lets an edge of the picture move inside the viewport", () => {
    const clamped = clampOffset({ x: 50, y: -999 }, 400, 200, 1, V);
    expect(clamped).toEqual({ x: 0, y: 0 });
    expect(clampOffset({ x: -999, y: 0 }, 400, 200, 1, V)).toEqual({ x: -200, y: 0 });
  });

  it("keeps the same centre point when zooming", () => {
    const scale = 1;
    const offset = { x: -100, y: 0 };
    const zoomed = zoomOffset(offset, scale, 2, V);
    // The source point under the viewport centre is the same before and after.
    expect((V / 2 - offset.x) / scale).toBe((V / 2 - zoomed.x) / 2);
    expect((V / 2 - offset.y) / scale).toBe((V / 2 - zoomed.y) / 2);
  });
});
