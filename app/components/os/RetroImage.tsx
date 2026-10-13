import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useOsPage } from "./OsContext";

export function RetroImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const enabled = useOsPage();
  const imageRef = useRef<HTMLImageElement>(null);
  const [reveal, setReveal] = useState<"waiting" | "revealing">();

  useEffect(() => {
    const image = imageRef.current;
    if (!enabled || !image || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setReveal("waiting");
    let visible = false;
    let started = false;
    const start = () => {
      if (!started && visible && image.complete && image.naturalWidth > 0) {
        started = true;
        setReveal("revealing");
      }
    };
    // Lazy images may load well below the viewport; reveal only when first seen.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        visible = true;
        observer.disconnect();
        start();
      }
    });
    observer.observe(image);
    image.addEventListener("load", start);
    return () => { observer.disconnect(); image.removeEventListener("load", start); };
  }, [enabled, props.src]);

  return <img {...props} ref={imageRef} className={`${props.className ?? ""} os-retro-image`} data-retro-reveal={reveal} onAnimationEnd={event => {
    if (event.animationName === "osImageReveal") setReveal(undefined);
    props.onAnimationEnd?.(event);
  }} />;
}
