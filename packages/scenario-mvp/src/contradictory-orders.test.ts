import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  contradictoryOrdersActorView,
  contradictoryOrdersIds,
  contradictoryOrdersInitialState,
  contradictoryOrdersModel,
  runContradictoryOrdersScenario,
} from "./contradictory-orders.ts";

describe("contradictory orders scenario", () => {
  it("delivers both orders in one batch before opening one decision", async () => {
    const run = await runContradictoryOrdersScenario(
      "contradictory-orders-batch-test",
    );
    const received = run.records.filter(
      (record) =>
        record.kind === "committed" &&
        record.event.eventType === "order.status_changed" &&
        record.event.payload.status === "received",
    );
    const decisionsOpened = run.records.filter(
      (record) =>
        record.kind === "committed" &&
        record.event.eventType === "decision.opened",
    );
    const episode =
      run.debugTruth.decisionEpisodes[contradictoryOrdersIds.decision];

    expect(received).toHaveLength(2);
    expect(
      received.map((record) =>
        record.kind === "committed" ? record.event.occurredAt : -1,
      ),
    ).toEqual([120, 120]);
    expect(decisionsOpened).toHaveLength(1);
    expect(episode?.openedAt).toBe(130);
    expect(episode?.triggerObservationIds).toHaveLength(2);
    expect(episode?.candidateOrderIds).toEqual([
      contradictoryOrdersIds.chancellorOrder,
      contradictoryOrdersIds.rulerOrder,
    ]);
  });

  it("chooses practical control and mission fit over formal authority alone", async () => {
    const run = await runContradictoryOrdersScenario(
      "contradictory-orders-decision-test",
    );
    const episode =
      run.debugTruth.decisionEpisodes[contradictoryOrdersIds.decision];
    const chancellorOrder =
      run.debugTruth.orders[contradictoryOrdersIds.chancellorOrder];
    const rulerOrder = run.debugTruth.orders[contradictoryOrdersIds.rulerOrder];
    const unit = run.debugTruth.units[contradictoryOrdersIds.unit];

    expect(episode?.selectedOrderId).toBe(
      contradictoryOrdersIds.chancellorOrder,
    );
    expect(episode?.status).toBe("committed");
    expect(episode?.evaluations.map((evaluation) => evaluation.total)).toEqual([
      3.165, 2.29,
    ]);
    expect(
      episode?.evaluations[0]?.factors.map((factor) => factor.kind),
    ).toEqual([
      "funding",
      "appointment",
      "informal_influence",
      "mission_fit",
      "physical_access",
    ]);
    expect(chancellorOrder?.status).toBe("executed");
    expect(rulerOrder?.status).toBe("ignored");
    expect(unit?.locationId).toBe(contradictoryOrdersIds.granary);
  });

  it("does not reveal the competing order to the ruler before the report arrives", async () => {
    const run = await runContradictoryOrdersScenario(
      "contradictory-orders-visibility-test",
    );
    const before = JSON.stringify(run.rulerViewBeforeResponse);

    expect(run.rulerViewBeforeResponse.knownOutcome).toBe("awaiting_response");
    expect(before).not.toContain(contradictoryOrdersIds.chancellorOrder);
    expect(before).not.toContain(contradictoryOrdersIds.granary);
    expect(before).not.toContain('"status":"received"');
    expect(before).not.toContain("lifecycle");
    expect(run.rulerViewAfterResponse.knownOutcome).toBe("order_overruled");
    expect(run.rulerViewAfterResponse.disclosedAlternativeOrderId).toBe(
      contradictoryOrdersIds.chancellorOrder,
    );
  });

  it("replays the committed decision without resolving it again", async () => {
    const run = await runContradictoryOrdersScenario(
      "contradictory-orders-replay-test",
    );
    const replayed = replay(
      contradictoryOrdersInitialState,
      run.records,
      contradictoryOrdersModel.reduce,
    );

    expect(replayed).toEqual(run.state);
    expect(
      contradictoryOrdersActorView(replayed, contradictoryOrdersIds.ruler),
    ).toEqual(run.rulerViewAfterResponse);
  });
});
