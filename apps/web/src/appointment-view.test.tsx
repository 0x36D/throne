import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { runAppointmentScenario } from "@throne/scenario-mvp";
import { createTranslator } from "@throne/localization";
import { AppointmentView } from "./appointment-view.tsx";

describe("appointment information boundary", () => {
  it("keeps private support and obedience out of the pre-report ruler screen in both languages", async () => {
    const run = await runAppointmentScenario();
    for (const locale of ["zh-CN", "en"] as const) {
      const t = createTranslator(locale);
      const before = renderToStaticMarkup(
        <AppointmentView run={run} view="ruler" moment="before" t={t} />,
      );
      expect(before).toContain(t("appointment.waiting"));
      expect(before).not.toContain("0.95");
      expect(before).not.toContain(t("appointment.personalNetwork"));
      expect(before).not.toContain(t("appointment.replyTitle"));
      const after = renderToStaticMarkup(
        <AppointmentView run={run} view="ruler" moment="after" t={t} />,
      );
      expect(after).toContain(t("appointment.replyTitle"));
      const debug = renderToStaticMarkup(
        <AppointmentView run={run} view="debug" moment="after" t={t} />,
      );
      expect(debug).toContain("0.95");
      expect(debug).toContain(t("appointment.history"));
      expect(debug).toContain(t("appointment.successor"));
    }
  });
});
