function updateThemeIcons(
  isDark: boolean,
  button: HTMLElement | null,
  sunIcon: Element | null,
  moonIcon: Element | null
) {
  button?.setAttribute("aria-pressed", String(isDark));

  if (isDark) {
    sunIcon?.classList.remove("hidden");
    moonIcon?.classList.add("hidden");
  } else {
    sunIcon?.classList.add("hidden");
    moonIcon?.classList.remove("hidden");
  }
}

function applyTheme(htmlEl: HTMLElement, nextTheme: "light" | "dark") {
  htmlEl.classList.toggle("dark", nextTheme === "dark");
  try {
    localStorage.setItem("theme", nextTheme);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
}

function finishThemeTransition(
  htmlEl: HTMLElement,
  body: HTMLElement,
  overlay: HTMLElement | null
) {
  htmlEl.classList.remove("theme-transition-running");
  htmlEl.classList.remove("theme-transition-simple");
  if (overlay) {
    overlay.hidden = true;
  }
  overlay?.classList.remove("is-prepared");
  overlay?.classList.remove("is-active");
  overlay?.classList.remove("is-fading");
  overlay?.removeAttribute("data-theme");
  overlay?.removeAttribute("data-mode");
  overlay?.replaceChildren();
  htmlEl.style.removeProperty("--theme-simple-duration");
  body.classList.remove("theme-transition-active");
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toViewportPercent(value: number, size: number) {
  if (!Number.isFinite(value) || size <= 0) {
    return "50%";
  }

  const ratio = Math.min(100, Math.max(0, (value / size) * 100));
  return `${ratio}%`;
}

function getThemeTransitionBounds() {
  const pageFrame = document.querySelector(".page-frame");
  if (pageFrame instanceof HTMLElement) {
    const rect = pageFrame.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return rect;
    }
  }

  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

function getThemeTransitionMetrics(
  originX: number,
  originY: number,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">
) {
  const minX = bounds.left;
  const minY = bounds.top;
  const maxX = bounds.left + Math.max(bounds.width, 1);
  const maxY = bounds.top + Math.max(bounds.height, 1);
  const radius = Math.max(
    Math.hypot(originX - minX, originY - minY),
    Math.hypot(maxX - originX, originY - minY),
    Math.hypot(originX - minX, maxY - originY),
    Math.hypot(maxX - originX, maxY - originY)
  );

  return {
    radius,
    duration: Math.min(1600, Math.max(820, radius / 1.12)),
  };
}

function buildThemeSnapshot(
  overlay: HTMLElement,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
  options?: { includeMobileMenu?: boolean }
) {
  const pageFrame = document.querySelector(".page-frame");
  if (!(pageFrame instanceof HTMLElement)) {
    return null;
  }

  const viewport = document.createElement("div");
  viewport.className = "theme-transition-layer__snapshot-viewport";
  viewport.style.left = `${Math.max(0, bounds.left)}px`;
  viewport.style.top = `${Math.max(0, bounds.top)}px`;
  viewport.style.width = `${Math.max(1, bounds.width)}px`;
  viewport.style.height = `${Math.max(1, bounds.height)}px`;

  const scene = document.createElement("div");
  scene.className = "theme-transition-layer__snapshot-scene";
  scene.style.transform = `translate(${-Math.max(0, bounds.left)}px, ${-window.scrollY}px)`;

  const snapshot = pageFrame.cloneNode(true);
  if (!(snapshot instanceof HTMLElement)) {
    return null;
  }

  snapshot.classList.add("theme-transition-layer__snapshot-frame");
  const rootStyles = getComputedStyle(document.documentElement);
  for (let index = 0; index < rootStyles.length; index += 1) {
    const property = rootStyles.item(index);
    if (!property.startsWith("--")) continue;
    snapshot.style.setProperty(property, rootStyles.getPropertyValue(property));
  }

  snapshot.style.colorScheme = rootStyles.colorScheme;
  if (!options?.includeMobileMenu) {
    snapshot.querySelectorAll(".site-mobile-menu").forEach((node) => node.remove());
  }
  snapshot.querySelectorAll(".brand-stage__canvas, .theme-transition-layer, .app-loader").forEach((node) => node.remove());
  snapshot.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));

  scene.appendChild(snapshot);
  viewport.appendChild(scene);
  overlay.replaceChildren(viewport);
  overlay.setAttribute("data-mode", "snapshot");

  return viewport;
}

function playThemeTransition(
  htmlEl: HTMLElement,
  nextTheme: "light" | "dark",
  metrics: { radius: number; duration: number; bounds: DOMRect }
) {
  const body = document.body;
  const overlay = document.getElementById("theme-transition-layer");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileViewport = window.matchMedia("(max-width: 640px)").matches;
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>;
      finished: Promise<void>;
    };
  };
  const useViewTransition =
    typeof doc.startViewTransition === "function" &&
    !isMobileViewport;
  const useSimpleMobileTransition = isMobileViewport;
  const effectiveDuration = metrics.duration;
  const mobileSimpleDuration = 920;

  if (prefersReducedMotion) {
    applyTheme(htmlEl, nextTheme);
    return Promise.resolve();
  }

  if (useViewTransition) {
    body.classList.add("theme-transition-active");
    htmlEl.classList.add("theme-transition-running");

    const transition = doc.startViewTransition!(() => {
      applyTheme(htmlEl, nextTheme);
    });
    // Navigation can skip the animation while the theme update still succeeds.
    void transition.ready.catch(() => undefined);

    return transition.finished.catch(() => undefined).finally(() => {
      finishThemeTransition(htmlEl, body, overlay);
    });
  }

  if (useSimpleMobileTransition) {
    body.classList.add("theme-transition-active");
    htmlEl.classList.add("theme-transition-running");
    htmlEl.style.setProperty("--theme-simple-duration", `${mobileSimpleDuration}ms`);

    if (!overlay) {
      htmlEl.classList.add("theme-transition-simple");
      applyTheme(htmlEl, nextTheme);
      return wait(mobileSimpleDuration).finally(() => {
        finishThemeTransition(htmlEl, body, overlay);
      });
    }

    overlay.hidden = false;
    const snapshotViewport = buildThemeSnapshot(overlay, metrics.bounds, {
      includeMobileMenu: true,
    });
    overlay.setAttribute("data-theme", nextTheme);
    overlay.setAttribute("data-mode", "snapshot-fade");
    overlay.classList.add("is-prepared");
    void overlay.getBoundingClientRect();

    return new Promise<void>((resolve) => {
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        overlay.removeEventListener("transitionend", handleOverlayEnd);
        window.clearTimeout(timeoutId);
        requestAnimationFrame(() => {
          finishThemeTransition(htmlEl, body, overlay);
          resolve();
        });
      };

      const handleOverlayEnd = (event: TransitionEvent) => {
        if (event.target === overlay && event.propertyName === "opacity") {
          settle();
        }
      };

      const timeoutId = window.setTimeout(settle, mobileSimpleDuration + 180);
      overlay.addEventListener("transitionend", handleOverlayEnd);

      requestAnimationFrame(() => {
        applyTheme(htmlEl, nextTheme);
        if (!snapshotViewport) {
          htmlEl.classList.add("theme-transition-simple");
        }
        overlay.classList.remove("is-prepared");
        overlay.classList.add("is-fading");
      });
    });
  }

  body.classList.add("theme-transition-active");
  htmlEl.classList.add("theme-transition-running");
  htmlEl.style.setProperty("--theme-target-radius", `${Math.ceil(metrics.radius)}px`);
  htmlEl.style.setProperty("--theme-duration", `${Math.round(effectiveDuration)}ms`);
  if (overlay) {
    overlay.hidden = false;
  }
  overlay?.setAttribute("data-theme", nextTheme);
  const snapshotViewport = overlay ? buildThemeSnapshot(overlay, metrics.bounds) : null;
  overlay?.classList.add("is-prepared");
  void overlay?.getBoundingClientRect();

  return new Promise<void>((resolve) => {
    if (!overlay) {
      applyTheme(htmlEl, nextTheme);
      finishThemeTransition(htmlEl, body, overlay);
      resolve();
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      snapshotViewport?.removeEventListener("transitionend", handleSnapshotEnd);
      overlay.removeEventListener("transitionend", handleOverlayEnd);
      requestAnimationFrame(() => {
        finishThemeTransition(htmlEl, body, overlay);
        resolve();
      });
    };

    const handleSnapshotEnd = (event: TransitionEvent) => {
      if (
        event.target === snapshotViewport &&
        event.propertyName === "--theme-reveal-radius"
      ) {
        settle();
      }
    };

    const handleOverlayEnd = (event: TransitionEvent) => {
      if (event.target !== overlay) {
        return;
      }
      if (event.propertyName === "opacity") {
        settle();
      }
    };

    if (snapshotViewport) {
      snapshotViewport.addEventListener("transitionend", handleSnapshotEnd);
      window.setTimeout(settle, effectiveDuration + 180);
    } else {
      overlay.addEventListener("transitionend", handleOverlayEnd);
      window.setTimeout(settle, effectiveDuration + 180);
    }

    requestAnimationFrame(() => {
      applyTheme(htmlEl, nextTheme);
      overlay.classList.add("is-active");
      overlay.classList.remove("is-prepared");
      if (!snapshotViewport) {
        overlay.classList.add("is-fading");
      }
    });
  });
}

export function attachThemeToggle(options: {
  button: HTMLElement | null;
  sunIcon: Element | null;
  moonIcon: Element | null;
}) {
  const { button, sunIcon, moonIcon } = options;
  const htmlEl = document.documentElement;
  let isTransitioning = false;

  const handleThemeToggle = (event?: MouseEvent) => {
    if (isTransitioning || htmlEl.classList.contains("theme-transition-running")) {
      return;
    }

    isTransitioning = true;
    button?.setAttribute("aria-disabled", "true");
    button?.setAttribute("aria-busy", "true");
    button?.setAttribute("data-unavailable", "true");
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    const rect = button?.getBoundingClientRect();
    const pointerX =
      event && Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : null;
    const pointerY =
      event && Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : null;

    if (rect) {
      const originX = pointerX ?? rect.left + rect.width / 2;
      const originY = pointerY ?? rect.top + rect.height / 2;
      const bounds = getThemeTransitionBounds();
      const metrics = {
        ...getThemeTransitionMetrics(originX, originY, bounds),
        bounds,
      };

      htmlEl.style.setProperty(
        "--theme-origin-x",
        toViewportPercent(originX, window.innerWidth)
      );
      htmlEl.style.setProperty(
        "--theme-origin-y",
        toViewportPercent(originY, window.innerHeight)
      );
      htmlEl.style.setProperty("--theme-target-radius", `${Math.ceil(metrics.radius)}px`);
      htmlEl.style.setProperty("--theme-duration", `${Math.round(metrics.duration)}ms`);

      const nextTheme = htmlEl.classList.contains("dark") ? "light" : "dark";
      updateThemeIcons(nextTheme === "dark", button, sunIcon, moonIcon);

      void playThemeTransition(htmlEl, nextTheme, metrics).finally(() => {
        updateThemeIcons(
          htmlEl.classList.contains("dark"),
          button,
          sunIcon,
          moonIcon
        );
        button?.removeAttribute("aria-disabled");
        button?.removeAttribute("aria-busy");
        button?.removeAttribute("data-unavailable");
        if (button instanceof HTMLButtonElement) {
          button.disabled = false;
        }
        isTransitioning = false;
      });
      return;
    }

    const nextTheme = htmlEl.classList.contains("dark") ? "light" : "dark";
    updateThemeIcons(nextTheme === "dark", button, sunIcon, moonIcon);

    void playThemeTransition(htmlEl, nextTheme, {
      radius: Math.hypot(window.innerWidth, window.innerHeight),
      duration: 1180,
      bounds: new DOMRect(0, 0, window.innerWidth, window.innerHeight),
    }).finally(() => {
      updateThemeIcons(
        htmlEl.classList.contains("dark"),
        button,
        sunIcon,
        moonIcon
      );
      button?.removeAttribute("aria-disabled");
      button?.removeAttribute("aria-busy");
      button?.removeAttribute("data-unavailable");
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
      }
      isTransitioning = false;
    });
  };

  updateThemeIcons(
    htmlEl.classList.contains("dark"),
    button,
    sunIcon,
    moonIcon
  );
  button?.addEventListener("click", handleThemeToggle);
  const observer = new MutationObserver(() => {
    updateThemeIcons(htmlEl.classList.contains("dark"), button, sunIcon, moonIcon);
  });
  observer.observe(htmlEl, { attributes: true, attributeFilter: ["class"] });

  return () => {
    observer.disconnect();
    button?.removeEventListener("click", handleThemeToggle);
  };
}
