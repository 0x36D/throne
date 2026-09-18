import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  decisionRevisionActorView,
  decisionRevisionIds,
  decisionRevisionInitialState,
  decisionRevisionModel,
  runDecisionRevisionScenario,
} from "./decision-revision.ts";

describe("decision revision scenario", () => {
  it("preserves both committed intents when new evidence reverses the decision", async () => {
    const run = await runDecisionRevisionScenario(
      "decision-revision-history-test",
    );
    const episode =
      run.debugTruth.decisionEpisodes[decisionRevisionIds.decision];

    expect(episode?.revisionCount).toBe(1);
    expect(episode?.status).toBe("committed");
    expect(episode?.activeIntentId).toBe(decisionRevisionIds.revisedIntent);
    expect(episode?.finalIntentIds).toEqual([
      decisionRevisionIds.firstIntent,
      decisionRevisionIds.revisedIntent,
    ]);
    expect(Object.keys(run.debugTruth.intents).sort()).toEqual(
      [
        decisionRevisionIds.firstIntent,
        decisionRevisionIds.revisedIntent,
      ].sort(),
    );
  });

  it("lets the faster countermand overtake the original message", async () => {
    const run = await runDecisionRevisionScenario(
      "decision-revision-race-test",
    );
    const first = run.debugTruth.orders[decisionRevisionIds.firstOrder];
    const revised = run.debugTruth.orders[decisionRevisionIds.revisedOrder];
    const unit = run.debugTruth.units[decisionRevisionIds.unit];

    expect(
      revised?.lifecycle.find((entry) => entry.status === "received")
        ?.occurredAt,
    ).toBe(90);
    expect(
      first?.lifecycle.find((entry) => entry.status === "received")?.occurredAt,
    ).toBe(120);
    expect(first?.lifecycle.map((entry) => entry.status)).toEqual([
      "created",
      "sent",
      "countermanded",
      "received",
      "ignored",
    ]);
    expect(revised?.lifecycle.map((entry) => entry.status)).toEqual([
      "created",
      "sent",
      "received",
      "acknowledged",
      "executed",
    ]);
    expect(unit?.acceptedOrderId).toBe(decisionRevisionIds.revisedOrder);
    expect(unit?.locationId).toBe(decisionRevisionIds.palace);
    expect(
      run.debugTruth.messages[decisionRevisionIds.firstMessage]?.status,
    ).toBe("delivered");
    expect(
      run.debugTruth.messages[decisionRevisionIds.revisedMessage]?.status,
    ).toBe("delivered");
  });

  it("shows the ruler only issued orders, received evidence, and later confirmation", async () => {
    const run = await runDecisionRevisionScenario(
      "decision-revision-visibility-test",
    );
    const afterFirst = JSON.stringify(run.rulerViewAfterFirstOrder);
    const afterRevision = JSON.stringify(run.rulerViewAfterRevision);

    expect(run.rulerViewAfterFirstOrder.issuedOrders).toHaveLength(1);
    expect(run.rulerViewAfterFirstOrder.knownOutcome).toBe(
      "first_order_in_flight",
    );
    expect(afterFirst).not.toContain(decisionRevisionIds.correctingObservation);
    expect(run.rulerViewAfterRevision.issuedOrders).toHaveLength(2);
    expect(run.rulerViewAfterRevision.knownOutcome).toBe("revision_in_flight");
    expect(afterRevision).not.toContain("travelTime");
    expect(afterRevision).not.toContain('"status":"delivered"');
    expect(run.rulerViewFinal.knownOutcome).toBe("revision_confirmed");
    expect(run.rulerViewFinal.observations.at(-1)?.observedAt).toBe(190);
  });

  it("replays the revision without erasing or recomputing either intent", async () => {
    const run = await runDecisionRevisionScenario(
      "decision-revision-replay-test",
    );
    const replayed = replay(
      decisionRevisionInitialState,
      run.records,
      decisionRevisionModel.reduce,
    );

    expect(replayed).toEqual(run.state);
    expect(
      decisionRevisionActorView(replayed, decisionRevisionIds.ruler),
    ).toEqual(run.rulerViewFinal);
  });
});
