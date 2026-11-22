/** `https://*.darsi.app` allows any school subdomain, but not `darsi.app` itself. */
export function isAllowedOrigin(origin: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (!pattern.includes('*.')) return pattern === origin;
    const [scheme, host] = pattern.split('*.');
    if (!origin.startsWith(scheme)) return false;
    const originHost = origin.slice(scheme.length);
    return (
      originHost.endsWith(`.${host}`) &&
      /^[a-z0-9-]+$/i.test(originHost.slice(0, -host.length - 1))
    );
  });
}
