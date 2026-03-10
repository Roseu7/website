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
  localStorage.setItem("theme", nextTheme);
}

function finishThemeTransition(body: HTMLElement, overlay: HTMLElement | null) {
  overlay?.classList.remove("is-prepared");
  overlay?.classList.remove("is-active");
  overlay?.classList.remove("is-fading");
  overlay?.removeAttribute("data-theme");
  body.classList.remove("theme-transition-active");
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function playThemeTransition(
  htmlEl: HTMLElement,
  nextTheme: "light" | "dark"
) {
  const body = document.body;
  const overlay = document.getElementById("theme-transition-layer");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>;
      finished: Promise<void>;
    };
  };
  const APPLY_DELAY_MS = 220;
  const REVEAL_DURATION_MS = 820;
  const INTERACTION_UNLOCK_MS = 680;
  const FADE_DELAY_MS = 760;
  const FINISH_DELAY_MS = 1080;

  if (prefersReducedMotion) {
    applyTheme(htmlEl, nextTheme);
    return Promise.resolve();
  }

  if (typeof doc.startViewTransition === "function") {
    body.classList.add("theme-transition-active");
    htmlEl.classList.add("theme-transition-running");

    const transition = doc.startViewTransition(() => {
      applyTheme(htmlEl, nextTheme);
    });

    const cleanup = transition.finished.catch(() => undefined).finally(() => {
      htmlEl.classList.remove("theme-transition-running");
      body.classList.remove("theme-transition-active");
    });

    const unlock = transition.ready
      .then(() => wait(INTERACTION_UNLOCK_MS))
      .catch(() => wait(REVEAL_DURATION_MS));

    return Promise.race([cleanup, unlock]);
  }

  body.classList.add("theme-transition-active");
  overlay?.setAttribute("data-theme", nextTheme);
  overlay?.classList.add("is-prepared");
  void overlay?.getBoundingClientRect();

  requestAnimationFrame(() => {
    overlay?.classList.add("is-active");
    overlay?.classList.remove("is-prepared");
  });

  window.setTimeout(() => {
    applyTheme(htmlEl, nextTheme);
  }, APPLY_DELAY_MS);

  window.setTimeout(() => {
    overlay?.classList.add("is-fading");
  }, FADE_DELAY_MS);

  window.setTimeout(() => {
    finishThemeTransition(body, overlay);
  }, FINISH_DELAY_MS);

  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      resolve();
    }, Math.min(FINISH_DELAY_MS, APPLY_DELAY_MS + REVEAL_DURATION_MS));
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

  const handleThemeToggle = () => {
    if (isTransitioning) return;

    isTransitioning = true;
    button?.setAttribute("aria-disabled", "true");
    button?.setAttribute("aria-busy", "true");
    button?.setAttribute("data-unavailable", "true");
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    const rect = button?.getBoundingClientRect();

    if (rect) {
      htmlEl.style.setProperty("--theme-origin-x", `${rect.left + rect.width / 2}px`);
      htmlEl.style.setProperty("--theme-origin-y", `${rect.top + rect.height / 2}px`);
    }

    const nextTheme = htmlEl.classList.contains("dark") ? "light" : "dark";
    updateThemeIcons(nextTheme === "dark", button, sunIcon, moonIcon);

    void playThemeTransition(htmlEl, nextTheme).finally(() => {
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

  return () => {
    button?.removeEventListener("click", handleThemeToggle);
  };
}
