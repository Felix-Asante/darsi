import { useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "@/common/config/env";
import { schoolSlugFromHost } from "@/common/school/school-slug";
import { api } from "@/common/service/api";
import type { SchoolMembership } from "@/common/types/identity";

/**
 * On a school's subdomain, switching means going to the other subdomain.
 * Without one (local development, the root domain), the session's active school changes.
 */
export function useSwitchSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (school: SchoolMembership) => {
      const { protocol, host } = window.location;
      if (schoolSlugFromHost(host, env.NEXT_PUBLIC_ROOT_DOMAIN)) {
        // Another school's subdomain is another origin, which the client router cannot reach.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`${protocol}//${school.slug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}/`);
        return;
      }
      await api.members.setActiveSchool(school.id);
      queryClient.clear();
    },
  });
}
