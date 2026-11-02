import { parseTheme, THEME_COLORS, THEME_KEY, type Theme } from "./index";

/** The browser side of the Appearance choice: read it, change it, and hear about changes. */
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

/** Puts the choice on the page now: the attribute, and the address-bar colour. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (theme === "system") {
      // Back to the pair the layout wrote: one per scheme.
      meta.setAttribute("content", meta.dataset.systemContent ?? meta.content);
      if (meta.dataset.systemMedia) meta.setAttribute("media", meta.dataset.systemMedia);
    } else {
      if (meta.dataset.systemContent === undefined) {
        meta.dataset.systemContent = meta.content;
        meta.dataset.systemMedia = meta.getAttribute("media") ?? "";
      }
      meta.setAttribute("content", THEME_COLORS[theme]);
      meta.removeAttribute("media");
    }
  }
}

export function writeTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // No storage: the choice holds until the page is reloaded.
  }
  apply(theme);
  emit();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    // Another tab changed it.
    if (e.key === THEME_KEY || e.key === null) {
      apply(readTheme());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
