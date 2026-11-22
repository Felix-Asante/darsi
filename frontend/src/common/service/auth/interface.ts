import type { ApiResponse } from "@/common/types/api";
import type { Session } from "@/common/types/identity";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  locale: string;
  callbackURL: string;
}

export interface IAuthService {
  /** GET — the current session, or `null` when signed out. */
  getSession: () => ApiResponse<Session | null>;
  signIn: (input: {
    email: string;
    password: string;
    callbackURL?: string;
  }) => ApiResponse<unknown>;
  /** POST — returns the Google URL to send the browser to. */
  signInWithGoogle: (
    callbackURL: string,
  ) => ApiResponse<{ url: string; redirect: boolean }>;
  signUp: (
    input: SignUpInput,
    captchaToken?: string | null,
  ) => ApiResponse<unknown>;
  signOut: () => ApiResponse<unknown>;
  resendVerification: (input: {
    email: string;
    callbackURL: string;
  }) => ApiResponse<unknown>;
  requestPasswordReset: (
    input: { email: string; redirectTo: string },
    captchaToken?: string | null,
  ) => ApiResponse<unknown>;
  resetPassword: (input: {
    token: string;
    newPassword: string;
  }) => ApiResponse<unknown>;
}
