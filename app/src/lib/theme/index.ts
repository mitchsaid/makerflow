/**
 * Light, dark, or follow the device (docs/plans/visual-design.md). The choice is kept in the browser, per device, and
 * applied as `data-theme="light" | "dark"` on `<html>` before the first paint; with no attribute the page follows the
 * device's own setting. The words and the checks live here, apart from the screen, so they can be tested.
 */

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "makerflow-theme";

/** Anything but "light" or "dark" (nothing stored, a stale or edited value) means follow the device. */
export function parseTheme(raw: unknown): Theme {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** The browser's address-bar colours, as in the layout's `viewport.themeColor`. */
export const THEME_COLORS = { light: "#fbf6ec", dark: "#14110e" } as const;

export const THEME_CHOICES: readonly { value: Theme; title: string; hint?: string }[] = [
  { value: "system", title: "Same as this device", hint: "Follows its light or dark setting." },
  { value: "light", title: "Light" },
  { value: "dark", title: "Dark" },
];

/**
 * Runs in the page's head, before anything is painted, so the chosen colours are there from the first frame (no flash
 * of the wrong ones). Plain ES5 on purpose: it is inlined. Storage can be blocked: then the page just follows the device.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="light"&&t!=="dark")return;document.documentElement.setAttribute("data-theme",t);var c=t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};var fix=function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c);m[i].removeAttribute("media")}};fix();document.addEventListener("DOMContentLoaded",fix)}catch(e){}})();`;
