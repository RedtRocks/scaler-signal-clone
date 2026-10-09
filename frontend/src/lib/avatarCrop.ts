// The maths behind the profile-photo cropper. Kept free of React and the DOM so it can be
// unit-tested. Coordinates: the picture is drawn at `scale` with its top-left corner at
// `offset` inside a square viewport of `viewport` pixels.

export interface Point {
  x: number;
  y: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** The scale at which the picture just covers the viewport (zoom 1). */
export function coverScale(width: number, height: number, viewport: number): number {
  return viewport / Math.min(width, height);
}

/** Keeps the picture covering the whole viewport, so no empty corner can be saved. */
export function clampOffset(offset: Point, width: number, height: number, scale: number, viewport: number): Point {
  const clamp = (value: number, size: number) => Math.min(0, Math.max(viewport - size * scale, value));
  return { x: clamp(offset.x, width), y: clamp(offset.y, height) };
}

/** The offset that puts the picture in the middle of the viewport. */
export function centeredOffset(width: number, height: number, scale: number, viewport: number): Point {
  return { x: (viewport - width * scale) / 2, y: (viewport - height * scale) / 2 };
}

/** New offset after zooming from `oldScale` to `newScale`, keeping the viewport centre fixed. */
export function zoomOffset(offset: Point, oldScale: number, newScale: number, viewport: number): Point {
  const centre = viewport / 2;
  const ratio = newScale / oldScale;
  return { x: centre - (centre - offset.x) * ratio, y: centre - (centre - offset.y) * ratio };
}

/** The square of the original picture that the viewport currently shows. */
export function cropRect(offset: Point, scale: number, viewport: number): CropRect {
  return { sx: -offset.x / scale, sy: -offset.y / scale, size: viewport / scale };
}
