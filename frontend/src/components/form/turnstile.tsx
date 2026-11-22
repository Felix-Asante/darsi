"use client";

import Script from "next/script";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { env } from "@/common/config/env";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Header Better Auth's captcha plugin reads the token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

/** Whether forms must wait for a Turnstile token: only when a site key is configured. */
export const captchaEnabled = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/**
 * Cloudflare Turnstile on public forms (sign-up, password reset). Renders
 * nothing without a site key, so local development and tests are unaffected.
 */
export function Turnstile({
  onToken,
}: Readonly<{ onToken: (token: string | null) => void }>) {
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile),
  );
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!captchaEnabled || !loaded || !container.current || !window.turnstile)
      return;
    const id = window.turnstile.render(container.current, {
      sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      language: locale,
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(null),
      "error-callback": () => callback.current(null),
    });
    return () => window.turnstile?.remove(id);
  }, [loaded, locale]);

  if (!captchaEnabled) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} className="min-h-16" />
    </>
  );
}
