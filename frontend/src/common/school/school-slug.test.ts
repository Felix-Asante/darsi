import { describe, expect, it } from "vitest";
import { schoolSlugFromHost } from "./school-slug";

describe("schoolSlugFromHost", () => {
  it.each([
    ["greenfield.darsi.app", "darsi.app", "greenfield"],
    ["Ecole-Du-Lac.darsi.app", "darsi.app", "ecole-du-lac"],
    ["greenfield.localhost:3000", "localhost:3000", "greenfield"],
  ])("reads the school from %s", (host, root, slug) => {
    expect(schoolSlugFromHost(host, root)).toBe(slug);
  });

  it.each([
    ["darsi.app", "the marketing site"],
    ["www.darsi.app", "a reserved subdomain"],
    ["api.darsi.app", "a reserved subdomain"],
    ["a.b.darsi.app", "a nested subdomain"],
    ["greenfield.evil.app", "another domain"],
    ["evildarsi.app", "a lookalike domain"],
    ["-bad.darsi.app", "an invalid slug"],
  ])("finds no school on %s (%s)", (host) => {
    expect(schoolSlugFromHost(host, "darsi.app")).toBeNull();
  });

  it("finds no school without a host", () => {
    expect(schoolSlugFromHost(null, "darsi.app")).toBeNull();
  });
});
