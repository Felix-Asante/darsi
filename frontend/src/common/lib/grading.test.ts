import { describe, expect, it } from "vitest";
import type { ScaleDefinition } from "@/common/types/assessment";
import { allowedValues, fromMastery, toMastery } from "./grading";

const french: ScaleDefinition = { kind: "points", maxPoints: 20, decimals: 1 };
const sbg: ScaleDefinition = {
  kind: "standards",
  levels: [
    { code: "1", minMastery: 0 },
    { code: "2", minMastery: 0.4 },
    { code: "3", minMastery: 0.65 },
    { code: "4", minMastery: 0.85 },
  ],
};

describe("grading hints", () => {
  it("matches the API's conversion maths", () => {
    expect(toMastery(french, "15,5")).toBe(0.775);
    expect(toMastery(french, "21")).toBeNull();
    expect(fromMastery(sbg, 0.775)).toBe("3");
    expect(fromMastery(french, toMastery(sbg, "4")!)).toBe("18.5");
    expect(allowedValues(sbg)).toBe("1, 2, 3, 4");
    expect(allowedValues(french)).toBe("0–20");
  });
});
