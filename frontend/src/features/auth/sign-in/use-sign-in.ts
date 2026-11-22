import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { SignInValues } from "./sign-in.schema";

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      password,
      callbackURL,
    }: SignInValues & { callbackURL: string }) =>
      api.auth.signIn({ email, password, callbackURL }),
    onSuccess: () =>
      queryClient.removeQueries({ queryKey: queryKeys.me.all() }),
  });
}

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: (callbackURL: string) => api.auth.signInWithGoogle(callbackURL),
    onSuccess: ({ data }) => window.location.assign(data.url),
  });
}
