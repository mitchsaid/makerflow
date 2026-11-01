import { describe, expect, it } from "vitest";
import { installGuide, installWay, isIos, isIosSafari, isNewBusiness } from "../index";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DESKTOP_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0";

describe("how a browser installs MakerFlow", () => {
  it("an app that is already installed is left alone, whatever else is true", () => {
    expect(installWay({ standalone: true, canPrompt: true, userAgent: ANDROID_CHROME })).toBe("installed");
    expect(installWay({ standalone: true, canPrompt: false, userAgent: IPHONE_SAFARI })).toBe("installed");
  });

  it("a browser that offered an install gets the one-tap way", () => {
    expect(installWay({ standalone: false, canPrompt: true, userAgent: ANDROID_CHROME })).toBe("prompt");
  });

  it("Safari on an iPhone or an iPad is told where Add to Home Screen is", () => {
    expect(installWay({ standalone: false, canPrompt: false, userAgent: IPHONE_SAFARI })).toBe("ios");
    expect(installWay({ standalone: false, canPrompt: false, userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe("ios");
  });

  it("another browser on an iPhone, a desktop Mac and a desktop Firefox get nothing to tap", () => {
    expect(installWay({ standalone: false, canPrompt: false, userAgent: IPHONE_CHROME })).toBe("none");
    expect(installWay({ standalone: false, canPrompt: false, userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe("none");
    expect(installWay({ standalone: false, canPrompt: false, userAgent: DESKTOP_FIREFOX })).toBe("none");
  });

  it("tells an iPad that says it is a Mac by its touch points", () => {
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIos(IPAD_AS_MAC, 0)).toBe(false);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
  });
});

describe("the card on Home, by phone", () => {
  const base = { standalone: false, canPrompt: false };
  it("says nothing on a computer or in the installed app", () => {
    expect(installGuide({ ...base, userAgent: DESKTOP_FIREFOX })).toBeNull();
    expect(installGuide({ ...base, userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBeNull();
    expect(installGuide({ ...base, standalone: true, userAgent: ANDROID_CHROME })).toBeNull();
    expect(installGuide({ standalone: true, canPrompt: true, userAgent: IPHONE_SAFARI })).toBeNull();
  });
  it("offers one tap where the browser has offered an install", () => {
    expect(installGuide({ ...base, canPrompt: true, userAgent: ANDROID_CHROME })?.kind).toBe("prompt");
  });
  it("gives an iPhone in Safari the Share steps", () => {
    const guide = installGuide({ ...base, userAgent: IPHONE_SAFARI });
    expect(guide?.kind).toBe("steps");
    expect(guide && "steps" in guide && guide.steps.join(" ")).toMatch(/Share.*Add to Home Screen/);
  });
  it("tells another iPhone browser to use Safari", () => {
    const guide = installGuide({ ...base, userAgent: IPHONE_CHROME });
    expect(guide && "steps" in guide && guide.steps[0]).toMatch(/Safari/);
  });
  it("gives Android the browser's menu steps when it has not offered an install", () => {
    const guide = installGuide({ ...base, userAgent: ANDROID_CHROME });
    expect(guide && "steps" in guide && guide.steps.join(" ")).toMatch(/menu.*Install app.*Add to Home screen/);
  });
});

describe("who the one-time prompt is for", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("a business made in the last few days", () => {
    expect(isNewBusiness("2026-11-10T11:00:00Z", now)).toBe(true);
    expect(isNewBusiness("2026-11-08T13:00:00Z", now)).toBe(true);
  });
  it("not an older one, a date in the future, or nonsense", () => {
    expect(isNewBusiness("2026-11-06T12:00:00Z", now)).toBe(false);
    expect(isNewBusiness("2026-11-11T12:00:00Z", now)).toBe(false);
    expect(isNewBusiness("not a date", now)).toBe(false);
  });
});
