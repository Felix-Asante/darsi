import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAuthService } from "./interface";

/** Better Auth's captcha plugin reads the Turnstile token from this header. */
const captcha = (token?: string | null) =>
  token ? { headers: { "x-captcha-response": token } } : undefined;

export function createAuthService(http: HttpClient): IAuthService {
  const { auth } = apiEndpoints;
  return {
    getSession: () =>
      http.get(auth.session(), undefined, { isRetryable: false }),
    signIn: (input) => http.post(auth.signIn(), input),
    signInWithGoogle: (callbackURL) =>
      http.post(auth.signInSocial(), { provider: "google", callbackURL }),
    signUp: (input, captchaToken) =>
      http.post(auth.signUp(), input, captcha(captchaToken)),
    signOut: () => http.post(auth.signOut(), {}),
    resendVerification: (input) =>
      http.post(auth.sendVerificationEmail(), input),
    requestPasswordReset: (input, captchaToken) =>
      http.post(auth.requestPasswordReset(), input, captcha(captchaToken)),
    resetPassword: (input) => http.post(auth.resetPassword(), input),
  };
}
