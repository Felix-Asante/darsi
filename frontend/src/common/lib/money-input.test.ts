import { describe, expect, it } from "vitest";
import {
  minorToInput,
  parseMoneyInput,
  parsePercentInput,
} from "./money-input";

describe("parseMoneyInput", () => {
  it.each([
    ["4500", "EUR", "450000"],
    ["4500.5", "EUR", "450050"],
    ["4 500,50", "EUR", "450050"],
    ["4,500.50", "USD", "450050"],
    ["4.500,50", "EUR", "450050"],
    ["1,234", "USD", "123400"],
    ["0,07", "EUR", "7"],
    ["1500", "JPY", "1500"],
    ["1.250", "TND", "1250"],
  ])("%s %s → %s", (text, currency, minor) => {
    expect(parseMoneyInput(text, currency)).toBe(minor);
  });

  it.each(["", "-5", "abc", "12.5.x", "1e5", "15,5", "9999999999999999"])(
    "refuses %j",
    (text) => {
      expect(parseMoneyInput(text, text === "15,5" ? "JPY" : "EUR")).toBeNull();
    },
  );

  it("round-trips with minorToInput", () => {
    expect(minorToInput("450050", "EUR")).toBe("4500.50");
    expect(minorToInput("7", "EUR")).toBe("0.07");
    expect(parseMoneyInput(minorToInput("123456", "EUR"), "EUR")).toBe(
      "123456",
    );
  });
});

describe("parsePercentInput", () => {
  it("reads basis points", () => {
    expect(parsePercentInput("5,5")).toBe(550);
    expect(parsePercentInput("10")).toBe(1000);
    expect(parsePercentInput("100")).toBe(10_000);
    expect(parsePercentInput("101")).toBeNull();
    expect(parsePercentInput("x")).toBeNull();
  });
});
