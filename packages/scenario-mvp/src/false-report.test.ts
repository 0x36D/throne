import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  actorView,
  falseReportInitialState,
  falseReportModel,
  runFalseReportScenario,
} from "./false-report.ts";

describe("false report scenario", () => {
  it("keeps objective stock hidden while the ruler receives conflicting reports", async () => {
    const run = await runFalseReportScenario("false-report-test");
    const serializedView = JSON.stringify(run.rulerView);

    expect(run.debugTruth.regions["region:north"]?.grainStock).toBe(250);
    expect(run.rulerView.observations).toHaveLength(2);
    expect(run.rulerView.observations.map((item) => item.observedAt)).toEqual([
      70, 220,
    ]);
    expect(run.rulerView.beliefs[0]?.candidates).toEqual([
      {
        value: 250,
        confidence: 0.95,
        supportingObservationIds: ["observation:message:inspection"],
      },
      {
        value: 800,
        confidence: 0.72,
        supportingObservationIds: ["observation:message:governor-return"],
      },
    ]);
    expect(run.rulerView.contradictions).toHaveLength(1);
    expect(serializedView).not.toContain("grainStock");
  });

  it("replays the same objective and subjective state without cognition calls", async () => {
    const run = await runFalseReportScenario("false-report-replay-test");
    const replayed = replay(
      falseReportInitialState,
      run.records,
      falseReportModel.reduce,
    );

    expect(replayed).toEqual(run.state);
    expect(actorView(replayed, "actor:ruler")).toEqual(run.rulerView);
  });
});
