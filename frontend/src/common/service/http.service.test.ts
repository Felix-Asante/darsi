import {
  type AxiosAdapter,
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isApiError } from "@/common/utils/errors";
import { HttpClient } from "./http.service";

type Reply =
  | { status: number; data?: unknown; headers?: Record<string, string> }
  | { networkError: true };

function fakeServer(replies: Reply[]) {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config);
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
    if ("networkError" in reply)
      throw new AxiosError("Network Error", "ERR_NETWORK", config, {});

    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: String(reply.status),
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError(
        `Request failed with status ${reply.status}`,
        "ERR_BAD_RESPONSE",
        config,
        {},
        response,
      );
    }
    return response;
  };
  return { adapter, requests };
}

describe("HttpClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns data, status and status text", async () => {
    const { adapter } = fakeServer([{ status: 200, data: { ok: true } }]);

    await expect(new HttpClient({ adapter }).get("/x")).resolves.toEqual({
      data: { ok: true },
      status: 200,
      statusText: "200",
    });
  });

  it("sends cookies and the school of the current subdomain", async () => {
    const { adapter, requests } = fakeServer([{ status: 200 }]);

    await new HttpClient({ adapter, getSchoolSlug: () => "greenfield" }).get(
      "/x",
    );

    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].headers.get("X-School-Slug")).toBe("greenfield");
  });

  it("turns problem details into an ApiError with the stable code and field errors", async () => {
    const problem = {
      status: 400,
      code: "validation_failed",
      detail: "invalid",
      requestId: "req-1",
      errors: [{ field: "email", codes: ["isEmail"] }],
    };
    const { adapter } = fakeServer([{ status: 400, data: problem }]);

    const error = await new HttpClient({ adapter })
      .post("/x", {})
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 400,
      code: "validation_failed",
      requestId: "req-1",
      errors: [{ field: "email", codes: ["isEmail"] }],
    });
  });

  it("retries a GET after a server error, then succeeds", async () => {
    const { adapter, requests } = fakeServer([
      { status: 503 },
      { status: 200, data: "ok" },
    ]);

    const result = new HttpClient({ adapter }).get("/x");
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ data: "ok" });
    expect(requests).toHaveLength(2);
  });

  it("never retries a POST on its own, so a payment cannot be sent twice", async () => {
    const { adapter, requests } = fakeServer([
      { status: 503 },
      { status: 200 },
    ]);

    const result = new HttpClient({ adapter })
      .post("/payments", {})
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    expect(await result).toMatchObject({ code: "unknown", status: 503 });
    expect(requests).toHaveLength(1);
  });

  it("retries a POST that the caller marks as safe to repeat", async () => {
    const { adapter, requests } = fakeServer([
      { status: 503 },
      { status: 201 },
    ]);

    const result = new HttpClient({ adapter }).post(
      "/checkout",
      {},
      { isRetryable: true },
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ status: 201 });
    expect(requests).toHaveLength(2);
  });

  it("reports a network failure with its own code after retrying", async () => {
    const { adapter, requests } = fakeServer([{ networkError: true }]);

    const result = new HttpClient({ adapter })
      .get("/x")
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    expect(await result).toMatchObject({ code: "network" });
    expect(requests).toHaveLength(3);
  });

  it("tells the app once when the session has ended", async () => {
    const onUnauthorized = vi.fn();
    const { adapter } = fakeServer([
      { status: 401, data: { code: "unauthenticated" } },
    ]);

    const error = await new HttpClient({ adapter, onUnauthorized })
      .get("/x")
      .catch((e: unknown) => e);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, code: "unauthenticated" });
  });
});
