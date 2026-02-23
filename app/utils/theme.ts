function updateThemeIcons(
  htmlEl: HTMLElement,
  sunIcon: HTMLElement | null,
  moonIcon: HTMLElement | null
) {
  if (htmlEl.classList.contains("dark")) {
    sunIcon?.classList.remove("hidden");
    moonIcon?.classList.add("hidden");
  } else {
    sunIcon?.classList.add("hidden");
    moonIcon?.classList.remove("hidden");
  }
}

export function attachThemeToggle(options: {
  button: HTMLElement | null;
  sunIcon: HTMLElement | null;
  moonIcon: HTMLElement | null;
}) {
  const { button, sunIcon, moonIcon } = options;
  const htmlEl = document.documentElement;

  const handleThemeToggle = () => {
    htmlEl.classList.toggle("dark");
    localStorage.setItem("theme", htmlEl.classList.contains("dark") ? "dark" : "light");
    updateThemeIcons(htmlEl, sunIcon, moonIcon);
  };

  updateThemeIcons(htmlEl, sunIcon, moonIcon);
  button?.addEventListener("click", handleThemeToggle);

  return () => {
    button?.removeEventListener("click", handleThemeToggle);
  };
}
