import { useEffect, useRef, useState } from "react";
import logoSvgSource from "~/assets/logo-handwriting.svg?raw";

const viewBoxMatch = logoSvgSource.match(/viewBox="([^"]+)"/);
const groupTransformMatch = logoSvgSource.match(/<g[^>]*transform="([^"]+)"/);
const pathDataMatch = logoSvgSource.match(/<path[^>]*\sd="([^"]+)"/s);

const VIEW_BOX = viewBoxMatch?.[1] ?? "0 0 277.49675 68.30867";
const GROUP_TRANSFORM = groupTransformMatch?.[1];
const LOGO_PATH_DATA = pathDataMatch?.[1] ?? "";
const NEON_SEGMENTS = LOGO_PATH_DATA.match(/M[^M]*/g)?.map((segment) => segment.trim()).filter(Boolean) ?? [];

function getResponsiveWriteDurationMs(viewportWidth: number, viewportHeight: number) {
  const minViewport = 320;
  const maxViewport = 1600;
  const minDurationMs = 3000;
  const maxDurationMs = 4300;

  const progress = Math.min(
    1,
    Math.max(0, (viewportWidth - minViewport) / (maxViewport - minViewport))
  );

  let durationMs = minDurationMs + (maxDurationMs - minDurationMs) * progress;

  const aspectRatio = viewportHeight / Math.max(viewportWidth, 1);
  const isPortraitMobile = viewportWidth <= 768 && aspectRatio >= 1.45;
  if (isPortraitMobile) {
    // 縦長スマホでは見かけ上の描画が速く感じるため、さらに遅くする。
    durationMs = Math.max(7200, durationMs * 2.6);
  }

  return Math.round(Math.min(9000, Math.max(minDurationMs, durationMs)));
}

export function HandwritingTitle() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [isStrokeReady, setIsStrokeReady] = useState(false);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!svg || !path) return;
    path.style.setProperty("--path-length", `${path.getTotalLength()}`);

    const root = document.documentElement;
    const neonPaths: SVGPathElement[] = Array.from(
      svg.querySelectorAll<SVGPathElement>(".logo-neon-stroke")
    );
    const applyResponsiveDuration = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const durationMs = getResponsiveWriteDurationMs(viewportWidth, viewportHeight);
      const isPortraitMobile = viewportWidth <= 768 && viewportHeight / Math.max(viewportWidth, 1) >= 1.45;
      const neonStartDelayMs = isPortraitMobile
        ? Math.max(1800, Math.min(3600, durationMs - 1800))
        : durationMs;

      root.style.setProperty("--logo-write-duration", `${durationMs}ms`);
      root.style.setProperty("--logo-neon-start-delay", `${neonStartDelayMs}ms`);
    };

    applyResponsiveDuration();
    window.addEventListener("resize", applyResponsiveDuration);

    if (neonPaths.length > 0) {
      const metrics: Array<{ stroke: SVGPathElement; index: number; x: number }> = neonPaths
        .map((stroke, index) => ({ stroke, index, x: stroke.getBBox().x }))
        .sort((a, b) => (a.x === b.x ? a.index - b.index : a.x - b.x));

      const letterGapThreshold = 4;
      let letterIndex = 0;
      let previousX = metrics[0].x;

      for (const metric of metrics) {
        if (metric.x - previousX > letterGapThreshold) {
          letterIndex += 1;
        }
        previousX = metric.x;

        const randA = Math.sin((metric.index + 1) * 12.9898) * 43758.5453;
        const randB = Math.sin((metric.index + 33) * 78.233) * 43758.5453;
        const jitterA = randA - Math.floor(randA);
        const jitterB = randB - Math.floor(randB);
        const flickerDelayMs = letterIndex * 110 + Math.round(jitterA * 180);
        const flickerDurationMs = 760 + Math.round(jitterB * 420);

        metric.stroke.style.setProperty("--neon-delay", `${flickerDelayMs}ms`);
        metric.stroke.style.setProperty("--neon-duration", `${flickerDurationMs}ms`);
      }
    }

    const frame = requestAnimationFrame(() => {
      setIsStrokeReady(true);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", applyResponsiveDuration);
    };
  }, []);

  return (
    <h2 id="main-title-text" className="theme-transition logo-title-text" aria-label="Digital Sandbox">
      <svg
        ref={svgRef}
        className={`logo-stroke-svg${isStrokeReady ? " logo-strokes-ready" : ""}`}
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-hidden="true"
      >
        {GROUP_TRANSFORM ? (
          <g transform={GROUP_TRANSFORM}>
            <path ref={pathRef} d={LOGO_PATH_DATA} className="logo-stroke-path" />
            <g className="logo-neon-layer" aria-hidden="true">
              {NEON_SEGMENTS.map((segment, index) => (
                <path key={`logo-neon-${index}`} d={segment} className="logo-neon-stroke" />
              ))}
            </g>
          </g>
        ) : (
          <>
            <path ref={pathRef} d={LOGO_PATH_DATA} className="logo-stroke-path" />
            <g className="logo-neon-layer" aria-hidden="true">
              {NEON_SEGMENTS.map((segment, index) => (
                <path key={`logo-neon-${index}`} d={segment} className="logo-neon-stroke" />
              ))}
            </g>
          </>
        )}
      </svg>
    </h2>
  );
}
