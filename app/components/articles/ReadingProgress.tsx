import { useEffect, useRef, useState } from "react";
import { scrollerOf } from "./scroller";

// 記事のどのあたりを読んでいるかを、スクロール領域の下端に細いバーで出す。
// 本文の先頭が上端に来たら0、本文の終わりが下端に来たら100%。読み上げでは位置が分かるので、支援技術には見せない。
export function ReadingProgress({ targetSelector }: { targetSelector: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const element = bar.current;
    const target = element?.parentElement?.querySelector(targetSelector);
    if (!element || !target) return;
    const scroller = scrollerOf(element);
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewTop = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
      const viewHeight = scroller instanceof Window ? window.innerHeight : scroller.clientHeight;
      const rect = target.getBoundingClientRect();
      const range = rect.height - viewHeight;
      setScrollable(range > 0);
      const progress = range > 0 ? Math.min(Math.max((viewTop - rect.top) / range, 0), 1) : 1;
      element.style.setProperty("--progress", String(progress));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    // 画像の読み込みやウィンドウの大きさで本文の高さが変わるので、そのたびに測り直す。
    const observer = new ResizeObserver(schedule);
    observer.observe(target);
    observer.observe(scroller instanceof Window ? document.documentElement : scroller);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [targetSelector]);
  return <div ref={bar} className="article-progress" data-scrollable={scrollable || undefined} aria-hidden />;
}
