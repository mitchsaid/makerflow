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
