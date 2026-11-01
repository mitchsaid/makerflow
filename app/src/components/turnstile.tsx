"use client";

import { useEffect, useRef } from "react";

/**
 * The "are you a person?" check from Cloudflare Turnstile (docs/runbooks/captcha.md), shown only when a site key is set
 * (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`): with none, nothing here appears and nothing changes. It reports a one-use token
 * that goes to Supabase with the sign-in or the demo start, where the protection is switched on; the token is null again
 * when it runs out or the check could not run.
 */
export const turnstileSiteKey = (): string | null => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    script.onerror = () => {
      loading = null;
      reject(new Error("the check could not be loaded"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const report = useRef(onToken);
  // The latest callback, kept for the widget (which is made once): updated after each render, not during it.
  useEffect(() => {
    report.current = onToken;
  });
  const siteKey = turnstileSiteKey();

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget: string | null = null;
    let gone = false;
    const element = box.current;
    loadTurnstile()
      .then((api) => {
        if (gone) return;
        widget = api.render(element, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token: string) => report.current(token),
          "expired-callback": () => report.current(null),
          "error-callback": () => report.current(null),
        });
      })
      .catch(() => report.current(null));
    return () => {
      gone = true;
      if (widget) (window as unknown as { turnstile?: TurnstileApi }).turnstile?.remove(widget);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={box} className="flex min-h-[65px] justify-center" data-testid="turnstile" />;
}
