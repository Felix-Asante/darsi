import type { Page, Route } from "@playwright/test";

export const API_URL = "http://localhost:8080";

type Handler = (route: Route, url: URL) => Promise<void> | void;

export interface MeFixture {
  roles?: string[];
  onboardingCompleted?: boolean;
  schools?: number;
}

export function meFixture({ roles = ["admin", "teacher"], onboardingCompleted = true, schools = 1 }: MeFixture = {}) {
  const school = {
    id: "0195e0a0-0000-7000-8000-000000000001",
    name: "Greenfield School",
    slug: "greenfield",
    logo: null,
    defaultLocale: "en",
    timeZone: "Europe/Paris",
    currency: "EUR",
    onboardingCompleted,
    roles,
  };
  return {
    user: { id: "0195e0a0-0000-7000-8000-0000000000aa", name: "Ada Lovelace", email: "ada@greenfield.test", image: null, locale: "en" },
    schools: Array.from({ length: schools }, (_, index) => ({
      id: index === 0 ? school.id : `0195e0a0-0000-7000-8000-00000000000${index + 1}`,
      slug: index === 0 ? "greenfield" : `school-${index + 1}`,
      name: index === 0 ? school.name : `School ${index + 1}`,
      logo: null,
      roles,
    })),
    currentSchool: school,
  };
}

function cors(route: Route) {
  const origin = route.request().headers()["origin"] ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-school-slug, idempotency-key",
    "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE",
  };
}

/** Answers the API from fixtures. Unknown endpoints get a 404 problem. */
export async function mockApi(page: Page, handlers: Record<string, Handler>) {
  await page.route(`${API_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors(route) });
    const handler = handlers[`${route.request().method()} ${url.pathname}`] ?? handlers[url.pathname];
    if (handler) return handler(route, url);
    return route.fulfill({ status: 404, headers: cors(route), json: { status: 404, code: "not_found" } });
  });
}

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: cors(route), json: body });

/** A session cookie for the proxy, and an API that knows the user. */
export async function signIn(page: Page, me = meFixture(), extra: Record<string, Handler> = {}) {
  await page.context().addCookies([{ name: "darsi.session_token", value: "test", domain: "localhost", path: "/" }]);
  await mockApi(page, {
    "/api/v1/me": (route) => json(route, me),
    "/api/v1/notifications/unread-count": (route) => json(route, { count: 0 }),
    "/api/v1/notifications": (route) => json(route, { items: [], nextCursor: null }),
    ...extra,
  });
}
