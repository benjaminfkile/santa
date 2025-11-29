import { useRef, useState, useEffect } from "react";

export default function RouteZoomer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;

  // Automatically fit the whole image into the viewport on load
  useEffect(() => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      if (!containerRef.current) return;

      const cont = containerRef.current;
      const contW = cont.clientWidth;
      const contH = cont.clientHeight;

      const imgW = img.width;
      const imgH = img.height;

      // Fit scale in both directions; choose the max zoom-out that fits
      const scaleX = contW / imgW;
      const scaleY = contH / imgH;
      const fitScale = Math.min(scaleX, scaleY);

      // Center the image at that scale
      setScale(fitScale);
      setOffset({
        x: (contW - imgW * fitScale) / 2,
        y: (contH - imgH * fitScale) / 2,
      });
    };
  }, [src]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartOffset(offset);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart) return;

    setOffset({
      x: startOffset.x + (e.clientX - dragStart.x),
      y: startOffset.y + (e.clientY - dragStart.y)
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDragStart(null);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();

    const cont = containerRef.current!;
    const rect = cont.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let newScale = scale - e.deltaY * 0.001;
    newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newScale));

    // Zoom around mouse cursor
    setOffset({
      x: cx - (cx - offset.x) * (newScale / scale),
      y: cy - (cy - offset.y) * (newScale / scale)
    });

    setScale(newScale);
  }

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: "none",
        background: "#242526"
      }}
    >
      <img
        src={src}
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          userSelect: "none",
          willChange: "transform"
        }}
      />
    </div>
  );
}
