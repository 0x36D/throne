import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "@throne/localization";
import { reportRunError, RunFailure } from "./run-failure.tsx";

describe("simulation failure recovery UI", () => {
  it("retains diagnostic details and offers restart without a session", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const error = new Error("Unknown office: missing");
      expect(reportRunError(error)).toBe(error);
      expect(log).toHaveBeenCalledWith("Simulation failed", error);
      for (const locale of ["zh-CN", "en"] as const) {
        const t = createTranslator(locale);
        const html = renderToStaticMarkup(
          <RunFailure error={error} t={t} onRestart={() => {}} />,
        );
        expect(html).toContain('role="alert"');
        expect(html).toContain(error.message);
        expect(html).toContain(t("play.restart"));
      }
    } finally {
      log.mockRestore();
    }
  });
});
