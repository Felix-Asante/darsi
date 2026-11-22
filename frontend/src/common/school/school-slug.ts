const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "mail"]);
const VALID_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** `greenfield.darsi.app` → `greenfield`. The marketing site and reserved hosts have no school. */
export function schoolSlugFromHost(
  host: string | null | undefined,
  rootDomain: string,
): string | null {
  if (!host) return null;

  const normalizedHost = host.toLowerCase();
  const root = rootDomain.toLowerCase();
  if (!normalizedHost.endsWith(`.${root}`)) return null;

  const slug = normalizedHost.slice(0, -(root.length + 1));
  if (
    slug.includes(".") ||
    RESERVED_SUBDOMAINS.has(slug) ||
    !VALID_SLUG.test(slug)
  )
    return null;

  return slug;
}
