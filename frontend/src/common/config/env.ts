import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
    /** The host school subdomains hang off: `darsi.app` in production, `localhost:3000` locally. */
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1),
    /** Shows "Continue with Google" when the API has Google credentials. */
    NEXT_PUBLIC_GOOGLE_SIGN_IN: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** Cloudflare Turnstile on sign-up and password reset; set together with the API's `TURNSTILE_SECRET_KEY`. */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_GOOGLE_SIGN_IN: process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  emptyStringAsUndefined: true,
});
