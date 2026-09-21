import { describe, expect, it } from "vitest";
import { replay, SimulationKernel, InMemoryEventStore } from "@throne/sim-core";
import {
  simTime,
  readJsonObject,
  readStringArray,
  type DomainEvent,
} from "@throne/shared-types";
import {
  falseReportModel,
  falseReportInitialState,
  partialImplementationModel,
  partialImplementationInitialState,
  contradictoryOrdersModel,
  contradictoryOrdersInitialState,
  contradictoryOrdersIds,
  runContradictoryOrdersScenario,
  decisionRevisionModel,
  decisionRevisionInitialState,
  lossOfControlModel,
  lossOfControlInitialState,
  dynamicPromotionModel,
  dynamicPromotionInitialState,
  dynamicPromotionIds,
  runDynamicPromotionScenario,
  reducePlayerDecisionState,
  playerDecisionInitialState,
} from "./index.ts";

const unknown: DomainEvent = {
  id: "bad-event",
  occurredAt: simTime(0),
  eventType: "typo.unknown",
  payload: {},
};

describe("review regression cases", () => {
  it("all scenario projections reject unknown domain events", () => {
    const projections = [
      () => falseReportModel.reduce(falseReportInitialState, unknown),
      () =>
        partialImplementationModel.reduce(
          partialImplementationInitialState,
          unknown,
        ),
      () =>
        contradictoryOrdersModel.reduce(
          contradictoryOrdersInitialState,
          unknown,
        ),
      () => decisionRevisionModel.reduce(decisionRevisionInitialState, unknown),
      () => lossOfControlModel.reduce(lossOfControlInitialState, unknown),
      () => dynamicPromotionModel.reduce(dynamicPromotionInitialState, unknown),
      () => reducePlayerDecisionState(playerDecisionInitialState, unknown),
    ];
    for (const project of projections) expect(project).toThrow("typo.unknown");
  });

  it("distinguishes malformed payload fields from genuinely empty collections", () => {
    expect(readStringArray([])).toEqual([]);
    expect(readJsonObject({})).toEqual({});
    for (const value of [undefined, null, "bad", [42]]) {
      expect(() => readStringArray(value)).toThrow();
    }
    for (const value of [undefined, null, [], "bad"]) {
      expect(() => readJsonObject(value)).toThrow();
    }
    expect(() =>
      reducePlayerDecisionState(playerDecisionInitialState, {
        ...unknown,
        eventType: "observation.recorded",
        payload: {
          observationId: "damaged",
          actorId: "actor:ruler",
          subjectRefs: "not-an-array",
          content: {},
        },
      }),
    ).toThrow();
  });

  it.each(["share_evidence_with_chancellor", "conceal_evidence"])(
    "implements the actual effects of %s and replays them",
    async (capabilityId) => {
      const run = await runDynamicPromotionScenario({
        policy: {
          async decide() {
            return {
              selectedIntent: {
                goal: capabilityId,
                capabilityId,
                parameters: {},
              },
            };
          },
        },
      });
      const artifact = run.state.artifacts[dynamicPromotionIds.ledger];
      if (capabilityId === "share_evidence_with_chancellor") {
        expect(artifact?.disclosedToIds).toEqual([
          dynamicPromotionIds.chancellor,
        ]);
        expect(
          run.state.actorObservationIds[dynamicPromotionIds.chancellor],
        ).toHaveLength(1);
        expect(Object.values(run.state.messages)[0]?.status).toBe("delivered");
      } else {
        expect(artifact?.disposition).toBe("concealed");
        expect(artifact?.disclosedToIds).toEqual([]);
        expect(Object.values(run.state.messages)).toHaveLength(0);
      }
      expect(run.rulerViewFinal.observations).toHaveLength(0);
      expect(
        replay(
          dynamicPromotionInitialState,
          run.records,
          dynamicPromotionModel.reduce,
        ),
      ).toEqual(run.state);
    },
  );

  it("records an inaccessible operation as failed without moving the unit", async () => {
    const run = await runContradictoryOrdersScenario("failure-fixture");
    const ids = contradictoryOrdersIds;
    const unit = run.state.units[ids.unit]!;
    const state = {
      ...run.state,
      units: {
        ...run.state.units,
        [ids.unit]: { ...unit, accessibleLocationIds: [] },
      },
    };
    const store = new InMemoryEventStore();
    const kernel = new SimulationKernel(
      state,
      contradictoryOrdersModel,
      store,
      "inaccessible",
    );
    const intent = Object.values(state.intents)[0]!;
    await kernel.schedule({
      eventType: "operation.execute_intent",
      scheduledAt: simTime(300),
      payload: { intentId: intent.id },
    });
    await kernel.runUntilIdle();
    expect(kernel.state.orders[String(intent.parameters.orderId)]?.status).toBe(
      "failed",
    );
    expect(kernel.state.units[ids.unit]?.locationId).toBe(unit.locationId);
    expect(
      replay(state, await store.readAll(), contradictoryOrdersModel.reduce),
    ).toEqual(kernel.state);
  });
});
