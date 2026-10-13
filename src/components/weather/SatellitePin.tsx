"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * The pin both satellite views draw at the club's home field. Pass a percentage style
 * for images whose box is the container (the panels), or the measured pixel style from
 * usePinBox for overlays, where the image is letterboxed inside a larger box.
 */
export function SatellitePin({
  style,
  label = "Gorham",
}: {
  style: CSSProperties;
  label?: string;
}) {
  return (
    <div className="pointer-events-none absolute z-10 select-none" style={style}>
      <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-[0_1px_4px_rgba(2,6,23,0.7)]" />
      <span className="absolute left-2.5 top-0 -translate-y-1/2 whitespace-nowrap rounded-[5px] bg-slate-950/75 px-1.5 py-px font-display text-[10px] font-semibold tracking-wide text-white">
        {label}
      </span>
    </div>
  );
}

/**
 * Where an object-contain image actually sits inside its box, in CSS pixels. The image
 * is measured against its rendered width/height; the full-size overlay (natural pixels,
 * no scaling) comes out as scale 1 with zero offsets, so one formula covers both modes.
 * `active` re-runs the measurement when a conditionally rendered overlay opens.
 */
export function usePinBox(ref: RefObject<HTMLImageElement | null>, active: boolean) {
  const [box, setBox] = useState<{ offsetX: number; offsetY: number; scale: number } | null>(
    null,
  );

  useEffect(() => {
    if (!active) return;
    const image = ref.current;
    if (!image) return;
    const measure = () => {
      if (!image.naturalWidth || !image.clientWidth) return;
      const scale = Math.min(
        image.clientWidth / image.naturalWidth,
        image.clientHeight / image.naturalHeight,
      );
      setBox({
        offsetX: (image.clientWidth - image.naturalWidth * scale) / 2,
        offsetY: (image.clientHeight - image.naturalHeight * scale) / 2,
        scale,
      });
    };
    measure();
    image.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    return () => {
      image.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [ref, active]);

  return box;
}
