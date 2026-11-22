import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import fr from "./messages/fr.json";

type Messages = { [key: string]: string | Messages };

function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : keys(value, `${prefix}${key}.`),
  );
}

describe("messages", () => {
  it("has every English key in French, and nothing extra", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it("has no empty translations", () => {
    for (const [locale, messages] of Object.entries({ en, fr })) {
      const empty = keys(messages).filter((key) => {
        const value = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Messages)[part], messages);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty, locale).toEqual([]);
    }
  });
});
