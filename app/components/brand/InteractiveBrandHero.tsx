import * as React from "react";
import { SiteBrand } from "~/components/brand/SiteBrand";

interface DotPoint {
  x: number;
  y: number;
}

export function InteractiveBrandHero() {
  const frameRef = React.useRef<HTMLElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const dotsRef = React.useRef<DotPoint[]>([]);

  React.useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let isReady = false;

    const updateCanvasMetrics = () => {
      const rect = frame.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rebuildDots = () => {
      updateCanvasMetrics();
      const spacing = Math.max(26, Math.min(40, Math.round(width / 36)));
      const insetX = Math.max(20, spacing);
      const insetY = Math.max(24, spacing);
      const usableWidth = Math.max(width - insetX * 2, spacing);
      const usableHeight = Math.max(height - insetY * 2, spacing);
      const columns = Math.max(8, Math.floor(usableWidth / spacing) + 1);
      const rows = Math.max(6, Math.floor(usableHeight / spacing) + 1);
      const gapX = columns > 1 ? usableWidth / (columns - 1) : usableWidth;
      const gapY = rows > 1 ? usableHeight / (rows - 1) : usableHeight;
      const nextDots: DotPoint[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          nextDots.push({
            x: insetX + gapX * column,
            y: insetY + gapY * row,
          });
        }
      }

      dotsRef.current = nextDots;
      if (!isReady) {
        currentX = width / 2;
        currentY = height / 2;
        targetX = currentX;
        targetY = currentY;
        isReady = true;
      }
      drawFrame(true);
    };

    const drawFrame = (staticFrame = false) => {
      if (!width || !height) return;

      if (!staticFrame) {
        currentX += (targetX - currentX) * 0.14;
        currentY += (targetY - currentY) * 0.14;
      }

      const relativeX = (currentX / Math.max(width, 1)) * 100;
      const relativeY = (currentY / Math.max(height, 1)) * 100;
      const dx = relativeX - 50;
      const dy = relativeY - 50;
      const repelRadius = Math.min(128, Math.max(82, width * 0.11));
      const maxShift = Math.min(18, Math.max(10, width * 0.013));
      const baseColor = getComputedStyle(frame)
        .getPropertyValue("--ink-1")
        .trim();

      frame.style.setProperty("--pointer-x", `${relativeX}`);
      frame.style.setProperty("--pointer-y", `${relativeY}`);
      frame.style.setProperty("--brand-shift-x", `${dx * 0.05}px`);
      frame.style.setProperty("--brand-shift-y", `${dy * 0.04}px`);
      frame.style.setProperty("--brand-tilt-x", `${dy * -0.03}deg`);
      frame.style.setProperty("--brand-tilt-y", `${dx * 0.04}deg`);

      context.clearRect(0, 0, width, height);
      context.fillStyle = baseColor || "#172b4d";

      for (const dot of dotsRef.current) {
        const offsetX = dot.x - currentX;
        const offsetY = dot.y - currentY;
        const distance = Math.hypot(offsetX, offsetY);
        const influence =
          !prefersReducedMotion && distance < repelRadius
            ? Math.pow(1 - distance / repelRadius, 1.7)
            : 0;
        const directionX = distance > 0.001 ? offsetX / distance : 0;
        const directionY = distance > 0.001 ? offsetY / distance : 0;
        const drawX = dot.x + directionX * influence * maxShift;
        const drawY = dot.y + directionY * influence * maxShift;
        const radius = 1.7 + influence * 0.8;

        context.globalAlpha = 0.16 + influence * 0.42;
        context.beginPath();
        context.arc(drawX, drawY, radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;

      if (
        !staticFrame &&
        (Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08)
      ) {
        rafId = window.requestAnimationFrame(() => drawFrame());
        return;
      }

      currentX = targetX;
      currentY = targetY;
      rafId = 0;
    };

    const queue = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => drawFrame());
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = frame.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
      queue();
    };

    rebuildDots();

    const resizeObserver = new ResizeObserver(() => {
      rebuildDots();
    });
    resizeObserver.observe(frame);

    const themeObserver = new MutationObserver(() => {
      drawFrame(true);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
    }

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <section className="brand-stage" ref={frameRef}>
      <div className="brand-stage__ambient" aria-hidden="true" />
      <canvas ref={canvasRef} className="brand-stage__canvas" aria-hidden="true" />

      <div className="brand-stage__mark">
        <div className="brand-stage__wordmark brand-stage__wordmark--base">
          <SiteBrand interactive mode="wordmark" />
        </div>
      </div>
    </section>
  );
}
