import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  partialImplementationActorView,
  partialImplementationIds,
  partialImplementationInitialState,
  partialImplementationModel,
  runPartialImplementationScenario,
} from "./partial-implementation.ts";

describe("partial implementation scenario", () => {
  it("separates the order's reported completion from its actual execution", async () => {
    const run = await runPartialImplementationScenario(
      "partial-implementation-test",
    );
    const order = run.debugTruth.orders[partialImplementationIds.order];

    expect(order?.fulfilledAmount).toBe(150);
    expect(order?.requestedAmount).toBe(400);
    expect(order?.actualStatus).toBe("partially_executed");
    expect(order?.reportedStatus).toBe("reported_complete");
    expect(order?.reportedFulfilledAmount).toBe(400);
    expect(order?.lifecycle.map((entry) => entry.status)).toEqual([
      "created",
      "sent",
      "received",
      "acknowledged",
      "partially_executed",
      "reported_complete",
    ]);
    expect(
      run.debugTruth.accounts[partialImplementationIds.northernGranary]
        ?.balance,
    ).toBe(850);
    expect(
      run.debugTruth.accounts[partialImplementationIds.capitalGranary]?.balance,
    ).toBe(250);
  });

  it("keeps the partial transfer hidden until the independent audit arrives", async () => {
    const run = await runPartialImplementationScenario(
      "partial-implementation-visibility-test",
    );
    const beforeAudit = JSON.stringify(run.rulerViewBeforeAudit);

    expect(run.rulerViewBeforeAudit.order).toEqual({
      id: partialImplementationIds.order,
      requestedAmount: 400,
      knownStatus: "reported_complete",
      reportedFulfilledAmount: 400,
    });
    expect(beforeAudit).not.toContain('"claimedFulfilledAmount":150');
    expect(beforeAudit).not.toContain('"balance":850');
    expect(run.rulerViewAfterAudit.order).toEqual({
      id: partialImplementationIds.order,
      requestedAmount: 400,
      knownStatus: "disputed",
      reportedFulfilledAmount: 400,
      verifiedFulfilledAmount: 150,
    });
  });

  it("replays identical objective and actor-visible state", async () => {
    const run = await runPartialImplementationScenario(
      "partial-implementation-replay-test",
    );
    const replayed = replay(
      partialImplementationInitialState,
      run.records,
      partialImplementationModel.reduce,
    );

    expect(replayed).toEqual(run.state);
    expect(
      partialImplementationActorView(replayed, partialImplementationIds.ruler),
    ).toEqual(run.rulerViewAfterAudit);
  });
});
