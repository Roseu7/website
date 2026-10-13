export type OsRect = Pick<DOMRect, "x" | "y" | "width" | "height">;
export type OsOpening = { origin: OsRect; serial: number };

const motions = new WeakMap<HTMLElement, () => void>();

export function stopOsMotion(element: HTMLElement) {
  motions.get(element)?.();
}

export function animateOsWindow(element: HTMLElement, origin: OsRect, minimize = false, complete?: () => void) {
  stopOsMotion(element);
  element.style.visibility = "";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !origin.width || !origin.height) {
    complete?.();
    return;
  }
  const target = element.getBoundingClientRect();
  if (!target.width || !target.height) { complete?.(); return; }
  const base = getComputedStyle(element).transform;
  const dx = origin.x - target.x, dy = origin.y - target.y;
  const sx = origin.width / target.width, sy = origin.height / target.height;
  const started = performance.now();
  let frame: number;
  let lastStep = 0;
  const clean = () => {
    cancelAnimationFrame(frame);
    element.style.transform = "";
    element.style.opacity = "";
    element.classList.remove("is-animating");
    delete element.dataset.osMotion;
    motions.delete(element);
  };
  motions.set(element, clean);
  element.classList.add("is-animating");
  element.dataset.osMotion = minimize ? "minimize" : "open";
  const draw = (progress: number) => {
    const amount = minimize ? progress * progress : (1 - progress) ** 3;
    element.style.transform = `${base === "none" ? "" : base} translate(${dx * amount}px, ${dy * amount}px) scale(${1 + (sx - 1) * amount}, ${1 + (sy - 1) * amount})`;
    element.style.opacity = String(1 - .35 * amount);
  };
  draw(0);
  const tick = (timestamp: number) => {
    const elapsed = timestamp - started;
    // Quantize time, not display frames: 60/120/144Hz screens share the same roughly 30fps cadence.
    const step = Math.floor(elapsed / (1000 / 30));
    if (step !== lastStep) { draw(Math.min(step / 6, 1)); lastStep = step; }
    if (elapsed >= 200) {
      clean();
      if (minimize) element.style.visibility = "hidden";
      complete?.();
    } else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
