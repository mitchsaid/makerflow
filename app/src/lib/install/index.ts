/**
 * Adding MakerFlow to a phone's home screen (docs/plans/installable-app.md). The words and the checks live here, apart
 * from the screen, so they can be tested: which way a browser installs an app, and what to tell someone whose browser
 * cannot do it by itself.
 */

export type InstallWay =
  /** Already running as an installed app: nothing to offer. */
  | "installed"
  /** The browser has offered an install (Chrome, Edge, Android): one tap does it. */
  | "prompt"
  /** An iPhone or iPad in Safari: there is no install button, so say where it is. */
  | "ios"
  /** Anything else (a desktop Firefox, a browser that does not install apps): offer nothing. */
  | "none";

/** An iPhone or an iPad (a new iPad says it is a Mac, but has touch points). */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Chrome, Firefox and the like on an iPhone are Safari underneath and install the same way, but only Safari itself shows Share the way the words say. */
export function isIosSafari(userAgent: string): boolean {
  return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

export function installWay(input: { standalone: boolean; canPrompt: boolean; userAgent: string; maxTouchPoints?: number }): InstallWay {
  if (input.standalone) return "installed";
  if (input.canPrompt) return "prompt";
  if (isIos(input.userAgent, input.maxTouchPoints) && isIosSafari(input.userAgent)) return "ios";
  return "none";
}

export const IOS_STEPS = "In Safari, tap the Share button (the square with an arrow), then “Add to Home Screen”.";

/** What "Tell another maker" says, to share or to copy. */
export const SHARE_TEXT = "I use MakerFlow for quotes, jobs and invoices. Have a look:";

export function isAndroid(userAgent: string): boolean {
  return /Android/.test(userAgent);
}

/** What the card on Home tells a maker on a phone, by phone. `null` where there is nothing to say (installed, a computer). */
export type InstallGuide =
  /** The browser offered an install: one tap. */
  | { kind: "prompt"; title: string; line: string }
  /** Steps to follow in the browser's own menu. */
  | { kind: "steps"; title: string; line: string; steps: string[] };

const TITLE = "Put MakerFlow on your home screen";

export function installGuide(input: { standalone: boolean; canPrompt: boolean; userAgent: string; maxTouchPoints?: number }): InstallGuide | null {
  if (input.standalone) return null;
  const ios = isIos(input.userAgent, input.maxTouchPoints);
  if (!ios && !isAndroid(input.userAgent)) return null;
  if (input.canPrompt) return { kind: "prompt", title: TITLE, line: "Open it like an app, with its own icon." };
  if (ios) {
    return isIosSafari(input.userAgent)
      ? { kind: "steps", title: TITLE, line: "It opens like an app, with its own icon.", steps: ["Tap the Share button (the square with an arrow).", "Scroll down and tap “Add to Home Screen”.", "Tap “Add”."] }
      : { kind: "steps", title: TITLE, line: "On an iPhone this is done from Safari.", steps: ["Open this page in Safari.", "Tap the Share button (the square with an arrow).", "Scroll down and tap “Add to Home Screen”, then “Add”."] };
  }
  return { kind: "steps", title: TITLE, line: "It opens like an app, with its own icon.", steps: ["Tap the menu (three dots) at the top of your browser.", "Tap “Install app” or “Add to Home screen”.", "Tap “Install”."] };
}

/** How many days after a business is made the "add it to your home screen" prompt may still come up. */
export const INSTALL_PROMPT_DAYS = 3;

/** Is this business new enough that the one-time install prompt is for it (the first days after signing up)? */
export function isNewBusiness(createdAt: string, now: Date = new Date()): boolean {
  const made = Date.parse(createdAt);
  if (Number.isNaN(made)) return false;
  const age = now.getTime() - made;
  return age >= 0 && age <= INSTALL_PROMPT_DAYS * 24 * 60 * 60 * 1000;
}
