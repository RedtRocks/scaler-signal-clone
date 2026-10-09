"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredOffset,
  clampOffset,
  coverScale,
  cropRect,
  zoomOffset,
  type Point,
} from "@/lib/avatarCrop";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import styles from "./AvatarCropper.module.css";

const VIEWPORT = 256; // On-screen size of the square crop area, in CSS pixels.
const OUTPUT = 512; // Pixel size of the saved picture.
const KEY_STEP = 12;

export interface AvatarCropperProps {
  /** The picture the person chose. */
  file: File;
  onCancel: () => void;
  /** Called with the cropped, square JPEG. */
  onDone: (cropped: File) => void;
}

/**
 * "Move and zoom" dialog for a profile photo: drag the picture, use the slider (or the
 * arrow keys) and Save. The round mask previews how it will look as an avatar.
 */
export function AvatarCropper({ file, onCancel, onDone }: AvatarCropperProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ pointer: Point; start: Point } | null>(null);

  // Decode the chosen file; the first fit centres the picture at zoom 1.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setUrl(objectUrl);
      setImage(img);
      const scale = coverScale(img.naturalWidth, img.naturalHeight, VIEWPORT);
      setOffset(centeredOffset(img.naturalWidth, img.naturalHeight, scale, VIEWPORT));
    };
    img.onerror = () => setFailed(true);
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const width = image?.naturalWidth ?? 1;
  const height = image?.naturalHeight ?? 1;
  const scale = coverScale(width, height, VIEWPORT) * zoom;

  const moveTo = (next: Point) => setOffset(clampOffset(next, width, height, scale, VIEWPORT));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: { x: event.clientX, y: event.clientY }, start: offset };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) moveTo({ x: d.start.x + event.clientX - d.pointer.x, y: d.start.y + event.clientY - d.pointer.y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, Point> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    moveTo({ x: offset.x + delta.x, y: offset.y + delta.y });
  };

  const onZoom = (value: number) => {
    const newScale = coverScale(width, height, VIEWPORT) * value;
    setZoom(value);
    setOffset(clampOffset(zoomOffset(offset, scale, newScale, VIEWPORT), width, height, newScale, VIEWPORT));
  };

  const save = () => {
    if (!image) return;
    const { sx, sy, size } = cropRect(offset, scale, VIEWPORT);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(
      (blob) => {
        if (blob) onDone(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Modal
      title="Move and zoom"
      onClose={onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!image}>
            Save
          </Button>
        </>
      }
    >
      {failed ? (
        <p className={styles.hint}>This image couldn&apos;t be opened. Choose another one.</p>
      ) : (
        <>
          <div
            className={styles.stage}
            style={{ "--crop-size": `${VIEWPORT}px` } as React.CSSProperties}
            role="application"
            aria-label="Photo crop area. Drag, or use the arrow keys, to move the picture."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.image}
                src={url}
                alt=""
                draggable={false}
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
              />
            ) : null}
            <div className={styles.mask} />
          </div>
          <div className={styles.zoom} style={{ "--crop-size": `${VIEWPORT}px` } as React.CSSProperties}>
            <span aria-hidden>−</span>
            <input
              className={styles.slider}
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-label="Zoom"
              onChange={(event) => onZoom(Number(event.target.value))}
            />
            <span aria-hidden>+</span>
          </div>
          <p className={styles.hint}>Drag the picture to choose what shows.</p>
        </>
      )}
    </Modal>
  );
}
