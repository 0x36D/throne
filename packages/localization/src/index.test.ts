import { describe, expect, it } from "vitest";
import { createTranslator, isLocale, translateToken } from "./index.ts";

describe("localization", () => {
  it("uses Chinese by catalog and interpolates structured parameters", () => {
    const t = createTranslator("zh-CN");
    expect(t("control.command", { round: 2 })).toBe("第 2 道命令");
    expect(t("partial.afterCopy", { amount: 160 })).toContain("160");
  });

  it("keeps English and internal-token fallback deterministic", () => {
    const t = createTranslator("en");
    expect(t("scenario.control.title")).toBe("Emergent loss of control");
    expect(translateToken(t, "not_obeyed")).toBe("not obeyed");
    expect(translateToken(t, "unregistered_token")).toBe("unregistered token");
  });

  it("accepts only supported locale identifiers", () => {
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-TW")).toBe(false);
  });
});
