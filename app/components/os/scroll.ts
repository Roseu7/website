export function stepOsWheel(content: HTMLElement) {
  let frame = 0;
  let last = performance.now();
  let x = content.scrollLeft;
  let y = content.scrollTop;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cancel = () => { cancelAnimationFrame(frame); frame = 0; };
  const tick = (time: number) => {
    if (time - last < 1000 / 30) { frame = requestAnimationFrame(tick); return; }
    last = time - ((time - last) % (1000 / 30));
    content.scrollTo({ left: x, top: y, behavior: "instant" });
    frame = 0;
  };
  const wheel = (event: WheelEvent) => {
    // Keep zoom, editable fields and independently scrolling children under native control.
    if (!event.cancelable || event.ctrlKey || event.metaKey || reduced.matches) return;
    let target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable='true']")) return;
    while (target && target !== content) {
      const style = getComputedStyle(target);
      if ((/auto|scroll/.test(style.overflowY) && target.scrollHeight > target.clientHeight) || (/auto|scroll/.test(style.overflowX) && target.scrollWidth > target.clientWidth)) return;
      target = target.parentElement!;
    }
    if (content.scrollHeight <= content.clientHeight && content.scrollWidth <= content.clientWidth) return;
    const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(content).lineHeight) || 28 : event.deltaMode === 2 ? content.clientHeight : 1;
    if (!frame) { x = content.scrollLeft; y = content.scrollTop; }
    x = Math.max(0, Math.min(content.scrollWidth - content.clientWidth, x + (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * unit));
    y = Math.max(0, Math.min(content.scrollHeight - content.clientHeight, y + (event.shiftKey ? 0 : event.deltaY) * unit));
    event.preventDefault();
    if (!frame) frame = requestAnimationFrame(tick);
  };
  content.addEventListener("wheel", wheel, { passive: false });
  content.addEventListener("pointerdown", cancel);
  content.addEventListener("keydown", cancel);
  content.addEventListener("focusout", cancel);
  return () => {
    cancel();
    content.removeEventListener("wheel", wheel);
    content.removeEventListener("pointerdown", cancel);
    content.removeEventListener("keydown", cancel);
    content.removeEventListener("focusout", cancel);
  };
}
